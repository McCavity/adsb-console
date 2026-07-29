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
