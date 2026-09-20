import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGeoPoint,
  convertBoundsToGeoSearch,
} from '../utils/productGeoUtil.js';

function deepFreeze(value){
  if(value && typeof value === 'object' && !Object.isFrozen(value)){
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const synchronizedPointExpression = {
  $and: [
    { $eq: ['$geoLocation.type', 'Point'] },
    {
      $eq: [
        '$geoLocation.coordinates',
        ['$extra.lng', '$extra.lat'],
      ],
    },
  ],
};

test('createGeoPoint는 [경도, 위도] 순서의 GeoJSON Point를 만든다', () => {
  assert.deepEqual(createGeoPoint(37.5056414183255, 127.05364470328), {
    type: 'Point',
    coordinates: [127.05364470328, 37.5056414183255],
  });
});

test('createGeoPoint는 좌표 타입과 범위를 검증한다', () => {
  assert.throws(() => createGeoPoint('37.5', 127), TypeError);
  assert.throws(() => createGeoPoint(Number.NaN, 127), TypeError);
  assert.throws(() => createGeoPoint(91, 127), RangeError);
  assert.throws(() => createGeoPoint(37.5, -181), RangeError);

  assert.deepEqual(createGeoPoint(-90, 180), {
    type: 'Point',
    coordinates: [180, -90],
  });
});

test('convertBoundsToGeoSearch는 다른 조건과 기존 $and를 보존해 GeoJSON/legacy 검색을 만든다', () => {
  const search = deepFreeze({
    active: true,
    show: true,
    'extra.depth': { $ne: 2 },
    'extra.startDate': { $gte: '2026-09-20' },
    'extra.endDate': { $lte: '2026-09-21' },
    'extra.lat': { $gte: 37.49, $lte: 37.52 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
    $and: [
      { quantity: { $gt: 0 } },
    ],
  });
  const before = structuredClone(search);

  const result = convertBoundsToGeoSearch(search);

  assert.deepEqual(result, {
    active: true,
    show: true,
    'extra.depth': { $ne: 2 },
    'extra.startDate': { $gte: '2026-09-20' },
    'extra.endDate': { $lte: '2026-09-21' },
    $and: [
      { quantity: { $gt: 0 } },
      {
        $or: [
          {
            geoLocation: {
              $geoWithin: {
                $geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [127.02, 37.49],
                    [127.06, 37.49],
                    [127.06, 37.52],
                    [127.02, 37.52],
                    [127.02, 37.49],
                  ]],
                },
              },
            },
            $expr: synchronizedPointExpression,
          },
          {
            $expr: { $not: [synchronizedPointExpression] },
            'extra.lat': { $gte: 37.49, $lte: 37.52 },
            'extra.lng': { $gte: 127.02, $lte: 127.06 },
          },
        ],
      },
    ],
  });
  assert.deepEqual(search, before);
});

test('legacy fallback은 geoLocation 누락/손상/stale Point를 대상으로 한다', () => {
  const result = convertBoundsToGeoSearch({
    'extra.lat': { $gte: 37.49, $lte: 37.52 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  });

  const legacyCondition = result.$and[0].$or[1];
  assert.deepEqual(legacyCondition, {
    $expr: { $not: [synchronizedPointExpression] },
    'extra.lat': { $gte: 37.49, $lte: 37.52 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  });
});

test('convertBoundsToGeoSearch는 좌표 조건이 없으면 검색 조건을 그대로 복사한다', () => {
  const search = deepFreeze({
    active: true,
    name: { $regex: 'parking' },
  });

  const result = convertBoundsToGeoSearch(search);

  assert.deepEqual(result, search);
  assert.notStrictEqual(result, search);
});

test('convertBoundsToGeoSearch는 마이그레이션 완료 후 geo 인덱스 전용 조건을 만든다', () => {
  const result = convertBoundsToGeoSearch({
    'extra.lat': { $gte: 37.49, $lte: 37.52 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  }, { includeLegacyFallback: false });

  assert.deepEqual(result, {
    $and: [
      {
        geoLocation: {
          $geoWithin: {
            $geometry: {
              type: 'Polygon',
              coordinates: [[
                [127.02, 37.49],
                [127.06, 37.49],
                [127.06, 37.52],
                [127.02, 37.52],
                [127.02, 37.49],
              ]],
            },
          },
        },
      },
    ],
  });
});

test('convertBoundsToGeoSearch는 불완전하거나 잘못된 범위를 거부한다', () => {
  assert.throws(() => convertBoundsToGeoSearch({
    'extra.lat': { $gte: 37.49, $lte: 37.52 },
  }), TypeError);

  assert.throws(() => convertBoundsToGeoSearch({
    'extra.lat': { $gte: 37.49 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  }), TypeError);

  assert.throws(() => convertBoundsToGeoSearch({
    'extra.lat': { $gte: 37.52, $lte: 37.49 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  }), RangeError);

  assert.throws(() => convertBoundsToGeoSearch({
    'extra.lat': { $gte: -91, $lte: 37.49 },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  }), RangeError);

  assert.throws(() => convertBoundsToGeoSearch({
    'extra.lat': { $gte: 37.49, $lte: 37.52, $exists: true },
    'extra.lng': { $gte: 127.02, $lte: 127.06 },
  }), TypeError);
});
