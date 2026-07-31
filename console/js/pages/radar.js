import { haversineNm, bearingDeg, formatBearing, formatCallsign, flightLevel, isEmergency,
         projectToCanvas, sichtbareRinge, inReichweite } from '../geo.js';
import { registerPage } from '../console.js';
import { msgRate, leerUntertitel } from './gemeinsam.js';

const SIZE = 620;               // Buehnenhoehe: 720 minus Kopf (56) und Punkte (44)
const R = SIZE / 2;             // Radius in Pixeln
const CENTER = SIZE / 2;

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

function drawBackground(ctx, cfg, receiver, sicht) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.strokeStyle = COL.ring;
  ctx.lineWidth = 1;
  for (const nm of sichtbareRinge(sicht.rings_nm, sicht.range_nm)) {
    const r = nm / sicht.range_nm * R;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COL.ringText;
    ctx.font = '13px B612Mono, ui-monospace, monospace';
    ctx.fillText(`${nm}`, 4, -r - 5);
  }
  for (let d = 0; d < 360; d += 30) {          // Peilstrahlen
    const p = projectToCanvas(sicht.range_nm, d, sicht.range_nm, R);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.x, p.y); ctx.stroke();
    const t = projectToCanvas(sicht.range_nm * 0.94, d, sicht.range_nm, R);
    ctx.fillStyle = COL.ringText;
    ctx.font = '13px B612Mono, ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(d === 0 ? 360 : d).padStart(3, '0'), t.x, t.y);
  }
  ctx.textAlign = 'left';
  if (receiver && airports && sicht.layer.airports) drawAirports(ctx, receiver, sicht);
  ctx.restore();
}

