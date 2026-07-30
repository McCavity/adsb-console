import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefeReceiver, letzteZielzeit, quellUrl } from '../console/js/data.js';

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

test('ohne Browser faellt quellUrl auf die eigene Datei zurueck', () => {
  // location gibt es nur im Browser. Wird es auf Modulebene gelesen, ist
  // JEDER Node-Test unmoeglich, der data.js auch nur mittelbar importiert
  // -- am 27.07.2026 genau so aufgetreten, als das erste Seitenmodul
  // dazukam. Deshalb erst beim Aufruf.
  assert.equal(typeof location, 'undefined');
  assert.equal(quellUrl('range', 'data/range.json'), 'data/range.json');
});

test('ein gesetzter Parameter biegt die Quelle um', () => {
  globalThis.location = { search: '?range=pruef/luecke.json' };
  try {
    assert.equal(quellUrl('range', 'data/range.json'), 'pruef/luecke.json');
  } finally {
    delete globalThis.location;
  }
});

test('ein fremder Parameter laesst die Quelle in Ruhe', () => {
  // Die Kalibrierung: Eine Fassung, die den falschen Parameter liest oder
  // ueberhaupt jeden, wird hier rot. Ohne diesen Fall koennte ?source= die
  // Reichweitendatei umbiegen, ohne dass es auffaellt.
  globalThis.location = { search: '?source=pruef/ziele.json' };
  try {
    assert.equal(quellUrl('range', 'data/range.json'), 'data/range.json');
  } finally {
    delete globalThis.location;
  }
});
