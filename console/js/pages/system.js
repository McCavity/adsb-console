import { registerPage } from '../console.js';

// samples_dropped steht in stats.json, nicht in system.json: Der Daemon
// liest stats.json ueberhaupt nicht, waehrend das Frontend sie ohnehin
// alle 5 s holt. Zwei Werte, genau wie get_throttled -- "jetzt" und "seit
// Start". Ein Kriterium, das nur kumulativ gilt, verschweigt den Moment;
// eines, das nur den Moment zeigt, verschweigt die Historie.
export function samplesDropped(statsDoc) {
  const lies = fenster => {
    const l = statsDoc && statsDoc[fenster] && statsDoc[fenster].local;
    const v = l ? l.samples_dropped : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  return { jetzt: lies('last1min'), gesamt: lies('total') };
}

// Drei Marken, aber nur zwei Farbschwellen. 60 Grad ist der dokumentierte
// Firmware-Vorgabewert und steht als Strich im Bild -- eine Farbschwelle
// waere er nicht: Das Geraet laeuft im Regelbetrieb bei 66,7 bis 71,5 Grad,
// also dauerhaft darueber. Eine Anzeige, die dabei staendig Alarmfarbe
// zeigt, lehrt das Falsche und wird nach drei Tagen nicht mehr gelesen.
// 72 ist die Abnahmegrenze dieses Projekts, 80 die harte Grenze.
export const MARKEN = Object.freeze({ soft: 60, abnahme: 72, hart: 80 });

export function tempZustand(c) {
  if (typeof c !== 'number' || !Number.isFinite(c)) return 'unbekannt';
  if (c >= MARKEN.hart) return 'hart';
  if (c >= MARKEN.abnahme) return 'grenze';
  return 'normal';
}

// Die Uhr wird uebergeben, nicht gelesen -- sonst waere die Funktion nicht
// testbar. jetztMs in Millisekunden (Date.now()), written_at in Sekunden.
export function daemonAlterS(system, jetztMs) {
  const w = system && system.written_at;
  if (typeof w !== 'number' || !Number.isFinite(w)) return null;
  return Math.max(0, Math.round(jetztMs / 1000 - w));
}

// Eine 0 ist ein gemessener Wert und bleibt eine 0. Nur null und undefined
// werden zum Gedankenstrich.
export function strich(v, stellen = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(stellen) : '—';
}

// Ein fehlendes Flag ist KEINE Entwarnung. Ein null, das als "nein"
// erscheint, behauptet einen gemessenen Zustand, wo nichts gemessen wurde
// -- derselbe Fehler wie "0 MB von 0 MB" auf einem Geraet, dessen /proc
// gar nicht lesbar war. Deshalb drei Zustaende statt zwei.
export function flagZustand(v) {
  if (v == null) return { klasse: 'unbekannt', text: '—' };
  return v ? { klasse: 'an', text: 'JA' } : { klasse: 'aus', text: 'nein' };
}

// Dasselbe fuer den Dienststatus: "unbekannt" ist nicht "kaputt".
// systemctl liefert im Fehlerfall die Zeichenkette "unknown"; fehlt der
// Wert ganz, steht ein Gedankenstrich da und nicht das Wort "null".
export function dienstZustand(zustand) {
  if (typeof zustand !== 'string' || !zustand) {
    return { klasse: 'unbekannt', text: '—' };
  }
  if (zustand === 'active') return { klasse: 'aus', text: zustand };
  if (zustand === 'unknown') return { klasse: 'unbekannt', text: zustand };
  return { klasse: 'an', text: zustand };
}

const FLAGGEN = [
  ['undervoltage',   'Unterspannung'],
  ['arm_freq_capped', 'Takt gedeckelt'],
  ['throttled',      'gedrosselt'],
  ['soft_temp_limit', 'Temp-Limit'],
];

function throttleBlock(titel, teil) {
  if (!teil) return `<div class="tile"><div class="lbl">${titel}</div>
    <div class="db-zeile"><span class="db-wert">—</span></div></div>`;
  return `<div class="tile"><div class="lbl">${titel}</div>
    ${FLAGGEN.map(([k, label]) => {
      const f = flagZustand(teil[k]);
      return `
      <div class="db-zeile">
        <span class="db-label">${label}</span>
        <span class="flag ${f.klasse}">${f.text}</span>
      </div>`;
    }).join('')}</div>`;
}

registerPage({
  id: 'system',
  title: 'System',
  ageSource: 'system',
  mount(el) { el.innerHTML = '<div class="sys value"></div>'; },
  render(el, cfg, state) {
    const s = state.system;
    const root = el.querySelector('.sys');
    if (!s) {
      root.innerHTML = '<div class="empty">KEINE SYSTEMDATEN'
        + '<div class="empty-sub">Daemon antwortet nicht</div></div>';
      return;
    }
    const sd = samplesDropped(state.stats);
    const alter = daemonAlterS(s, Date.now());
    const temp = s.cpu_temp_c;
    const zustand = tempZustand(temp);
    const anteil = typeof temp === 'number'
      ? Math.max(0, Math.min(100, (temp - 40) / (MARKEN.hart - 40) * 100)) : 0;
    const marke = c => ((c - 40) / (MARKEN.hart - 40) * 100).toFixed(1);
    root.innerHTML = `
      <div class="sys-oben">
        <div class="tile sys-temp ${zustand}">
          <div class="lbl">CPU-Temperatur</div>
          <div class="huge value">${strich(temp, 1)}<span class="unit-s">°C</span></div>
          <div class="temp-bar">
            <i style="width:${anteil.toFixed(1)}%"></i>
            <u class="m-soft"  style="left:${marke(MARKEN.soft)}%"></u>
            <u class="m-abn"   style="left:${marke(MARKEN.abnahme)}%"></u>
            <u class="m-hart"  style="left:${marke(MARKEN.hart)}%"></u>
          </div>
          <div class="sub-d">Marken ${MARKEN.soft} · ${MARKEN.abnahme} (Abnahme) · ${MARKEN.hart} °C</div>
        </div>
        <div class="tile">
          <div class="lbl">Last · ${strich(s.cpu_count)} Kerne</div>
          <div class="db-zeile"><span class="db-label">1 min</span>
            <span class="db-wert">${strich(s.load && s.load[0], 2)}</span></div>
          <div class="db-zeile"><span class="db-label">5 min</span>
            <span class="db-wert">${strich(s.load && s.load[1], 2)}</span></div>
          <div class="db-zeile"><span class="db-label">15 min</span>
            <span class="db-wert">${strich(s.load && s.load[2], 2)}</span></div>
        </div>
        <div class="tile">
          <div class="lbl">Speicher und Platte</div>
          <div class="db-zeile"><span class="db-label">RAM</span>
            <span class="db-wert">${strich(s.mem_used_mb)} / ${strich(s.mem_total_mb)}<span class="unit-s">MB</span></span></div>
          <div class="db-zeile"><span class="db-label">Platte</span>
            <span class="db-wert">${strich(s.disk_used_gb, 1)} / ${strich(s.disk_total_gb, 1)}<span class="unit-s">GB</span></span></div>
          <div class="db-zeile"><span class="db-label">Uptime</span>
            <span class="db-wert">${s.uptime_s == null ? '—' : Math.floor(s.uptime_s / 86400) + ' d ' + Math.floor(s.uptime_s % 86400 / 3600) + ' h'}</span></div>
        </div>
        <div class="tile">
          <div class="lbl">SDR-Leser</div>
          <div class="db-zeile"><span class="db-label">samples_dropped jetzt</span>
            <span class="db-wert ${sd.jetzt ? 'red' : ''}">${strich(sd.jetzt)}</span></div>
          <div class="db-zeile"><span class="db-label">seit Start</span>
            <span class="db-wert ${sd.gesamt ? 'red' : ''}">${strich(sd.gesamt)}</span></div>
          <div class="db-zeile"><span class="db-label">Takt</span>
            <span class="db-wert">${s.core_clock_hz == null ? '—' : (s.core_clock_hz / 1e6).toFixed(0)}<span class="unit-s">MHz</span></span></div>
          <div class="db-zeile"><span class="db-label">Kernspannung</span>
            <span class="db-wert">${strich(s.core_volts, 2)}<span class="unit-s">V</span></span></div>
        </div>
      </div>
      <div class="sys-unten">
        ${throttleBlock('Drosselung jetzt', s.throttle && s.throttle.now)}
        ${throttleBlock('Drosselung seit Boot', s.throttle && s.throttle.ever)}
        <div class="tile">
          <div class="lbl">Dienste</div>
          ${Object.entries(s.services || {}).map(([name, zustand]) => {
            const d = dienstZustand(zustand);
            return `
            <div class="db-zeile"><span class="db-label">${name}</span>
              <span class="flag ${d.klasse}">${d.text}</span></div>`;
          }).join('')}
        </div>
        <div class="tile">
          <div class="lbl">Daemon</div>
          <div class="db-zeile"><span class="db-label">geschrieben vor</span>
            <span class="db-wert ${alter != null && alter > 30 ? 'red' : ''}">${strich(alter)}<span class="unit-s">s</span></span></div>
        </div>
      </div>`;
  },
});
