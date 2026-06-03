# Whist Tournament App — Design Doc

_Draft v0.1 — 2026-06-02_

A small web app to run a family whist tournament: set up entrants, assign
seats round-to-round so everyone partners everyone, record scores and two
per-entrant stats (grands, nellos), and show standings.

---

## 0. Locked decisions (the things we already settled)

- **Format is custom.** 3 tables × 4 players = **12 seats**. Two-vs-two whist.
  1 round = 2 hands dealt (so each team deals once).
- **Hard-lock to 12 seats.** No 8/16 variants for v1; we collapse extra humans
  into composite entrants instead (see below). Building 8/16 later is cheap if
  we ever want it (just more precomputed schedule tables + a setup dropdown).
- **The app's unit is the _Entrant_ (scoring unit), not the human.** An entrant
  occupies one of the 12 seats and owns one score + one stat line. An entrant
  may be one person or a collapsed group ("Kenny&Emily", "Nello My Jello").
  Who physically sits each round is decided socially, off-app.
  - Consequence 1: the "everyone partners everyone" guarantee is at the **seat
    level**. Members of a composite entrant never partner each other and share
    one partner-history. (Intended.)
  - Consequence 2: stats attach to the **entrant/seat**, not the human. If two
    members each grand in different rounds, the entrant has 2 grands. (Intended.)
  - The app does **not** model individual humans at all — just 12 named entrants.
- **Seating engine is solved.** The round-to-round assignment is a precomputed
  **Wh(12) whist tournament** (see §4). Verified: over 11 rounds every pair of
  seats partners **exactly once** and opposes **exactly twice**. No runtime
  solver, no risk of painting into a corner.
- **One device, no backend** (the user's Mac, in Chrome). No accounts, no auth,
  no network dependency.
- **Interaction model: a self-service "scorekeeper station."** The laptop is a
  shared kiosk that lives on a side table. People walk up and **sign themselves
  in** (type their own / composite name), then after each round **tap their own
  name and enter their two hands.** The host can enter on anyone's behalf — it's
  the same flow — so "host-operated" is just a special case, not a separate mode.
  No phones/multi-device (that alone would force a backend + wifi dependency).
  → score entry is **per-entrant cards** ("you, your two hands, done"), with a
  glanceable "X of 12 entered this round" board so the event self-regulates.
- **Soft preference: prefer movement.** Alongside the hard no-repeat-partner
  rule, people shouldn't get stuck at one physical table all night. The Wh(12)
  schedule fixes *who's grouped*, not *where they sit*, so a separate precomputed
  per-round mapping (schedule column → physical table) is optimized so **no
  entrant sits at the same physical table more than 2 rounds running**, with
  visits spread across all 3 tables. This never affects the partner guarantee.
  (The naive identity mapping pins one seat to a single table for all 11 rounds —
  the exact problem this fixes.) Implies the app **names the physical tables**
  (e.g. host labels them "Kitchen / Dining / Porch") and tells each entrant where
  to go each round. Optional finer movement: rotate chairs within a table too.
- **Scoring is per-hand, not per-round.** Because partners change every round,
  there is no team standing — each entrant tracks their own running total.
  - A round = **2 hands**. For each entrant each round, the host enters **two
    hand records**.
  - A hand record = **points** (a whole number the table computed — the app just
    stores it) + the **bid** the entrant committed to that hand, which is always
    exactly one of `nello` | `grand`. **There is no "pass"/"normal" bid** — every
    hand is a forced nello-or-grand choice.
  - The app **never derives points from the bid** (the "double value"/penalty
    math is done by humans at the table). Bid is stored as a stat + the basis for
    tiebreaking.
  - Standings are pure sums over all hands played: **total points**, **# grands**,
    **# nellos**, rounds played. (Because every hand is a choice,
    `grands + nellos = hands played` for every entrant.)
  - **Ranking ladder** (rewards aggression; no score-derived tiebreak is truly
    foolproof, so the last rung is canonical and the UI flags unresolved ties):
    1. total points (desc)
    2. successful grands — `bid == grand && points > 0` (desc); aggression that paid off
    3. total grands (desc); aggression attempted
    4. seat number (asc) — deterministic final fallback
    A genuine tie (even through rung 3) is **shown on screen** (shared rank +
    flag) so people can settle it socially; rung 4 only fixes render order.
  - Points are always **≥ 0** — when you lose a hand the other team scores; you
    never go backward. Input rejects negatives.

---

## 1. End-to-end story (large-scale acceptance criteria)

**Setup / sign-up.** The laptop sits out as a shared station. The host names the
three physical tables (e.g. "Kitchen / Dining / Porch"). As people arrive they
walk up and **add themselves** — typing their own name, or a composite like
"Kenny&Emily" (free text, funny names encouraged). Fewer humans than 12 isn't
supported in v1; more than 12 collapse into composite entrants. When 12 are in,
anyone hits **Start**, which freezes the roster to 12 seats and reveals Round 1.

