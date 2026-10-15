// ---------- Vs. the S&P 500 ----------
// "If every dollar had gone into the S&P 500 on the same dates": each account's starting balance buys the S&P total
// return index (sp500.js) on its first update's date, and each later update's money (you, employer and moved) is
// spread evenly over the days since the update before and buys it month by month (money moved out sells). The
// shadow is valued at each update date. Rates are money-weighted (XIRR), so they're fair however money came in.

// The index on a date: between two month-end values in proportion to the days. null before the data starts; the last
// value after it ends (spEnd() says when that is).
function spOn(dateStr) {
  const [sy, sm] = SP500.start.split('-').map(Number);
  const d = dnum(dateStr), y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
  const i = (y - sy) * 12 + (m - sm);   // this month's value is its month-end close
  if (i < 0) return null;
  if (i >= SP500.values.length) return SP500.values.at(-1);
  const prev = i ? SP500.values[i - 1] : null;
  if (prev == null) return SP500.values[i];
  const from = Date.UTC(y, m - 1, 0) / 864e5, to = Date.UTC(y, m, 0) / 864e5;   // the last days of the month before and this one
  return prev + (SP500.values[i] - prev) * (d - from) / (to - from);
}
const spEndDate = () => { const [y, m] = SP500.end.split('-').map(Number); return iso(new Date(y, m, 0)); };
const dayIso = n => new Date(n * 864e5).toISOString().slice(0, 10);

// An account and its S&P shadow at each update: [{as_of, actual, sp}], plus the cash flows for rates.
// null when the account starts before the data does, or has no updates.
function shadowOf(a) {
  const u = a.updates;
  if (!u.length || spOn(u[0].as_of) == null) return null;
  const start = u[0].balance;   // everything in the first balance counts as bought that day
  let units = start / spOn(u[0].as_of);
  const flows = [[dnum(u[0].as_of), start]];
  const points = [{ as_of: u[0].as_of, actual: start, sp: start }];
  for (let i = 1; i < u.length; i++) {
    const v = putIn(u[i]), s = dnum(u[i - 1].as_of) + 1, e = dnum(u[i].as_of) + 1;
    // Buy month by month: each slice of the period up to a month boundary, at the index on its middle day.
    for (let a0 = s; v && a0 < e;) {
      const dt = new Date(a0 * 864e5), next = Math.min(e, Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) / 864e5);
      const amt = v * (next - a0) / (e - s), mid = Math.floor((a0 + next - 1) / 2);
      units += amt / spOn(dayIso(mid));
      flows.push([mid, amt]);
      a0 = next;
    }
    points.push({ as_of: u[i].as_of, actual: u[i].balance, sp: units * spOn(u[i].as_of) });
  }
  return { points, flows, last: points.at(-1) };
}

