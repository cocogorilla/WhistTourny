import { Tournament } from './src/tournament.js';
import { SCHEDULES, SUPPORTED_COUNTS, MAX_SEATS } from './src/schedule.js';
import {
  currentPhase,
  standingsView,
  confirmedRounds,
  tableEntry,
  assembleTableHands,
  editTables,
} from './src/viewmodel.js';
import {
  decorateStandings,
  benchQuip,
  winnerBanner,
  tiebreakQuip,
  kennyContext,
  kennyRoastCategory,
  kennyRoastLine,
  unsupportedCountMessage,
} from './src/flavor.js';

const STORAGE_KEY = 'whist-tourny-v1';

let t = load() ?? new Tournament();
let tab = 'seating';
let setupStep = 1;
let editRoundIdx = null;

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
  if (phase === 'setup') s.textContent = `Setup · step ${setupStep} of 3`;
  else if (phase === 'finished') s.textContent = `Finished — ${t.results.length} rounds played`;
  else s.textContent = `Round ${t.currentRound + 1} of ${t.config.roundCount}`;
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
  if (setupStep === 1) return setupTablesStep();
  if (setupStep === 2) return setupSignInStep();
  return setupConfirmStep();
}

function setupTablesStep() {
  const tableInputs = t.tableNames
    .map(
      (n, i) =>
        `<input type="text" class="tname" data-i="${i}" value="${esc(n)}" placeholder="Table ${i + 1}" />`
    )
    .join('');
  return `
    <h2>Set up · Step 1 of 3 — Name your tables</h2>
    <div class="card">
      <h3>Your three tables</h3>
      <div class="field">${tableInputs}</div>
      <p class="muted">Name the tables (or just point at them) so everyone gets a fresh — and someone else's still-warm — seat each round.</p>
    </div>
    <div class="toolbar wizard-nav"><span class="spacer"></span>
      <button class="primary" data-action="setup-next">Next: sign in ▶</button>
    </div>`;
}

function setupSignInStep() {
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
  const full = t.entrants.length >= MAX_SEATS;
  return `
    <h2>Set up · Step 2 of 3 — Sign in players</h2>
    <div class="card">
      <h3>Who's playing? (${t.entrants.length} signed in)</h3>
      <form id="add-form" class="field">
        <input type="text" id="add-name" placeholder="Name (or 'Kenny&amp;Emily')" autocomplete="off" ${full ? 'disabled' : ''} />
        <button class="primary" type="submit" ${full ? 'disabled' : ''}>Add</button>
      </form>
      <p class="muted">Add people as they arrive. More than fit? Combine two into one entrant — they share a seat &amp; score. (Up to ${MAX_SEATS}.)</p>
      ${full ? `<p class="muted">${unsupportedCountMessage(MAX_SEATS + 1, SUPPORTED_COUNTS)}</p>` : ''}
      <ul class="seat-list">${seats || '<li class="muted">No one yet…</li>'}</ul>
    </div>
    <div class="toolbar wizard-nav">
      <button data-action="setup-back">◀ Tables</button>
      <span class="spacer"></span>
      <button class="primary" data-action="setup-next" ${t.entrants.length ? '' : 'disabled'}>Next: confirm ▶</button>
    </div>`;
}

function setupConfirmStep() {
  const n = t.entrants.length;
  const cfg = SCHEDULES[n];
  let body;
  if (cfg) {
    const byes = cfg.byesByRound[0].length;
    const sub = byes
      ? `${cfg.roundCount} rounds · ${byes} sit out each round (shared fairly)`
      : `${cfg.roundCount} rounds · everyone partners everyone · no byes`;
    body = `<div class="format-n">${n}-player format</div><div class="muted">${sub}</div>`;
  } else {
    body = `<div class="format-n">Hold up — ${n} ${n === 1 ? 'player' : 'players'}</div>
      <p class="muted">${unsupportedCountMessage(n, SUPPORTED_COUNTS)}</p>`;
  }
  return `
    <h2>Set up · Step 3 of 3 — Confirm the field</h2>
    <div class="card">
      <h3>You've signed in ${n} ${n === 1 ? 'player' : 'players'}</h3>
      ${body}
    </div>
    <div class="toolbar wizard-nav">
      <button data-action="setup-back">◀ Sign in</button>
      <span class="spacer"></span>
      <button class="primary" data-action="start" ${cfg ? '' : 'disabled'}>Start tournament ▶</button>
    </div>`;
}

