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
  view(`<section class="feed">${roomSvg}
    <div class="sparkles" id="sparkles" aria-hidden="true"></div>
    <div class="dust" id="dust" aria-hidden="true"></div>
    <!-- Rim light (the user asked for the pal's edge lit, not the whole pal): a thin band just inside the outline,
         thicker on top where the fire behind catches it. setFire sets its strength (#rimFlood). -->
    <svg class="fx-defs" width="0" height="0" aria-hidden="true"><filter id="rimLight" x="-5%" y="-5%" width="110%" height="110%">
      <feMorphology in="SourceAlpha" operator="erode" radius="3" result="core"/><feOffset in="core" dy="3" result="low"/>
      <feComposite in="SourceAlpha" in2="low" operator="out" result="edge"/><feGaussianBlur in="edge" stdDeviation="1.4" result="soft"/>
      <feFlood id="rimFlood" flood-color="rgb(255,165,80)" flood-opacity="0"/><feComposite in2="soft" operator="in" result="lit"/>
      <feComposite in="lit" in2="SourceAlpha" operator="in" result="rim"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rim"/></feMerge></filter></svg>
    <div class="status">
      <div class="today" id="todayRow"></div>
    </div>
    <div class="stage">
      ${fireplaceSvg}
      <div class="pal" id="pal"><span class="rug" aria-hidden="true"></span><span class="pal-breathe">${palPic(url, hatSeason() ? palHat(url) : null)}</span>
        <div class="marks" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map(i => `<span class="mark m${i}"></span>`).join('')}</div>
      </div>
      <h1 class="pal-name">${esc(settings.name)}</h1>
      <p class="mood" id="mood" aria-live="polite"></p>
    </div>
    <div class="berries">${berryBtn('daily')}
      <div class="undo" id="undo" hidden><button type="button" class="undo-btn">Undo</button></div>${berryBtn('climb')}
      <span class="sr-only" id="undoMsg" role="status"></span>
    </div>
  </section>`);
  shownLevel = null;   // the first draw sets the fire without a whoosh
  shownOrn = null;     // and hangs the ornaments without the pop
  shownFruit = null;   // and sets the Thanksgiving table the same way
  renderStatus();
  placeRoom();
  setSky();
  startFx();
  newYear();
  app.onclick = e => {
    const b = e.target.closest('.berry-btn');
    if (b) feed(b.dataset.kind, b.querySelector('.berry'));
  };
}

// What the effects need, worked out in renderStatus: passed = today's goal is passed (sparkles for the rest of the day),
// egg = a week at full fire (sparks out of the fireplace).
let fx = { day: null, passed: false, egg: false };

function renderStatus() {
  const days = byDay(feeds), t = days.get(today()) || { daily: 0, climb: 0 };
  const goal = settings.daily_goal, flame = flameOf(days, goal);
  fx = { day: today(), passed: isStuffed(t, goal), egg: flame.full >= 7, level: flame.level };
  $('.feed').style.setProperty('--rim', (flame.level / FLAME_TOP).toFixed(2));   // the warm glow around the pal grows with the fire
  setFire(flame.level, fx.egg);
  setXmas(days, goal);
  setFall(days, goal);
  // Today's goal counts both berries (the user asked): red dots for Sweetberries, then a gold one for the Cragberry.
  const n = berriesOn(t);
  const dots = Array.from({ length: Math.max(goal, Math.min(n, 10)) }, (_, i) =>
    `<span class="dot ${i < t.daily ? 'on' : i < n ? 'on crag' : ''} ${i >= goal ? 'extra' : ''}"></span>`).join('');
  $('#todayRow').innerHTML = `<span class="label">Berries today</span><span class="dots" role="img" aria-label="${n} of ${goal}">${dots}</span>
    <span class="count">${n}/${goal}</span>`;
  // One Cragberry a day (the user asked): it greys out once used, until Undo takes it back or the day turns.
  const crag = $('.berry-btn.climb');
  crag.disabled = t.climb > 0;
  $('small', crag).textContent = t.climb ? 'Done for today' : BERRY.climb[1];
  const name = esc(settings.name);
  $('#mood').innerHTML = fx.passed ? `${name} is stuffed${fallNow().tday ? ' like a turkey' : ''}!`   // on Thanksgiving Day (the user asked)
    : n === goal ? `${name} is full and happy.`
    : n ? `${name} would love ${plural(goal - n, 'more berry', 'more berries')}.`
    : `${name} would love a berry.`;
}

