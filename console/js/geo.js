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
