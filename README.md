# Whist Tourny

A tiny, single-device scorekeeper for a family whist tournament: 12 entrants,
3 tables, round-by-round seating that lets everyone partner everyone (a verified
Wh(12) whist-tournament schedule), per-hand scoring with nello/grand bids, and
live standings.

See [DESIGN.md](DESIGN.md) for the full design and locked decisions.

## Tech

Plain HTML/CSS/vanilla JS (no framework, no build step). The pure logic lives in
`src/` as ES modules; the UI is a thin renderer over it. Runs in Chrome on one
laptop as a self-service "scorekeeper station"; state persists in `localStorage`
with JSON export/import for backup. Hosts on GitHub Pages.

## Development

Strict test-first. Pure logic is unit- and scenario-tested with Jasmine before
any UI:

```sh
npm install
npm test
```

## Layout

```
src/
  schedule.js    Wh(12) seating schedule (every pair partners once, opposes twice)
  movement.js    physical-table assignment (no one stuck at a table > 2 rounds)
  standings.js   tally + ranking ladder (points → successful grands → grands)
  seating.js     names → partner / opponents / table for display
  tournament.js  setup → running → finished state machine
spec/            matching Jasmine specs (unit + end-to-end scenarios)
```
