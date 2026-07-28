import { haversineNm, isEmergency } from '../geo.js';

// Die sechs Baender aus Spec 6.6, in Fuss. Die obere Kante ist Infinity --
// "ueber FL400" hat keine Obergrenze, und ein Ziel oberhalb einer
// gedachten Grenze verschwinden zu lassen waere derselbe Fehler wie ein
// Punkt, der aus dem Bild faellt. Die untere Kante ist -Infinity: alt_baro
// kann bei niedrigem Luftdruck knapp negativ werden, und ein Ziel mit
// -100 ft ist buchstaeblich "unter FL050". Ohne diese Kante bekaeme es einen
// Punkt im Seitenriss, faende aber kein Band -- Bild und Zahlenspalte
// widersprechen sich dann.
export const BAENDER = Object.freeze([
  { von: -Infinity, bis: 5000,     label: 'unter FL050' },
  { von: 5000,      bis: 10000,    label: 'FL050–FL100' },
  { von: 10000,     bis: 20000,    label: 'FL100–FL200' },
  { von: 20000,     bis: 30000,    label: 'FL200–FL300' },
  { von: 30000,     bis: 40000,    label: 'FL300–FL400' },
  { von: 40000,     bis: Infinity, label: 'über FL400' },
]);
BAENDER.forEach(Object.freeze);

// Obere Kante des Seitenrisses in Fuss. Das gemessene Stundenmaximum lag
// bei FL409; FL450 gibt Luft, ohne das Bild leer aussehen zu lassen.
export const FL_MAX = 45000;

// alt_baro traegt bei Zielen am Boden den String "ground". Der Daemon
// behandelt ihn als KEINE Hoehe (test_alt_baro_ground_ist_keine_hoehe);
// diese Seite haelt sich daran, damit nicht zwei Teile derselben Konsole
// dieselbe Eingabe verschieden deuten.
function hoeheFt(a) {
  const v = a && a.alt_baro;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function hoehenprofil(aircraft, receiver, rangeNm, highlight) {
  const punkte = [];
  const baender = BAENDER.map(b => ({ label: b.label, anzahl: 0 }));
  let ohnePosition = 0, ausserhalb = 0;
  for (const a of aircraft || []) {
    const alt = hoeheFt(a);
    if (alt === null) continue;
    const i = BAENDER.findIndex(b => alt >= b.von && alt < b.bis);
    if (i >= 0) baender[i].anzahl += 1;
    const hatPosition = receiver &&
      typeof a.lat === 'number' && typeof a.lon === 'number';
    if (!hatPosition) { ohnePosition += 1; continue; }
    const nm = haversineNm(receiver.lat, receiver.lon, a.lat, a.lon);
    if (nm > rangeNm) { ausserhalb += 1; continue; }
    punkte.push({
      hex: a.hex,
      nm,
      altFt: Math.min(alt, FL_MAX),
      geklemmt: alt > FL_MAX,
      emergency: !!highlight && isEmergency(a),
    });
  }
  return { punkte, baender, ohnePosition, ausserhalb };
}
