// Standings: pure derivation of the ranked table from the roster + results.
//
// Ranking ladder (see DESIGN.md §0):
//   1. total points (desc)
//   2. successful grands  — bid === 'grand' && points > 0  (desc)
//   3. total grands (desc)
//   4. seat number (asc)  — canonical, deterministic fallback
// A tie through the first three rungs is FLAGGED (tied=true) and the tied
// entrants share a rank number, so people can settle it socially; the seat
// fallback only fixes render order. Uses standard competition ranking (1,2,2,4).

// Tally one entrant's hands across all rounds.
function tallySeat(seat, results) {
  let points = 0;
  let grands = 0;
  let succGrands = 0;
  let nellos = 0;
  let roundsPlayed = 0;
  for (const result of results) {
    const hands = result.hands?.[seat];
    if (!hands) continue;
    roundsPlayed += 1;
    for (const h of hands) {
      points += h.points;
      if (h.bid === 'grand') {
        grands += 1;
        if (h.points > 0) succGrands += 1;
      } else if (h.bid === 'nello') {
        nellos += 1;
      }
    }
  }
  return { seat, points, grands, succGrands, nellos, roundsPlayed };
}

// True when two rows are equal through the first three (meaningful) rungs.
const sameByMerit = (a, b) =>
  a.points === b.points &&
  a.succGrands === b.succGrands &&
  a.grands === b.grands;

export function computeStandings(entrants, results) {
  const rows = entrants.map((e) => ({
    ...tallySeat(e.seat, results),
    name: e.name,
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.succGrands - a.succGrands ||
      b.grands - a.grands ||
      a.seat - b.seat
  );

  // Standard competition ranking + tie flagging on the merit rungs.
  rows.forEach((row, i) => {
    if (i > 0 && sameByMerit(row, rows[i - 1])) {
      row.rank = rows[i - 1].rank; // same rank as the equal predecessor
    } else {
      row.rank = i + 1;
    }
  });
  rows.forEach((row, i) => {
    const tiedPrev = i > 0 && sameByMerit(row, rows[i - 1]);
    const tiedNext = i < rows.length - 1 && sameByMerit(row, rows[i + 1]);
    row.tied = tiedPrev || tiedNext;
  });

  return rows;
}
