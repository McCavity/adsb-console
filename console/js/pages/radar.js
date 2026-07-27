import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel, isEmergency }
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
    // Die Kennung weicht auf die Seite aus, auf der Platz ist. Die
    // Leinwand ist genau so breit wie der Kreis -- ein Platz am oestlichen
    // Rand sitzt damit an der Kante, und eine stur nach rechts gezeichnete
    // Beschriftung laeuft aus dem Bild (am 27.07. an EDFJ gesehen, dessen
    // Kennung bis auf das J abgeschnitten war).
    ctx.fillStyle = COL.airport;
    ctx.font = '12px ui-monospace, monospace';
    const breite = ctx.measureText(ap.icao).width;
    const passtRechts = p.x + 6 + breite <= CENTER - 2;
    ctx.textAlign = passtRechts ? 'left' : 'right';
    ctx.fillText(ap.icao, p.x + (passtRechts ? 6 : -6), p.y - 6);
    ctx.textAlign = 'left';
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
      // Startzeit der Keule. Jeder Blip rechnet sein animation-delay
      // gegen diesen Zeitpunkt, nicht gegen seine eigene Entstehung.
      sweepStart: performance.now(),
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
          rate: typeof a.baro_rate === 'number' ? a.baro_rate : null,
          heavy: a.category === 'A5', emergency: isEmergency(a),
        };
      })
      .filter(t => t.nm <= cfg.radar.range_nm) : [];
    renderBlips(c.blips, cfg, targets, c.sweepStart);
    renderSide(el.querySelector('.radar-side'), cfg, state, targets);
  },
});

// Blips werden WIEDERVERWENDET, nicht neu gebaut. Ein neu erzeugtes
// Element startet seine CSS-Animation von vorn, und da render() im
// Sekundentakt laeuft, blinkte sonst der ganze Schirm synchron.
//
// Die Animation sitzt auf einem eigenen Punkt-Element, NICHT auf dem
// Behaelter: Deckkraft multipliziert sich auf alle Kinder, ein Kind kann
// seinen Vater nicht ueberstrahlen. Laege die Animation auf dem
// Behaelter, pulsierten Beschriftung und Track-Vektor mit -- und ein
// Callsign, das im Takt der Keule blinkt, ist auf einem Wanddisplay
// unlesbar. Am 27.07. am Panel gesehen.
const MIN_RESYNC_DEG = 5;

