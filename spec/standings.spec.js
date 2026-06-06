import { computeStandings } from '../src/standings.js';

const roster = () =>
  Array.from({ length: 12 }, (_, i) => ({ seat: i + 1, name: `E${i + 1}` }));

const round = (map) => {
  const hands = {};
  for (const [seat, two] of Object.entries(map)) {
    hands[seat] = two.map(([points, bid]) => ({ points, bid }));
  }
  return { hands };
};

const bySeat = (standings, seat) => standings.find((s) => s.seat === seat);

describe('computeStandings', () => {
  it('with no rounds played, everyone is 0 and tied at rank 1', () => {
    const s = computeStandings(roster(), []);
    expect(s.length).toBe(12);
    s.forEach((row) => {
      expect(row.points).toBe(0);
      expect(row.grands).toBe(0);
      expect(row.nellos).toBe(0);
      expect(row.roundsPlayed).toBe(0);
      expect(row.rank).toBe(1);
      expect(row.tied).toBe(true);
    });
  });

  it('sums points and counts bids per entrant across hands', () => {
    const results = [
      round({
        1: [[0, 'nello'], [2, 'nello']],
        2: [[3, 'grand'], [6, 'nello']],
      }),
    ];
    const s = computeStandings(roster(), results);
    const a = bySeat(s, 1);
    const b = bySeat(s, 2);
    expect(a.points).toBe(2);
    expect(a.grands).toBe(0);
    expect(a.nellos).toBe(2);
    expect(b.points).toBe(9);
    expect(b.grands).toBe(1);
    expect(b.succGrands).toBe(1);
    expect(b.nellos).toBe(1);
  });

  it('counts byes as completed rounds minus rounds played', () => {
    const results = [
      round({ 1: [[1, 'nello'], [1, 'nello']], 2: [[1, 'nello'], [1, 'nello']] }),
      round({ 1: [[1, 'nello'], [1, 'nello']] }),
    ];
    const s = computeStandings(roster(), results);
    expect(bySeat(s, 1).roundsPlayed).toBe(2);
    expect(bySeat(s, 1).byes).toBe(0);
    expect(bySeat(s, 2).roundsPlayed).toBe(1);
    expect(bySeat(s, 2).byes).toBe(1);
  });

  it('ranks by total points descending', () => {
    const results = [
      round({
        1: [[1, 'nello'], [1, 'nello']],
        2: [[5, 'nello'], [5, 'nello']],
        3: [[3, 'nello'], [0, 'nello']],
      }),
    ];
    const s = computeStandings(roster(), results);
    expect(s[0].seat).toBe(2);
    expect(s[1].seat).toBe(3);
    expect(s[2].seat).toBe(1);
  });

  it('breaks a points tie by SUCCESSFUL grands, then total grands (aggression)', () => {
    const results = [
      round({
        1: [[5, 'grand'], [0, 'nello']],
        2: [[0, 'grand'], [5, 'nello']],
        3: [[2, 'nello'], [3, 'nello']],
      }),
    ];
    const s = computeStandings(roster(), results);
    const order = s.slice(0, 3).map((r) => r.seat);
    expect(order).toEqual([1, 2, 3]);
  });

  it('flags a genuine tie (equal through points, succGrands, grands) and shares the rank', () => {
    const results = [
      round({
        1: [[5, 'grand'], [0, 'nello']],
        2: [[5, 'grand'], [0, 'nello']],
      }),
    ];
    const s = computeStandings(roster(), results);
    const a = bySeat(s, 1);
    const b = bySeat(s, 2);
    expect(a.rank).toBe(b.rank);
    expect(a.tied).toBe(true);
    expect(b.tied).toBe(true);
    const idxA = s.indexOf(a);
    const idxB = s.indexOf(b);
    expect(idxA).toBeLessThan(idxB);
  });

  it('reports points-per-round averaged over rounds actually played (not byes)', () => {
    const results = [
      round({ 1: [[4, 'nello'], [6, 'nello']], 2: [[3, 'nello'], [3, 'nello']] }),
      round({ 1: [[2, 'nello'], [0, 'nello']] }), // seat 2 on bye this round
    ];
    const s = computeStandings(roster(), results);
    // seat 1: 10 + 2 = 12 points over 2 rounds played => 6
    expect(bySeat(s, 1).avgPerRound).toBe(6);
    // seat 2: 6 points over 1 round played (1 bye) => 6, NOT 3
    expect(bySeat(s, 2).roundsPlayed).toBe(1);
    expect(bySeat(s, 2).avgPerRound).toBe(6);
  });

  it('avgPerRound is 0 (never NaN) when no rounds have been played', () => {
    const s = computeStandings(roster(), []);
    s.forEach((row) => expect(row.avgPerRound).toBe(0));
  });

  it('does NOT let the average change the ranking order (display-only)', () => {
    // seat 3 has a higher per-round average but fewer total points than seat 2.
    const results = [
      round({ 2: [[3, 'nello'], [2, 'nello']], 3: [[4, 'nello'], [4, 'nello']] }),
      round({ 2: [[3, 'nello'], [2, 'nello']] }), // seat 3 on bye → fewer rounds, higher avg
    ];
    const s = computeStandings(roster(), results);
    expect(bySeat(s, 2).points).toBe(10); // 5 + 5 over 2 rounds → avg 5
    expect(bySeat(s, 3).points).toBe(8); //  8 over 1 round    → avg 8
    expect(bySeat(s, 3).avgPerRound).toBeGreaterThan(bySeat(s, 2).avgPerRound);
    // ...yet seat 2 still ranks ahead of seat 3 on total points.
    expect(s.indexOf(bySeat(s, 2))).toBeLessThan(s.indexOf(bySeat(s, 3)));
  });

  it('uses standard competition ranking (1,2,2,4) around a tie', () => {
    const results = [
      round({
        1: [[10, 'nello'], [0, 'nello']],
        2: [[5, 'nello'], [0, 'nello']],
        3: [[5, 'nello'], [0, 'nello']],
        4: [[1, 'nello'], [0, 'nello']],
      }),
    ];
    const s = computeStandings(roster(), results);
    expect(bySeat(s, 1).rank).toBe(1);
    expect(bySeat(s, 2).rank).toBe(2);
    expect(bySeat(s, 3).rank).toBe(2);
    expect(bySeat(s, 4).rank).toBe(4);
    expect(bySeat(s, 2).tied).toBe(true);
    expect(bySeat(s, 1).tied).toBe(false);
  });
});
