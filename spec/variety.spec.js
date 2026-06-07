import { assignMovement, shuffleRounds, movementHistory } from '../src/variety.js';
import { extendSchedule } from '../src/extend.js';

const gen = (n, tables) =>
  extendSchedule({ seats: Array.from({ length: n }, (_, i) => i + 1), tables }).rounds;

const columnsOf = (round) => round.map((t) => [...t.teamA, ...t.teamB]);

const tableSeq = (rounds, maps, seat) =>
  rounds.map((round, r) => {
    const cols = columnsOf(round);
    for (let c = 0; c < cols.length; c++) if (cols[c].includes(seat)) return maps[r][c];
    return null; // on bye
  });

const maxRun = (seq) => {
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const x of seq) {
    if (x === null) { cur = 0; prev = null; continue; }
    cur = x === prev ? cur + 1 : 1;
    prev = x;
    if (cur > best) best = cur;
  }
  return best;
};

describe('variety', () => {
  describe('assignMovement', () => {
    const rounds = gen(16, 4).map((r) => r.tables);

    it('assigns a column→table permutation each round', () => {
      const maps = assignMovement(rounds, 4);
      expect(maps.length).toBe(rounds.length);
      maps.forEach((m, r) =>
        expect([...m].sort((a, b) => a - b)).withContext(`round ${r}`).toEqual([0, 1, 2, 3])
      );
    });

    it('keeps no seat at one physical table more than 2 rounds running', () => {
      const maps = assignMovement(rounds, 4);
      for (let s = 1; s <= 16; s++) {
        expect(maxRun(tableSeq(rounds, maps, s))).withContext(`seat ${s}`).toBeLessThanOrEqual(2);
      }
    });

    it('spreads every seat across multiple tables (kills the doppelganger)', () => {
      const maps = assignMovement(rounds, 4);
      for (let s = 1; s <= 16; s++) {
        const visited = new Set(tableSeq(rounds, maps, s).filter((x) => x !== null));
        expect(visited.size).withContext(`seat ${s}`).toBeGreaterThanOrEqual(3);
      }
    });

    it('is deterministic', () => {
      expect(assignMovement(rounds, 4)).toEqual(assignMovement(rounds, 4));
    });

    it('continues from prior history without a >2 run across the seam', () => {
      const head = rounds.slice(0, 2);
      const headMaps = assignMovement(head, 4);
      const tail = rounds.slice(2, 6);
      const tailMaps = assignMovement(tail, 4, movementHistory(head, headMaps));
      for (let s = 1; s <= 16; s++) {
        const seq = [...tableSeq(head, headMaps, s), ...tableSeq(tail, tailMaps, s)];
        expect(maxRun(seq)).withContext(`seat ${s} across seam`).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('shuffleRounds', () => {
    const built = gen(15, 3);
    const schedule = built.map((r) => r.tables);
    const byes = built.map((r) => r.byes);

    it('reorders rounds as a permutation, keeping each round’s byes aligned', () => {
      const out = shuffleRounds(schedule, byes, 123);
      expect(out.schedule.length).toBe(schedule.length);
      out.schedule.forEach((rd, i) => {
        const orig = schedule.findIndex((s) => JSON.stringify(s) === JSON.stringify(rd));
        expect(orig).toBeGreaterThanOrEqual(0);
        expect(out.byesByRound[i]).toEqual(byes[orig]);
      });
    });

    it('is deterministic for a given seed', () => {
      expect(shuffleRounds(schedule, byes, 7)).toEqual(shuffleRounds(schedule, byes, 7));
    });

    it('declusters back-to-back shared byes when a reorder allows it', () => {
      const table = [{ teamA: [1, 2], teamB: [3, 4] }];
      const sched = [table, table, table];
      const b = [[9], [9], [8]]; // rounds 0 and 1 both sit seat 9 — adjacent clash
      const out = shuffleRounds(sched, b, 1);
      let clash = 0;
      for (let i = 1; i < out.byesByRound.length; i++) {
        const prev = new Set(out.byesByRound[i - 1]);
        for (const s of out.byesByRound[i]) if (prev.has(s)) clash += 1;
      }
      expect(clash).toBe(0);
    });

    it('no-bye schedules just reorder (no decluster needed)', () => {
      const noBye = gen(16, 4);
      const s = noBye.map((r) => r.tables);
      const b = noBye.map((r) => r.byes);
      const out = shuffleRounds(s, b, 99);
      expect(out.schedule.length).toBe(s.length);
      out.byesByRound.forEach((x) => expect(x).toEqual([]));
    });
  });
});
