export const TABLES_PER_ROUND = 3;

const WH12_MOD = 11;
const WH12_INF = 11;

const WH12_STARTER = [
  [[5, 1], [9, 0]],
  [[7, 8], [6, 3]],
  [[10, 4], [2, WH12_INF]],
];

const WH12_ROUND_COUNT = 11;

const toWh12Seat = (x) => (x === WH12_INF ? 12 : x + 1);

function wh12Round(r) {
  const shift = (x) => (x === WH12_INF ? WH12_INF : (x + r) % WH12_MOD);
  return WH12_STARTER.map(([teamA, teamB]) => ({
    teamA: teamA.map((x) => toWh12Seat(shift(x))),
    teamB: teamB.map((x) => toWh12Seat(shift(x))),
  }));
}

const WH12_SCHEDULE = Array.from({ length: WH12_ROUND_COUNT }, (_, r) =>
  wh12Round(r)
);

const WH12_PHYSICAL_TABLE_BY_ROUND = [
  [2, 1, 0],
  [2, 0, 1],
  [0, 2, 1],
  [0, 1, 2],
  [0, 1, 2],
  [0, 2, 1],
  [2, 0, 1],
  [1, 2, 0],
  [2, 0, 1],
  [2, 0, 1],
  [1, 2, 0],
];

const CONFIG_12 = {
  players: 12,
  seatCount: 12,
  roundCount: WH12_ROUND_COUNT,
  tablesPerRound: TABLES_PER_ROUND,
  schedule: WH12_SCHEDULE,
  byesByRound: Array.from({ length: WH12_ROUND_COUNT }, () => []),
  physicalTableByRound: WH12_PHYSICAL_TABLE_BY_ROUND,
};

const identityMovement = (rounds) =>
  Array.from({ length: rounds }, () => [0, 1, 2]);

function cyclicConfig({ players, step, rounds, byes0, starter }) {
  const shift = (seat, r) => ((seat - 1 + step * r) % players) + 1;
  const schedule = Array.from({ length: rounds }, (_, r) =>
    starter.map((t) => ({
      teamA: t.teamA.map((s) => shift(s, r)),
      teamB: t.teamB.map((s) => shift(s, r)),
    }))
  );
  const byesByRound = Array.from({ length: rounds }, (_, r) =>
    byes0.map((s) => shift(s, r)).sort((a, b) => a - b)
  );
  return {
    players,
    seatCount: players,
    roundCount: rounds,
    tablesPerRound: TABLES_PER_ROUND,
    schedule,
    byesByRound,
    physicalTableByRound: identityMovement(rounds),
  };
}

const CONFIG_15 = cyclicConfig({
  players: 15,
  step: 3,
  rounds: 5,
  byes0: [1, 2, 3],
  starter: [
    { teamA: [9, 15], teamB: [7, 11] },
    { teamA: [10, 8], teamB: [5, 4] },
    { teamA: [14, 12], teamB: [6, 13] },
  ],
});

const CONFIG_14 = cyclicConfig({
  players: 14,
  step: 2,
  rounds: 7,
  byes0: [1, 2],
  starter: [
    { teamA: [6, 7], teamB: [3, 9] },
    { teamA: [11, 12], teamB: [10, 5] },
    { teamA: [4, 14], teamB: [13, 8] },
  ],
});

export const SCHEDULES = {
  12: CONFIG_12,
  14: CONFIG_14,
  15: CONFIG_15,
};

export const SUPPORTED_COUNTS = Object.keys(SCHEDULES)
  .map(Number)
  .sort((a, b) => a - b);

export const MAX_SEATS = Math.max(...SUPPORTED_COUNTS);

export function scheduleFor(players) {
  const cfg = SCHEDULES[players];
  if (!cfg) {
    throw new Error(
      `no schedule for ${players} players (supported: ${Object.keys(SCHEDULES).join(', ')})`
    );
  }
  return cfg;
}

export function roundSeating(config, roundIndex) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= config.roundCount) {
    throw new Error(`round index out of range: ${roundIndex}`);
  }
  return config.schedule[roundIndex];
}

export function byeSeats(config, roundIndex) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= config.roundCount) {
    throw new Error(`round index out of range: ${roundIndex}`);
  }
  return config.byesByRound[roundIndex];
}

export function playingSeats(config, roundIndex) {
  return roundSeating(config, roundIndex).flatMap((t) => [...t.teamA, ...t.teamB]);
}

export function seatColumn(config, roundIndex, seat) {
  const round = roundSeating(config, roundIndex);
  for (let col = 0; col < round.length; col++) {
    const t = round[col];
    if (t.teamA.includes(seat) || t.teamB.includes(seat)) return col;
  }
  throw new Error(`seat ${seat} not found in round ${roundIndex} (on bye?)`);
}
