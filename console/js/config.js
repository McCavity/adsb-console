// Konfiguration laden und haerten. Eine kaputte Datei fuehrt zu einer
// laufenden Konsole mit Vorgabewerten, niemals zu einem weissen Schirm.

export const DEFAULTS = Object.freeze({
  pages: { radar: true, board: true, target: true, stats: true,
           polar: true, profile: true, system: true },
  dwell_s: { radar: 45, default: 15 },
  radar: { range_nm: 50, rings_nm: [10, 25, 50], sweep_s: 5,
           decay_s: 6, leader_s: 60, labels: ['callsign', 'fl', 'squawk'] },
  emergency: { highlight: true, interrupt_carousel: false },
});

const PAGE_ORDER = ['radar', 'board', 'target', 'stats', 'polar', 'profile', 'system'];

function positiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function mergeConfig(raw) {
  const src = plainObject(raw);
  const pagesIn = plainObject(src.pages);
  const pages = {};
  for (const id of PAGE_ORDER) {
    pages[id] = typeof pagesIn[id] === 'boolean' ? pagesIn[id] : DEFAULTS.pages[id];
  }
  // Unbekannte Namen werden bewusst nicht uebernommen: sonst traegt die
  // Konsole eine Seite in der Liste, fuer die es keinen Renderer gibt.

  const dwellIn = plainObject(src.dwell_s);
  const dwell_s = {
    radar: positiveNumber(dwellIn.radar, DEFAULTS.dwell_s.radar),
    default: positiveNumber(dwellIn.default, DEFAULTS.dwell_s.default),
  };

  const radarIn = plainObject(src.radar);
  const radar = {
    range_nm: positiveNumber(radarIn.range_nm, DEFAULTS.radar.range_nm),
    sweep_s: positiveNumber(radarIn.sweep_s, DEFAULTS.radar.sweep_s),
    decay_s: positiveNumber(radarIn.decay_s, DEFAULTS.radar.decay_s),
    leader_s: positiveNumber(radarIn.leader_s, DEFAULTS.radar.leader_s),
    rings_nm: Array.isArray(radarIn.rings_nm) &&
              radarIn.rings_nm.every(n => typeof n === 'number' && n > 0)
              ? radarIn.rings_nm.slice() : DEFAULTS.radar.rings_nm.slice(),
    labels: Array.isArray(radarIn.labels)
            ? radarIn.labels.filter(l => DEFAULTS.radar.labels.includes(l))
            : DEFAULTS.radar.labels.slice(),
  };

  const emIn = plainObject(src.emergency);
  const emergency = {
    highlight: typeof emIn.highlight === 'boolean' ? emIn.highlight : DEFAULTS.emergency.highlight,
    interrupt_carousel: typeof emIn.interrupt_carousel === 'boolean'
      ? emIn.interrupt_carousel : DEFAULTS.emergency.interrupt_carousel,
  };

  let activePages = PAGE_ORDER.filter(id => pages[id]);
  if (activePages.length === 0) {
    // Lieber die Hauptseite gegen den Wunsch zeigen als gar nichts: eine
    // leere Anzeige waere von einem Defekt nicht zu unterscheiden.
    activePages = ['radar'];
  }
  return { pages, dwell_s, radar, emergency, activePages };
}

export async function loadConfig(url = 'console.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return mergeConfig(res.ok ? await res.json() : null);
  } catch (_) {
    return mergeConfig(null);       // auch ein JSON-Syntaxfehler landet hier
  }
}
