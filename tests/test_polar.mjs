import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBearing } from '../console/js/geo.js';
import { SEKTOREN, SKALA_STUFE, skalaNm, sektorBereich, halterName }
  from '../console/js/pages/polar.js';

test('36 Sektoren zu je zehn Grad', () => {
  assert.equal(SEKTOREN, 36);
  assert.equal(360 / SEKTOREN, 10);
});

test('die Skala rundet auf die naechste 20-NM-Stufe auf', () => {
  assert.equal(skalaNm(79.37), 80);
  assert.equal(skalaNm(95), 100);
  assert.equal(skalaNm(20.01), 40);
});

test('ein Wert GENAU auf der Stufe bleibt auf der Stufe', () => {
  // Die Kalibrierung. Der plausibelste Rechenfehler -- ein ceil auf einen
  // um Epsilon erhoehten Wert, oder floor mit Nachschlag -- landet hier bei
  // 100 und wird sichtbar. Ohne diesen Fall waere ein solcher Fehler nur
  // dann zu sehen, wenn zufaellig ein Rekord genau auf 80,0 stuende.
  assert.equal(skalaNm(80), 80);
  assert.equal(skalaNm(20), SKALA_STUFE);
});

test('leerer, negativer oder unsinniger Bestand ergibt die Mindeststufe', () => {
  assert.equal(skalaNm(0), 20);
  assert.equal(skalaNm(-5), 20);
  assert.equal(skalaNm(null), 20);
  assert.equal(skalaNm(NaN), 20);
});

test('der Sektorbereich ist ein Bereich, keine Peilung', () => {
  // Gegenprobe, deren Antwort vorher feststeht: formatBearing macht aus der
  // 0 die 360 ("drei-sechs-null"), und das ist fuer eine Peilung richtig.
  // Fuer die Untergrenze eines Bereichs waere es falsch. Beide Konventionen
  // stehen hier nebeneinander, damit die Verwechslung auffaellt statt sich
  // einzuschleichen.
  assert.equal(formatBearing(0), '360°');
  assert.equal(sektorBereich(0), '000–009°');
  assert.equal(sektorBereich(1), '010–019°');
  assert.equal(sektorBereich(35), '350–359°');
});

test('der Halter ist das Callsign, ersatzweise der hex, nie eine Luecke', () => {
  // 19 von 36 Rekordhaltern hatten am 29.07.2026 kein Callsign -- der hex
  // ist hier der Regelfall, nicht die Ausnahme.
  assert.equal(halterName({ callsign: 'DLH8RY', hex: '3c65d0' }), 'DLH8RY');
  assert.equal(halterName({ callsign: null, hex: '502d65' }), '502d65');
  assert.equal(halterName({ callsign: '   ', hex: '502d65' }), '502d65');
  assert.equal(halterName({ callsign: null, hex: null }), '—');
  assert.equal(halterName(null), '—');
});
