// ---------- History (#/history): streaks, a month calendar, and fixing a day ----------
// A day's cell shows its Sweetberries (filled when the goal was met, a sparkle when passed) and a Cragberry for climb day PT.
// Tapping a day lists its berries to delete one, or adds one that was forgotten. Tapping the month opens a month and year picker.

let histMonth = null;   // 'YYYY-MM' being shown; starts on this month
let histYear = null, histYearOf = null;   // the Year in Berries card's year, and the "last year" it was picked in

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
  const goalDays = inMonth.filter(([, e]) => berriesOn(e) >= goal).length;
  const stuffedDays = inMonth.filter(([, e]) => isStuffed(e, goal)).length;

  const [y, m] = histMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), count = new Date(y, m, 0).getDate();
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = n => iso(new Date(y, m - 1 + n, 1)).slice(0, 7);
  const isNow = histMonth === today().slice(0, 7);
  // The four monthly cards say which month they count (the user asked): "This Month", or the month shown, like "Oct 2026".
  const when = `<small>${isNow ? 'This Month' : first.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small>`;
  // The Year in Berries card (the user asked): January only, and only years already over (the first berry's year to
  // last year). Starts on last year. Hidden if there are none.
  const lastYr = new Date().getFullYear() - 1, firstYr = feeds.length ? +dayOf(feeds[0].fed_at).slice(0, 4) : lastYr + 1;
  const showYear = new Date().getMonth() === 0 && firstYr <= lastYr;
  if (histYearOf !== lastYr || !(histYear >= firstYr && histYear <= lastYr)) { histYear = lastYr; histYearOf = lastYr; }   // a new year starts on the year just ended
  const week = [...Array(7)].map((_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));   // Nov 1 2026 is a Sunday
  const cells = [...Array(first.getDay())].map(() => '<span></span>');
  for (let i = 1; i <= count; i++) {
    const d = iso(new Date(y, m - 1, i)), e = days.get(d), future = d > today();
    // Sweetberries as little berry icons (the user asked), up to 3, then +n
    const dots = e?.daily ? `<span class="cal-dots">${berrySvg('daily', 'cal-berry').repeat(Math.min(e.daily, 3))}${e.daily > 3 ? `<small>+${e.daily - 3}</small>` : ''}</span>` : '';
    const desc = [e?.daily ? plural(e.daily, 'Sweetberry', 'Sweetberries') : '', e?.climb ? plural(e.climb, 'Cragberry', 'Cragberries') : ''].filter(Boolean).join(', ');
    cells.push(`<button type="button" class="day ${berriesOn(e) >= goal ? 'met' : ''} ${isStuffed(e, goal) ? 'passed' : ''} ${d === today() ? 'is-today' : ''}" data-day="${d}" ${future ? 'disabled' : ''}
      aria-label="${fmtDate(d)}${desc ? ': ' + desc : ''}">${isStuffed(e, goal) ? '<span class="cal-spark"></span>' : ''}<span class="num">${i}</span>${dots}${e?.climb ? berrySvg('climb', 'cal-gold') : ''}</button>`);
  }

  view(`<div class="page-head"><h1 class="big">History</h1></div>
    <div class="stats">
      <div class="stat">${flameSvg}<b>${streakOf(days)}</b><span>Current Streak</span></div>
      <div class="stat"><b>${bestStreak(days)}</b><span>Best Streak</span></div>
      <div class="stat"><b>${goalDays}</b><span>Full Days${when}</span></div>
      <div class="stat"><span class="cal-spark" aria-hidden="true"></span><b>${stuffedDays}</b><span>Stuffed Days${when}</span></div>
      <div class="stat">${berrySvg('daily', 'tiny')}<b>${sum('daily')}</b><span>Sweet&shy;berries${when}</span></div>
      <div class="stat">${berrySvg('climb', 'tiny')}<b>${sum('climb')}</b><span>Crag&shy;berries${when}</span></div>
    </div>
    <div class="card cal-card">
      <div class="cal-head">
        <button type="button" class="ghost small" data-month="${shift(-1)}" aria-label="Previous month">‹</button>
        <h2><button type="button" class="month-btn" id="pickMonth" aria-label="Pick a month: ${label}">${label} <span aria-hidden="true">▾</span></button></h2>
        <button type="button" class="ghost small" data-month="${shift(1)}" aria-label="Next month" ${isNow ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal">${week.map(w => `<span class="wk">${w}</span>`).join('')}${cells.join('')}</div>
      <!-- A legend of the calendar's marks, instead of a paragraph (the user asked) -->
      <ul class="legend">
        <li>${berrySvg('daily', 'lg-berry')}Sweetberry</li>
        <li>${berrySvg('climb', 'lg-berry')}Cragberry</li>
        <li><span class="cal-spark lg-spark"></span>Stuffed</li>
      </ul>
    </div>
    ${showYear ? `<div class="card">
      <div class="cal-head">
        <button type="button" class="ghost small" data-year="${histYear - 1}" aria-label="Previous year" ${histYear <= firstYr ? 'disabled' : ''}>‹</button>
        <h2>${histYear} in Berries</h2>
        <button type="button" class="ghost small" data-year="${histYear + 1}" aria-label="Next year" ${histYear >= lastYr ? 'disabled' : ''}>›</button>
      </div>
      ${yearHtml(days, goal, histYear)}
    </div>` : ''}`, { keepScroll: true });

  app.onclick = e => {
    const yr = e.target.closest('[data-year]');
    if (yr) { histYear = +yr.dataset.year; redraw(); return; }
    const mo = e.target.closest('[data-month]');
    if (mo) { histMonth = mo.dataset.month; redraw(); return; }
    if (e.target.closest('#pickMonth')) { pickMonth(); return; }
    const day = e.target.closest('[data-day]');
    if (day) dayDialog(day.dataset.day);
  };
}

