// ---------- Feed (#/): the pal, today's progress, and the two berries ----------
// Tapping a berry throws it from where it sits into the pal (it shrinks as it flies away), the pal bounces with little
// shake marks around it, and a row goes into pt_feeds. Undo shows for 5 seconds after each throw.
// Sweetberry = daily PT, Cragberry = climb day PT (the user named them).

let feeds = [];
const BERRY = { daily: ['Sweetberry', 'Daily PT'], climb: ['Cragberry', 'Climb Day PT'] };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

async function feedPage() {
  view(loading);
  const tok = ++navToken;
  await loadSettings();
  const [rows, url] = await Promise.all([loadFeeds(), photoUrl()]);
  if (tok !== navToken) return;
  feeds = rows;
  view(`<section class="feed">
    <div class="sparkles" id="sparkles" aria-hidden="true"></div>
    <div class="status">
      <div class="streak" id="flameChip" role="img">${flameSvg}<span class="embers" id="embers"></span></div>
      <div class="today" id="todayRow"></div>
      <div class="climbs" id="climbRow"></div>
    </div>
    <div class="stage">
      <div class="pal" id="pal">${palPic(url)}
        <div class="marks" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map(i => `<span class="mark m${i}"></span>`).join('')}</div>
      </div>
      <h1 class="pal-name">${esc(settings.name)}</h1>
      <p class="mood" id="mood" aria-live="polite"></p>
    </div>
    <div class="berries">${['daily', 'climb'].map(k => `<button type="button" class="berry-btn ${k}" data-kind="${k}">
      ${berrySvg(k)}<span class="b-name">${BERRY[k][0]}</span><small>${BERRY[k][1]}</small></button>`).join('')}
    </div>
  </section>`);
  renderStatus();
  startFx();
  app.onclick = e => {
    const b = e.target.closest('.berry-btn');
    if (b) feed(b.dataset.kind, b.querySelector('.berry'));
  };
}

// What the effects need, worked out in renderStatus: passed = today's goal is passed (sparkles for the rest of the day),
// egg = a week at full flame (sparks off the flame).
let fx = { day: null, passed: false, egg: false };

function renderStatus() {
  const days = byDay(feeds), t = days.get(today()) || { daily: 0, climb: 0 };
  const goal = settings.daily_goal, flame = flameOf(days, goal);
  fx = { day: today(), passed: t.daily > goal, egg: flame.full >= 7 };
  const chip = $('#flameChip');
  chip.className = `streak lvl-${flame.level} ${fx.egg ? 'egg' : ''}`;
  chip.setAttribute('aria-label', `Flame: ${flame.level} of ${FLAME_TOP}`);
  const monthStart = today().slice(0, 8) + '01';
  const climbMonth = feeds.filter(f => f.kind === 'climb' && dayOf(f.fed_at) >= monthStart).length;
  const dots = Array.from({ length: Math.max(goal, Math.min(t.daily, 10)) }, (_, i) =>
    `<span class="dot ${i < t.daily ? 'on' : ''} ${i >= goal ? 'extra' : ''}"></span>`).join('');
  $('#todayRow').innerHTML = `<span class="label">Sweetberries today</span><span class="dots" role="img" aria-label="${t.daily} of ${goal}">${dots}</span>
    <span class="count">${t.daily}/${goal}</span>`;
  $('#climbRow').innerHTML = `${berrySvg('climb', 'tiny')} Cragberries this month: <b>${climbMonth}</b>${t.climb ? ` <span class="muted">(${t.climb} today)</span>` : ''}`;
  const name = esc(settings.name);
  $('#mood').innerHTML = t.daily > goal ? `${name} is stuffed!`
    : t.daily === goal ? `${name} is full and happy.`
    : t.daily ? `${name} would love ${plural(goal - t.daily, 'more berry', 'more berries')}.`
    : `${name} would love a berry.`;
}

