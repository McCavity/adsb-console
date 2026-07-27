import { haversineNm, bearingDeg, formatCallsign, flightLevel, isEmergency }
  from '../geo.js';
import { registerPage } from '../console.js';

const SIZE = 620;               // Buehnenhoehe: 720 minus Kopf (56) und Punkte (44)
const R = SIZE / 2;             // Radius in Pixeln
const CENTER = SIZE / 2;

// Rein, damit sie testbar ist: Ergebnis relativ zum Mittelpunkt.
// Norden ist oben (negatives y), Osten rechts.
export function projectToCanvas(nm, brg, rangeNm, radiusPx) {
  const r = nm / rangeNm * radiusPx;
  const a = brg * Math.PI / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}

// Nur die Farben der gezeichneten Ebene. Keule, Blips und Beschriftung
// bekommen ihre Farben in der CSS-Datei -- sie werden nicht gezeichnet,
// sondern vom Compositor bewegt.
const COL = {
  ring: '#1c5c33', ringText: '#3a8f57',
  airport: '#4fb0d8', runway: '#6fd0f0',
};

let airports = null;

async function loadAirports() {
  if (airports) return airports;
  try {
    const res = await fetch('data/airports.json', { cache: 'force-cache' });
    airports = res.ok ? (await res.json()).airports : [];
  } catch (_) { airports = []; }
  return airports;
}

function drawBackground(ctx, cfg, receiver) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.strokeStyle = COL.ring;
  ctx.lineWidth = 1;
  for (const nm of cfg.radar.rings_nm) {
    const r = nm / cfg.radar.range_nm * R;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COL.ringText;
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(`${nm}`, 4, -r - 5);
  }
  for (let d = 0; d < 360; d += 30) {          // Peilstrahlen
    const p = projectToCanvas(cfg.radar.range_nm, d, cfg.radar.range_nm, R);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.x, p.y); ctx.stroke();
    const t = projectToCanvas(cfg.radar.range_nm * 0.94, d, cfg.radar.range_nm, R);
    ctx.fillStyle = COL.ringText;
    ctx.font = '13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(d === 0 ? 360 : d).padStart(3, '0'), t.x, t.y);
  }
  ctx.textAlign = 'left';
  if (receiver && airports) drawAirports(ctx, cfg, receiver);
  ctx.restore();
}

function drawAirports(ctx, cfg, receiver) {
  for (const ap of airports) {
    const nm = haversineNm(receiver.lat, receiver.lon, ap.lat, ap.lon);
    if (nm > cfg.radar.range_nm) continue;
    const p = projectToCanvas(nm, bearingDeg(receiver.lat, receiver.lon, ap.lat, ap.lon),
                              cfg.radar.range_nm, R);
    // Bahnen massstaeblich, sofern sie bei diesem Massstab ueberhaupt
    // sichtbar sind -- bei 0,161 NM/px sind 4000 m rund 13 px. Alles unter
    // vier Pixeln waere Strichgekritzel und wird zum blossen Symbol.
    let drewRunway = false;
    for (const rw of ap.runways || []) {
      const a = projectToCanvas(
        haversineNm(receiver.lat, receiver.lon, rw.le_lat, rw.le_lon),
        bearingDeg(receiver.lat, receiver.lon, rw.le_lat, rw.le_lon),
        cfg.radar.range_nm, R);
      const b = projectToCanvas(
        haversineNm(receiver.lat, receiver.lon, rw.he_lat, rw.he_lon),
        bearingDeg(receiver.lat, receiver.lon, rw.he_lat, rw.he_lon),
        cfg.radar.range_nm, R);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 4) continue;
      ctx.strokeStyle = COL.runway;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      drewRunway = true;
    }
    if (!drewRunway) {
      ctx.fillStyle = COL.airport;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = COL.airport;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(ap.icao, p.x + 6, p.y - 6);
  }
}

