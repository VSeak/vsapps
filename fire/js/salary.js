// ---------- Salary: jobs, pay changes, bonuses, W-2 totals ----------
// A job's pay is a list of changes, each starting on a date and lasting until the next one (or the job's end date).
// A year's estimate is each rate prorated by the days it was in effect, plus that year's bonuses. A W-2 total for the
// job and year replaces the estimate (it already has the bonuses in it). The current year is estimated to Dec 31.

const PAY_KINDS = { salary: 'Salary', hourly: 'Hourly', none: 'No Pay' };
const WEEKS = 52;

const loadJobs = () => sb.from('fire_jobs').select('*').order('start_date').then(must);
async function loadSalaryData() {
  const [people, jobs, pays, bonuses, actuals] = await Promise.all([loadPeople(), loadJobs(),
    sb.from('fire_pay').select('*').order('start_date').then(must), sb.from('fire_bonuses').select('*').order('paid_on').then(must),
    sb.from('fire_job_actuals').select('*').then(must)]);
  for (const j of jobs) {
    j.pays = pays.filter(p => p.job_id === j.id);
    j.bonuses = bonuses.filter(b => b.job_id === j.id);
    j.actuals = Object.fromEntries(actuals.filter(a => a.job_id === j.id).map(a => [a.year, +a.amount]));
  }
  return { people, jobs };
}

// Day numbers (days since 1970, UTC) so date math has no time-zone or daylight-saving surprises.
const dnum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
const yearStart = y => Date.UTC(y, 0, 1) / 864e5;
const yearDays = y => yearStart(y + 1) - yearStart(y);
const yearlyRate = p => p.kind === 'salary' ? +p.amount : p.kind === 'hourly' ? +p.amount * +p.hours_per_week * WEEKS : 0;
const payText = p => p.kind === 'salary' ? `${money(p.amount)}/yr` : p.kind === 'hourly'
  ? `${moneyCents(p.amount).replace(/\.00$/, '')}/hr × ${+p.hours_per_week} hrs/wk` : 'No pay';

// The job's pay as periods: from (a day number) up to but not including to, at a yearly rate.
function payPeriods(job) {
  const start = dnum(job.start_date), end = job.end_date ? dnum(job.end_date) + 1 : Infinity;
  return job.pays.map((p, i) => ({
    from: Math.max(dnum(p.start_date), start),
    to: Math.min(job.pays[i + 1] ? dnum(job.pays[i + 1].start_date) : Infinity, end),
    rate: yearlyRate(p), pay: p,
  })).filter(x => x.to > x.from);
}
// The yearly rate on a day: null when the job has no pay then (before it starts, after it ends, no pay entered).
function rateOn(job, d) {
  const p = payPeriods(job).find(x => x.from <= d && d < x.to);
  return p ? p.rate : null;
}

// One job in one year. null for a year it has nothing in (or a year that hasn't started).
function jobYear(job, y) {
  const ys = yearStart(y), ye = yearStart(y + 1), now = dnum(today());
  if (ys > now) return null;
  let base = 0, days = 0, rateDays = 0;
  for (const p of payPeriods(job)) {
    const a = Math.max(p.from, ys), b = Math.min(p.to, ye);
    if (b <= a) continue;
    base += p.rate * (b - a) / yearDays(y);
    days += b - a;
    rateDays += p.rate * (b - a);
  }
  const bonuses = job.bonuses.filter(b => +b.paid_on.slice(0, 4) === y);
  const bonus = bonuses.reduce((s, b) => s + (b.amount != null ? +b.amount : +b.percent / 100 * (rateOn(job, dnum(b.paid_on)) || 0)), 0);
  const actual = job.actuals[y] ?? null;
  if (!days && !bonuses.length && actual == null) return null;
  // The rate at the end of the year, or on the job's last day if it ended that year.
  const end = job.end_date ? Math.min(ye - 1, dnum(job.end_date)) : ye - 1;
  const estimate = base + bonus;
  return { y, job, base, bonus, estimate, actual, earned: actual ?? estimate, estimated: actual == null,
    avgRate: days ? rateDays / days : null, endRate: end >= ys ? rateOn(job, end) : null, current: ye > now };
}