function runningView() {
  if (tab === 'standings') return standingsTable(false);
  if (tab === 'rounds') return roundsView();
  if (tab === 'entry') return entryView();
  return seatingView();
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
    ? `<div class="remaining">${benchQuip(t.currentRound + 1)}: ${byes.map((e) => esc(e.name)).join(', ')}</div>`
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
  const v = tableEntry(t);
  const byeLine = v.byes.length
    ? `<div class="remaining">${benchQuip(v.roundNumber)} (nothing to enter): ${v.byes.map((e) => esc(e.name)).join(', ')}</div>`
    : '';
  const cards = v.tables.map((tbl) => tableCard(tbl)).join('');
  return `
    <div class="toolbar">
      <h2 style="margin:0">Round ${v.roundNumber} — enter scores by table</h2>
      <span class="pill entry-pill">${v.tablesDone} / ${v.tablesTotal} tables in</span>
      <span class="spacer"></span>
      <button class="primary" data-action="confirm" ${v.canConfirm ? '' : 'disabled'}>
        Confirm round ✓
      </button>
    </div>
    ${byeLine}
    <div class="cards entry-tables" style="margin-top:1rem">${cards}</div>`;
}

function tableCard(tbl, opts = {}) {
  const action = opts.action ?? 'save-table';
  const label = opts.label ?? (tbl.done ? 'Update table' : 'Save table');
  const tag = opts.hideTag ? '' : `<span class="status-tag">${tbl.done ? '✓ entered' : '• pending'}</span>`;
  const teamA = tbl.players.filter((p) => p.team === 'A');
  const teamB = tbl.players.filter((p) => p.team === 'B');
  return `<div class="card table-entry ${tbl.done ? 'done' : ''}" data-table="${tbl.table}">
    <h3>${esc(tbl.name)} ${tag}</h3>
    <div class="entry-head"><span></span><span>Hand 1</span><span>Hand 2</span></div>
    ${teamBlock('A', teamA)}
    <div class="vs">— vs —</div>
    ${teamBlock('B', teamB)}
    <button class="primary" data-action="${action}" data-table="${tbl.table}">${label}</button>
  </div>`;
}

function teamBlock(teamKey, members) {
  const ptsValue = (h) => {
    const v = members[0]?.hands?.[h]?.points;
    return v == null ? '' : v;
  };
  const ptsCell = (h) =>
    `<input type="number" min="0" step="1" class="pts team-pts" data-team="${teamKey}" data-hand="${h}" value="${ptsValue(h)}" placeholder="pts" />`;
  const bidRow = (p) => `<div class="entry-row bid-row">
      <span class="pname">${esc(p.name)}</span>
      ${bidCell(p, 0)}
      ${bidCell(p, 1)}
    </div>`;
  return `<div class="team-row">
      <span class="tlabel">${members.map((p) => esc(p.name)).join(' & ')}</span>
      ${ptsCell(0)}
      ${ptsCell(1)}
    </div>
    ${members.map(bidRow).join('')}`;
}

function bidCell(p, h) {
  const bid = p.hands?.[h]?.bid ?? 'nello';
  return `<span class="bid" data-seat="${p.seat}" data-hand="${h}">
    <button type="button" class="nello ${bid === 'nello' ? 'on' : ''}" data-bid="nello">N</button>
    <button type="button" class="grand ${bid === 'grand' ? 'on' : ''}" data-bid="grand">G</button>
  </span>`;
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
        `<button class="nav-btn ${r.index === editRoundIdx ? 'active' : ''}" data-edit-round="${r.index}"${r.edited ? ' title="edited after it was confirmed"' : ''}>Round ${r.roundNumber}${r.edited ? ' ✎' : ''}</button>`
    )
    .join('');

  let detail = '<p class="muted" style="margin-top:1rem">Pick a round above, then fix a table — points are per team (partners share), bids are per player.</p>';
  if (editRoundIdx != null) {
    const v = editTables(t, editRoundIdx);
    const byeLine = v.byes.length
      ? `<div class="remaining">Sat out this round: ${v.byes.map((e) => esc(e.name)).join(', ')}</div>`
      : '';
    const cards = v.tables
      .map((tbl) => tableCard(tbl, { action: 'save-edit-table', label: 'Save changes', hideTag: true }))
      .join('');
    detail = `${byeLine}<div class="cards entry-tables" style="margin-top:1rem">${cards}</div>`;
  }

  return `
    <h2>Edit a past round</h2>
    <div class="toolbar">${roundBtns}</div>
    ${detail}`;
}

