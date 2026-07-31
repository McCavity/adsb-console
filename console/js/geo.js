// Reine Rechenfunktionen. Kein DOM, kein Zustand, keine Uhr.
// Die einzige Schicht, in der ein Rechenfehler unbemerkt bliebe -- daher getestet.

const R_NM = 3440.065;          // mittlerer Erdradius in Seemeilen
const RAD = Math.PI / 180;

export function haversineNm(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD;
  const dp = (lat2 - lat1) * RAD, dl = (lon2 - lon1) * RAD;
  const a = Math.sin(dp / 2) ** 2 +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearingDeg(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// Norden liest sich als "drei-sechs-null", nicht als "null-null-null" --
// dieselbe Konvention wie in der Seefahrt und im Sprechfunk.
export function formatBearing(deg) {
  if (deg == null || !Number.isFinite(deg)) return '—';
  let d = Math.round(deg) % 360;
  if (d === 0) d = 360;
  return String(d).padStart(3, '0') + '°';
}

export function flightLevel(altFt) {
  if (typeof altFt !== 'number' || !Number.isFinite(altFt)) return '—';
  return 'FL' + String(Math.round(altFt / 100)).padStart(3, '0');
}

// dump1090 fuellt das Callsign-Feld auf acht Zeichen mit Leerzeichen auf.
export function formatCallsign(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export function sectorOf(deg, count = 36) {
  const width = 360 / count;
  return Math.floor((((deg % 360) + 360) % 360) / width);
}

const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

// Achtung: emergency ist bei normalen Zielen vorhanden -- mit den Werten
// null oder "none". Nur ein Wert ausserhalb davon ist eine Aussage.
export function isEmergency(ac) {
  if (!ac) return false;
  if (EMERGENCY_SQUAWKS.has(ac.squawk)) return true;
  const e = ac.emergency;
  return typeof e === 'string' && e !== 'none';
}

export function nmToPx(nm, rangeNm, radiusPx) {
  return nm / rangeNm * radiusPx;
}

// Polarkoordinaten auf Bildkoordinaten, relativ zum Mittelpunkt.
// Norden ist oben (negatives y), Osten rechts.
//
// Lag bis zum 29.07.2026 in pages/radar.js. Sie ist eine reine
// Geometriefunktion ohne DOM und ohne Zustand und gehoert damit hierher --
// und vor allem: Die Polarseite braucht dieselbe Abbildung. Eine zweite
// Fassung waere der Anfang davon, dass zwei Teile derselben Konsole
// dieselbe Eingabe verschieden deuten.
export function projectToCanvas(nm, brg, rangeNm, radiusPx) {
  const r = nm / rangeNm * radiusPx;
  const a = brg * Math.PI / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}

// Welches Ziel steht auf der Einzelziel-Seite? Anders als der Datenblock
// neben dem Radarschirm haelt diese Seite ihr Ziel fest, solange sie steht:
// Zwei Ziele bei 12,3 und 12,4 NM wuerden sonst im Sekundentakt tauschen,
// und ein Datenblatt, dessen Gegenstand springt, ist unlesbar.
//
// Zurueckgegeben wird IMMER ein Element aus kandidaten, niemals bisher
// selbst -- sonst zeigte die Seite eingefrorene WERTE statt eines
// eingefrorenen ZIELS.
//
// Der Rueckweg ist absichtlich asymmetrisch: Verschwindet der
// Notfall-Squawk wieder, springt die Seite nicht zurueck. Das Ziel steht
// dann noch in kandidaten, also greift Regel 2.
export function waehleDatenblattZiel(kandidaten, bisher) {
  const liste = Array.isArray(kandidaten)
    ? kandidaten.filter(t => t && typeof t.nm === 'number' && Number.isFinite(t.nm))
    : [];
  if (!liste.length) return null;
  const naechster = menge => menge.reduce((a, b) => (b.nm < a.nm ? b : a));
  const notfaelle = liste.filter(t => t.emergency);
  if (notfaelle.length) return naechster(notfaelle);
  if (bisher && bisher.hex) {
    const weiterhin = liste.find(t => t.hex === bisher.hex);
    if (weiterhin) return weiterhin;
  }
  return naechster(liste);
}

// Welche Ringe passen in diese Reichweite? Bis zum 31.07.2026 zeichnete
// drawBackground() ALLE rings_nm ohne Filter -- unsichtbar, solange
// [10, 25, 50] zufaellig zu range_nm 50 passte. Mit umschaltbarer
// Reichweite tritt die Bedingung erstmals ein: bei 10 NM laegen zwei von
// drei Ringen ausserhalb des Kreises.
//
// profile.js hatte die Regel bereits richtig, radar.js nicht. Sie steht
// deshalb ab jetzt genau einmal hier.
//
// Der Ring GENAU AUF der Reichweite bleibt: Er ist der Aussenring, nicht
// ein Ueberstand.
export function sichtbareRinge(ringe, rangeNm) {
  if (!Array.isArray(ringe)) return [];
  return ringe
    .filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= rangeNm)
    .sort((a, b) => a - b);
}

// Dieselbe Regel, nur fuer Ziele: Was jenseits der eingestellten Reichweite
// liegt, gehoert auf keine Seite dieser Konsole. Bis zum 31.07.2026 hielt
// sich allein das Radar daran -- bei Reichweite 10 und einem Ziel bei 22 NM
// meldete es "KEINE ZIELE IN REICHWEITE", waehrend die Einzelziel-Seite ein
// volles Datenblatt fuer genau dieses Ziel zeigte und die Tafel zwoelf
// Stueck bis ueber 100 NM listete. Drei Seiten desselben Geraets, drei
// Antworten auf dieselbe Frage.
//
// Wie beim Aussenring gehoert das Ziel GENAU auf der Reichweite dazu.
//
// Keine brauchbare Reichweite heisst "keine Begrenzung", niemals "nichts
// durchlassen": Ein leerer Schirm waere von einem Defekt nicht zu
// unterscheiden. Ein Eintrag ohne brauchbare Entfernung faellt dagegen
// heraus, sobald gefiltert wird -- er laesst sich gegen keine Reichweite
// pruefen, und "unbekannt" ist kein Beleg fuer "nah".
export function inReichweite(liste, rangeNm) {
  if (!Array.isArray(liste)) return [];
  if (typeof rangeNm !== 'number' || !Number.isFinite(rangeNm) || rangeNm <= 0) {
    return liste.slice();
  }
  return liste.filter(t => t && typeof t.nm === 'number' && Number.isFinite(t.nm)
                           && t.nm <= rangeNm);
}