const fullYears = (job, upTo) => {
  const out = [];
  for (let y = +job.start_date.slice(0, 4); y <= upTo; y++) { const r = jobYear(job, y); if (r) out.push(r); }
  return out;
};

// One person's years: from the start age (or their first job) to this year, gaps included.
function personYears(person, jobs, startAge) {
  const mine = jobs.filter(j => j.person_id === person.id), cy = new Date().getFullYear();
  const born = person.birth_date ? +person.birth_date.slice(0, 4) : null;
  const firsts = mine.map(j => +j.start_date.slice(0, 4));
  if (!firsts.length) return [];
  const from = Math.min(born != null ? born + startAge : Infinity, ...firsts);
  const out = [];
  for (let y = from; y <= cy; y++) {
    const parts = mine.map(j => jobYear(j, y)).filter(Boolean);
    // The pay rate on Dec 31 (today, this year), all jobs together.
    const at = y === cy ? dnum(today()) : yearStart(y + 1) - 1;
    const rate = mine.reduce((s, j) => s + (rateOn(j, at) || 0), 0);
    out.push({ y, age: born != null ? y - born : null, parts, earned: parts.reduce((s, p) => s + p.earned, 0),
      estimated: parts.some(p => p.estimated), rate, current: y === cy });
  }
  return out;
}

// Pay-rate growth a year: from the first year with a rate to this year's. Real = after inflation.
function rateGrowth(years, inflation) {
  const withRate = years.filter(r => r.rate > 0);
  if (withRate.length < 2) return null;
  const a = withRate[0], b = withRate.at(-1), n = b.y - a.y;
  if (n < 1) return null;
  const g = (b.rate / a.rate) ** (1 / n) - 1;
  return { from: a, to: b, nominal: g, real: (1 + g) / (1 + inflation / 100) - 1 };
}
const todaysDollars = (amount, y, inflation) => amount * (1 + inflation / 100) ** (new Date().getFullYear() - y);

// What you put in (not employer, not moved) per calendar year, from account updates: each update's money is spread
// evenly over the days since the update before it (a first update's lands on its date).
function savedByYear(accounts) {
  const out = {};
  const add = (y, v) => { out[y] = (out[y] || 0) + v; };
  for (const a of accounts) a.updates.forEach((u, i) => {
    if (!u.contributed) return;
    const prev = a.updates[i - 1], b = dnum(u.as_of) + 1, s = prev ? dnum(prev.as_of) + 1 : b - 1, span = b - s;
    for (let y = new Date(s * 864e5).getUTCFullYear(); y <= new Date((b - 1) * 864e5).getUTCFullYear(); y++)
      add(y, u.contributed * (Math.min(b, yearStart(y + 1)) - Math.max(s, yearStart(y))) / span);
  });
  return out;
}

// ---------- Pages ----------

