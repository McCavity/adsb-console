import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel,
         isEmergency, inReichweite } from '../geo.js';
import { registerPage } from '../console.js';
import { leerUntertitel } from './gemeinsam.js';

// highlight kommt aus cfg.emergency.highlight. Der Schalter muss ALLE
// Anzeigen stummschalten, nicht nur das Radar -- sonst schaltet er die
// halbe Konsole. Vorgabewert true, damit ein Aufrufer ohne Konfiguration
// (etwa ein Test) die Markierung sieht.
//
// rangeNm ist die eingestellte Reichweite (sicht.range_nm) und begrenzt die
// erste Liste. Der Filter sitzt HIER, nicht in render(): Die Tafel zeigt
// "die zwoelf naechsten", und wer erst abschneidet und dann filtert,
// verlaesst sich darauf, dass die Liste sortiert ist -- eine stille
// Abhaengigkeit, die niemand sieht, wenn die Sortierung einmal faellt.
//
// Ziele OHNE Position bleiben unberuehrt: Sie haben keine Entfernung, und
// eine Reichweite laesst sich nicht gegen etwas pruefen, das es nicht gibt.
// Sie stehen ohnehin in ihrer eigenen Zeile.
export function splitTargets(aircraft, receiver, highlight = true, rangeNm = null) {
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
  return { positioned: inReichweite(positioned, rangeNm), unpositioned };
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
  render(el, cfg, state, sicht) {
    const { positioned, unpositioned } = splitTargets(
      state.aircraft, state.receiver, cfg.emergency.highlight, sicht.range_nm);
    const root = el.querySelector('.board');
    const nopos = `
      <div class="nopos">ohne Position: ${unpositioned.length}
        <span class="nopos-list">${unpositioned.slice(0, 10)
          .map(t => `${t.callsign ? t.callsign : `<span class="hexkennung">${t.hex}</span>`} ${t.fl}`).join(' · ')}</span>
      </div>`;
    // Keine Zeile in Reichweite heisst Leerzustand, nicht Tabellenkopf ohne
    // Inhalt: Eine leere Tabelle sagt nichts -- weder ob nichts fliegt noch
    // ob der Empfaenger steht. Seit die Seite nach Entfernung filtert
    // (31.07.2026), ist das kein Nachtfall mehr, sondern der Normalfall bei
    // Reichweite 10. Die Zeile "ohne Position" bleibt daneben stehen, wenn
    // es solche Ziele gibt: Sie sind empfangen worden, sie zu verschweigen
    // waere derselbe Fehler wie sie zu zaehlen.
    if (!positioned.length) {
      root.innerHTML = `<div class="empty">KEINE ZIELE IN REICHWEITE
        <div class="empty-sub">${leerUntertitel(state)}</div></div>`
        + (unpositioned.length ? nopos : '');
      return;
    }
    const rows = positioned.slice(0, 12).map(t => `
      <tr class="${t.emergency ? 'emg' : ''}">
        <td>${t.callsign ? t.callsign : `<span class="hexkennung">${t.hex}</span>`}${t.heavy ? ' <span class="hv">H</span>' : ''}</td>
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
      </table>${nopos}`;
  },
});
