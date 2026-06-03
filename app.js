// DOM layer: a thin renderer over the tested model in src/. No game logic lives
// here — it reads tournament state through the view-model and writes back
// through Tournament methods, persisting to localStorage on every change.

import { Tournament } from './src/tournament.js';
import {
  currentPhase,
  standingsView,
  roundProgress,
  confirmedRounds,
} from './src/viewmodel.js';

const STORAGE_KEY = 'whist-tourny-v1';

// -- state ------------------------------------------------------------------
let t = load() ?? new Tournament();
let tab = 'seating'; // sub-view: 'seating' | 'entry' | 'standings' | 'rounds'
let selectedSeat = null;
let editRoundIdx = null; // which confirmed round is open in the editor
let editSeat = null; // which entrant within that round is being edited

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Tournament.fromJSON(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t.toJSON()));
  } catch {
    /* storage full / disabled — the in-memory model still works */
  }
}

// -- helpers ----------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function commit(fn) {
  try {
    fn();
  } catch (err) {
    alert(err.message);
    return;
  }
  save();
  render();
}

// -- render -----------------------------------------------------------------
function render() {
  const phase = currentPhase(t);
  // Keep the active tab valid for the current phase.
  if (phase === 'finished' && tab !== 'rounds') tab = 'standings';
  if (phase === 'round' && !['seating', 'entry', 'standings', 'rounds'].includes(tab)) {
    tab = 'seating';
  }
  renderStatus(phase);
  renderNav(phase);
  renderFooter();
  const app = $('#app');
  if (phase === 'setup') app.innerHTML = setupView();
  else if (phase === 'finished') app.innerHTML = tab === 'rounds' ? roundsView() : finishedView();
  else app.innerHTML = runningView();
  wire(phase);
}

function renderStatus(phase) {
  const s = $('#status');
  if (phase === 'setup') s.textContent = `Sign-up — ${t.entrants.length} / 12`;
  else if (phase === 'finished') s.textContent = `Finished — ${t.results.length} rounds played`;
  else s.textContent = `Round ${t.currentRound + 1} of 11`;
}

