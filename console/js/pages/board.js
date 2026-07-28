import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel, isEmergency }
  from '../geo.js';
import { registerPage } from '../console.js';
import { msgRate } from './gemeinsam.js';

// highlight kommt aus cfg.emergency.highlight. Der Schalter muss ALLE
// Anzeigen stummschalten, nicht nur das Radar -- sonst schaltet er die
// halbe Konsole. Vorgabewert true, damit ein Aufrufer ohne Konfiguration
// (etwa ein Test) die Markierung sieht.
export function splitTargets(aircraft, receiver, highlight = true) {
  const positioned = [], unpositioned = [];
  for (const a of aircraft || []) {
    const hasPos = receiver &&
      typeof a.lat === 'number' && typeof a.lon === 'number';
    const base = {
      hex: a.hex,
      callsign: formatCallsign(a.flight),
      fl: flightLevel(a.alt_baro),
      gs: typeof a.gs === 'number' ? Math.round(a.gs) : null,
      track: typeof a.track === 'number' ? a.track : null,
      rate: typeof a.baro_rate === 'number' ? a.baro_rate : null,
      heavy: a.category === 'A5',
      emergency: highlight && isEmergency(a),
      squawk: a.squawk || null,
    };
    if (hasPos) {
      positioned.push({ ...base,
        nm: haversineNm(receiver.lat, receiver.lon, a.lat, a.lon),
        brg: bearingDeg(receiver.lat, receiver.lon, a.lat, a.lon) });
    } else {
      unpositioned.push(base);
    }
  }
  positioned.sort((x, y) => x.nm - y.nm);
  return { positioned, unpositioned };
}

function arrow(rate) {
  if (rate == null || Math.abs(rate) < 100) return '→';
  return rate > 0 ? '↑' : '↓';
}

registerPage({
  id: 'board',
  title: 'Ziele',
  ageSource: 'aircraft',
  mount(el) { el.innerHTML = '<div class="board value"></div>'; },
  render(el, cfg, state) {
    const { positioned, unpositioned } =
      splitTargets(state.aircraft, state.receiver, cfg.emergency.highlight);
    const root = el.querySelector('.board');
    if (!positioned.length && !unpositioned.length) {
      // Nachts ist null Ziele der Normalfall, kein Defekt.
      root.innerHTML = `<div class="empty">KEINE ZIELE IN REICHWEITE
        <div class="empty-sub">Nachrichtenrate: ${msgRate(state)} /s</div></div>`;
      return;
    }
    const rows = positioned.slice(0, 12).map(t => `
      <tr class="${t.emergency ? 'emg' : ''}">
        <td>${t.callsign || '——'}${t.heavy ? ' <span class="hv">H</span>' : ''}</td>
        <td>${t.fl}</td>
        <td>${t.gs ?? '—'}</td>
        <td>${formatBearing(t.track)}</td>
        <td>${t.nm.toFixed(1)}</td>
        <td>${formatBearing(t.brg)}</td>
        <td>${arrow(t.rate)}</td>
        <td>${t.emergency ? t.squawk : ''}</td>
      </tr>`).join('');
    root.innerHTML = `
      <table class="tbl">
        <thead><tr><th>CALLSIGN</th><th>FL</th><th>GS</th><th>TRACK</th>
                   <th>ENTF</th><th>PEIL</th><th></th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="nopos">ohne Position: ${unpositioned.length}
        <span class="nopos-list">${unpositioned.slice(0, 10)
          .map(t => `${t.callsign || t.hex} ${t.fl}`).join(' · ')}</span>
      </div>`;
  },
});
