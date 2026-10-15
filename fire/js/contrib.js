// ---------- Contribution plans ----------
// Each account can have lines like "You: 4% of Acme pay" or "Employer: $100 a paycheck". A line counts from its start
// date to its stop date, and never while its job isn't current: a line tied to a job stops when the job ends (the user
// asked), and a percent follows the job's pay changes. The plan fills in new updates, drives the projection, and fills
// the years Salary's savings rate has no updates for.

const SOURCES = { you: 'You', employer: 'Employer' };
const PER = { year: 'a year', month: 'a month', paycheck: 'a paycheck' };
const PAYCHECKS = { 12: 'Monthly', 24: 'Twice a Month', 26: 'Every Two Weeks', 52: 'Weekly' };

const byId = list => Object.fromEntries(list.map(x => [x.id, x]));

// A line's yearly dollars on a day number (0 when it isn't running that day).
function contribYearly(c, jobsById, d) {
  if (d < dnum(c.start_date) || (c.end_date && d > dnum(c.end_date))) return 0;
  const job = c.job_id ? jobsById[c.job_id] : null;
  if (job && (d < dnum(job.start_date) || (job.end_date && d > dnum(job.end_date)))) return 0;
  if (c.kind === 'percent') return job ? +c.percent / 100 * (rateOn(job, d) || 0) : 0;
  return +c.amount * (c.per === 'year' ? 1 : c.per === 'month' ? 12 : job?.paychecks || 24);
}
// Dollars a set of lines puts in from day `from` up to (not including) day `to`; source 'you', 'employer' or null (both).
// skip(d) leaves a day out (days an account's updates already cover).
function planBetween(lines, jobsById, from, to, source = null, skip = null, perYear = null) {
  let sum = 0;
  for (const c of lines) {
    if (source && c.source !== source) continue;
    const a = Math.max(from, dnum(c.start_date)), b = Math.min(to, c.end_date ? dnum(c.end_date) + 1 : Infinity);
    for (let d = a; d < b; d++) {
      if (skip?.(d)) continue;
      const v = contribYearly(c, jobsById, d) / 365.25;
      if (!v) continue;
      sum += v;
      if (perYear) { const y = new Date(d * 864e5).getUTCFullYear(); perYear[y] = (perYear[y] || 0) + v; }
    }
  }
  return sum;
}
// What every line puts in a year at today's pay.
const planYearlyNow = (lines, jobsById, source = null) =>
  lines.filter(c => !source || c.source === source).reduce((s, c) => s + contribYearly(c, jobsById, dnum(today())), 0);

function contribText(c, jobsById) {
  const job = jobsById[c.job_id];
  if (c.kind === 'percent') return `${+c.percent}% of ${job ? esc(job.employer) : '(no job picked)'} pay`;
  return `${money(c.amount)} ${PER[c.per]}${c.per === 'paycheck' && job ? ` (${esc(job.employer)}, ${job.paychecks} a year)` : ''}`;
}

// The Contributions card on an account's page.
function contribCardHTML(a, jobsById) {
  const lines = [...a.contributions].sort((x, y) => y.source.localeCompare(x.source) || y.start_date.localeCompare(x.start_date));
  const now = dnum(today()), you = planYearlyNow(a.contributions, jobsById, 'you'), emp = planYearlyNow(a.contributions, jobsById, 'employer');
  // This calendar year: only the days a line runs (a mid-year start counts from then; the rest of the year at today's pay).
  const cy = new Date().getFullYear(), thisYear = c => Math.round(planBetween([c], jobsById, yearStart(cy), yearStart(cy + 1)));
  const yearTotal = lines.reduce((s, c) => s + thisYear(c), 0);
  return `<section class="card"><div class="row between wrap"><h2>Contributions</h2><button type="button" class="small" id="addContrib">+ Add Contribution</button></div>
    <p class="hint">What goes in each paycheck or year. It fills in new updates and the FIRE projection. A line tied to a job stops when the job ends.</p>
    ${lines.length ? `<div class="table-wrap"><table><tbody>${lines.map(c => {
      const job = jobsById[c.job_id], yr = contribYearly(c, jobsById, now);
      const why = yr ? '' : c.end_date && dnum(c.end_date) < now ? 'Stopped' : job?.end_date && dnum(job.end_date) < now ? 'Job ended'
        : dnum(c.start_date) > now ? 'Not started' : 'Nothing now';
      return `<tr class="click" tabindex="0" data-contrib="${c.id}"><td><b>${SOURCES[c.source]}</b> · ${contribText(c, jobsById)}
          <br><span class="muted">${fmtDate(c.start_date)} – ${c.end_date ? fmtDate(c.end_date) : 'now'}${c.note ? ' · ' + esc(c.note) : ''}</span></td>
        <td class="r">${yr ? `${money(yr)} a year` : `<span class="chip">${why}</span>`}${thisYear(c) && Math.abs(thisYear(c) - yr) >= 1
          ? `<br><span class="muted">${money(thisYear(c))} in ${cy}</span>` : ""}</td></tr>`;
    }).join('')}</tbody></table></div>
    ${you + emp ? `<p style="margin:.7rem 0 0"><b>${money(you + emp)} a year</b> <span class="muted">at today's pay · you ${money(you)} · employer ${money(emp)}</span>
      ${Math.abs(yearTotal - you - emp) >= 1 ? `<br><b>${money(yearTotal)} in ${cy}</b> <span class="muted">counting only the days each line runs this year</span>` : ""}</p>` : ''}`
    : '<p class="muted">No contributions yet. Add yours and your employer\'s, like 4% of pay or $100 a paycheck.</p>'}
  </section>`;
}

