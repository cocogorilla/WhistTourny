import { ROUND_COUNT, SEAT_COUNT } from '../src/schedule.js';
import {
  TABLE_COUNT,
  PHYSICAL_TABLE_BY_ROUND,
  physicalTableForSeat,
} from '../src/movement.js';

// For a seat, the sequence of physical tables (0..2) it occupies across rounds.
const seatTableSequence = (seat) =>
  Array.from({ length: ROUND_COUNT }, (_, r) => physicalTableForSeat(r, seat));

const maxRun = (seq) => {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < seq.length; i++) {
    cur = seq[i] === seq[i - 1] ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
};

describe('physical-table movement mapping', () => {
  it('has one column->table mapping per round', () => {
    expect(TABLE_COUNT).toBe(3);
    expect(PHYSICAL_TABLE_BY_ROUND.length).toBe(ROUND_COUNT);
  });

  it('maps the 3 columns to 3 distinct physical tables each round (a permutation)', () => {
    PHYSICAL_TABLE_BY_ROUND.forEach((map, r) => {
      expect([...map].sort()).withContext(`round ${r + 1}`).toEqual([0, 1, 2]);
    });
  });

  it('PREFERS MOVEMENT: no seat sits at one physical table > 2 rounds running', () => {
    for (let seat = 1; seat <= SEAT_COUNT; seat++) {
      expect(maxRun(seatTableSequence(seat)))
        .withContext(`seat ${seat} sequence ${seatTableSequence(seat)}`)
        .toBeLessThanOrEqual(2);
    }
  });

  it('sends every seat to all 3 physical tables at least once', () => {
    for (let seat = 1; seat <= SEAT_COUNT; seat++) {
      const visited = new Set(seatTableSequence(seat));
      expect(visited.size).withContext(`seat ${seat}`).toBe(3);
    }
  });

  describe('physicalTableForSeat(round, seat)', () => {
    it('returns a valid table index 0..2', () => {
      for (let r = 0; r < ROUND_COUNT; r++) {
        for (let seat = 1; seat <= SEAT_COUNT; seat++) {
          const t = physicalTableForSeat(r, seat);
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThan(TABLE_COUNT);
        }
      }
    });

    it('seats the 4 people at a physical table together (2 partnerships meet)', () => {
      // In every round, exactly 4 seats share each physical table.
      for (let r = 0; r < ROUND_COUNT; r++) {
        const byTable = new Map();
        for (let seat = 1; seat <= SEAT_COUNT; seat++) {
          const t = physicalTableForSeat(r, seat);
          byTable.set(t, (byTable.get(t) ?? 0) + 1);
        }
        for (const [, count] of byTable) {
          expect(count).withContext(`round ${r + 1}`).toBe(4);
        }
      }
    });
  });
});
