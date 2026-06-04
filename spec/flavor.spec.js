import { computeStandings } from '../src/standings.js';
import {
  decorateStandings,
  benchQuip,
  BENCH_QUIPS,
  winnerBanner,
  tiebreakQuip,
  TIEBREAK_QUIPS,
  kennyRoastCategory,
  kennyRoastLine,
  KENNY_ROASTS,
  kennyContext,
} from '../src/flavor.js';

const round = (map) => {
  const hands = {};
  for (const [seat, two] of Object.entries(map)) {
    hands[seat] = two.map(([points, bid]) => ({ points, bid }));
  }
  return { hands };
};
const roster = (n = 4) => Array.from({ length: n }, (_, i) => ({ seat: i + 1, name: `E${i + 1}` }));

describe('flavor', () => {
  describe('decorateStandings (stat badges)', () => {
    it('flags all-grand 😤 and all-nello 🐔', () => {
      const results = [round({ 1: [[5, 'grand'], [3, 'grand']], 2: [[0, 'nello'], [0, 'nello']] })];
      const rows = decorateStandings(computeStandings(roster(4), results), results);
      const icons = (s) => rows.find((r) => r.seat === s).badges.map((b) => b.icon);
      expect(icons(1)).toContain('😤');
      expect(icons(2)).toContain('🐔');
    });

    it('flags a goose-egg 🍩 round and the biggest single-round haul 🎢', () => {
      const results = [round({ 1: [[0, 'grand'], [0, 'nello']], 2: [[9, 'grand'], [9, 'nello']] })];
      const rows = decorateStandings(computeStandings(roster(4), results), results);
      const icons = (s) => rows.find((r) => r.seat === s).badges.map((b) => b.icon);
      expect(icons(1)).toContain('🍩'); // 0 + 0 round
      expect(icons(2)).toContain('🎢'); // 18, the top single-round total
      expect(icons(1)).not.toContain('🎢');
    });
  });

  describe('benchQuip', () => {
    it('returns a quip from the bank, stable for a given round', () => {
      expect(BENCH_QUIPS).toContain(benchQuip(1));
      expect(benchQuip(3)).toBe(benchQuip(3));
    });
  });

  describe('winnerBanner', () => {
    it('tie when two share rank 1', () => {
      const rows = [
        { rank: 1, points: 5, name: 'A', grands: 0, nellos: 2 },
        { rank: 1, points: 5, name: 'B', grands: 0, nellos: 2 },
      ];
      expect(winnerBanner(rows).key).toBe('tie');
    });
    it('whisker on a one-point margin', () => {
      const rows = [
        { rank: 1, points: 10, name: 'Ann', grands: 1, nellos: 1 },
        { rank: 2, points: 9, name: 'Bo' },
      ];
      expect(winnerBanner(rows).key).toBe('whisker');
    });
    it('composite when the winner is two people', () => {
      const rows = [
        { rank: 1, points: 20, name: 'Kenny&Emily', grands: 1, nellos: 1 },
        { rank: 2, points: 5, name: 'Bo' },
      ];
      expect(winnerBanner(rows).key).toBe('composite');
    });
    it('aggressor when the winner never went nello', () => {
      const rows = [
        { rank: 1, points: 20, name: 'Ann', grands: 4, nellos: 0 },
        { rank: 2, points: 5, name: 'Bo' },
      ];
      expect(winnerBanner(rows).key).toBe('aggressor');
    });
    it('default otherwise, and the title carries the winner name', () => {
      const rows = [
        { rank: 1, points: 20, name: 'Ann', grands: 1, nellos: 3 },
        { rank: 2, points: 5, name: 'Bo' },
      ];
      const b = winnerBanner(rows);
      expect(b.key).toBe('default');
      expect(b.title).toContain('Ann');
    });
  });

  describe('tiebreakQuip', () => {
    it('returns a suggestion from the bank, deterministic', () => {
      expect(TIEBREAK_QUIPS).toContain(tiebreakQuip(0));
      expect(tiebreakQuip(7)).toBe(tiebreakQuip(7));
    });
  });

  describe('Kenny roast', () => {
    it('categorizes the round by what Kenny did', () => {
      expect(kennyRoastCategory({ bids: ['grand', 'grand'], points: [0, 0] })).toBe('big-talk');
      expect(kennyRoastCategory({ bids: ['grand', 'nello'], points: [0, 4] })).toBe('failed-grand');
      expect(kennyRoastCategory({ bids: ['nello', 'nello'], points: [3, 0] })).toBe('all-nello');
      expect(kennyRoastCategory({ bids: ['grand', 'nello'], points: [5, 0] })).toBe('mixed');
      expect(kennyRoastCategory({ bids: ['grand', 'grand'], points: [5, 2] })).toBe('lucky-grand');
    });

    it('fills {partner}, stays in the bank, and is deterministic', () => {
      const line = kennyRoastLine('failed-grand', 0, 'Sue');
      expect(line).toContain('Sue');
      expect(line).not.toContain('{partner}');
      expect(kennyRoastLine('failed-grand', 0, 'Sue')).toBe(line);
    });

    it('falls back to the meh bank for an unknown category', () => {
      expect(KENNY_ROASTS.meh).toContain(kennyRoastLine('nonsense', 0, 'Sue'));
    });

    it('kennyContext finds Kenny (case-insensitive) and his latest played round', () => {
      const entrants = [{ seat: 1, name: 'Kenny' }, { seat: 2, name: 'Sue' }];
      const results = [
        round({ 1: [[1, 'grand'], [1, 'nello']] }),
        round({ 1: [[0, 'grand'], [0, 'grand']] }),
      ];
      const ctx = kennyContext(entrants, results);
      expect(ctx.seat).toBe(1);
      expect(ctx.roundIndex).toBe(1);
      expect(ctx.bids).toEqual(['grand', 'grand']);
      expect(ctx.points).toEqual([0, 0]);
    });

    it('kennyContext is null when nobody is named Kenny', () => {
      expect(kennyContext([{ seat: 1, name: 'Bob' }], [])).toBeNull();
    });
  });
});
