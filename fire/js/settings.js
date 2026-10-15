// ---------- Settings: people and assumptions ----------

const loadPeople = () => sb.from('fire_people').select('*').order('position').order('name').then(must);

// The defaults for every assumption. fire_settings stores null for "use the default", so Reset to Defaults sets every
// column back to null and a changed default here reaches everyone who never changed it.
const DEFAULTS = { real_return: 7, inflation: 3, withdrawal_rate: 4, retire_age: 65, start_age: 22 };
const ASSUMPTIONS = [
  { key: 'real_return', label: 'Expected Return', unit: 'percent', min: -20, max: 30, step: 0.1,
    hint: 'A year, after inflation. The S&P 500 has averaged about 7% after inflation over the long run.' },
  { key: 'inflation', label: 'Inflation', unit: 'percent', min: -10, max: 30, step: 0.1, hint: 'A year. Turns past pay into today’s dollars.' },
  { key: 'withdrawal_rate', label: 'Withdrawal Rate', unit: 'percent', min: 0.1, max: 20, step: 0.1,
    hint: 'How much of your savings you spend a year once retired. Your FI number is spending ÷ this (the 4% rule makes it 25×).' },
  { key: 'retire_age', label: 'Normal Retirement Age', unit: 'years', min: 30, max: 100, step: 1, hint: 'The “on track” line is measured against this.' },
  { key: 'start_age', label: 'Salary History Starts At', unit: 'years', min: 10, max: 80, step: 1, hint: 'The first age shown on Salary.' },
];

async function loadSettings() {
  const row = await sb.from('fire_settings').select('*').maybeSingle().then(must) || {};
  return Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, row[k] == null ? DEFAULTS[k] : +row[k]]));
}

async function settingsPage() {
  const t = ++navToken;
  view(loading);
  const [people, raw] = await Promise.all([loadPeople(), sb.from('fire_settings').select('*').maybeSingle().then(must)]);
  if (t !== navToken) return;
  const row = raw || {};
  const isDefault = ASSUMPTIONS.every(a => row[a.key] == null);
  view(`<div class="page-head"><div><h1 class="big">Settings</h1></div></div>
    <div class="settings-grid">
      <section class="card"><h2>People</h2>
        <p class="hint">Birth dates turn dates into ages.</p>
        <form id="peopleForm" data-save class="stack">
          ${people.map(p => `<div class="person-row">
            <label>Name<input name="name_${p.id}" maxlength="40" value="${esc(p.name)}" required data-need="Enter a name." autocomplete="off"></label>
            <label>Birth Date<input type="date" name="birth_${p.id}" value="${esc(p.birth_date || '')}" max="${today()}"></label>
          </div>`).join('')}
          <div class="row end"><button class="primary">Save People</button></div>
        </form>
      </section>
      <section class="card"><h2>Assumptions</h2>
        <p class="hint">Every projection uses these. They're guesses about the future, not advice.</p>
        <form id="assumeForm" data-save class="stack">
          ${ASSUMPTIONS.map(a => `<label>${a.label} <span class="default-note">Default ${DEFAULTS[a.key]}${a.unit === 'percent' ? '%' : ''}</span>
            <span class="unit ${a.unit}"><input type="number" name="${a.key}" value="${row[a.key] == null ? DEFAULTS[a.key] : +row[a.key]}"
              min="${a.min}" max="${a.max}" step="${a.step}" inputmode="decimal" required data-need="Enter a number."
              data-range="Use a number from ${a.min} to ${a.max}."></span>
            <span class="hint" style="display:block;margin:.3rem 0 0;font-weight:400">${a.hint}</span></label>`).join('')}
          <div class="row end"><button type="button" id="resetBtn" class="ghost"${isDefault ? ' disabled' : ''}>Reset to Defaults</button>
            <button class="primary">Save Assumptions</button></div>
        </form>
      </section>
    </div>`);

  $('#peopleForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    busy(e.submitter, async () => {
      await Promise.all(people.map(p => sb.from('fire_people')
        .update({ name: f.get('name_' + p.id).trim(), birth_date: f.get('birth_' + p.id) || null }).eq('id', p.id).then(must)));
      flash('People saved.');
      redraw();
    });
  };
  // A value equal to its default is stored as null, so it follows the default.
  $('#assumeForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const vals = Object.fromEntries(ASSUMPTIONS.map(a => { const v = +f.get(a.key); return [a.key, v === DEFAULTS[a.key] ? null : v]; }));
    busy(e.submitter, () => saveSettings(vals, 'Assumptions saved.'));
  };
  $('#resetBtn').onclick = async e => {
    const ok = await ask({ title: 'Reset to Defaults?', ok: 'Reset',
      body: `<p>Every assumption goes back to its default: ${ASSUMPTIONS.map(a => `${a.label} ${DEFAULTS[a.key]}${a.unit === 'percent' ? '%' : ''}`).join(', ')}.</p>` });
    if (ok) busy(e.target, () => saveSettings(Object.fromEntries(ASSUMPTIONS.map(a => [a.key, null])), 'Assumptions reset to the defaults.'));
  };
}

async function saveSettings(vals, msg) {
  await sb.from('fire_settings').upsert({ id: true, ...vals, updated_at: new Date().toISOString() }).then(must);
  app.querySelectorAll('form').forEach(f => f.reset());   // so the redraw doesn't count these as unsaved
  flash(msg);
  redraw();
}