async function dayDialog(day) {
  let changed = false;
  const list = () => {
    const rows = feeds.filter(f => dayOf(f.fed_at) === day);
    return rows.length ? `<ul class="day-list">${rows.map(f => `<li>${berrySvg(f.kind, 'tiny')}
      <span>${BERRY[f.kind][0]} <small class="muted">${BERRY[f.kind][1]}</small></span>
      <span class="muted">${new Date(f.fed_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
      <button type="button" class="ghost small danger" data-del="${f.id}">Delete</button></li>`).join('')}</ul>`
      : '<p class="muted">No berries this day.</p>';
  };
  await ask({ title: fmtDate(day), ok: 'Done', cancel: false,
    body: `<div id="dayList">${list()}</div>
      <div class="row wrap"><button type="button" class="small" data-add="daily">Add Sweetberry</button>
      <button type="button" class="small" data-add="climb">Add Cragberry</button></div>`,
    onOpen: f => { syncCrag(f); f.addEventListener('click', e => {
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
      }).then(() => syncCrag(f));   // after busy(), which turns the tapped button back on
    }); } });
  if (changed) redraw();

  // One Cragberry a day (the user asked), here as on Feed: Add Cragberry is off once the day has one.
  function syncCrag(form) {
    const btn = form.querySelector('[data-add="climb"]'), has = feeds.some(x => x.kind === 'climb' && dayOf(x.fed_at) === day);
    btn.disabled = has;
    btn.textContent = has ? 'Cragberry Added' : 'Add Cragberry';
  }
}

// The month and year picker (the user asked): a year with arrows over a grid of its 12 months. Future months are off;
// a dot marks a month with any berries. Picking a month closes it; This Month jumps back to now.
async function pickMonth() {
  const now = today().slice(0, 7), thisYr = +now.slice(0, 4);
  const withBerries = new Set(feeds.map(f => dayOf(f.fed_at).slice(0, 7)));
  const firstYr = Math.min(thisYr, ...[...withBerries].map(m => +m.slice(0, 4)));
  let yr = +histMonth.slice(0, 4);
  const grid = () => [...Array(12)].map((_, i) => {
    const m = `${yr}-${String(i + 1).padStart(2, '0')}`;
    const name = new Date(yr, i, 1).toLocaleDateString(undefined, { month: 'short' });
    return `<button type="button" class="mo ${m === histMonth ? 'on' : ''}" data-pick="${m}" ${m > now ? 'disabled' : ''}
      aria-label="${new Date(yr, i, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}${withBerries.has(m) ? ', has berries' : ''}">
      ${name}${withBerries.has(m) ? '<i></i>' : ''}</button>`;
  }).join('');
  const f = await ask({ title: 'Pick a Month', ok: 'This Month',
    body: `<input type="hidden" name="month" value="${now}">
      <div class="yr-head"><button type="button" class="ghost small" data-yr="-1" aria-label="Previous year">‹</button>
        <b id="yrLabel">${yr}</b><button type="button" class="ghost small" data-yr="1" aria-label="Next year">›</button></div>
      <div class="months" id="months">${grid()}</div>`,
    onOpen: form => {
      const arrows = () => form.querySelectorAll('[data-yr]').forEach(b => { b.disabled = +b.dataset.yr < 0 ? yr <= firstYr : yr >= thisYr; });
      arrows();
      form.addEventListener('click', e => {
        const y = e.target.closest('[data-yr]'), pick = e.target.closest('[data-pick]');
        if (y) { yr += +y.dataset.yr; form.querySelector('#yrLabel').textContent = yr; form.querySelector('#months').innerHTML = grid(); arrows(); }
        if (pick) { form.elements.month.value = pick.dataset.pick; form.requestSubmit(form.querySelector('button[value="ok"]')); }
      });
    } });
  if (!f) return;
  histMonth = f.get('month');
  redraw();
}

