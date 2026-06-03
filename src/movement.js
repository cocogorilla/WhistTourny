// Physical-table movement layer.
//
// The Wh(12) schedule fixes WHO is grouped together each round (3 columns of 4).
// It says nothing about WHERE in the room each group sits. This module assigns
// each round's 3 schedule-columns to 3 physical tables (0,1,2) so that nobody
// gets stuck at one table all night. The mapping below was found by optimizing
// the verified schedule for movement (see /tmp design exploration); spec/
// movement.spec.js pins the guarantee: no seat sits at the same physical table
// more than 2 rounds running, and everyone visits all 3 tables. This relabels
// only physical location — it never changes the partner/opponent guarantee.

import { seatColumn } from './schedule.js';

export const TABLE_COUNT = 3;

// PHYSICAL_TABLE_BY_ROUND[round][scheduleColumn] = physical table index (0..2).
export const PHYSICAL_TABLE_BY_ROUND = [
  [2, 1, 0], // R1
  [2, 0, 1], // R2
  [0, 2, 1], // R3
  [0, 1, 2], // R4
  [0, 1, 2], // R5
  [0, 2, 1], // R6
  [2, 0, 1], // R7
  [1, 2, 0], // R8
  [2, 0, 1], // R9
  [2, 0, 1], // R10
  [1, 2, 0], // R11
];

// Which physical table (0..2) a seat sits at in a given round.
export function physicalTableForSeat(roundIndex, seat) {
  const col = seatColumn(roundIndex, seat);
  const map = PHYSICAL_TABLE_BY_ROUND[roundIndex];
  if (!map) throw new Error(`no movement mapping for round ${roundIndex}`);
  return map[col];
}
