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

// Group a round's seating into 3 physical tables, each with its 4 players
// (2 per team) and their hands taken from `handsMap` (null where missing).
function buildTables(t, roundIndex, handsMap) {
  return t.seatingForRound(roundIndex).map((tbl) => {
    const players = [
      ...tbl.teamA.map((e) => ({ ...e, team: 'A' })),
      ...tbl.teamB.map((e) => ({ ...e, team: 'B' })),
    ].map((p) => ({
      seat: p.seat,
      name: p.name,
      team: p.team,
      hands: handsMap[p.seat] ?? [null, null],
    }));
    return {
      table: tbl.table,
      name: t.tableNames[tbl.table],
      players,
      done: players.every((p) => handsMap[p.seat]),
    };
  });
}

// The current (in-progress) round for by-table entry: tables from the draft,
// who's sitting out, and overall confirmability.
export function tableEntry(t) {
  const round = t.currentRound;
  const tables = buildTables(t, round, t.draft?.hands ?? {});
  return {
    roundNumber: round + 1,
    byes: t.byeEntrants(round),
    tables,
    tablesDone: tables.filter((x) => x.done).length,
    tablesTotal: tables.length,
    canConfirm: t.isRoundComplete(),
  };
}

// A confirmed round rebuilt as team tables for editing (hands from results).
export function editTables(t, roundIndex) {
  const result = t.results[roundIndex];
  return {
    roundNumber: roundIndex + 1,
    edited: !!result?.edited,
    byes: t.byeEntrants(roundIndex),
    tables: buildTables(t, roundIndex, result?.hands ?? {}),
  };
}

// Build per-seat hands for a whole table from team-level points + per-player
// bids. Both partners on a team get that team's score for each hand (only one
// team scores a hand; the other is 0); each player keeps their own bid.
export function assembleTableHands({ teamA, teamB, points, bids }) {
  const forTeam = (seats, key) =>
    seats.map((seat) => ({
      seat,
      hands: [0, 1].map((h) => ({ points: points[key][h], bid: bids[seat][h] })),
    }));
  return [...forTeam(teamA, 'A'), ...forTeam(teamB, 'B')];
}
