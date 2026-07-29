import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBearing } from '../console/js/geo.js';
import { SEKTOREN, SKALA_STUFE, skalaNm, sektorBereich, halterName, polarModell,
  RICHTUNGEN, SEKTOREN_JE_RICHTUNG, richtungen, zuletztGefallen }
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

test('ein hour_max in Array-Form wird abgewiesen', () => {
  // Der Test, der die Objektform WIRKLICH bewacht. Der Test darueber tut
  // es naemlich nicht: JS wandelt Objektschluessel beim Zugriff selbst in
  // Zeichenketten um, hm[7] und hm["7"] sind dasselbe. Das String(s) im
  // Code dokumentiert die Form, es traegt sie nicht -- erst der
  // Array.isArray-Schutz tut das, und der ist ohne diesen Fall ungeprueft.
  //
  // Ein Array an dieser Stelle waere ein Daemon, der seine Ausgabe
  // umgestellt hat. Dann ist die Stunde unbekannt, und unbekannt ist null
  // -- nicht der Wert, der zufaellig an Index 7 steht.
  const m = polarModell({ records: [rec(7, 40)], hour_max: [0, 0, 0, 0, 0, 0, 0, 99] });
  assert.equal(m.sektoren[0].stundeNm, null);
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

test('zwoelf Richtungen, jede GENAU drei Sektoren, zusammen 36', () => {
  // Der Test, der die Entscheidung bewacht. Acht 45-Grad-Richtungen
  // ergaeben abwechselnd vier und fuenf Sektoren -- bei einer
  // Maximum-Statistik ein systematischer Bias, und die Balken waeren
  // untereinander nicht vergleichbar. Eine Gruppierung, die 4,5 ergibt,
  // wird hier rot.
  assert.equal(RICHTUNGEN.length, 12);
  assert.equal(SEKTOREN_JE_RICHTUNG, 3);
  assert.equal(RICHTUNGEN.length * SEKTOREN_JE_RICHTUNG, SEKTOREN);

  const m = polarModell({
    records: reihe(0, 35, s => rec(s, 10 + s)), hour_max: {},
  });
  const gezaehlt = m.richtungen.flatMap(r => r.sektoren);
  assert.equal(gezaehlt.length, 36);
  assert.deepEqual([...new Set(gezaehlt)].sort((a, b) => a - b), gezaehlt.slice().sort((a, b) => a - b));
  for (const r of m.richtungen) assert.equal(r.sektoren.length, 3);
});

test('die Kardinalrichtungen sind Grenzen, nicht Namen', () => {
  assert.deepEqual([...RICHTUNGEN],
    ['NNO', 'NO', 'ONO', 'OSO', 'SO', 'SSO', 'SSW', 'SW', 'WSW', 'WNW', 'NW', 'NNW']);
  const m = polarModell({ records: reihe(0, 35, s => rec(s, 10)), hour_max: {} });
  assert.equal(m.richtungen[0].bereich, '000–029°');
  assert.equal(m.richtungen[0].sektoren.join(','), '0,1,2');
  assert.equal(m.richtungen[11].bereich, '330–359°');
  assert.equal(m.richtungen[11].sektoren.join(','), '33,34,35');
});

test('eine Richtung nimmt das Maximum ihrer Sektoren, nicht die Summe', () => {
  const m = polarModell({
    records: [rec(0, 10), rec(1, 40), rec(2, 25)],
    hour_max: { '0': 5, '1': 30, '2': 9 },
  });
  assert.equal(m.richtungen[0].rekordNm, 40);
  assert.equal(m.richtungen[0].stundeNm, 30);
});

test('eine Richtung ohne jeden Stundenwert ergibt null, niemals 0', () => {
  // Nachts der Regelfall fuer den Westen. Dieselbe Regel wie bei der
  // aufgerissenen Linie im Kreis -- zwei Stellen, eine Regel.
  const m = polarModell({ records: [rec(0, 10), rec(1, 40), rec(2, 25)], hour_max: {} });
  assert.equal(m.richtungen[0].stundeNm, null);
  assert.equal(m.richtungen[0].rekordNm, 40);
});

test('Halter und Flugflaeche einer Richtung gehoeren ihrem groessten Sektor', () => {
  const m = polarModell({
    records: [rec(0, 10, { callsign: 'KLEIN1' }),
              rec(1, 40, { callsign: 'GROSS1', alt_ft: 41000 }),
              rec(2, 25, { callsign: 'MITTE1' })],
    hour_max: {},
  });
  assert.equal(m.richtungen[0].halter, 'GROSS1');
  assert.equal(m.richtungen[0].altFt, 41000);
});

const NOW = Date.parse('2026-07-29T12:36:58+02:00');

test('der juengste Rekord gewinnt, nicht der letzte im Array', () => {
  const r = zuletztGefallen([
    rec(1, 79, { seen_at: '2026-07-27T18:21:58+02:00', callsign: 'ALT1' }),
    rec(23, 22, { seen_at: '2026-07-29T12:04:45+02:00', callsign: 'NEU1' }),
    rec(8, 39, { seen_at: '2026-07-29T11:31:37+02:00', callsign: 'MITTE' }),
  ], NOW);
  assert.equal(r.halter, 'NEU1');
  assert.equal(r.sektor, 23);
  assert.equal(r.bereich, '230–239°');
});

test('das Alter kommt aus der uebergebenen Uhr, nicht aus Date.now', () => {
  // Sonst waere die Funktion nicht testbar -- dieselbe Regel wie bei
  // letzteZielzeit in data.js.
  const r = zuletztGefallen(
    [rec(23, 22, { seen_at: '2026-07-29T12:04:45+02:00' })], NOW);
  assert.equal(r.alterMin, 32);
});

test('leere Liste ergibt null, nicht den Epochen-Nullpunkt', () => {
  assert.equal(zuletztGefallen([], NOW), null);
  assert.equal(zuletztGefallen(null, NOW), null);
});

test('ein unlesbarer Zeitstempel wird uebersprungen, nicht als aeltester gewertet', () => {
  const kaputt = rec(5, 10, { seen_at: 'gestern abend', callsign: 'KAPUTT' });
  const heil = rec(6, 11, { seen_at: '2026-07-28T09:00:00+02:00', callsign: 'HEIL1' });

  assert.equal(zuletztGefallen([kaputt, heil], NOW).halter, 'HEIL1');

  // BEIDE Reihenfolgen, und die zweite ist die, auf die es ankommt: Faellt
  // der isFinite-Schutz weg, bleibt die erste Reihenfolge trotzdem heil,
  // weil NaN <= x in JS immer false ist und der gueltige Rekord danach
  // ohnehin gewinnt. Erst wenn der kaputte Eintrag ZULETZT kommt,
  // ueberschreibt er den heilen -- und nur dann kann dieser Test den
  // fehlenden Schutz ueberhaupt sehen.
  assert.equal(zuletztGefallen([heil, kaputt], NOW).halter, 'HEIL1');
});
