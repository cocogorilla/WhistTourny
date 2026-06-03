import { Tournament } from '../src/tournament.js';
import { assignmentForSeat } from '../src/seating.js';

const NAMES = [
  'Ethan', 'Kenny&Emily', 'Nello My Jello', 'Grandma', 'Pete', 'Joan',
  'Rick', 'Uncle Bo', 'Tina', 'Dad', 'Mo', 'Sam',
];

const fresh = () => {
  const t = new Tournament();
  NAMES.forEach((n) => t.addEntrant(n));
  return t;
};

// Deterministic hands for a seat in a round: points tied to seat (so seat 12
// wins), bid alternates by round parity to exercise grand/nello counts.
const handsFor = (seat, roundIndex) => {
  const bid = roundIndex % 2 === 0 ? 'grand' : 'nello';
  return [
    { points: seat, bid },
    { points: seat, bid: bid === 'grand' ? 'nello' : 'grand' },
  ];
};

const playAndConfirmRound = (t) => {
  for (let seat = 1; seat <= 12; seat++) {
    t.recordEntrantRound(seat, handsFor(seat, t.currentRound));
  }
  t.confirmRound();
};

// --------------------------------------------------------------------------
describe('Tournament — setup', () => {
  it('starts in setup with no entrants', () => {
    const t = new Tournament();
    expect(t.status).toBe('setup');
    expect(t.entrants.length).toBe(0);
  });

  it('rejects empty names and more than 12 entrants', () => {
    const t = fresh(); // already 12
    expect(() => t.addEntrant('')).toThrowError(/name/i);
    expect(() => t.addEntrant('   ')).toThrowError(/name/i);
    expect(() => t.addEntrant('Extra')).toThrowError(/12/);
  });

  it('cannot start without exactly 12 entrants', () => {
    const t = new Tournament();
    t.addEntrant('Solo');
    expect(() => t.start()).toThrowError(/12/);
  });

  it('start() assigns seats 1..12 in order and goes running', () => {
    const t = fresh();
    t.start();
    expect(t.status).toBe('running');
    expect(t.currentRound).toBe(0);
    expect(t.entrants.map((e) => e.seat)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(t.entrants[1].name).toBe('Kenny&Emily');
  });

  it('cannot add entrants after starting', () => {
    const t = fresh();
    t.start();
    expect(() => t.addEntrant('Late')).toThrowError(/setup/i);
  });
});

describe('Tournament — recording hands', () => {
  let t;
  beforeEach(() => {
    t = fresh();
    t.start();
  });

  it('rejects recording when not running', () => {
    const s = new Tournament();
    expect(() => s.recordEntrantRound(1, handsFor(1, 0))).toThrowError(/running/i);
  });

  it('validates seat, hand count, points and bid', () => {
    expect(() => t.recordEntrantRound(99, handsFor(1, 0))).toThrowError(/seat/i);
    expect(() => t.recordEntrantRound(1, [{ points: 1, bid: 'grand' }])).toThrowError(/two hands/i);
    expect(() => t.recordEntrantRound(1, [{ points: -1, bid: 'grand' }, { points: 0, bid: 'nello' }])).toThrowError(/negative|points/i);
    expect(() => t.recordEntrantRound(1, [{ points: 1.5, bid: 'grand' }, { points: 0, bid: 'nello' }])).toThrowError(/points/i);
    expect(() => t.recordEntrantRound(1, [{ points: 1, bid: 'pass' }, { points: 0, bid: 'nello' }])).toThrowError(/bid/i);
  });

  it('tracks completeness and entered count', () => {
    expect(t.enteredCount()).toBe(0);
    expect(t.isRoundComplete()).toBe(false);
    for (let seat = 1; seat <= 11; seat++) t.recordEntrantRound(seat, handsFor(seat, 0));
    expect(t.enteredCount()).toBe(11);
    expect(t.isRoundComplete()).toBe(false);
    t.recordEntrantRound(12, handsFor(12, 0));
    expect(t.isRoundComplete()).toBe(true);
  });

  it('cannot confirm an incomplete round', () => {
    t.recordEntrantRound(1, handsFor(1, 0));
    expect(() => t.confirmRound()).toThrowError(/complete|12/i);
  });
});

describe('Tournament — full scenario (walk the model end to end)', () => {
  it('plays all 11 rounds and finishes with sensible standings', () => {
    const t = fresh();
    t.start();
    for (let r = 0; r < 11; r++) {
      expect(t.status).toBe('running');
      playAndConfirmRound(t);
    }
    expect(t.status).toBe('finished');

    const s = t.standings();
    expect(s.length).toBe(12);
    s.forEach((row) => expect(row.roundsPlayed).toBe(11));
    // seat 12 scored the most points every hand -> winner
    expect(s[0].seat).toBe(12);
    expect(s[0].rank).toBe(1);
    // each seat played 22 hands; points = seat * 22
    expect(s[0].points).toBe(12 * 22);
  });

  it('every entrant experiences 11 DISTINCT partners (no repeats), via the seating path', () => {
    const t = fresh();
    t.start();
    const entrants = t.entrants;
    for (let seat = 1; seat <= 12; seat++) {
      const partners = new Set();
      for (let r = 0; r < 11; r++) {
        partners.add(assignmentForSeat(r, entrants, seat).partner.seat);
      }
      expect(partners.size).withContext(`seat ${seat}`).toBe(11);
      expect(partners.has(seat)).toBe(false);
    }
  });

  it('supports quitting early: standings reflect only the rounds played', () => {
    const t = fresh();
    t.start();
    playAndConfirmRound(t);
    playAndConfirmRound(t);
    playAndConfirmRound(t);
    playAndConfirmRound(t); // 4 rounds
    t.end();
    expect(t.status).toBe('finished');
    const s = t.standings();
    s.forEach((row) => expect(row.roundsPlayed).toBe(4));
    expect(s[0].seat).toBe(12);
    expect(s[0].points).toBe(12 * 8); // 4 rounds * 2 hands
  });
});

describe('Tournament — editing a confirmed round', () => {
  it('lets you correct a past round and reflects it in standings, marked edited', () => {
    const t = fresh();
    t.start();
    playAndConfirmRound(t); // round 0 confirmed
    playAndConfirmRound(t); // round 1 confirmed

    const before = t.standings().find((r) => r.seat === 1).points;
    // Bump seat 1's round-0 hands way up.
    t.editRound(0, 1, [{ points: 100, bid: 'grand' }, { points: 100, bid: 'grand' }]);
    const after = t.standings().find((r) => r.seat === 1).points;

    expect(after).toBe(before - (1 + 1) + (100 + 100));
    expect(t.results[0].edited).toBe(true);
  });

  it('rejects editing a round that has not been played', () => {
    const t = fresh();
    t.start();
    expect(() => t.editRound(5, 1, handsFor(1, 5))).toThrowError(/round/i);
  });
});

describe('Tournament — backup round-trip (refresh loses nothing)', () => {
  it('serializes and restores mid-tournament state exactly', () => {
    const t = fresh();
    t.start();
    playAndConfirmRound(t);
    playAndConfirmRound(t);
    // partial third round
    t.recordEntrantRound(1, handsFor(1, 2));

    const restored = Tournament.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
    expect(restored.status).toBe('running');
    expect(restored.currentRound).toBe(2);
    expect(restored.enteredCount()).toBe(1);
    expect(restored.entrants).toEqual(t.entrants);
    expect(restored.standings()).toEqual(t.standings());
  });
});
