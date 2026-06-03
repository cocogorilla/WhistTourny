// Seating derivation: combine the schedule (who's grouped), the movement layer
// (which physical table), and the roster (names) into display-ready assignments.

import { roundSeating } from './schedule.js';
import { PHYSICAL_TABLE_BY_ROUND } from './movement.js';

const nameFor = (entrants, seat) =>
  entrants.find((e) => e.seat === seat)?.name ?? `Seat ${seat}`;

const entrant = (entrants, seat) => ({ seat, name: nameFor(entrants, seat) });

// The 3 physical tables for a round, each as two named partnerships.
export function physicalSeating(roundIndex, entrants) {
  const round = roundSeating(roundIndex);
  const map = PHYSICAL_TABLE_BY_ROUND[roundIndex];
  return round
    .map((t, col) => ({
      table: map[col],
      teamA: t.teamA.map((s) => entrant(entrants, s)),
      teamB: t.teamB.map((s) => entrant(entrants, s)),
    }))
    .sort((a, b) => a.table - b.table);
}

// One seat's assignment: partner, opponents, and physical table.
export function assignmentForSeat(roundIndex, entrants, seat) {
  const round = roundSeating(roundIndex);
  const map = PHYSICAL_TABLE_BY_ROUND[roundIndex];
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
  throw new Error(`seat ${seat} not found in round ${roundIndex}`);
}
