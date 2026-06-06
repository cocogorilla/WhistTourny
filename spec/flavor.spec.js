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
  unsupportedCountMessage,
  PRIME_ROASTS,
  nextMerleRoast,
  merleContext,
  MERLE_ROASTS,
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
      rows.flatMap((r) => r.badges).forEach((b) => expect(b.title.length).toBeGreaterThan(0));
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

    it('kennyContext recognizes the "K-Mac" alias in any case', () => {
      const results = [round({ 1: [[0, 'grand'], [0, 'grand']] })];
      expect(kennyContext([{ seat: 1, name: 'K-Mac' }], results)?.seat).toBe(1);
      expect(kennyContext([{ seat: 1, name: 'k-mac' }], results)?.seat).toBe(1);
      expect(kennyContext([{ seat: 1, name: 'K-MAC' }], results)?.seat).toBe(1);
      expect(kennyContext([{ seat: 1, name: 'Kenny' }], results)?.seat).toBe(1);
    });

    it('kennyContext is null when nobody is Kenny or K-Mac', () => {
      expect(kennyContext([{ seat: 1, name: 'Bob' }], [])).toBeNull();
    });
  });

  describe('Merle modal roast', () => {
    it('roasts a positive round and a zero round from the right bank', () => {
      expect(MERLE_ROASTS.positive).toContain(nextMerleRoast(7, [], 0));
      expect(MERLE_ROASTS.zero).toContain(nextMerleRoast(0, [], 0));
    });

    it('merleContext finds Merle and totals his latest round', () => {
      const entrants = [{ seat: 1, name: 'Merle' }, { seat: 2, name: 'Sue' }];
      const results = [round({ 1: [[3, 'grand'], [4, 'nello']] })];
      const ctx = merleContext(entrants, results);
      expect(ctx.seat).toBe(1);
      expect(ctx.roundIndex).toBe(0);
      expect(ctx.points).toBe(7);
    });

    it('merleContext matches any name containing "merle", any case', () => {
      const results = [round({ 1: [[2, 'nello'], [0, 'nello']] })];
      expect(merleContext([{ seat: 1, name: 'Uncle Merle' }], results)?.seat).toBe(1);
      expect(merleContext([{ seat: 1, name: 'MERLE Jr.' }], results)?.seat).toBe(1);
      expect(merleContext([{ seat: 1, name: 'merle&Bob' }], results)?.seat).toBe(1);
    });

    it('merleContext is null without a Merle', () => {
      expect(merleContext([{ seat: 1, name: 'Bob' }], [])).toBeNull();
    });

    it('never repeats an already-shown line', () => {
      const shown = [MERLE_ROASTS.positive[0], MERLE_ROASTS.positive[2]];
      const line = nextMerleRoast(5, shown, 1);
      expect(shown).not.toContain(line);
      expect(MERLE_ROASTS.positive).toContain(line);
    });

    it('cycles the whole bank once, then goes quiet (returns null)', () => {
      const shown = [];
      for (let i = 0; i < MERLE_ROASTS.positive.length; i++) {
        const line = nextMerleRoast(5, shown, i);
        expect(line).withContext(`pick ${i}`).not.toBeNull();
        expect(shown).not.toContain(line);
        shown.push(line);
      }
      expect(new Set(shown).size).toBe(MERLE_ROASTS.positive.length);
      expect(nextMerleRoast(5, shown, 0)).toBeNull(); // seen them all → done
    });

    it('exhausts the positive and zero banks independently', () => {
      expect(nextMerleRoast(5, [...MERLE_ROASTS.positive], 0)).toBeNull();
      expect(nextMerleRoast(0, [...MERLE_ROASTS.positive], 0)).not.toBeNull(); // zero bank untouched
    });
  });

  describe('Kenny and Merle never cross wires', () => {
    // The only real coupling is the shared findPlayerLatest lookup: each must
    // resolve to its OWN player even when both are in the roster and partnered.
    it('resolves each to its own seat/data when both played the same round (as partners)', () => {
      const entrants = [
        { seat: 1, name: 'Kenny' },
        { seat: 2, name: 'Merle' }, // Kenny's partner — shares the team score
        { seat: 3, name: 'Sue' },
        { seat: 4, name: 'Bo' },
      ];
      const results = [
        round({
          1: [[5, 'grand'], [0, 'nello']], // Kenny: his own bids
          2: [[5, 'grand'], [0, 'grand']], // Merle: shares points, different bids
          3: [[0, 'nello'], [4, 'nello']],
          4: [[0, 'nello'], [4, 'nello']],
        }),
      ];
      const k = kennyContext(entrants, results);
      const m = merleContext(entrants, results);
      expect(k.seat).toBe(1);
      expect(m.seat).toBe(2);
      expect(k.seat).not.toBe(m.seat);
      expect(k.bids).toEqual(['grand', 'nello']); // Kenny's, not Merle's
      expect(m.points).toBe(5); // Merle's round total
    });

    it('tracks each independently across rounds when one is on bye', () => {
      const entrants = [{ seat: 1, name: 'Kenny' }, { seat: 2, name: 'Merle' }];
      const results = [
        round({ 1: [[3, 'grand'], [3, 'grand']], 2: [[1, 'nello'], [1, 'nello']] }),
        round({ 1: [[7, 'nello'], [0, 'nello']] }), // Merle on bye this round
      ];
      const k = kennyContext(entrants, results);
      const m = merleContext(entrants, results);
      expect(k.roundIndex).toBe(1); // Kenny's latest = round 2
      expect(m.roundIndex).toBe(0); // Merle's latest played = round 1
      expect(m.points).toBe(2);
    });
  });

  describe('unsupportedCountMessage', () => {
    const supported = [12, 14, 15, 16];
    const primeBankFor = (n) => PRIME_ROASTS.map((t) => t.replaceAll('{n}', String(n)));

    it('roasts prime counts (13, 17) with a prime-bank line naming the count', () => {
      for (const n of [13, 17]) {
        const msg = unsupportedCountMessage(n, supported);
        expect(msg).toContain(String(n));
        expect(primeBankFor(n)).withContext(`n=${n}`).toContain(msg);
      }
    });

    it('gives non-primes a generic line with the supported sizes', () => {
      const msg = unsupportedCountMessage(9, supported);
      expect(msg).toContain('12, 14, 15, 16');
      expect(primeBankFor(9)).not.toContain(msg);
    });

    it('rotates through the bank as the seed changes', () => {
      const seen = new Set();
      for (let s = 0; s < PRIME_ROASTS.length; s++) {
        seen.add(unsupportedCountMessage(13, supported, s));
      }
      expect(seen.size).toBe(PRIME_ROASTS.length); // every prime line reachable
    });
  });
});
