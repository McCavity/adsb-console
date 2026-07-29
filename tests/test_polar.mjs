import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBearing } from '../console/js/geo.js';
import { SEKTOREN, SKALA_STUFE, skalaNm, sektorBereich, halterName, polarModell }
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

// Fixture in der Form, die der Daemon wirklich schreibt (build_range_json):
// records ist ein ARRAY, hour_max ein OBJEKT mit ZEICHENKETTEN-Schluesseln.
const rec = (sector, max_nm, extra = {}) => ({
  sector, max_nm, hex: 'aa' + String(sector).padStart(4, '0'),
  callsign: null, alt_ft: 38000, seen_at: '2026-07-27T18:21:58+02:00', ...extra,
});
// Heisst absichtlich nicht "bereich": So heisst ein FELD der Sektoren
// ("000–009°"), und zwei Bedeutungen fuer dasselbe Wort in derselben
// Datei sind eine Falle fuer den naechsten Leser.
const reihe = (von, bis, f) => {
  const out = [];
  for (let s = von; s <= bis; s++) out.push(f(s));
  return out;
};

test('hour_max wird als Objekt mit Zeichenketten-Schluesseln gelesen', () => {
  // Genau der Lesefehler vom 28.07.2026: max() lief ueber die SCHLUESSEL
  // statt ueber die Werte. Ein Modell, das hour_max als Array behandelt,
  // findet hier nichts und liefert null -- und faellt damit auf.
  const m = polarModell({ records: [rec(7, 40)], hour_max: { '7': 12.3 } });
  assert.equal(m.sektoren.length, 1);
  assert.equal(m.sektoren[0].stundeNm, 12.3);
});

test('ein Sektor ohne Stundenwert ergibt null, niemals 0', () => {
  const m = polarModell({ records: [rec(7, 40)], hour_max: {} });
  assert.equal(m.sektoren[0].stundeNm, null);
  assert.notEqual(m.sektoren[0].stundeNm, 0);
});

test('ein Stundenwert ueber dem Rekord bleibt stehen und wird nicht geklemmt', () => {
  // Kommt vor, wenn der Rekordbestand zurueckgesetzt wurde. Ehrlich
  // anzeigen ist richtig; klemmen waere eine stille Behauptung.
  const m = polarModell({ records: [rec(3, 20)], hour_max: { '3': 55 } });
  assert.equal(m.sektoren[0].stundeNm, 55);
  assert.equal(m.sektoren[0].rekordNm, 20);
});

test('die Skala folgt dem groessten Wert BEIDER Spuren', () => {
  // Sonst raegte eine Stundenlinie ueber dem Rekord aus dem Bild.
  const m = polarModell({ records: [rec(3, 20)], hour_max: { '3': 95 } });
  assert.equal(m.skalaNm, 100);
});

test('unbrauchbare Eintraege werden verworfen, nicht gerettet', () => {
  const m = polarModell({
    records: [rec(0, 30), rec(36, 99), rec(-1, 99), rec(5, null), { sector: 9 }],
    hour_max: {},
  });
  assert.deepEqual(m.sektoren.map(s => s.sektor), [0]);
});

test('leerer oder fehlender Bestand ergibt ein leeres Modell mit Mindestskala', () => {
  for (const eingabe of [null, {}, { records: [] }, { records: 'kaputt' }]) {
    const m = polarModell(eingabe);
    assert.deepEqual(m.sektoren, []);
    assert.equal(m.groesster, null);
    assert.equal(m.skalaNm, 20);
  }
});
