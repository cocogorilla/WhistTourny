import {
  SCHEDULES,
  roundSeating,
  seatColumn,
  byeSeats,
  playingSeats,
} from '../src/schedule.js';

describe('schedule accessors', () => {
  describe('roundSeating(config, roundIndex)', () => {
    it('returns the round from the config schedule', () => {
      const cfg = SCHEDULES[12];
      for (let r = 0; r < cfg.roundCount; r++) {
        expect(roundSeating(cfg, r)).toEqual(cfg.schedule[r]);
      }
    });

    it('throws on an out-of-range round', () => {
      const cfg = SCHEDULES[12];
      expect(() => roundSeating(cfg, -1)).toThrowError(/round/i);
      expect(() => roundSeating(cfg, cfg.roundCount)).toThrowError(/round/i);
    });
  });

  describe('playingSeats(config, roundIndex)', () => {
    it('lists the 12 seats playing that round, excluding byes', () => {
      for (const players of [12, 14, 15]) {
        const cfg = SCHEDULES[players];
        for (let r = 0; r < cfg.roundCount; r++) {
          const playing = playingSeats(cfg, r);
          expect(playing.length).withContext(`${players}p r${r + 1}`).toBe(12);
          const byes = byeSeats(cfg, r);
          byes.forEach((b) => expect(playing).not.toContain(b));
        }
      }
    });
  });

  describe('byeSeats(config, roundIndex)', () => {
    it('returns the byes for the round (empty for 12)', () => {
      expect(byeSeats(SCHEDULES[12], 0)).toEqual([]);
      expect(byeSeats(SCHEDULES[15], 0).length).toBe(3);
      expect(byeSeats(SCHEDULES[14], 0).length).toBe(2);
    });

    it('throws on an out-of-range round', () => {
      expect(() => byeSeats(SCHEDULES[15], 5)).toThrowError(/round/i);
    });
  });

  describe('seatColumn(config, roundIndex, seat)', () => {
    it('reports which table-column (0..2) a playing seat is in', () => {
      for (const players of [12, 14, 15]) {
        const cfg = SCHEDULES[players];
        for (let r = 0; r < cfg.roundCount; r++) {
          cfg.schedule[r].forEach((t, col) => {
            for (const s of [...t.teamA, ...t.teamB]) {
              expect(seatColumn(cfg, r, s)).withContext(`${players}p r${r + 1} seat ${s}`).toBe(col);
            }
          });
        }
      }
    });

    it('throws for a seat that is on bye that round', () => {
      const cfg = SCHEDULES[15];
      const bye = byeSeats(cfg, 0)[0];
      expect(() => seatColumn(cfg, 0, bye)).toThrowError(/bye|not found/i);
    });
  });
});