> _Accepts:_ Can't start with ≠ 12 entrants. Names editable up until Start.
> After Start, the seat→entrant mapping is fixed for the tournament.

**A round.** The station shows each entrant's assignment in plain language —
*"Round 3: go to the Porch with Joan, against Rick & Nello My Jello."* People go
play their 2 hands. Afterward they drift back, **tap their own name, and enter
their two hands** — each hand = points + the bid they made (`nello` or `grand`,
required). The host can enter on anyone's behalf (same flow). A board shows
"X of 12 entered"; when all 12 are in, the round advances.

> _Accepts:_ A round isn't complete until all 12 entrants have both hands
> entered with points and a nello/grand bid. Anyone can re-open and correct a
> completed round (with a visible "edited" affordance) — family events
> fat-finger scores. Physical-table names come from the optimized movement
> mapping so nobody is stuck at one table > 2 rounds running.

**Progression.** On confirming a round, the app advances to the next round's
seating (straight from the precomputed schedule — no computation, no failure
mode). Standings update live: total score, grand count, nello count, rounds
played, per entrant, sorted.

> _Accepts:_ Advancing never produces a repeat partnership. Standings are always
> viewable mid-tournament, not just at the end.

**Quitting early.** The tournament can end at any round (people get tired, food's
ready). Whatever rounds were completed stand; standings reflect them. Because the
schedule is a fixed no-repeat sequence, stopping early still means nobody partnered
anyone twice.

> _Accepts:_ "End tournament" works from any round ≥ 1. Final standings screen is
> shareable (screenshot-friendly; optional copy-to-clipboard / export).

**After.** Final standings are shown with a clear winner (by total score; ties
broken by — TBD, e.g. most grands, then fewest nellos). The host can export the
whole tournament as a JSON/CSV backup and start a fresh one.

> _Accepts:_ Closing/refreshing the app mid-tournament loses nothing (autosaved).
> A finished tournament can be exported and re-opened/reviewed.

