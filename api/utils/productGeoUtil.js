const LATITUDE_FIELD = 'extra.lat';
const LONGITUDE_FIELD = 'extra.lng';
const GEO_FIELD = 'geoLocation';

const hasOwn = (object, property) => Object.prototype.hasOwnProperty.call(object, property);

function assertSearchObject(search){
  if(search === null || typeof search !== 'object' || Array.isArray(search)){
    throw new TypeError('search는 객체여야 합니다.');
  }
}

function assertCoordinate(value, name, min, max){
  if(typeof value !== 'number' || !Number.isFinite(value)){
    throw new TypeError(`${name} 값은 유한한 숫자여야 합니다.`);
  }
  if(value < min || value > max){
    throw new RangeError(`${name} 값은 ${min} 이상 ${max} 이하여야 합니다.`);
  }
}

function readBounds(condition, field, min, max){
  if(condition === null || typeof condition !== 'object' || Array.isArray(condition)){
    throw new TypeError(`${field} 조건은 $gte와 $lte를 포함한 객체여야 합니다.`);
  }

  if(!hasOwn(condition, '$gte') || !hasOwn(condition, '$lte')){
    throw new TypeError(`${field} 조건에는 $gte와 $lte가 모두 필요합니다.`);
  }

  const unsupportedOperators = Object.keys(condition).filter((key) => key !== '$gte' && key !== '$lte');
  if(unsupportedOperators.length > 0){
    throw new TypeError(`${field} 조건에는 $gte와 $lte만 사용할 수 있습니다.`);
  }

  assertCoordinate(condition.$gte, `${field}.$gte`, min, max);
  assertCoordinate(condition.$lte, `${field}.$lte`, min, max);

  if(condition.$gte >= condition.$lte){
    throw new RangeError(`${field}의 $gte 값은 $lte 값보다 작아야 합니다.`);
  }

  return {
    min: condition.$gte,
    max: condition.$lte,
  };
}

/**
 * 위도/경도를 MongoDB GeoJSON Point로 변환한다.
 * GeoJSON 좌표 순서는 [경도, 위도]다.
 */
export function createGeoPoint(latitude, longitude){
  assertCoordinate(latitude, 'latitude', -90, 90);
  assertCoordinate(longitude, 'longitude', -180, 180);

  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

/**
 * 기존 extra.lat/extra.lng 사각 범위 검색을 GeoJSON 검색으로 확장한다.
 *
 * 마이그레이션된 문서는 geoLocation의 2dsphere 인덱스를 사용한다.
 * includeLegacyFallback이 true면 아직 마이그레이션되지 않은 문서를
 * 기존 숫자 필드 조건으로도 조회한다.
 * 전달받은 search 객체는 변경하지 않는다.
 */
export function convertBoundsToGeoSearch(search = {}, { includeLegacyFallback = true } = {}){
  assertSearchObject(search);

  const hasLatitude = hasOwn(search, LATITUDE_FIELD);
  const hasLongitude = hasOwn(search, LONGITUDE_FIELD);

  if(!hasLatitude && !hasLongitude){
    return { ...search };
  }

  if(!hasLatitude || !hasLongitude){
    throw new TypeError(`${LATITUDE_FIELD}와 ${LONGITUDE_FIELD} 조건은 함께 전달해야 합니다.`);
  }

  const latitude = readBounds(search[LATITUDE_FIELD], LATITUDE_FIELD, -90, 90);
  const longitude = readBounds(search[LONGITUDE_FIELD], LONGITUDE_FIELD, -180, 180);

  const {
    [LATITUDE_FIELD]: ignoredLatitude,
    [LONGITUDE_FIELD]: ignoredLongitude,
    $and: existingAnd,
    ...remainingConditions
  } = search;

  if(existingAnd !== undefined && (!Array.isArray(existingAnd) || existingAnd.length === 0)){
    throw new TypeError('$and 조건은 하나 이상의 조건을 가진 배열이어야 합니다.');
  }

  const geometry = {
    type: 'Polygon',
    coordinates: [[
      [longitude.min, latitude.min],
      [longitude.max, latitude.min],
      [longitude.max, latitude.max],
      [longitude.min, latitude.max],
      [longitude.min, latitude.min],
    ]],
  };

  const synchronizedPointExpression = {
    $and: [
      { $eq: [`$${GEO_FIELD}.type`, 'Point'] },
      {
        $eq: [
          `$${GEO_FIELD}.coordinates`,
          [`$${LONGITUDE_FIELD}`, `$${LATITUDE_FIELD}`],
        ],
      },
    ],
  };

  const geoCondition = {
    [GEO_FIELD]: {
      $geoWithin: {
        $geometry: geometry,
      },
    },
    ...(includeLegacyFallback ? { $expr: synchronizedPointExpression } : {}),
  };

  const geoOrLegacyCondition = includeLegacyFallback
    ? {
      $or: [
        geoCondition,
        {
          // 누락/손상뿐 아니라 롤링 배포 중 구버전 서버가 좌표만 바꿔
          // stale Point가 된 문서도 legacy 좌표를 source of truth로 조회한다.
          $expr: { $not: [synchronizedPointExpression] },
          [LATITUDE_FIELD]: {
            $gte: latitude.min,
            $lte: latitude.max,
          },
          [LONGITUDE_FIELD]: {
            $gte: longitude.min,
            $lte: longitude.max,
          },
        },
      ],
    }
    : geoCondition;

  return {
    ...remainingConditions,
    $and: [
      ...(existingAnd || []),
      geoOrLegacyCondition,
    ],
  };
}

export default {
  createGeoPoint,
  convertBoundsToGeoSearch,
};
