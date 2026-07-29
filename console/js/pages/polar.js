// Polar -- Reichweite. Zwei Spuren je Sektor: der Allzeit-Rekord aus
// SQLite und das Maximum der letzten Stunde, beide aus range.json.
//
// Was rechnet, steht hier oben und ist exportiert; was zeichnet, steht
// unten in registerPage. Die Trennung ist die Lehre aus Stufe 1: Von
// vierzehn Befunden kam kein einziger von der Testsuite, solange die
// Rechnung in der Render-Closure steckte.

import { projectToCanvas, flightLevel } from '../geo.js';
import { registerPage } from '../console.js';
import { leerUntertitel } from './gemeinsam.js';

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

  return { sektoren, groesster, skalaNm: skalaNm(spitze), richtungen: richtungen(sektoren) };
}

// Zwoelf Kaesten zu 30 Grad, je GENAU drei Sektoren.
//
// 45 Grad teilt 36 Zehn-Grad-Sektoren nicht -- acht Richtungen ergaeben
// abwechselnd vier und fuenf Sektoren, und eine Gruppe aus fuenf Sektoren
// hat mehr Gelegenheiten, ein hohes Maximum zu tragen. Die Balken waeren
// untereinander nicht vergleichbar.
//
// Dreiergruppen ab 0 Grad teilen exakt. Ihre Grenzen liegen dann aber auf
// 0/30/60/90..., und genau dort liegen N, O, S und W: Die vier
// Kardinalrichtungen werden zu Grenzen statt zu Namen. Eine auf Nord
// zentrierte Gruppe muesste von 345 bis 015 Grad laufen, und 345 ist keine
// Sektorgrenze -- das folgt aus dem 10-Grad-Raster des Daemons und ist
// nicht waehlbar.
//
// Die Namen sind die zwoelf verbleibenden Striche des 16-Strich-Kompasses.
// Vier treffen die Kastenmitte punktgenau (NO 45, SO 135, SW 225, NW 315),
// die anderen acht liegen 7,5 Grad daneben. Deshalb traegt die Anzeige
// IMMER auch den Gradbereich: Der Name ist die Merkhilfe, der Bereich ist
// die Tatsache.
export const RICHTUNGEN = Object.freeze([
  'NNO', 'NO', 'ONO', 'OSO', 'SO', 'SSO',
  'SSW', 'SW', 'WSW', 'WNW', 'NW', 'NNW',
]);
export const SEKTOREN_JE_RICHTUNG = SEKTOREN / RICHTUNGEN.length;   // 3

export function richtungen(sektoren) {
  const nach = new Map((sektoren || []).map(s => [s.sektor, s]));
  return RICHTUNGEN.map((name, i) => {
    const gruppe = [];
    for (let k = 0; k < SEKTOREN_JE_RICHTUNG; k++) {
      const s = nach.get(i * SEKTOREN_JE_RICHTUNG + k);
      if (s) gruppe.push(s);
    }
    const grad = i * (360 / RICHTUNGEN.length);
    const bester = gruppe.length
      ? gruppe.reduce((a, b) => (b.rekordNm > a.rekordNm ? b : a)) : null;
    const stunden = gruppe.map(s => s.stundeNm).filter(v => v !== null);
    return {
      name,
      bereich: `${grad3(grad)}–${grad3(grad + 29)}°`,
      sektoren: gruppe.map(s => s.sektor),
      rekordNm: bester ? bester.rekordNm : null,
      // Keine Stunde in allen drei Sektoren heisst null, nicht 0.
      stundeNm: stunden.length ? Math.max(...stunden) : null,
      halter: bester ? bester.halter : '—',
      altFt: bester ? bester.altFt : null,
    };
  });
}

// Liest keine Uhr -- der Zeitpunkt kommt herein. Sonst waere die Funktion
// nicht testbar; dieselbe Regel wie bei letzteZielzeit in data.js.
export function zuletztGefallen(records, nowMs) {
  const liste = Array.isArray(records) ? records : [];
  let bester = null, besteMs = -Infinity;
  for (const r of liste) {
    const ms = Date.parse(r && r.seen_at);
    if (!Number.isFinite(ms) || ms <= besteMs) continue;
    besteMs = ms; bester = r;
  }
  if (!bester) return null;
  return {
    sektor: bester.sector,
    bereich: sektorBereich(bester.sector),
    nm: bester.max_nm,
    halter: halterName(bester),
    alterMin: Math.max(0, Math.round((nowMs - besteMs) / 60000)),
  };
}

// 620 ist die Buehnenhoehe: 720 minus 56 Kopfzeile minus 44 Punktreihe.
// Der Rand haelt die Beschriftung des Aussenrings im Bild.
export const BILD = Object.freeze({ groesse: 620, rand: 26 });
export const R_PX = (BILD.groesse - 2 * BILD.rand) / 2;   // 284
export const MITTE = BILD.groesse / 2;                    // 310