function drawAirports(ctx, receiver, sicht) {
  for (const ap of airports) {
    const nm = haversineNm(receiver.lat, receiver.lon, ap.lat, ap.lon);
    if (nm > sicht.range_nm) continue;
    const p = projectToCanvas(nm, bearingDeg(receiver.lat, receiver.lon, ap.lat, ap.lon),
                              sicht.range_nm, R);
    // Bahnen massstaeblich, sofern sie bei diesem Massstab ueberhaupt
    // sichtbar sind -- bei 0,161 NM/px sind 4000 m rund 13 px. Alles unter
    // vier Pixeln waere Strichgekritzel und wird zum blossen Symbol.
    let drewRunway = false;
    for (const rw of ap.runways || []) {
      const a = projectToCanvas(
        haversineNm(receiver.lat, receiver.lon, rw.le_lat, rw.le_lon),
        bearingDeg(receiver.lat, receiver.lon, rw.le_lat, rw.le_lon),
        sicht.range_nm, R);
      const b = projectToCanvas(
        haversineNm(receiver.lat, receiver.lon, rw.he_lat, rw.he_lon),
        bearingDeg(receiver.lat, receiver.lon, rw.he_lat, rw.he_lon),
        sicht.range_nm, R);
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
    ctx.font = '12px B612Mono, ui-monospace, monospace';
    const breite = ctx.measureText(ap.icao).width;
    const passtRechts = p.x + 6 + breite <= CENTER - 2;
    ctx.textAlign = passtRechts ? 'left' : 'right';
    ctx.fillText(ap.icao, p.x + (passtRechts ? 6 : -6), p.y - 6);
    ctx.textAlign = 'left';
  }
}

// Woraus besteht das gezeichnete Hintergrundbild? Genau daraus, und aus
// nichts sonst -- wer hier ein Feld vergisst, bekommt einen Hintergrund,
// der zum Vordergrund nicht mehr passt und sich nie korrigiert.
export function hintergrundSignatur(sicht) {
  return [sicht.range_nm, sicht.rings_nm.join(','), sicht.layer.airports ? 'ap' : '-'].join('|');
}

// Was die Radarseite im Einstellungsdialog anbietet. Bewusst DATEN, keine
// DOM-Bauerei: Der Dialog (console.js) kennt nur diese Form und weiss
// nichts ueber Radar. Spaetere Layer -- Staedte, Sektoren, Luftraeume,
// Anflug- und Holding-Muster -- legen hier einen Eintrag dazu, statt die
// Kopfzeile anzufassen.
export function radarEinstellungen(cfg, sicht) {
  return [
    { kennung: 'stufe', beschriftung: 'Reichweite', art: 'auswahl',
      wert: sicht.stufeIndex,
      optionen: sicht.stufen.map((s, i) => ({ wert: i, text: `${s.range_nm} NM` })) },
    { kennung: 'airports', beschriftung: 'Flugplätze', art: 'schalter',
      wert: sicht.layer.airports },
  ];
}

registerPage({
  id: 'radar',
  title: 'Radar',
  ageSource: 'aircraft',
  einstellungen(cfg, sicht) { return radarEinstellungen(cfg, sicht); },
  mount(el, cfg, state, sicht) {
    // Drei Ebenen: eine gezeichnete (Hintergrund) und zwei, die der
    // Compositor bewegt. Kein requestAnimationFrame, keine Bildschleife.
    el.innerHTML = `
      <div class="radar-wrap value">
        <canvas class="bg" width="${SIZE}" height="${SIZE}"></canvas>
        <div class="sweep"></div>
        <div class="blips"></div>
      </div>
      <div class="radar-side value"></div>`;
    el.querySelector('.sweep').style.animationDuration = cfg.radar.sweep_s + 's';
    el._ctx = {
      bg: el.querySelector('.bg').getContext('2d'),
      blips: el.querySelector('.blips'),
      bgSig: null,
      // Startzeit der Keule. Jeder Blip rechnet sein animation-delay
      // gegen diesen Zeitpunkt, nicht gegen seine eigene Entstehung.
      sweepStart: performance.now(),
    };
    installDecayKeyframes(cfg);
    // Der Hintergrund wird nur bei geaenderter Signatur neu gezeichnet
    // (bgSig). Eine Canvas-Schrift, die zum Zeichenzeitpunkt noch nicht
    // geladen ist, faellt lautlos auf die Ersatzschrift zurueck --
    // deshalb erst die Schrift, dann die Flugplaetze, dann freigeben
    // (bgSig zuruecksetzen erzwingt den naechsten Zeichenlauf).
    Promise.all([
      loadAirports(),
      document.fonts ? document.fonts.load('13px B612Mono').catch(() => null) : null,
    ]).then(() => { el._ctx.bgSig = null; });
  },
  render(el, cfg, state, sicht) {
    const c = el._ctx;
    const sig = hintergrundSignatur(sicht);
    if (c.bgSig !== sig && state.receiver) {
      drawBackground(c.bg, cfg, state.receiver, sicht);
      c.bgSig = sig;
    }
    // Der Entfernungsfilter laeuft ueber inReichweite (geo.js) -- dieselbe
    // Regel, die seit dem 31.07.2026 auch Tafel und Einzelziel benutzen.
    // Vorher stand sie hier als eigener Ausdruck, und genau deshalb hatten
    // die beiden anderen Seiten sie gar nicht.
    const targets = inReichweite(state.receiver ? state.aircraft
      .filter(a => typeof a.lat === 'number' && typeof a.lon === 'number')
      .map(a => {
        const nm = haversineNm(state.receiver.lat, state.receiver.lon, a.lat, a.lon);
        return {
          hex: a.hex, nm,
          brg: bearingDeg(state.receiver.lat, state.receiver.lon, a.lat, a.lon),
          callsign: formatCallsign(a.flight), fl: flightLevel(a.alt_baro),
          squawk: a.squawk || null, gs: a.gs, track: a.track,
          rate: typeof a.baro_rate === 'number' ? a.baro_rate : null,
          heavy: a.category === 'A5',
          emergency: cfg.emergency.highlight && isEmergency(a),
        };
      }) : [], sicht.range_nm);
    const auswahl = waehleZiel(targets);
    renderBlips(c.blips, cfg, sicht, targets, c.sweepStart, auswahl);
    renderSide(el.querySelector('.radar-side'), cfg, sicht, state, targets, auswahl);
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

function renderBlips(root, cfg, sicht, targets, sweepStart, auswahl) {
  // Zuordnung ueber eine Map statt ueber einen Selector-String: Ein hex
  // mit einem Anfuehrungszeichen oder einer eckigen Klammer -- etwa aus
  // einer praeparierten Testquelle -- wuerde querySelector mitten in der
  // Schleife werfen und damit ALLE weiteren Blips einfrieren, lautlos und
  // ohne sichtbaren Fehler. Nebenbei entfaellt die quadratische Suche.
  const vorhanden = new Map();
  for (const el of root.children) vorhanden.set(el.dataset.hex, el);
  const gesehen = new Set();
  for (const t of targets) {
    if (!t.hex) continue;
    gesehen.add(t.hex);
    let el = vorhanden.get(t.hex);
    const istAusgewaehlt = !!(auswahl && t.hex === auswahl.hex);
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
      vorhanden.set(t.hex, el);
      setPhase(el, cfg, t.brg, sweepStart);
    } else if (el.classList.contains('sel') && !istAusgewaehlt) {
      // Verlaesst den ausgewaehlten Zustand: ".blip.sel .dot" setzt
      // "animation: none", das entfernte Element unten (Klassenwechsel)
      // erzeugt die Animation gleich neu -- und eine neu erzeugte
      // CSS-Animation zaehlt ihre Zeit ab DIESEM Moment, nicht ab
      // el.dataset.tc (das kann Minuten zurueckliegen). setPhase rechnet
      // sein delay aber gegen dataset.tc; ohne Nachziehen bekaeme die
      // neue Animationsinstanz das Delay eines laengst vergangenen
      // Zeitpunkts und der Blip leuchtete am falschen Azimut auf, bis
      // sich seine Peilung zufaellig um MIN_RESYNC_DEG bewegt -- derselbe
      // Fehler, der schon einmal am Panel gefunden wurde. Also
      // dataset.tc auf jetzt vorziehen, genau wie bei der Entstehung.
      el.dataset.tc = String(performance.now());
      setPhase(el, cfg, t.brg, sweepStart);
    } else if (Math.abs(angleDiff(Number(el.dataset.brg), t.brg)) >= MIN_RESYNC_DEG) {
      setPhase(el, cfg, t.brg, sweepStart);
    }

    el.className = 'blip' + (t.heavy ? ' heavy' : '') + (t.emergency ? ' emg' : '')
                 + (istAusgewaehlt ? ' sel' : '');
    const p = projectToCanvas(t.nm, t.brg, sicht.range_nm, R);
    el.style.left = (CENTER + p.x) + 'px';
    el.style.top = (CENTER + p.y) + 'px';

    const vec = el.querySelector('.vec');
    if (typeof t.gs === 'number' && typeof t.track === 'number') {
      // Track-Vektor: wo das Ziel in leader_s Sekunden waere.
      const len = t.gs * (cfg.radar.leader_s / 3600) / sicht.range_nm * R;
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

// decay_s aus der Konfiguration wirksam machen. Die Zerfallskurve steckte
// als feste Prozentwerte im CSS-Keyframe -- wer decay_s in console.json
// aenderte, bewirkte nichts. Ein Konfigfeld, das nichts tut, ist schlimmer
// als keines: Es verspricht eine Stellschraube, die es nicht gibt.
function installDecayKeyframes(cfg) {
  const id = 'atc-blip-keyframes';
  let st = document.getElementById(id);
  if (!st) {
    st = document.createElement('style');
    st.id = id;
    document.head.appendChild(st);   // nach dem Stylesheet -- gewinnt
  }
  // Anteil eines Umlaufs, ueber den der Blip verglimmt. Bei decay_s
  // groesser als sweep_s ist der Blip noch nicht ganz dunkel, wenn die
  // Keule wiederkommt -- genau die gewollte Anmutung; gedeckelt, damit
  // der letzte Keyframe nicht auf 100 Prozent faellt.
  const anteil = Math.min(0.98, cfg.radar.decay_s / cfg.radar.sweep_s);
  const mitte = (anteil * 40).toFixed(1);
  const ende = (anteil * 100).toFixed(1);
  st.textContent = `@keyframes blip-phosphor {
    0% { opacity: 1; }
    ${mitte}% { opacity: .45; }
    ${ende}% { opacity: .18; }
    100% { opacity: .18; }
  }`;
}

// Welches Ziel steht im Datenblock und wird auf dem Schirm hervorgehoben?
// Notfall vor Naehe: Gibt es einen Sonder-Squawk, gehoert der Block ihm --
// und bei mehreren dem naechstgelegenen davon. Sonst dem naechsten Ziel
// ueberhaupt. Automatisch, ohne Bedienung: Eine Wandanzeige, die von
// selbst das Richtige zeigt, schlaegt eine, deren Zustand jemand
// zuruecksetzen muesste.
function waehleZiel(targets) {
  if (!targets.length) return null;
  const notfaelle = targets.filter(t => t.emergency);
  const menge = notfaelle.length ? notfaelle : targets;
  return menge.reduce((a, b) => (b.nm < a.nm ? b : a));
}

// Der Datenblock rechts neben dem Schirm. Er ergaenzt das Bild, statt es
// zu wiederholen: Was der Kreis zeigt (wo etwas ist), zeigt er nicht noch
// einmal; er zeigt, was man aus dem Kreis nicht ablesen kann.
function renderSide(root, cfg, sicht, state, targets, auswahl) {
  if (!targets.length || !auswahl) {
    // Nachts ist das der Normalfall, kein Defekt -- deshalb bleibt die
    // Nachrichtenrate stehen: Sie laeuft weiter, auch wenn kein Ziel eine
    // Position sendet, und unterscheidet "nichts fliegt" von "Empfaenger
    // tot".
    root.innerHTML = `
      <div class="tile ctr" style="flex:1">
        <div class="empty">KEINE ZIELE IN REICHWEITE
          <div class="empty-sub">${leerUntertitel(state)}</div>
        </div>
      </div>`;
    return;
  }
  const naechstes = auswahl;
  const weitestes = targets.reduce((a, b) => (b.nm > a.nm ? b : a));
  const mitPosition = targets.length;
  const gesamt = (state.aircraft || []).length;
  const steig = typeof naechstes.rate === 'number' && Math.abs(naechstes.rate) >= 100
    ? (naechstes.rate > 0 ? '↑' : '↓') + ' ' + Math.abs(Math.round(naechstes.rate)) + ' ft/min'
    : '→ level';

  // isEmergency() (geo.js) greift auch ueber ein aussagekraeftiges
  // "emergency"-Feld ohne einen der drei Sonder-Squawks -- dann ist
  // naechstes.squawk null (siehe Feldaufbau in render() oben), und
  // "Squawk " + null schriebe woertlich "Squawk null" an die Wand. Der
  // Squawk-Teil erscheint deshalb nur, wenn einer vorhanden ist; die
  // Ueberschrift bleibt sonst schlicht "NOTFALL".
  root.innerHTML = `
    <div class="tile${naechstes.emergency ? ' emg' : ''}" style="flex:0 0 250px">
      <div class="lbl">${naechstes.emergency
        ? 'NOTFALL' + (naechstes.squawk ? ' · Squawk ' + naechstes.squawk : '')
        : 'Nächstes Ziel'}</div>
      <div class="huge ${naechstes.emergency ? 'red' : 'em'} value" style="font-size:78px;margin:6px 0 10px">
        ${naechstes.callsign || '——'}${naechstes.heavy ? '<span class="hv"> HEAVY</span>' : ''}</div>
      <div class="row" style="gap:26px">
        <span class="med sky">${naechstes.fl}</span>
        <span class="med amber">${naechstes.nm.toFixed(1)}<span class="unit-s">NM</span></span>
        <span class="med slate">${formatBearing(naechstes.brg)}</span>
      </div>
      <div class="row" style="gap:18px;margin-top:12px">
        ${flugzeugSymbol(naechstes.track)}
        <span class="sub">${typeof naechstes.gs === 'number'
          ? Math.round(naechstes.gs) + '<span class="unit-s">kt</span>' : '—'}</span>
        <span class="sub">${formatBearing(naechstes.track)}<span class="unit-s">Kurs</span></span>
        <span class="sub-d" style="margin-left:auto">${steig}</span>
      </div>
      ${naechstes.squawk && !naechstes.emergency
        ? `<div class="sub-d" style="margin-top:8px">Squawk ${naechstes.squawk}</div>` : ''}
    </div>
    <div class="grid2" style="flex:1">
      ${sideTile('Ziele mit Position', mitPosition, '', `von ${gesamt} empfangen`)}
      ${sideTile('Nachrichten', msgRate(state), '/s', 'letzte Minute')}
      ${sideTile('Weitestes Ziel', weitestes.nm.toFixed(0), 'NM',
                 `${weitestes.callsign || '——'} ${formatBearing(weitestes.brg)}`)}
      ${sideTile('Maßstab', sicht.range_nm, 'NM',
                 `Ringe ${sicht.rings_nm.join(' · ')}`)}
    </div>`;
}

// Ein Flugzeug von oben, in Flugrichtung gedreht. Entfernung und Peilung
// sagen, WO das Ziel ist -- nicht, wohin es geht. Der Vektor steht als
// Strich auf dem Schirm, hier steht er als Zahl daneben, und das Symbol
// macht die Richtung ohne Rechnen ablesbar. Bei 0 Grad zeigt die Nase
// nach oben, also nach Norden; rotate() dreht im Uhrzeigersinn wie die
// Kompassrose.
function flugzeugSymbol(track) {
  if (typeof track !== 'number' || !Number.isFinite(track)) {
    return '<svg class="ac unbekannt" viewBox="0 0 24 24" aria-hidden="true"></svg>';
  }
  return `<svg class="ac" viewBox="0 0 24 24" aria-hidden="true"
               style="transform:rotate(${track.toFixed(0)}deg)">
      <path d="M12 1.6 L13.7 10.6 L22.2 15.2 L22.2 17.1 L13.7 14.9 L13.7 19.9
               L16.6 21.8 L16.6 22.9 L12 21.4 L7.4 22.9 L7.4 21.8 L10.3 19.9
               L10.3 14.9 L1.8 17.1 L1.8 15.2 L10.3 10.6 Z"/>
    </svg>`;
}

function sideTile(label, wert, einheit, sub) {
  return `<div class="tile">
    <div class="lbl">${label}</div>
    <div class="value"><span class="big em">${wert}<span class="unit-s">${einheit}</span></span></div>
    <div class="sub-d value">${sub}</div>
  </div>`;
}

// Kuerzester Winkelabstand, damit der Sprung ueber 360/0 keine
// Dauer-Neusynchronisation ausloest.
function angleDiff(a, b) {
  if (!Number.isFinite(a)) return 360;
  return ((b - a + 540) % 360) - 180;
}
