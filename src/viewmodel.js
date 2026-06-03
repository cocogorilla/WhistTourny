// View-model: pure helpers that turn tournament state into render-ready data.
// Keeps formatting/derivation out of the DOM layer (and under test).

export function currentPhase(t) {
  if (t.status === 'setup') return 'setup';
  if (t.status === 'finished') return 'finished';
  return 'round';
}

// "3 (1✓)" — total grands with successful ones noted; just "0" when none.
export function grandsLabel(row) {
  if (!row.grands) return '0';
  return `${row.grands} (${row.succGrands}✓)`;
}

// Standings rows + a display label and leader flag.
export function standingsView(t) {
  const rows = t.standings();
  return rows.map((row) => ({
    ...row,
    grandsLabel: grandsLabel(row),
    isLeader: row.rank === 1,
  }));
}

// Progress of the in-progress round: counts, who's missing, confirmability.
export function roundProgress(t) {
  const entered = new Set(t.enteredSeats());
  const remaining = t.entrants.filter((e) => !entered.has(e.seat));
  return {
    roundNumber: (t.currentRound ?? 0) + 1,
    entered: entered.size,
    total: t.entrants.length,
    remaining,
    canConfirm: t.isRoundComplete(),
  };
}
