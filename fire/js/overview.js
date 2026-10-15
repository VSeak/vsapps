// ---------- Overview (Home) and Spending ----------
// Everything here is in today's dollars: the expected return is after inflation, savings stay what they are now,
// and older spending is raised by the Inflation setting. Projections are assumptions, and the page says so.

const ICON_ARROW = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const STALE_DAYS = 365;   // an open account not updated in this long gets a reminder
// Rule-of-thumb savings by age, as a multiple of yearly pay.
// Every 5 years (the user asked); 65 is halfway between 60 and 67.
const MILESTONES = [[30, 1], [35, 2], [40, 3], [45, 4], [50, 6], [55, 7], [60, 8], [65, 9], [67, 10]];
const MAX_YEARS = 70;     // how far a projection looks

const loadSpending = () => sb.from('fire_spending').select('*').order('year', { ascending: false }).then(must);

// Every account's latest balance on a day number, added up (0 for accounts with no update yet).
function totalOn(accounts, d) {
  return accounts.reduce((s, a) => {
    const u = a.updates.filter(x => dnum(x.as_of) <= d).at(-1);
    return s + (u ? u.balance : 0);
  }, 0);
}
// What went in (you + employer, not moved) between two day numbers, each update's money spread over its days.
function putInBetween(accounts, from, to) {
  let sum = 0;
  for (const a of accounts) a.updates.forEach((u, i) => {
    const v = u.contributed + u.employer;
    if (!v || !i) return;   // a first update's money is part of where the account started
    const s = dnum(a.updates[i - 1].as_of) + 1, b = dnum(u.as_of) + 1;
    sum += v * Math.max(0, Math.min(b, to) - Math.max(s, from)) / (b - s);
  });
  return sum;
}

// Month by month at the expected return (after inflation), adding the same savings each month, until the balance
// reaches the target. Returns months (null if not within MAX_YEARS) and the yearly balances for the chart.
function project(balance, yearly, realReturn, target) {
  const m = (1 + realReturn / 100) ** (1 / 12) - 1, add = yearly / 12;
  let b = balance, hit = balance >= target ? 0 : null;
  const path = [b];
  for (let i = 1; i <= MAX_YEARS * 12; i++) {
    b = b * (1 + m) + add;
    if (hit == null && b >= target) hit = i;
    if (i % 12 === 0) path.push(b);
  }
  return { months: hit, path };
}
const atMonths = (balance, yearly, realReturn, months) => {
  const m = (1 + realReturn / 100) ** (1 / 12) - 1;
  return m ? balance * (1 + m) ** months + yearly / 12 * ((1 + m) ** months - 1) / m : balance + yearly / 12 * months;
};
const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
const yearsText = months => { const y = months / 12; return y < 1 ? `${months} month${months === 1 ? '' : 's'}` : `${+y.toFixed(1)} years`; };

