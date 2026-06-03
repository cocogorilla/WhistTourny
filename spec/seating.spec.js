import { SCHEDULES, roundSeating, byeSeats } from '../src/schedule.js';
import { physicalTableForSeat } from '../src/movement.js';
import { physicalSeating, assignmentForSeat } from '../src/seating.js';

const roster = (n) =>
  Array.from({ length: n }, (_, i) => ({ seat: i + 1, name: `E${i + 1}` }));

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

describe('seating derivation', () => {
  describe('physicalSeating(config, round, entrants)', () => {
    const cfg = SCHEDULES[12];

    it('returns 3 physical tables, each with two named partnerships of 2', () => {
      const tables = physicalSeating(cfg, 0, roster(12));
      expect(tables.length).toBe(3);
      tables.forEach((t) => {
        expect(t.teamA.length).toBe(2);
        expect(t.teamB.length).toBe(2);
        [...t.teamA, ...t.teamB].forEach((e) => {
          expect(typeof e.name).toBe('string');
          expect(e.seat).toBeGreaterThanOrEqual(1);
        });
      });
    });

    it('places each table at its movement-assigned physical index', () => {
      const tables = physicalSeating(cfg, 3, roster(12));
      tables.forEach((t) => {
        [...t.teamA, ...t.teamB].forEach((e) => {
          expect(physicalTableForSeat(cfg, 3, e.seat)).toBe(t.table);
        });
      });
    });

    it('seats all 12 entrants every round, with no duplicates', () => {
      for (let r = 0; r < cfg.roundCount; r++) {
        const seats = physicalSeating(cfg, r, roster(12))
          .flatMap((t) => [...t.teamA, ...t.teamB])
          .map((e) => e.seat)
          .sort((a, b) => a - b);
        expect(seats).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      }
    });

    it('is a pure physical relabel: its partnerships are exactly the schedule\'s', () => {
      for (let r = 0; r < cfg.roundCount; r++) {
        const fromSchedule = new Set();
        roundSeating(cfg, r).forEach((tbl) => {
          fromSchedule.add(pairKey(...tbl.teamA));
          fromSchedule.add(pairKey(...tbl.teamB));
        });
        const fromPhysical = new Set();
        physicalSeating(cfg, r, roster(12)).forEach((tbl) => {
          fromPhysical.add(pairKey(tbl.teamA[0].seat, tbl.teamA[1].seat));
          fromPhysical.add(pairKey(tbl.teamB[0].seat, tbl.teamB[1].seat));
        });
        expect(fromPhysical).withContext(`round ${r + 1}`).toEqual(fromSchedule);
      }
    });

    it('seats only the 12 playing entrants in a bye config (byes are absent)', () => {
      const cfg15 = SCHEDULES[15];
      for (let r = 0; r < cfg15.roundCount; r++) {
        const seats = physicalSeating(cfg15, r, roster(15))
          .flatMap((t) => [...t.teamA, ...t.teamB])
          .map((e) => e.seat);
        expect(seats.length).withContext(`round ${r + 1}`).toBe(12);
        byeSeats(cfg15, r).forEach((b) => expect(seats).not.toContain(b));
      }
    });
  });

  describe('assignmentForSeat(config, round, entrants, seat)', () => {
    const cfg = SCHEDULES[12];

    it('gives a seat its partner, two opponents, and physical table', () => {
      const a = assignmentForSeat(cfg, 0, roster(12), 1);
      expect(a.seat).toBe(1);
      expect(a.name).toBe('E1');
      expect(a.physicalTable).toBe(physicalTableForSeat(cfg, 0, 1));
      expect(a.partner.seat).not.toBe(1);
      expect(a.opponents.length).toBe(2);
      const tableMates = new Set([
        a.partner.seat,
        ...a.opponents.map((o) => o.seat),
      ]);
      expect(tableMates.size).toBe(3);
      expect(tableMates.has(1)).toBe(false);
    });

    it('is symmetric: my partner has me as their partner', () => {
      for (let r = 0; r < cfg.roundCount; r++) {
        for (let seat = 1; seat <= 12; seat++) {
          const a = assignmentForSeat(cfg, r, roster(12), seat);
          const back = assignmentForSeat(cfg, r, roster(12), a.partner.seat);
          expect(back.partner.seat).withContext(`r${r + 1} seat ${seat}`).toBe(seat);
        }
      }
    });

    it('throws for a seat that is on bye that round', () => {
      const cfg15 = SCHEDULES[15];
      const bye = byeSeats(cfg15, 0)[0];
      expect(() => assignmentForSeat(cfg15, 0, roster(15), bye)).toThrowError(/bye|not found/i);
    });
  });
});
