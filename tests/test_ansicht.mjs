import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig } from '../console/js/config.js';
import { erzeugeAnsicht, setzeStufe, schalteLayer, gilt } from '../console/js/ansicht.js';

test('ohne Ueberschreibung gilt genau die konfigurierte Reichweite', () => {
  const cfg = mergeConfig({ radar: { range_nm: 50 } });
  const s = gilt(erzeugeAnsicht(), cfg);
  assert.equal(s.range_nm, 50);
  assert.deepEqual(s.rings_nm, [10, 25, 50]);
});

test('Stufenwechsel liefert Reichweite UND Ringe der neuen Stufe', () => {
  const cfg = mergeConfig({});
  const s = gilt(setzeStufe(erzeugeAnsicht(), 0), cfg);
  assert.equal(s.range_nm, 10);
  assert.deepEqual(s.rings_nm, [2, 5, 10]);
});

test('Stufenindex ausserhalb klemmt, statt undefined zu liefern', () => {
  const cfg = mergeConfig({});
  for (const i of [-5, 99]) {
    const s = gilt(setzeStufe(erzeugeAnsicht(), i), cfg);
    assert.ok(Number.isFinite(s.range_nm), `Index ${i} lieferte keine Reichweite`);
    assert.ok(s.stufeIndex >= 0 && s.stufeIndex < s.stufen.length);
  }
});

test('Flugplatz-Layer ist vorgabegemaess an und laesst sich abschalten', () => {
  const cfg = mergeConfig({});
  assert.equal(gilt(erzeugeAnsicht(), cfg).layer.airports, true);
  const aus = schalteLayer(erzeugeAnsicht(), 'airports', false);
  assert.equal(gilt(aus, cfg).layer.airports, false);
});

test('unbekannte Layer-Kennung wird ignoriert, nicht angelegt', () => {
  const z = schalteLayer(erzeugeAnsicht(), 'holdings', true);
  assert.equal(Object.prototype.hasOwnProperty.call(z.layer, 'holdings'), false);
});

test('ansicht mutiert den uebergebenen Zustand nicht', () => {
  const z = erzeugeAnsicht();
  setzeStufe(z, 2);
  schalteLayer(z, 'airports', false);
  assert.equal(z.stufe, null);
  assert.deepEqual(z.layer, {});
});