async function homePage() {
  const t = ++navToken;
  view(loading);
  const [{ people, jobs }, accounts, settings, spending, projections] = await Promise.all([loadSalaryData(), loadAccounts(), loadSettings(), loadSpending(),
    sb.from('fire_projections').select('*').order('made_on').then(must)]);
  if (t !== navToken) return;
  const s = settings, cy = new Date().getFullYear(), now = dnum(today()), me1 = people[0];
  const open = accounts.filter(a => !a.closed_on);
  const total = accounts.reduce((v, a) => v + (a.latest?.balance || 0), 0);
  const byOwner = [...people.map(p => [p.name, p.id]), ['Joint', null]]
    .map(([name, id]) => [name, accounts.filter(a => a.owner_id === id).reduce((v, a) => v + (a.latest?.balance || 0), 0)])
    .filter(([, v], i) => v || i < people.length);   // Joint only once it has money
  const dates = open.map(a => a.latest?.as_of).filter(Boolean).sort();
  const stale = open.filter(a => !a.latest || now - dnum(a.latest.as_of) > STALE_DAYS);

  // Spending: the latest year's, in today's dollars.
  const spend = spending[0] ? { year: spending[0].year, amount: +spending[0].amount * (1 + s.inflation / 100) ** (cy - spending[0].year) } : null;
  const fiNumber = spend ? spend.amount / (s.withdrawal_rate / 100) : null;
  // Savings a year: the contribution plans at today's pay when there are any, else what went in over the last 12 months.
  const lastYear = Math.round(putInBetween(accounts, now - 365, now + 1));
  const planNow = Math.round(planYearlyNow(accounts.filter(a => !a.closed_on).flatMap(a => a.contributions), byId(jobs)));
  const yearly = planNow || lastYear;
  // Pay now: every job's rate today, both people. Pay by year: what each year's salary table says.
  const payNow = jobs.reduce((v, j) => v + (rateOn(j, now) || 0), 0);
  const payByYear = {};
  for (const p of people) for (const r of personYears(p, jobs, s.start_age)) payByYear[r.y] = (payByYear[r.y] || 0) + r.earned;
  const ageNow = me1 ? ageOn(me1.birth_date, today()) : null;

  view(`<section class="hero"><p class="eyebrow">Invested</p>
      <div class="hero-num">${money(total)}</div>
      <p class="hero-sub">${accounts.length ? `${open.length} open account${open.length === 1 ? '' : 's'}${dates.length ? ` · latest update ${fmtDate(dates.at(-1))}` : ''}`
        : 'Add your accounts to get started.'}</p>
      ${accounts.length ? `<div class="split">${byOwner.map(([name, v]) => `<div><span>${esc(name)}</span><b>${money(v)}</b></div>`).join('')}
        ${payNow ? `<div><span>Times Your Pay</span><b>${(total / payNow).toFixed(1)}×</b></div>` : ''}</div>` : ''}
    </section>
    ${stale.length ? `<p class="alert">${stale.length === 1 ? `${esc(stale[0].name)} hasn't` : `${stale.length} accounts haven't`} been updated in over a year.
      <a href="#/accounts">Update ${stale.length === 1 ? 'it' : 'them'}</a></p>` : ''}
    <div id="fi">${fiNumber ? '' : `<section class="card"><h2>Your FIRE Number</h2>
      <p>It comes from what you spend: at a ${s.withdrawal_rate}% withdrawal rate you need ${+(100 / s.withdrawal_rate).toFixed(1)}× a year's spending.</p>
      <a class="button fill" href="#/spending">Add Your Spending</a></section>`}</div>
    ${accounts.length ? milestonesHTML() : ''}
    <div class="tiles" style="margin-top:1rem">
      <a class="card tile" href="#/spending"><div><h2>Spending</h2><p class="muted">${spend ? `${money(+spending[0].amount)} in ${spending[0].year}.` : 'What you spend in a year.'} Your FIRE number comes from it.</p></div>${ICON_ARROW}</a>
      <a class="card tile" href="#/accounts"><div><h2>Accounts</h2><p class="muted">401(k)s, IRAs and the rest. Add a balance whenever you check one.</p></div>${ICON_ARROW}</a>
      <a class="card tile" href="#/sp500"><div><h2>Vs. the S&amp;P 500</h2><p class="muted">Your accounts against the same money in an S&amp;P 500 index fund.</p></div>${ICON_ARROW}</a>
      <a class="card tile" href="#/salary"><div><h2>Salary</h2><p class="muted">Every job, raise and bonus, and your pay by year and age.</p></div>${ICON_ARROW}</a>
    </div>`);
  if (!fiNumber) return;

  // The FIRE card's numbers and chart redraw as the extra-savings slider moves (the slider itself stays, so a drag goes on).
  let extra = 0;
  $('#fi').innerHTML = `<section class="card fi-card"><h2>Your FIRE Number</h2><div id="fiBody"></div>
    <label class="slider">Save More a Year <b id="extraText"></b>
      <input type="range" id="extra" min="0" max="60000" step="1000" value="0"></label>
    <p class="hint" id="fiHint"></p></section>`;
  $('#extra').oninput = e => { extra = +e.target.value; drawFI(); };
  const drawFI = () => {
    const save = yearly + extra, pr = project(total, save, s.real_return, fiNumber);
    const fireDate = pr.months != null ? addMonths(new Date(), pr.months) : null;
    const ageAt = p => p.birth_date && fireDate ? ageOn(p.birth_date, iso(fireDate)) : null;
    const retireMonths = me1?.birth_date ? Math.max(0, (dnum(me1.birth_date) + s.retire_age * 365.25 - now) / 30.44) : null;
    const atRetire = retireMonths != null ? atMonths(total, save, s.real_return, retireMonths) : null;
    const coast = retireMonths != null ? fiNumber / (1 + s.real_return / 100) ** (retireMonths / 12) : null;
    const share = Math.min(1, total / fiNumber);
    $('#fiBody').innerHTML = `<div class="fi-top"><div><span class="fi-num">${money(fiNumber)}</span>
        <p class="muted">${money(spend.amount)} a year${spend.year !== cy ? ` (${spend.year}'s spending in today's dollars)` : ''} ÷ ${s.withdrawal_rate}%</p></div>
        <div class="fi-pct"><b>${pct(total / fiNumber, 0)}</b><span>of the way</span></div></div>
      <div class="bar" role="img" aria-label="${pct(share, 0)} of the way"><i style="width:${(share * 100).toFixed(1)}%"></i></div>
      <div class="stats" style="margin-top:1rem">
        <div class="stat"><span>FIRE Date</span><b>${pr.months === 0 ? 'Now' : fireDate ? fireDate.getFullYear() : `${MAX_YEARS}+ yrs`}</b>
          <small class="muted">${pr.months ? `in ${yearsText(pr.months)}` : pr.months === 0 ? "you're there" : 'at this pace'}</small></div>
        ${people.map(p => `<div class="stat"><span>${esc(p.name)} Would Be</span><b>${ageAt(p) ?? '—'}</b><small class="muted">${p.birth_date ? 'years old' : 'add a birth date'}</small></div>`).join('')}
        ${atRetire != null ? `<div class="stat"><span>At ${esc(me1.name)}'s ${s.retire_age}</span><b class="${atRetire >= fiNumber ? 'up' : 'down'}">${moneyShort(atRetire)}</b>
          <small class="muted">${atRetire >= fiNumber ? 'on track to retire' : `${moneyShort(fiNumber - atRetire)} short`}</small></div>` : ''}
        ${coast != null ? `<div class="stat"><span>Coast FIRE</span><b>${moneyShort(coast)}</b>
          <small class="muted">${total >= coast ? "there: it grows to FI by " + s.retire_age : `${moneyShort(coast - total)} to go`}</small></div>` : ''}
      </div>
      ${projectionChart(accounts, pr.path, fiNumber, fireDate)}
      <div class="legend"><span><i></i>Invested</span><span><i class="put"></i>Projected</span><span><i class="goal"></i>FIRE number</span></div>`;
    $('#extraText').textContent = extra ? '+' + money(extra) : 'No change';
    const basis = planNow ? `your contributions (last 12 months: ${money(lastYear)})` : 'what you and employers put in over the last 12 months (add contributions on an account to use your plan)';
    $('#fiHint').innerHTML = `Saving about ${money(save)} a year: ${extra ? `${money(yearly)} from ${basis}, plus ${money(extra)}` : basis}.
      Growth is ${s.real_return}% a year after inflation (<a href="#/settings">Settings</a>). A projection, not a promise or advice.`;
  };
  drawFI();

  // Milestones: savings at each age as a multiple of yearly pay. Past ages use the balance and pay then; ages still
  // ahead use the projection (today's dollars) and today's pay.
  // Projected: for an age still ahead, today's projection (saved to fire_projections, once a day, so it can be compared
  // later); for an age reached, the last projection saved before that birthday. Actual: what you had on the birthday.
  function milestonesHTML() {
    if (!me1?.birth_date || !payNow && !Object.keys(payByYear).length) return `<section class="card"><h2>Milestones</h2>
      <p class="muted">Add ${me1?.birth_date ? 'your jobs on Salary' : 'your birth date in Settings'} to see savings milestones by age.</p></section>`;
    const born = me1.birth_date, save = [];
    const rows = MILESTONES.map(([age, x]) => {
      const date = `${+born.slice(0, 4) + age}${born.slice(4)}`, d = dnum(date), past = d <= now;
      const pay = past ? payByYear[+date.slice(0, 4)] : payNow, target = pay ? x * pay : null;
      const actual = past && accounts.some(a => a.updates.some(u => dnum(u.as_of) <= d)) ? totalOn(accounts, d) : null;
      const saved = projections.filter(p => p.age === age && p.made_on < date).at(-1);
      const proj = past ? (saved ? +saved.projected : null) : atMonths(total, yearly, s.real_return, (d - now) / 30.44);
      if (!past && total) save.push({ age, made_on: today(), projected: Math.round(proj) });
      const check = past ? actual : proj, ok = check != null && target != null ? check >= target : null;
      return `<tr${past ? ' class="reached"' : ''}><td>${age}<br><span class="muted">${date.slice(0, 4)}</span></td>
        <td class="r">${x}× pay${target != null ? `<br><span class="muted">${money(target)}</span>` : ''}</td>
        <td class="r">${proj != null ? money(proj) : '<span class="muted">—</span>'}${past && saved ? `<br><span class="muted">as of ${fmtMonthYear(saved.made_on)}</span>` : ''}</td>
        <td class="r">${actual != null ? `<b>${money(actual)}</b>${proj ? `<br><span class="muted ${actual >= proj ? 'up' : 'down'}">${signed(actual - proj)}</span>` : ''}`
          : `<span class="muted">${past ? '—' : 'not yet'}</span>`}</td>
        <td class="r">${ok == null ? '' : ok ? '<span class="chip ok">On Track</span>' : '<span class="chip warn">Behind</span>'}</td></tr>`;
    });
    if (save.length) sb.from('fire_projections').upsert(save).then(r => { if (r.error) logError('error', r.error.message); });
    return `<section class="card"><h2>Milestones</h2>
      <p class="hint">A common rule of thumb for retiring around 67: savings of 1× your pay by 30, 2× by 35, 3× by 40, 4× by 45, 6× by 50, 7× by 55,
        8× by 60 and 10× by 67 (9× at 65 is halfway between). Pay here is household pay${ageNow != null ? `; ages are ${esc(me1.name)}'s (${ageNow} now)` : ''}.
        Projected is saved each day you open this page, so when you reach an age it shows what was projected beside what you had.</p>
      <div class="table-wrap"><table><thead><tr><th>Age</th><th class="r">Goal</th><th class="r">Projected</th><th class="r">Actual</th><th class="r"></th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div></section>`;
  }
}

// Invested so far (at each update date), then the projection from today, with the FIRE number as a line.
function projectionChart(accounts, path, goal, fireDate) {
  const W = 640, H = 240, L = 52, R = 12, T = 12, B = 26;
  const dates = [...new Set(accounts.flatMap(a => a.updates.map(u => u.as_of)))].sort();
  const hist = dates.map(d => [day(d).getTime(), totalOn(accounts, dnum(d))]);
  const nowT = Date.now(), yr = 365.25 * 864e5;
  // Project as far as the FIRE date plus a few years (at least 10 years out), never past the path.
  const yearsOut = Math.min(path.length - 1, Math.max(10, fireDate ? Math.ceil((fireDate - nowT) / yr) + 3 : 25));
  const proj = path.slice(0, yearsOut + 1).map((v, i) => [nowT + i * yr, v]);
  const t0 = hist[0]?.[0] ?? nowT, t1 = proj.at(-1)[0];
  const hi = Math.max(goal * 1.1, ...proj.map(p => p[1]), ...hist.map(p => p[1])), step = niceStep(hi), top = Math.ceil(hi / step) * step;
  const x = tm => L + (tm - t0) / (t1 - t0 || 1) * (W - L - R), y = v => T + (1 - Math.min(v, top) / top) * (H - T - B);
  const line = pts => pts.map(([tm, v], i) => `${i ? 'L' : 'M'}${x(tm).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const grid = [];
  for (let v = 0; v <= top + 1e-9; v += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`);
  const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear(), every = Math.ceil((y1 - y0) / 6) || 1;
  const xs = [];
  for (let yy = y0 + 1; yy <= y1; yy++) if ((yy - y0) % every === 0) xs.push(`<text x="${x(new Date(yy, 0, 1).getTime())}" y="${H - 6}" text-anchor="middle">${yy}</text>`);
  const histLine = hist.length ? line([...hist, [nowT, proj[0][1]]]) : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Invested so far and projected">
    <g class="grid">${grid.join('')}</g><g class="axis">${xs.join('')}</g>
    <line class="goal" x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}"/>
    ${histLine ? `<path class="area" d="${histLine}L${x(nowT)},${y(0)}L${x(t0)},${y(0)}Z"/><path class="bal" d="${histLine}"/>` : ''}
    <path class="proj" d="${line(proj)}"/>
    ${fireDate && fireDate.getTime() <= t1 ? `<circle class="fire-dot" cx="${x(fireDate.getTime())}" cy="${y(goal)}" r="5"><title>FIRE ${fireDate.getFullYear()}</title></circle>` : ''}
  </svg>`;
}

// ---------- Spending: one number a year ----------

async function spendingPage() {
  const t = ++navToken;
  view(loading);
  const [rows, settings, { people, jobs }] = await Promise.all([loadSpending(), loadSettings(), loadSalaryData()]);
  if (t !== navToken) return;
  const cy = new Date().getFullYear(), inf = settings.inflation;
  const pay = {};
  for (const p of people) for (const r of personYears(p, jobs, settings.start_age)) pay[r.y] = (pay[r.y] || 0) + r.earned;
  view(`<div class="page-head"><div><h1 class="big">Spending</h1>
      <p class="muted">What the household spends in a year. Your FIRE number is the latest year's ÷ the withdrawal rate.</p></div>
      <button type="button" id="addSpend" class="fill">+ Add Year</button></div>
    ${rows.length ? `<section class="card"><div class="table-wrap"><table><thead><tr><th>Year</th><th class="r">Spent</th><th class="r">Today's $</th><th class="r">Change</th><th class="r">Of Pay</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const prev = rows[i + 1], ch = prev && prev.year === r.year - 1 && +prev.amount ? +r.amount / +prev.amount - 1 : null;
        return `<tr class="click" tabindex="0" data-year="${r.year}"><td>${r.year}</td><td class="r">${money(r.amount)}</td>
          <td class="r">${money(+r.amount * (1 + inf / 100) ** (cy - r.year))}</td>
          <td class="r ${ch > 0 ? 'down' : ch < 0 ? 'up' : ''}">${ch == null ? '' : (ch > 0 ? '+' : '') + pct(ch)}</td>
          <td class="r">${pay[r.year] ? pct(+r.amount / pay[r.year], 0) : ''}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="hint" style="margin-top:.6rem">Tap a year to change it. Of Pay is spending ÷ both of your pay that year (from Salary).</p></section>`
    : `<section class="card empty"><h2>No Spending Yet</h2><p class="muted">Add about what you spent last year, everything but savings. A bank or credit card year-end summary helps.</p></section>`}`);
  $('#addSpend').onclick = () => spendDialog(null, rows);
  const open = el => { const r = rows.find(x => x.year === +el?.dataset.year); if (r) spendDialog(r, rows); };
  app.onclick = e => open(e.target.closest('tr[data-year]'));
  app.onkeydown = e => { if (e.key === 'Enter') open(e.target.closest('tr[data-year]')); };
}

async function spendDialog(r, rows) {
  const cy = new Date().getFullYear(), next = r ? r.year : [cy - 1, cy, ...rows.map(x => x.year - 1)].find(y => !rows.some(x => x.year === y)) ?? cy;
  const f = await ask({ title: r ? `Spending in ${r.year}` : 'Add Year', ok: r ? 'Save' : 'Add',
    extra: r ? { value: 'delete', label: 'Delete' } : null,
    body: `<div class="two">
        <label>Year<input type="number" name="year" min="1950" max="${cy}" value="${next}" ${r ? 'readonly' : ''} required data-need="Enter the year."
          data-range="Use a year up to ${cy}."></label>
        ${moneyField('amount', 'Spent', r?.amount ?? '', { required: true, need: 'Enter about what you spent.' })}
      </div>
      <p class="hint">Everything the household spent, not counting money saved or invested. A rough number is fine.</p>` });
  if (!f) return;
  if (f.get('button') === 'delete') {
    if (!await confirmDelete('Delete Spending?', `This deletes ${r.year}'s spending.`)) return;
    return busy(null, async () => { await sb.from('fire_spending').delete().eq('year', r.year).then(must); flash('Deleted.'); redraw(); });
  }
  const year = +f.get('year');
  if (!r && rows.some(x => x.year === year)) { flash(`${year} is already there. Tap it to change it.`, 'error'); return; }
  await busy(null, async () => {
    await sb.from('fire_spending').upsert({ year, amount: num(f.get('amount')) }).then(must);
    flash('Spending saved.');
    redraw();
  });
}