### Edge cases v1 must tolerate
- Wrong score entered → editable after the fact.
- App refreshed / device sleeps mid-tournament → state restored.
- Host wants to rename an entrant mid-tournament → allowed (it's just a label).
- Tournament abandoned at round 4 → valid final standings over 4 rounds.

### Explicitly out of scope for v1
- Player self-service / phones / multi-device sync.
- Accounts, auth, real-time updates.
- Counts other than 12.
- Whist rules enforcement (the app records outcomes; humans play the game).
- Scoring-rule math (we record the number the table reports — see open question).

---

## 2. Tech picks & environment (sized for a casual, once-a-year event)

**Shape: one static web page — plain HTML/CSS/JS, no framework, no build step,
no backend, no database.** Everything lives on the host's device. This is the
smallest thing that meets the "one host, one Mac/Chrome, flaky house wifi"
reality, and it stays readable/pokeable by someone who doesn't use React.

| Concern | Pick | Why |
|---|---|---|
| App type | **Single static page** (HTML/CSS/vanilla JS) | No toolchain to learn/maintain; open the file and read it |
| Framework / build | **None** for the app — no React, no Vite | App is tiny; a framework is pure overhead and opacity here |
| Testing | **Jasmine** (Node, ESM) — strict test-first | Pure logic (schedule, movement, scoring, ranking, state machine) is unit- + scenario-tested before UI; the same ES modules load in the browser unbundled |
| Persistence | **localStorage** (autosave every change) + **JSON export/import** | No DB; export is the backup / disaster recovery |
| Schedule | **Precomputed constant** (the Wh(12) table in §4) | The "algorithm" is a lookup; zero runtime risk |
| Hosting | **GitHub Pages** (free, static, lives in the repo) | Stable origin → reliable localStorage; Chrome caches it offline after first load |
| Auth | **None** | One trusted host on one device |

**The one real risk on a single device is data loss** (browser storage cleared,
device dies). Mitigations: autosave to localStorage on every change; one-tap
"Export backup" (downloads JSON); "Import" to restore. That's enough for a family
game — we are not building a fault-tolerant distributed system.

_Why no framework/backend/DB/accounts?_ For a 12-entrant, one-device,
once-in-a-while event they're pure cost: a toolchain to maintain, infra to
babysit, auth friction for non-technical family, and a network dependency in a
house with bad wifi. A single static page on GitHub Pages removes all of it —
and you can read every line of it.

_Why GitHub Pages over opening the file directly?_ A raw `file://` page mostly
works in Chrome, but localStorage on `file://` is origin-quirky and easy to lose.
A Pages URL is a stable origin, so the tournament data sticks, and Chrome serves
it offline once cached.

---

## 3. Execution plan

**Phase 0 — De-risk the engine. ✅ DONE.**
Generated and verified a valid Wh(12) schedule (script + verification passed:
partners-once, opponents-twice over 11 rounds). Engine is now a constant.

**Phase 1 — Spec the gaps. ✅ DONE.**
All §5 questions resolved (scoring, bids, tiebreak, points floor, interaction
model, movement).

**Phase 2 — Test-first model layer. ✅ DONE.**
Jasmine + ESM scaffolding; the pure core built strictly red→green. Modules:
- `src/schedule.js` — Wh(12), generated from a verified starter (invariants pinned)
- `src/movement.js` — physical-table mapping (no seat stuck > 2 rounds running)
- `src/standings.js` — tally + ranking ladder + tie flagging
- `src/seating.js` — names + partner/opponents/table derivation
- `src/tournament.js` — setup→running→finished state machine, validation,
  edit-a-round, end-early, backup round-trip
**40 specs, 0 failures**, including end-to-end scenarios (full 11 rounds, early
quit, edits, save/restore). `npm test` to run.

**Phase 3 — UI (the spine), test-backed model underneath.**
A single static page over the tested model: setup/sign-in board → "where do I
go" round screen → per-entrant score entry with the "X of 12 entered" board →
live standings. The model is done and trusted; the UI is a thin renderer.

**Phase 4 — Robustness & polish.**
Wire autosave/restore to localStorage, export/import backup, final standings +
winner, screenshot-friendly results, host-named tables. (Model behaviors already
exist + tested; this is mostly rendering + persistence glue.)

**Phase 5 — Dry run.**
Simulate a full tournament (and an abandoned one) on the actual Mac/Chrome.
Fix what's awkward in person. Ship to GitHub Pages.

---

## 4. The seating schedule (Wh(12), verified)

Seats are **1–12** (fixed). Each entrant is assigned a seat at Start.
Each cell is one table: `A&B vs C&D` (A&B are partners, against C&D).

| Round | Table 1 | Table 2 | Table 3 |
|------|---------|---------|---------|
| 1 | 6&2 vs 10&1 | 8&9 vs 7&4 | 11&5 vs 3&12 |
| 2 | 7&3 vs 11&2 | 9&10 vs 8&5 | 1&6 vs 4&12 |
| 3 | 8&4 vs 1&3 | 10&11 vs 9&6 | 2&7 vs 5&12 |
| 4 | 9&5 vs 2&4 | 11&1 vs 10&7 | 3&8 vs 6&12 |
| 5 | 10&6 vs 3&5 | 1&2 vs 11&8 | 4&9 vs 7&12 |
| 6 | 11&7 vs 4&6 | 2&3 vs 1&9 | 5&10 vs 8&12 |
| 7 | 1&8 vs 5&7 | 3&4 vs 2&10 | 6&11 vs 9&12 |
| 8 | 2&9 vs 6&8 | 4&5 vs 3&11 | 7&1 vs 10&12 |
| 9 | 3&10 vs 7&9 | 5&6 vs 4&1 | 8&2 vs 11&12 |
| 10 | 4&11 vs 8&10 | 6&7 vs 5&2 | 9&3 vs 1&12 |
| 11 | 5&1 vs 9&11 | 7&8 vs 6&3 | 10&4 vs 2&12 |

_Properties (machine-verified): every pair of seats partners exactly once and
opposes exactly twice across the 11 rounds._

### Provisional data model
```
Tournament {
  id, name, createdAt,
  status: "setup" | "running" | "finished",
  currentRound: 1..11,
  entrants: Entrant[12],          // index ↔ seat (1..12)
  rounds: RoundResult[]           // one per completed round
}
Entrant { seat: 1..12, name: string }
RoundResult {
  round: 1..11,
  // per seat, the two hands of that round:
  hands: { [seat]: [ Hand, Hand ] },
  edited?: bool
}
Hand { points: number, bid: "nello" | "grand" }   // always one or the other

// Standings are DERIVED, not stored, per seat over all completed hands:
//   totalPoints  = sum of every hand.points
//   grands       = count of hands where bid === "grand"
//   succGrands   = count of hands where bid === "grand" && points > 0
//   nellos       = count of hands where bid === "nello"   (= handsPlayed - grands)
//   roundsPlayed = number of completed rounds
// Rank by: totalPoints DESC, succGrands DESC, grands DESC, seat ASC.
// A tie through the first three rungs is flagged in the UI (shared rank).
```

---

## 5. Open questions

**Resolved:**
- ✅ **Scoring model** — per-hand: each entrant logs 2 hands/round, each with
  points + a forced `nello`/`grand` bid. App stores the points the table reports;
  it does not compute them. (§0, §1, §4)
- ✅ **Bid model** — no `normal`/pass bid; every hand is nello or grand.
- ✅ **Ranking / tiebreak** — ladder: total points → successful grands →
  total grands → seat number; unresolved ties flagged on screen for people to
  settle socially (§0). Winner = top of that order over the rounds played.
- ✅ **Points floor** — always ≥ 0 (losers score nothing rather than going
  negative; the winning team takes the points). Input rejects negatives.

_No open spec questions remaining._