async function contribDialog(a, c, jobs, people) {
  const kind = c?.kind || 'percent', per = c?.per || 'paycheck';
  const f = await ask({ title: c ? 'Change Contribution' : 'Add Contribution', ok: c ? 'Save' : 'Add', wide: true,
    extra: c ? { value: 'delete', label: 'Delete' } : null,
    body: `<div class="two">
        <label>Who Puts It In<select name="source">${Object.entries(SOURCES).map(([k, v]) => `<option value="${k}"${(c?.source || 'you') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>How<select name="kind" data-ckind><option value="percent"${kind === 'percent' ? ' selected' : ''}>Percent of Pay</option>
          <option value="amount"${kind === 'amount' ? ' selected' : ''}>Dollars</option></select></label>
      </div>
      <div class="two">
        <label data-cpct${kind === 'percent' ? '' : ' hidden'}>Percent<span class="unit percent"><input type="number" name="percent" min="0" max="100" step="0.01"
          inputmode="decimal" value="${esc(c?.percent ?? '')}" ${kind === 'percent' ? 'required' : ''} data-need="Enter the percent." data-range="Use 0 to 100."></span></label>
        ${moneyField('amount', 'Amount', c?.amount ?? '', { required: kind === 'amount', need: 'Enter the amount.' }).replace('<label>', `<label data-camt${kind === 'amount' ? '' : ' hidden'}>`)}
        <label data-cper${kind === 'amount' ? '' : ' hidden'}>Every<select name="per">${Object.entries(PER).map(([k, v]) => `<option value="${k}"${per === k ? ' selected' : ''}>${Cap(v.replace(/^an? /, ''))}</option>`).join('')}</select></label>
      </div>
      <label>Job <span class="muted" data-cjobnote></span><select name="job"><option value="">None</option>
        ${jobs.map(j => `<option value="${j.id}"${(c ? c.job_id : a.job_id) === j.id ? ' selected' : ''}>${esc(j.employer)} (${esc(people.find(p => p.id === j.person_id)?.name || '')})${j.end_date ? ', ended' : ''}</option>`).join('')}</select></label>
      <div class="two">
        <label>Started<input type="date" name="start_date" value="${esc(c?.start_date || today())}" required data-need="Pick when it started."></label>
        <label>Stopped <span class="muted">(blank = still going)</span><input type="date" name="end_date" value="${esc(c?.end_date || '')}"></label>
      </div>
      <label>Note <span class="muted">(optional)</span><input name="note" maxlength="200" value="${esc(c?.note)}" autocomplete="off"></label>`,
    onOpen: form => {
      const set = () => {
        const k = form.elements.kind.value, pc = form.elements.per.value;
        form.querySelector('[data-cpct]').hidden = k !== 'percent';
        form.querySelector('[data-camt]').hidden = form.querySelector('[data-cper]').hidden = k !== 'amount';
        form.elements.percent.required = k === 'percent';
        form.elements.amount.required = k === 'amount';
        const needJob = k === 'percent' || pc === 'paycheck';
        form.querySelector('[data-cjobnote]').textContent = needJob ? (k === 'percent' ? '(whose pay)' : '(whose paychecks)') : '(optional: it stops when the job ends)';
        form.elements.job.required = needJob;
        form.elements.job.dataset.need = 'Pick the job this comes from.';
      };
      form.addEventListener('change', e => { if (e.target.name === 'kind' || e.target.name === 'per') set(); });
      set();
    } });
  if (!f) return;
  if (f.get('button') === 'delete') {
    if (!await confirmDelete('Delete Contribution?', `This deletes "${SOURCES[c.source]}: ${contribText(c, byId(jobs))}". Updates already saved keep their amounts. To keep it in the history, set Stopped instead.`)) return;
    return busy(null, async () => { await sb.from('fire_contributions').delete().eq('id', c.id).then(must); flash('Contribution deleted.'); redraw(); });
  }
  const k = f.get('kind');
  const row = { account_id: a.id, source: f.get('source'), kind: k, percent: k === 'percent' ? +f.get('percent') : null,
    amount: k === 'amount' ? num(f.get('amount')) : null, per: k === 'amount' ? f.get('per') : null, job_id: f.get('job') || null,
    start_date: f.get('start_date'), end_date: f.get('end_date') || null, note: f.get('note').trim() };
  if (row.end_date && row.end_date < row.start_date) { flash('Stopped is before Started.', 'error'); return; }
  await busy(null, async () => {
    if (c) await sb.from('fire_contributions').update(row).eq('id', c.id).then(must);
    else await sb.from('fire_contributions').insert(row).then(must);
    flash(c ? 'Contribution saved.' : 'Contribution added.');
    redraw();
  });
}
