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