function feed(kind, fromEl) {
  const row = { id: crypto.randomUUID(), kind, fed_at: new Date().toISOString() };
  const wasPassed = fx.passed;
  feeds.push(row);
  const saving = sb.from('pt_feeds').insert(row).then(must);
  saving.catch(e => { feeds = feeds.filter(f => f !== row); if (app.contains(fromEl)) renderStatus(); flash(msgOf(e), 'error'); });
  toss(kind, fromEl).then(() => {
    if (!app.contains(fromEl)) return;
    celebrate();
    renderStatus();
    if (fx.passed && !wasPassed) burst();   // this berry just went past the goal
  });
  showUndo(kind, row, saving);
}

// The throw: across in a straight line, up and over in an arc, and smaller the whole way, as if flying away from you.
function toss(kind, fromEl) {
  const pal = $('#pal');
  if (reducedMotion()) return Promise.resolve();
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
  // A browser that stops drawing mid-throw (app sent to the background) would hold the counts back; a timer settles it anyway.
  return Promise.race([shrink.finished, new Promise(r => setTimeout(r, ms + 400))]).then(() => fly.remove(), () => fly.remove());
}

// The pal bounces, and short shake marks pop out around it and jiggle.
function celebrate() {
  const pal = $('#pal');
  if (!pal) return;
  pal.classList.remove('happy');
  void pal.offsetWidth;   // restarts the animation on a quick second throw
  pal.classList.add('happy');
}

// ---------- Sparkles and sparks ----------
// One timer for both, every half second, only while the Feed page is up and the app is on screen.
// Goal passed (the user asked): a sparkle twinkles somewhere around the pal every ~1.5 s for the rest of the day.
// Full flame for a week (the user asked): sparks float up off the flame like a real fire.
let fxTimer;
function startFx() {
  clearInterval(fxTimer);
  if (reducedMotion()) return;
  let tick = 0;
  fxTimer = setInterval(() => {
    if (!$('#sparkles')) return clearInterval(fxTimer);
    if (document.hidden) return;
    if (fx.day !== today()) renderStatus();   // past midnight: a new day, so the sparkles stop
    tick++;
    if (fx.egg && Math.random() < .8) ember();
    if (fx.passed && tick % 3 === 0) sparkle();
  }, 500);
}

// A four-point sparkle in the space around the pal, away from the name and the berries.
function sparkle(delay = 0) {
  const layer = $('#sparkles'), pal = $('#pal');
  if (!layer || !pal) return;
  const L = layer.getBoundingClientRect(), P = pal.getBoundingClientRect();
  const angle = Math.random() * Math.PI * 2, r = P.width / 2 + 16 + Math.random() * 64;
  const x = P.left - L.left + P.width / 2 + Math.cos(angle) * r, y = P.top - L.top + P.height / 2 + Math.sin(angle) * r * .85;
  const s = document.createElement('span');
  s.className = 'sparkle' + (Math.random() < .5 ? ' gold' : '');
  s.style.cssText = `left:${Math.min(L.width - 12, Math.max(12, x))}px; top:${Math.min(L.height - 12, Math.max(12, y))}px;
    --s:${10 + Math.random() * 10}px; animation-delay:${delay}ms`;
  s.onanimationend = () => s.remove();
  setTimeout(() => s.remove(), 3000 + delay);   // in case the browser stops drawing before it ends
  layer.append(s);
}
// The berry that passes the goal: a quick shower before the gentle twinkling.
function burst() {
  if (reducedMotion()) return;
  for (let i = 0; i < 10; i++) sparkle(Math.random() * 350);
}

function ember() {
  const box = $('#embers');
  if (!box) return;
  const e = document.createElement('span');
  e.className = 'ember';
  e.style.cssText = `--dx:${(Math.random() * 16 - 8).toFixed(1)}px; --x:${(Math.random() * 8 - 4).toFixed(1)}px;
    --t:${(1 + Math.random() * .6).toFixed(2)}s; --c:${Math.random() < .5 ? 'var(--gold)' : '#FF8A2B'}`;
  e.onanimationend = () => e.remove();
  setTimeout(() => e.remove(), 2500);
  box.append(e);
}

let undoTimer;
function showUndo(kind, row, saving) {
  const bar = $('#undo');
  $('span', bar).textContent = `${BERRY[kind][0]} fed.`;
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
      if ($('#flameChip')) renderStatus();
      flash('Berry taken back.');
    });
  };
}
