import { haversineNm, isEmergency, nmToPx } from '../geo.js';
import { registerPage } from '../console.js';
import { leerUntertitel } from './gemeinsam.js';

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

// Masse des Seitenrisses. `rand` haelt die Zeichenflaeche um einen
// Punktradius von der Kante weg: Ohne ihn liegt ein Ziel auf FL000 bei
// cy = hoehe, und sein Kreis ragt zur Haelfte aus dem Bild. In einer
// Messstunde am Geraet waren 244 von 1724 Positionen auf FL000 -- darunter
// der Haufen bei 5 bis 10 NM, also genau der Flughafenkegel, dessentwegen
// diese Seite ein Seitenriss ist.
export const BILD = Object.freeze({ breite: 700, hoehe: 560, rand: 8, punkt: 5 });

// Entfernung und Hoehe auf Bildkoordinaten. Rein und exportiert, damit die
// Abbildung ohne Browser pruefbar ist -- als sie in der Render-Closure
// steckte, fiel niemandem auf, dass FL000 halb aus dem Bild ragt.
export function punktX(nm, rangeNm) {
  return BILD.rand + nmToPx(nm, rangeNm, BILD.breite - 2 * BILD.rand);
}

export function punktY(altFt) {
  return BILD.rand + (1 - altFt / FL_MAX) * (BILD.hoehe - 2 * BILD.rand);
}

registerPage({
  id: 'profile',
  title: 'Höhenprofil',
  ageSource: 'aircraft',
  mount(el) {
    el.innerHTML = `
      <div class="profil-bild">
        <svg class="profil-svg" viewBox="0 0 ${BILD.breite} ${BILD.hoehe}"
             preserveAspectRatio="none" aria-hidden="true"></svg>
      </div>
      <div class="profil-spalte value"></div>`;
  },
  render(el, cfg, state) {
    const r = hoehenprofil(state.aircraft, state.receiver,
                           cfg.radar.range_nm, cfg.emergency.highlight);
    const svg = el.querySelector('.profil-svg');
    const spalte = el.querySelector('.profil-spalte');

    // Gitter: waagerecht alle FL100, senkrecht auf den Radarringen.
    const teile = [];
    for (let ft = 10000; ft < FL_MAX; ft += 10000) {
      const y = punktY(ft);
      teile.push(`<line class="g-h" x1="0" y1="${y}" x2="${BILD.breite}" y2="${y}"/>`);
      teile.push(`<text class="g-t" x="4" y="${y - 5}">FL${ft / 100}</text>`);
    }
    for (const ring of cfg.radar.rings_nm) {
      if (ring > cfg.radar.range_nm) continue;
      const x = punktX(ring, cfg.radar.range_nm);
      teile.push(`<line class="g-v" x1="${x}" y1="0" x2="${x}" y2="${BILD.hoehe}"/>`);
      teile.push(`<text class="g-t" x="${x + 5}" y="${BILD.hoehe - 6}">${ring} NM</text>`);
    }
    for (const p of r.punkte) {
      const x = punktX(p.nm, cfg.radar.range_nm);
      const y = punktY(p.altFt);
      const klassen = 'p' + (p.emergency ? ' emg' : '') + (p.geklemmt ? ' klemm' : '');
      teile.push(`<circle class="${klassen}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${BILD.punkt}"/>`);
      // Ein geklemmtes Ziel bekommt einen Aufwaertspfeil: Der Punkt sagt
      // sonst "genau FL450", und das waere eine Behauptung statt einer Marke.
      if (p.geklemmt) {
        teile.push(`<path class="klemm-pfeil" d="M${(x - 5).toFixed(1)} ${(y + 8).toFixed(1)}
                    L${x.toFixed(1)} ${(y + 1).toFixed(1)} L${(x + 5).toFixed(1)} ${(y + 8).toFixed(1)}"/>`);
      }
    }
    svg.innerHTML = teile.join('');

    if (!r.punkte.length && !r.ohnePosition && !r.ausserhalb) {
      spalte.innerHTML = `<div class="tile ctr" style="flex:1">
        <div class="empty">KEINE ZIELE MIT HÖHE
          <div class="empty-sub">${leerUntertitel(state)}</div></div></div>`;
      return;
    }
    const groesstes = Math.max(1, ...r.baender.map(b => b.anzahl));
    spalte.innerHTML = `
      <div class="tile" style="flex:1">
        <div class="lbl">Ziele je Flugflächenband</div>
        ${r.baender.slice().reverse().map(b => `
          <div class="band">
            <span class="band-lbl">${b.label}</span>
            <span class="band-bar"><i style="width:${(b.anzahl / groesstes * 100).toFixed(0)}%"></i></span>
            <span class="band-n">${b.anzahl}</span>
          </div>`).join('')}
      </div>
      <div class="tile">
        <div class="lbl">Nicht im Bild</div>
        <div class="db-zeile"><span class="db-label">mit Höhe, ohne Position</span>
          <span class="db-wert">${r.ohnePosition}</span></div>
        <div class="db-zeile"><span class="db-label">außerhalb ${cfg.radar.range_nm} NM</span>
          <span class="db-wert">${r.ausserhalb}</span></div>
      </div>`;
  },
});
