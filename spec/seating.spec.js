import { ROUND_COUNT } from '../src/schedule.js';
import { physicalTableForSeat } from '../src/movement.js';
import { physicalSeating, assignmentForSeat } from '../src/seating.js';

const roster = () =>
  Array.from({ length: 12 }, (_, i) => ({ seat: i + 1, name: `E${i + 1}` }));

describe('seating derivation', () => {
  describe('physicalSeating(round, entrants)', () => {
    it('returns 3 physical tables, each with two named partnerships of 2', () => {
      const tables = physicalSeating(0, roster());
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
      const tables = physicalSeating(3, roster());
      tables.forEach((t) => {
        [...t.teamA, ...t.teamB].forEach((e) => {
          expect(physicalTableForSeat(3, e.seat)).toBe(t.table);
        });
      });
    });

    it('seats all 12 entrants every round, with no duplicates', () => {
      for (let r = 0; r < ROUND_COUNT; r++) {
        const seats = physicalSeating(r, roster())
          .flatMap((t) => [...t.teamA, ...t.teamB])
          .map((e) => e.seat)
          .sort((a, b) => a - b);
        expect(seats).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      }
    });
  });

  describe('assignmentForSeat(round, entrants, seat)', () => {
    it('gives a seat its partner, two opponents, and physical table', () => {
      const a = assignmentForSeat(0, roster(), 1);
      expect(a.seat).toBe(1);
      expect(a.name).toBe('E1');
      expect(a.physicalTable).toBe(physicalTableForSeat(0, 1));
      expect(a.partner.seat).not.toBe(1);
      expect(a.opponents.length).toBe(2);
      // partner + opponents are exactly the other 3 at the table
      const tableMates = new Set([
        a.partner.seat,
        ...a.opponents.map((o) => o.seat),
      ]);
      expect(tableMates.size).toBe(3);
      expect(tableMates.has(1)).toBe(false);
    });

    it('is symmetric: my partner has me as their partner', () => {
      for (let r = 0; r < ROUND_COUNT; r++) {
        for (let seat = 1; seat <= 12; seat++) {
          const a = assignmentForSeat(r, roster(), seat);
          const back = assignmentForSeat(r, roster(), a.partner.seat);
          expect(back.partner.seat).withContext(`r${r + 1} seat ${seat}`).toBe(seat);
        }
      }
    });
  });
});
