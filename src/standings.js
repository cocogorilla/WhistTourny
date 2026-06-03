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

const sameByMerit = (a, b) =>
  a.points === b.points &&
  a.succGrands === b.succGrands &&
  a.grands === b.grands;

export function computeStandings(entrants, results) {
  const completedRounds = results.length;
  const rows = entrants.map((e) => {
    const tally = tallySeat(e.seat, results);
    return {
      ...tally,
      byes: completedRounds - tally.roundsPlayed,
      name: e.name,
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.succGrands - a.succGrands ||
      b.grands - a.grands ||
      a.seat - b.seat
  );

  rows.forEach((row, i) => {
    if (i > 0 && sameByMerit(row, rows[i - 1])) {
      row.rank = rows[i - 1].rank;
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
