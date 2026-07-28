import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel,
         isEmergency, waehleDatenblattZiel } from '../geo.js';
import { registerPage } from '../console.js';
import { msgRate } from './gemeinsam.js';

// Die Seite braucht den ROHEN aircraft.json-Eintrag, nicht nur das
// angereicherte Ziel: ias, tas, mach, roll, nav_altitude_mcp und die
// Guetefelder kommen dort und nur dort her. Deshalb reist a als `roh` mit.
export function kandidatenAusZielen(aircraft, receiver, highlight) {
  if (!receiver) return [];
  const liste = [];
  for (const a of aircraft || []) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
    liste.push({
      hex: a.hex,
      callsign: formatCallsign(a.flight),
      nm: haversineNm(receiver.lat, receiver.lon, a.lat, a.lon),
      brg: bearingDeg(receiver.lat, receiver.lon, a.lat, a.lon),
      emergency: !!highlight && isEmergency(a),
      roh: a,
    });
  }
  return liste;
}

// Zahl oder Gedankenstrich -- niemals eine 0 fuer einen fehlenden Wert.
// Eine 0 meldet einen gemessenen Zustand ("Steigrate null" heisst
// Reiseflug), ein fehlender Wert meldet gar nichts.
const z = (v, stellen = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(stellen) : '—';

export function datenblattFelder(t) {
  const a = t.roh;
  return {
    kopf: {
      name: t.callsign || t.hex,
      istHex: !t.callsign,
      heavy: a.category === 'A5',
      squawk: a.squawk || null,
      emergency: t.emergency,
    },
    gruppen: [
      { titel: 'Geschwindigkeit', zeilen: [
        ['GS',   z(a.gs),   'kt'],
        ['IAS',  z(a.ias),  'kt'],
        ['TAS',  z(a.tas),  'kt'],
        ['Mach', z(a.mach, 3), ''],
      ]},
      { titel: 'Höhe', zeilen: [
        ['Baro',           flightLevel(a.alt_baro), ''],
        ['Geometrisch',    z(a.alt_geom), 'ft'],
        ['Zielflugfläche', flightLevel(a.nav_altitude_mcp), ''],
        ['Baro-Rate',      z(a.baro_rate), 'ft/min'],
        ['Geom-Rate',      z(a.geom_rate), 'ft/min'],
      ]},
      // KEINE Differenz aus track und mag_heading. Sie liegt nahe und waere
      // falsch: track ist rechtweisend, mag_heading missweisend -- die
      // Differenz enthaelt die Missweisung mit und ist kein Windversatz.
      // Ein Etikett, das eine andere Frage nennt als die beantwortete.
      { titel: 'Lage', zeilen: [
        ['Track',            formatBearing(a.track), ''],
        ['Steuerkurs (mag)', formatBearing(a.mag_heading), ''],
        ['Querneigung',      z(a.roll, 1), '°'],
        ['Kursänderung',     z(a.track_rate, 1), '°/s'],
      ]},
      { titel: 'Ort', zeilen: [
        ['Entfernung', t.nm.toFixed(1), 'NM'],
        ['Peilung',    formatBearing(t.brg), ''],
        ['QNH',        z(a.nav_qnh, 1), 'hPa'],
      ]},
      { titel: 'Empfang', zeilen: [
        ['RSSI',        z(a.rssi, 1), 'dBFS'],
        ['Nachrichten', z(a.messages), ''],
        ['zuletzt',     z(a.seen, 1), 's'],
      ]},
      { titel: 'Positionsgüte', zeilen: [
        ['NIC',  z(a.nic),   ''],
        ['Rc',   z(a.rc),    'm'],
        ['NACp', z(a.nac_p), ''],
        ['SIL',  z(a.sil),   ''],
      ]},
    ],
  };
}

registerPage({
  id: 'target',
  title: 'Einzelziel',
  ageSource: 'aircraft',
  mount(el) {
    el.innerHTML = '<div class="datenblatt value"></div>';
    el._ctx = { gewaehlt: null };
  },
  // Beim Betreten wird die Auswahl geloescht, damit die Seite bei jedem
  // Besuch frisch das naechste Ziel greift -- und es dann fuer die ganze
  // Standzeit haelt.
  onEnter(el) { el._ctx.gewaehlt = null; },
  render(el, cfg, state) {
    const root = el.querySelector('.datenblatt');
    const kandidaten =
      kandidatenAusZielen(state.aircraft, state.receiver, cfg.emergency.highlight);
    const gewaehlt = waehleDatenblattZiel(kandidaten, el._ctx.gewaehlt);
    el._ctx.gewaehlt = gewaehlt;
    if (!gewaehlt) {
      // Nachts ist das der Normalfall, kein Defekt. Die Nachrichtenrate
      // bleibt stehen: Sie unterscheidet "nichts fliegt" von "Empfaenger tot".
      root.innerHTML = `<div class="empty">KEIN ZIEL MIT POSITION
        <div class="empty-sub">Nachrichtenrate ${msgRate(state)} /s</div></div>`;
      return;
    }
    const { kopf, gruppen } = datenblattFelder(gewaehlt);
    root.innerHTML = `
      <div class="tile db-kopf${kopf.emergency ? ' emg' : ''}">
        <div class="lbl">${kopf.emergency
          ? 'NOTFALL' + (kopf.squawk ? ' · Squawk ' + kopf.squawk : '')
          : 'Datenblatt'}</div>
        <div class="huge ${kopf.emergency ? 'red' : 'em'}${kopf.istHex ? ' db-hex' : ''}">
          ${kopf.name}${kopf.heavy ? '<span class="hv"> HEAVY</span>' : ''}</div>
        ${kopf.squawk && !kopf.emergency
          ? `<div class="sub-d">Squawk ${kopf.squawk}</div>` : ''}
      </div>
      <div class="db-grid">
        ${gruppen.map(g => `
          <div class="tile">
            <div class="lbl">${g.titel}</div>
            ${g.zeilen.map(([label, wert, einheit]) => `
              <div class="db-zeile">
                <span class="db-label">${label}</span>
                <span class="db-wert">${wert}<span class="unit-s">${einheit}</span></span>
              </div>`).join('')}
          </div>`).join('')}
      </div>`;
  },
});
