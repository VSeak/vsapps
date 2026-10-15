// ---------- Accounts ----------
// An account has updates: a balance on a date, and what went in since the update before. Its starting balance is what
// the first update says was there before that update's money (a new account starts at 0; one you start tracking late
// starts at its balance). Growth = balance − starting balance − everything put in or moved in since.

const KINDS = { '401k': '401(k)', roth_401k: 'Roth 401(k)', '403b': '403(b)', ira: 'Traditional IRA', roth_ira: 'Roth IRA',
  hsa: 'HSA', brokerage: 'Brokerage', cash: 'Cash', other: 'Other' };

async function loadAccounts() {
  const rows = await sb.from('fire_accounts').select('*, updates:fire_updates(*), contributions:fire_contributions(*)').then(must);
  for (const a of rows) {
    a.updates.sort((x, y) => x.as_of.localeCompare(y.as_of));
    for (const u of a.updates) for (const k of ['balance', 'contributed', 'employer', 'moved']) u[k] = +u[k];
    a.latest = a.updates.at(-1) || null;
  }
  return rows;
}

const putIn = u => u.contributed + u.employer + u.moved;
// Totals for an account: start, what was put in after the start, growth.
function accountTotals(a) {
  const u = a.updates;
  if (!u.length) return null;
  const start = u[0].balance - putIn(u[0]);
  const sum = k => u.reduce((s, x) => s + x[k], 0);
  const contributed = sum('contributed'), employer = sum('employer'), moved = sum('moved');
  return { start, contributed, employer, moved, balance: a.latest.balance, growth: a.latest.balance - start - contributed - employer - moved };
}

const ownerName = (a, people) => a.owner_id ? people.find(p => p.id === a.owner_id)?.name || '' : 'Joint';

async function accountsPage() {
  const t = ++navToken;
  view(loading);
  const [people, accounts, jobs] = await Promise.all([loadPeople(), loadAccounts(), loadJobs()]);
  if (t !== navToken) return;
  const byBalance = (x, y) => (y.latest?.balance || 0) - (x.latest?.balance || 0) || x.name.localeCompare(y.name);
  const open = accounts.filter(a => !a.closed_on);
  const groups = [...people.map(p => [p.name, open.filter(a => a.owner_id === p.id)]), ['Joint', open.filter(a => !a.owner_id)],
    ['Closed', accounts.filter(a => a.closed_on)]].filter(([, list]) => list.length);
  const row = a => {
    const meta = [KINDS[a.kind], a.institution, a.latest ? `Updated ${fmtDate(a.latest.as_of)}` : 'No updates yet'].filter(Boolean);
    return `<a class="card acct${a.closed_on ? ' closed' : ''}" href="#/account/${a.id}">
      <span class="acct-name">${esc(a.name)}${a.closed_on ? ` <span class="chip">Closed</span>` : ''}</span>
      <span class="acct-bal">${a.latest ? money(a.latest.balance) : '<span class="muted">—</span>'}</span>
      <span class="acct-meta">${meta.map(esc).join(' · ')}</span>
      ${sparkline(a.updates.map(u => u.balance))}</a>`;
  };
  view(`<div class="page-head"><div><h1 class="big">Accounts</h1>
      <p class="muted">${accounts.length ? `${money(open.reduce((s, a) => s + (a.latest?.balance || 0), 0))} across ${open.length} open account${open.length === 1 ? '' : 's'}` : ''}</p></div>
      <div class="row wrap"><a class="button" href="#/sp500">Vs. S&amp;P 500</a><button type="button" id="addAcct" class="fill">+ Add Account</button></div></div>
    ${groups.length ? groups.map(([name, list]) => `<div class="group-head"><h2>${esc(name)}</h2>
        ${name === 'Closed' ? '' : `<b>${money(list.reduce((s, a) => s + (a.latest?.balance || 0), 0))}</b>`}</div>
      <div class="acct-list">${list.sort(byBalance).map(row).join('')}</div>`).join('')
      : `<section class="card empty"><h2>No Accounts Yet</h2><p class="muted">Add each 401(k), IRA, HSA and brokerage account, yours and your partner's.
        Old employer plans too.</p></section>`}`);
  $('#addAcct').onclick = async () => {
    const id = await accountDialog(null, people, jobs);
    if (id) goTo('#/account/' + id);
  };
}

