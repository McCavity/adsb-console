import test from 'node:test';
import assert from 'node:assert/strict';
import { samplesDropped, tempZustand, daemonAlterS, strich, flagZustand, dienstZustand }
  from '../console/js/pages/system.js';

// Aufbau aus der Messung an adsapp01 am 28.07.2026.
const STATS = {
  last1min: { local: { samples_processed: 143917056, samples_dropped: 0 } },
  total:    { local: { samples_processed: 114451677184, samples_dropped: 0 } },
};

test('samples_dropped kommt aus stats.json, in zwei Werten', () => {
  assert.deepEqual(samplesDropped(STATS), { jetzt: 0, gesamt: 0 });
});

test('ein gerissenes Kriterium wird in beiden Werten sichtbar', () => {
  const kaputt = {
    last1min: { local: { samples_dropped: 12 } },
    total:    { local: { samples_dropped: 4711 } },
  };
  assert.deepEqual(samplesDropped(kaputt), { jetzt: 12, gesamt: 4711 });
});

test('fehlende Statistik ergibt null, nicht 0 -- eine 0 hiesse "gemessen, alles gut"', () => {
  assert.deepEqual(samplesDropped(null), { jetzt: null, gesamt: null });
  assert.deepEqual(samplesDropped({}), { jetzt: null, gesamt: null });
  assert.deepEqual(samplesDropped({ total: { local: {} } }), { jetzt: null, gesamt: null });
});

test('die Abnahmegrenze 72 Grad ist die erste Farbschwelle, nicht 60', () => {
  assert.equal(tempZustand(62.3), 'normal');
  assert.equal(tempZustand(69.3), 'normal');   // Mittel der Variante-B-Stunde
  assert.equal(tempZustand(71.5), 'normal');   // Maximum der Variante-B-Stunde
  assert.equal(tempZustand(71.9), 'normal');
});

test('ab 72 Grad Grenze, ab 80 Grad hart', () => {
  assert.equal(tempZustand(72.0), 'grenze');
  assert.equal(tempZustand(75.0), 'grenze');   // Wert nach dem Kaltstart
  assert.equal(tempZustand(79.9), 'grenze');
  assert.equal(tempZustand(80.0), 'hart');
});

test('ohne Messwert ist der Zustand unbekannt, nicht normal', () => {
  assert.equal(tempZustand(null), 'unbekannt');
  assert.equal(tempZustand(undefined), 'unbekannt');
  assert.equal(tempZustand('62.3'), 'unbekannt');
  assert.equal(tempZustand(NaN), 'unbekannt');
});

test('das Alter des Daemons kommt aus written_at, mit uebergebener Uhr', () => {
  assert.equal(daemonAlterS({ written_at: 1000 }, 1_042_000), 42);
});

test('written_at in der Zukunft ergibt 0, keine negative Zahl', () => {
  assert.equal(daemonAlterS({ written_at: 2000 }, 1_000_000), 0);
});

test('ohne written_at gibt es kein Alter', () => {
  assert.equal(daemonAlterS(null, 1_000_000), null);
  assert.equal(daemonAlterS({}, 1_000_000), null);
  assert.equal(daemonAlterS({ written_at: 'jetzt' }, 1_000_000), null);
});

test('strich macht aus null einen Gedankenstrich, aus 0 aber eine 0', () => {
  assert.equal(strich(null), '—');
  assert.equal(strich(undefined), '—');
  assert.equal(strich(0), '0');
  assert.equal(strich(0.35, 2), '0.35');
});

test('ein fehlendes Flag ist keine Entwarnung', () => {
  assert.deepEqual(flagZustand(null),      { klasse: 'unbekannt', text: '—' });
  assert.deepEqual(flagZustand(undefined), { klasse: 'unbekannt', text: '—' });
});

test('ein gemessenes false bleibt ein sichtbares "nein"', () => {
  assert.deepEqual(flagZustand(false), { klasse: 'aus', text: 'nein' });
});

test('ein gesetztes Flag meldet JA', () => {
  assert.deepEqual(flagZustand(true), { klasse: 'an', text: 'JA' });
});

test('ein laufender Dienst schlaegt keinen Alarm', () => {
  assert.deepEqual(dienstZustand('active'), { klasse: 'aus', text: 'active' });
});

test('ein toter Dienst schlaegt Alarm', () => {
  assert.deepEqual(dienstZustand('failed'), { klasse: 'an', text: 'failed' });
});

test('unbekannt ist weder gut noch Alarm', () => {
  assert.deepEqual(dienstZustand('unknown'), { klasse: 'unbekannt', text: 'unknown' });
  assert.deepEqual(dienstZustand(null),      { klasse: 'unbekannt', text: '—' });
  assert.deepEqual(dienstZustand(''),        { klasse: 'unbekannt', text: '—' });
});
