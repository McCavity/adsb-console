import test from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from '../console/js/pages/stats.js';

// Aufbau und Groessenordnung stammen aus der Messung am Geraet.
const DOC = {
  last1min:  { start: 0, end: 60,  messages: 10000,
    local: { accepted: [6000, 300], signal: -13.5, noise: -27.4,
             peak_signal: -1.8, strong_signals: 20, gain_db: 36.4 },
    tracks: { all: 31, single_message: 19, unreliable: 19 } },
  last5min:  { start: 0, end: 300, messages: 50606,
    local: { accepted: [30041, 1440], signal: -13.5, noise: -27.4,
             peak_signal: -1.8, strong_signals: 102, gain_db: 36.4 },
    tracks: { all: 31, single_message: 19, unreliable: 19 } },
  last15min: { start: 0, end: 900, messages: 150000,
    local: { accepted: [90000, 4300], signal: -13.6, noise: -27.4,
             peak_signal: -1.8, strong_signals: 300, gain_db: 36.4 },
    tracks: { all: 40, single_message: 22, unreliable: 22 } },
};

test('Nachrichtenrate aus Zaehler und Zeitspanne', () => {
  const s = summarise(DOC);
  const w5 = s.windows.find(w => w.label === '5 min');
  assert.equal(w5.msgPerS, 169);            // 50606 / 300
});

test('drei Fenster in fester Reihenfolge', () => {
  assert.deepEqual(summarise(DOC).windows.map(w => w.label), ['1 min', '5 min', '15 min']);
});

test('akzeptierte Nachrichten summieren ueber die Korrekturstufen', () => {
  const w5 = summarise(DOC).windows.find(w => w.label === '5 min');
  assert.equal(w5.accepted, 31481);          // 30041 + 1440
});

test('fehlendes Dokument ergibt leere Auswertung statt Absturz', () => {
  const s = summarise(null);
  assert.deepEqual(s.windows, []);
  assert.equal(s.gain, null);
});

test('einzelnes fehlendes Fenster wird uebersprungen', () => {
  const s = summarise({ last5min: DOC.last5min });
  assert.equal(s.windows.length, 1);
});

test('Zeitspanne null erzeugt keine Division durch null', () => {
  const s = summarise({ last1min: { start: 5, end: 5, messages: 10,
    local: { accepted: [1, 0] }, tracks: {} } });
  assert.equal(s.windows[0].msgPerS, null);
});
