# Test scenarios

Importable tournament states for visually verifying the app's gates and decision
points. Each file is a normal export (Import via the footer **Import** button).

Built by `/tmp/build-scenarios.mjs` from the real `Tournament` engine, so every
file is a valid round-trip. Importing replaces the current tournament — export a
backup first if you care about it.

| File | What it exercises | How to see the gate |
|---|---|---|
| `01-setup-16-format-picker.json` | 16 signed in → **two formats** for 16 | Click **Next → Next** to setup step 3; pick 3-table (byes) vs 4-table (no byes) |
| `02-setup-13-prime-roast.json` | Unsupported **prime** count | **Next → Next** to step 3; prime roast shows, **Start** disabled |
| `03-running-4tables-fresh.json` | **4-table** round, no byes, drop available | Seating/Enter tab: 4 tables, **Drop a table ▾** button present |
| `04-running-4tables-midentry.json` | Mid-entry gate | Enter tab shows **2 / 4 tables in**; Drop button hidden (entry started) |
| `05-running-dropped-4to3.json` | **Post-drop**: 4→3 with byes | 2 rounds played at 4 tables, now round 3 at 3 tables + 4 byes; check Standings **Avg** |
| `06-running-too-late-to-drop.json` | **"No clean rounds" warn** | Enter tab → **Drop a table ▾** → warns; choose End tournament / Keep playing |
| `07-running-15p-byes-kenny.json` | Byes + **Kenny Watch** | Seating shows 3 byes (+ bench quip); Standings tab shows the Kenny Watch banner |
| `08-finished-tie-badges.json` | **Tie** at top, badges, Kenny Watch | Final standings: ⚑ tie + tiebreak quip, 😤/🐔/🍩/🎢 badges (hover), winner banner |
| `09-edit-across-drop.json` | **Edit** across a 4→3 history | Edit-a-round tab: Rounds 1–2 show **4 tables**, Round 3 shows **3 tables + byes** — each reacts to its true seating |

## Notes

- **Setup scenarios (01, 02):** importing restores the *tournament*, not the wizard
  step. You'll land on step 1 ("name your tables") — click **Next** twice to reach
  the format/confirm step where the gate lives.
- **Merle modal:** the forced "word about Merle" popup is event-driven and is
  intentionally suppressed on import (so it doesn't fire on every load). To see it,
  import a running scenario, then enter and **Confirm** a round in which Merle scored.
- **Drop a table** only appears before any score is entered for the current round
  (a clean round boundary).
