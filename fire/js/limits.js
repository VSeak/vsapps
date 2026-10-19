// ---------- Contribution limits ----------
// The IRS's yearly caps, per person. 401(k) and 403(b) share one limit (what you put in, pre-tax and Roth together; the
// employer's money doesn't count), IRAs another (traditional and Roth together), an HSA a third (you and the employer
// together; self-only or family coverage). Catch-up by age on Dec 31: 50+ for 401(k) and IRA, a bigger 401(k) one at
// 60–63, 55+ for an HSA. A year's amount is what the account updates show went in that year, plus the contribution
// plan for the days they don't cover through Dec 31, so it warns before you go over.

// Add each year when the IRS posts it (401(k) and IRA in the fall, HSA in the spring). The 60–63 catch-up began in 2025;
// earlier years repeat the 50+ one there.
const LIMITS = {
  2019: { k401: 19000, k401c50: 6000, k401c60: 6000, ira: 6000, irac50: 1000, hsaSelf: 3500, hsaFamily: 7000, hsac55: 1000 },
  2020: { k401: 19500, k401c50: 6500, k401c60: 6500, ira: 6000, irac50: 1000, hsaSelf: 3550, hsaFamily: 7100, hsac55: 1000 },
  2021: { k401: 19500, k401c50: 6500, k401c60: 6500, ira: 6000, irac50: 1000, hsaSelf: 3600, hsaFamily: 7200, hsac55: 1000 },
  2022: { k401: 20500, k401c50: 6500, k401c60: 6500, ira: 6000, irac50: 1000, hsaSelf: 3650, hsaFamily: 7300, hsac55: 1000 },
  2023: { k401: 22500, k401c50: 7500, k401c60: 7500, ira: 6500, irac50: 1000, hsaSelf: 3850, hsaFamily: 7750, hsac55: 1000 },
  2024: { k401: 23000, k401c50: 7500, k401c60: 7500, ira: 7000, irac50: 1000, hsaSelf: 4150, hsaFamily: 8300, hsac55: 1000 },
  2025: { k401: 23500, k401c50: 7500, k401c60: 11250, ira: 7000, irac50: 1000, hsaSelf: 4300, hsaFamily: 8550, hsac55: 1000 },
  2026: { k401: 24500, k401c50: 8000, k401c60: 11250, ira: 7500, irac50: 1100, hsaSelf: 4400, hsaFamily: 8750, hsac55: 1000 },
};
const LIMIT_GROUPS = [
  { key: 'k401', label: '401(k) and 403(b)', short: '401(k)', kinds: ['401k', 'roth_401k', '403b'], sources: ['you'] },
  { key: 'ira', label: 'IRA', short: 'IRA', kinds: ['ira', 'roth_ira'], sources: ['you'] },
  { key: 'hsa', label: 'HSA', short: 'HSA', kinds: ['hsa'], sources: ['you', 'employer'] },
];

// The limits for a year: that year's, else the latest one before it (`year` says which was used).
function limitsYear(y) {
  const ys = Object.keys(LIMITS).map(Number), year = LIMITS[y] ? y : Math.max(...ys.filter(k => k <= y), Math.min(...ys));
  return { L: LIMITS[year], year };
}
function groupLimit(g, L, age, family) {
  if (g.key === 'k401') return L.k401 + (age >= 60 && age <= 63 ? L.k401c60 : age >= 50 ? L.k401c50 : 0);
  if (g.key === 'ira') return L.ira + (age >= 50 ? L.irac50 : 0);
  return (family ? L.hsaFamily : L.hsaSelf) + (age >= 55 ? L.hsac55 : 0);
}

// What went into an account in calendar year y from these sources ('you', 'employer'): from its updates where they
// cover the days (each update's money spread over the days since the one before, as Salary counts it), from its plan
// for the rest. { done: through today, ahead: what the plan adds from tomorrow to Dec 31 }.
function accountInYear(a, jobsById, y, sources) {
  const ys = yearStart(y), ye = yearStart(y + 1), now = dnum(today()) + 1;
  const fields = sources.map(s => s === 'you' ? 'contributed' : 'employer');
  let done = 0, ahead = 0;
  a.updates.forEach((u, i) => {
    const v = fields.reduce((s, f) => s + u[f], 0);
    if (!v) return;
    const b = dnum(u.as_of) + 1, s = moneyFrom(a, i);
    done += v * Math.max(0, Math.min(b, ye) - Math.max(s, ys)) / (b - s);
  });
  const first = a.updates[0] ? moneyFrom(a, 0) : Infinity, last = a.updates.at(-1) ? dnum(a.updates.at(-1).as_of) : -Infinity;
  const skip = d => d >= first && d <= last;
  for (const src of sources) {
    done += planBetween(a.contributions, jobsById, ys, Math.min(ye, now), src, skip);
    ahead += planBetween(a.contributions, jobsById, Math.max(ys, now), ye, src, skip);
  }
  return { done, ahead };
}

