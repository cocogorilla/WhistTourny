// Wh(12) whist-tournament seating schedule.
//
// 12 seats, 11 rounds, 3 tables/round, two-vs-two. Guarantees (verified by
// spec/schedule.spec.js): every pair of seats partners exactly once and opposes
// exactly twice. We generate it by cyclically developing a single verified
// "starter" round over Z_11 with one fixed "infinity" point — the classic
// construction — rather than hand-typing 11 rounds of magic numbers.

export const SEAT_COUNT = 12;
export const ROUND_COUNT = 11;
export const TABLES_PER_ROUND = 3;

const MOD = 11; // finite points 0..10
const INF = 11; // the fixed point

// Verified starter (0-based points; INF = 11). Each table is [[p1,p2],[p3,p4]].
const STARTER = [
  [[5, 1], [9, 0]],
  [[7, 8], [6, 3]],
  [[10, 4], [2, INF]],
];

// Map an internal point (0..10 or INF) to a friendly seat number 1..12.
const toSeat = (x) => (x === INF ? 12 : x + 1);

// Develop the starter for a given round, returning friendly-seat tables.
function developRound(r) {
  const shift = (x) => (x === INF ? INF : (x + r) % MOD);
  return STARTER.map(([teamA, teamB]) => ({
    teamA: teamA.map((x) => toSeat(shift(x))),
    teamB: teamB.map((x) => toSeat(shift(x))),
  }));
}

export const schedule = Array.from({ length: ROUND_COUNT }, (_, r) =>
  developRound(r)
);

export function roundSeating(roundIndex) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= ROUND_COUNT) {
    throw new Error(`round index out of range: ${roundIndex}`);
  }
  return schedule[roundIndex];
}

// Which table-column (0..2) a seat sits in during a round.
export function seatColumn(roundIndex, seat) {
  const round = roundSeating(roundIndex);
  for (let col = 0; col < round.length; col++) {
    const t = round[col];
    if (t.teamA.includes(seat) || t.teamB.includes(seat)) return col;
  }
  throw new Error(`seat ${seat} not found in round ${roundIndex}`);
}