function renderNav(phase) {
  const nav = $('#nav');
  const btn = (id, label) =>
    `<button class="nav-btn ${tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
  if (phase === 'round') {
    nav.innerHTML =
      btn('seating', 'Seating') +
      btn('entry', 'Enter Scores') +
      btn('standings', 'Standings') +
      btn('rounds', 'Edit Rounds');
  } else if (phase === 'finished') {
    nav.innerHTML = btn('standings', 'Final Standings') + btn('rounds', 'Edit Rounds');
  } else {
    nav.innerHTML = '';
  }
}

function renderFooter() {
  $('#footer').innerHTML = `
    <button class="ghost" data-action="export">⬇ Export backup</button>
    <button class="ghost" data-action="import">⬆ Import</button>
    <span class="spacer"></span>
    <button class="ghost" data-action="new">＋ New tournament</button>
    <input type="file" id="import-file" accept="application/json" hidden />`;
}

// -- setup ------------------------------------------------------------------
function setupView() {
  const seats = t.entrants
    .map(
      (e, i) => `<li>
        <span class="seat-num">${i + 1}</span>
        <span>${esc(e.name)}</span>
        <span class="spacer"></span>
        <button class="ghost" data-remove="${i}">✕</button>
      </li>`
    )
    .join('');
  const tableInputs = t.tableNames
    .map(
      (n, i) =>
        `<input type="text" class="tname" data-i="${i}" value="${esc(n)}" placeholder="Table ${i + 1}" />`
    )
    .join('');
  return `
    <h2>Set up the tournament</h2>
    <div class="cards" style="grid-template-columns: 1fr 1fr;">
      <div class="card">
        <h3>Name your tables</h3>
        <div class="field">${tableInputs}</div>
        <p class="muted">These are the physical spots in the room. People are sent here so nobody gets stuck at one table.</p>
      </div>
      <div class="card">
        <h3>Who's playing? (${t.entrants.length} / 12)</h3>
        <form id="add-form" class="field">
          <input type="text" id="add-name" placeholder="Name (or 'Kenny&amp;Emily')" autocomplete="off" />
          <button class="primary" type="submit" ${t.entrants.length >= 12 ? 'disabled' : ''}>Add</button>
        </form>
        <p class="muted">More than 12 people? Combine some into one entrant — they share a seat &amp; score.</p>
        <ul class="seat-list">${seats}</ul>
        <button class="primary" data-action="start" ${t.entrants.length === 12 ? '' : 'disabled'}>
          Start tournament ▶
        </button>
      </div>
    </div>`;
}

// -- running ----------------------------------------------------------------
function runningView() {
  if (tab === 'standings') return standingsTable(false);
  if (tab === 'rounds') return roundsView();
  if (tab === 'entry') return entryView();
  return seatingView();
}

// Two hand-input rows (points + Nello/Grand toggle), prefilled from `hands`.
function handRows(hands) {
  const row = (i) => {
    const cur = hands?.[i] ?? { points: '', bid: 'nello' };
    const pts = cur.points === '' ? '' : cur.points;
    return `<div class="hand-row" data-hand="${i}">
      <label>Hand ${i + 1}</label>
      <input type="number" min="0" step="1" class="pts" value="${pts}" placeholder="pts" />
      <span class="bid">
        <button class="nello ${cur.bid === 'nello' ? 'on' : ''}" data-bid="nello">Nello</button>
        <button class="grand ${cur.bid === 'grand' ? 'on' : ''}" data-bid="grand">Grand</button>
      </span>
    </div>`;
  };
  return row(0) + row(1);
}

function seatingView() {
  const tables = t.seatingForRound(t.currentRound);
  const cards = tables
    .map((tbl) => {
      const team = (pair) => pair.map((e) => esc(e.name)).join(' & ');
      return `<div class="card table-card">
        <h3>${esc(t.tableNames[tbl.table])}</h3>
        <div class="team">${team(tbl.teamA)}</div>
        <div class="vs">— vs —</div>
        <div class="team">${team(tbl.teamB)}</div>
      </div>`;
    })
    .join('');
  return `
    <div class="toolbar">
      <h2 style="margin:0">Round ${t.currentRound + 1} — find your seat</h2>
      <span class="spacer"></span>
      <button class="primary" data-tab="entry">Enter scores ▶</button>
    </div>
    <div class="cards tables">${cards}</div>`;
}

function entryView() {
  const p = roundProgress(t);
  const entered = new Set(t.enteredSeats());
  const chips = t.entrants
    .map((e) => {
      const done = entered.has(e.seat);
      const sel = e.seat === selectedSeat ? 'selected' : '';
      return `<button class="card chip ${done ? 'done' : ''} ${sel}" data-seat="${e.seat}">
        <span>${esc(e.name)}</span>
        <span class="${done ? 'tick' : 'muted'}">${done ? '✓' : '…'}</span>
      </button>`;
    })
    .join('');
  return `
    <div class="toolbar">
      <h2 style="margin:0">Round ${t.currentRound + 1} — enter your hands</h2>
      <span class="pill">${p.entered} / ${p.total} entered</span>
      <span class="spacer"></span>
      <button class="primary" data-action="confirm" ${p.canConfirm ? '' : 'disabled'}>
        Confirm round ✓
      </button>
    </div>
    ${p.remaining.length ? `<div class="remaining">Still need: ${p.remaining.map((e) => esc(e.name)).join(', ')}</div>` : ''}
    <div class="cards entrants" style="margin-top:1rem">${chips}</div>
    ${selectedSeat ? entryForm(selectedSeat) : '<p class="muted" style="margin-top:1rem">Tap your name above to enter your two hands.</p>'}`;
}

function entryForm(seat) {
  const e = t.entrants.find((x) => x.seat === seat);
  return `
    <div class="card" id="entry-form" style="margin-top:1rem; max-width:480px;">
      <h3>${esc(e.name)}</h3>
      ${handRows(t.draft?.hands?.[seat])}
      <button class="primary" data-action="save-entry">Save</button>
    </div>`;
}

// -- edit a past round ------------------------------------------------------
function roundsView() {
  const rounds = confirmedRounds(t);
  if (!rounds.length) {
    return `<h2>Edit a past round</h2>
      <p class="muted">No rounds have been confirmed yet. Once you confirm a round you can come back here to fix any mistyped scores.</p>`;
  }
  if (editRoundIdx != null && editRoundIdx >= rounds.length) editRoundIdx = null;

  const roundBtns = rounds
    .map(
      (r) =>
        `<button class="nav-btn ${r.index === editRoundIdx ? 'active' : ''}" data-edit-round="${r.index}">Round ${r.roundNumber}${r.edited ? ' ✎' : ''}</button>`
    )
    .join('');

  let detail = '<p class="muted" style="margin-top:1rem">Pick a round above, then tap an entrant to fix their hands.</p>';
  if (editRoundIdx != null) {
    const r = rounds[editRoundIdx];
    const chips = r.entries
      .map((e) => {
        const sel = e.seat === editSeat ? 'selected' : '';
        const bids = e.hands.map((h) => (h.bid === 'grand' ? 'G' : 'N')).join('/');
        return `<button class="card chip ${sel}" data-edit-seat="${e.seat}">
          <span>${esc(e.name)}</span>
          <span class="muted">${e.points} pts · ${bids}</span>
        </button>`;
      })
      .join('');
    detail = `<div class="cards entrants" style="margin-top:1rem">${chips}</div>
      ${editSeat != null ? editForm(editRoundIdx, editSeat) : ''}`;
  }

  return `
    <h2>Edit a past round</h2>
    <div class="toolbar">${roundBtns}</div>
    ${detail}`;
}

function editForm(roundIdx, seat) {
  const e = t.entrants.find((x) => x.seat === seat);
  return `
    <div class="card" id="edit-form" style="margin-top:1rem; max-width:480px;">
      <h3>Round ${roundIdx + 1} — ${esc(e.name)}</h3>
      ${handRows(t.results[roundIdx].hands[seat])}
      <button class="primary" data-action="save-edit">Save change</button>
    </div>`;
}

// -- standings / finished ---------------------------------------------------
function standingsTable(final) {
  const rows = standingsView(t);
  const body = rows
    .map(
      (r) => `<tr class="${r.isLeader && final ? 'leader' : ''}">
        <td class="rank">${r.rank}${r.tied ? ' <span class="tie-flag" title="tied — settle it!">⚑</span>' : ''}</td>
        <td>${esc(r.name)}</td>
        <td class="pts">${r.points}</td>
        <td class="g">${r.grandsLabel}</td>
        <td class="n">${r.nellos}</td>
        <td class="muted">${r.roundsPlayed}</td>
      </tr>`
    )
    .join('');
  return `
    <h2>${final ? 'Final standings' : 'Standings'}</h2>
    <table class="standings">
      <thead><tr><th>#</th><th>Entrant</th><th>Pts</th><th>Grands</th><th>Nellos</th><th>Rounds</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="muted" style="margin-top:0.75rem">⚑ = tied on points, successful grands, and grands — settle it however you like.</p>`;
}

