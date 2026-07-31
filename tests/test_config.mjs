import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, DEFAULTS } from '../console/js/config.js';

test('leere Eingabe ergibt die Vorgabewerte', () => {
  const c = mergeConfig(null);
  assert.deepEqual(c.pages, DEFAULTS.pages);
  assert.equal(c.radar.range_nm, 50);
});

test('Teilangaben ueberschreiben nur das Genannte', () => {
  const c = mergeConfig({ radar: { range_nm: 25 } });
  assert.equal(c.radar.range_nm, 25);
  assert.equal(c.radar.sweep_s, DEFAULTS.radar.sweep_s);
  assert.equal(c.dwell_s.radar, DEFAULTS.dwell_s.radar);
});

test('unbekannte Seitennamen werden verworfen, nicht uebernommen', () => {
  const c = mergeConfig({ pages: { gibtsnicht: true, radar: false } });
  assert.equal(c.pages.gibtsnicht, undefined);
  assert.equal(c.pages.radar, false);
});

test('alle Seiten aus ergibt trotzdem eine sichtbare Konsole', () => {
  // Ein weisser Schirm wegen einer Konfiguration ist inakzeptabel.
  const c = mergeConfig({ pages: { radar: false, board: false, target: false,
    stats: false, polar: false, profile: false, system: false } });
  assert.ok(c.activePages.length >= 1, 'mindestens eine Seite muss bleiben');
  assert.equal(c.activePages[0], 'radar');
});

test('unsinnige Zahlen fallen auf die Vorgabe zurueck', () => {
  assert.equal(mergeConfig({ radar: { range_nm: 0 } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ radar: { range_nm: -5 } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ radar: { sweep_s: -1 } }).radar.sweep_s, DEFAULTS.radar.sweep_s);
  assert.equal(mergeConfig({ radar: { range_nm: 'weit' } }).radar.range_nm, DEFAULTS.radar.range_nm);
  assert.equal(mergeConfig({ dwell_s: { radar: 0 } }).dwell_s.radar, DEFAULTS.dwell_s.radar);
});

test('falsche Typen an der Wurzel werden ignoriert', () => {
  assert.deepEqual(mergeConfig('kaputt').pages, DEFAULTS.pages);
  assert.deepEqual(mergeConfig([1, 2, 3]).pages, DEFAULTS.pages);
  assert.deepEqual(mergeConfig({ pages: 'ja' }).pages, DEFAULTS.pages);
});

test('stufen: konfigurierte Reichweite 35 wird als eigene Stufe sortiert ergaenzt', () => {
  const cfg = mergeConfig({ radar: { range_nm: 35, rings_nm: [10, 20, 35] } });
  const weiten = cfg.radar.stufen.map(s => s.range_nm);
  assert.deepEqual(weiten, [10, 35, 50, 80]);
});

test('stufen: konfigurierte Reichweite 50 erzeugt KEINE Dublette', () => {
  const cfg = mergeConfig({ radar: { range_nm: 50 } });
  const fuenfziger = cfg.radar.stufen.filter(s => s.range_nm === 50);
  assert.equal(fuenfziger.length, 1);
});

test('stufen: kaputte Liste faellt auf die Vorgaben zurueck, niemals auf leer', () => {
  for (const kaputt of [null, 'nein', [], [{}], [{ range_nm: -5 }], [{ range_nm: 10 }]]) {
    const cfg = mergeConfig({ radar: { stufen: kaputt } });
    assert.ok(cfg.radar.stufen.length > 0, `${JSON.stringify(kaputt)} ergab eine leere Liste`);
  }
});

test('stufen: ein Ring groesser als seine Reichweite wird aussortiert', () => {
  const cfg = mergeConfig({ radar: { stufen: [{ range_nm: 10, rings_nm: [2, 5, 10, 25] }] } });
  const zehner = cfg.radar.stufen.find(s => s.range_nm === 10);
  assert.deepEqual(zehner.rings_nm, [2, 5, 10]);
});