function standingsTable(final) {
  const rows = decorateStandings(standingsView(t), t.results);
  const showByes = rows.some((r) => r.byes > 0);
  const anyTie = rows.some((r) => r.tied && r.roundsPlayed > 0);
  const body = rows
    .map(
      (r) => `<tr class="${r.isLeader && final ? 'leader' : ''}">
        <td class="rank">${r.rank}${r.tied ? ' <span class="tie-flag" title="tied — settle it!">⚑</span>' : ''}</td>
        <td>${esc(r.name)} ${r.badges.map((b) => `<span class="badge" data-tip="${esc(b.title)}" aria-label="${esc(b.title)}">${b.icon}</span>`).join('')}</td>
        <td class="pts">${r.points}</td>
        <td class="g">${r.grandsLabel}</td>
        <td class="n">${r.nellos}</td>
        <td class="muted">${r.roundsPlayed}</td>
        ${showByes ? `<td class="muted byes ${r.byes === 0 ? 'no-bye' : ''}">${r.byes}</td>` : ''}
      </tr>`
    )
    .join('');
  const tieNote = anyTie
    ? `⚑ = dead even on points, successful grands, and grands. Suggested decider: <b>${tiebreakQuip(rows.length + t.results.length)}</b>.`
    : '⚑ = a genuine tie; the app shows it instead of guessing a winner.';
  return `
    ${kennyWatch()}
    <h2>${final ? 'Final standings' : 'Standings'}</h2>
    <table class="standings">
      <thead><tr><th>#</th><th>Entrant</th><th>Pts</th><th>Grands</th><th>Nellos</th><th>Rounds</th>${showByes ? '<th>Byes</th>' : ''}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="muted" style="margin-top:0.75rem">${tieNote}${showByes ? ' &nbsp;·&nbsp; <b>Byes</b> = rounds sat out; someone leading with 0 byes has played more hands than the rest.' : ''}</p>`;
}

function kennyWatch() {
  const ctx = kennyContext(t.entrants, t.results);
  if (!ctx) return '';
  let partner = 'your partner';
  try {
    partner = t.assignment(ctx.roundIndex, ctx.seat).partner.name;
  } catch {
    /* never let a gag crash the standings */
  }
  const line = kennyRoastLine(kennyRoastCategory(ctx), ctx.roundIndex, partner);
  return `<div class="kenny-watch">🎯 <b>Kenny Watch</b> — ${esc(line)}</div>`;
}

function finishedView() {
  const wb = winnerBanner(standingsView(t));
  const banner = `<div class="winner-banner">
    <div class="name">${esc(wb.title)}</div>
    <div class="muted">${esc(wb.subtitle)}</div>
  </div>`;
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
    const removeBtn = target.closest('[data-remove]');
    const editRoundBtn = target.closest('[data-edit-round]');

    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    if (action === 'setup-next') { setupStep = Math.min(3, setupStep + 1); render(); return; }
    if (action === 'setup-back') { setupStep = Math.max(1, setupStep - 1); render(); return; }
    if (action === 'start') commit(() => { t.setPlayerCount(t.entrants.length); t.start(); });
    else if (action === 'confirm') commit(() => { t.confirmRound(); tab = 'seating'; });
    else if (action === 'save-table') saveTable(Number(target.closest('[data-table]').dataset.table));
    else if (action === 'save-edit-table') saveEditTable(Number(target.closest('[data-table]').dataset.table));
    else if (removeBtn) commit(() => t.entrants.splice(Number(removeBtn.dataset.remove), 1));
    else if (editRoundBtn) { editRoundIdx = Number(editRoundBtn.dataset.editRound); render(); }
    const bidBtn = target.closest('.bid button');
    if (bidBtn) {
      const group = bidBtn.parentElement;
      $$('button', group).forEach((b) => b.classList.remove('on'));
      bidBtn.classList.add('on');
    }
  };

  // only one team scores a hand
  app.oninput = (ev) => {
    const box = ev.target.closest('.team-pts');
    if (!box || !(Number(box.value) > 0)) return;
    const other = box.dataset.team === 'A' ? 'B' : 'A';
    const opp = box
      .closest('.table-entry')
      .querySelector(`.team-pts[data-team="${other}"][data-hand="${box.dataset.hand}"]`);
    if (opp) opp.value = '0';
  };

  if (phase === 'setup') {
    const addForm = $('#add-form');
    if (addForm) {
      addForm.onsubmit = (ev) => {
        ev.preventDefault();
        commit(() => t.addEntrant($('#add-name').value));
      };
    }
    $$('.tname').forEach((inp) => {
      inp.onchange = () => {
        const names = $$('.tname').sort((a, b) => a.dataset.i - b.dataset.i).map((x) => x.value);
        commit(() => t.setTableNames(names));
      };
    });
  }
}

