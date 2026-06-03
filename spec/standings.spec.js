import { computeStandings } from '../src/standings.js';

// Build a 12-entrant roster (seats 1..12) with placeholder names.
const roster = () =>
  Array.from({ length: 12 }, (_, i) => ({ seat: i + 1, name: `E${i + 1}` }));

// Build one RoundResult from a {seat: [[pts,bid],[pts,bid]]} map. Any seat not
// listed is left unplayed for that round.
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
    // Seat 1: hand(0,nello), hand(2,nello)  -> 2 pts, 0 grands, 2 nellos
    // Seat 2: hand(3,grand), hand(6,nello)  -> 9 pts, 1 grand (1 successful), 1 nello
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

  it('ranks by total points descending', () => {
    const results = [
      round({
        1: [[1, 'nello'], [1, 'nello']], // 2
        2: [[5, 'nello'], [5, 'nello']], // 10
        3: [[3, 'nello'], [0, 'nello']], // 3
      }),
    ];
    const s = computeStandings(roster(), results);
    expect(s[0].seat).toBe(2); // 10 pts
    expect(s[1].seat).toBe(3); // 3 pts
    expect(s[2].seat).toBe(1); // 2 pts
  });

  it('breaks a points tie by SUCCESSFUL grands, then total grands (aggression)', () => {
    // All three end with 5 points.
    // Seat 1: a successful grand (grand that scored) -> wins the tie
    // Seat 2: a grand that scored 0 (attempted aggression) -> second
    // Seat 3: no grands -> last
    const results = [
      round({
        1: [[5, 'grand'], [0, 'nello']], // 5 pts, 1 grand, 1 succGrand
        2: [[0, 'grand'], [5, 'nello']], // 5 pts, 1 grand, 0 succGrand
        3: [[2, 'nello'], [3, 'nello']], // 5 pts, 0 grands
      }),
    ];
    const s = computeStandings(roster(), results);
    const order = s.slice(0, 3).map((r) => r.seat);
    expect(order).toEqual([1, 2, 3]);
  });

  it('flags a genuine tie (equal through points, succGrands, grands) and shares the rank', () => {
    // Seats 1 and 2 are identical: 5 pts, 1 grand, 1 successful grand.
    const results = [
      round({
        1: [[5, 'grand'], [0, 'nello']],
        2: [[5, 'grand'], [0, 'nello']],
      }),
    ];
    const s = computeStandings(roster(), results);
    const a = bySeat(s, 1);
    const b = bySeat(s, 2);
    expect(a.rank).toBe(b.rank); // shared rank
    expect(a.tied).toBe(true);
    expect(b.tied).toBe(true);
    // canonical fallback: lower seat renders first within the tie group
    const idxA = s.indexOf(a);
    const idxB = s.indexOf(b);
    expect(idxA).toBeLessThan(idxB);
  });

  it('uses standard competition ranking (1,2,2,4) around a tie', () => {
    const results = [
      round({
        1: [[10, 'nello'], [0, 'nello']], // 10  -> rank 1
        2: [[5, 'nello'], [0, 'nello']], // 5   -> rank 2 (tie)
        3: [[5, 'nello'], [0, 'nello']], // 5   -> rank 2 (tie)
        4: [[1, 'nello'], [0, 'nello']], // 1   -> rank 4
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
