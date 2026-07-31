import { registerPage } from '../console.js';

const WINDOWS = [['last1min', '1 min'], ['last5min', '5 min'], ['last15min', '15 min']];

export function summarise(doc) {
  if (!doc || typeof doc !== 'object') return { windows: [], gain: null, tracks: null };
  const windows = [];
  let gain = null, tracks = null;
  for (const [key, label] of WINDOWS) {
    const w = doc[key];
    if (!w || !w.local) continue;
    const span = w.end - w.start;
    const acc = Array.isArray(w.local.accepted)
      ? w.local.accepted.reduce((a, b) => a + b, 0) : null;
    windows.push({
      label,
      msgPerS: span > 0 ? Math.round(w.messages / span) : null,
      accepted: acc,
      strong: w.local.strong_signals ?? null,
      peak: w.local.peak_signal ?? null,
      signal: w.local.signal ?? null,
      noise: w.local.noise ?? null,
    });
    if (w.local.gain_db != null) gain = w.local.gain_db;
    if (w.tracks) tracks = w.tracks;
  }
  return { windows, gain, tracks };
}

const n = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '—');

registerPage({
  id: 'stats',
  title: 'Empfang',
  ageSource: 'stats',
  mount(el) { el.innerHTML = '<div class="stats value"></div>'; },
  render(el, cfg, state) {
    const s = summarise(state.stats);
    const root = el.querySelector('.stats');
    if (!s.windows.length) {
      root.innerHTML = '<div class="empty">KEINE STATISTIK</div>';
      return;
    }
    const row = (label, pick, digits) => `
      <tr><th>${label}</th>${s.windows.map(w =>
        `<td>${typeof pick(w) === 'number' ? pick(w).toFixed(digits) : '—'}</td>`).join('')}</tr>`;
    root.innerHTML = `
      <table class="tbl stats-tbl">
        <thead><tr><th></th>${s.windows.map(w => `<th>${w.label}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('Nachrichten /s', w => w.msgPerS, 0)}
          ${row('akzeptiert', w => w.accepted, 0)}
          ${row('starke Signale', w => w.strong, 0)}
          ${row('Peak dBFS', w => w.peak, 1)}
          ${row('Signal dBFS', w => w.signal, 1)}
          ${row('Rauschen dBFS', w => w.noise, 1)}
        </tbody>
      </table>
      <div class="stats-foot">
        <span>Verstärkung <b>${n(s.gain)} dB</b></span>
        <span>Tracks <b>${s.tracks?.all ?? '—'}</b></span>
        <span>davon single-message <b>${s.tracks?.single_message ?? '—'}</b></span>
        <span>unreliable <b>${s.tracks?.unreliable ?? '—'}</b></span>
      </div>`;
  },
});
