// ---------- History (#/history): streaks, a month calendar, and fixing a day ----------
// A day's cell shows its daily berries (filled when the goal was met) and a gold berry for climb PT.
// Tapping a day lists its berries to delete one, or adds one that was forgotten.

let histMonth = null;   // 'YYYY-MM' being shown; starts on this month

async function historyPage() {
  if (!redrawing) view(loading);
  const tok = ++navToken;
  await loadSettings();
  const rows = await loadFeeds();
  if (tok !== navToken) return;
  feeds = rows;
  histMonth ??= today().slice(0, 7);
  const days = byDay(feeds), goal = settings.daily_goal;
  const inMonth = [...days].filter(([d]) => d.startsWith(histMonth));
  const sum = k => inMonth.reduce((n, [, e]) => n + e[k], 0);
  const goalDays = inMonth.filter(([, e]) => e.daily >= goal).length;

  const [y, m] = histMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), count = new Date(y, m, 0).getDate();
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = n => iso(new Date(y, m - 1 + n, 1)).slice(0, 7);
  const isNow = histMonth === today().slice(0, 7);
  const week = [...Array(7)].map((_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));   // Nov 1 2026 is a Sunday
  const cells = [...Array(first.getDay())].map(() => '<span></span>');
  for (let i = 1; i <= count; i++) {
    const d = iso(new Date(y, m - 1, i)), e = days.get(d), future = d > today();
    const dots = e?.daily ? `<span class="cal-dots">${'<i></i>'.repeat(Math.min(e.daily, 4))}${e.daily > 4 ? `<small>+${e.daily - 4}</small>` : ''}</span>` : '';
    const desc = [e?.daily ? plural(e.daily, 'daily berry', 'daily berries') : '', e?.climb ? `${e.climb} climb` : ''].filter(Boolean).join(', ');
    cells.push(`<button type="button" class="day ${e?.daily >= goal ? 'met' : ''} ${d === today() ? 'is-today' : ''}" data-day="${d}" ${future ? 'disabled' : ''}
      aria-label="${fmtDate(d)}${desc ? ': ' + desc : ''}"><span class="num">${i}</span>${dots}${e?.climb ? berrySvg('climb', 'cal-gold') : ''}</button>`);
  }

  view(`<div class="page-head"><h1 class="big">History</h1></div>
    <div class="stats">
      <div class="stat">${flameSvg}<b>${streakOf(days)}</b><span>Current Streak</span></div>
      <div class="stat"><b>${bestStreak(days)}</b><span>Best Streak</span></div>
      <div class="stat"><b>${goalDays}</b><span>Full Days</span></div>
      <div class="stat">${berrySvg('daily', 'tiny')}<b>${sum('daily')}</b><span>Daily PT</span></div>
      <div class="stat">${berrySvg('climb', 'tiny')}<b>${sum('climb')}</b><span>Climb PT</span></div>
    </div>
    <div class="card cal-card">
      <div class="cal-head">
        <button type="button" class="ghost small" data-month="${shift(-1)}" aria-label="Previous month">‹</button>
        <h2>${label}</h2>
        <button type="button" class="ghost small" data-month="${shift(1)}" aria-label="Next month" ${isNow ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal">${week.map(w => `<span class="wk">${w}</span>`).join('')}${cells.join('')}</div>
      <p class="hint">Full Days, Daily PT, and Climb PT count this month. A filled day met the goal of ${goal}. Tap a day to fix it.</p>
    </div>`, { keepScroll: true });

  app.onclick = e => {
    const mo = e.target.closest('[data-month]');
    if (mo) { histMonth = mo.dataset.month; redraw(); return; }
    const day = e.target.closest('[data-day]');
    if (day) dayDialog(day.dataset.day);
  };
}

async function dayDialog(day) {
  let changed = false;
  const list = () => {
    const rows = feeds.filter(f => dayOf(f.fed_at) === day);
    return rows.length ? `<ul class="day-list">${rows.map(f => `<li>${berrySvg(f.kind, 'tiny')}
      <span>${f.kind === 'climb' ? 'Climb PT' : 'Daily PT'}</span>
      <span class="muted">${new Date(f.fed_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
      <button type="button" class="ghost small danger" data-del="${f.id}">Delete</button></li>`).join('')}</ul>`
      : '<p class="muted">No berries this day.</p>';
  };
  await ask({ title: fmtDate(day), ok: 'Done', cancel: false,
    body: `<div id="dayList">${list()}</div>
      <div class="row wrap"><button type="button" class="small" data-add="daily">Add Daily PT</button>
      <button type="button" class="small" data-add="climb">Add Climb PT</button></div>`,
    onOpen: f => f.addEventListener('click', e => {
      const del = e.target.closest('[data-del]'), add = e.target.closest('[data-add]');
      if (!del && !add) return;
      busy(e.target.closest('button'), async () => {
        if (del) {
          await sb.from('pt_feeds').delete().eq('id', del.dataset.del).then(must);
          feeds = feeds.filter(x => x.id !== del.dataset.del);
        } else {
          // A forgotten berry: now if it's today, otherwise noon that day.
          const at = day === today() ? new Date() : new Date(day + 'T12:00');
          const row = await sb.from('pt_feeds').insert({ kind: add.dataset.add, fed_at: at.toISOString() }).select('id, kind, fed_at').single().then(must);
          feeds.push(row);
          feeds.sort((a, b) => a.fed_at.localeCompare(b.fed_at));
        }
        changed = true;
        $('#dayList').innerHTML = list();
      });
    }) });
  if (changed) redraw();
}
