import { SCHEDULES, scheduleFor } from '../src/schedule.js';

const pk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const PLAYING_PER_ROUND = 12;

const EXPECT = {
  12: { roundCount: 11, byesPerRound: 0, byesPerSeat: 0, partnerExactly: 1, opposeExactly: 2 },
  14: { roundCount: 7, byesPerRound: 2, byesPerSeat: 1, partnerMax: 1, opposeMax: 1 },
  15: { roundCount: 5, byesPerRound: 3, byesPerSeat: 1, partnerMax: 1, opposeMax: 1 },
  16: { roundCount: 4, byesPerRound: 4, byesPerSeat: 1, partnerMax: 1, opposeMax: 2 },
};

function tally(schedule) {
  const partner = new Map();
  const oppose = new Map();
  for (const round of schedule) {
    for (const t of round) {
      const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
      bump(partner, pk(t.teamA[0], t.teamA[1]));
      bump(partner, pk(t.teamB[0], t.teamB[1]));
      for (const x of t.teamA) for (const y of t.teamB) bump(oppose, pk(x, y));
    }
  }
  return { partner, oppose };
}

describe('player-count configs', () => {
  it('exposes 12, 14, 15, and 16', () => {
    expect(Object.keys(SCHEDULES).map(Number).sort((a, b) => a - b)).toEqual([12, 14, 15, 16]);
  });

  it('scheduleFor throws on an unsupported count', () => {
    expect(() => scheduleFor(13)).toThrowError(/13/);
    expect(() => scheduleFor(17)).toThrowError(/17/);
  });

  for (const players of [12, 14, 15, 16]) {
    describe(`${players} players`, () => {
      const cfg = SCHEDULES[players];
      const exp = EXPECT[players];

      it('has the expected shape and round count', () => {
        expect(cfg.players).toBe(players);
        expect(cfg.seatCount).toBe(players);
        expect(cfg.tablesPerRound).toBe(3);
        expect(cfg.roundCount).toBe(exp.roundCount);
        expect(cfg.schedule.length).toBe(exp.roundCount);
        expect(cfg.byesByRound.length).toBe(exp.roundCount);
        cfg.schedule.forEach((round, r) => {
          expect(round.length).withContext(`round ${r + 1} tables`).toBe(3);
          round.forEach((t) => {
            expect(t.teamA.length).toBe(2);
            expect(t.teamB.length).toBe(2);
          });
        });
      });

      it('seats exactly 12 players + the right number of byes each round, partitioning all seats', () => {
        cfg.schedule.forEach((round, r) => {
          const playing = round.flatMap((t) => [...t.teamA, ...t.teamB]);
          const byes = cfg.byesByRound[r];
          expect(playing.length).withContext(`round ${r + 1} playing`).toBe(PLAYING_PER_ROUND);
          expect(byes.length).withContext(`round ${r + 1} byes`).toBe(exp.byesPerRound);
          const all = [...playing, ...byes].sort((a, b) => a - b);
          const expected = Array.from({ length: players }, (_, i) => i + 1);
          expect(all).withContext(`round ${r + 1} coverage`).toEqual(expected);
        });
      });

      it('gives every seat the same number of byes (and the same number of games)', () => {
        const byeCount = Array(players + 1).fill(0);
        cfg.byesByRound.forEach((bs) => bs.forEach((s) => byeCount[s]++));
        for (let s = 1; s <= players; s++) {
          expect(byeCount[s]).withContext(`seat ${s} byes`).toBe(exp.byesPerSeat);
        }
        for (let s = 1; s <= players; s++) {
          expect(exp.roundCount - byeCount[s]).withContext(`seat ${s} games`).toBe(exp.roundCount - exp.byesPerSeat);
        }
      });

      it('HARD RULE: no pair of seats partners more than once', () => {
        const { partner } = tally(cfg.schedule);
        partner.forEach((count, key) => {
          expect(count).withContext(`partners ${key}`).toBeLessThanOrEqual(exp.partnerMax ?? exp.partnerExactly);
        });
        if (exp.partnerExactly != null) {
          for (let a = 1; a <= players; a++) {
            for (let b = a + 1; b <= players; b++) {
              expect(partner.get(pk(a, b))).withContext(`partners ${a}&${b}`).toBe(exp.partnerExactly);
            }
          }
        }
      });

      it('FAIRNESS: no pair of seats opposes more than the allowed maximum', () => {
        const { oppose } = tally(cfg.schedule);
        oppose.forEach((count, key) => {
          expect(count).withContext(`opponents ${key}`).toBeLessThanOrEqual(exp.opposeMax ?? exp.opposeExactly);
        });
        if (exp.opposeExactly != null) {
          for (let a = 1; a <= players; a++) {
            for (let b = a + 1; b <= players; b++) {
              expect(oppose.get(pk(a, b))).withContext(`opponents ${a}&${b}`).toBe(exp.opposeExactly);
            }
          }
        }
      });
    });
  }
});
