import assert from 'node:assert/strict';
import test from 'node:test';

import initializeDatabase, {
  isGeoSearchReady,
} from '../utils/dbMigrationUtil.js';

function applyUpdate(document, update){
  if(update.$set){
    Object.assign(document, update.$set);
  }
  if(update.$unset){
    Object.keys(update.$unset).forEach(key => delete document[key]);
  }
}

function createFakeDb({ marker = null, backfillError = null } = {}){
  const calls = {
    updateMany: [],
    createIndex: [],
    markerUpdates: [],
  };
  const state = { marker };
  const indexesByCollection = new Map();
  const collections = new Map();

  const migrationCollection = {
    async findOne(){
      return state.marker;
    },
    async insertOne(document){
      if(state.marker){
        const err = new Error('duplicate key');
        err.code = 11000;
        throw err;
      }
      state.marker = { ...document };
      return { insertedId: document._id };
    },
    async updateOne(filter, update){
      calls.markerUpdates.push({ filter, update });
      if(!state.marker || state.marker._id !== filter._id){
        return { matchedCount: 0, modifiedCount: 0 };
      }

      if(filter.status?.$ne === 'complete'){
        const leaseExpired = !state.marker.leaseUntil
          || state.marker.leaseUntil <= filter.$or[0].leaseUntil.$lte;
        if(state.marker.status === 'complete' || !leaseExpired){
          return { matchedCount: 0, modifiedCount: 0 };
        }
      }else if(filter.status !== state.marker.status || filter.owner !== state.marker.owner){
        return { matchedCount: 0, modifiedCount: 0 };
      }

      applyUpdate(state.marker, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };

  const db = {
    collection(name){
      if(name === 'migration'){
        return migrationCollection;
      }
      if(!collections.has(name)){
        const indexes = [{ name: '_id_', key: { _id: 1 } }];
        indexesByCollection.set(name, indexes);
        collections.set(name, {
          async updateMany(filter, pipeline){
            calls.updateMany.push({ name, filter, pipeline });
            if(backfillError){
              throw backfillError;
            }
            return { matchedCount: 7, modifiedCount: 6 };
          },
          listIndexes(){
            return {
              async toArray(){
                return indexes;
              },
            };
          },
          async createIndex(key, options){
            calls.createIndex.push({ name, key, options });
            indexes.push({ key, ...options });
            return options.name;
          },
        });
      }
      return collections.get(name);
    },
  };

  return { calls, db, state };
}

test('initializeDatabase는 한 번만 좌표를 정규화하고 필요한 인덱스를 재사용한다', async () => {
  const { calls, db, state } = createFakeDb();

  const first = await initializeDatabase(db);
  const second = await initializeDatabase(db);

  assert.equal(first.skipped, false);
  assert.equal(first.geoLocationBackfill.matchedCount, 7);
  assert.equal(first.geoLocationBackfill.modifiedCount, 6);
  assert.equal(second.skipped, true);
  assert.equal(calls.updateMany.length, 1);
  assert.equal(calls.createIndex.length, 5);
  assert.deepEqual(calls.createIndex.map(call => call.key), [
    { geoLocation: '2dsphere' },
    { 'extra.lat': 1 },
    { 'extra.lng': 1 },
    { product_id: 1 },
    { product_id: 1 },
  ]);
  assert.equal(state.marker.status, 'complete');
  assert.equal(state.marker.owner, undefined);
  assert.equal(state.marker.leaseUntil, undefined);
  assert.equal(isGeoSearchReady(), true);
});

test('좌표 정규화는 valid legacy 값을 사용하고 나머지 geoLocation을 제거한다', async () => {
  const { calls, db } = createFakeDb();

  await initializeDatabase(db);

  const [{ filter, pipeline }] = calls.updateMany;
  assert.deepEqual(filter, {
    $or: [
      {
        'extra.lat': { $type: 'number', $gte: -90, $lte: 90 },
        'extra.lng': { $type: 'number', $gte: -180, $lte: 180 },
      },
      { geoLocation: { $exists: true } },
    ],
  });
  assert.deepEqual(pipeline[0].$set.geoLocation, {
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
        coordinates: [
          { $convert: { input: '$extra.lng', to: 'double' } },
          { $convert: { input: '$extra.lat', to: 'double' } },
        ],
      },
      '$$REMOVE',
    ],
  });
});

test('활성 lease가 제한 시간 안에 끝나지 않으면 중복 scan 없이 fallback 오류를 반환한다', async () => {
  const marker = {
    _id: 'product_geojson_v2',
    status: 'running',
    owner: 'another-instance',
    leaseUntil: new Date(Date.now() + 60_000),
  };
  const { calls, db } = createFakeDb({ marker });

  await assert.rejects(
    initializeDatabase(db, { migrationWaitMs: 0, migrationPollMs: 0 }),
    err => err.code === 'MIGRATION_LEASE_UNAVAILABLE',
  );
  assert.equal(calls.updateMany.length, 0);
  assert.equal(calls.createIndex.length, 0);
  assert.equal(isGeoSearchReady(), false);
});

test('다른 인스턴스의 migration 완료를 기다린 뒤 같은 인덱스를 사용한다', async () => {
  const marker = {
    _id: 'product_geojson_v2',
    status: 'running',
    owner: 'another-instance',
    leaseUntil: new Date(Date.now() + 60_000),
  };
  const { calls, db, state } = createFakeDb({ marker });
  const migrationCollection = db.collection('migration');
  const findOne = migrationCollection.findOne.bind(migrationCollection);
  let reads = 0;
  migrationCollection.findOne = async (...args) => {
    reads += 1;
    if(reads === 4){
      state.marker.status = 'complete';
    }
    return findOne(...args);
  };

  const result = await initializeDatabase(db, {
    migrationWaitMs: 50,
    migrationPollMs: 1,
  });

  assert.equal(result.skipped, true);
  assert.equal(calls.updateMany.length, 0);
  assert.equal(calls.createIndex.length, 5);
  assert.equal(isGeoSearchReady(), true);
});

test('실패했거나 만료된 marker는 다음 시작에서 다시 획득해 완료한다', async () => {
  const marker = {
    _id: 'product_geojson_v2',
    status: 'failed',
    leaseUntil: new Date(Date.now() - 60_000),
    error: { message: 'previous failure' },
  };
  const { calls, db, state } = createFakeDb({ marker });

  const result = await initializeDatabase(db);

  assert.equal(result.skipped, false);
  assert.equal(calls.updateMany.length, 1);
  assert.equal(state.marker.status, 'complete');
  assert.equal(state.marker.error, undefined);
  assert.equal(isGeoSearchReady(), true);
});

test('마이그레이션 실패 시 lease를 해제하고 실패 상태를 남겨 다음 시작에서 재시도할 수 있다', async () => {
  const backfillError = new Error('backfill failed');
  backfillError.code = 123;
  const { calls, db, state } = createFakeDb({ backfillError });

  await assert.rejects(initializeDatabase(db), backfillError);

  assert.equal(calls.updateMany.length, 1);
  assert.equal(calls.createIndex.length, 0);
  assert.equal(state.marker.status, 'failed');
  assert.equal(state.marker.owner, undefined);
  assert.equal(state.marker.leaseUntil, undefined);
  assert.equal(isGeoSearchReady(), false);
  assert.deepEqual(state.marker.error, {
    code: 123,
    name: 'Error',
    message: 'backfill failed',
  });
});
