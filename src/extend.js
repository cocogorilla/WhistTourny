const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function bestMatch(playing, blocked) {
  let best = null;
  const pairs = [];
  const recurse = (remaining, repeats) => {
    if (best && repeats >= best.repeats) return;
    if (remaining.length === 0) {
      best = { pairs: pairs.map((p) => [...p]), repeats };
      return;
    }
    const [first, ...rest] = remaining;
    for (let i = 0; i < rest.length; i++) {
      const cand = rest[i];
      const isRepeat = blocked.has(pairKey(first, cand)) ? 1 : 0;
      pairs.push([first, cand]);
      recurse(rest.filter((_, j) => j !== i), repeats + isRepeat);
      pairs.pop();
    }
  };
  recurse(playing, 0);
  return best;
}

const chooseByes = (seats, byes, quota) =>
  [...seats]
    .sort((a, b) => byes.get(a) - byes.get(b) || a - b)
    .slice(0, quota)
    .sort((a, b) => a - b);

export function extendSchedule({ seats, tables, rounds, usedPartners = [], byeCounts = {} }) {
  const need = tables * 4;
  if (!Array.isArray(seats) || seats.length < need) {
    throw new Error(`need at least ${need} seats to fill ${tables} tables; got ${seats?.length ?? 0}`);
  }

  const quota = seats.length - need;
  const blocked = new Set(usedPartners.map(([a, b]) => pairKey(a, b)));
  const byes = new Map(seats.map((s) => [s, byeCounts[s] ?? 0]));

  const openEnded = rounds == null;
  const limit = openEnded ? Infinity : rounds;
  const out = [];
  let totalRepeats = 0;

  for (let r = 0; r < limit; r++) {
    const roundByes = chooseByes(seats, byes, quota);
    const byeSet = new Set(roundByes);
    const playing = seats.filter((s) => !byeSet.has(s));

    const match = bestMatch(playing, blocked);
    if (openEnded && match.repeats > 0) break;

    const tableList = [];
    for (let i = 0; i < match.pairs.length; i += 2) {
      tableList.push({ teamA: match.pairs[i], teamB: match.pairs[i + 1] });
    }

    match.pairs.forEach(([a, b]) => blocked.add(pairKey(a, b)));
    roundByes.forEach((s) => byes.set(s, byes.get(s) + 1));
    totalRepeats += match.repeats;
    out.push({ tables: tableList, byes: roundByes });
  }

  return { rounds: out, repeats: totalRepeats };
}
