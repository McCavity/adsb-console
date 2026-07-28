import test from 'node:test';
import assert from 'node:assert/strict';
import { hoehenprofil, BAENDER, FL_MAX } from '../console/js/pages/profile.js';

const RCV = { lat: 50.0, lon: 9.0 };
// 50.05 / 9.05 liegt rund 4 NM vom erfundenen Empfaenger entfernt,
// 50.5 / 9.5 rund 38 NM, 51.5 / 10.5 weit ueber 50 NM.
const NAH  = { lat: 50.05, lon: 9.05 };
const FERN = { lat: 51.5,  lon: 10.5 };

const ac = (extra) => ({ hex: 'aaa000', ...NAH, ...extra });
const lauf = (liste, rangeNm = 50, highlight = true) =>
  hoehenprofil(liste, RCV, rangeNm, highlight);

test('sechs Baender in der Reihenfolge der Spec', () => {
  assert.equal(BAENDER.length, 6);
  assert.deepEqual(BAENDER.map(b => b.von), [-Infinity, 5000, 10000, 20000, 30000, 40000]);
});

test('Bandgrenze 5000 ft gehoert nach oben, nicht nach unten', () => {
  const r = lauf([ac({ alt_baro: 4999 }), ac({ alt_baro: 5000 })]);
  assert.equal(r.baender[0].anzahl, 1);
  assert.equal(r.baender[1].anzahl, 1);
});

test('Bandgrenze 40000 ft faellt in das oberste Band', () => {
  const r = lauf([ac({ alt_baro: 39999 }), ac({ alt_baro: 40000 })]);
  assert.equal(r.baender[4].anzahl, 1);
  assert.equal(r.baender[5].anzahl, 1);
});

test('ueber FL450 wird geklemmt und markiert, nicht weggelassen', () => {
  const r = lauf([ac({ alt_baro: 47000 })]);
  assert.equal(r.punkte.length, 1);
  assert.equal(r.punkte[0].altFt, FL_MAX);
  assert.equal(r.punkte[0].geklemmt, true);
});

test('unterhalb der Klemmgrenze bleibt der Wert unveraendert', () => {
  const r = lauf([ac({ alt_baro: 37000 })]);
  assert.equal(r.punkte[0].altFt, 37000);
  assert.equal(r.punkte[0].geklemmt, false);
});

test('mit Hoehe, ohne Position: gezaehlt und im Band, aber kein Punkt', () => {
  const r = lauf([{ hex: 'nopos', alt_baro: 12000 }]);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ohnePosition, 1);
  assert.equal(r.baender[2].anzahl, 1);
});

test('ausserhalb des Massstabs: gezaehlt und im Band, aber kein Punkt', () => {
  const r = lauf([{ hex: 'weit', ...FERN, alt_baro: 35000 }]);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ausserhalb, 1);
  assert.equal(r.baender[4].anzahl, 1);
});

test('alt_baro "ground" ist keine Hoehe -- weder Punkt noch Band', () => {
  const r = lauf([ac({ alt_baro: 'ground' })]);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ohnePosition, 0);
  assert.equal(r.ausserhalb, 0);
  assert.deepEqual(r.baender.map(b => b.anzahl), [0, 0, 0, 0, 0, 0]);
});

test('Ziel ganz ohne alt_baro faellt vollstaendig heraus', () => {
  const r = lauf([ac({})]);
  assert.equal(r.punkte.length, 0);
  assert.deepEqual(r.baender.map(b => b.anzahl), [0, 0, 0, 0, 0, 0]);
});

test('Entfernung wird gerechnet, nicht uebernommen', () => {
  const r = lauf([ac({ alt_baro: 30000 })]);
  assert.ok(r.punkte[0].nm > 3 && r.punkte[0].nm < 5,
            `erwartet rund 4 NM, war ${r.punkte[0].nm}`);
});

test('ohne Empfaengerposition gibt es keine Punkte, aber die Baender zaehlen', () => {
  const r = hoehenprofil([ac({ alt_baro: 30000 })], null, 50, true);
  assert.equal(r.punkte.length, 0);
  assert.equal(r.ohnePosition, 1);
  assert.equal(r.baender[4].anzahl, 1);
});

test('highlight=false schaltet auch den Seitenriss stumm', () => {
  const notfall = ac({ alt_baro: 30000, squawk: '7700' });
  assert.equal(lauf([notfall], 50, true).punkte[0].emergency, true);
  assert.equal(lauf([notfall], 50, false).punkte[0].emergency, false);
});

test('leere Eingabe ergibt leere Auswertung statt Absturz', () => {
  const r = lauf(null);
  assert.deepEqual(r.punkte, []);
  assert.equal(r.ohnePosition, 0);
  assert.deepEqual(r.baender.map(b => b.anzahl), [0, 0, 0, 0, 0, 0]);
});

test('negative Hoehe bekommt einen Punkt UND ein Band', () => {
  const r = lauf([ac({ alt_baro: -100 })]);
  assert.equal(r.punkte.length, 1);
  assert.equal(r.punkte[0].altFt, -100);
  assert.equal(r.baender[0].anzahl, 1);
});

test('was einen Punkt bekommt, wird auch in einem Band gezaehlt', () => {
  const r = lauf([ac({ alt_baro: -100 }), ac({ alt_baro: 0 }),
                  ac({ alt_baro: 37000 }), ac({ alt_baro: 47000 })]);
  const inBaendern = r.baender.reduce((a, b) => a + b.anzahl, 0);
  assert.equal(inBaendern, r.punkte.length + r.ohnePosition + r.ausserhalb);
});

test('ein null-Eintrag in der Liste wirft nicht', () => {
  const r = lauf([null, ac({ alt_baro: 30000 })]);
  assert.equal(r.punkte.length, 1);
});

test('die Bandgrenzen lassen sich nicht nachtraeglich verbiegen', () => {
  assert.throws(() => { 'use strict'; BAENDER[0].bis = 999; }, TypeError);
});
