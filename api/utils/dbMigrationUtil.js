import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const GEO_LOCATION_INDEX = 'product_geoLocation_2dsphere';
const LEGACY_LATITUDE_INDEX = 'product_extra_lat_1';
const LEGACY_LONGITUDE_INDEX = 'product_extra_lng_1';
const REPLY_PRODUCT_INDEX = 'reply_product_id_1';
const BOOKMARK_PRODUCT_INDEX = 'bookmark_product_id_1';
const GEO_MIGRATION_ID = 'product_geojson_v2';
const MIGRATION_LEASE_MS = 10 * 60 * 1000;
const MIGRATION_WAIT_MS = 30 * 1000;
const MIGRATION_POLL_MS = 250;

let geoSearchReady = false;

export function isGeoSearchReady() {
  return geoSearchReady;
}

function createLeaseError() {
  const err = new Error('다른 인스턴스가 GeoJSON 마이그레이션을 진행 중입니다.');
  err.code = 'MIGRATION_LEASE_UNAVAILABLE';
  return err;
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForCompletedMigration(collection, waitMs, pollMs) {
  const deadline = Date.now() + waitMs;

  while(Date.now() <= deadline){
    const marker = await collection.findOne({ _id: GEO_MIGRATION_ID });
    if(marker?.status === 'complete'){
      return;
    }
    if(marker?.status === 'failed' || !marker){
      throw createLeaseError();
    }

    const remaining = deadline - Date.now();
    if(remaining <= 0){
      break;
    }
    await wait(Math.min(pollMs, remaining));
  }

  throw createLeaseError();
}

function hasSameKeySpec(left, right) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value], index) => {
      const [rightKey, rightValue] = rightEntries[index] || [];
      return key === rightKey && value === rightValue;
    });
}

function findUsableIndex(indexes, keySpec, options = {}) {
  const isGeoIndex = Object.values(keySpec).includes('2dsphere');
  const expectedPartialFilter = options.partialFilterExpression;

  return indexes.find(index => (
    hasSameKeySpec(index.key, keySpec)
    && (
      !index.partialFilterExpression
      || (expectedPartialFilter
        && isDeepStrictEqual(index.partialFilterExpression, expectedPartialFilter))
    )
    && (isGeoIndex || !index.sparse)
    && !index.collation
    && !index.hidden
  ));
}

async function listCollectionIndexes(collection) {
  try{
    return await collection.listIndexes().toArray();
  }catch(err){
    // 초기 배포처럼 컬렉션이 아직 없으면 createIndex가 컬렉션도 함께 만든다.
    if(err.code === 26){
      return [];
    }
    throw err;
  }
}

async function createIndexIfMissing(collection, keySpec, options) {
  const indexes = await listCollectionIndexes(collection);
  const existingIndex = findUsableIndex(indexes, keySpec, options);
  if(existingIndex){
    return existingIndex.name;
  }

  try{
    return await collection.createIndex(keySpec, options);
  }catch(err){
    // 여러 인스턴스가 동시에 시작했거나 같은 키의 인덱스가 다른 이름으로
    // 이미 존재하는 경우, 실제 인덱스를 다시 확인한 뒤 성공으로 처리한다.
    if(err.code === 85 || err.code === 86){
      const currentIndexes = await listCollectionIndexes(collection);
      const concurrentlyCreatedIndex = findUsableIndex(currentIndexes, keySpec, options);
      if(concurrentlyCreatedIndex){
        return concurrentlyCreatedIndex.name;
      }
    }
    throw err;
  }
}

async function acquireMigrationLease(db, owner) {
  const collection = db.collection('migration');
  const current = await collection.findOne({ _id: GEO_MIGRATION_ID });
  if(current?.status === 'complete'){
    return { collection, state: 'complete' };
  }

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + MIGRATION_LEASE_MS);
  const leaseResult = await collection.updateOne(
    {
      _id: GEO_MIGRATION_ID,
      status: { $ne: 'complete' },
      $or: [
        { leaseUntil: { $lte: now } },
        { leaseUntil: { $exists: false } },
      ],
    },
    {
      $set: {
        status: 'running',
        owner,
        leaseUntil,
        updatedAt: now,
      },
    },
  );

  if(leaseResult.modifiedCount === 1){
    return { collection, state: 'acquired' };
  }

  if(!current){
    try{
      await collection.insertOne({
        _id: GEO_MIGRATION_ID,
        status: 'running',
        owner,
        leaseUntil,
        createdAt: now,
        updatedAt: now,
      });
      return { collection, state: 'acquired' };
    }catch(err){
      if(err.code !== 11000){
        throw err;
      }
    }
  }

  const latest = await collection.findOne({ _id: GEO_MIGRATION_ID });
  if(latest?.status === 'complete'){
    return { collection, state: 'complete' };
  }
  return { collection, state: 'busy' };
}

async function completeMigration(collection, owner, result) {
  const now = new Date();
  const updateResult = await collection.updateOne(
    { _id: GEO_MIGRATION_ID, status: 'running', owner },
    {
      $set: {
        status: 'complete',
        completedAt: now,
        updatedAt: now,
        result,
      },
      $unset: { owner: '', leaseUntil: '', error: '' },
    },
  );

  if(updateResult.modifiedCount !== 1){
    throw createLeaseError();
  }
}

async function failMigration(collection, owner, migrationError) {
  await collection.updateOne(
    { _id: GEO_MIGRATION_ID, status: 'running', owner },
    {
      $set: {
        status: 'failed',
        updatedAt: new Date(),
        error: {
          code: migrationError.code || null,
          name: migrationError.name,
          message: migrationError.message,
        },
      },
      $unset: { owner: '', leaseUntil: '' },
    },
  );
}