// ---------- A year in berries (the user asked) ----------
// The year's totals, full and stuffed days, its best streak (counted inside the year), and its Christmas tree.
function yearStats(days, goal, year) {
  const inYear = [...days].filter(([d]) => d.startsWith(year + '-')).sort(([a], [b]) => a.localeCompare(b));
  const sum = k => inYear.reduce((n, [, e]) => n + e[k], 0);
  let best = 0, run = 0, prev = null;
  for (const [d, e] of inYear) {
    if (!e.daily) { run = 0; prev = null; continue; }
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    best = Math.max(best, run);
  }
  return { sweet: sum('daily'), crag: sum('climb'), full: inYear.filter(([, e]) => berriesOn(e) >= goal).length,
    stuffed: inYear.filter(([, e]) => isStuffed(e, goal)).length, best, ornaments: ornamentDays(days, goal, year).length,
    harvest: harvestDays(days, goal, year).length, harvestOf: thanksgiving(year), envelopes: cnyDays(days, goal, year).length,
    spooky: halloweenDays(days, goal, year).length };
}
function yearHtml(days, goal, year) {
  const s = yearStats(days, goal, year);
  return `<div class="stats yr-stats">
      <div class="stat"><b>${s.sweet + s.crag}</b><span>Berries</span></div>
      <div class="stat">${berrySvg('daily', 'tiny')}<b>${s.sweet}</b><span>Sweet&shy;berries</span></div>
      <div class="stat">${berrySvg('climb', 'tiny')}<b>${s.crag}</b><span>Crag&shy;berries</span></div>
      <div class="stat"><b>${s.full}</b><span>Full Days</span></div>
      <div class="stat"><span class="cal-spark" aria-hidden="true"></span><b>${s.stuffed}</b><span>Stuffed Days</span></div>
      <div class="stat">${flameSvg}<b>${s.best}</b><span>Best Streak</span></div>
    </div>
    ${s.envelopes ? `<p class="yr-tree">Chinese New Year tree: ${s.envelopes} of ${CNY_DAYS} red envelopes.</p>` : ''}
    ${s.spooky ? `<p class="yr-tree">Halloween pumpkin: ${s.spooky} of 31 days.</p>` : ''}
    ${s.harvest ? `<p class="yr-tree">Thanksgiving table: ${s.harvest} of ${s.harvestOf} days.</p>` : ''}
    ${s.ornaments ? `<p class="yr-tree">Christmas tree: ${s.ornaments} of 24 ornaments.</p>` : ''}`;
}

// The first time the app is opened in a new year (whenever that is: it doesn't have to be January 1), last year's
// screen shows once, anywhere: year_seen is saved first, so it can't show twice. Not if last year had no berries.
// After that, the Year in Berries card on History has it, until the end of January.
async function newYear() {
  const y = new Date().getFullYear(), last = y - 1;
  if (!('year_seen' in settings) || settings.year_seen >= y) return;
  if (!feeds.some(f => dayOf(f.fed_at).startsWith(last + '-'))) return;
  try { await sb.from('pt_settings').update({ year_seen: y }).eq('id', true).then(must); }
  catch (e) { logError('error', 'year_seen: ' + msgOf(e)); return; }
  settings.year_seen = y;
  await ask({ title: 'Happy New Year!', ok: 'Done', cancel: false,
    body: `<div class="ny-sparkles" aria-hidden="true"></div>
      <p class="ny-sub">Here's ${esc(settings.name)}'s ${last} in berries.</p>${yearHtml(byDay(feeds), settings.daily_goal, last)}
      <p class="hint">See it again on History until the end of January.</p>`,
    onOpen: form => {
      if (reducedMotion()) return;
      const layer = form.querySelector('.ny-sparkles');
      const one = delay => {
        const s = document.createElement('span');
        s.className = 'sparkle' + (Math.random() < .5 ? ' gold' : '');
        s.style.cssText = `left:${5 + Math.random() * 90}%; top:${5 + Math.random() * 90}%; --sz:${10 + Math.random() * 12}px; animation-delay:${delay}ms`;
        s.onanimationend = () => s.remove();
        layer.append(s);
      };
      for (let i = 0; i < 16; i++) one(Math.random() * 600);
      for (let i = 0; i < 10; i++) one(900 + Math.random() * 800);
    } });
}