function finishedView() {
  const rows = standingsView(t);
  const top = rows[0];
  const sharedTop = rows.filter((r) => r.rank === 1);
  const banner = sharedTop.length > 1
    ? `<div class="winner-banner"><div>It's a tie at the top!</div><div class="name">${sharedTop.map((r) => esc(r.name)).join(' & ')}</div><div class="muted">Settle it among yourselves 🃏</div></div>`
    : `<div class="winner-banner"><div>🏆 Winner</div><div class="name">${esc(top.name)}</div><div class="muted">${top.points} points over ${top.roundsPlayed} rounds</div></div>`;
  return banner + standingsTable(true);
}

// -- events -----------------------------------------------------------------
function wire(phase) {
  // Nav + cross-cutting actions via delegation on body (re-bound each render).
  $('#nav').onclick = (ev) => {
    const tabBtn = ev.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); }
  };
  $('#footer').onclick = (ev) => {
    const a = ev.target.closest('[data-action]')?.dataset.action;
    if (a === 'export') doExport();
    if (a === 'import') $('#import-file').click();
    if (a === 'new') doNew();
  };
  $('#import-file').onchange = doImport;

  const app = $('#app');
  app.onclick = (ev) => {
    const target = ev.target;
    const action = target.closest('[data-action]')?.dataset.action;
    const tabBtn = target.closest('[data-tab]');
    const seatBtn = target.closest('[data-seat]');
    const removeBtn = target.closest('[data-remove]');
    const editRoundBtn = target.closest('[data-edit-round]');
    const editSeatBtn = target.closest('[data-edit-seat]');

    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    if (action === 'start') commit(() => t.start());
    else if (action === 'confirm') commit(() => { t.confirmRound(); tab = 'seating'; selectedSeat = null; });
    else if (action === 'save-entry') saveEntry();
    else if (action === 'save-edit') saveEdit();
    else if (removeBtn) commit(() => t.entrants.splice(Number(removeBtn.dataset.remove), 1));
    else if (seatBtn) { selectedSeat = Number(seatBtn.dataset.seat); render(); }
    else if (editRoundBtn) { editRoundIdx = Number(editRoundBtn.dataset.editRound); editSeat = null; render(); }
    else if (editSeatBtn) { editSeat = Number(editSeatBtn.dataset.editSeat); render(); }
    // bid toggle (don't re-render; just flip the on-state)
    const bidBtn = target.closest('.bid button');
    if (bidBtn) {
      const group = bidBtn.parentElement;
      $$('button', group).forEach((b) => b.classList.remove('on'));
      bidBtn.classList.add('on');
    }
  };

  if (phase === 'setup') {
    $('#add-form').onsubmit = (ev) => {
      ev.preventDefault();
      const input = $('#add-name');
      commit(() => t.addEntrant(input.value));
    };
    $$('.tname').forEach((inp) => {
      inp.onchange = () => {
        const names = $$('.tname').sort((a, b) => a.dataset.i - b.dataset.i).map((x) => x.value);
        commit(() => t.setTableNames(names));
      };
    });
  }
}

