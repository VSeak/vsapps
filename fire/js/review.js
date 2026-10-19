// ---------- Year in Review ----------
// Each calendar year: invested on Jan 1 and on Dec 31 (now, for this year), and where the change came from: what you put
// in, what employers put in, money moved in from accounts you don't track (moves between tracked ones cancel out),
// balances you started tracking that year, and growth. Between two updates an account's balance runs in a straight
// line and the later update's money and growth are spread evenly over those days, so the parts always add up to the change.

// An update is the balance at the end of its day, the instant dnum + 1. Year y runs from yearStart(y) to yearStart(y + 1).
function accountYear(a, y) {
  const u = a.updates;
  if (!u.length) return null;
  const ys = yearStart(y), ye = yearStart(y + 1), e = u.map(x => dnum(x.as_of) + 1);
  const at = t => {
    if (t < e[0]) return 0;
    const i = e.findLastIndex(x => x <= t);
    return i === u.length - 1 ? u[i].balance : u[i].balance + (u[i + 1].balance - u[i].balance) * (t - e[i]) / (e[i + 1] - e[i]);
  };
  const r = { a, start: at(ys), end: at(ye), you: 0, employer: 0, moved: 0, added: 0, growth: 0, firstW: 0 };
  // The first update: its money counts as put in that year for the part of it that went in this year (all of it, unless
  // it's spread from a Put In Since date); the rest of its balance counts as started tracking. firstW is that whole
  // balance weighted by the share of the year it was invested, for the return.
  if (ys < e[0] && e[0] <= ye) {
    const s0 = moneyFrom(a, 0), f = (e[0] - Math.max(s0, ys)) / (e[0] - s0);
    Object.assign(r, { added: u[0].balance - f * putIn(u[0]), you: f * u[0].contributed, employer: f * u[0].employer, moved: f * u[0].moved,
      firstW: u[0].balance * (ye - e[0]) / (ye - ys) });
  }
  for (let i = 1; i < u.length; i++) {
    const f = Math.max(0, Math.min(e[i], ye) - Math.max(e[i - 1], ys)) / (e[i] - e[i - 1]);
    if (!f) continue;
    r.you += f * u[i].contributed; r.employer += f * u[i].employer; r.moved += f * u[i].moved;
    r.growth += f * (u[i].balance - u[i - 1].balance - putIn(u[i]));
  }
  return r;
}

function yearReview(accounts, y) {
  const parts = accounts.map(a => accountYear(a, y)).filter(r => r && (r.start || r.end || r.you || r.employer || r.moved || r.added));
  const sum = k => parts.reduce((s, r) => s + r[k], 0);
  const r = { y, parts, ...Object.fromEntries(['start', 'end', 'you', 'employer', 'moved', 'added', 'growth', 'firstW'].map(k => [k, sum(k)])) };
  r.putIn = r.you + r.employer;
  // Return, about: growth over the money invested on average: Jan 1, plus half of what came in during the year (it came
  // in evenly), plus accounts started that year for the part of the year they were tracked.
  const firstIn = parts.reduce((s, p) => s + (p.firstW ? p.a.updates[0].balance : 0), 0);   // its added + money this year
  const base = r.start + (r.putIn + r.moved + r.added - firstIn) / 2 + r.firstW;
  r.ret = base > 0 ? r.growth / base : null;
  return r;
}

// The S&P 500's total return over the year (to the latest data, for this year). null before the data starts.
function spYear(y) {
  const cy = new Date().getFullYear(), a = spOn(`${y - 1}-12-31`);
  const end = y === cy ? [today(), spEndDate()].sort()[0] : `${y}-12-31`;
  return a ? spOn(end) / a - 1 : null;
}

const ROUND_MARKS = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 750e3, 1e6, 1.5e6, 2e6, 2.5e6, 3e6, 4e6, 5e6, 7.5e6, 10e6];