async function salaryPage() {
  const t = ++navToken;
  view(loading);
  const [{ people, jobs }, settings, accounts] = await Promise.all([loadSalaryData(), loadSettings(), loadAccounts()]);
  if (t !== navToken) return;
  const { inflation, start_age } = settings;
  const cy = new Date().getFullYear();
  const per = people.map(p => ({ p, years: personYears(p, jobs, start_age) }));
  const saved = savedByYear(accounts);
  const stat = (label, v, sub = '') => `<div class="stat"><span>${label}</span><b>${v}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
  const estChip = '<span class="chip warn">Est.</span>';

  // Household: both people's years side by side, with what you saved.
  const allYears = [...new Set(per.flatMap(x => x.years.map(r => r.y)))].sort((a, b) => b - a);
  const household = allYears.map(y => {
    const cells = per.map(x => x.years.find(r => r.y === y));
    const total = cells.reduce((s, r) => s + (r?.earned || 0), 0);
    return { y, cells, total, estimated: cells.some(r => r?.estimated), saved: saved[y] || 0 };
  });
  const lifetime = household.reduce((s, h) => s + h.total, 0);
  const lifetimeReal = household.reduce((s, h) => s + todaysDollars(h.total, h.y, inflation), 0);
  const thisYear = household.find(h => h.y === cy);

  const personCard = ({ p, years }) => {
    const myJobs = jobs.filter(j => j.person_id === p.id).sort((a, b) => (a.end_date ? 1 : 0) - (b.end_date ? 1 : 0) || b.start_date.localeCompare(a.start_date));
    const g = rateGrowth(years, inflation), now = years.at(-1);
    const life = years.reduce((s, r) => s + r.earned, 0);
    const rows = [...years].reverse().map((r, i, arr) => {
      const prev = arr[i + 1], change = prev?.rate > 0 && r.rate > 0 ? r.rate / prev.rate - 1 : null;
      return `<tr><td>${r.y}${r.age != null ? `<br><span class="muted">Age ${r.age}</span>` : ''}</td>
        <td class="r">${r.parts.length ? money(r.earned) : '<span class="muted">—</span>'} ${r.estimated ? estChip : ''}
          ${r.parts.length > 1 ? r.parts.map(x => `<br><span class="muted">${esc(x.job.employer)} ${money(x.earned)}</span>`).join('') : ''}</td>
        <td class="r">${r.rate ? money(r.rate) : '<span class="muted">—</span>'}</td>
        <td class="r ${change > 0 ? 'up' : change < 0 ? 'down' : ''}">${change == null ? '' : (change > 0 ? '+' : '') + pct(change)}</td>
        <td class="r">${r.parts.length ? money(todaysDollars(r.earned, r.y, inflation)) : ''}</td></tr>`;
    }).join('');
    return `<section class="card"><div class="row between wrap"><h2>${esc(p.name)}</h2>
        <button type="button" class="small" data-add-job="${p.id}">+ Add Job</button></div>
      ${myJobs.length ? `<div class="stats">
          ${stat('Pay Rate Now', now?.rate ? money(now.rate) : '—', 'all jobs, a year')}
          ${stat('Raises a Year', g ? pct(g.nominal) : '—', g ? `${g.from.y}–${g.to.y}` : 'needs two years')}
          ${stat('After Inflation', g ? pct(g.real) : '—', `at ${inflation}% inflation`)}
          ${stat('Lifetime Pay', money(life), 'through this year')}
        </div>
        <h3>Jobs</h3><div class="acct-list">${myJobs.map(j => {
          const r = rateOn(j, dnum(today()));
          return `<a class="card acct${j.end_date ? ' closed' : ''}" href="#/job/${j.id}">
            <span class="acct-name">${esc(j.employer)}${j.title ? ` <span class="muted">· ${esc(j.title)}</span>` : ''}</span>
            <span class="acct-bal">${j.end_date ? '' : r != null ? money(r) : ''}</span>
            <span class="acct-meta">${fmtMonthYear(j.start_date)} – ${j.end_date ? fmtMonthYear(j.end_date) : 'now'}${!j.end_date && j.pays.at(-1) ? ' · ' + esc(payText(j.pays.at(-1))) : ''}${j.pays.length ? '' : ' · No pay entered'}</span></a>`;
        }).join('')}</div>
        <h3>By Year</h3>
        <div class="table-wrap"><table><thead><tr><th>Year</th><th class="r">Earned</th><th class="r">Pay Rate</th><th class="r">Change</th><th class="r">Today's $</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="hint" style="margin-top:.6rem">Pay Rate is every job's yearly rate on Dec 31 (today, for this year), without bonuses. Est. means no W-2 total yet for a job that year; add one on the job.</p>`
      : `<p class="muted">No jobs yet. Add each one, past and present.</p>`}
    </section>`;
  };

  view(`<div class="page-head"><div><h1 class="big">Salary</h1>
      <p class="muted">Every job, every raise, every bonus.</p></div></div>
    ${household.length ? `<section class="card"><h2>Household</h2>
      <div class="stats">
        ${stat(`${cy} Pay`, thisYear ? money(thisYear.total) : '—', thisYear?.estimated ? 'estimated to Dec 31' : '')}
        ${stat('Lifetime Pay', money(lifetime), 'through this year')}
        ${stat("In Today's Dollars", money(lifetimeReal), `at ${inflation}% inflation`)}
      </div>
      <div class="table-wrap"><table><thead><tr><th>Year</th>${per.map(x => `<th class="r">${esc(x.p.name)}</th>`).join('')}<th class="r">Total</th>
        <th class="r">You Saved</th><th class="r">Savings Rate</th></tr></thead>
        <tbody>${household.map(h => `<tr><td>${h.y}${h.estimated ? ` ${estChip}` : ''}</td>
          ${h.cells.map(r => `<td class="r">${r?.parts.length ? money(r.earned) : '<span class="muted">—</span>'}${r?.age != null ? `<br><span class="muted">Age ${r.age}</span>` : ''}</td>`).join('')}
          <td class="r">${h.total ? `<b>${money(h.total)}</b>` : '<span class="muted">—</span>'}</td>
          <td class="r">${h.saved ? money(h.saved) : '<span class="muted">—</span>'}</td>
          <td class="r">${h.saved && h.total ? pct(h.saved / h.total) : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint" style="margin-top:.6rem">You Saved is what you both put into your accounts that year (not the employer match or rollovers), from Accounts.
        An update's money is spread over the months since the update before it.</p>
    </section>` : ''}
    ${per.map(personCard).join('')}`);
  app.onclick = async e => {
    const b = e.target.closest('[data-add-job]');
    if (!b) return;
    const id = await jobDialog(null, people, b.dataset.addJob);
    if (id) goTo('#/job/' + id);
  };
}

async function jobPage(id) {
  const t = ++navToken;
  view(loading);
  const { people, jobs } = await loadSalaryData();
  if (t !== navToken) return;
  const j = jobs.find(x => x.id === id);
  if (!j) return view(`${crumbs([['Salary', '#/salary'], ['Not Found']])}<section class="card empty"><h2>Job Not Found</h2><p class="muted">It may have been deleted.</p></section>`);
  const person = people.find(p => p.id === j.person_id);
  const years = fullYears(j, new Date().getFullYear()).reverse();
  const yearlyNow = j.pays.length ? yearlyRate(j.pays.at(-1)) : null;
  view(`${crumbs([['Salary', '#/salary'], [j.employer]])}
    <div class="page-head"><div><h1 class="big">${esc(j.employer)}</h1>
      <p class="muted">${[person?.name, j.title, `${fmtDate(j.start_date)} – ${j.end_date ? fmtDate(j.end_date) : 'now'}`].filter(Boolean).map(esc).join(' · ')}</p></div>
      <button type="button" id="editJob">Edit Job</button></div>
    <section class="card"><div class="row between wrap"><h2>Pay Changes</h2><button type="button" class="small" id="addPay">+ Add Pay Change</button></div>
      <p class="hint">Each rate lasts until the next change. Add one for every raise, and for switching between hourly and salary.</p>
      ${j.pays.length ? `<div class="table-wrap"><table><thead><tr><th>Starts</th><th>Pay</th><th class="r">A Year</th></tr></thead>
        <tbody>${[...j.pays].reverse().map((p, i, arr) => {
          const prev = arr[i + 1], ch = prev && yearlyRate(prev) > 0 && yearlyRate(p) > 0 ? yearlyRate(p) / yearlyRate(prev) - 1 : null;
          return `<tr class="click" tabindex="0" data-pay="${p.id}"><td>${fmtDate(p.start_date)}</td><td>${esc(payText(p))}</td>
            <td class="r">${p.kind === 'none' ? '' : money(yearlyRate(p))}${ch ? `<br><span class="muted ${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '+' : ''}${pct(ch)}</span>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div>`
      : '<p class="muted">No pay yet. Add what this job paid when you started.</p>'}
    </section>
    <section class="card"><div class="row between wrap"><h2>Bonuses</h2><button type="button" class="small" id="addBonus">+ Add Bonus</button></div>
      ${j.bonuses.length ? `<div class="table-wrap"><table><thead><tr><th>Paid On</th><th>Bonus</th><th class="r">Amount</th></tr></thead>
        <tbody>${[...j.bonuses].reverse().map(b => `<tr class="click" tabindex="0" data-bonus="${b.id}"><td>${fmtDate(b.paid_on)}</td>
          <td>${b.amount != null ? 'Dollars' : `${+b.percent}% of pay`}${b.note ? `<br><span class="muted">${esc(b.note)}</span>` : ''}</td>
          <td class="r">${money(b.amount != null ? b.amount : +b.percent / 100 * (rateOn(j, dnum(b.paid_on)) || 0))}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">No bonuses yet.</p>'}
    </section>
    <section class="card"><h2>By Year</h2>
      <p class="hint">Tap a year to add its W-2 total (box 1 is after pre-tax 401(k) money comes out, so box 5 is usually closer to your full pay). It replaces the estimate.</p>
      ${years.length ? `<div class="table-wrap"><table><thead><tr><th>Year</th><th class="r">Estimate</th><th class="r">W-2</th><th class="r">Avg Rate</th></tr></thead>
        <tbody>${years.map(r => `<tr class="click" tabindex="0" data-year="${r.y}"><td>${r.y}${r.current ? '<br><span class="muted">to Dec 31</span>' : ''}</td>
          <td class="r${r.actual != null ? ' muted' : ''}">${money(r.estimate)}${r.bonus ? `<br><span class="muted">incl. ${money(r.bonus)} bonus</span>` : ''}</td>
          <td class="r">${r.actual != null ? `<b>${money(r.actual)}</b>` : '<span class="link">Add</span>'}</td>
          <td class="r">${r.avgRate != null ? money(r.avgRate) : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">Years show here once the job has pay.</p>'}
    </section>
    ${j.notes ? `<section class="card"><h2>Notes</h2><p>${esc(j.notes).replace(/\n/g, '<br>')}</p></section>` : ''}`);
  $('#editJob').onclick = async () => {
    const r = await jobDialog(j, people);
    if (r === 'deleted') goTo('#/salary'); else if (r) redraw();
  };
  $('#addPay').onclick = () => payDialog(j, null, yearlyNow);
  $('#addBonus').onclick = () => bonusDialog(j, null);
  const open = el => {
    if (!el) return;
    if (el.dataset.pay) payDialog(j, j.pays.find(p => p.id === el.dataset.pay));
    else if (el.dataset.bonus) bonusDialog(j, j.bonuses.find(b => b.id === el.dataset.bonus));
    else if (el.dataset.year) actualDialog(j, years.find(r => r.y === +el.dataset.year));
  };
  app.onclick = e => open(e.target.closest('tr[data-pay], tr[data-bonus], tr[data-year]'));
  app.onkeydown = e => { if (e.key === 'Enter') open(e.target.closest('tr[data-pay], tr[data-bonus], tr[data-year]')); };
}

// ---------- Dialogs ----------

// The pay fields, shared by Add Job and the pay change dialog. Hours a week only for hourly; no amount for No Pay.
function payFieldsHTML(p = null) {
  const kind = p?.kind || 'salary';
  return `<div class="two">
      <label>Paid<select name="kind" data-paykind>${Object.entries(PAY_KINDS).map(([k, v]) => `<option value="${k}"${k === kind ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label data-amount${kind === 'none' ? ' hidden' : ''}><span data-amount-label>${kind === 'hourly' ? 'Hourly Rate' : 'Yearly Salary'}</span>
        <span class="unit dollar"><input name="amount" inputmode="decimal" pattern="${MONEY_PATTERN.replace('-?', '')}" value="${esc(plainNum(p?.amount ?? null))}"
          autocomplete="off" ${kind === 'none' ? '' : 'required'} data-need="Enter the pay."></span></label>
    </div>
    <label data-hours${kind === 'hourly' ? '' : ' hidden'}>Hours a Week <span class="muted">(on average)</span>
      <input type="number" name="hours" min="0" max="100" step="0.5" inputmode="decimal" value="${esc(p?.hours_per_week ?? '')}"
        ${kind === 'hourly' ? 'required' : ''} data-need="Enter about how many hours a week." data-range="Use 0 to 100 hours."></label>`;
}
function wirePayFields(f) {
  const sel = f.querySelector('[data-paykind]');
  const set = () => {
    const k = sel.value, amt = f.elements.amount, hrs = f.elements.hours;
    f.querySelector('[data-amount]').hidden = k === 'none';
    f.querySelector('[data-amount-label]').textContent = k === 'hourly' ? 'Hourly Rate' : 'Yearly Salary';
    f.querySelector('[data-hours]').hidden = k !== 'hourly';
    amt.required = k !== 'none';
    hrs.required = k === 'hourly';
    if (k === 'none') clearFieldError(amt);
    if (k !== 'hourly') clearFieldError(hrs);
  };
  sel.addEventListener('change', set);
}
const readPay = f => {
  const kind = f.get('kind');
  return { kind, amount: kind === 'none' ? 0 : num(f.get('amount')), hours_per_week: kind === 'hourly' ? +f.get('hours') : null };
};

// Add or edit a job (Add also takes its first pay). Returns the id, 'deleted', or null.
async function jobDialog(j, people, personId = null) {
  const f = await ask({ title: j ? 'Edit Job' : 'Add Job', ok: j ? 'Save' : 'Add Job', wide: true,
    extra: j ? { value: 'delete', label: 'Delete Job' } : null,
    body: `<div class="two">
        <label>Employer<input name="employer" maxlength="80" value="${esc(j?.employer)}" required data-need="Enter the employer." autocomplete="off"></label>
        <label>Title <span class="muted">(optional)</span><input name="title" maxlength="80" value="${esc(j?.title)}" autocomplete="off"></label>
      </div>
      <div class="three">
        <label>Whose Job<select name="person">${people.map(p => `<option value="${p.id}"${(j?.person_id || personId) === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label>Started<input type="date" name="start_date" value="${esc(j?.start_date || '')}" required data-need="Pick the day you started."></label>
        <label>Ended <span class="muted">(blank = still there)</span><input type="date" name="end_date" value="${esc(j?.end_date || '')}"></label>
      </div>
      ${j ? '' : `<h3>Starting Pay</h3>${payFieldsHTML()}<p class="hint">Add raises on the job's page once it's saved.</p>`}
      <label>Notes <span class="muted">(optional)</span><textarea name="notes" maxlength="2000" rows="2">${esc(j?.notes)}</textarea></label>`,
    onOpen: form => { if (!j) wirePayFields(form); } });
  if (!f) return null;
  if (f.get('button') === 'delete') {
    if (!await confirmDelete('Delete Job?', `This deletes ${esc(j.employer)} with its pay changes, bonuses and W-2 totals. Accounts linked to it stay.`)) return null;
    return busy(null, async () => {
      await sb.from('fire_jobs').delete().eq('id', j.id).then(must);
      flash('Job deleted.');
      return 'deleted';
    });
  }
  const row = { employer: f.get('employer').trim(), title: f.get('title').trim(), person_id: f.get('person'), start_date: f.get('start_date'),
    end_date: f.get('end_date') || null, notes: f.get('notes').trim() };
  if (row.end_date && row.end_date < row.start_date) { flash('The end date is before the start date.', 'error'); return null; }
  return busy(null, async () => {
    if (j) { await sb.from('fire_jobs').update(row).eq('id', j.id).then(must); flash('Job saved.'); return j.id; }
    const made = await sb.from('fire_jobs').insert(row).select('id').single().then(must);
    await sb.from('fire_pay').insert({ job_id: made.id, start_date: row.start_date, ...readPay(f) }).then(must);
    flash('Job added.');
    return made.id;
  });
}

async function payDialog(j, p, lastYearly = null) {
  const f = await ask({ title: p ? 'Change Pay' : 'Add Pay Change', ok: p ? 'Save' : 'Add', wide: true,
    extra: p ? { value: 'delete', label: 'Delete' } : null,
    body: `<label>Starts On<input type="date" name="start_date" value="${esc(p?.start_date || today())}" min="${j.start_date}"
        ${j.end_date ? `max="${j.end_date}"` : ''} required data-need="Pick the day this pay started." data-range="Pick a day while you had this job."></label>
      ${payFieldsHTML(p || (j.pays.at(-1) ? { ...j.pays.at(-1), amount: null } : null))}
      ${!p && lastYearly ? `<p class="hint">Now: ${esc(payText(j.pays.at(-1)))}.</p>` : ''}`,
    onOpen: wirePayFields });
  if (!f) return;
  if (f.get('button') === 'delete') {
    if (!await confirmDelete('Delete Pay Change?', `This deletes the pay starting ${esc(fmtDate(p.start_date))}. The rate before it lasts until the next change.`)) return;
    return busy(null, async () => { await sb.from('fire_pay').delete().eq('id', p.id).then(must); flash('Pay change deleted.'); redraw(); });
  }
  const row = { job_id: j.id, start_date: f.get('start_date'), ...readPay(f) };
  await busy(null, async () => {
    if (p) await sb.from('fire_pay').update(row).eq('id', p.id).then(must);
    else await sb.from('fire_pay').insert(row).then(must);
    flash(p ? 'Pay saved.' : 'Pay change added.');
    redraw();
  });
}

async function bonusDialog(j, b) {
  const isPct = b ? b.percent != null : false;
  const f = await ask({ title: b ? 'Change Bonus' : 'Add Bonus', ok: b ? 'Save' : 'Add Bonus',
    extra: b ? { value: 'delete', label: 'Delete' } : null,
    body: `<label>Paid On<input type="date" name="paid_on" value="${esc(b?.paid_on || today())}" required data-need="Pick the day it was paid."></label>
      <div class="two">
        <label>Bonus In<select name="type" data-bonustype><option value="amount"${isPct ? '' : ' selected'}>Dollars</option>
          <option value="percent"${isPct ? ' selected' : ''}>Percent of Pay</option></select></label>
        <label><span data-bonus-label>${isPct ? 'Percent' : 'Amount'}</span><span class="unit ${isPct ? 'percent' : 'dollar'}" data-bonus-unit>
          <input name="value" inputmode="decimal" pattern="${MONEY_PATTERN.replace('-?', '')}" value="${esc(plainNum(b ? b.amount ?? b.percent : null))}"
          autocomplete="off" required data-need="Enter the bonus."></span></label>
      </div>
      <p class="hint">A percent is of this job's yearly rate on the day it was paid.</p>
      <label>Note <span class="muted">(optional)</span><input name="note" maxlength="200" value="${esc(b?.note)}" autocomplete="off"></label>`,
    onOpen: form => form.querySelector('[data-bonustype]').addEventListener('change', e => {
      const pc = e.target.value === 'percent';
      form.querySelector('[data-bonus-label]').textContent = pc ? 'Percent' : 'Amount';
      form.querySelector('[data-bonus-unit]').className = `unit ${pc ? 'percent' : 'dollar'}`;
    }) });
  if (!f) return;
  if (f.get('button') === 'delete') {
    if (!await confirmDelete('Delete Bonus?', `This deletes the bonus paid ${esc(fmtDate(b.paid_on))}.`)) return;
    return busy(null, async () => { await sb.from('fire_bonuses').delete().eq('id', b.id).then(must); flash('Bonus deleted.'); redraw(); });
  }
  const v = num(f.get('value')), pc = f.get('type') === 'percent';
  const row = { job_id: j.id, paid_on: f.get('paid_on'), amount: pc ? null : v, percent: pc ? v : null, note: f.get('note').trim() };
  await busy(null, async () => {
    if (b) await sb.from('fire_bonuses').update(row).eq('id', b.id).then(must);
    else await sb.from('fire_bonuses').insert(row).then(must);
    flash(b ? 'Bonus saved.' : 'Bonus added.');
    redraw();
  });
}

// A job's W-2 total for a year. Empty removes it, and the estimate is back.
async function actualDialog(j, r) {
  const f = await ask({ title: `${j.employer} W-2 for ${r.y}`, ok: 'Save',
    body: `<p class="muted">The estimate from your pay rates${r.bonus ? ' and bonuses' : ''} is ${money(r.estimate)}.</p>
      ${moneyField('amount', 'W-2 Total', r.actual ?? '', { hint: '(blank = use the estimate)' })}` });
  if (!f) return;
  const v = num(f.get('amount'));
  await busy(null, async () => {
    if (v == null) await sb.from('fire_job_actuals').delete().eq('job_id', j.id).eq('year', r.y).then(must);
    else await sb.from('fire_job_actuals').upsert({ job_id: j.id, year: r.y, amount: v }).then(must);
    flash(v == null ? 'W-2 removed. The estimate is back.' : 'W-2 saved.');
    redraw();
  });
}
