// Von allen Seiten geteilt, die einen Leerzustand haben. Die
// Nachrichtenrate laeuft weiter, auch wenn kein einziges Ziel eine
// Position sendet -- sie ist das einzige, was "nichts fliegt" von
// "Empfaenger tot" unterscheidet. Deshalb steht sie in jedem Leerzustand,
// und deshalb gehoert sie an genau eine Stelle.
export function msgRate(state) {
  const s = state && state.stats && state.stats.last1min;
  if (!s) return '—';
  const spanne = s.end - s.start;
  return spanne > 0 ? Math.round(s.messages / spanne) : '—';
}

import { letzteZielzeit } from '../data.js';

// Der Untertitel jedes Leerzustands. Zwei Aussagen, beide noetig:
// seit wann kein Ziel mehr da war, und ob der Empfaenger ueberhaupt noch
// Nachrichten sieht. Frankfurt hat ein Nachtflugverbot -- null Ziele um
// 03:00 ist richtig, nicht kaputt; genau deshalb muss die Anzeige
// "nichts fliegt" von "Empfaenger tot" unterscheidbar halten.
export function leerUntertitel(state) {
  const seit = letzteZielzeit(state);
  return (seit ? `letztes Ziel ${seit} · ` : '') + `Nachrichtenrate ${msgRate(state)} /s`;
}
