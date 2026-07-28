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
// Erst beim Abruf ausgewertet, nicht beim Laden des Moduls: `location`
// gibt es nur im Browser. Auf Modulebene gelesen macht es jeden Node-Test
// unmoeglich, der dieses Modul auch nur mittelbar importiert -- und alle
// Seitenmodule importieren es ueber console.js. Am 27.07. genau so
// aufgetreten, als das erste Seitenmodul dazukam.
function aircraftUrl() {
  const override = typeof location === 'undefined'
    ? null
    : new URLSearchParams(location.search).get('source');
  return override || DATA + 'aircraft.json';
}

// Jedes truthy receiver.json wurde bisher ungeprueft uebernommen. Ein
// Textwert statt einer Zahl macht damit JEDE Entfernungsangabe der Konsole
// zu NaN -- lautlos, und sichtbar erst am Panel. Array wird ausdruecklich
// abgewiesen: typeof [] ist "object", und [50,9].lat ist undefined.
export function pruefeReceiver(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const { lat, lon } = doc;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  if (typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function createDataStore(onUpdate) {
  const state = {
    aircraft: [], aircraftAt: null, aircraftNow: null,
    letztesZielMs: null,
    stats: null, statsAt: null,
    range: null, rangeAt: null,
    system: null, systemAt: null,
    receiver: null,
    systemVisible: false,
  };

  async function pollAircraft() {
    const d = await getJSON(aircraftUrl());
    if (d) {
      state.aircraft = d.aircraft || [];
      // now stammt vom selben Host wie der Browser -- kein Uhrenversatz.
      state.aircraftNow = d.now;
      state.aircraftAt = Date.now();
      // Wann stand hier zuletzt ein Ziel? Der Leerzustand soll "seit wann"
      // sagen koennen, nicht nur "nichts". Frankfurt hat ein
      // Nachtflugverbot -- null Ziele um 03:00 ist richtig, nicht kaputt.
      if (state.aircraft.length) state.letztesZielMs = state.aircraftAt;
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
    state.receiver = pruefeReceiver(await getJSON(DATA + 'receiver.json'));
    await Promise.all([pollAircraft(), pollStats(), pollRange()]);
    setInterval(pollAircraft, 1000);
    setInterval(pollStats, 5000);
    setInterval(pollRange, 60000);
    setInterval(pollSystem, 10000);
  }

  // refreshSystem wird beim Betreten der Systemseite gerufen. Ohne diesen
  // Sofortabruf kaemen die ersten Daten bis zu 10 s spaet -- bei 15 s
  // Standzeit zwei Drittel der Zeit mit Gedankenstrichen.
  return { state, start, refreshSystem: pollSystem };
}

// Alterszustand einer Quelle. Grenzen aus der Spec, Abschnitt 8.
export function ageState(ageMs) {
  if (ageMs == null) return 'stale';
  if (ageMs < 10000) return 'fresh';
  if (ageMs < 60000) return 'aging';
  return 'stale';
}

// Liest keine Uhr -- der Zeitstempel kommt aus dem Zustand. Sonst waere
// die Funktion nicht testbar.
export function letzteZielzeit(state) {
  const ms = state && state.letztesZielMs;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString('de-DE',
    { hour: '2-digit', minute: '2-digit', hour12: false });
}
