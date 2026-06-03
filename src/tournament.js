import { scheduleFor, playingSeats, byeSeats } from './schedule.js';
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
  return hands.map((h) => ({ points: h.points, bid: h.bid }));
}

export class Tournament {
  constructor(playerCount = 12) {
    scheduleFor(playerCount);
    this.playerCount = playerCount;
    this.status = 'setup';
    this.entrants = [];
    this.tableNames = ['Table 1', 'Table 2', 'Table 3'];
    this.currentRound = null;
    this.results = [];
    this.draft = null;
  }

  get config() {
    return scheduleFor(this.playerCount);
  }

  setPlayerCount(playerCount) {
    if (this.status !== 'setup') {
      throw new Error('can only change player count during setup');
    }
    const cfg = scheduleFor(playerCount);
    if (this.entrants.length > cfg.seatCount) {
      throw new Error(
        `already have ${this.entrants.length} entrants; remove some before switching to ${playerCount}`
      );
    }
    this.playerCount = playerCount;
  }

  addEntrant(name) {
    if (this.status !== 'setup') {
      throw new Error('can only add entrants during setup');
    }
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('entrant name cannot be empty');
    if (this.entrants.length >= this.config.seatCount) {
      throw new Error(`cannot add more than ${this.config.seatCount} entrants`);
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
    if (this.entrants.length !== this.config.seatCount) {
      throw new Error(`need exactly ${this.config.seatCount} entrants to start`);
    }
    this.entrants.forEach((e, i) => (e.seat = i + 1));
    this.status = 'running';
    this.currentRound = 0;
    this.draft = { hands: {} };
  }

  playingSeatsForRound(roundIndex) {
    return playingSeats(this.config, roundIndex);
  }

  byeSeatsForRound(roundIndex) {
    return byeSeats(this.config, roundIndex);
  }

  isPlaying(roundIndex, seat) {
    return this.playingSeatsForRound(roundIndex).includes(seat);
  }

  recordEntrantRound(seat, hands) {
    if (this.status !== 'running') {
      throw new Error('tournament is not running');
    }
    this.#entrant(seat);
    if (!this.isPlaying(this.currentRound, seat)) {
      throw new Error(`seat ${seat} is on bye this round`);
    }
    this.draft.hands[seat] = validateHands(hands);
  }

  enteredCount() {
    return this.enteredSeats().length;
  }

  enteredSeats() {
    if (this.status !== 'running' || !this.draft) return [];
    return Object.keys(this.draft.hands).map(Number);
  }

  isRoundComplete() {
    if (this.status !== 'running') return false;
    return this.enteredCount() === this.playingSeatsForRound(this.currentRound).length;
  }

  confirmRound() {
    if (this.status !== 'running') throw new Error('tournament is not running');
    if (!this.isRoundComplete()) {
      const need = this.playingSeatsForRound(this.currentRound).length;
      throw new Error(`round is not complete (need all ${need} playing entrants)`);
    }
    this.results.push({ hands: this.draft.hands });
    if (this.currentRound + 1 >= this.config.roundCount) {
      this.status = 'finished';
      this.currentRound = this.config.roundCount;
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
    if (!this.isPlaying(roundIndex, seat)) {
      throw new Error(`seat ${seat} was on bye in round ${roundIndex}`);
    }
    this.results[roundIndex].hands[seat] = validateHands(hands);
    this.results[roundIndex].edited = true;
  }

  end() {
    if (this.status !== 'running') throw new Error('tournament is not running');
    this.status = 'finished';
    this.draft = null;
  }

  seatingForRound(roundIndex) {
    return physicalSeating(this.config, roundIndex, this.entrants);
  }

  assignment(roundIndex, seat) {
    return assignmentForSeat(this.config, roundIndex, this.entrants, seat);
  }

  byeEntrants(roundIndex) {
    return this.byeSeatsForRound(roundIndex).map(
      (seat) => this.entrants.find((e) => e.seat === seat) ?? { seat, name: `Seat ${seat}` }
    );
  }

  standings() {
    return computeStandings(this.entrants, this.results);
  }

  toJSON() {
    return {
      playerCount: this.playerCount,
      status: this.status,
      entrants: this.entrants,
      tableNames: this.tableNames,
      currentRound: this.currentRound,
      results: this.results,
      draft: this.draft,
    };
  }

  static fromJSON(obj) {
    const t = new Tournament(obj.playerCount ?? 12);
    t.status = obj.status;
    t.entrants = obj.entrants ?? [];
    t.tableNames = obj.tableNames ?? ['Table 1', 'Table 2', 'Table 3'];
    t.currentRound = obj.currentRound ?? null;
    t.results = obj.results ?? [];
    t.draft = obj.draft ?? null;
    return t;
  }

  #entrant(seat) {
    const e = this.entrants.find((x) => x.seat === seat);
    if (!e) throw new Error(`no entrant at seat ${seat}`);
    return e;
  }
}