// Add or edit an account. Returns its id once saved, 'deleted', or null.
async function accountDialog(a, people, jobs) {
  const f = await ask({ title: a ? 'Edit Account' : 'Add Account', ok: a ? 'Save' : 'Add Account',
    extra: a ? { value: 'delete', label: 'Delete Account' } : null,
    body: `<label>Name<input name="name" maxlength="80" value="${esc(a?.name)}" required data-need="Name the account." placeholder="E.g. Acme 401(k)" autocomplete="off"></label>
      <div class="two">
        <label>Owner<select name="owner">${people.map(p => `<option value="${p.id}"${a?.owner_id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
          <option value=""${a && !a.owner_id ? ' selected' : ''}>Joint</option></select></label>
        <label>Type<select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${a?.kind === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <div class="two">
        <label>Held At <span class="muted">(optional)</span><input name="institution" maxlength="80" value="${esc(a?.institution)}" placeholder="E.g. Fidelity" autocomplete="off"></label>
        <label>From Job <span class="muted">(optional)</span><select name="job"><option value="">None</option>
          ${jobs.map(j => `<option value="${j.id}"${a?.job_id === j.id ? ' selected' : ''}>${esc(j.employer)} (${esc(people.find(p => p.id === j.person_id)?.name || '')})</option>`).join('')}</select></label>
      </div>
      ${a ? `<label>Closed On <span class="muted">(optional)</span><input type="date" name="closed_on" value="${esc(a.closed_on || '')}"></label>
        <p class="hint">For an account you emptied or rolled over. It keeps its history and moves to Closed.</p>` : ''}
      <label>Notes <span class="muted">(optional)</span><textarea name="notes" maxlength="2000" rows="2">${esc(a?.notes)}</textarea></label>` });
  if (!f) return null;
  if (f.get('button') === 'delete') {
    const n = a.updates.length;
    if (!await confirmDelete('Delete Account?', `This deletes ${esc(a.name)}${n ? ` and its ${n} update${n === 1 ? '' : 's'}` : ''}. To keep its history, set Closed On instead.`)) return null;
    return busy(null, async () => {
      await sb.from('fire_accounts').delete().eq('id', a.id).then(must);
      flash('Account deleted.');
      return 'deleted';
    });
  }
  const row = { name: f.get('name').trim(), owner_id: f.get('owner') || null, kind: f.get('kind'), institution: f.get('institution').trim(),
    job_id: f.get('job') || null, notes: f.get('notes').trim(), ...(a && { closed_on: f.get('closed_on') || null }) };
  return busy(null, async () => {
    if (a) { await sb.from('fire_accounts').update(row).eq('id', a.id).then(must); flash('Account saved.'); return a.id; }
    const made = await sb.from('fire_accounts').insert(row).select('id').single().then(must);
    flash('Account added. Now add its balance.');
    return made.id;
  });
}

async function accountPage(id) {
  const t = ++navToken;
  view(loading);
  const [{ people, jobs }, accounts] = await Promise.all([loadSalaryData(), loadAccounts()]);
  const jobsById = byId(jobs);
  if (t !== navToken) return;
  const a = accounts.find(x => x.id === id);
  if (!a) return view(`${crumbs([['Accounts', '#/accounts'], ['Not Found']])}<section class="card empty"><h2>Account Not Found</h2>
    <p class="muted">It may have been deleted.</p></section>`);
  const tot = accountTotals(a);
  const stat = (label, v, cls = '') => `<div class="stat"><span>${label}</span><b class="${cls}">${v}</b></div>`;
  const rows = a.updates.map((u, i) => {
    const prev = a.updates[i - 1];
    return { u, change: prev ? u.balance - prev.balance : null, growth: prev ? u.balance - prev.balance - putIn(u) : null };
  }).reverse();
  view(`${crumbs([['Accounts', '#/accounts'], [a.name]])}
    <div class="page-head"><div><h1 class="big">${esc(a.name)}</h1>
      <p class="muted">${[KINDS[a.kind], ownerName(a, people), a.institution, jobs.find(j => j.id === a.job_id)?.employer].filter(Boolean).map(esc).join(' · ')}${a.closed_on ? ` · Closed ${fmtDate(a.closed_on)}` : ''}</p></div>
      <div class="row wrap"><button type="button" id="editAcct">Edit Account</button><button type="button" id="addUpd" class="fill">+ Add Update</button></div></div>
    ${tot ? `<div class="stats">
        ${stat('Balance', money(tot.balance))}
        ${tot.start ? stat(`Started With (${fmtMonthYear(a.updates[0].as_of)})`, money(tot.start)) : ''}
        ${stat('You Put In', money(tot.contributed))}
        ${tot.employer ? stat('Employer Put In', money(tot.employer)) : ''}
        ${tot.moved ? stat('Moved In', signed(tot.moved)) : ''}
        ${stat('Growth', signed(tot.growth), tot.growth > 0 ? 'up' : tot.growth < 0 ? 'down' : '')}
      </div>
      ${a.updates.length > 1 ? `<section class="card"><h2>Balance</h2>${balanceChart(a.updates, tot.start)}
        <div class="legend"><span><i></i>Balance</span><span><i class="put"></i>Started with + put in</span></div></section>` : ''}
      <section class="card"><h2>Updates</h2><p class="hint">Tap an update to change or delete it.</p>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th class="r">Balance</th><th class="r">Change</th><th class="r">Put In</th><th class="r">Growth</th></tr></thead>
        <tbody>${rows.map(({ u, change, growth }) => `<tr class="click" data-upd="${u.id}" tabindex="0">
          <td>${fmtDate(u.as_of)}${u.note ? `<br><span class="muted">${esc(u.note)}</span>` : ''}</td>
          <td class="r">${money(u.balance)}</td>
          <td class="r">${change == null ? '<span class="muted">Start</span>' : signed(change)}</td>
          <td class="r">${putIn(u) ? money(u.contributed + u.employer) + (u.moved ? `<br><span class="muted">${signed(u.moved)} moved</span>` : '') : '<span class="muted">—</span>'}</td>
          <td class="r ${growth > 0 ? 'up' : growth < 0 ? 'down' : ''}">${growth == null ? '' : signed(growth)}</td></tr>`).join('')}</tbody></table></div>
      </section>` : ''}
    ${tot ? accountCompareHTML(a) : ''}
    ${tot ? '' : `<section class="card empty"><h2>No Updates Yet</h2><p class="muted">Add today's balance to start this account's history.</p></section>`}
    ${contribCardHTML(a, jobsById)}
    ${a.notes ? `<section class="card"><h2>Notes</h2><p>${esc(a.notes).replace(/\n/g, '<br>')}</p></section>` : ''}`);
  $('#editAcct').onclick = async () => {
    const r = await accountDialog(a, people, jobs);
    if (r === 'deleted') goTo('#/accounts'); else if (r) redraw();
  };
  $('#addUpd').onclick = () => updateDialog(a, null, jobsById);
  $('#addContrib').onclick = () => contribDialog(a, null, jobs, people);
  const open = el => {
    if (!el) return;
    if (el.dataset.contrib) return contribDialog(a, a.contributions.find(c => c.id === el.dataset.contrib), jobs, people);
    const u = a.updates.find(x => x.id === el.dataset.upd); if (u) updateDialog(a, u, jobsById);
  };
  app.onclick = e => open(e.target.closest('tr[data-upd], tr[data-contrib]'));
  app.onkeydown = e => { if (e.key === 'Enter') open(e.target.closest('tr[data-upd], tr[data-contrib]')); };
}

// Add or change an update. The money fields are what went in since the update before this one. A new update with a
// contribution plan starts with what the plan says went in since then, and follows the date until those boxes are typed in.
async function updateDialog(a, u, jobsById = {}) {
  const before = a.updates.filter(x => x.as_of < (u?.as_of || '9999') && x.id !== u?.id).at(-1);
  const first = !before;
  const plan = (date, source) => Math.round(planBetween(a.contributions, jobsById, dnum(before.as_of) + 1, dnum(date) + 1, source));
  const prefill = !u && !first && a.contributions.length;
  if (prefill) u = { as_of: today(), contributed: plan(today(), 'you'), employer: plan(today(), 'employer'), fromPlan: true };
  if (u?.fromPlan) u.isNew = true;
  const isNew = !u || u.isNew;
  const f = await ask({ title: isNew ? 'Add Update' : 'Change Update', ok: isNew ? 'Add Update' : 'Save', wide: true,
    extra: isNew ? null : { value: 'delete', label: 'Delete Update' },
    onOpen: form => {
      if (!prefill) return;
      const typed = new Set();
      form.addEventListener('input', e => { if (e.target.name === 'contributed' || e.target.name === 'employer') typed.add(e.target.name); });
      form.elements.as_of.addEventListener('change', e => {
        if (!e.target.value || e.target.value <= before.as_of) return;
        for (const [name, source] of [['contributed', 'you'], ['employer', 'employer']])
          if (!typed.has(name)) form.elements[name].value = plan(e.target.value, source) || '';
      });
    },
    body: `<div class="two">
        <label>Date<input type="date" name="as_of" value="${esc(u?.as_of || today())}" max="${today()}" required data-need="Pick the date of this balance."></label>
        ${moneyField('balance', 'Balance', u?.balance ?? '', { required: true, need: 'Enter the balance on that date.' })}
      </div>
      <p class="hint">${first ? 'This is the first update, so it sets where the account started. If the account is new, put the money you put in below; whatever else is in the balance counts as what it started with.'
        : `What went in since the update before (${fmtDate(before.as_of)}). Leave a box empty for none.${prefill ? ' Filled in from your contributions; change them to match your statement.' : ''}`}</p>
      <div class="three">
        ${moneyField('contributed', 'You Put In', u?.contributed || '')}
        ${moneyField('employer', 'Employer Put In', u?.employer || '', { hint: '(match)' })}
        ${moneyField('moved', 'Moved In', u?.moved || '', { negative: true, hint: '(rollover)' })}
      </div>
      <p class="hint">Moved In is money from another of your accounts, like a rollover (a minus for money moved out). It isn't new savings.</p>
      <label>Note <span class="muted">(optional)</span><input name="note" maxlength="500" value="${esc(u?.note)}" autocomplete="off"></label>` });
  if (!f) return;
  if (f.get('button') === 'delete') {
    if (!await confirmDelete('Delete Update?', `This deletes the ${esc(fmtDate(u.as_of))} balance of ${esc(money(u.balance))}.`)) return;
    return busy(null, async () => {
      await sb.from('fire_updates').delete().eq('id', u.id).then(must);
      flash('Update deleted.');
      redraw();
    });
  }
  const row = { account_id: a.id, as_of: f.get('as_of'), balance: num(f.get('balance')), contributed: num(f.get('contributed')) || 0,
    employer: num(f.get('employer')) || 0, moved: num(f.get('moved')) || 0, note: f.get('note').trim() };
  await busy(null, async () => {
    if (!isNew) await sb.from('fire_updates').update(row).eq('id', u.id).then(must);
    else await sb.from('fire_updates').insert(row).then(must);
    flash(isNew ? 'Update added.' : 'Update saved.');
    redraw();
  });
}

// A round step for chart gridlines: 1, 2, 2.5 or 5 × a power of ten.
function niceStep(range, ticks = 4) {
  const raw = range / ticks || 1, p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
}

// Balance over time (a line on a date scale) and, dashed, the starting balance plus everything put in so far.
function balanceChart(updates, start) {
  const W = 640, H = 230, L = 52, R = 10, T = 10, B = 26;
  const times = updates.map(u => day(u.as_of).getTime());
  let put = start;
  const puts = updates.map((u, i) => i ? (put += putIn(u)) : start + putIn(u));
  const hi = Math.max(...updates.map(u => u.balance), ...puts), step = niceStep(hi), top = Math.ceil(hi / step) * step || 1;
  const t0 = times[0], t1 = times.at(-1), span = t1 - t0 || 1;
  const x = t => L + (t - t0) / span * (W - L - R), y = v => T + (1 - v / top) * (H - T - B);
  const line = vals => vals.map((v, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const balLine = line(updates.map(u => u.balance));
  const grid = [];
  for (let v = 0; v <= top + 1e-9; v += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`);
  // Year labels: each Jan 1 inside the range, thinned to about six; else the two end dates.
  const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear(), every = Math.ceil((y1 - y0) / 6) || 1;
  const years = [];
  for (let yr = y0 + 1; yr <= y1; yr++) if ((yr - y0) % every === 0) years.push(yr);
  const xLabels = years.length ? years.map(yr => `<text x="${x(new Date(yr, 0, 1).getTime())}" y="${H - 6}" text-anchor="middle">${yr}</text>`)
    : [[t0, 'start'], [t1, 'end']].map(([tm, anchor]) => `<text x="${x(tm)}" y="${H - 6}" text-anchor="${anchor}">${fmtMonthYear(iso(new Date(tm)))}</text>`);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance over time">
    <g class="grid">${grid.join('')}</g><g class="axis">${xLabels.join('')}</g>
    <path class="area" d="${balLine}L${x(t1)},${y(0)}L${x(t0)},${y(0)}Z"/>
    <path class="put" d="${line(puts)}"/><path class="bal" d="${balLine}"/>
    ${updates.length <= 40 ? updates.map((u, i) => `<circle class="dot" cx="${x(times[i])}" cy="${y(u.balance)}" r="3"><title>${fmtDate(u.as_of)}: ${money(u.balance)}</title></circle>`).join('') : ''}
  </svg>`;
}