/**
 * 기존 product.extra.lat/lng 좌표를 GeoJSON Point로 보강한다.
 *
 * - 유효한 legacy 좌표를 원본으로 사용해 geoLocation을 항상 재생성한다.
 * - 유효한 legacy 좌표가 없으면 기존의 잘못된 geoLocation을 제거한다.
 * - 각 문서는 원자적으로 갱신되므로 실행 중에도 기존 API를 계속 사용할 수 있다.
 * - 같은 입력에는 같은 결과가 생성되므로 재실행해도 안전하다.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<import('mongodb').UpdateResult>}
 */
export async function backfillProductGeoLocation(db) {
  const validLegacyCoordinates = {
    'extra.lat': { $type: 'number', $gte: -90, $lte: 90 },
    'extra.lng': { $type: 'number', $gte: -180, $lte: 180 },
  };

  return db.collection('product').updateMany(
    {
      $or: [
        validLegacyCoordinates,
        { geoLocation: { $exists: true } },
      ],
    },
    [
      {
        $set: {
          geoLocation: {
            $cond: [
              {
                $and: [
                  { $isNumber: '$extra.lat' },
                  { $gte: ['$extra.lat', -90] },
                  { $lte: ['$extra.lat', 90] },
                  { $isNumber: '$extra.lng' },
                  { $gte: ['$extra.lng', -180] },
                  { $lte: ['$extra.lng', 180] },
                ],
              },
              {
                type: 'Point',
                // GeoJSON 좌표 순서는 경도(lng), 위도(lat)이다.
                coordinates: [
                  { $convert: { input: '$extra.lng', to: 'double' } },
                  { $convert: { input: '$extra.lat', to: 'double' } },
                ],
              },
              '$$REMOVE',
            ],
          },
        },
      },
    ],
  );
}

/**
 * 조회 경로에 필요한 인덱스를 생성한다. 먼저 동일한 키의 사용 가능한 인덱스를
 * 확인하므로 이름이 다르더라도 중복 생성하지 않는다.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<{product: string, legacyLatitude: string, legacyLongitude: string, reply: string, bookmark: string}>}
 */
export async function ensureDatabaseIndexes(db) {
  const productCollection = db.collection('product');
  const replyCollection = db.collection('reply');
  const bookmarkCollection = db.collection('bookmark');

  // 초기 DB에서 동일 컬렉션에 대한 createIndex가 경합하지 않고, 인덱스 빌드가
  // 한꺼번에 DB 자원을 점유하지 않도록 순차 생성한다.
  const product = await createIndexIfMissing(
    productCollection,
    { geoLocation: '2dsphere' },
    { name: GEO_LOCATION_INDEX },
  );
  // fallback 인덱스를 한 필드씩 만들면 손상된 과거 문서에서 lat/lng가 모두
  // 배열이어도 compound multikey 제한 때문에 전체 마이그레이션이 실패하지 않는다.
  const legacyLatitude = await createIndexIfMissing(
    productCollection,
    { 'extra.lat': 1 },
    { name: LEGACY_LATITUDE_INDEX },
  );
  const legacyLongitude = await createIndexIfMissing(
    productCollection,
    { 'extra.lng': 1 },
    { name: LEGACY_LONGITUDE_INDEX },
  );
  const reply = await createIndexIfMissing(
    replyCollection,
    { product_id: 1 },
    { name: REPLY_PRODUCT_INDEX },
  );
  const bookmark = await createIndexIfMissing(
    bookmarkCollection,
    { product_id: 1 },
    { name: BOOKMARK_PRODUCT_INDEX },
  );

  return { product, legacyLatitude, legacyLongitude, reply, bookmark };
}

/**
 * 애플리케이션 시작 시 호출할 DB 마이그레이션 진입점.
 * 데이터 보강을 먼저 끝내고 공간 인덱스를 생성한다.
 *
 * @param {import('mongodb').Db} db
 */
export async function initializeDatabase(
  db,
  { migrationWaitMs = MIGRATION_WAIT_MS, migrationPollMs = MIGRATION_POLL_MS } = {},
) {
  // 이번 초기화가 완전히 끝나기 전에는 항상 legacy 검색을 사용한다.
  geoSearchReady = false;
  const owner = randomUUID();
  const lease = await acquireMigrationLease(db, owner);

  if(lease.state === 'busy'){
    // 롤링 배포 중 다른 인스턴스가 맡은 짧은 마이그레이션을 기다린다.
    // 완료되면 이 인스턴스도 즉시 GeoJSON 검색을 사용하고, 제한 시간 안에
    // 끝나지 않으면 호출자가 기존 좌표 검색으로 안전하게 기동한다.
    await waitForCompletedMigration(lease.collection, migrationWaitMs, migrationPollMs);
  }

  if(lease.state === 'complete' || lease.state === 'busy'){
    const indexes = await ensureDatabaseIndexes(db);
    geoSearchReady = true;
    return { skipped: true, indexes };
  }

  try{
    const geoLocationBackfill = await backfillProductGeoLocation(db);
    const indexes = await ensureDatabaseIndexes(db);
    const result = {
      geoLocationBackfill: {
        matchedCount: geoLocationBackfill.matchedCount,
        modifiedCount: geoLocationBackfill.modifiedCount,
      },
      indexes,
    };

    await completeMigration(lease.collection, owner, result);
    geoSearchReady = true;
    return { skipped: false, ...result };
  }catch(err){
    await failMigration(lease.collection, owner, err).catch(() => {});
    throw err;
  }
}

export default initializeDatabase;
