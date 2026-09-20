import _ from 'lodash';

import logger from '#utils/logger.js';
import db, { nextSeq } from '#utils/dbUtil.js';
import replyModel from '#models/user/reply.model.js';
import bookmarkModel from '#models/user/bookmark.model.js';
import { convertBoundsToGeoSearch } from '#utils/productGeoUtil.js';
import { isGeoSearchReady } from '#utils/dbMigrationUtil.js';

const product = {
  // 상품 검색
  async findBy({ sellerId, search={}, sortBy={}, page=1, limit=0, depth }){
    logger.trace(arguments);
    let normalizedSearch = search;
    if(isGeoSearchReady()){
      try{
        normalizedSearch = convertBoundsToGeoSearch(search, { includeLegacyFallback: true });
      }catch(err){
        // 기존 custom 검색 계약은 유지하고, 변환 가능한 정상 bounds만 GeoJSON으로 조회한다.
        logger.warn(`GeoJSON bounds 변환 생략: ${err.message}`);
      }
    }

    const query = { active: true, ...normalizedSearch };
    if(sellerId){
      // 판매자가 조회할 경우 자신의 상품만 조회
      query['seller_id'] = sellerId;
    }else{
      // 일반 회원이 조회할 경우
      query['show'] = true;
      if(depth !== 2){ // 옵션 목록 조회가 아닐 경우에만 수량 체크
        query['$expr'] = {
          '$gt': ['$quantity', '$buyQuantity']
        };
      }
    }

    const skip = (page-1) * limit;
    
    logger.debug(query);
    const listPromise = db.product.find(query).project({ content: 0, geoLocation: 0 }).skip(skip).limit(limit).sort(sortBy).toArray();
    const totalCountPromise = depth !== 2 && limit !== 0
      ? db.product.countDocuments(query)
      : Promise.resolve(null);
    const [list, countedTotal] = await Promise.all([listPromise, totalCountPromise]);

    const productIds = list.map(item => item._id);
    const [replyCounts, bookmarkCounts] = await Promise.all([
      replyModel.countByProductIds(productIds),
      bookmarkModel.countByProductIds(productIds),
    ]);

    for(const item of list){
      const productId = String(item._id);
      item.replies = replyCounts.get(productId) || 0;
      item.bookmarks = bookmarkCounts.get(productId) || 0;
    }
    const result = { item: list };
    if(depth !== 2){  // 옵션 목록 조회가 아닐 경우에만 pagination 필요
      const totalCount = limit === 0 ? list.length : countedTotal;
      result.pagination = {
        page,
        limit,
        total: totalCount,
        totalPages: (limit === 0) ? 1 : Math.ceil(totalCount / limit)
      };
    }

    logger.debug(list.length);
    return result;
  },

  // 상품 상세 조회
  async findById({ _id, seller_id }){
    logger.trace(arguments);
    const query = { _id, active: true };
    if(!seller_id){
      query.show = true;
    }
    const item = await db.product.findOne(query, { projection: { geoLocation: 0 } });
    if(item){
      item.replies = await replyModel.findBy({ product_id: _id });
      item.bookmarks = await bookmarkModel.findByProduct(_id);
      if(item.extra?.depth === 1){ // 옵션이 있는 상품일 경우
        item.options = await this.findBy({ search: { 'extra.parent': item._id }, depth: 2 });
      }
    }
    logger.debug(item);
    return item;
  },

};
  

export default product;
