import { seatColumn } from './schedule.js';

export const TABLE_COUNT = 3;

export function physicalTableForSeat(config, roundIndex, seat) {
  const col = seatColumn(config, roundIndex, seat);
  const map = config.physicalTableByRound[roundIndex];
  if (!map) throw new Error(`no movement mapping for round ${roundIndex}`);
  return map[col];
}
