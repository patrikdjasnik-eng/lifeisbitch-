'use strict';
const assert = require('node:assert/strict');
const { districts, geoToWorld, worldToGeo, worldSize } = require('../web/prague-geo.js');
assert.ok(worldSize.width > 1000 && worldSize.height > 1000);
for (const district of districts) {
  const point = geoToWorld(district.lon, district.lat);
  assert.ok(point.x >= 0 && point.x <= worldSize.width, district.id);
  assert.ok(point.y >= 0 && point.y <= worldSize.height, district.id);
  const roundtrip = worldToGeo(point.x, point.y);
  assert.ok(Math.abs(roundtrip.lon - district.lon) < 1e-9);
  assert.ok(Math.abs(roundtrip.lat - district.lat) < 1e-9);
}
assert.ok(geoToWorld(14.449, 50.103).y < geoToWorld(14.449, 50.075).y);
assert.throws(() => geoToWorld(NaN, 50));
console.log('PASS: Prague geo projection, bounds, district positions and inverse');
