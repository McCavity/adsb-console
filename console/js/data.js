// Abrufschleifen. Ein fehlgeschlagener Abruf laesst die letzten Werte
// stehen und altern -- die Seite wird nie neu geladen.

async function getJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok && res.status !== 204 ? await res.json() : null;
  } catch (_) { return null; }
}

const DATA = '/skyaware/data/';
const OWN = 'data/';

// Testmodus: ?source=... zeigt die Zielquelle auf eine praeparierte Datei.
// Ohne diesen Haken laesst sich der Notfall-Squawk nicht herstellen, ohne in
// den produktiven Datenpfad /run/dump1090-fa/ zu schreiben -- und ein Pfad,
// den man nie ausloesen kann, ist unkalibriert (Spec 10.3).
const AIRCRAFT_URL =
  new URLSearchParams(location.search).get('source') || DATA + 'aircraft.json';

export function createDataStore(onUpdate) {
  const state = {
    aircraft: [], aircraftAt: null, aircraftNow: null,
    stats: null, statsAt: null,
    range: null, rangeAt: null,
    system: null, systemAt: null,
    receiver: null,
    systemVisible: false,
  };

  async function pollAircraft() {
    const d = await getJSON(AIRCRAFT_URL);
    if (d) {
      state.aircraft = d.aircraft || [];
      // now stammt vom selben Host wie der Browser -- kein Uhrenversatz.
      state.aircraftNow = d.now;
      state.aircraftAt = Date.now();
      onUpdate();
    }
  }
  async function pollStats() {
    const d = await getJSON(DATA + 'stats.json');
    if (d) { state.stats = d; state.statsAt = Date.now(); onUpdate(); }
  }
  async function pollRange() {
    const d = await getJSON(OWN + 'range.json');
    if (d) { state.range = d; state.rangeAt = Date.now(); onUpdate(); }
  }
  // Die Systemseite ist die einzige, deren Quelle einen Unterprozess kostet
  // -- also nur abrufen, solange sie sichtbar ist.
  async function pollSystem() {
    if (!state.systemVisible) return;
    const d = await getJSON(OWN + 'system.json');
    if (d) { state.system = d; state.systemAt = Date.now(); onUpdate(); }
  }

  async function start() {
    // Die gerundete Position aus receiver.json genuegt: bei 0,161 NM/px sind
    // 600 m Rundungsfehler rund zwei Pixel. Die exakte Position bleibt auf
    // dem Geraet und wird nur vom Daemon fuer die Rekorde benutzt.
    const r = await getJSON(DATA + 'receiver.json');
    if (r) state.receiver = { lat: r.lat, lon: r.lon };
    await Promise.all([pollAircraft(), pollStats(), pollRange()]);
    setInterval(pollAircraft, 1000);
    setInterval(pollStats, 5000);
    setInterval(pollRange, 60000);
    setInterval(pollSystem, 10000);
  }

  return { state, start };
}

// Alterszustand einer Quelle. Grenzen aus der Spec, Abschnitt 8.
export function ageState(ageMs) {
  if (ageMs == null) return 'stale';
  if (ageMs < 10000) return 'fresh';
  if (ageMs < 60000) return 'aging';
  return 'stale';
}
