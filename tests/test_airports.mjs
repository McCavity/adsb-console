// tests/test_airports.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../console/data/airports.json', import.meta.url)));

test('Frankfurt ist enthalten und hat vier Bahnen', () => {
  const eddf = data.airports.find(a => a.icao === 'EDDF');
  assert.ok(eddf, 'EDDF fehlt');
  assert.equal(eddf.runways.length, 4);
  assert.ok(eddf.runways.some(r => r.le_ident === '18' || r.he_ident === '36'));
});

test('jede Bahn hat beide Schwellen', () => {
  for (const a of data.airports) {
    for (const r of a.runways) {
      for (const k of ['le_lat', 'le_lon', 'he_lat', 'he_lon']) {
        assert.equal(typeof r[k], 'number', `${a.icao} ${r.le_ident}: ${k} fehlt`);
      }
    }
  }
});

test('alle Plaetze liegen im deklarierten Ausschnitt', () => {
  const [latMin, lonMin, latMax, lonMax] = data.bbox;
  for (const a of data.airports) {
    assert.ok(a.lat >= latMin && a.lat <= latMax, `${a.icao} ausserhalb`);
    assert.ok(a.lon >= lonMin && a.lon <= lonMax, `${a.icao} ausserhalb`);
  }
});
