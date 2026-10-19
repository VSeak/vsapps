// ---------- Salary: jobs, pay changes, bonuses, W-2 totals ----------
// A job's pay is a list of changes, each starting on a date and lasting until the next one (or the job's end date).
// A year's estimate is the paychecks paid that year (by pay days, below; without them each rate prorated by the days
// it was in effect), plus that year's bonuses. A W-2 total for the
// job and year replaces the estimate (it already has the bonuses in it). The current year is estimated to Dec 31.

const PAY_KINDS = { salary: 'Salary', hourly: 'Hourly', none: 'No Pay' };
const WEEKS = 52;

const loadJobs = () => sb.from('fire_jobs').select('*').order('start_date').then(must);
async function loadSalaryData() {
  const [people, jobs, pays, bonuses, actuals, yearPay] = await Promise.all([loadPeople(), loadJobs(),
    sb.from('fire_pay').select('*').order('start_date').then(must), sb.from('fire_bonuses').select('*').order('paid_on').then(must),
    sb.from('fire_job_actuals').select('*').then(must), sb.from('fire_year_pay').select('*').order('year').then(must)]);
  for (const j of jobs) {
    j.pays = pays.filter(p => p.job_id === j.id);
    j.bonuses = bonuses.filter(b => b.job_id === j.id);
    j.actuals = Object.fromEntries(actuals.filter(a => a.job_id === j.id).map(a => [a.year, +a.amount]));
  }
  return { people, jobs, yearPay };
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

// ---------- Pay days ----------
// A job with pay days is paid on them, so a year's pay is the paychecks dated that year (as a W-2 counts it: late
// December's work paid in January counts in January's year). Each paycheck pays the days since the payday before,
// as 1/paychecks of the yearly rate when the job ran the whole time, less for a first or last partial one, mixed when
// the rate changed in between. A payday on a weekend is paid the Friday before. Without pay days, pay is spread by day.
const hasPayDays = job => (job.paychecks === 24 && job.pay_days?.length === 2) || (job.paychecks === 12 && job.pay_days?.length === 1)
  || ((job.paychecks === 26 || job.paychecks === 52) && !!job.pay_anchor);
// The job's paydays (as scheduled, before the weekend move) from day a to day b, both included.
function payDays(job, a, b) {
  const out = [];
  if (job.paychecks === 26 || job.paychecks === 52) {
    const step = job.paychecks === 26 ? 14 : 7, an = dnum(job.pay_anchor);
    for (let d = an + Math.ceil((a - an) / step) * step; d <= b; d += step) out.push(d);
    return out;
  }
  const days = [...job.pay_days].sort((x, y) => x - y), s = new Date(a * 864e5), e = new Date(b * 864e5);
  for (let y = s.getUTCFullYear(), m = s.getUTCMonth(); y * 12 + m <= e.getUTCFullYear() * 12 + e.getUTCMonth(); m === 11 ? (y++, m = 0) : m++) {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (const pd of days) { const d = Date.UTC(y, m, Math.min(pd, last)) / 864e5; if (d >= a && d <= b) out.push(d); }
  }
  return out;
}
const paidOn = d => { const w = new Date(d * 864e5).getUTCDay(); return w === 6 ? d - 1 : w === 0 ? d - 2 : d; };
// Yearly rate × days, added up over the days from a up to (not including) b.
function rateDaysBetween(job, a, b) {
  return payPeriods(job).reduce((s, p) => s + p.rate * Math.max(0, Math.min(p.to, b) - Math.max(p.from, a)), 0);
}
// The paychecks paid from day `from` up to (not including) day `to`: [{day (paid), amount}]. null without pay days.
function paychecks(job, from, to) {
  if (!hasPayDays(job)) return null;
  from = Math.max(from, dnum(job.start_date));
  const end = job.end_date ? dnum(job.end_date) + 45 : Infinity;   // the last paycheck comes after the last day
  to = Math.min(to, end);
  if (to <= from) return [];
  const days = payDays(job, from - 45, to + 3), out = [];
  for (let i = 1; i < days.length; i++) {
    const paid = paidOn(days[i]);
    if (paid < from || paid >= to) continue;
    const len = days[i] - days[i - 1], amount = rateDaysBetween(job, days[i - 1] + 1, days[i] + 1) / len / job.paychecks;
    if (amount > 0) out.push({ day: paid, amount });
  }
  return out;
}
const payDaysText = job => !hasPayDays(job) ? '' : job.pay_anchor ? `${PAYCHECKS[job.paychecks].toLowerCase()} from ${fmtDate(job.pay_anchor)}`
  : `on the ${job.pay_days.map(n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')).join(' and ')}`;

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
  const checks = paychecks(job, ys, ye);
  if (checks) base = checks.reduce((s, c) => s + c.amount, 0);
  if (!days && !base && !job.bonuses.some(b => +b.paid_on.slice(0, 4) === y) && job.actuals[y] == null) return null;
  const bonuses = job.bonuses.filter(b => +b.paid_on.slice(0, 4) === y);
  const bonus = bonuses.reduce((s, b) => s + (b.amount != null ? +b.amount : +b.percent / 100 * (rateOn(job, dnum(b.paid_on)) || 0)), 0);
  const actual = job.actuals[y] ?? null;
  // The rate at the end of the year, or on the job's last day if it ended that year.
  const end = job.end_date ? Math.min(ye - 1, dnum(job.end_date)) : ye - 1;
  const estimate = base + bonus;
  return { y, job, base, bonus, estimate, actual, earned: actual ?? estimate, estimated: actual == null, checks: checks?.length ?? null,
    avgRate: days ? rateDays / days : null, endRate: end >= ys ? rateOn(job, end) : null, current: ye > now && !(job.end_date && dnum(job.end_date) < now) };
}

