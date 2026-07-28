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