// The yearly rate that makes the money put in (flows: [day, amount]) grow to `end` on day `endDay`. Bisection; null
// for less than a year of history, where a yearly rate means little.
function xirr(flows, end, endDay) {
  if (!flows.length || endDay - flows[0][0] < 365) return null;
  const fv = r => flows.reduce((s, [d, v]) => s + v * (1 + r) ** ((endDay - d) / 365.25), 0) - end;
  let lo = -0.99, hi = 5;
  if (fv(lo) > 0 || fv(hi) < 0) return null;
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (fv(mid) > 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}

// All accounts together: actual and S&P totals at every update date (each account at its latest update by then).
function householdShadow(shadows) {
  const dates = [...new Set(shadows.flatMap(s => s.points.map(p => p.as_of)))].sort();
  return dates.map(d => {
    let actual = 0, sp = 0;
    for (const s of shadows) {
      const p = s.points.filter(x => x.as_of <= d).at(-1);
      if (!p) continue;
      // Both sides stay at the account's last update until it has a newer one, so they're compared on the same day.
      actual += p.actual;
      sp += p.sp;
    }
    return { as_of: d, actual, sp };
  });
}

function compareRow(name, href, s) {
  const endDay = dnum(s.last.as_of), diff = s.last.actual - s.last.sp;
  const mine = xirr(s.flows, s.last.actual, endDay), sp = xirr(s.flows, s.last.sp, endDay);
  return { name, href, actual: s.last.actual, sp: s.last.sp, diff, mine, spRate: sp, since: s.points[0].as_of };
}

// The card on an account's page.
function accountCompareHTML(a) {
  const s = shadowOf(a);
  if (!s || a.updates.length < 2) return '';
  const r = compareRow(a.name, '', s);
  return `<section class="card"><h2>Vs. the S&P 500</h2>
    <p class="hint">If the money in this account had gone into an S&P 500 index fund on the same dates instead.</p>
    ${compareStatsHTML(r)}
    ${a.latest.as_of > spEndDate() ? spNote() : ''}</section>`;
}
function compareStatsHTML(r) {
  return `<div class="stats">
    <div class="stat"><span>Actual</span><b>${money(r.actual)}</b>${r.mine != null ? `<small class="muted">${pct(r.mine)} a year</small>` : ''}</div>
    <div class="stat"><span>In the S&P 500</span><b>${money(r.sp)}</b>${r.spRate != null ? `<small class="muted">${pct(r.spRate)} a year</small>` : ''}</div>
    <div class="stat"><span>Difference</span><b class="${r.diff >= 0 ? 'up' : 'down'}">${signed(r.diff)}</b>
      <small class="muted">${r.diff >= 0 ? 'ahead of' : 'behind'} the S&P since ${fmtMonthYear(r.since)}</small></div>
  </div>`;
}
const spNote = () => `<p class="hint">S&P data runs through ${fmtMonthYear(spEndDate())}, so later dates use that month's value until it's updated (ask Claude to add the newer months to <code>fire/js/sp500.js</code>).</p>`;

async function comparePage() {
  const t = ++navToken;
  view(loading);
  const accounts = await loadAccounts();
  if (t !== navToken) return;
  const withShadow = accounts.map(a => ({ a, s: shadowOf(a) })).filter(x => x.s);
  const tooOld = accounts.filter(a => a.updates.length && !shadowOf(a));
  const rows = withShadow.map(({ a, s }) => compareRow(a.name, '#/account/' + a.id, s)).sort((x, y) => y.actual - x.actual);
  const hh = householdShadow(withShadow.map(x => x.s));
  let total = null;
  if (hh.length) {
    const flows = withShadow.flatMap(x => x.s.flows).sort((p, q) => p[0] - q[0]), last = hh.at(-1);
    total = { actual: last.actual, sp: last.sp, diff: last.actual - last.sp, since: hh[0].as_of,
      mine: xirr(flows, last.actual, dnum(last.as_of)), spRate: xirr(flows, last.sp, dnum(last.as_of)) };
  }
  const latest = accounts.flatMap(a => a.updates.map(u => u.as_of)).sort().at(-1);
  view(`<div class="page-head"><div><h1 class="big">Vs. the S&P 500</h1>
      <p class="muted">What you have, against the same money put into an S&P 500 index fund on the same dates.</p></div></div>
    ${total ? `<section class="card"><h2>All Accounts</h2>${compareStatsHTML(total)}
        ${hh.length > 1 ? `${compareChart(hh)}<div class="legend"><span><i></i>Actual</span><span><i class="sp"></i>In the S&P 500</span></div>` : ''}
        <p class="hint" style="margin-top:.6rem">Rates are per year and money-weighted: they count when each dollar went in. Fees, cash and bonds are
          the usual reasons to trail the index; a lucky stock pick or more risk, to beat it.</p>
        ${latest > spEndDate() ? spNote() : ''}</section>
      <section class="card"><h2>By Account</h2>
        <div class="table-wrap"><table><thead><tr><th>Account</th><th class="r">Actual</th><th class="r">S&P 500</th><th class="r">Difference</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="click" data-href="${r.href}" tabindex="0"><td>${esc(r.name)}<br><span class="muted">since ${fmtMonthYear(r.since)}</span></td>
          <td class="r">${money(r.actual)}${r.mine != null ? `<br><span class="muted">${pct(r.mine)}/yr</span>` : ''}</td>
          <td class="r">${money(r.sp)}${r.spRate != null ? `<br><span class="muted">${pct(r.spRate)}/yr</span>` : ''}</td>
          <td class="r ${r.diff >= 0 ? 'up' : 'down'}">${signed(r.diff)}</td></tr>`).join('')}</tbody></table></div>
        ${tooOld.length ? `<p class="hint" style="margin-top:.6rem">Left out (they start before ${fmtMonthYear(SP500.start + '-01')}): ${tooOld.map(a => esc(a.name)).join(', ')}.</p>` : ''}
      </section>`
    : `<section class="card empty"><h2>Nothing to Compare Yet</h2><p class="muted">Add a couple of updates to an account, and it shows up here.</p></section>`}`);
  const open = el => { if (el?.dataset.href) location.hash = el.dataset.href; };
  app.onclick = e => open(e.target.closest('tr[data-href]'));
  app.onkeydown = e => { if (e.key === 'Enter') open(e.target.closest('tr[data-href]')); };
}

// Actual and S&P totals over time.
function compareChart(points) {
  const W = 640, H = 230, L = 52, R = 10, T = 10, B = 26;
  const times = points.map(p => day(p.as_of).getTime());
  const hi = Math.max(...points.flatMap(p => [p.actual, p.sp])), step = niceStep(hi), top = Math.ceil(hi / step) * step || 1;
  const t0 = times[0], t1 = times.at(-1), x = tm => L + (tm - t0) / (t1 - t0 || 1) * (W - L - R), y = v => T + (1 - v / top) * (H - T - B);
  const line = k => points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const grid = [];
  for (let v = 0; v <= top + 1e-9; v += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`);
  const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear(), every = Math.ceil((y1 - y0) / 6) || 1, xs = [];
  for (let yy = y0 + 1; yy <= y1; yy++) if ((yy - y0) % every === 0) xs.push(`<text x="${x(new Date(yy, 0, 1).getTime())}" y="${H - 6}" text-anchor="middle">${yy}</text>`);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Actual against the S&P 500">
    <g class="grid">${grid.join('')}</g><g class="axis">${xs.join('')}</g>
    <path class="sp" d="${line('sp')}"/><path class="bal" d="${line('actual')}"/></svg>`;
}
