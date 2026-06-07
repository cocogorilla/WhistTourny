const permutations = (arr) => {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((v, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([v, ...p]);
  });
  return out;
};

const columnsOf = (round) => round.map((t) => [...t.teamA, ...t.teamB]);

export function movementHistory(rounds, maps) {
  const lastTable = new Map();
  const run = new Map();
  rounds.forEach((round, r) => {
    const cols = columnsOf(round);
    const playing = new Set(cols.flat());
    for (const s of lastTable.keys()) {
      if (!playing.has(s)) { lastTable.set(s, null); run.set(s, 0); }
    }
    cols.forEach((seats, c) => {
      const tbl = maps[r][c];
      for (const s of seats) {
        run.set(s, tbl === lastTable.get(s) ? (run.get(s) ?? 1) + 1 : 1);
        lastTable.set(s, tbl);
      }
    });
  });
  return { lastTable, run };
}

export function assignMovement(rounds, tables, init = {}) {
  const lastTable = new Map(init.lastTable ?? []);
  const run = new Map(init.run ?? []);
  const visits = new Map();
  const perms = permutations(Array.from({ length: tables }, (_, i) => i));
  const out = [];

  for (const round of rounds) {
    const cols = columnsOf(round);
    let best = null;
    for (const perm of perms) {
      let cost = 0;
      for (let c = 0; c < cols.length; c++) {
        const tbl = perm[c];
        for (const s of cols[c]) {
          if (tbl === lastTable.get(s)) cost += (run.get(s) ?? 0) >= 2 ? 1000 : 10;
          cost += visits.get(s)?.[tbl] ?? 0;
        }
      }
      if (best === null || cost < best.cost) best = { perm, cost };
    }
    out.push([...best.perm]);

    const playing = new Set(cols.flat());
    for (const s of lastTable.keys()) {
      if (!playing.has(s)) { lastTable.set(s, null); run.set(s, 0); }
    }
    cols.forEach((seats, c) => {
      const tbl = best.perm[c];
      for (const s of seats) {
        run.set(s, tbl === lastTable.get(s) ? (run.get(s) ?? 1) + 1 : 1);
        lastTable.set(s, tbl);
        const arr = visits.get(s) ?? Array(tables).fill(0);
        arr[tbl] += 1;
        visits.set(s, arr);
      }
    });
  }
  return out;
}

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const adjacentByeClashes = (order, byes) => {
  let clashes = 0;
  for (let i = 1; i < order.length; i++) {
    const prev = new Set(byes[order[i - 1]]);
    for (const s of byes[order[i]]) if (prev.has(s)) clashes += 1;
  }
  return clashes;
};

export function shuffleRounds(schedule, byesByRound, seed) {
  const order = schedule.map((_, i) => i);
  const rng = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let clashes = adjacentByeClashes(order, byesByRound);
  let improved = clashes > 0;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length && !improved; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order];
        [cand[i], cand[j]] = [cand[j], cand[i]];
        const c = adjacentByeClashes(cand, byesByRound);
        if (c < clashes) {
          order.splice(0, order.length, ...cand);
          clashes = c;
          improved = true;
          break;
        }
      }
    }
  }

  return {
    schedule: order.map((i) => schedule[i]),
    byesByRound: order.map((i) => byesByRound[i]),
  };
}
