import { loadConfig } from './config.js';
import { createDataStore, ageState } from './data.js';
import { naechsterWechsel } from './carousel.js';

const pages = new Map();          // id -> {id, title, ageSource, mount, render, onEnter?}

export function registerPage(page) { pages.set(page.id, page); }

export async function startConsole() {
  const config = await loadConfig();
  const store = createDataStore(() => renderCurrent());
  const order = config.activePages.filter(id => pages.has(id));
  const stage = document.getElementById('stage');
  const dotsEl = document.getElementById('dots');
  const els = new Map();
  let current = 0, rotateTimer = null, resumeTimer = null;
  const RESUME_MS = 60000;

  for (const id of order) {
    const el = document.createElement('div');
    el.className = 'page';
    stage.appendChild(el);
    els.set(id, el);
    pages.get(id).mount(el, config, store.state);

    const box = document.createElement('div');
    box.className = 'dotbox';
    const dot = document.createElement('span');
    dot.className = 'dot';
    box.appendChild(dot);
    const index = order.indexOf(id);
    box.addEventListener('pointerup', () => { goTo(index, false); takeOver(); });
    dotsEl.appendChild(box);
  }

  function dwellFor(id) {
    return (config.dwell_s[id] ?? config.dwell_s.default) * 1000;
  }

  // Wird beim Seitenwechsel genau einmal gerufen -- nicht bei jedem
  // Datenpaket. Die Einzelziel-Seite friert hier ihr Ziel ein, die
  // Systemseite holt hier ihre Daten sofort statt bis zu 10 s zu warten.
  function betrete(index) {
    const id = order[index];
    store.state.systemVisible = id === 'system';
    if (id === 'system') store.refreshSystem();
    const page = pages.get(id);
    if (page && page.onEnter) page.onEnter(els.get(id), config, store.state);
  }

  function renderCurrent() {
    const page = pages.get(order[current]);
    if (!page) return;
    page.render(els.get(page.id), config, store.state);
    document.getElementById('page-title').textContent = page.title.toUpperCase();
    updateAge(page);
  }

  const uhrzeit = ms => new Date(ms).toLocaleTimeString('de-DE',
    { hour: '2-digit', minute: '2-digit', hour12: false });

  function updateAge(page) {
    const at = page.ageSource ? store.state[page.ageSource + 'At'] : null;
    const dot = document.getElementById('age-dot');
    const txt = document.getElementById('age');
    if (!page.ageSource) { dot.style.display = 'none'; txt.textContent = ''; return; }
    dot.style.display = '';
    const ms = at == null ? null : Date.now() - at;
    const st = ageState(ms);
    dot.className = st;
    // Spec 8 sagt "keine Daten seit HH:MM" zu. Eine Uhrzeit sagt, seit
    // wann; "keine Daten" sagt es nicht.
    if (ms == null) {
      txt.textContent = at == null ? 'keine Daten' : `keine Daten seit ${uhrzeit(at)}`;
    } else if (ms >= 60000) {
      txt.textContent = `keine Daten seit ${uhrzeit(at)}`;
    } else {
      txt.textContent = `${Math.round(ms / 1000)} s`;
    }
    els.get(page.id).classList.remove('fresh', 'aging', 'stale');
    els.get(page.id).classList.add(st);
  }

  // rotate: Soll nach dem Wechsel wieder automatisch weitergeblaettert
  // werden? Der automatische Umlauf will das, eine Beruehrung nicht --
  // dort uebernimmt takeOver() und plant die Fortsetzung in 60 s.
  // Ausdruecklich als Parameter und nicht ueber die Aufrufreihenfolge:
  // Vorher rief die Touch-Behandlung erst takeOver() und dann goTo(),
  // und goTo startete die Rotation sofort wieder -- die Pause war
  // gesetzt und im selben Atemzug ueberschrieben. Am 27.07. am Panel
  // gemessen: Das Board blieb 15 statt 60 Sekunden stehen.
  function goTo(index, rotate = true, wischRichtung = null) {
    const next = ((index % order.length) + order.length) % order.length;
    if (next === current) return;
    const alt = els.get(order[current]);
    alt.classList.remove('active');
    alt.classList.remove('wisch-links', 'wisch-rechts');
    if (wischRichtung) {
      alt.classList.add(wischRichtung < 0 ? 'wisch-links' : 'wisch-rechts');
      setTimeout(() => alt.classList.remove('wisch-links', 'wisch-rechts'), 220);
    }
    current = next;
    betrete(current);
    renderCurrent();
    els.get(order[current]).classList.add('active');
    dotsEl.querySelectorAll('.dot')
      .forEach((d, i) => d.classList.toggle('on', i === current));
    if (rotate) startRotation();
  }

  // Die eigentliche Entscheidung (welche Seite als naechstes, nach wie
  // langer Wartezeit) sitzt rein in naechsterWechsel() (carousel.js) und ist
  // dort getestet (tests/test_carousel.mjs) -- hier bleiben nur DOM-seitige
  // Nebenwirkungen: Timer setzen und goTo() aufrufen.
  function startRotation() {
    clearTimeout(rotateTimer);
    const { seiteIndex, inMs } = naechsterWechsel({
      seiteIndex: current, seitenzahl: order.length,
      dwellMs: dwellFor(order[current]), resumeMs: RESUME_MS,
      ausloeser: 'automatisch',
    });
    rotateTimer = setTimeout(() => goTo(seiteIndex, true), inMs);
  }

  // Jede Beruehrung pausiert die Rotation; sie nimmt danach von der
  // SICHTBAREN Seite aus wieder auf, nicht von der unterbrochenen.
  function takeOver() {
    clearTimeout(rotateTimer);
    clearTimeout(resumeTimer);
    const { seiteIndex, inMs } = naechsterWechsel({
      seiteIndex: current, seitenzahl: order.length,
      dwellMs: dwellFor(order[current]), resumeMs: RESUME_MS,
      ausloeser: 'beruehrung',
    });
    resumeTimer = setTimeout(() => goTo(seiteIndex, true), inMs);
  }

  let downX = 0, downY = 0, downT = 0;
  stage.addEventListener('pointerdown', e => {
    downX = e.clientX; downY = e.clientY; downT = Date.now();
  });
  stage.addEventListener('pointerup', e => {
    const dx = e.clientX - downX, dy = e.clientY - downY;
    takeOver();
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) && Date.now() - downT < 1200) {
      goTo(current + (dx < 0 ? 1 : -1), false, dx < 0 ? -1 : 1);
    }
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  function tickClock() {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('date').textContent =
      now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    updateAge(pages.get(order[current]));
  }

  els.get(order[0]).classList.add('active');
  dotsEl.querySelector('.dot').classList.add('on');
  await store.start();
  betrete(0);
  renderCurrent();
  tickClock();
  setInterval(tickClock, 1000);
  startRotation();

  // Naechtlicher Reload -- nur wenn die Quelle vorher antwortet. Ohne diese
  // Sperre ist der Reload genau der Mechanismus, der morgens eine
  // Fehlerseite an der Wand hinterlaesst.
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== 4 || now.getMinutes() !== 0) return;
    try {
      const res = await fetch('/skyaware/data/aircraft.json', { cache: 'no-store' });
      if (res.ok) location.reload();
    } catch (_) { /* kein Reload */ }
  }, 60000);
}
