// tests/test_board.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTargets } from '../console/js/pages/board.js';

const RX = { lat: 12.0, lon: 34.0 };      // erfundene Empfaengerposition

test('Ziele ohne Position gehen nicht verloren', () => {
  // Gemessen: 13 von 26 Zielen hatten keine Position. Sie wegzulassen hiesse,
  // die Haelfte des Empfangs zu verschweigen.
  const { positioned, unpositioned } = splitTargets([
    { hex: 'a', lat: 12.1, lon: 34.0, flight: 'MIT1    ' },
    { hex: 'b', flight: 'OHNE1   ', alt_baro: 12000 },
    { hex: 'c' },
  ], RX);
  assert.equal(positioned.length, 1);
  assert.equal(unpositioned.length, 2);
});

test('nach Entfernung sortiert, das naechste zuerst', () => {
  const { positioned } = splitTargets([
    { hex: 'fern', lat: 13.0, lon: 34.0 },
    { hex: 'nah',  lat: 12.1, lon: 34.0 },
  ], RX);
  assert.deepEqual(positioned.map(t => t.hex), ['nah', 'fern']);
});

test('ohne Empfaengerposition faellt alles in die zweite Liste', () => {
  const { positioned, unpositioned } = splitTargets(
    [{ hex: 'a', lat: 12.1, lon: 34.0 }], null);
  assert.equal(positioned.length, 0);
  assert.equal(unpositioned.length, 1);
});

test('leere Eingabe ergibt zwei leere Listen', () => {
  const r = splitTargets([], RX);
  assert.deepEqual(r.positioned, []);
  assert.deepEqual(r.unpositioned, []);
});

test('highlight=false schaltet auch das Board stumm', () => {
  const ac = [{ hex: 'aaa111', flight: 'DLH123  ', squawk: '7700',
                lat: 50.1, lon: 9.1, alt_baro: 30000 }];
  const rcv = { lat: 50.0, lon: 9.0 };
  assert.equal(splitTargets(ac, rcv, true).positioned[0].emergency, true);
  assert.equal(splitTargets(ac, rcv, false).positioned[0].emergency, false);
});

test('highlight=false wirkt auch auf Ziele ohne Position', () => {
  const ac = [{ hex: 'bbb222', flight: 'AFR9   ', squawk: '7600', alt_baro: 12000 }];
  assert.equal(splitTargets(ac, null, true).unpositioned[0].emergency, true);
  assert.equal(splitTargets(ac, null, false).unpositioned[0].emergency, false);
});

test('ohne dritten Parameter bleibt die Markierung an', () => {
  const ac = [{ hex: 'ccc333', squawk: '7500', alt_baro: 9000 }];
  assert.equal(splitTargets(ac, null).unpositioned[0].emergency, true);
});

test('ein Ziel ohne Callsign traegt seine hex-Kennung, keinen Gedankenstrich', () => {
  // Gemessen am 28.07.: 38 von 174 Kennungen hatten nie ein Callsign, und
  // 134 verloren es zeitweise. Ein Gedankenstrich verschweigt ein Ziel,
  // das sehr wohl empfangen wurde.
  const ac = [{ hex: 'c0ffee', lat: 50.1, lon: 9.1, alt_baro: 30000 }];
  const t = splitTargets(ac, { lat: 50.0, lon: 9.0 }).positioned[0];
  assert.equal(t.callsign, null);
  assert.equal(t.hex, 'c0ffee');
});

test('ein vorhandenes Callsign bleibt das Callsign', () => {
  const ac = [{ hex: 'c0ffee', flight: 'DLH123  ', lat: 50.1, lon: 9.1, alt_baro: 30000 }];
  const t = splitTargets(ac, { lat: 50.0, lon: 9.0 }).positioned[0];
  assert.equal(t.callsign, 'DLH123');
});

// 50.36 / 9.0 liegt rund 21,6 NM von RX2 entfernt. Bis zum 31.07.2026
// listete die Tafel bis ueber 100 NM, waehrend das Radar daneben nichts
// meldete.
const RX2 = { lat: 50.0, lon: 9.0 };
const NAH  = { hex: 'nah',  lat: 50.05, lon: 9.0, alt_baro: 3000 };
const FERN = { hex: 'fern', lat: 50.36, lon: 9.0, alt_baro: 35000 };

test('Ziele jenseits der Reichweite stehen nicht mehr in der Tafel', () => {
  assert.equal(splitTargets([NAH, FERN], RX2, true).positioned.length, 2,
               'Voraussetzung: ohne Reichweite sind es zwei');
  const p = splitTargets([NAH, FERN], RX2, true, 10).positioned;
  assert.deepEqual(p.map(t => t.hex), ['nah']);
});

test('Ziele ohne Position bleiben, sie haben keine Entfernung', () => {
  // Sie stehen in der eigenen Zeile "ohne Position" und lassen sich nicht
  // gegen eine Reichweite pruefen -- ein Filter waere hier eine Erfindung.
  const r = splitTargets([FERN, { hex: 'nopos', alt_baro: 12000 }], RX2, true, 10);
  assert.equal(r.positioned.length, 0);
  assert.equal(r.unpositioned.length, 1);
});

test('gefiltert wird die ganze Liste, nicht erst die zwoelf naechsten', () => {
  // Die Tafel zeigt "die zwoelf naechsten". Der Schnitt auf zwoelf sitzt in
  // render(); der Filter muss VORHER greifen -- also hier, in der reinen
  // Funktion, die render() speist.
  const viele = [];
  for (let i = 0; i < 20; i++) viele.push({ hex: `n${i}`, lat: 50.0 + i * 0.002, lon: 9.0 });
  viele.push(FERN);
  const p = splitTargets(viele, RX2, true, 10).positioned;
  assert.equal(p.length, 20, 'alle zwanzig nahen Ziele bleiben, nur das ferne faellt');
  assert.equal(p.some(t => t.hex === 'fern'), false);
});

test('ohne vierten Parameter bleibt die Tafel unbegrenzt', () => {
  assert.equal(splitTargets([NAH, FERN], RX2, true).positioned.length, 2);
});
