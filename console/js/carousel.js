// Reine Entscheidung: WELCHE Seite kommt als naechstes und WIE LANGE dauert
// es noch bis dahin. Kein DOM, keine Timer, keine Uhr -- deshalb aus der
// Closure von startConsole() (console.js) herausgezogen und hier testbar,
// waehrend der Rest des Karussells (Touch, DOM, echte Timer) dort bleibt.
//
// Beide historischen Fehler dieser Logik waren genau hier, nicht im DOM:
// einmal blieb eine Beruehrung 15 statt 60 Sekunden stehen (die Standzeit
// der sichtbaren Seite lief weiter, statt durch RESUME_MS ersetzt zu
// werden), einmal 75 statt 60 (RESUME_MS wurde zur Standzeit der Seite
// ADDIERT statt sie zu ersetzen). Gefunden hat beide Male eine Stoppuhr am
// Panel, kein Test -- weil die Entscheidung nicht erreichbar war, solange
// sie nur in der Closure lebte.

/**
 * @param {object} p
 * @param {number} p.seiteIndex  aktuell sichtbare Seite (0-basiert)
 * @param {number} p.seitenzahl  Anzahl aktiver Seiten im Karussell
 * @param {number} p.dwellMs     Standzeit der aktuell sichtbaren Seite (ms)
 * @param {number} p.resumeMs    Pause nach einer Beruehrung, bevor es weitergeht (ms)
 * @param {'automatisch'|'beruehrung'} p.ausloeser  was den naechsten Wechsel anstoesst
 * @returns {{ seiteIndex: number, inMs: number }} naechste Seite und Wartezeit bis dahin
 */
export function naechsterWechsel({ seiteIndex, seitenzahl, dwellMs, resumeMs, ausloeser }) {
  // Nach einer Beruehrung gilt IMMER genau resumeMs -- unabhaengig davon,
  // welche Standzeit die gerade sichtbare Seite hat. dwellMs faelt hier
  // absichtlich komplett heraus, es wird nicht addiert und nicht als
  // Grundlage genommen: genau das war beide Male der Fehler.
  const inMs = ausloeser === 'beruehrung' ? resumeMs : dwellMs;
  // Umlauf am Ende der Liste: nach der letzten Seite kommt wieder die erste.
  const naechsteSeite = (seiteIndex + 1) % seitenzahl;
  return { seiteIndex: naechsteSeite, inMs };
}
