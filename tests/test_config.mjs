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