const fullYears = (job, upTo) => {
  const out = [];
  for (let y = +job.start_date.slice(0, 4); y <= upTo; y++) { const r = jobYear(job, y); if (r) out.push(r); }
  return out;
};

// One person's years: from the start age (or their first job) to this year, gaps included.
// A person's W-2 total for a year (fire_year_pay, for years without job details) replaces their jobs' numbers.
function personYears(person, jobs, startAge, yearPay = []) {
  const mine = jobs.filter(j => j.person_id === person.id), cy = new Date().getFullYear();
  const totals = Object.fromEntries(yearPay.filter(t => t.person_id === person.id).map(t => [t.year, +t.amount]));
  const born = person.birth_date ? +person.birth_date.slice(0, 4) : null;
  const firsts = [...mine.map(j => +j.start_date.slice(0, 4)), ...Object.keys(totals).map(Number)];
  if (!firsts.length) return [];
  const from = Math.min(born != null ? born + startAge : Infinity, ...firsts);
  const out = [];
  for (let y = from; y <= cy; y++) {
    const parts = mine.map(j => jobYear(j, y)).filter(Boolean);
    // The pay rate on Dec 31 (today, this year), all jobs together.
    const at = y === cy ? dnum(today()) : yearStart(y + 1) - 1;
    const rate = mine.reduce((s, j) => s + (rateOn(j, at) || 0), 0);
    const w2 = totals[y] ?? null;
    out.push({ y, age: born != null ? y - born : null, parts, w2, earned: w2 ?? parts.reduce((s, p) => s + p.earned, 0),
      estimated: w2 == null && parts.some(p => p.estimated), rate, current: y === cy, has: w2 != null || parts.length > 0 });
  }
  return out;
}

// Both people's years side by side. A joint W-2 total (person_id null) replaces the household total that year.
function householdYears(people, jobs, startAge, yearPay = []) {
  const per = people.map(p => ({ p, years: personYears(p, jobs, startAge, yearPay) }));
  const joint = Object.fromEntries(yearPay.filter(t => !t.person_id).map(t => [t.year, +t.amount]));
  const ys = [...new Set([...per.flatMap(x => x.years.map(r => r.y)), ...Object.keys(joint).map(Number)])].sort((a, b) => b - a);
  const rows = ys.map(y => {
    const cells = per.map(x => x.years.find(r => r.y === y));
    const j = joint[y] ?? null;
    return { y, cells, joint: j, total: j ?? cells.reduce((s, r) => s + (r?.earned || 0), 0), estimated: j == null && cells.some(r => r?.estimated) };
  });
  return { per, rows, payByYear: Object.fromEntries(rows.map(r => [r.y, r.total])) };
}

