import _ from 'lodash';
import moment from 'moment';

import logger from '#utils/logger.js';
import db, { nextSeq } from '#utils/dbUtil.js';
import { createGeoPoint } from '#utils/productGeoUtil.js';

const hasOwn = (object, property) => Object.prototype.hasOwnProperty.call(object, property);

const isPlainObject = value => value !== null
  && typeof value === 'object'
  && !Array.isArray(value);

const normalizeCoordinate = value => {
  if(typeof value === 'number'){
    return Number.isFinite(value) ? value : null;
  }

  if(typeof value === 'string' && value.trim() !== ''){
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
  }

  return null;
};

const removeClientGeoLocation = product => {
  for(const key of Object.keys(product)){
    if(key === 'geoLocation' || key.startsWith('geoLocation.')){
      delete product[key];
    }
  }
};

const getGeoPoint = product => {
  const latitude = product.extra?.lat ?? product['extra.lat'];
  const longitude = product.extra?.lng ?? product['extra.lng'];

  if(latitude === undefined || latitude === null || latitude === ''
      || longitude === undefined || longitude === null || longitude === ''){
    return null;
  }

  const normalizedLatitude = normalizeCoordinate(latitude);
  const normalizedLongitude = normalizeCoordinate(longitude);
  if(normalizedLatitude === null || normalizedLongitude === null){
    logger.warn('유효하지 않은 좌표 타입이라 GeoJSON 저장을 생략합니다.');
    return null;
  }

  try{
    return createGeoPoint(normalizedLatitude, normalizedLongitude);
  }catch(err){
    logger.warn(`유효하지 않은 위치라 GeoJSON 저장을 생략합니다: ${err.message}`);
    return null;
  }
};

const product = {
  // 상품 등록
  async create(newProduct){
    logger.trace(arguments);
    // geoLocation은 클라이언트 입력을 신뢰하지 않고 legacy 좌표에서 생성한다.
    removeClientGeoLocation(newProduct);
    newProduct._id = await nextSeq('product');
    newProduct.active = true;
    newProduct.updatedAt = newProduct.createdAt = moment().format('YYYY.MM.DD HH:mm:ss');
    const productToInsert = { ...newProduct };
    const geoLocation = getGeoPoint(newProduct);
    if(geoLocation){
      productToInsert.geoLocation = geoLocation;
      const [longitude, latitude] = geoLocation.coordinates;
      if(isPlainObject(productToInsert.extra)){
        // 문자열 숫자가 들어와도 legacy fallback과 GeoJSON이 같은 타입/값을 보도록
        // DB에는 두 좌표를 항상 number로 정규화한다.
        productToInsert.extra = {
          ...productToInsert.extra,
          lat: latitude,
          lng: longitude,
        };
      }
    }
    if(!newProduct.dryRun){
      await db.product.insertOne(productToInsert);
    }
    return newProduct;
  },

  // 상품 상세 조회(단일 속성)
  async findAttrById({ _id, attr, seller_id }){
    logger.trace(arguments);
    const query = { _id, active: true };
    if(!seller_id){
      query.show = true;
    }
    const item = await db.product.findOne(query, { projection: { [attr]: 1, _id: 0 }});
    logger.debug(item);
    return item;
  },

  // 상품 수정
  async update(_id, updateProduct){
    logger.trace(arguments);
    removeClientGeoLocation(updateProduct);
    updateProduct.updatedAt = moment().format('YYYY.MM.DD HH:mm:ss');
    const productToUpdate = { ...updateProduct };
    const hasExtraObject = hasOwn(updateProduct, 'extra');
    const hasDottedLatitude = hasOwn(updateProduct, 'extra.lat');
    const hasDottedLongitude = hasOwn(updateProduct, 'extra.lng');

    if(hasExtraObject && (isPlainObject(productToUpdate.extra)
        || hasDottedLatitude || hasDottedLongitude)){
      // 두 표기법이 섞여도 MongoDB의 parent/child path 충돌 없이 하나로 합친다.
      productToUpdate.extra = {
        ...(isPlainObject(productToUpdate.extra) ? productToUpdate.extra : {}),
        ...(hasDottedLatitude ? { lat: updateProduct['extra.lat'] } : {}),
        ...(hasDottedLongitude ? { lng: updateProduct['extra.lng'] } : {}),
      };
      delete productToUpdate['extra.lat'];
      delete productToUpdate['extra.lng'];
    }

    const hasNestedLatitude = isPlainObject(productToUpdate.extra)
      && hasOwn(productToUpdate.extra, 'lat');
    const hasNestedLongitude = isPlainObject(productToUpdate.extra)
      && hasOwn(productToUpdate.extra, 'lng');
    const locationWasUpdated = hasExtraObject || hasDottedLatitude || hasDottedLongitude;
    const hasLatitudeUpdate = hasNestedLatitude || hasDottedLatitude;
    const hasLongitudeUpdate = hasNestedLongitude || hasDottedLongitude;

    let locationSource = productToUpdate;
    if(hasLatitudeUpdate !== hasLongitudeUpdate){
      const currentProduct = await db.product.findOne(
        { _id, active: true },
        { projection: { extra: 1 } },
      );

      if(hasExtraObject){
        productToUpdate.extra = {
          ...(isPlainObject(currentProduct?.extra) ? currentProduct.extra : {}),
          ...productToUpdate.extra,
        };
        locationSource = { extra: productToUpdate.extra };
      }else{
        locationSource = {
          extra: {
            lat: hasDottedLatitude ? updateProduct['extra.lat'] : currentProduct?.extra?.lat,
            lng: hasDottedLongitude ? updateProduct['extra.lng'] : currentProduct?.extra?.lng,
          },
        };
      }
    }

    const geoLocation = getGeoPoint(locationSource);
    if(geoLocation){
      productToUpdate.geoLocation = geoLocation;
      const [longitude, latitude] = geoLocation.coordinates;
      if(hasExtraObject && isPlainObject(productToUpdate.extra)){
        productToUpdate.extra = {
          ...productToUpdate.extra,
          lat: latitude,
          lng: longitude,
        };
      }else{
        // 한 축만 PATCH한 경우 반대 축도 함께 number로 정규화해 Point와 동기화한다.
        productToUpdate['extra.lat'] = latitude;
        productToUpdate['extra.lng'] = longitude;
      }
    }

    const update = { $set: productToUpdate };
    if(locationWasUpdated && !geoLocation){
      // 좌표가 제거/손상된 경우 stale GeoJSON이 검색되지 않도록 함께 제거한다.
      update.$unset = { geoLocation: '' };
    }

    const result = await db.product.updateOne({ _id, active: true }, update);
    logger.debug(result);
    if(result.modifiedCount){
      return updateProduct;
    }else{
      return null;
    }
  },

  // 상품 삭제
  async delete(_id){
    logger.trace(arguments);
    const updatedAt = moment().format('YYYY.MM.DD HH:mm:ss');
    const result = await db.product.findOneAndUpdate({ _id }, { $set: { active: false, updatedAt } });
    logger.debug(result);
    result.active = false;
    return result;
  },
  
};
  
export default product;
