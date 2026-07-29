// Polar -- Reichweite. Zwei Spuren je Sektor: der Allzeit-Rekord aus
// SQLite und das Maximum der letzten Stunde, beide aus range.json.
//
// Was rechnet, steht hier oben und ist exportiert; was zeichnet, steht
// unten in registerPage. Die Trennung ist die Lehre aus Stufe 1: Von
// vierzehn Befunden kam kein einziger von der Testsuite, solange die
// Rechnung in der Render-Closure steckte.

export const SEKTOREN = 36;
export const SKALA_STUFE = 20;          // NM je Skalenstufe

// Der Radarmassstab traegt diese Seite nicht: Am 29.07.2026 lagen 13 von
// 36 Rekorden jenseits von 50 NM, der groesste bei 79,4 NM. Die Skala
// waechst deshalb in 20-NM-Stufen mit dem Bestand und klemmt nie -- ein
// geklemmter Rekord waere die Klemmung des Hauptgegenstands der Seite.
export function skalaNm(groessterNm) {
  const n = typeof groessterNm === 'number' && Number.isFinite(groessterNm)
    ? groessterNm : 0;
  if (n <= SKALA_STUFE) return SKALA_STUFE;
  return Math.ceil(n / SKALA_STUFE) * SKALA_STUFE;
}

const grad3 = n => String(n).padStart(3, '0');

// "000–009°" -- ein Bereich, keine Peilung. formatBearing() waere hier
// falsch: Sie macht aus der 0 die 360, was fuer eine Peilung richtig ist
// und fuer eine Bereichsuntergrenze nicht.
export function sektorBereich(s) {
  const i = (((s % SEKTOREN) + SEKTOREN) % SEKTOREN) * (360 / SEKTOREN);
  return `${grad3(i)}–${grad3(i + 9)}°`;
}

// dump1090 fuellt das Callsign-Feld mit Leerzeichen auf; der Daemon
// schreibt in dem Fall null. Beides gilt als "keins".
export function halterName(record) {
  const cs = record && typeof record.callsign === 'string'
    ? record.callsign.trim() : '';
  if (cs) return cs;
  const hex = record && typeof record.hex === 'string' ? record.hex.trim() : '';
  return hex || '—';
}

// range.json, wie der Daemon es schreibt (build_range_json):
//   written_at : Zahl
//   sectors    : 36
//   records    : ARRAY  [{sector, max_nm, hex, callsign, alt_ft, seen_at}]
//   hour_max   : OBJEKT {"0": 61.03, "1": 70.24, ...}  -- Schluessel sind
//                ZEICHENKETTEN, und es fehlen die Sektoren ohne Verkehr
//
// Die beiden Nutzlasten haben verschiedene Formen. Wer sie gleich
// behandelt, baut einen Fehler: Am 28.07.2026 lief ein max() ueber die
// Schluessel statt ueber die Werte und warf einen TypeError, der kurz fuer
// einen Datenfehler gehalten wurde.
export function polarModell(range) {
  const roh = range && Array.isArray(range.records) ? range.records : [];
  const hm = range && range.hour_max && typeof range.hour_max === 'object'
    && !Array.isArray(range.hour_max) ? range.hour_max : {};

  const sektoren = [];
  for (const r of roh) {
    const s = r && r.sector;
    if (!Number.isInteger(s) || s < 0 || s >= SEKTOREN) continue;
    if (typeof r.max_nm !== 'number' || !Number.isFinite(r.max_nm)) continue;
    const h = hm[String(s)];
    sektoren.push({
      sektor: s,
      bereich: sektorBereich(s),
      rekordNm: r.max_nm,
      // Fehlt der Sektor in hour_max, floss in der letzten Stunde dort
      // nichts. Das ist null und keine 0: Eine 0 hiesse "gemessen, und
      // zwar null Seemeilen", und die Linie fiele ins Zentrum.
      stundeNm: typeof h === 'number' && Number.isFinite(h) ? h : null,
      halter: halterName(r),
      altFt: typeof r.alt_ft === 'number' && Number.isFinite(r.alt_ft) ? r.alt_ft : null,
      seenAt: typeof r.seen_at === 'string' ? r.seen_at : null,
    });
  }
  sektoren.sort((a, b) => a.sektor - b.sektor);

  const groesster = sektoren.length
    ? sektoren.reduce((a, b) => (b.rekordNm > a.rekordNm ? b : a))
    : null;

  // Die Skala folgt der SPITZE beider Spuren, nicht nur den Rekorden:
  // Nach einem zuruckgesetzten Rekordbestand kann ein Stundenwert daruber
  // liegen, und er soll aus der Flaeche ragen duerfen -- aber nicht aus
  // dem Bild.
  const spitze = sektoren.reduce(
    (m, s) => Math.max(m, s.rekordNm, s.stundeNm === null ? 0 : s.stundeNm), 0);

  return { sektoren, groesster, skalaNm: skalaNm(spitze) };
}