// Each person's rows for a year: only the groups they have an account in (closed ones too: money put into an old
// employer's 401(k) this year still counts).
function limitRows(accounts, people, jobs, y, family) {
  const jobsById = byId(jobs), { L, year } = limitsYear(y);
  return { year, people: people.map(p => {
    const age = p.birth_date ? y - +p.birth_date.slice(0, 4) : null;
    const rows = LIMIT_GROUPS.map(g => {
      const mine = accounts.filter(a => a.owner_id === p.id && g.kinds.includes(a.kind));
      if (!mine.length) return null;
      const sums = mine.map(a => accountInYear(a, jobsById, y, g.sources));
      const done = sums.reduce((s, x) => s + x.done, 0), ahead = sums.reduce((s, x) => s + x.ahead, 0);
      return { g, done, ahead, total: done + ahead, limit: groupLimit(g, L, age, family) };
    }).filter(Boolean);
    return { p, age, rows };
  }).filter(x => x.rows.length) };
}

// Years with money to count: from the earliest an account's money went in (a first update's Put In Since counts) to now.
function limitYears(accounts) {
  const cy = new Date().getFullYear(), starts = accounts.filter(a => a.updates.length).map(a => new Date(moneyFrom(a, 0) * 864e5).getUTCFullYear());
  const out = [];
  for (let y = cy; y >= Math.min(cy, ...starts); y--) out.push(y);
  return out;
}