function renderBlips(root, cfg, targets, sweepStart) {
  const gesehen = new Set();
  for (const t of targets) {
    if (!t.hex) continue;
    gesehen.add(t.hex);
    let el = root.querySelector(`[data-hex="${t.hex}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.hex = t.hex;
      // Entstehungszeit merken: Die CSS-Animation rechnet ihre Phase ab
      // diesem Moment, das animation-delay muss den Versatz zur Keule
      // ausgleichen (siehe setPhase).
      el.dataset.tc = String(performance.now());
      el.innerHTML = '<i class="dot"></i><i class="vec"></i><span class="lab"></span>';
      el.querySelector('.dot').style.animationDuration = cfg.radar.sweep_s + 's';
      root.appendChild(el);
      setPhase(el, cfg, t.brg, sweepStart);
    } else if (Math.abs(angleDiff(Number(el.dataset.brg), t.brg)) >= MIN_RESYNC_DEG) {
      setPhase(el, cfg, t.brg, sweepStart);
    }

    el.className = 'blip' + (t.heavy ? ' heavy' : '') + (t.emergency ? ' emg' : '');
    const p = projectToCanvas(t.nm, t.brg, cfg.radar.range_nm, R);
    el.style.left = (CENTER + p.x) + 'px';
    el.style.top = (CENTER + p.y) + 'px';

    const vec = el.querySelector('.vec');
    if (typeof t.gs === 'number' && typeof t.track === 'number') {
      // Track-Vektor: wo das Ziel in leader_s Sekunden waere.
      const len = t.gs * (cfg.radar.leader_s / 3600) / cfg.radar.range_nm * R;
      vec.style.height = Math.max(0, len) + 'px';
      vec.style.transform = `rotate(${t.track}deg)`;
      vec.style.display = '';
    } else {
      vec.style.display = 'none';
    }

    const lines = [];
    if (cfg.radar.labels.includes('callsign')) {
      lines.push((t.callsign || '——') + (t.heavy ? ' H' : ''));
    }
    const second = [];
    if (cfg.radar.labels.includes('fl')) second.push(t.fl);
    if (cfg.radar.labels.includes('squawk') && t.squawk) second.push(t.squawk);
    if (second.length) lines.push(second.join(' '));
    el.querySelector('.lab').textContent = lines.join('\n');
  }
  // Ziele, die dump1090 hat fallenlassen, verschwinden.
  for (const el of Array.from(root.children)) {
    if (!gesehen.has(el.dataset.hex)) el.remove();
  }
}

// Die Keule laeuft ab `sweepStart` im Uhrzeigersinn, ein Umlauf dauert
// sweep_s. Ein Ziel bei der Peilung brg wird nach brg/360 einer Umdrehung
// ueberstrichen.
//
// Der Haken: Eine CSS-Animation zaehlt ihre Zeit ab dem Moment, in dem ihr
// Element entstand -- und ein Blip entsteht, wenn sein Ziel auftaucht,
// nicht wenn die Seite laedt. Ohne Ausgleich passen nur die Ziele, die
// beim Laden schon da waren; alle spaeteren laufen um die verstrichene
// Zeit versetzt und leuchten nie unter der Keule auf. Genau das war am
// 27.07. am Panel zu sehen. Das Delay zieht diesen Versatz ab und darf
// dabei negativ werden -- ein negatives animation-delay bedeutet, die
// Animation laeuft, als sei sie bereits eine Weile gelaufen.
function setPhase(el, cfg, brg, sweepStart) {
  const T = cfg.radar.sweep_s;
  const seitStart = ((Number(el.dataset.tc) - sweepStart) / 1000) % T;
  const delay = (brg / 360) * T - seitStart;
  el.querySelector('.dot').style.animationDelay = delay.toFixed(3) + 's';
  el.dataset.brg = String(brg);
}

// Der Datenblock rechts neben dem Schirm. Er ergaenzt das Bild, statt es
// zu wiederholen: Was der Kreis zeigt (wo etwas ist), zeigt er nicht noch
// einmal; er zeigt, was man aus dem Kreis nicht ablesen kann.
function renderSide(root, cfg, state, targets) {
  if (!targets.length) {
    // Nachts ist das der Normalfall, kein Defekt -- deshalb bleibt die
    // Nachrichtenrate stehen: Sie laeuft weiter, auch wenn kein Ziel eine
    // Position sendet, und unterscheidet "nichts fliegt" von "Empfaenger
    // tot".
    root.innerHTML = `
      <div class="tile ctr" style="flex:1">
        <div class="empty">KEINE ZIELE IN REICHWEITE
          <div class="empty-sub">Nachrichtenrate ${msgRate(state)} /s</div>
        </div>
      </div>`;
    return;
  }
  const naechstes = targets.reduce((a, b) => (b.nm < a.nm ? b : a));
  const weitestes = targets.reduce((a, b) => (b.nm > a.nm ? b : a));
  const mitPosition = targets.length;
  const gesamt = (state.aircraft || []).length;
  const steig = typeof naechstes.rate === 'number' && Math.abs(naechstes.rate) >= 100
    ? (naechstes.rate > 0 ? '↑' : '↓') + ' ' + Math.abs(Math.round(naechstes.rate)) + ' ft/min'
    : '→ level';

  root.innerHTML = `
    <div class="tile" style="flex:0 0 250px">
      <div class="lbl">Nächstes Ziel</div>
      <div class="huge em value" style="font-size:78px;margin:6px 0 10px">
        ${naechstes.callsign || '——'}${naechstes.heavy ? '<span class="hv"> HEAVY</span>' : ''}</div>
      <div class="row" style="gap:26px">
        <span class="med sky">${naechstes.fl}</span>
        <span class="med amber">${naechstes.nm.toFixed(1)}<span class="unit-s">NM</span></span>
        <span class="med slate">${formatBearing(naechstes.brg)}</span>
      </div>
      <div class="sub-d" style="margin-top:10px">${steig}${naechstes.squawk ? ' · Squawk ' + naechstes.squawk : ''}</div>
    </div>
    <div class="grid2" style="flex:1">
      ${sideTile('Ziele mit Position', mitPosition, '', `von ${gesamt} empfangen`)}
      ${sideTile('Nachrichten', msgRate(state), '/s', 'letzte Minute')}
      ${sideTile('Weitestes Ziel', weitestes.nm.toFixed(0), 'NM',
                 `${weitestes.callsign || '——'} ${formatBearing(weitestes.brg)}`)}
      ${sideTile('Maßstab', cfg.radar.range_nm, 'NM',
                 `Ringe ${cfg.radar.rings_nm.join(' · ')}`)}
    </div>`;
}

function sideTile(label, wert, einheit, sub) {
  return `<div class="tile">
    <div class="lbl">${label}</div>
    <div class="value"><span class="big em">${wert}<span class="unit-s">${einheit}</span></span></div>
    <div class="sub-d value">${sub}</div>
  </div>`;
}

function msgRate(state) {
  const s = state.stats && state.stats.last1min;
  if (!s) return '—';
  const spanne = s.end - s.start;
  return spanne > 0 ? Math.round(s.messages / spanne) : '—';
}

// Kuerzester Winkelabstand, damit der Sprung ueber 360/0 keine
// Dauer-Neusynchronisation ausloest.
function angleDiff(a, b) {
  if (!Number.isFinite(a)) return 360;
  return ((b - a + 540) % 360) - 180;
}
