// ---------- Feed (#/): the pal, today's progress, and the two berries ----------
// Tapping a berry throws it from where it sits into the pal (it shrinks as it flies away), the pal bounces with little
// shake marks around it, and a row goes into pt_feeds. Undo shows for 5 seconds after each throw.

let feeds = [];

async function feedPage() {
  view(loading);
  const tok = ++navToken;
  await loadSettings();
  const [rows, url] = await Promise.all([loadFeeds(), photoUrl()]);
  if (tok !== navToken) return;
  feeds = rows;
  view(`<section class="feed">
    <div class="status" id="status"></div>
    <div class="stage">
      <div class="pal" id="pal">${palPic(url)}
        <div class="marks" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map(i => `<span class="mark m${i}"></span>`).join('')}</div>
      </div>
      <h1 class="pal-name">${esc(settings.name)}</h1>
      <p class="mood" id="mood" aria-live="polite"></p>
    </div>
    <div class="berries">
      <button type="button" class="berry-btn daily" data-kind="daily">${berrySvg('daily')}<span>Daily PT</span></button>
      <button type="button" class="berry-btn climb" data-kind="climb"><span>Climb PT</span>${berrySvg('climb')}</button>
    </div>
  </section>`);
  renderStatus();
  app.onclick = e => {
    const b = e.target.closest('.berry-btn');
    if (b) feed(b.dataset.kind, b.querySelector('.berry'));
  };
}

function renderStatus() {
  const days = byDay(feeds), t = days.get(today()) || { daily: 0, climb: 0 };
  const goal = settings.daily_goal, streak = streakOf(days);
  const level = streak ? Math.min(5, Math.ceil(streak / 3)) : 0;   // the flame grows every 3 days, up to 5 sizes
  const monthStart = today().slice(0, 8) + '01';
  const climbMonth = feeds.filter(f => f.kind === 'climb' && dayOf(f.fed_at) >= monthStart).length;
  const dots = Array.from({ length: Math.max(goal, Math.min(t.daily, 10)) }, (_, i) =>
    `<span class="dot ${i < t.daily ? 'on' : ''} ${i >= goal ? 'extra' : ''}"></span>`).join('');
  $('#status').innerHTML = `
    <div class="streak lvl-${level}">${flameSvg}<b>${streak}</b> ${streak === 1 ? 'day' : 'days'} in a row</div>
    <div class="today"><span class="label">Daily PT today</span><span class="dots" role="img" aria-label="${t.daily} of ${goal}">${dots}</span>
      <span class="count">${t.daily}/${goal}</span></div>
    <div class="climbs">${berrySvg('climb', 'tiny')} Climb PT this month: <b>${climbMonth}</b>${t.climb ? ` <span class="muted">(${t.climb} today)</span>` : ''}</div>`;
  const name = esc(settings.name);
  $('#mood').innerHTML = t.daily >= goal ? `${name} is full and happy.`
    : t.daily ? `${plural(goal - t.daily, 'more berry', 'more berries')} to go today.`
    : streak ? `${name} is hungry. One berry keeps the streak going.` : `${name} is hungry.`;
}

function feed(kind, fromEl) {
  const row = { id: crypto.randomUUID(), kind, fed_at: new Date().toISOString() };
  feeds.push(row);
  const saving = sb.from('pt_feeds').insert(row).then(must);
  saving.catch(e => { feeds = feeds.filter(f => f !== row); if (app.contains(fromEl)) renderStatus(); flash(msgOf(e), 'error'); });
  toss(kind, fromEl).then(() => { if (!app.contains(fromEl)) return; celebrate(); renderStatus(); });
  showUndo(kind, row, saving);
}

// The throw: across in a straight line, up and over in an arc, and smaller the whole way, as if flying away from you.
function toss(kind, fromEl) {
  const pal = $('#pal');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const a = fromEl.getBoundingClientRect(), b = pal.getBoundingClientRect();
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - sx, dy = b.top + b.height * .55 - sy;
  const fly = document.createElement('div');
  fly.className = 'flying';
  fly.style.left = sx + 'px'; fly.style.top = sy + 'px';
  fly.innerHTML = `<div class="fly-y"><div class="fly-s">${berrySvg(kind)}</div></div>`;
  document.body.append(fly);
  const ms = 650, opts = { duration: ms, fill: 'forwards' };
  fly.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { ...opts, easing: 'linear' });
  fly.firstChild.animate([
    { transform: 'translateY(0)', easing: 'cubic-bezier(.2, .7, .4, 1)' },
    { transform: `translateY(${dy - 70}px)`, offset: .62, easing: 'cubic-bezier(.6, 0, .9, .6)' },
    { transform: `translateY(${dy}px)` }], opts);
  const shrink = fly.firstChild.firstChild.animate([
    { transform: 'scale(1.7) rotate(0)', opacity: 1 },
    { transform: 'scale(.35) rotate(220deg)', opacity: 1, offset: .85 },
    { transform: 'scale(.1) rotate(280deg)', opacity: 0 }], { ...opts, easing: 'ease-in' });
  return shrink.finished.then(() => fly.remove(), () => fly.remove());
}

// The pal bounces, and short shake marks pop out around it and jiggle.
function celebrate() {
  const pal = $('#pal');
  if (!pal) return;
  pal.classList.remove('happy');
  void pal.offsetWidth;   // restarts the animation on a quick second throw
  pal.classList.add('happy');
}

let undoTimer;
function showUndo(kind, row, saving) {
  const bar = $('#undo');
  $('span', bar).textContent = kind === 'climb' ? 'Climb PT berry fed.' : 'Daily PT berry fed.';
  bar.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { bar.hidden = true; }, 5000);
  $('button', bar).onclick = () => {
    bar.hidden = true;
    clearTimeout(undoTimer);
    busy(null, async () => {
      await saving;
      await sb.from('pt_feeds').delete().eq('id', row.id).then(must);
      feeds = feeds.filter(f => f !== row);
      if ($('#status')) renderStatus();
      flash('Berry taken back.');
    });
  };
}
