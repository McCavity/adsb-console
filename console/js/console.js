import { loadConfig } from './config.js';
import { createDataStore, ageState } from './data.js';

const pages = new Map();          // id -> {id, title, ageSource, mount, render}

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

  function renderCurrent() {
    const page = pages.get(order[current]);
    if (!page) return;
    store.state.systemVisible = page.id === 'system';
    page.render(els.get(page.id), config, store.state);
    document.getElementById('page-title').textContent = page.title.toUpperCase();
    updateAge(page);
  }

  function updateAge(page) {
    const at = page.ageSource ? store.state[page.ageSource + 'At'] : null;
    const dot = document.getElementById('age-dot');
    const txt = document.getElementById('age');
    if (!page.ageSource) { dot.style.display = 'none'; txt.textContent = ''; return; }
    dot.style.display = '';
    const ms = at == null ? null : Date.now() - at;
    const st = ageState(ms);
    dot.className = st;
    txt.textContent = ms == null ? 'keine Daten' : `${Math.round(ms / 1000)} s`;
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
  function goTo(index, rotate = true) {
    const next = ((index % order.length) + order.length) % order.length;
    if (next === current) return;
    els.get(order[current]).classList.remove('active');
    current = next;
    renderCurrent();
    els.get(order[current]).classList.add('active');
    dotsEl.querySelectorAll('.dot')
      .forEach((d, i) => d.classList.toggle('on', i === current));
    if (rotate) startRotation();
  }

  function startRotation() {
    clearTimeout(rotateTimer);
    rotateTimer = setTimeout(() => goTo(current + 1, true), dwellFor(order[current]));
  }

  // Jede Beruehrung pausiert die Rotation; sie nimmt danach von der
  // SICHTBAREN Seite aus wieder auf, nicht von der unterbrochenen.
  function takeOver() {
    clearTimeout(rotateTimer);
    clearTimeout(resumeTimer);
    // Nach genau RESUME_MS wird weitergeblaettert -- NICHT: nach RESUME_MS
    // beginnt die Standzeit der sichtbaren Seite von vorn. Sonst dauerte
    // dieselbe Geste je nach Seite 75 s (Board, Statistik) oder 105 s
    // (Radar), ohne dass es dafuer einen Grund gaebe. Am 27.07. am Panel
    // mit der Stoppuhr gemessen: 75 statt der zugesagten 60.
    resumeTimer = setTimeout(() => goTo(current + 1, true), RESUME_MS);
  }

  let downX = 0, downY = 0, downT = 0;
  stage.addEventListener('pointerdown', e => {
    downX = e.clientX; downY = e.clientY; downT = Date.now();
  });
  stage.addEventListener('pointerup', e => {
    const dx = e.clientX - downX, dy = e.clientY - downY;
    takeOver();
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) && Date.now() - downT < 1200) {
      goTo(current + (dx < 0 ? 1 : -1), false);
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