// The card on the Accounts page, for year y (this year unless picked): the bars, then By Year for every year.
function limitsCardHTML(accounts, people, jobs, settings, y = new Date().getFullYear()) {
  const cy = new Date().getFullYear(), { year, people: list } = limitRows(accounts, people, jobs, y, settings.hsa_family);
  if (!list.length) return '';
  const years = limitYears(accounts), now = y === cy;
  // Years before an account's first update come from spreading its Put In Since money evenly, so they're estimates.
  const est = accounts.some(a => a.updates[0]?.put_in_since && y >= +a.updates[0].put_in_since.slice(0, 4) && y <= +a.updates[0].as_of.slice(0, 4)
    && LIMIT_GROUPS.some(g => g.kinds.includes(a.kind)));
  const hasHsa = list.some(x => x.rows.some(r => r.g.key === 'hsa'));
  const row = r => {
    const over = r.total - r.limit, top = Math.max(r.limit, r.total) || 1, w = v => (v / top * 100).toFixed(1) + '%';
    return `<div class="lim">
      <div class="row between wrap"><b>${r.g.label}</b>
        ${over >= 1 ? `<span class="chip warn">Over by ${money(over)}</span>` : r.limit - r.total < 1 ? '<span class="chip ok">Maxed</span>'
          : `<span class="muted">${money(r.limit - r.total)} room left</span>`}</div>
      <div class="lim-bar" role="img" aria-label="${money(r.total)} of ${money(r.limit)}"><i style="width:${w(r.done)}"></i><i class="ahead" style="width:${w(r.ahead)}"></i>
        ${over >= 1 ? `<s style="left:${w(r.limit)}"></s>` : ''}</div>
      <p class="muted">${money(r.done)} ${now ? 'so far' : 'put in'}${r.ahead >= 1 ? ` · ${money(r.total)} by Dec 31 at your plan` : ''} · limit ${money(r.limit)}${r.g.key === 'hsa' ? ' (you and employer)' : ''}</p></div>`;
  };
  // By Year: each person's groups as columns, every year as a row; the picked year is marked.
  const all = years.map(yy => ({ y: yy, ...limitRows(accounts, people, jobs, yy, settings.hsa_family) }));
  const byYear = list.map(({ p }) => {
    const groups = LIMIT_GROUPS.filter(g => all.some(x => x.people.some(q => q.p.id === p.id && q.rows.some(r => r.g === g))));
    const cell = (x, g) => {
      const r = x.people.find(q => q.p.id === p.id)?.rows.find(rr => rr.g === g);
      if (!r) return '<td class="r"><span class="muted">—</span></td>';
      const over = r.total - r.limit >= 1, maxed = !over && r.limit - r.total < 1;
      return `<td class="r${over ? ' down' : ''}">${money(r.total)}<br>${maxed ? '<span class="chip ok">Maxed</span>' : `<span class="muted">of ${money(r.limit)}</span>`}</td>`;
    };
    return `<h3>${esc(p.name)}</h3><div class="table-wrap"><table><thead><tr><th>Year</th>${groups.map(g => `<th class="r">${g.short}</th>`).join('')}</tr></thead>
      <tbody>${all.map(x => `<tr class="click${x.y === y ? ' on' : ''}" data-limyear="${x.y}" tabindex="0"><td>${x.y}${x.y === cy ? '<br><span class="muted">so far</span>' : ''}</td>${groups.map(g => cell(x, g)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }).join('');
  return `<section class="card" id="limCard"><div class="row between wrap"><h2>${y} Contribution Limits</h2>
      ${years.length > 1 ? `<select id="limYear" aria-label="Year">${years.map(yy => `<option${yy === y ? ' selected' : ''}>${yy}</option>`).join('')}</select>` : ''}</div>
    <p class="hint">What you put in ${now ? 'this year' : `in ${y}`} against the IRS limits${year !== y ? ` (${y}'s aren't in yet, so these are ${year}'s; ask Claude to add them to <code>fire/js/limits.js</code>)` : ''},
      catch-up included by age. 401(k) and 403(b) count only your money, pre-tax and Roth together; the employer match has its own, much higher limit.
      ${now ? 'By Dec 31 adds what your contribution plans put in for the rest of the year.' : ''}${est ? ' Some of this year comes from spreading an account\'s Put In Since money evenly, so it\'s an estimate.' : ''}</p>
    ${list.map(({ p, age, rows }) => `<h3>${esc(p.name)}${age == null ? ' <span class="muted">(add a birth date in Settings for catch-up)</span>' : ''}</h3>${rows.map(row).join('')}`).join('')}
    ${hasHsa ? `<label class="lim-cov">HSA Coverage<select id="hsaCov"><option value="">Self-Only</option><option value="1"${settings.hsa_family ? ' selected' : ''}>Family</option></select></label>
      <p class="hint" style="margin:.3rem 0 0">With family coverage the family limit is shared by both of you, if you each have an HSA. It applies to every year here.</p>` : ''}
    ${years.length > 1 ? `<h2 class="lim-years">By Year</h2><p class="hint">Tap a year to see it above.</p>${byYear}` : ''}
  </section>`;
}
// Picking a year (the menu or a By Year row) redraws only this card.
function wireLimitsCard(accounts, people, jobs, settings) {
  const card = $('#limCard');
  if (!card) return;
  const show = y => {
    card.outerHTML = limitsCardHTML(accounts, people, jobs, settings, y);
    wireLimitsCard(accounts, people, jobs, settings);
  };
  const sel = $('#hsaCov');
  if (sel) sel.onchange = () => busy(null, () => saveSettings({ hsa_family: !!sel.value }, 'HSA coverage saved.'));
  const pick = $('#limYear');
  if (pick) pick.onchange = () => show(+pick.value);
  const go = e => { const tr = e.target.closest('tr[data-limyear]'); if (tr) { show(+tr.dataset.limyear); $('#limCard').scrollIntoView({ behavior: 'smooth' }); } };
  card.onclick = go;
  card.onkeydown = e => { if (e.key === 'Enter') go(e); };
}

// A warning on the Overview when this year's plan goes over a limit.
function limitsAlertHTML(accounts, people, jobs, settings) {
  const cy = new Date().getFullYear();
  const over = limitRows(accounts, people, jobs, cy, settings.hsa_family).people
    .flatMap(({ p, rows }) => rows.filter(r => r.total - r.limit >= 1).map(r => `${esc(p.name)}'s ${r.g.label} by ${money(r.total - r.limit)}`));
  return over.length ? `<p class="alert">This year's contributions go over the ${cy} limit: ${over.join('; ')}.
    <a href="#/accounts">See Limits</a></p>` : '';
}