registerPage({
  id: 'radar',
  title: 'Radar',
  ageSource: 'aircraft',
  mount(el, cfg) {
    // Drei Ebenen: eine gezeichnete (Hintergrund) und zwei, die der
    // Compositor bewegt. Kein requestAnimationFrame, keine Bildschleife.
    el.innerHTML = `
      <div class="radar-wrap">
        <canvas class="bg" width="${SIZE}" height="${SIZE}"></canvas>
        <div class="sweep"></div>
        <div class="blips"></div>
      </div>
      <div class="radar-side value"></div>`;
    el.querySelector('.sweep').style.animationDuration = cfg.radar.sweep_s + 's';
    el._ctx = {
      bg: el.querySelector('.bg').getContext('2d'),
      blips: el.querySelector('.blips'),
      drawnBg: false,
    };
    loadAirports().then(() => { el._ctx.drawnBg = false; });
  },
  render(el, cfg, state) {
    const c = el._ctx;
    if (!c.drawnBg && state.receiver) {
      drawBackground(c.bg, cfg, state.receiver);
      c.drawnBg = true;
    }
    const targets = state.receiver ? state.aircraft
      .filter(a => typeof a.lat === 'number' && typeof a.lon === 'number')
      .map(a => {
        const nm = haversineNm(state.receiver.lat, state.receiver.lon, a.lat, a.lon);
        return {
          hex: a.hex, nm,
          brg: bearingDeg(state.receiver.lat, state.receiver.lon, a.lat, a.lon),
          callsign: formatCallsign(a.flight), fl: flightLevel(a.alt_baro),
          squawk: a.squawk || null, gs: a.gs, track: a.track,
          heavy: a.category === 'A5', emergency: isEmergency(a),
        };
      })
      .filter(t => t.nm <= cfg.radar.range_nm) : [];
    renderBlips(c.blips, cfg, targets);
  },
});

// Ein Blip je Ziel, als positioniertes Element. Das Aufleuchten beim
// Ueberstreichen und das Verglimmen danach macht die CSS-Animation; ihr
// animation-delay wird aus der Peilung berechnet, sodass sie mit der
// Keule zusammenfaellt, ohne dass hier jemals synchronisiert wird.
function renderBlips(root, cfg, targets) {
  root.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const t of targets) {
    const p = projectToCanvas(t.nm, t.brg, cfg.radar.range_nm, R);
    const el = document.createElement('div');
    el.className = 'blip' + (t.heavy ? ' heavy' : '') + (t.emergency ? ' emg' : '');
    el.style.left = (CENTER + p.x) + 'px';
    el.style.top = (CENTER + p.y) + 'px';
    el.style.animationDuration = cfg.radar.sweep_s + 's';
    // Die Keule beginnt bei 000 und laeuft im Uhrzeigersinn. Ein Ziel bei
    // der Peilung brg wird nach brg/360 einer Umdrehung ueberstrichen --
    // genau dann soll der Keyframe bei 0 Prozent stehen.
    el.style.animationDelay = (t.brg / 360 * cfg.radar.sweep_s).toFixed(3) + 's';

    if (typeof t.gs === 'number' && typeof t.track === 'number') {
      // Track-Vektor: wo das Ziel in leader_s Sekunden waere.
      const len = t.gs * (cfg.radar.leader_s / 3600) / cfg.radar.range_nm * R;
      const v = document.createElement('i');
      v.className = 'vec';
      v.style.height = Math.max(0, len) + 'px';
      v.style.transform = `rotate(${t.track}deg)`;
      el.appendChild(v);
    }

    const lines = [];
    if (cfg.radar.labels.includes('callsign')) {
      lines.push((t.callsign || '——') + (t.heavy ? ' H' : ''));
    }
    const second = [];
    if (cfg.radar.labels.includes('fl')) second.push(t.fl);
    if (cfg.radar.labels.includes('squawk') && t.squawk) second.push(t.squawk);
    if (second.length) lines.push(second.join(' '));
    if (lines.length) {
      const lab = document.createElement('span');
      lab.className = 'lab';
      lab.textContent = lines.join('\n');
      el.appendChild(lab);
    }
    frag.appendChild(el);
  }
  root.appendChild(frag);
}
