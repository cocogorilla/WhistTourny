import {
  SEAT_COUNT,
  ROUND_COUNT,
  TABLES_PER_ROUND,
  schedule,
  roundSeating,
  seatColumn,
} from '../src/schedule.js';

// Helpers -------------------------------------------------------------------
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const allSeats = (round) =>
  round.flatMap((t) => [...t.teamA, ...t.teamB]);

describe('Wh(12) seating schedule', () => {
  it('has the right shape: 12 seats, 11 rounds, 3 tables/round', () => {
    expect(SEAT_COUNT).toBe(12);
    expect(ROUND_COUNT).toBe(11);
    expect(TABLES_PER_ROUND).toBe(3);
    expect(schedule.length).toBe(11);
    schedule.forEach((round) => expect(round.length).toBe(3));
  });

  it('uses every seat 1..12 exactly once per round', () => {
    schedule.forEach((round, r) => {
      const seats = allSeats(round).sort((a, b) => a - b);
      expect(seats).withContext(`round ${r + 1}`).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
    });
  });

  it('seats each table as two partnerships of two', () => {
    schedule.forEach((round) => {
      round.forEach((t) => {
        expect(t.teamA.length).toBe(2);
        expect(t.teamB.length).toBe(2);
      });
    });
  });

  it('HARD RULE: every pair of seats partners exactly once', () => {
    const partner = new Map();
    schedule.forEach((round) => {
      round.forEach((t) => {
        for (const [x, y] of [t.teamA, t.teamB]) {
          const k = pairKey(x, y);
          partner.set(k, (partner.get(k) ?? 0) + 1);
        }
      });
    });
    for (let a = 1; a <= 12; a++) {
      for (let b = a + 1; b <= 12; b++) {
        expect(partner.get(pairKey(a, b)))
          .withContext(`partners ${a}&${b}`)
          .toBe(1);
      }
    }
  });

  it('FAIRNESS: every pair of seats opposes exactly twice', () => {
    const oppose = new Map();
    schedule.forEach((round) => {
      round.forEach((t) => {
        for (const x of t.teamA) {
          for (const y of t.teamB) {
            const k = pairKey(x, y);
            oppose.set(k, (oppose.get(k) ?? 0) + 1);
          }
        }
      });
    });
    for (let a = 1; a <= 12; a++) {
      for (let b = a + 1; b <= 12; b++) {
        expect(oppose.get(pairKey(a, b)))
          .withContext(`opponents ${a}&${b}`)
          .toBe(2);
      }
    }
  });

  describe('roundSeating(roundIndex)', () => {
    it('returns the same data as schedule[roundIndex]', () => {
      for (let r = 0; r < ROUND_COUNT; r++) {
        expect(roundSeating(r)).toEqual(schedule[r]);
      }
    });

    it('throws on an out-of-range round', () => {
      expect(() => roundSeating(-1)).toThrowError(/round/i);
      expect(() => roundSeating(11)).toThrowError(/round/i);
    });
  });

  describe('seatColumn(roundIndex, seat)', () => {
    it('reports which table-column (0..2) a seat is in that round', () => {
      for (let r = 0; r < ROUND_COUNT; r++) {
        const round = schedule[r];
        round.forEach((t, col) => {
          for (const s of [...t.teamA, ...t.teamB]) {
            expect(seatColumn(r, s)).withContext(`r${r + 1} seat ${s}`).toBe(col);
          }
        });
      }
    });
  });
});