const GRAD_JE_SEKTOR = 360 / SEKTOREN;                    // 10
const fix = n => n.toFixed(1);
const radiusPxVon = (nm, skala, radiusPx) => nm / skala * radiusPx;

// Punkt auf dem Bild. projectToCanvas rechnet relativ zum Mittelpunkt
// (geo.js) -- hier kommt die Verschiebung dazu.
function punkt(nm, grad, skala, radiusPx) {
  const p = projectToCanvas(nm, grad, skala, radiusPx);
  return { x: MITTE + p.x, y: MITTE + p.y };
}

// Die 36 Plaetze, mit null wo kein Sektor vorliegt. Der Index IST die
// Sektornummer -- ein dicht gepacktes Array waere gegen die Peilung
// verschoben, sobald ein Sektor fehlt.
export function werteArray(sektoren, feld) {
  const out = Array.from({ length: SEKTOREN }, () => null);
  for (const s of sektoren || []) {
    const v = s[feld];
    if (typeof v === 'number' && Number.isFinite(v)) out[s.sektor] = v;
  }
  return out;
}

// Ein Keil ueber die vollen zehn Grad eines Sektors, von der Mitte aus.
// Die Flaeche wird aus 36 solchen Keilen gebaut und nicht aus einem
// gefuellten Ringpolygon: Dann braucht ein fehlender Sektor keine
// Sonderbehandlung -- er hat schlicht keinen Keil.
export function keilPfad(nm, sektor, skala, radiusPx = R_PX) {
  const r = radiusPxVon(nm, skala, radiusPx);
  const a = punkt(nm, sektor * GRAD_JE_SEKTOR, skala, radiusPx);
  const b = punkt(nm, (sektor + 1) * GRAD_JE_SEKTOR, skala, radiusPx);
  return `M${fix(MITTE)},${fix(MITTE)} L${fix(a.x)},${fix(a.y)} `
       + `A${fix(r)},${fix(r)} 0 0 1 ${fix(b.x)},${fix(b.y)} Z`;
}

function laufPfad(werte, von, laenge, skala, radiusPx, geschlossen) {
  const teile = [];
  for (let k = 0; k < laenge; k++) {
    const s = (von + k) % SEKTOREN;
    const nm = werte[s];
    const r = radiusPxVon(nm, skala, radiusPx);
    const a = punkt(nm, s * GRAD_JE_SEKTOR, skala, radiusPx);
    const b = punkt(nm, (s + 1) * GRAD_JE_SEKTOR, skala, radiusPx);
    teile.push(`${k === 0 ? 'M' : 'L'}${fix(a.x)},${fix(a.y)}`);
    // Der Bogen, nicht die Sehne: Ein Sektormaximum gilt fuer seine vollen
    // zehn Grad. Bei R_PX = 284 betruege der Sehnenfehler rund 1 px, und
    // die Zusage "konstanter Radius je Sektor" waere nur fast wahr.
    // sweep = 1, weil wachsende Peilung auf dem Bild im Uhrzeigersinn
    // laeuft (y zeigt nach unten).
    teile.push(`A${fix(r)},${fix(r)} 0 0 1 ${fix(b.x)},${fix(b.y)}`);
  }
  return teile.join(' ') + (geschlossen ? ' Z' : '');
}

// Der Treppenzug ueber die belegten Sektoren: zwei Ecken je Sektor und ein
// radialer Sprung dazwischen. KEINE Linie durch die Sektormitten -- die
// behauptete eine stetige Funktion der Peilung, die die Daten nicht
// hergeben.
//
// Luecken reissen den Zug auf: Sie ergeben MEHRERE Pfade, nie einen Wert
// 0. Nachts ist das der Regelfall.
export function treppenPfade(werte, skala, radiusPx = R_PX) {
  const da = werte.map(v => typeof v === 'number' && Number.isFinite(v));
  if (da.every(Boolean)) {
    return [laufPfad(werte, 0, SEKTOREN, skala, radiusPx, true)];
  }
  const pfade = [];
  // Am ersten Loch beginnen, sonst zerschneidet der Index 0 einen Lauf,
  // der ueber Nord hinweggeht.
  const start = da.indexOf(false);
  let i = 0;
  while (i < SEKTOREN) {
    if (!da[(start + i) % SEKTOREN]) { i++; continue; }
    let laenge = 0;
    while (i + laenge < SEKTOREN && da[(start + i + laenge) % SEKTOREN]) laenge++;
    pfade.push(laufPfad(werte, start + i, laenge, skala, radiusPx, false));
    i += laenge;
  }
  return pfade;
}
