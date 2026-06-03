import { Tournament } from '../src/tournament.js';
import {
  currentPhase,
  grandsLabel,
  standingsView,
  roundProgress,
} from '../src/viewmodel.js';

const NAMES = Array.from({ length: 12 }, (_, i) => `E${i + 1}`);
const started = () => {
  const t = new Tournament();
  NAMES.forEach((n) => t.addEntrant(n));
  t.start();
  return t;
};
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
      expect(rows[0].seat).toBe(12); // highest points
      expect(rows[0].isLeader).toBe(true);
      expect(rows[1].isLeader).toBe(false);
      expect(rows[0].grandsLabel).toBe('2 (2✓)');
    });
  });

  describe('roundProgress', () => {
    it('reports entered/total, who still needs to enter, and confirmability', () => {
      const t = started();
      t.recordEntrantRound(1, twoHands(1, 'nello'));
      t.recordEntrantRound(2, twoHands(2, 'nello'));
      const p = roundProgress(t);
      expect(p.roundNumber).toBe(1);
      expect(p.entered).toBe(2);
      expect(p.total).toBe(12);
      expect(p.canConfirm).toBe(false);
      expect(p.remaining.map((e) => e.name)).not.toContain('E1');
      expect(p.remaining.map((e) => e.name)).toContain('E3');
      expect(p.remaining.length).toBe(10);
    });

    it('is confirmable once all 12 are in', () => {
      const t = started();
      for (let seat = 1; seat <= 12; seat++) {
        t.recordEntrantRound(seat, twoHands(seat, 'nello'));
      }
      const p = roundProgress(t);
      expect(p.entered).toBe(12);
      expect(p.canConfirm).toBe(true);
      expect(p.remaining.length).toBe(0);
    });
  });
});