// Surgical update (no re-render) so other tables' unsaved inputs survive.
function saveTable(tableIndex) {
  const card = $(`.table-entry[data-table="${tableIndex}"]`);
  if (!card) return;
  const tbl = tableEntry(t).tables.find((x) => x.table === tableIndex);
  if (!tbl) return;

  const points = { A: [0, 0], B: [0, 0] };
  $$('.team-pts', card).forEach((box) => {
    points[box.dataset.team][Number(box.dataset.hand)] = Number(box.value || 0);
  });
  const bids = {};
  $$('.bid', card).forEach((b) => {
    const seat = Number(b.dataset.seat);
    (bids[seat] = bids[seat] || [])[Number(b.dataset.hand)] =
      $('button.on', b)?.dataset.bid ?? 'nello';
  });

  const seatHands = assembleTableHands({
    teamA: tbl.players.filter((p) => p.team === 'A').map((p) => p.seat),
    teamB: tbl.players.filter((p) => p.team === 'B').map((p) => p.seat),
    points,
    bids,
  });
  try {
    seatHands.forEach(({ seat, hands }) => t.recordEntrantRound(seat, hands));
  } catch (err) {
    alert(err.message);
    return;
  }
  save();
  refreshEntryStatus();
}

function refreshEntryStatus() {
  const v = tableEntry(t);
  const pill = $('.entry-pill');
  if (pill) pill.textContent = `${v.tablesDone} / ${v.tablesTotal} tables in`;
  const confirmBtn = $('[data-action="confirm"]');
  if (confirmBtn) confirmBtn.disabled = !v.canConfirm;
  v.tables.forEach((tbl) => {
    const card = $(`.table-entry[data-table="${tbl.table}"]`);
    if (!card) return;
    card.classList.toggle('done', tbl.done);
    const tag = $('.status-tag', card);
    if (tag) tag.textContent = tbl.done ? '✓ entered' : '• pending';
    const btn = $('button[data-action="save-table"]', card);
    if (btn) btn.textContent = tbl.done ? 'Update table' : 'Save table';
  });
}

function saveEditTable(tableIndex) {
  const card = $(`.table-entry[data-table="${tableIndex}"]`);
  if (!card || editRoundIdx == null) return;
  const tbl = editTables(t, editRoundIdx).tables.find((x) => x.table === tableIndex);
  if (!tbl) return;

  const points = { A: [0, 0], B: [0, 0] };
  $$('.team-pts', card).forEach((box) => {
    points[box.dataset.team][Number(box.dataset.hand)] = Number(box.value || 0);
  });
  const bids = {};
  $$('.bid', card).forEach((b) => {
    (bids[Number(b.dataset.seat)] = bids[Number(b.dataset.seat)] || [])[Number(b.dataset.hand)] =
      $('button.on', b)?.dataset.bid ?? 'nello';
  });

  const seatHands = assembleTableHands({
    teamA: tbl.players.filter((p) => p.team === 'A').map((p) => p.seat),
    teamB: tbl.players.filter((p) => p.team === 'B').map((p) => p.seat),
    points,
    bids,
  });
  try {
    seatHands.forEach(({ seat, hands }) => t.editRound(editRoundIdx, seat, hands));
  } catch (err) {
    alert(err.message);
    return;
  }
  save();
  const saveBtn = card.querySelector('button[data-action="save-edit-table"]');
  if (saveBtn) saveBtn.textContent = 'Saved ✓';
  const roundBtn = $(`[data-edit-round="${editRoundIdx}"]`);
  if (roundBtn && !roundBtn.textContent.includes('✎')) roundBtn.textContent += ' ✎';
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
      editRoundIdx = null;
      setupStep = 1;
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
  editRoundIdx = null;
  setupStep = 1;
  tab = 'seating';
  save();
  render();
}

render();
