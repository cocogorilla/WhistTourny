import { SCHEDULES, playingSeats, byeSeats, formatById } from '../src/schedule.js';
import { TABLE_COUNT, physicalTableForSeat } from '../src/movement.js';

const EXPECT = {
  12: { minTablesVisited: 3 },
  14: { minTablesVisited: 3 },
  15: { minTablesVisited: 2 },
  16: { minTablesVisited: 2 },
};

const playedTableSequence = (cfg, seat) =>
  cfg.schedule.map((_, r) =>
    playingSeats(cfg, r).includes(seat) ? physicalTableForSeat(cfg, r, seat) : null
  );

const maxRunIgnoringByes = (seq) => {
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

describe('physical-table movement mapping', () => {
  for (const players of [12, 14, 15, 16]) {
    describe(`${players} players`, () => {
      const cfg = SCHEDULES[players];
      const exp = EXPECT[players];

      it('maps the 3 columns to 3 distinct physical tables each round (a permutation)', () => {
        cfg.physicalTableByRound.forEach((map, r) => {
          expect([...map].sort()).withContext(`round ${r + 1}`).toEqual([0, 1, 2]);
        });
      });

      it('returns a valid table index 0..2 for every playing seat', () => {
        for (let r = 0; r < cfg.roundCount; r++) {
          for (const seat of playingSeats(cfg, r)) {
            const t = physicalTableForSeat(cfg, r, seat);
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThan(TABLE_COUNT);
          }
        }
      });

      it('throws for a seat on bye that round', () => {
        for (let r = 0; r < cfg.roundCount; r++) {
          for (const bye of byeSeats(cfg, r)) {
            expect(() => physicalTableForSeat(cfg, r, bye)).toThrowError();
          }
        }
      });

      it('PREFERS MOVEMENT: no seat sits at one physical table > 2 rounds running', () => {
        for (let seat = 1; seat <= players; seat++) {
          const seq = playedTableSequence(cfg, seat);
          expect(maxRunIgnoringByes(seq))
            .withContext(`seat ${seat} sequence ${seq}`)
            .toBeLessThanOrEqual(2);
        }
      });

      it('sends each seat to the expected number of distinct physical tables', () => {
        for (let seat = 1; seat <= players; seat++) {
          const visited = new Set(playedTableSequence(cfg, seat).filter((x) => x !== null));
          expect(visited.size).withContext(`seat ${seat}`).toBeGreaterThanOrEqual(exp.minTablesVisited);
        }
      });

      it('seats 4 people at each occupied physical table every round', () => {
        for (let r = 0; r < cfg.roundCount; r++) {
          const byTable = new Map();
          for (const seat of playingSeats(cfg, r)) {
            const t = physicalTableForSeat(cfg, r, seat);
            byTable.set(t, (byTable.get(t) ?? 0) + 1);
          }
          expect(byTable.size).withContext(`round ${r + 1} tables used`).toBe(3);
          for (const [, count] of byTable) {
            expect(count).withContext(`round ${r + 1}`).toBe(4);
          }
        }
      });
    });
  }

  describe('16 players on 4 tables', () => {
    const cfg = formatById('16x4').config;

    it('maps the 4 columns to 4 distinct physical tables each round', () => {
      cfg.physicalTableByRound.forEach((map, r) =>
        expect([...map].sort((a, b) => a - b)).withContext(`round ${r + 1}`).toEqual([0, 1, 2, 3])
      );
    });

    it('PREFERS MOVEMENT: no seat sits at one physical table > 2 rounds running', () => {
      for (let seat = 1; seat <= 16; seat++) {
        const seq = playedTableSequence(cfg, seat);
        expect(maxRunIgnoringByes(seq)).withContext(`seat ${seat} sequence ${seq}`).toBeLessThanOrEqual(2);
      }
    });

    it('sends every seat to at least 3 of the 4 tables (no doppelganger)', () => {
      for (let seat = 1; seat <= 16; seat++) {
        const visited = new Set(playedTableSequence(cfg, seat).filter((x) => x !== null));
        expect(visited.size).withContext(`seat ${seat}`).toBeGreaterThanOrEqual(3);
      }
    });

    it('seats 4 people at each of the 4 tables every round', () => {
      for (let r = 0; r < cfg.roundCount; r++) {
        const byTable = new Map();
        for (const seat of playingSeats(cfg, r)) {
          const t = physicalTableForSeat(cfg, r, seat);
          byTable.set(t, (byTable.get(t) ?? 0) + 1);
        }
        expect(byTable.size).withContext(`round ${r + 1} tables used`).toBe(4);
        for (const [, count] of byTable) expect(count).withContext(`round ${r + 1}`).toBe(4);
      }
    });
  });
});
