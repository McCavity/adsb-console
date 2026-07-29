import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBearing } from '../console/js/geo.js';
import { SEKTOREN, SKALA_STUFE, skalaNm, sektorBereich, halterName, polarModell,
  RICHTUNGEN, SEKTOREN_JE_RICHTUNG, richtungen, zuletztGefallen,
  BILD, R_PX, MITTE, werteArray, keilPfad, treppenPfade,
  markenPlatz, markenKasten, PEIL_SCHRIFT, datumKurz, zahlNm, radialen }
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

test('sektorBereich weist einen unbrauchbaren Sektor ab, statt ihn plausibel zu machen', () => {
  // Das doppelte Modulo der ersten Fassung war kein Schutz: Es machte aus
  // null die 0 und damit "000–009°" -- eine Falschaussage, die wie eine
  // Messung aussieht. Aus 'zwoelf' machte es "NaN–NaN°".
  assert.equal(sektorBereich(0), '000–009°');
  assert.equal(sektorBereich(35), '350–359°');
  assert.equal(sektorBereich(36), '—');
  assert.equal(sektorBereich(-1), '—');
  assert.equal(sektorBereich(null), '—');
  assert.equal(sektorBereich('zwoelf'), '—');
  assert.equal(sektorBereich(2.5), '—');
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
  // Sonst ragte eine Stundenlinie ueber dem Rekord aus dem Bild.
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

test('zuletztGefallen ueberspringt einen Satz mit unbrauchbarem Sektor', () => {
  // Sonst schreibt die Wandanzeige den juengsten Rekord der falschen
  // Himmelsrichtung zu. polarModell verwirft solche Saetze bereits -- zwei
  // Teile derselben Konsole duerfen dieselbe Eingabe nicht verschieden
  // deuten.
  const r = zuletztGefallen([
    rec(6, 11, { seen_at: '2026-07-28T09:00:00+02:00', callsign: 'HEIL1' }),
    { sector: null, max_nm: 99, hex: 'ffffff', callsign: 'KAPUTT',
      alt_ft: 1000, seen_at: '2026-07-29T12:00:00+02:00' },
  ], Date.parse('2026-07-29T13:00:00+02:00'));
  assert.equal(r.halter, 'HEIL1');
});

const voll = Array.from({ length: 36 }, () => 40);

test('werteArray hat immer 36 Plaetze und fuellt Luecken mit null', () => {
  const m = polarModell({ records: [rec(0, 10), rec(5, 20)], hour_max: { '5': 7 } });
  const w = werteArray(m.sektoren, 'stundeNm');
  assert.equal(w.length, 36);
  assert.equal(w[5], 7);
  assert.equal(w[0], null);
  assert.equal(w[17], null);
});

test('ein vollstaendiger Kranz ergibt genau EINEN geschlossenen Pfad', () => {
  const p = treppenPfade(voll, 80);
  assert.equal(p.length, 1);
  assert.ok(p[0].endsWith(' Z'), `Pfad muss geschlossen sein: ${p[0].slice(-20)}`);
});

test('eine Luecke reisst den Zug auf -- offene Pfade, kein Wert 0', () => {
  // Die tragende Regel dieser Seite. Ein Polygon, das im Zentrum
  // durchhaengt, behauptet "0 NM gemessen".
  //
  // EINE Luecke ergibt EINEN Lauf, keine zwei: Der Zug laeuft ueber Nord
  // hinweg weiter und endet erst wieder am Loch. Er ist dann aber offen.
  const w = voll.slice();
  w[10] = null;
  const p = treppenPfade(w, 80);
  assert.equal(p.length, 1);
  assert.ok(!p[0].endsWith(' Z'), 'ein aufgerissener Zug darf nicht geschlossen sein');

  // Erst ZWEI Luecken ergeben zwei Laeufe.
  const w2 = voll.slice();
  w2[10] = null; w2[20] = null;
  const p2 = treppenPfade(w2, 80);
  assert.equal(p2.length, 2);
  assert.ok(p2.every(d => !d.endsWith(' Z')));
});

test('ohne jeden Wert entsteht kein Pfad, kein Punkt im Zentrum', () => {
  assert.deepEqual(treppenPfade(Array.from({ length: 36 }, () => null), 80), []);
});

test('ein Wert auf der Skalenstufe liegt auf dem Aussenring', () => {
  // Die Gegenprobe, deren Antwort vorher feststeht: Sektor 0 beginnt bei
  // Peilung 000, also senkrecht ueber der Mitte. Bei Skala 80 und Wert 80
  // muss die erste Ecke genau MITTE - R_PX sein.
  const w = Array.from({ length: 36 }, () => null);
  w[0] = 80;
  const d = treppenPfade(w, 80)[0];
  assert.ok(d.startsWith(`M${MITTE.toFixed(1)},${(MITTE - R_PX).toFixed(1)}`),
    `Anfang war ${d.slice(0, 24)}`);
});

test('der Keil beginnt in der Mitte und schliesst sich', () => {
  const d = keilPfad(40, 0, 80);
  assert.ok(d.startsWith(`M${MITTE.toFixed(1)},${MITTE.toFixed(1)}`));
  assert.ok(d.endsWith(' Z'));
  // Halbe Skala = halber Radius.
  assert.ok(d.includes((MITTE - R_PX / 2).toFixed(1)));
});

test('keine Peilungsmarke laeuft ueber die Bildkante oder in den Aussenring', () => {
  // Der Test, den es beim ersten Mal nicht gab: Die 090-Marke lief 6 px
  // ueber die rechte Kante und wurde abgeschnitten, gefunden erst am
  // gerenderten Bild. Hier faellt es ohne Browser auf -- und es faellt
  // auch dann auf, wenn jemand spaeter BILD.rand verkleinert.
  const ringL = BILD.rand, ringR = BILD.groesse - BILD.rand;
  for (const grad of [0, 90, 180, 270]) {
    const k = markenKasten(grad);
    assert.ok(k.links >= 0 && k.rechts <= BILD.groesse,
      `${grad}: waagerecht ${k.links}..${k.rechts} passt nicht in 0..${BILD.groesse}`);
    assert.ok(k.oben >= 0 && k.unten <= BILD.groesse,
      `${grad}: senkrecht ${k.oben}..${k.unten} passt nicht in 0..${BILD.groesse}`);
    // Ausserhalb des Aussenrings: eine Marke IM Bild waere keine Randmarke.
    const draussen = k.rechts <= ringL || k.links >= ringR
                  || k.unten <= ringL || k.oben >= ringR;
    assert.ok(draussen, `${grad}: Marke ueberlappt den Aussenring`);
  }
  assert.equal(markenPlatz(45), null);
});

test('datumKurz macht aus dem ISO-Stempel Tag und Uhrzeit', () => {
  // Die Konsole zeigt Ortszeit des Geraets -- Browser und Daemon sitzen
  // auf demselben Host, es gibt keinen Uhrenversatz zu ueberbruecken.
  // Der Test prueft deshalb gegen Ortszeit. Die erste Zusicherung macht
  // die Annahme sichtbar: Auf einer Maschine in einer anderen Zone waere
  // die zweite Zeile zu Recht rot, und ohne diese Zeile saehe das nach
  // einem Fehler in datumKurz aus.
  assert.equal(new Date('2026-07-27T18:21:58+02:00').getTimezoneOffset(), -120,
    'Dieser Test setzt Europe/Berlin in der Sommerzeit voraus');
  assert.equal(datumKurz('2026-07-27T18:21:58+02:00'), '27.07. 18:21');
});

test('datumKurz gibt bei fehlendem oder unlesbarem Stempel einen Gedankenstrich', () => {
  assert.equal(datumKurz(null), '—');
  assert.equal(datumKurz('gestern'), '—');
});

test('zahlNm macht aus jedem unbrauchbaren Wert einen Gedankenstrich, nie eine Zahl', () => {
  assert.equal(zahlNm(79.37), '79.4');
  assert.equal(zahlNm(0), '0.0');          // eine gemessene Null IST eine Aussage
  assert.equal(zahlNm(null), '—');
  assert.equal(zahlNm(undefined), '—');
  assert.equal(zahlNm(NaN), '—');          // der Fall, den die erste Fassung durchliess
  assert.equal(zahlNm(Infinity), '—');
  assert.equal(zahlNm('22.6'), '—');       // eine Zeichenkette ist keine Messung
});

test('das Radialgitter hat 36 Grenzen, davon zwoelf grosse', () => {
  const r = radialen(80, [10, 25, 50]);
  assert.equal(r.length, 36);
  assert.equal(r.filter(x => x.gross).length, 12);
  assert.deepEqual(r.filter(x => x.gross).map(x => x.grad),
    [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
});

test('die grossen beginnen am innersten Ring, die kleinen erst am zweiten', () => {
  // Der Kern der Entscheidung am Panel: innerhalb von 10 NM bleibt es frei,
  // und die 24 kleinen setzen noch spaeter ein, damit die Mitte ruhig bleibt.
  // Geprueft wird gegen den WINKEL, nicht gegen das eigene gross-Flag: Die
  // erste Fassung schrieb `x.gross ? 10 : 25` und hielt damit die
  // Implementierung gegen sich selbst. Bei einem falschen Teiler (20 statt
  // 30) blieb sie gruen, weil vonNm und gross demselben Irrtum folgten.
  const r = radialen(80, [10, 25, 50]);
  for (const x of r) {
    assert.equal(x.vonNm, x.grad % 30 === 0 ? 10 : 25, `${x.grad}° beginnt falsch`);
    assert.equal(x.bisNm, 80);
  }
});

test('Ringe jenseits der Skala zaehlen nicht als Startradius', () => {
  // Sonst begaenne ein Radial ausserhalb des Bildes und waere unsichtbar.
  const r = radialen(20, [10, 25, 50]);
  assert.equal(r.length, 36);
  for (const x of r) assert.equal(x.vonNm, 10);   // 25 und 50 fallen raus
});

test('ohne brauchbaren Ring gibt es kein Gitter statt eines Sterns', () => {
  assert.deepEqual(radialen(80, []), []);
  assert.deepEqual(radialen(80, null), []);
  assert.deepEqual(radialen(80, [200]), []);
});