// Read the two {points, bid} hands out of a form element.
function readHands(form) {
  return $$('.hand-row', form).map((row) => ({
    points: Number($('.pts', row).value),
    bid: $('.bid button.on', row)?.dataset.bid ?? 'nello',
  }));
}

function saveEntry() {
  const form = $('#entry-form');
  if (!form) return;
  const hands = readHands(form);
  commit(() => {
    t.recordEntrantRound(selectedSeat, hands);
    // jump to the next entrant who still needs to enter
    const entered = new Set(t.enteredSeats());
    const next = t.entrants.find((e) => !entered.has(e.seat));
    selectedSeat = next ? next.seat : null;
  });
}

function saveEdit() {
  const form = $('#edit-form');
  if (!form) return;
  const hands = readHands(form);
  commit(() => {
    t.editRound(editRoundIdx, editSeat, hands);
    editSeat = null; // collapse the form; the chip shows the new total
  });
}

// -- backup / lifecycle -----------------------------------------------------
function doExport() {
  const blob = new Blob([JSON.stringify(t.toJSON(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whist-backup-round${t.currentRound ?? 'X'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function doImport(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      t = Tournament.fromJSON(JSON.parse(reader.result));
      selectedSeat = editSeat = editRoundIdx = null;
      tab = 'seating';
      save();
      render();
    } catch {
      alert('That file could not be read as a tournament backup.');
    }
  };
  reader.readAsText(file);
}

function doNew() {
  if (!confirm('Start a new tournament? This clears the current one (export a backup first if you want it).')) return;
  t = new Tournament();
  selectedSeat = editSeat = editRoundIdx = null;
  tab = 'seating';
  save();
  render();
}

render();
