// ---------- Contribution limits ----------
// The IRS's yearly caps, per person. 401(k) and 403(b) share one limit (what you put in, pre-tax and Roth together; the
// employer's money doesn't count), IRAs another (traditional and Roth together), an HSA a third (you and the employer
// together; self-only or family coverage). Catch-up by age on Dec 31: 50+ for 401(k) and IRA, a bigger 401(k) one at
// 60–63, 55+ for an HSA. A year's amount is what the account updates show went in that year, plus the contribution
// plan for the days they don't cover through Dec 31, so it warns before you go over.

// Add each year when the IRS posts it (401(k) and IRA in the fall, HSA in the spring).
const LIMITS = {
  2025: { k401: 23500, k401c50: 7500, k401c60: 11250, ira: 7000, irac50: 1000, hsaSelf: 4300, hsaFamily: 8550, hsac55: 1000 },
  2026: { k401: 24500, k401c50: 8000, k401c60: 11250, ira: 7500, irac50: 1100, hsaSelf: 4400, hsaFamily: 8750, hsac55: 1000 },
};
const LIMIT_GROUPS = [
  { key: 'k401', label: '401(k) and 403(b)', kinds: ['401k', 'roth_401k', '403b'], sources: ['you'] },
  { key: 'ira', label: 'IRA', kinds: ['ira', 'roth_ira'], sources: ['you'] },
  { key: 'hsa', label: 'HSA', kinds: ['hsa'], sources: ['you', 'employer'] },
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
    const prev = a.updates[i - 1], b = dnum(u.as_of) + 1, s = prev ? dnum(prev.as_of) + 1 : b - 1;
    done += v * Math.max(0, Math.min(b, ye) - Math.max(s, ys)) / (b - s);
  });
  const first = a.updates[0] ? dnum(a.updates[0].as_of) : Infinity, last = a.updates.at(-1) ? dnum(a.updates.at(-1).as_of) : -Infinity;
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

// The card on the Accounts page.
function limitsCardHTML(accounts, people, jobs, settings) {
  const cy = new Date().getFullYear(), { year, people: list } = limitRows(accounts, people, jobs, cy, settings.hsa_family);
  if (!list.length) return '';
  const hasHsa = list.some(x => x.rows.some(r => r.g.key === 'hsa'));
  const row = r => {
    const over = r.total - r.limit, top = Math.max(r.limit, r.total) || 1, w = v => (v / top * 100).toFixed(1) + '%';
    return `<div class="lim">
      <div class="row between wrap"><b>${r.g.label}</b>
        ${over >= 1 ? `<span class="chip warn">Over by ${money(over)}</span>` : r.limit - r.total < 1 ? '<span class="chip ok">Maxed</span>'
          : `<span class="muted">${money(r.limit - r.total)} room left</span>`}</div>
      <div class="lim-bar" role="img" aria-label="${money(r.total)} of ${money(r.limit)}"><i style="width:${w(r.done)}"></i><i class="ahead" style="width:${w(r.ahead)}"></i>
        ${over >= 1 ? `<s style="left:${w(r.limit)}"></s>` : ''}</div>
      <p class="muted">${money(r.done)} so far${r.ahead >= 1 ? ` · ${money(r.total)} by Dec 31 at your plan` : ''} · limit ${money(r.limit)}${r.g.key === 'hsa' ? ' (you and employer)' : ''}</p></div>`;
  };
  return `<section class="card"><h2>${cy} Contribution Limits</h2>
    <p class="hint">What you put in this year against the IRS limits${year !== cy ? ` (${cy}'s aren't in yet, so these are ${year}'s; ask Claude to add them to <code>fire/js/limits.js</code>)` : ''},
      catch-up included by age. 401(k) and 403(b) count only your money, pre-tax and Roth together; the employer match has its own, much higher limit.
      By Dec 31 adds what your contribution plans put in for the rest of the year.</p>
    ${list.map(({ p, age, rows }) => `<h3>${esc(p.name)}${age == null ? ' <span class="muted">(add a birth date in Settings for catch-up)</span>' : ''}</h3>${rows.map(row).join('')}`).join('')}
    ${hasHsa ? `<label class="lim-cov">HSA Coverage<select id="hsaCov"><option value="">Self-Only</option><option value="1"${settings.hsa_family ? ' selected' : ''}>Family</option></select></label>
      <p class="hint" style="margin:.3rem 0 0">With family coverage the family limit is shared by both of you, if you each have an HSA.</p>` : ''}
  </section>`;
}
function wireLimitsCard() {
  const sel = $('#hsaCov');
  if (sel) sel.onchange = () => busy(null, () => saveSettings({ hsa_family: !!sel.value }, 'HSA coverage saved.'));
}

// A warning on the Overview when this year's plan goes over a limit.
function limitsAlertHTML(accounts, people, jobs, settings) {
  const cy = new Date().getFullYear();
  const over = limitRows(accounts, people, jobs, cy, settings.hsa_family).people
    .flatMap(({ p, rows }) => rows.filter(r => r.total - r.limit >= 1).map(r => `${esc(p.name)}'s ${r.g.label} by ${money(r.total - r.limit)}`));
  return over.length ? `<p class="alert">This year's contributions go over the ${cy} limit: ${over.join('; ')}.
    <a href="#/accounts">See Limits</a></p>` : '';
}
