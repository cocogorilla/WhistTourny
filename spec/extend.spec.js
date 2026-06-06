import { extendSchedule } from '../src/extend.js';

const pk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const seatsUpTo = (n) => Array.from({ length: n }, (_, i) => i + 1);

const allPairs = (result) =>
  result.rounds.flatMap((r) => r.tables.flatMap((t) => [t.teamA, t.teamB]));

const partnerCounts = (result) => {
  const m = new Map();
  for (const [a, b] of allPairs(result)) m.set(pk(a, b), (m.get(pk(a, b)) ?? 0) + 1);
  return m;
};

// Re-derive partner pairs from a list of generated rounds (for building history).
const partnersFrom = (rounds) =>
  rounds.flatMap((r) => r.tables.flatMap((t) => [t.teamA, t.teamB]));

describe('extendSchedule', () => {
  describe('shape & partition', () => {
    it('emits the requested rounds, each a clean 2v2-per-table partition with byes', () => {
      const seats = seatsUpTo(16);
      const { rounds } = extendSchedule({ seats, tables: 3, rounds: 4 });
      expect(rounds.length).toBe(4);
      rounds.forEach((round, r) => {
        expect(round.tables.length).withContext(`round ${r + 1} tables`).toBe(3);
        round.tables.forEach((t) => {
          expect(t.teamA.length).toBe(2);
          expect(t.teamB.length).toBe(2);
        });
        const playing = round.tables.flatMap((t) => [...t.teamA, ...t.teamB]);
        expect(playing.length).withContext(`round ${r + 1} playing`).toBe(12);
        expect(round.byes.length).withContext(`round ${r + 1} byes`).toBe(4);
        const all = [...playing, ...round.byes].sort((a, b) => a - b);
        expect(all).withContext(`round ${r + 1} coverage`).toEqual(seats);
      });
    });

    it('throws when seats cannot fill the tables', () => {
      expect(() => extendSchedule({ seats: seatsUpTo(11), tables: 3, rounds: 1 })).toThrowError(/seat/i);
    });
  });

  describe('no repeat partners from a clean slate', () => {
    it('keeps two fresh rounds repeat-free', () => {
      const result = extendSchedule({ seats: seatsUpTo(16), tables: 3, rounds: 2 });
      expect(result.repeats).toBe(0);
      partnerCounts(result).forEach((count, key) =>
        expect(count).withContext(`partners ${key}`).toBeLessThanOrEqual(1)
      );
    });
  });

  describe('bye balancing', () => {
    it('hands byes to the least-rested seats first (everyone byes once over 4 rounds)', () => {
      const seats = seatsUpTo(16);
      const { rounds } = extendSchedule({ seats, tables: 3, rounds: 4 });
      const byeCount = new Map(seats.map((s) => [s, 0]));
      rounds.forEach((r) => r.byes.forEach((s) => byeCount.set(s, byeCount.get(s) + 1)));
      seats.forEach((s) => expect(byeCount.get(s)).withContext(`seat ${s} byes`).toBe(1));
    });

    it('respects a head start in byeCounts — rests those who have sat out least', () => {
      // Seats 1..4 have already byed once; 5..16 never have. Next byes should avoid 1..4.
      const seats = seatsUpTo(16);
      const byeCounts = { 1: 1, 2: 1, 3: 1, 4: 1 };
      const { rounds } = extendSchedule({ seats, tables: 3, rounds: 1, byeCounts });
      expect(rounds[0].byes.some((s) => s <= 4)).toBe(false);
    });
  });

  describe('respects prior partner history', () => {
    it('never re-pairs a partnership from usedPartners when a clean round exists', () => {
      const seats = seatsUpTo(16);
      const usedPartners = [[1, 2], [3, 4], [5, 6], [7, 8]];
      const result = extendSchedule({ seats, tables: 3, rounds: 1, usedPartners });
      const used = new Set(usedPartners.map(([a, b]) => pk(a, b)));
      const reused = partnersFrom(result.rounds).filter(([a, b]) => used.has(pk(a, b)));
      expect(reused).withContext('reused historical pairs').toEqual([]);
      expect(result.repeats).toBe(0);
    });
  });

  describe('open-ended mode (no rounds given)', () => {
    it('extends as far as it can stay repeat-free, then stops', () => {
      const result = extendSchedule({ seats: seatsUpTo(16), tables: 3 });
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.repeats).toBe(0);
      partnerCounts(result).forEach((count, key) =>
        expect(count).withContext(`partners ${key}`).toBeLessThanOrEqual(1)
      );
    });
  });

  describe('scenario: live drop from 4 tables to 3', () => {
    it('continues an in-progress 16/4 tournament on 3 tables without re-pairing history', () => {
      // Two rounds already played at 4 tables (all 16 play, no byes).
      const seats = seatsUpTo(16);
      const history = extendSchedule({ seats, tables: 4, rounds: 2 });
      expect(history.rounds.every((r) => r.byes.length === 0)).toBe(true);

      const usedPartners = partnersFrom(history.rounds);
      const byeCounts = {}; // nobody byed at 4 tables

      // Host drops a table mid-tournament → continue on 3 tables.
      const cont = extendSchedule({ seats, tables: 3, rounds: 2, usedPartners, byeCounts });

      // Still a valid partition, and the first rounds after the drop reuse nothing.
      cont.rounds.forEach((round) => {
        const playing = round.tables.flatMap((t) => [...t.teamA, ...t.teamB]);
        expect(playing.length).toBe(12);
        expect(round.byes.length).toBe(4);
      });
      const used = new Set(usedPartners.map(([a, b]) => pk(a, b)));
      const reused = partnersFrom(cont.rounds).filter(([a, b]) => used.has(pk(a, b)));
      expect(reused).withContext('continuation re-paired pre-drop partners').toEqual([]);
      expect(cont.repeats).toBe(0);
    });
  });

  describe('sacrifice cleanliness gracefully', () => {
    it('still returns valid rounds (reporting repeats) when no clean round is possible', () => {
      // Only 4 seats, 1 table: after the 3 distinct partnerings (12|34, 13|24, 14|23)
      // every further pairing must repeat. Demand 4 rounds → at least one repeat.
      const seats = seatsUpTo(4);
      const usedPartners = [[1, 2], [3, 4], [1, 3], [2, 4], [1, 4], [2, 3]];
      const result = extendSchedule({ seats, tables: 1, rounds: 2, usedPartners });
      expect(result.rounds.length).toBe(2);
      result.rounds.forEach((round) => {
        const playing = round.tables.flatMap((t) => [...t.teamA, ...t.teamB]);
        expect(playing.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
      });
      expect(result.repeats).toBeGreaterThan(0);
    });
  });
});
