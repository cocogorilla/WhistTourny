import { Tournament } from '../src/tournament.js';
import {
  currentPhase,
  grandsLabel,
  standingsView,
  confirmedRounds,
  tableEntry,
  assembleTableHands,
  editTables,
} from '../src/viewmodel.js';

const NAMES = Array.from({ length: 12 }, (_, i) => `E${i + 1}`);
const started = () => {
  const t = new Tournament();
  NAMES.forEach((n) => t.addEntrant(n));
  t.start();
  return t;
};
const startedWith = (count) => {
  const t = new Tournament(count);
  Array.from({ length: count }, (_, i) => `P${i + 1}`).forEach((n) => t.addEntrant(n));
  t.start();
  return t;
};
const tableSeats = (t, tableObj) => tableObj.players.map((p) => p.seat);
const twoHands = (pts, bid) => [
  { points: pts, bid },
  { points: pts, bid },
];

describe('viewmodel', () => {
  describe('currentPhase', () => {
    it('reflects the tournament status', () => {
      const t = new Tournament();
      expect(currentPhase(t)).toBe('setup');
      NAMES.forEach((n) => t.addEntrant(n));
      t.start();
      expect(currentPhase(t)).toBe('round');
      t.end();
      expect(currentPhase(t)).toBe('finished');
    });
  });

  describe('grandsLabel', () => {
    it('shows successful grands in parentheses, or just 0', () => {
      expect(grandsLabel({ grands: 3, succGrands: 1 })).toBe('3 (1✓)');
      expect(grandsLabel({ grands: 0, succGrands: 0 })).toBe('0');
    });
  });

  describe('standingsView', () => {
    it('augments each row with a grands label and flags the leader', () => {
      const t = started();
      for (let seat = 1; seat <= 12; seat++) {
        t.recordEntrantRound(seat, twoHands(seat, 'grand'));
      }
      t.confirmRound();
      const rows = standingsView(t);
      expect(rows.length).toBe(12);
      expect(rows[0].seat).toBe(12);
      expect(rows[0].isLeader).toBe(true);
      expect(rows[1].isLeader).toBe(false);
      expect(rows[0].grandsLabel).toBe('2 (2✓)');
    });
  });

  describe('confirmedRounds', () => {
    const playRound = (t, bid = 'nello') => {
      for (let seat = 1; seat <= 12; seat++) {
        t.recordEntrantRound(seat, twoHands(seat, bid));
      }
      t.confirmRound();
    };

    it('lists only confirmed rounds, with per-entrant hands and point totals', () => {
      const t = started();
      playRound(t);
      playRound(t);
      t.recordEntrantRound(1, twoHands(1, 'grand'));

      const rounds = confirmedRounds(t);
      expect(rounds.length).toBe(2);
      expect(rounds[0].roundNumber).toBe(1);
      expect(rounds[0].edited).toBe(false);
      expect(rounds[0].entries.length).toBe(12);

      const seat3 = rounds[0].entries.find((e) => e.seat === 3);
      expect(seat3.name).toBe('E3');
      expect(seat3.points).toBe(6);
      expect(seat3.hands.length).toBe(2);
    });

    it('reflects an edit: updated points and an edited flag', () => {
      const t = started();
      playRound(t);
      t.editRound(0, 1, [
        { points: 50, bid: 'grand' },
        { points: 50, bid: 'grand' },
      ]);
      const r = confirmedRounds(t)[0];
      expect(r.edited).toBe(true);
      expect(r.entries.find((e) => e.seat === 1).points).toBe(100);
    });

    it('is empty when no round has been confirmed', () => {
      const t = started();
      expect(confirmedRounds(t)).toEqual([]);
    });
  });

  describe('tableEntry', () => {
    it('groups the current round into 3 tables of 4, with names and no byes (12)', () => {
      const v = tableEntry(started());
      expect(v.roundNumber).toBe(1);
      expect(v.tablesTotal).toBe(3);
      expect(v.byes).toEqual([]);
      v.tables.forEach((tbl) => {
        expect(tbl.players.length).toBe(4);
        expect(typeof tbl.name).toBe('string');
        expect(tbl.players.filter((p) => p.team === 'A').length).toBe(2);
        expect(tbl.players.filter((p) => p.team === 'B').length).toBe(2);
        expect(tbl.done).toBe(false);
      });
      expect(v.tablesDone).toBe(0);
      expect(v.canConfirm).toBe(false);
    });

    it('marks a table done only when all 4 of its seats are entered', () => {
      const t = started();
      const first = tableEntry(t).tables[0];
      const seats = tableSeats(t, first);
      seats.slice(0, 3).forEach((s) => t.recordEntrantRound(s, twoHands(s, 'nello')));
      expect(tableEntry(t).tables[0].done).toBe(false);
      t.recordEntrantRound(seats[3], twoHands(seats[3], 'grand'));
      const v = tableEntry(t);
      expect(v.tables[0].done).toBe(true);
      expect(v.tablesDone).toBe(1);
      expect(v.canConfirm).toBe(false);
    });

    it('prefills entered hands and leaves blanks (null) for the rest', () => {
      const t = started();
      const first = tableEntry(t).tables[0];
      const seat = first.players[0].seat;
      t.recordEntrantRound(seat, [
        { points: 4, bid: 'grand' },
        { points: 0, bid: 'nello' },
      ]);
      const v = tableEntry(t);
      const filled = v.tables[0].players.find((p) => p.seat === seat);
      const blank = v.tables[0].players.find((p) => p.seat !== seat);
      expect(filled.hands).toEqual([
        { points: 4, bid: 'grand' },
        { points: 0, bid: 'nello' },
      ]);
      expect(blank.hands).toEqual([null, null]);
    });

    it('reports byes and stays 3 tables of 4 for a 15-player round', () => {
      const v = tableEntry(startedWith(15));
      expect(v.tablesTotal).toBe(3);
      v.tables.forEach((tbl) => expect(tbl.players.length).toBe(4));
      expect(v.byes.length).toBe(3);
    });

    it('is confirmable once every table is done', () => {
      const t = started();
      for (const tbl of tableEntry(t).tables) {
        for (const seat of tableSeats(t, tbl)) {
          t.recordEntrantRound(seat, twoHands(seat, 'nello'));
        }
      }
      const v = tableEntry(t);
      expect(v.tablesDone).toBe(3);
      expect(v.canConfirm).toBe(true);
    });
  });

  describe('assembleTableHands', () => {
    it('gives both partners the team score and applies each player\'s own bids', () => {
      // Team A scored 5 then 0; Team B scored 0 then 3.
      const out = assembleTableHands({
        teamA: [1, 2],
        teamB: [3, 4],
        points: { A: [5, 0], B: [0, 3] },
        bids: {
          1: ['grand', 'nello'],
          2: ['nello', 'nello'],
          3: ['nello', 'grand'],
          4: ['grand', 'grand'],
        },
      });
      const by = (s) => out.find((r) => r.seat === s).hands;
      // partners 1 & 2 both get team A's 5 / 0, with their own bids
      expect(by(1)).toEqual([{ points: 5, bid: 'grand' }, { points: 0, bid: 'nello' }]);
      expect(by(2)).toEqual([{ points: 5, bid: 'nello' }, { points: 0, bid: 'nello' }]);
      // partners 3 & 4 both get team B's 0 / 3
      expect(by(3)).toEqual([{ points: 0, bid: 'nello' }, { points: 3, bid: 'grand' }]);
      expect(by(4)).toEqual([{ points: 0, bid: 'grand' }, { points: 3, bid: 'grand' }]);
    });

    it('returns one record per seat (all four players at the table)', () => {
      const out = assembleTableHands({
        teamA: [1, 2],
        teamB: [3, 4],
        points: { A: [0, 0], B: [0, 0] },
        bids: { 1: ['nello', 'nello'], 2: ['nello', 'nello'], 3: ['nello', 'nello'], 4: ['nello', 'nello'] },
      });
      expect(out.map((r) => r.seat).sort()).toEqual([1, 2, 3, 4]);
    });
  });

  describe('editTables', () => {
    const playRound = (t) => {
      for (const seat of t.playingSeatsForRound(t.currentRound)) {
        t.recordEntrantRound(seat, twoHands(seat, 'nello'));
      }
      t.confirmRound();
    };

    it('rebuilds a confirmed round as 3 team tables with the saved hands', () => {
      const t = started();
      playRound(t);
      const v = editTables(t, 0);
      expect(v.roundNumber).toBe(1);
      expect(v.edited).toBe(false);
      expect(v.byes).toEqual([]);
      expect(v.tables.length).toBe(3);
      v.tables.forEach((tbl) => {
        expect(tbl.players.length).toBe(4);
        tbl.players.forEach((p) => {
          expect(p.hands.length).toBe(2);
          expect(p.hands[0]).not.toBeNull(); // confirmed → real hands, not blanks
        });
      });
    });

    it('reports byes for a 15-player round and flags edits', () => {
      const t = startedWith(15);
      for (const seat of t.playingSeatsForRound(0)) {
        t.recordEntrantRound(seat, twoHands(seat, 'nello'));
      }
      t.confirmRound();
      expect(editTables(t, 0).byes.length).toBe(3);
      const seat = t.playingSeatsForRound(0)[0];
      t.editRound(0, seat, [
        { points: 9, bid: 'grand' },
        { points: 0, bid: 'nello' },
      ]);
      expect(editTables(t, 0).edited).toBe(true);
    });
  });
});
