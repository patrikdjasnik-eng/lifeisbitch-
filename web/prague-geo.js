'use strict';

// Světové souřadnice jsou odvozené z Web Mercatoru, ne z ručně kreslené mřížky.
const R = 6378137;
const pragueBounds = Object.freeze({
  west: 14.385,
  east: 14.495,
  south: 50.055,
  north: 50.115
});
const districts = Object.freeze([
  { id: 'holesovice', name: 'Holešovice', lon: 14.449, lat: 50.103 },
  { id: 'karlin', name: 'Karlín', lon: 14.461, lat: 50.092 },
  { id: 'zizkov', name: 'Žižkov', lon: 14.463, lat: 50.083 },
  { id: 'vinohrady', name: 'Vinohrady', lon: 14.448, lat: 50.075 },
  { id: 'nove-mesto', name: 'Nové Město', lon: 14.424, lat: 50.078 }
]);
function project(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) >= 85.051129) {
    throw new RangeError('Neplatné zeměpisné souřadnice');
  }
  return { x: R * lon * Math.PI / 180, y: R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) };
}
function unproject(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Neplatná poloha');
  return { lon: x * 180 / (Math.PI * R), lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI };
}
const west = project(pragueBounds.west, 0).x;
const east = project(pragueBounds.east, 0).x;
const south = project(0, pragueBounds.south).y;
const north = project(0, pragueBounds.north).y;
function geoToWorld(lon, lat) {
  const point = project(lon, lat);
  return { x: point.x - west, y: north - point.y };
}
function worldToGeo(x, y) {
  return unproject(west + x, north - y);
}
const worldSize = Object.freeze({ width: east - west, height: north - south });
if (typeof module !== 'undefined') module.exports = { pragueBounds, districts, project, unproject, geoToWorld, worldToGeo, worldSize };
if (typeof window !== 'undefined') window.pragueGeo = { pragueBounds, districts, geoToWorld, worldToGeo, worldSize };
