export function currentPhase(t) {
  if (t.status === 'setup') return 'setup';
  if (t.status === 'finished') return 'finished';
  return 'round';
}

export function grandsLabel(row) {
  if (!row.grands) return '0';
  return `${row.grands} (${row.succGrands}✓)`;
}

export function standingsView(t) {
  const rows = t.standings();
  return rows.map((row) => ({
    ...row,
    grandsLabel: grandsLabel(row),
    isLeader: row.rank === 1,
  }));
}

export function confirmedRounds(t) {
  return t.results.map((r, index) => ({
    index,
    roundNumber: index + 1,
    edited: !!r.edited,
    entries: t.entrants.map((e) => {
      const hands = r.hands[e.seat] ?? [];
      return {
        seat: e.seat,
        name: e.name,
        hands,
        onBye: hands.length === 0,
        points: hands.reduce((sum, h) => sum + h.points, 0),
      };
    }),
  }));
}

export function roundProgress(t) {
  const playing = t.status === 'running' ? t.playingSeatsForRound(t.currentRound) : [];
  const playingSet = new Set(playing);
  const entered = new Set(t.enteredSeats());
  const remaining = t.entrants.filter(
    (e) => playingSet.has(e.seat) && !entered.has(e.seat)
  );
  return {
    roundNumber: (t.currentRound ?? 0) + 1,
    entered: entered.size,
    total: playing.length,
    remaining,
    canConfirm: t.isRoundComplete(),
  };
}

export function roundByes(t) {
  if (t.status !== 'running') return [];
  return t.byeEntrants(t.currentRound);
}
