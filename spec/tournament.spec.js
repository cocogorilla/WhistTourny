import { Tournament } from '../src/tournament.js';

const NAMES = [
  'Ethan', 'Kenny&Emily', 'Nello My Jello', 'Grandma', 'Pete', 'Joan',
  'Rick', 'Uncle Bo', 'Tina', 'Dad', 'Mo', 'Sam',
];

const fresh = () => {
  const t = new Tournament();
  NAMES.forEach((n) => t.addEntrant(n));
  return t;
};

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

describe('Tournament — setup', () => {
  it('starts in setup with no entrants', () => {
    const t = new Tournament();
    expect(t.status).toBe('setup');
    expect(t.entrants.length).toBe(0);
  });

  it('rejects empty names', () => {
    const t = fresh();
    expect(() => t.addEntrant('')).toThrowError(/name/i);
    expect(() => t.addEntrant('   ')).toThrowError(/name/i);
  });

  it('allows signing in past the default 12 format, up to the max of 16', () => {
    // Sign-in is not capped by the currently selected format — people arrive
    // first, the format is confirmed afterward.
    const t = fresh(); // 12 entrants, default 12-config
    ['Thirteen', 'Fourteen', 'Fifteen', 'Sixteen'].forEach((n) => t.addEntrant(n));
    expect(t.entrants.length).toBe(16);
    expect(() => t.addEntrant('Seventeen')).toThrowError(/16/);
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

  it('stores only normalized {points, bid} hands, stripping any extra keys', () => {
    t.recordEntrantRound(1, [
      { points: 3, bid: 'grand', note: 'sandbagged', sticky: true },
      { points: 0, bid: 'nello', foo: 1 },
    ]);
    expect(t.draft.hands[1]).toEqual([
      { points: 3, bid: 'grand' },
      { points: 0, bid: 'nello' },
    ]);
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
    expect(s[0].seat).toBe(12);
    expect(s[0].rank).toBe(1);
    expect(s[0].points).toBe(12 * 22);
  });

  it('every entrant experiences 11 DISTINCT partners (no repeats), via the seating path', () => {
    const t = fresh();
    t.start();
    for (let seat = 1; seat <= 12; seat++) {
      const partners = new Set();
      for (let r = 0; r < 11; r++) {
        partners.add(t.assignment(r, seat).partner.seat);
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
    playAndConfirmRound(t);
    t.end();
    expect(t.status).toBe('finished');
    const s = t.standings();
    s.forEach((row) => expect(row.roundsPlayed).toBe(4));
    expect(s[0].seat).toBe(12);
    expect(s[0].points).toBe(12 * 8);
  });
});

describe('Tournament — editing a confirmed round', () => {
  it('lets you correct a past round and reflects it in standings, marked edited', () => {
    const t = fresh();
    t.start();
    playAndConfirmRound(t);
    playAndConfirmRound(t);

    const before = t.standings().find((r) => r.seat === 1).points;
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
    t.recordEntrantRound(1, handsFor(1, 2));

    const restored = Tournament.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
    expect(restored.status).toBe('running');
    expect(restored.playerCount).toBe(12);
    expect(restored.currentRound).toBe(2);
    expect(restored.enteredCount()).toBe(1);
    expect(restored.entrants).toEqual(t.entrants);
    expect(restored.standings()).toEqual(t.standings());
  });
});

describe('Tournament — player-count configs', () => {
  const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
  const build = (count) => {
    const t = new Tournament(count);
    names(count).forEach((nm) => t.addEntrant(nm));
    return t;
  };

  it('rejects an unsupported player count at construction and via setPlayerCount', () => {
    expect(() => new Tournament(13)).toThrowError(/13/);
    const t = new Tournament(12);
    expect(() => t.setPlayerCount(17)).toThrowError(/17/);
  });

  it('caps the roster at the max supported count (16)', () => {
    const t = build(16);
    expect(t.entrants.length).toBe(16);
    expect(() => t.addEntrant('overflow')).toThrowError(/16/);
  });

  it('cannot start a 14-config without exactly 14 entrants', () => {
    const t = new Tournament(14);
    names(12).forEach((nm) => t.addEntrant(nm));
    expect(() => t.start()).toThrowError(/14/);
  });

  it('refuses to switch player count if the current roster is too big', () => {
    const t = build(15);
    expect(() => t.setPlayerCount(12)).toThrowError(/remove/i);
  });

  it('rejects recording (and editing) for a seat that is on bye that round', () => {
    const t = build(15);
    t.start();
    const bye = t.byeSeatsForRound(0)[0];
    expect(() => t.recordEntrantRound(bye, [{ points: 1, bid: 'nello' }, { points: 1, bid: 'nello' }]))
      .toThrowError(/bye/i);
  });

  it('completes a round once all 12 PLAYING entrants are in (byers excluded)', () => {
    const t = build(15);
    t.start();
    const playing = t.playingSeatsForRound(0);
    expect(playing.length).toBe(12);
    playing.forEach((seat, i) => {
      t.recordEntrantRound(seat, [{ points: 1, bid: 'nello' }, { points: 1, bid: 'nello' }]);
      if (i < playing.length - 1) expect(t.isRoundComplete()).toBe(false);
    });
    expect(t.isRoundComplete()).toBe(true);
  });

  for (const count of [14, 15, 16]) {
    it(`plays a full ${count}-player tournament: everyone byes exactly once`, () => {
      const t = build(count);
      t.start();
      const rounds = t.config.roundCount;
      for (let r = 0; r < rounds; r++) {
        expect(t.status).toBe('running');
        for (const seat of t.playingSeatsForRound(r)) {
          t.recordEntrantRound(seat, [{ points: seat, bid: 'nello' }, { points: seat, bid: 'nello' }]);
        }
        t.confirmRound();
      }
      expect(t.status).toBe('finished');
      const s = t.standings();
      expect(s.length).toBe(count);
      s.forEach((row) => {
        expect(row.byes).withContext(`seat ${row.seat} byes`).toBe(1);
        expect(row.roundsPlayed).withContext(`seat ${row.seat} games`).toBe(rounds - 1);
      });
    });
  }

  it('round-trips a 15-player tournament through JSON, preserving the config', () => {
    const t = build(15);
    t.start();
    for (const seat of t.playingSeatsForRound(0)) {
      t.recordEntrantRound(seat, [{ points: 2, bid: 'grand' }, { points: 0, bid: 'nello' }]);
    }
    t.confirmRound();
    const restored = Tournament.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
    expect(restored.playerCount).toBe(15);
    expect(restored.config.roundCount).toBe(5);
    expect(restored.currentRound).toBe(1);
    expect(restored.standings()).toEqual(t.standings());
  });
});

describe('Tournament — live reconfigure (drop a table)', () => {
  const TWO = [{ points: 1, bid: 'nello' }, { points: 1, bid: 'nello' }];
  const started12 = () => {
    const t = fresh(); // 12 entrants, default 12-config
    t.start();
    return t;
  };
  const playRound = (t) => {
    for (const seat of t.playingSeatsForRound(t.currentRound)) {
      t.recordEntrantRound(seat, TWO);
    }
    t.confirmRound();
  };
  const pk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const partnerCounts = (schedule) => {
    const m = new Map();
    for (const round of schedule)
      for (const tbl of round)
        for (const pair of [tbl.teamA, tbl.teamB]) m.set(pk(...pair), (m.get(pk(...pair)) ?? 0) + 1);
    return m;
  };

  it('materializes the schedule at start, isolated from the shared module config', () => {
    const t = started12();
    t.reconfigure(2); // reshape this tournament...
    expect(t.config.roundCount).not.toBe(11);
    // ...a brand-new tournament still gets the pristine 11-round 12-config.
    expect(started12().config.roundCount).toBe(11);
  });

  it('keeps played rounds intact and splices a 2-table continuation from the current round', () => {
    const t = started12();
    playRound(t);
    playRound(t);
    const round0Before = JSON.stringify(t.config.schedule[0]);

    const { added } = t.reconfigure(2);

    expect(added).toBe(10);
    expect(t.config.roundCount).toBe(12);
    expect(t.status).toBe('running');
    expect(t.currentRound).toBe(2);
    expect(JSON.stringify(t.config.schedule[0])).toBe(round0Before); // history untouched
    expect(t.config.schedule[0].length).toBe(3); // pre-drop round: 3 tables
    expect(t.config.schedule[2].length).toBe(2); // post-drop round: 2 tables
    expect(t.byeSeatsForRound(2).length).toBe(4);

    for (let r = 2; r < t.config.roundCount; r++) {
      const all = [...t.playingSeatsForRound(r), ...t.byeSeatsForRound(r)].sort((a, b) => a - b);
      expect(all).withContext(`round ${r} partition`).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    }
  });

  it('never re-pairs partners across the reshaped schedule', () => {
    const t = started12();
    playRound(t);
    playRound(t);
    t.reconfigure(2);
    partnerCounts(t.config.schedule).forEach((count, key) =>
      expect(count).withContext(`partners ${key}`).toBeLessThanOrEqual(1)
    );
  });

  it('can be played out to a finish on the reshaped schedule', () => {
    const t = started12();
    playRound(t);
    playRound(t);
    t.reconfigure(2);
    while (t.status === 'running') playRound(t);
    expect(t.status).toBe('finished');
    expect(t.results.length).toBe(12);
  });

  it('warns (added 0) without mutating when no repeat-free rounds remain', () => {
    const t = started12();
    for (let i = 0; i < 9; i++) playRound(t);
    const snapshot = JSON.stringify(t.config);

    const { added } = t.reconfigure(2);

    expect(added).toBe(0);
    expect(JSON.stringify(t.config)).toBe(snapshot); // schedule left untouched
    expect(t.status).toBe('running');
  });

  it('refuses to reconfigure outside a clean round boundary', () => {
    expect(() => new Tournament().reconfigure(2)).toThrowError(/running/i);
    const t = started12();
    t.recordEntrantRound(t.playingSeatsForRound(0)[0], TWO); // mid-entry
    expect(() => t.reconfigure(2)).toThrowError(/current round/i);
  });

  it('survives an export/import round-trip after a drop', () => {
    const t = started12();
    playRound(t);
    playRound(t);
    t.reconfigure(2);
    const restored = Tournament.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
    expect(restored.config.roundCount).toBe(12);
    expect(restored.config.schedule[2].length).toBe(2);
    expect(restored.status).toBe('running');
    expect(restored.playingSeatsForRound(2).length).toBe(8);
  });
});

describe('Tournament — format selection (4-table start)', () => {
  const TWO = [{ points: 1, bid: 'nello' }, { points: 1, bid: 'nello' }];
  const sixteen = () => {
    const t = new Tournament();
    Array.from({ length: 16 }, (_, i) => `P${i + 1}`).forEach((n) => t.addEntrant(n));
    return t;
  };
  const playRound = (t) => {
    for (const seat of t.playingSeatsForRound(t.currentRound)) t.recordEntrantRound(seat, TWO);
    t.confirmRound();
  };

  it('starts 16 players on 4 tables with no byes when the 4-table format is chosen', () => {
    const t = sixteen();
    t.setFormat('16x4');
    expect(t.config.tablesPerRound).toBe(4);
    expect(t.config.seatCount).toBe(16);
    t.start();
    expect(t.status).toBe('running');
    expect(t.playingSeatsForRound(0).length).toBe(16);
    expect(t.byeSeatsForRound(0).length).toBe(0);
  });

  it('pads table names to the format’s table count at start', () => {
    const t = sixteen();
    t.setTableNames(['North', 'South', 'East']); // only 3 named
    t.setFormat('16x4');
    t.start();
    expect(t.tableNames.length).toBe(4);
    expect(t.tableNames.slice(0, 3)).toEqual(['North', 'South', 'East']);
    expect(t.tableNames[3]).toBe('Table 4');
  });

  it('rejects an unknown format, and only allows choosing one during setup', () => {
    const t = sixteen();
    expect(() => t.setFormat('nope')).toThrowError(/format/i);
    t.setFormat('16x4');
    t.start();
    expect(() => t.setFormat('16')).toThrowError(/setup/i);
  });

  it('supports the full story: start on 4 tables, then drop to 3 mid-game', () => {
    const t = sixteen();
    t.setFormat('16x4');
    t.start();
    playRound(t);
    playRound(t);
    const { added } = t.reconfigure(3);
    expect(added).toBeGreaterThan(0);
    expect(t.config.schedule[2].length).toBe(3);
    expect(t.byeSeatsForRound(2).length).toBe(4);
    expect(t.playingSeatsForRound(2).length).toBe(12);
  });

  it('round-trips a 4-table tournament through JSON', () => {
    const t = sixteen();
    t.setFormat('16x4');
    t.start();
    const restored = Tournament.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
    expect(restored.config.tablesPerRound).toBe(4);
    expect(restored.playingSeatsForRound(0).length).toBe(16);
  });

  it('keeps people moving tables through a 4→3 drop (no doppelganger)', () => {
    const t = sixteen();
    t.setFormat('16x4');
    t.start();
    playRound(t);
    playRound(t);
    t.reconfigure(3);
    while (t.status === 'running') playRound(t);

    const cfg = t.config;
    const tableOf = (r, seat) => {
      const round = cfg.schedule[r];
      for (let c = 0; c < round.length; c++) {
        if ([...round[c].teamA, ...round[c].teamB].includes(seat)) return cfg.physicalTableByRound[r][c];
      }
      return null; // on bye
    };
    for (let seat = 1; seat <= 16; seat++) {
      const seq = cfg.schedule.map((_, r) => tableOf(r, seat));
      let best = 0;
      let cur = 0;
      let prev = null;
      for (const x of seq) {
        if (x === null) { cur = 0; prev = null; continue; }
        cur = x === prev ? cur + 1 : 1;
        prev = x;
        if (cur > best) best = cur;
      }
      expect(best).withContext(`seat ${seat} run`).toBeLessThanOrEqual(2);
    }
  });

  it('edits past rounds against each round’s true seating across a 4→3 drop', () => {
    const t = sixteen();
    t.setFormat('16x4');
    t.start();
    playRound(t); // round 0 @ 4 tables (no byes)
    playRound(t); // round 1 @ 4 tables
    t.reconfigure(3);
    playRound(t); // round 2 @ 3 tables (4 byes)

    // each played round kept its real shape
    expect(t.seatingForRound(0).length).toBe(4);
    expect(t.byeSeatsForRound(0).length).toBe(0);
    expect(t.seatingForRound(2).length).toBe(3);
    expect(t.byeSeatsForRound(2).length).toBe(4);

    // a seat that played the 4-table round can be edited there
    const seat0 = t.playingSeatsForRound(0)[0];
    t.editRound(0, seat0, [{ points: 9, bid: 'grand' }, { points: 0, bid: 'nello' }]);
    expect(t.results[0].hands[seat0][0].points).toBe(9);
    expect(t.results[0].edited).toBe(true);

    // a seat that sat out the post-drop round cannot be given scores there
    const byeSeat = t.byeSeatsForRound(2)[0];
    expect(() => t.editRound(2, byeSeat, [{ points: 1, bid: 'nello' }, { points: 1, bid: 'nello' }]))
      .toThrowError(/bye/i);
  });
});
