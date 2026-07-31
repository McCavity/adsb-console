// Laufzeit-Ansicht: was jemand am Panel gedreht hat.
//
// Rein -- kein DOM, keine Uhr, kein Zustand ausserhalb des uebergebenen
// Objekts. Dasselbe Muster wie carousel.js, und aus demselben Grund: Die
// Entscheidung soll erreichbar sein, ohne dass jemand mit einer Stoppuhr
// vor dem Panel steht.
//
// Ausdruecklich GETRENNT von config: config ist der Bootvertrag (was
// console.json gesagt hat, von mergeConfig gehaertet), ansicht ist die
// Ueberschreibung. Wer beides in ein Objekt mischt, kann nach zwei Wochen
// nicht mehr sagen, welcher Wert woher stammt.
//
// Der Zustand lebt nur im Speicher. Der naechtliche Reload um 4:00
// (console.js) setzt ihn von selbst zurueck -- deshalb braucht es keinen
// Verfall und keine Persistenz.

export const LAYER = ['airports'];

export function erzeugeAnsicht() {
  return { stufe: null, layer: {} };
}

export function setzeStufe(z, index) {
  return { ...z, stufe: Number.isInteger(index) ? index : null };
}

export function schalteLayer(z, id, an) {
  // Unbekannte Kennung wird ignoriert statt angelegt: Sonst traegt die
  // Ansicht einen Layer, fuer den es keine Zeichenfunktion gibt -- genau
  // die Falle, die mergeConfig bei unbekannten Seitennamen schon vermeidet.
  if (!LAYER.includes(id)) return z;
  return { ...z, layer: { ...z.layer, [id]: !!an } };
}

function klemme(n, min, max) {
  return n < min ? min : (n > max ? max : n);
}

// Die einzige Frage, die Seiten stellen. Bootvertrag und Ueberschreibung
// werden hier EINMAL verrechnet und flach zurueckgegeben -- damit keine
// Seite zwei Quellen selbst gegeneinander rechnet.
export function gilt(z, config) {
  const stufen = config.radar.stufen;
  const vorgabe = stufen.findIndex(s => s.range_nm === config.radar.range_nm);
  const index = z.stufe == null
    ? (vorgabe >= 0 ? vorgabe : 0)
    : klemme(z.stufe, 0, stufen.length - 1);
  const s = stufen[index];
  return {
    stufeIndex: index,
    stufen,
    range_nm: s.range_nm,
    rings_nm: s.rings_nm,
    layer: { airports: z.layer.airports !== false },
  };
}
