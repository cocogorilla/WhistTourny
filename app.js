import { Tournament } from './src/tournament.js';
import { SCHEDULES } from './src/schedule.js';
import {
  currentPhase,
  standingsView,
  roundProgress,
  confirmedRounds,
} from './src/viewmodel.js';

const PLAYER_COUNTS = Object.keys(SCHEDULES).map(Number).sort((a, b) => a - b);

const STORAGE_KEY = 'whist-tourny-v1';

let t = load() ?? new Tournament();
let tab = 'seating';
let selectedSeat = null;
let editRoundIdx = null;
let editSeat = null;

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
  }
}

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

function render() {
  const phase = currentPhase(t);
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
  const cfg = t.config;
  if (phase === 'setup') s.textContent = `Sign-up — ${t.entrants.length} / ${cfg.seatCount}`;
  else if (phase === 'finished') s.textContent = `Finished — ${t.results.length} rounds played`;
  else s.textContent = `Round ${t.currentRound + 1} of ${cfg.roundCount}`;
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

function setupView() {
  const cfg = t.config;
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
  const formatPick = PLAYER_COUNTS.map((c) => {
    const cc = SCHEDULES[c];
    const byes = cc.byesByRound[0].length;
    const sub = byes ? `${cc.roundCount} rounds · ${byes} sit out/round` : `${cc.roundCount} rounds · no byes`;
    return `<button class="card format-opt ${t.playerCount === c ? 'selected' : ''}" data-players="${c}">
      <div class="format-n">${c} players</div>
      <div class="muted">${sub}</div>
    </button>`;
  }).join('');
  return `
    <h2>Set up the tournament</h2>
    <div class="card" style="margin-bottom:0.75rem;">
      <h3>Format</h3>
      <div class="cards format-pick" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">${formatPick}</div>
      <p class="muted">3 tables every round; with more than 12 players, people take turns sitting out (byes), shared evenly.</p>
    </div>
    <div class="cards" style="grid-template-columns: 1fr 1fr;">
      <div class="card">
        <h3>Name your tables</h3>
        <div class="field">${tableInputs}</div>
        <p class="muted">These are the physical spots in the room. People are sent here so nobody gets stuck at one table.</p>
      </div>
      <div class="card">
        <h3>Who's playing? (${t.entrants.length} / ${cfg.seatCount})</h3>
        <form id="add-form" class="field">
          <input type="text" id="add-name" placeholder="Name (or 'Kenny&amp;Emily')" autocomplete="off" />
          <button class="primary" type="submit" ${t.entrants.length >= cfg.seatCount ? 'disabled' : ''}>Add</button>
        </form>
        <p class="muted">More than ${cfg.seatCount}? Combine some into one entrant — they share a seat &amp; score.</p>
        <ul class="seat-list">${seats}</ul>
        <button class="primary" data-action="start" ${t.entrants.length === cfg.seatCount ? '' : 'disabled'}>
          Start tournament ▶
        </button>
      </div>
    </div>`;
}

function runningView() {
  if (tab === 'standings') return standingsTable(false);
  if (tab === 'rounds') return roundsView();
  if (tab === 'entry') return entryView();
  return seatingView();
}

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
  const byes = t.byeEntrants(t.currentRound);
  const byeLine = byes.length
    ? `<div class="remaining">Sitting out this round: ${byes.map((e) => esc(e.name)).join(', ')}</div>`
    : '';
  return `
    <div class="toolbar">
      <h2 style="margin:0">Round ${t.currentRound + 1} — find your seat</h2>
      <span class="spacer"></span>
      <button class="primary" data-tab="entry">Enter scores ▶</button>
    </div>
    ${byeLine}
    <div class="cards tables">${cards}</div>`;
}

function entryView() {
  const p = roundProgress(t);
  const entered = new Set(t.enteredSeats());
  const playing = new Set(t.playingSeatsForRound(t.currentRound));
  const chips = t.entrants
    .filter((e) => playing.has(e.seat))
    .map((e) => {
      const done = entered.has(e.seat);
      const sel = e.seat === selectedSeat ? 'selected' : '';
      return `<button class="card chip ${done ? 'done' : ''} ${sel}" data-seat="${e.seat}">
        <span>${esc(e.name)}</span>
        <span class="${done ? 'tick' : 'muted'}">${done ? '✓' : '…'}</span>
      </button>`;
    })
    .join('');
  const byes = t.byeEntrants(t.currentRound);
  const byeLine = byes.length
    ? `<div class="remaining">On bye this round (nothing to enter): ${byes.map((e) => esc(e.name)).join(', ')}</div>`
    : '';
  const showForm = selectedSeat && playing.has(selectedSeat);
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
    ${byeLine}
    <div class="cards entrants" style="margin-top:1rem">${chips}</div>
    ${showForm ? entryForm(selectedSeat) : '<p class="muted" style="margin-top:1rem">Tap your name above to enter your two hands.</p>'}`;
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
        if (e.onBye) {
          return `<div class="card chip is-bye">
            <span>${esc(e.name)}</span>
            <span class="muted">bye</span>
          </div>`;
        }
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

function standingsTable(final) {
  const rows = standingsView(t);
  const showByes = rows.some((r) => r.byes > 0);
  const body = rows
    .map(
      (r) => `<tr class="${r.isLeader && final ? 'leader' : ''}">
        <td class="rank">${r.rank}${r.tied ? ' <span class="tie-flag" title="tied — settle it!">⚑</span>' : ''}</td>
        <td>${esc(r.name)}</td>
        <td class="pts">${r.points}</td>
        <td class="g">${r.grandsLabel}</td>
        <td class="n">${r.nellos}</td>
        <td class="muted">${r.roundsPlayed}</td>
        ${showByes ? `<td class="muted byes ${r.byes === 0 ? 'no-bye' : ''}">${r.byes}</td>` : ''}
      </tr>`
    )
    .join('');
  return `
    <h2>${final ? 'Final standings' : 'Standings'}</h2>
    <table class="standings">
      <thead><tr><th>#</th><th>Entrant</th><th>Pts</th><th>Grands</th><th>Nellos</th><th>Rounds</th>${showByes ? '<th>Byes</th>' : ''}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="muted" style="margin-top:0.75rem">⚑ = tied on points, successful grands, and grands — settle it however you like.${showByes ? ' &nbsp;·&nbsp; <b>Byes</b> = rounds sat out; someone leading with 0 byes has played more hands than the rest.' : ''}</p>`;
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

function wire(phase) {
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
    const playersBtn = target.closest('[data-players]');
    const editRoundBtn = target.closest('[data-edit-round]');
    const editSeatBtn = target.closest('[data-edit-seat]');

    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    if (action === 'start') commit(() => t.start());
    else if (action === 'confirm') commit(() => { t.confirmRound(); tab = 'seating'; selectedSeat = null; });
    else if (action === 'save-entry') saveEntry();
    else if (action === 'save-edit') saveEdit();
    else if (playersBtn) commit(() => t.setPlayerCount(Number(playersBtn.dataset.players)));
    else if (removeBtn) commit(() => t.entrants.splice(Number(removeBtn.dataset.remove), 1));
    else if (seatBtn) { selectedSeat = Number(seatBtn.dataset.seat); render(); }
    else if (editRoundBtn) { editRoundIdx = Number(editRoundBtn.dataset.editRound); editSeat = null; render(); }
    else if (editSeatBtn) { editSeat = Number(editSeatBtn.dataset.editSeat); render(); }
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
    editSeat = null;
  });
}

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
