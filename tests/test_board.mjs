// tests/test_board.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
// Muss vor board.js importiert werden: setzt `globalThis.location`, das
// data.js (transitiv ueber console.js) im Modul-Toplevel liest. Siehe
// tests/helpers/node_env_shim.mjs und task-10-report.md.
import './helpers/node_env_shim.mjs';
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
