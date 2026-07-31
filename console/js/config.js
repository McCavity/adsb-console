// Konfiguration laden und haerten. Eine kaputte Datei fuehrt zu einer
// laufenden Konsole mit Vorgabewerten, niemals zu einem weissen Schirm.

export const DEFAULTS = Object.freeze({
  pages: { radar: true, board: true, target: true, stats: true,
           polar: true, profile: true, system: true },
  dwell_s: { radar: 45, default: 15 },
  radar: { range_nm: 50, rings_nm: [10, 25, 50], sweep_s: 5,
           decay_s: 6, leader_s: 60, labels: ['callsign', 'fl', 'squawk'],
           stufen: [ { range_nm: 10, rings_nm: [2, 5, 10] },
                     { range_nm: 50, rings_nm: [10, 25, 50] },
                     { range_nm: 80, rings_nm: [20, 50, 80] } ] },
  emergency: { highlight: true, interrupt_carousel: false },
});

// Reihenfolge nach dem inhaltlichen Faden, nicht nach der Bauabfolge:
// Das Radar zeigt, WO etwas ist; das Einzelziel greift den naechsten
// Kontakt von dort direkt auf; das Hoehenprofil zeigt dieselben Ziele im
// Aufriss; Polar die Reichweite darum herum. Erst danach die Listen- und
// Zustandsseiten. Am 28.07. am Panel so entschieden.
const PAGE_ORDER = ['radar', 'target', 'profile', 'polar', 'board', 'stats', 'system'];

function positiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// Eine Stufe ist nur brauchbar, wenn beide Haelften stimmen. Ringe, die
// nicht in ihre eigene Reichweite passen, werden hier schon aussortiert --
// sonst zeichnet die Radarseite spaeter ausserhalb des Kreises.
function harteStufe(roh) {
  const s = plainObject(roh);
  const range = positiveNumber(s.range_nm, null);
  if (range == null) return null;
  const ringe = Array.isArray(s.rings_nm)
    ? s.rings_nm.filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= range)
    : [];
  return ringe.length ? { range_nm: range, rings_nm: ringe.slice().sort((a, b) => a - b) } : null;
}

// Die konfigurierte Reichweite MUSS erreichbar bleiben. Wer in console.json
// 35 NM einstellt, darf sie durch die neue Stufenwahl nicht verlieren --
// eine neue Funktion, die eine bestehende Konfiguration unerreichbar macht,
// ist eine Verschlechterung, auch wenn sie mehr kann.
//
// Dieselbe Zusage gilt fuer die RINGE, und daran fehlte es bis zum
// 31.07.2026: Passte die konfigurierte Reichweite zufaellig auf eine
// eingebaute Stufe, gewann deren Ringliste, und rings_nm aus console.json
// blieb wirkungslos -- ohne Fehlermeldung. Deshalb wird die getroffene
// Stufe jetzt ERSETZT statt uebergangen.
//
// ringeAngegeben trennt dabei zwei Faelle, die sonst zusammenfielen: Die
// Vorgabeliste aus DEFAULTS ist keine Angabe aus console.json. Wer sie
// mit-ersetzen liesse, machte aus einem blossen "range_nm: 10" eine Stufe
// mit dem einzigen Ring 10 -- die 10-NM-Ansicht verloere ihr Gitter, ohne
// dass jemand danach gefragt haette.
function bauStufen(rohListe, range_nm, rings_nm, ringeAngegeben) {
  const aus = Array.isArray(rohListe)
    ? rohListe.map(harteStufe).filter(Boolean) : [];
  const liste = aus.length ? aus : DEFAULTS.radar.stufen.map(harteStufe).filter(Boolean);
  const treffer = liste.findIndex(s => s.range_nm === range_nm);
  // Passt keiner der konfigurierten Ringe in die eigene Reichweite, faellt
  // harteStufe auf null zurueck -- dann ist der Aussenring selbst der
  // sinnvolle Ersatz. Ein Radar ohne inneren Ring ist mager, aber ehrlich;
  // eine Reichweite, die man nicht mehr waehlen kann, ist ein Verlust.
  if (treffer < 0) {
    const eigen = harteStufe({ range_nm, rings_nm })
                  || harteStufe({ range_nm, rings_nm: [range_nm] });
    if (eigen) liste.push(eigen);
  } else if (ringeAngegeben) {
    // Hier NICHT auf [range_nm] ausweichen: Die getroffene Stufe hat schon
    // brauchbare Ringe. Eine Angabe, aus der keine Stufe wird (leere Liste,
    // nur Werte ueber der Reichweite), laesst sie deshalb unangetastet --
    // schlechter als vorher darf eine Angabe es nicht machen.
    const eigen = harteStufe({ range_nm, rings_nm });
    if (eigen) liste[treffer] = eigen;
  }
  return liste.sort((a, b) => a.range_nm - b.range_nm);
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
  // Wurde ueberhaupt eine eigene Ringliste angegeben? Die Antwort muss VOR
  // dem Rueckfall auf die Vorgabe feststehen -- danach sind beide Faelle
  // nicht mehr unterscheidbar (siehe bauStufen).
  const ringeAngegeben = Array.isArray(radarIn.rings_nm) &&
        radarIn.rings_nm.every(n => typeof n === 'number' && n > 0);
  const radar = {
    range_nm: positiveNumber(radarIn.range_nm, DEFAULTS.radar.range_nm),
    sweep_s: positiveNumber(radarIn.sweep_s, DEFAULTS.radar.sweep_s),
    decay_s: positiveNumber(radarIn.decay_s, DEFAULTS.radar.decay_s),
    leader_s: positiveNumber(radarIn.leader_s, DEFAULTS.radar.leader_s),
    rings_nm: ringeAngegeben ? radarIn.rings_nm.slice() : DEFAULTS.radar.rings_nm.slice(),
    labels: Array.isArray(radarIn.labels)
            ? radarIn.labels.filter(l => DEFAULTS.radar.labels.includes(l))
            : DEFAULTS.radar.labels.slice(),
    stufen: [],          // Platzhalter, wird direkt darunter gesetzt
  };
  radar.stufen = bauStufen(radarIn.stufen, radar.range_nm, radar.rings_nm, ringeAngegeben);

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