// Growth of yearly pay from W-2 totals, for someone without pay rates: first to last finished year with pay.
function earnedGrowth(years, inflation) {
  const done = years.filter(r => !r.current && r.earned > 0);
  if (done.length < 2) return null;
  const a = done[0], b = done.at(-1), n = b.y - a.y, g = (b.earned / a.earned) ** (1 / n) - 1;
  return { from: a, to: b, nominal: g, real: (1 + g) / (1 + inflation / 100) - 1, byEarned: true };
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

// What you put in (not employer, not moved) per calendar year. From account updates where they cover the days: each
// update's money is spread evenly over the days since the update before it (a first update's lands on its date).
// Days an account's updates don't cover (before its first, after its last, up to today) come from its contribution plan.
function savedByYear(accounts, jobsById = {}) {
  const out = {};
  const add = (y, v) => { out[y] = (out[y] || 0) + v; };
  for (const a of accounts) {
    a.updates.forEach((u, i) => {
      if (!u.contributed) return;
      const prev = a.updates[i - 1], b = dnum(u.as_of) + 1, s = prev ? dnum(prev.as_of) + 1 : b - 1, span = b - s;
      for (let y = new Date(s * 864e5).getUTCFullYear(); y <= new Date((b - 1) * 864e5).getUTCFullYear(); y++)
        add(y, u.contributed * (Math.min(b, yearStart(y + 1)) - Math.max(s, yearStart(y))) / span);
    });
    const first = a.updates[0] ? dnum(a.updates[0].as_of) : Infinity, last = a.updates.at(-1) ? dnum(a.updates.at(-1).as_of) : -Infinity;
    planBetween(a.contributions || [], jobsById, -Infinity, dnum(today()) + 1, 'you', d => d >= first && d <= last, out);
  }
  return out;
}

// ---------- Pages ----------

async function salaryPage() {
  const t = ++navToken;
  view(loading);
  const [{ people, jobs, yearPay }, settings, accounts] = await Promise.all([loadSalaryData(), loadSettings(), loadAccounts()]);
  if (t !== navToken) return;
  const { inflation, start_age } = settings;
  const cy = new Date().getFullYear();
  const { per, rows: hhRows } = householdYears(people, jobs, start_age, yearPay);
  const saved = savedByYear(accounts, byId(jobs));
  const stat = (label, v, sub = '') => `<div class="stat"><span>${label}</span><b>${v}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
  const estChip = '<span class="chip warn">Est.</span>', w2Chip = '<span class="chip ok">W-2</span>';

  // Household: both people's years side by side, with what you saved. Tap a row to set a joint W-2 total.
  const household = hhRows.map(h => ({ ...h, saved: saved[h.y] || 0 }));
  const lifetime = household.reduce((s, h) => s + h.total, 0);
  const lifetimeReal = household.reduce((s, h) => s + todaysDollars(h.total, h.y, inflation), 0);
  const thisYear = household.find(h => h.y === cy);

  const personCard = ({ p, years }) => {
    const myJobs = jobs.filter(j => j.person_id === p.id).sort((a, b) => (a.end_date ? 1 : 0) - (b.end_date ? 1 : 0) || b.start_date.localeCompare(a.start_date));
    const g = rateGrowth(years, inflation) || earnedGrowth(years, inflation), now = years.at(-1);
    const life = years.reduce((s, r) => s + r.earned, 0);
    const rows = [...years].reverse().map((r, i, arr) => {
      const prev = arr[i + 1], change = prev?.rate > 0 && r.rate > 0 ? r.rate / prev.rate - 1 : null;
      return `<tr class="click" tabindex="0" data-w2-person="${p.id}" data-w2-year="${r.y}"><td>${r.y}${r.age != null ? `<br><span class="muted">Age ${r.age}</span>` : ''}</td>
        <td class="r">${r.has ? money(r.earned) : '<span class="muted">—</span>'} ${r.w2 != null ? w2Chip : r.estimated ? estChip : ''}
          ${r.w2 == null && r.parts.length > 1 ? r.parts.map(x => `<br><span class="muted">${esc(x.job.employer)} ${money(x.earned)}</span>`).join('') : ''}</td>
        <td class="r">${r.rate ? money(r.rate) : '<span class="muted">—</span>'}</td>
        <td class="r ${change > 0 ? 'up' : change < 0 ? 'down' : ''}">${change == null ? '' : (change > 0 ? '+' : '') + pct(change)}</td>
        <td class="r">${r.has ? money(todaysDollars(r.earned, r.y, inflation)) : ''}</td></tr>`;
    }).join('');
    return `<section class="card"><div class="row between wrap"><h2>${esc(p.name)}</h2>
        <div class="row wrap"><button type="button" class="small" data-w2-person="${p.id}">+ W-2 Total</button>
        <button type="button" class="small" data-add-job="${p.id}">+ Add Job</button></div></div>
      ${years.length ? `<div class="stats">
          ${stat('Pay Rate Now', now?.rate ? money(now.rate) : '—', 'all jobs, a year')}
          ${stat('Raises a Year', g ? pct(g.nominal) : '—', g ? `${g.from.y}–${g.to.y}${g.byEarned ? ', from yearly pay' : ''}` : 'needs two years')}
          ${stat('After Inflation', g ? pct(g.real) : '—', `at ${inflation}% inflation`)}
          ${stat('Lifetime Pay', money(life), 'through this year')}
        </div>
        ${myJobs.length ? `<h3>Jobs</h3><div class="acct-list">${myJobs.map(j => {
          const r = rateOn(j, dnum(today()));
          return `<a class="card acct${j.end_date ? ' closed' : ''}" href="#/job/${j.id}">
            <span class="acct-name">${esc(j.employer)}${j.title ? ` <span class="muted">· ${esc(j.title)}</span>` : ''}</span>
            <span class="acct-bal">${j.end_date ? '' : r != null ? money(r) : ''}</span>
            <span class="acct-meta">${fmtMonthYear(j.start_date)} – ${j.end_date ? fmtMonthYear(j.end_date) : 'now'}${!j.end_date && j.pays.at(-1) ? ' · ' + esc(payText(j.pays.at(-1))) : ''}${j.pays.length ? '' : ' · No pay entered'}</span></a>`;
        }).join('')}</div>` : ''}
        <h3>By Year</h3>
        <div class="table-wrap"><table><thead><tr><th>Year</th><th class="r">Earned</th><th class="r">Pay Rate</th><th class="r">Change</th><th class="r">Today's $</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="hint" style="margin-top:.6rem">Tap a year to set ${esc(p.name)}'s W-2 total for it, for years without job details (it replaces the jobs' numbers that year).
          Pay Rate is every job's yearly rate on Dec 31 (today, for this year), without bonuses. Est. means no W-2 total yet.</p>`
      : `<p class="muted">No pay yet. Add each job, or just a W-2 total for each year you have one.</p>`}
    </section>`;
  };

  view(`<div class="page-head"><div><h1 class="big">Salary</h1>
      <p class="muted">Every job, every raise, every bonus, or just each year's W-2.</p></div>
      <button type="button" class="button" data-w2-person="">+ Joint W-2 Total</button></div>
    ${household.length ? `<section class="card"><h2>Household</h2>
      <div class="stats">
        ${stat(`${cy} Pay`, thisYear ? money(thisYear.total) : '—', thisYear?.estimated ? 'estimated to Dec 31' : '')}
        ${stat('Lifetime Pay', money(lifetime), 'through this year')}
        ${stat("In Today's Dollars", money(lifetimeReal), `at ${inflation}% inflation`)}
      </div>
      <div class="table-wrap"><table><thead><tr><th>Year</th>${per.map(x => `<th class="r">${esc(x.p.name)}</th>`).join('')}<th class="r">Total</th>
        <th class="r">You Saved</th><th class="r">Savings Rate</th></tr></thead>
        <tbody>${household.map(h => `<tr class="click" tabindex="0" data-w2-person="" data-w2-year="${h.y}"><td>${h.y}${h.joint != null ? '' : h.estimated ? ` ${estChip}` : ''}</td>
          ${h.cells.map(r => `<td class="r">${r?.has ? money(r.earned) : '<span class="muted">—</span>'}${r?.age != null ? `<br><span class="muted">Age ${r.age}</span>` : ''}</td>`).join('')}
          <td class="r">${h.total ? `<b>${money(h.total)}</b>` : '<span class="muted">—</span>'}${h.joint != null ? '<br><span class="chip ok">Joint W-2</span>' : ''}</td>
          <td class="r">${h.saved ? money(h.saved) : '<span class="muted">—</span>'}</td>
          <td class="r">${h.saved && h.total ? pct(h.saved / h.total) : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint" style="margin-top:.6rem">Tap a year to set a joint W-2 total (both of you together, like the wages on a joint tax return); it replaces the Total that year.
        You Saved is what you both put into your accounts that year (not the employer match or rollovers): from account updates, and from each account's contributions for the time its updates don't cover.</p>
    </section>` : ''}
    ${per.map(personCard).join('')}`);
  const open = async el => {
    if (!el) return;
    if (el.dataset.addJob) { const id = await jobDialog(null, people, el.dataset.addJob); if (id) goTo('#/job/' + id); return; }
    const pid = el.dataset.w2Person || null, y = el.dataset.w2Year ? +el.dataset.w2Year : null;
    const row = y == null ? null : pid ? per.find(x => x.p.id === pid).years.find(r => r.y === y) : household.find(h => h.y === y);
    yearPayDialog(pid ? people.find(p => p.id === pid) : null, y, yearPay, row);
  };
  app.onclick = e => open(e.target.closest('[data-add-job], [data-w2-person]'));
  app.onkeydown = e => { if (e.key === 'Enter') open(e.target.closest('tr[data-w2-person]')); };
}

// A person's (or the joint) W-2 total for a year. Empty removes it.
async function yearPayDialog(person, year, yearPay, row) {
  const cy = new Date().getFullYear(), who = person ? person.name : 'Both of You (Joint)';
  const have = year != null ? yearPay.find(t => (t.person_id || null) === (person?.id || null) && t.year === year) : null;
  const shown = row ? (person ? row.parts.reduce((s, p) => s + p.earned, 0) : row.cells.reduce((s, r) => s + (r?.earned || 0), 0)) : 0;
  const f = await ask({ title: `${who}: W-2 Total`, ok: 'Save',
    body: `<div class="two">
        <label>Year<input type="number" name="year" min="1950" max="${cy}" value="${year ?? cy - 1}" ${year != null ? 'readonly' : ''} required data-need="Enter the year." data-range="Use a year up to ${cy}."></label>
        ${moneyField('amount', 'W-2 Total', have ? +have.amount : '', { hint: '(blank = none)' })}
      </div>
      <p class="hint">${person ? `All of ${esc(person.name)}'s W-2s for the year added up (box 5 is usually closest to full pay). It replaces the numbers from ${esc(person.name)}'s jobs that year.`
        : "Both of your W-2s added up, like the wages on a joint tax return. It replaces the household Total that year; each person's own column stays as it is."}
        ${shown && !have ? ` Right now that year shows ${money(shown)}.` : ''}</p>` });
  if (!f) return;
  const y = +f.get('year'), v = num(f.get('amount'));
  await busy(null, async () => {
    let del = sb.from('fire_year_pay').delete().eq('year', y);
    del = person ? del.eq('person_id', person.id) : del.is('person_id', null);
    await del.then(must);
    if (v != null) await sb.from('fire_year_pay').insert({ person_id: person?.id || null, year: y, amount: v }).then(must);
    flash(v == null ? 'W-2 total removed.' : 'W-2 total saved.');
    redraw();
  });
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
      <p class="muted">${[person?.name, j.title, `${fmtDate(j.start_date)} – ${j.end_date ? fmtDate(j.end_date) : 'now'}`, `Paid ${(PAYCHECKS[j.paychecks] || '').toLowerCase()}${hasPayDays(j) ? ' ' + payDaysText(j).replace(/^[a-z ]+ from/, 'from') : ''}`].filter(Boolean).map(esc).join(' · ')}</p></div>
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
      ${j.bonuses.length ? `<div class="table-wrap"><table><thead><tr><th>Paid On</th><th>Bonus</th><th class="r">Of Pay</th><th class="r">Amount</th></tr></thead>
        <tbody>${[...j.bonuses].reverse().map(b => {
          // Dollars show as a share of the yearly rate that day, and a percent as dollars.
          const rate = rateOn(j, dnum(b.paid_on)) || 0, dollars = b.amount != null ? +b.amount : +b.percent / 100 * rate;
          return `<tr class="click" tabindex="0" data-bonus="${b.id}"><td>${fmtDate(b.paid_on)}</td>
          <td>${b.amount != null ? 'Dollars' : 'Percent'}${b.note ? `<br><span class="muted">${esc(b.note)}</span>` : ''}</td>
          <td class="r${b.amount != null ? ' muted' : ''}">${b.amount != null ? (rate ? pct(dollars / rate) : '') : `${+b.percent}%`}</td>
          <td class="r${b.amount != null ? '' : ' muted'}">${money(dollars)}</td></tr>`;
        }).join('')}</tbody></table></div>`
      : '<p class="muted">No bonuses yet.</p>'}
    </section>
    <section class="card"><h2>By Year</h2>
      <p class="hint">Tap a year to add its W-2 total (box 1 is after pre-tax 401(k) money comes out, so box 5 is usually closer to your full pay). It replaces the estimate.</p>
      ${years.length ? `<div class="table-wrap"><table><thead><tr><th>Year</th><th class="r">Estimate</th><th class="r">W-2</th><th class="r">Avg Rate</th></tr></thead>
        <tbody>${years.map(r => `<tr class="click" tabindex="0" data-year="${r.y}"><td>${r.y}${r.current ? '<br><span class="muted">to Dec 31</span>' : ''}</td>
          <td class="r${r.actual != null ? ' muted' : ''}">${money(r.estimate)}${r.checks != null ? `<br><span class="muted">${r.checks} paycheck${r.checks === 1 ? '' : 's'}</span>` : ''}${r.bonus ? `<br><span class="muted">incl. ${money(r.bonus)} bonus</span>` : ''}</td>
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
      <div class="two">
        <label>Paychecks<select name="paychecks">${Object.entries(PAYCHECKS).map(([n, v]) => `<option value="${n}"${+(j?.paychecks || 24) === +n ? ' selected' : ''}>${v} (${n} a year)</option>`).join('')}</select></label>
        <label data-pdm>Pay Days <span class="muted">(day of the month)</span><span class="row" style="margin-top:.3rem">
          <input type="number" name="pd1" min="1" max="31" inputmode="numeric" value="${esc(j?.pay_days?.[0] ?? '')}" aria-label="First pay day" data-range="Use a day from 1 to 31." style="margin:0">
          <input type="number" name="pd2" min="1" max="31" inputmode="numeric" value="${esc(j?.pay_days?.[1] ?? '')}" aria-label="Second pay day" data-range="Use a day from 1 to 31." style="margin:0"></span></label>
        <label data-pda>A Payday<input type="date" name="pay_anchor" value="${esc(j?.pay_anchor || '')}"></label>
      </div>
      <p class="hint">Pay and paycheck contributions count on these days (a weekend payday counts the Friday before), so a year's pay matches your W-2. Leave them blank to spread pay evenly over the days.</p>
      ${j ? '' : `<h3>Starting Pay</h3>${payFieldsHTML()}<p class="hint">Add raises on the job's page once it's saved.</p>`}
      <label>Notes <span class="muted">(optional)</span><textarea name="notes" maxlength="2000" rows="2">${esc(j?.notes)}</textarea></label>`,
    onOpen: form => {
      if (!j) wirePayFields(form);
      // Twice a month: two days of the month; monthly: one; every two weeks or weekly: one payday date.
      const set = () => {
        const n = +form.elements.paychecks.value;
        form.querySelector('[data-pdm]').hidden = n > 24;
        form.elements.pd2.hidden = n !== 24;
        form.querySelector('[data-pda]').hidden = n <= 24;
      };
      form.elements.paychecks.addEventListener('change', set);
      set();
    } });
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
    end_date: f.get('end_date') || null, paychecks: +f.get('paychecks'), notes: f.get('notes').trim() };
  const n = row.paychecks, days = [f.get('pd1'), n === 24 ? f.get('pd2') : ''].filter(Boolean).map(Number);
  if (n === 24 && days.length === 1) { flash('Twice a month needs both pay days (or neither).', 'error'); return null; }
  row.pay_days = n <= 24 && days.length ? [...new Set(days)].sort((a, b) => a - b) : null;
  if (row.pay_days?.length === 1 && n === 24) { flash('Pick two different pay days.', 'error'); return null; }
  row.pay_anchor = n > 24 ? f.get('pay_anchor') || null : null;
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