async function reviewPage(yearArg) {
  const t = ++navToken;
  view(loading);
  const [{ people, jobs, yearPay }, accounts, settings, spending] = await Promise.all([loadSalaryData(), loadAccounts(), loadSettings(), loadSpending()]);
  if (t !== navToken) return;
  const cy = new Date().getFullYear();
  const firsts = accounts.filter(a => a.updates.length).map(a => +a.updates[0].as_of.slice(0, 4));
  const head = `${crumbs([['Accounts', '#/accounts'], ['Year in Review']])}<div class="page-head"><div><h1 class="big">Year in Review</h1>
    <p class="muted">Where each year's money came from: what you saved, what employers added, and what the market did.</p></div></div>`;
  if (!firsts.length) return view(`${head}<section class="card empty"><h2>Nothing to Review Yet</h2>
    <p class="muted">Add balances to your accounts and each year shows up here.</p></section>`);
  const years = [];
  for (let y = Math.min(...firsts); y <= cy; y++) years.push(yearReview(accounts, y));
  const r = years.find(x => x.y === +yearArg) || years.find(x => x.y === cy - 1) || years.at(-1);
  const isNow = r.y === cy, prev = years.find(x => x.y === r.y - 1);
  const pay = householdYears(people, jobs, settings.start_age, yearPay).payByYear[r.y] || 0;
  const spent = spending.find(s => s.year === r.y), spentBefore = spending.find(s => s.year === r.y - 1);
  const sp = spYear(r.y);
  const latest = accounts.flatMap(a => a.updates.map(u => u.as_of)).sort().at(-1);
  const endLabel = isNow ? 'Now' : 'Dec 31';

  // Highlights, in sentence case.
  const notes = [];
  const firstCross = years.find(x => x.growth > x.putIn && x.putIn + x.growth > 0);
  if (r.growth > r.putIn && r.growth > 0) notes.push(`Your money earned more than you put in: ${money(r.growth)} of growth against ${money(r.putIn)} saved${firstCross === r ? ', for the first time' : ''}.`);
  else if (r.growth > 0) notes.push(`Growth added ${money(r.growth)}, ${pct(r.putIn ? r.growth / r.putIn : null, 0) || 'more than'} of what you put in.`);
  else if (r.growth < 0) notes.push(`A down year: the market took ${money(-r.growth)}, and you still put in ${money(r.putIn)}.`);
  const crossed = ROUND_MARKS.filter(m => r.start < m && r.end >= m);
  if (crossed.length) notes.push(`You crossed ${moneyShort(crossed.at(-1))}${crossed.length > 1 ? ` (and ${crossed.slice(0, -1).map(moneyShort).join(', ')} on the way)` : ''}.`);
  if (r.ret != null && sp != null && r.parts.some(p => p.start)) notes.push(`Your accounts returned about ${pct(r.ret)}; the S&P 500 returned ${pct(sp)}${isNow ? ' so far' : ''}.`);
  const best = [...r.parts].sort((x, y) => y.growth - x.growth)[0];
  if (best && best.growth > 0 && r.parts.length > 1) notes.push(`Biggest grower: ${esc(best.a.name)}, ${signed(best.growth)}.`);
  if (pay && r.putIn) notes.push(`You and employers put in ${pct(r.putIn / pay, 0)} of household pay (${money(pay)}${isNow ? ', estimated for the year' : ''}).`);
  if (spent) notes.push(`You spent ${money(spent.amount)}${spentBefore && +spentBefore.amount ? `, ${pct(Math.abs(+spent.amount / +spentBefore.amount - 1), 0)} ${+spent.amount > +spentBefore.amount ? 'more' : 'less'} than ${r.y - 1}` : ''}.`);
  if (r.added >= 1) notes.push(`You started tracking ${money(r.added)} in accounts added this year.`);

  // Where the change came from: a sideways waterfall from Jan 1 to Dec 31.
  const steps = [['You Put In', r.you, 'you'], ['Employer Put In', r.employer, 'emp'], ['Moved In', r.moved, 'moved'], ['Started Tracking', r.added, 'moved'],
    ['Growth', r.growth, r.growth < 0 ? 'loss' : 'gain']].filter(([, v], i) => i < 2 || Math.abs(v) >= 1);
  let run = r.start;
  const marks = [r.start, ...steps.map(([, v]) => (run += v))], top = Math.max(...marks, 1);
  run = r.start;
  const w = v => (Math.max(0, v) / top * 100).toFixed(2) + '%';
  const fall = [`<div class="wf"><span>Jan 1</span><div class="wf-track"><i class="total" style="left:0;width:${w(r.start)}"></i></div><b>${money(r.start)}</b></div>`,
    ...steps.map(([label, v, cls]) => {
      const a = run, b = (run += v);
      return `<div class="wf"><span>${label}</span><div class="wf-track"><i class="${cls}" style="left:${w(Math.min(a, b))};width:${w(Math.abs(v))}"></i></div><b class="${cls === 'loss' ? 'down' : cls === 'gain' ? 'up' : ''}">${signed(v)}</b></div>`;
    }),
    `<div class="wf end"><span>${endLabel}</span><div class="wf-track"><i class="total" style="left:0;width:${w(r.end)}"></i></div><b>${money(r.end)}</b></div>`];

  view(`${head}
    <div class="year-chips">${years.map(x => `<a href="#/review/${x.y}" class="${x === r ? 'on' : ''}">${x.y}</a>`).join('')}</div>
    <section class="hero"><p class="eyebrow">${isNow ? 'This Year So Far' : 'Your Year'}</p>
      <div class="hero-num">${r.y}</div>
      <p class="hero-sub">${money(r.start)} on Jan 1 → ${money(r.end)} ${isNow ? `now (latest update ${fmtDate(latest)})` : 'on Dec 31'}</p>
      <div class="split">
        <div><span>Change</span><b>${signed(r.end - r.start)}</b></div>
        <div><span>Saved</span><b>${money(r.putIn)}</b></div>
        <div><span>Growth</span><b>${signed(r.growth)}</b></div>
        ${r.ret != null ? `<div><span>Return (About)</span><b>${pct(r.ret)}</b></div>` : ''}
        ${sp != null ? `<div><span>S&amp;P 500</span><b>${pct(sp)}</b></div>` : ''}
      </div></section>
    ${notes.length ? `<section class="card"><h2>Highlights</h2><ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul></section>` : ''}
    <section class="card"><h2>Where the Change Came From</h2>${fall.join('')}
      <p class="hint" style="margin:.7rem 0 0">Between two updates a balance is drawn as a straight line, so a year that ends between updates splits that stretch by days.
        ${r.moved ? 'Moved In is money from accounts you don\'t track here (moves between your tracked accounts cancel out).' : ''}</p></section>
    ${r.parts.length ? `<section class="card"><h2>By Account</h2><div class="table-wrap"><table>
      <thead><tr><th>Account</th><th class="r">Jan 1</th><th class="r">Put In</th><th class="r">Growth</th><th class="r">${endLabel}</th></tr></thead>
      <tbody>${[...r.parts].sort((x, y) => y.end - x.end).map(p => `<tr class="click" tabindex="0" data-href="#/account/${p.a.id}">
        <td>${esc(p.a.name)}${p.a.closed_on ? ' <span class="chip">Closed</span>' : ''}</td><td class="r">${money(p.start)}</td>
        <td class="r">${money(p.you + p.employer)}${Math.abs(p.moved + p.added) >= 1 ? `<br><span class="muted">${signed(p.moved + p.added)} moved/new</span>` : ''}</td>
        <td class="r ${p.growth > 0 ? 'up' : p.growth < 0 ? 'down' : ''}">${signed(p.growth)}</td><td class="r"><b>${money(p.end)}</b></td></tr>`).join('')}</tbody></table></div></section>` : ''}
    <section class="card"><h2>Every Year</h2>
      ${years.length > 1 ? `${yearsChart(years)}<div class="legend"><span><i class="bar-put"></i>Saved (you + employer)</span><span><i class="bar-gain"></i>Growth</span></div>` : ''}
      <p class="hint" style="margin-top:.6rem">${firstCross ? `Growth first beat what you saved in ${firstCross.y}.` : 'Once your savings are big enough, growth starts adding more each year than you put in.'} Tap a year to review it.</p>
      <div class="table-wrap"><table><thead><tr><th>Year</th><th class="r">Jan 1</th><th class="r">Saved</th><th class="r">Growth</th><th class="r">Return</th><th class="r">S&amp;P 500</th><th class="r">End</th></tr></thead>
      <tbody>${[...years].reverse().map(x => { const s = spYear(x.y); return `<tr class="click${x === r ? ' on' : ''}" tabindex="0" data-href="#/review/${x.y}">
        <td>${x.y}</td><td class="r">${money(x.start)}</td><td class="r">${money(x.putIn)}</td>
        <td class="r ${x.growth > 0 ? 'up' : x.growth < 0 ? 'down' : ''}">${signed(x.growth)}</td>
        <td class="r">${x.ret != null ? pct(x.ret) : ''}</td><td class="r">${s != null ? pct(s) : ''}</td><td class="r"><b>${money(x.end)}</b></td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint" style="margin-top:.6rem">Return is about: growth ÷ the money invested on average (Jan 1, half of what came in during the year, and new accounts for the part of the year they were tracked). The S&amp;P 500 is its total return, dividends included${isNow || years.at(-1).y === cy ? `; ${cy} runs to ${fmtMonthYear(spEndDate())}` : ''}.</p>
    </section>`);
  const open = el => { if (el) location.hash = el.dataset.href; };
  app.onclick = e => open(e.target.closest('tr[data-href]'));
  app.onkeydown = e => { if (e.key === 'Enter') open(e.target.closest('tr[data-href]')); };
}

// Saved and growth side by side for each year (growth below the line in a down year).
function yearsChart(years) {
  const W = 640, H = 220, L = 52, R = 10, T = 10, B = 26;
  const hi = Math.max(1, ...years.flatMap(x => [x.putIn, x.growth])), lo = Math.min(0, ...years.map(x => x.growth));
  const step = niceStep(hi - lo), top = Math.ceil(hi / step) * step, bot = Math.floor(lo / step) * step;
  const y = v => T + (top - v) / (top - bot) * (H - T - B), gw = (W - L - R) / years.length, bw = Math.min(26, gw * .36);
  const grid = [];
  for (let v = bot; v <= top + 1e-9; v += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`);
  const every = Math.ceil(years.length / 8);
  const bars = years.map((x, i) => {
    const cx = L + gw * (i + .5), rect = (v, dx, cls, label) => `<rect class="${cls}" x="${(cx + dx).toFixed(1)}" y="${Math.min(y(v), y(0)).toFixed(1)}" width="${bw.toFixed(1)}"
      height="${Math.max(.5, Math.abs(y(v) - y(0))).toFixed(1)}" rx="3"><title>${x.y} ${label}: ${money(v)}</title></rect>`;
    return `<a href="#/review/${x.y}">${rect(x.putIn, -bw - 1, 'bar-put', 'saved')}${rect(x.growth, 1, x.growth < 0 ? 'bar-loss' : 'bar-gain', 'growth')}</a>
      ${i % every === 0 ? `<text x="${cx}" y="${H - 6}" text-anchor="middle">${x.y}</text>` : ''}`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saved and growth by year">
    <g class="grid">${grid.join('')}</g><line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/><g class="axis">${bars.join('')}</g></svg>`;
}
