import test from 'node:test';
import assert from 'node:assert/strict';
import { hoehenprofil, BAENDER, FL_MAX, BILD, punktX, punktY, profilReichweite,
         ringBeschriftung, ZEICHEN_PX } from '../console/js/pages/profile.js';
import { mergeConfig } from '../console/js/config.js';
import { erzeugeAnsicht, setzeStufe, gilt } from '../console/js/ansicht.js';

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

// Enge Spanne bewusst: Der echte Wert liegt bei 3,57 NM. Ein fehlender
// cos(lat)-Faktor -- der naheliegendste Fehler bei Laengengraden -- ergaebe
// 4,24 NM. Die Spanne 3 < x < 5 haette das nicht gefangen; 3,4 < x < 3,8
// schliesst 4,24 aus und macht den Test kalibrierbar rot.
test('Entfernung wird gerechnet, nicht uebernommen', () => {
  const r = lauf([ac({ alt_baro: 30000 })]);
  assert.ok(r.punkte[0].nm > 3.4 && r.punkte[0].nm < 3.8,
            `erwartet rund 3,57 NM, war ${r.punkte[0].nm}`);
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

test('ein Ziel auf FL000 liegt vollstaendig im Bild', () => {
  assert.ok(punktY(0) + BILD.punkt <= BILD.hoehe,
            `FL000 bei y=${punktY(0)} ragt unten heraus`);
});

test('ein Ziel an der oberen Kante liegt vollstaendig im Bild', () => {
  assert.ok(punktY(FL_MAX) - BILD.punkt >= 0,
            `FL450 bei y=${punktY(FL_MAX)} ragt oben heraus`);
});

test('ein Ziel bei 0,0 NM liegt vollstaendig im Bild', () => {
  assert.ok(punktX(0, 50) - BILD.punkt >= 0,
            `0 NM bei x=${punktX(0, 50)} ragt links heraus`);
});

test('ein Ziel am Maszstabsrand liegt vollstaendig im Bild', () => {
  assert.ok(punktX(50, 50) + BILD.punkt <= BILD.breite,
            `50 NM bei x=${punktX(50, 50)} ragt rechts heraus`);
});

test('die Abbildung ist monoton: weiter draussen heisst weiter rechts', () => {
  assert.ok(punktX(10, 50) < punktX(25, 50));
  assert.ok(punktX(25, 50) < punktX(50, 50));
});

test('die Abbildung ist monoton: hoeher heisst weiter oben', () => {
  assert.ok(punktY(40000) < punktY(10000));
  assert.ok(punktY(10000) < punktY(0));
});

// Sollwerte von Hand: Die Zeichenflaeche ist breite - 2*rand = 700 - 16 =
// 684 breit, ihre Mitte liegt bei rand + 342 = 350. Entsprechend ist die
// Hoehe 560 - 16 = 544, ihre Mitte bei 8 + 272 = 280. Beide Zahlen stehen
// unabhaengig von der Formel fest -- deshalb faengt dieser Test einen
// verrutschten Rand oder einen vergessenen Faktor, was die reinen
// Kantentests nicht koennen.
test('punktX bildet die Mitte des Massstabs auf die Bildmitte ab', () => {
  assert.equal(punktX(25, 50), 350);
  assert.equal(punktX(25, 50), BILD.rand + (BILD.breite - 2 * BILD.rand) / 2);
});

test('punktY bildet die halbe Hoehe auf die Bildmitte ab', () => {
  assert.equal(punktY(FL_MAX / 2), 280);
  assert.equal(punktY(FL_MAX / 2), BILD.rand + (BILD.hoehe - 2 * BILD.rand) / 2);
});

test('ein anderer Maszstab verschiebt beide Enden mit', () => {
  assert.ok(punktX(0, 25) - BILD.punkt >= 0);
  assert.ok(punktX(25, 25) + BILD.punkt <= BILD.breite);
});

// Der Seitenriss zeigt dieselben Ziele wie der Radarschirm. Stellt jemand
// die Reichweite auf 10 NM und das Profil rechnet weiter auf 50, dann
// widersprechen sich zwei Seiten desselben Geraets -- und zwar lautlos,
// weil beide fuer sich plausibel aussehen.
test('Hoehenprofil folgt der umgeschalteten Reichweite, nicht der Config', () => {
  const cfg = mergeConfig({});
  const sicht = gilt(setzeStufe(erzeugeAnsicht(), 0), cfg);   // 10 NM
  assert.equal(profilReichweite(sicht), 10);
  assert.notEqual(profilReichweite(sicht), cfg.radar.range_nm);
});

// --- Ringbeschriftung der Entfernungsachse -------------------------------
//
// Der aeusserste Ring ist per Konstruktion IMMER gleich der Reichweite
// (Stufen 10/50/80 mit rings_nm [2,5,10] / [10,25,50] / [20,50,80]). Er
// liegt damit bei x = 692 von 700, und eine stur nach rechts gesetzte
// Beschriftung ragt aus der Leinwand. Am 31.07.2026 im Foto gesehen: von
// "50 NM" war die "5" uebrig.
//
// Dieselbe Fehlerklasse wie EDFJ am Radarrand am 27.07. -- dort weicht die
// Kennung laengst auf die Seite aus, auf der Platz ist. Das Geschwister auf
// dieser Seite wurde damals nicht mitgezogen.
//
// ZEICHEN_PX ist gemessen, nicht geschaetzt: getComputedTextLength() im
// Chromium des Geraets gegen die echte console.css -- "50 NM" = 39,14
// Nutzereinheiten, "M" = 7,83.
test('Ringbeschriftung bleibt in der Leinwand -- in jeder Reichweitenstufe', () => {
  const stufen = [
    { range: 10, ringe: [2, 5, 10] },
    { range: 50, ringe: [10, 25, 50] },
    { range: 80, ringe: [20, 50, 80] },
  ];
  for (const { range, ringe } of stufen) {
    for (const ring of ringe) {
      const b = ringBeschriftung(ring, range);
      const text = `${ring} NM`;
      const breite = text.length * ZEICHEN_PX;
      const links = b.anchor === 'end' ? b.x - breite : b.x;
      const rechts = links + breite;
      assert.ok(links >= 0,
        `Stufe ${range}, Ring ${ring}: Beschriftung beginnt bei ${links.toFixed(1)} < 0`);
      assert.ok(rechts <= BILD.breite,
        `Stufe ${range}, Ring ${ring}: Beschriftung endet bei ${rechts.toFixed(1)} > ${BILD.breite}`);
    }
  }
});

// Die Beschriftung soll nur ausweichen, wo sie MUSS -- ein Label, das
// grundsaetzlich links vom Ring steht, waere schwerer zu lesen und haette
// denselben Test bestanden.
test('Ringbeschriftung weicht nur aus, wenn rechts kein Platz ist', () => {
  assert.equal(ringBeschriftung(10, 50).anchor, 'start');
  assert.equal(ringBeschriftung(25, 50).anchor, 'start');
  assert.equal(ringBeschriftung(50, 50).anchor, 'end');
});