function feed(kind, fromEl) {
  const row = { id: crypto.randomUUID(), kind, fed_at: new Date().toISOString() };
  const wasPassed = fx.passed;
  feeds.push(row);
  if (kind === 'climb') fromEl.closest('button').disabled = true;   // no second Cragberry from a quick double tap
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
let fxTimer, skyTick = 0;
function startFx() {
  clearInterval(fxTimer);
  let tick = 0;
  fxTimer = setInterval(() => {
    if (!$('#sparkles')) return clearInterval(fxTimer);
    if (document.hidden) return;
    if (fx.day !== today()) renderStatus();   // past midnight: a new day, so the sparkles stop
    if (++skyTick % 60 === 0) setSky();   // every 30 s: dawn, day, dusk, and night come round on their own
    if (reducedMotion()) return;   // the midnight check above still runs, so Cragberry comes back at midnight
    tick++;
    if (fx.egg && Math.random() < .8) ember();
    if (fx.level >= 3 && Math.random() < .3) speck();
    // About every 1.5 s, at an uneven beat: one sparkle, or sometimes two a moment apart (the user asked).
    if (fx.passed && Math.random() < .33) { sparkle(); if (Math.random() < .4) sparkle(150 + Math.random() * 500); }
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
    --sz:${10 + Math.random() * 10}px; animation-delay:${delay}ms`;
  s.onanimationend = () => s.remove();
  setTimeout(() => s.remove(), 3000 + delay);   // in case the browser stops drawing before it ends
  layer.append(s);
}
// The berry that passes the goal: a quick shower before the gentle twinkling.
function burst() {
  if (reducedMotion()) return;
  for (let i = 0; i < 10; i++) sparkle(Math.random() * 350);
}

// Specks of dust drifting in the firelight (the user asked: not too dusty). None until the fire's step 3, then at
// most one fewer than the step on screen at once (2 at step 3, 6 at step 7), around the fireplace only. They float in
// front of the room (#dust), and wander: three random waypoints in any direction, with a slight upward pull from the warm air.
function speck() {
  const layer = $('#dust'), fire = $('#fire');
  if (!layer || !fire || layer.querySelectorAll('.speck').length >= fx.level - 1) return;
  const L = layer.getBoundingClientRect(), F = fire.getBoundingClientRect();
  const r = (lo, hi) => (lo + Math.random() * (hi - lo)).toFixed(0) + 'px';
  const s = document.createElement('span');
  s.className = 'speck';
  s.style.cssText = `left:${F.left - L.left + F.width * (-.25 + Math.random() * 1.5)}px; top:${F.top - L.top + F.height * (.25 + Math.random() * .85)}px;
    --x1:${r(-18, 18)}; --y1:${r(-14, 10)}; --x2:${r(-24, 24)}; --y2:${r(-22, 12)}; --x3:${r(-28, 28)}; --y3:${r(-32, 8)};
    --t:${(7 + Math.random() * 4).toFixed(1)}s`;
  s.onanimationend = () => s.remove();
  setTimeout(() => s.remove(), 11000);
  layer.append(s);
}

function ember() {
  const box = $('#embers');
  if (!box) return;
  const e = document.createElement('span');
  e.className = 'ember';
  e.style.cssText = `--dx:${(Math.random() * 28 - 14).toFixed(1)}px; --x:${(Math.random() * 20 - 10).toFixed(1)}px;
    --t:${(1 + Math.random() * .6).toFixed(2)}s; --c:${Math.random() < .5 ? 'var(--gold)' : '#FF8A2B'}`;
  e.onanimationend = () => e.remove();
  setTimeout(() => e.remove(), 2500);
  box.append(e);
}

const berryBtn = k => `<button type="button" class="berry-btn ${k}" data-kind="${k}">
  ${berrySvg(k)}<span class="b-name">${BERRY[k][0]}</span><small>${BERRY[k][1]}</small></button>`;

// Undo sits between the two berries (the user asked: under the header it covered the flame). Screen readers hear
// "<berry> fed." from a separate status line, since the button is hidden most of the time.
let undoTimer;
function showUndo(kind, row, saving) {
  const bar = $('#undo');
  if (!bar) return;
  $('#undoMsg').textContent = `${BERRY[kind][0]} fed.`;
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
      if (!$('#fire')) return;
      renderStatus();
      $('#undoMsg').textContent = 'Berry taken back.';   // not flash(): it would sit over the berries
    });
  };
}
