// Tournament state machine: setup -> running -> finished.
//
// Holds the roster and the per-round hand records, enforces the rules
// (exactly 12 entrants, valid hands, complete rounds before advancing), and
// derives seating + standings from the pure modules. All behavior is pinned by
// spec/tournament.spec.js.

import { ROUND_COUNT, SEAT_COUNT } from './schedule.js';
import { physicalSeating, assignmentForSeat } from './seating.js';
import { computeStandings } from './standings.js';

const VALID_BIDS = new Set(['nello', 'grand']);

function validateHands(hands) {
  if (!Array.isArray(hands) || hands.length !== 2) {
    throw new Error('a round needs exactly two hands per entrant');
  }
  for (const h of hands) {
    if (!h || typeof h.points !== 'number' || !Number.isInteger(h.points)) {
      throw new Error('hand points must be a whole number');
    }
    if (h.points < 0) {
      throw new Error('points cannot be negative');
    }
    if (!VALID_BIDS.has(h.bid)) {
      throw new Error(`invalid bid: ${h.bid} (must be nello or grand)`);
    }
  }
  // Normalize to plain hand objects.
  return hands.map((h) => ({ points: h.points, bid: h.bid }));
}

export class Tournament {
  constructor() {
    this.status = 'setup';
    this.entrants = []; // {seat, name}; seat assigned at start
    this.tableNames = ['Table 1', 'Table 2', 'Table 3'];
    this.currentRound = null; // 0-based index while running
    this.results = []; // confirmed RoundResults: {hands:{seat:[h,h]}, edited?}
    this.draft = null; // in-progress round: {hands:{seat:[h,h]}}
  }

  // -- setup ---------------------------------------------------------------
  addEntrant(name) {
    if (this.status !== 'setup') {
      throw new Error('can only add entrants during setup');
    }
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('entrant name cannot be empty');
    if (this.entrants.length >= SEAT_COUNT) {
      throw new Error(`cannot add more than ${SEAT_COUNT} entrants`);
    }
    this.entrants.push({ seat: null, name: trimmed });
  }

  renameEntrant(seat, name) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('entrant name cannot be empty');
    const e = this.#entrant(seat);
    e.name = trimmed;
  }

  setTableNames(names) {
    if (!Array.isArray(names) || names.length !== 3) {
      throw new Error('need exactly 3 table names');
    }
    this.tableNames = names.map((n, i) => (n ?? '').trim() || `Table ${i + 1}`);
  }

  start() {
    if (this.status !== 'setup') throw new Error('tournament already started');
    if (this.entrants.length !== SEAT_COUNT) {
      throw new Error(`need exactly ${SEAT_COUNT} entrants to start`);
    }
    this.entrants.forEach((e, i) => (e.seat = i + 1));
    this.status = 'running';
    this.currentRound = 0;
    this.draft = { hands: {} };
  }

  // -- recording -----------------------------------------------------------
  recordEntrantRound(seat, hands) {
    if (this.status !== 'running') {
      throw new Error('tournament is not running');
    }
    this.#entrant(seat); // validates seat exists
    this.draft.hands[seat] = validateHands(hands);
  }

  enteredCount() {
    return this.enteredSeats().length;
  }

  // Seats that have recorded both hands for the in-progress round.
  enteredSeats() {
    if (this.status !== 'running' || !this.draft) return [];
    return Object.keys(this.draft.hands).map(Number);
  }

  isRoundComplete() {
    return this.enteredCount() === SEAT_COUNT;
  }

  confirmRound() {
    if (this.status !== 'running') throw new Error('tournament is not running');
    if (!this.isRoundComplete()) {
      throw new Error('round is not complete (need all 12 entrants)');
    }
    this.results.push({ hands: this.draft.hands });
    if (this.currentRound + 1 >= ROUND_COUNT) {
      this.status = 'finished';
      this.currentRound = ROUND_COUNT;
      this.draft = null;
    } else {
      this.currentRound += 1;
      this.draft = { hands: {} };
    }
  }

  editRound(roundIndex, seat, hands) {
    if (roundIndex < 0 || roundIndex >= this.results.length) {
      throw new Error(`round ${roundIndex} has not been played yet`);
    }
    this.#entrant(seat);
    this.results[roundIndex].hands[seat] = validateHands(hands);
    this.results[roundIndex].edited = true;
  }

  end() {
    if (this.status !== 'running') throw new Error('tournament is not running');
    this.status = 'finished';
    this.draft = null;
  }

  // -- derived views -------------------------------------------------------
  seatingForRound(roundIndex) {
    return physicalSeating(roundIndex, this.entrants);
  }

  assignment(roundIndex, seat) {
    return assignmentForSeat(roundIndex, this.entrants, seat);
  }

  standings() {
    return computeStandings(this.entrants, this.results);
  }

  // -- persistence ---------------------------------------------------------
  toJSON() {
    return {
      status: this.status,
      entrants: this.entrants,
      tableNames: this.tableNames,
      currentRound: this.currentRound,
      results: this.results,
      draft: this.draft,
    };
  }

  static fromJSON(obj) {
    const t = new Tournament();
    t.status = obj.status;
    t.entrants = obj.entrants ?? [];
    t.tableNames = obj.tableNames ?? ['Table 1', 'Table 2', 'Table 3'];
    t.currentRound = obj.currentRound ?? null;
    t.results = obj.results ?? [];
    t.draft = obj.draft ?? null;
    return t;
  }

  // -- internals -----------------------------------------------------------
  #entrant(seat) {
    const e = this.entrants.find((x) => x.seat === seat);
    if (!e) throw new Error(`no entrant at seat ${seat}`);
    return e;
  }
}
