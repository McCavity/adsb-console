import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefeReceiver, letzteZielzeit } from '../console/js/data.js';

test('gueltige Position wird uebernommen', () => {
  assert.deepEqual(pruefeReceiver({ lat: 50.0, lon: 9.0 }), { lat: 50.0, lon: 9.0 });
});

test('Text statt Zahl ergibt null, nicht NaN in jeder Entfernung', () => {
  assert.equal(pruefeReceiver({ lat: '50.0', lon: 9.0 }), null);
  assert.equal(pruefeReceiver({ lat: 50.0, lon: '9.0' }), null);
});

test('fehlender Schluessel ergibt null', () => {
  assert.equal(pruefeReceiver({ lat: 50.0 }), null);
});

test('NaN und Unendlich ergeben null', () => {
  assert.equal(pruefeReceiver({ lat: NaN, lon: 9.0 }), null);
  assert.equal(pruefeReceiver({ lat: 50.0, lon: Infinity }), null);
});

test('Werte ausserhalb des Wertebereichs ergeben null', () => {
  assert.equal(pruefeReceiver({ lat: 91, lon: 9.0 }), null);
  assert.equal(pruefeReceiver({ lat: 50.0, lon: 181 }), null);
});

test('kein Dokument, Array oder String ergibt null', () => {
  assert.equal(pruefeReceiver(null), null);
  assert.equal(pruefeReceiver(undefined), null);
  assert.equal(pruefeReceiver([50.0, 9.0]), null);
  assert.equal(pruefeReceiver('50.0,9.0'), null);
});

test('die Grenzwerte selbst sind gueltig', () => {
  assert.deepEqual(pruefeReceiver({ lat: 90, lon: 180 }), { lat: 90, lon: 180 });
  assert.deepEqual(pruefeReceiver({ lat: -90, lon: -180 }), { lat: -90, lon: -180 });
});

test('ohne je gesehenes Ziel gibt es keine Uhrzeit', () => {
  assert.equal(letzteZielzeit({ letztesZielMs: null }), null);
  assert.equal(letzteZielzeit({}), null);
});

test('die Uhrzeit des letzten Ziels wird als HH:MM ausgegeben', () => {
  // 2026-07-28 09:05 lokal, als Zeitstempel uebergeben -- die Funktion
  // liest keine Uhr, sie formatiert nur.
  const t = new Date(2026, 6, 28, 9, 5, 0).getTime();
  assert.equal(letzteZielzeit({ letztesZielMs: t }), '09:05');
});
