import { roundSeating } from './schedule.js';

const nameFor = (entrants, seat) =>
  entrants.find((e) => e.seat === seat)?.name ?? `Seat ${seat}`;

const entrant = (entrants, seat) => ({ seat, name: nameFor(entrants, seat) });

export function physicalSeating(config, roundIndex, entrants) {
  const round = roundSeating(config, roundIndex);
  const map = config.physicalTableByRound[roundIndex];
  return round
    .map((t, col) => ({
      table: map[col],
      teamA: t.teamA.map((s) => entrant(entrants, s)),
      teamB: t.teamB.map((s) => entrant(entrants, s)),
    }))
    .sort((a, b) => a.table - b.table);
}

export function assignmentForSeat(config, roundIndex, entrants, seat) {
  const round = roundSeating(config, roundIndex);
  const map = config.physicalTableByRound[roundIndex];
  for (let col = 0; col < round.length; col++) {
    const t = round[col];
    const inA = t.teamA.includes(seat);
    const inB = t.teamB.includes(seat);
    if (!inA && !inB) continue;
    const myTeam = inA ? t.teamA : t.teamB;
    const theirTeam = inA ? t.teamB : t.teamA;
    const partnerSeat = myTeam.find((s) => s !== seat);
    return {
      seat,
      name: nameFor(entrants, seat),
      physicalTable: map[col],
      partner: entrant(entrants, partnerSeat),
      opponents: theirTeam.map((s) => entrant(entrants, s)),
    };
  }
  throw new Error(`seat ${seat} not found in round ${roundIndex} (on bye?)`);
}
