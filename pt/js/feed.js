// ---------- Home (#/): the pal, today's progress, and the two berries ----------
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
      <feMorphology in="SourceAlpha" operator="erode" radius="1.5" result="core"/><feOffset in="core" dy="1.5" result="low"/>
      <feComposite in="SourceAlpha" in2="low" operator="out" result="edge"/><feGaussianBlur in="edge" stdDeviation="0.8" result="soft"/>
      <feFlood id="rimFlood" flood-color="rgb(255,165,80)" flood-opacity="0"/><feComposite in2="soft" operator="in" result="lit"/>
      <feComposite in="lit" in2="SourceAlpha" operator="in" result="rim"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rim"/></feMerge></filter></svg>
    <div class="status">
      <div class="today" id="todayRow"></div>
    </div>
    <div class="stage">
      ${fireplaceSvg}
      <div class="pal" id="pal" role="button" tabindex="0" aria-label="Boop ${esc(settings.name)}">${rugHtml(rugOf())}<span class="pal-breathe">${palPic(url, hatSeason() ? palHat(url) : null)}</span>
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
  shownHb = null;      // and the Chinese New Year envelopes
  renderStatus();
  placeRoom();
  setSky();
  startFx();
  newYear();
  app.onclick = e => {
    const b = e.target.closest('.berry-btn');
    if (b) feed(b.dataset.kind, b.querySelector('.berry'));
  };
  palTouch($('#pal'));
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
  setCny(days, goal);
  setHalloween(days, goal);
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
  $('#mood').innerHTML = fx.passed ? `${name} is stuffed${fallNow().tday ? ' like a turkey' : cnyNow().feast ? ' with dumplings' : halloweenNow().hday ? ' on candy' : ''}!`   // on Thanksgiving Day (the user asked), Chinese New Year's Eve and Day, and Halloween
    : n === goal ? `${name} is full and happy.`
    : n ? `${name} would love ${plural(goal - n, 'more berry', 'more berries')}.`
    : `${name} would love a berry.`;
}

function feed(kind, fromEl) {
  const row = { id: crypto.randomUUID(), kind, fed_at: new Date().toISOString() };
  const wasPassed = fx.passed;
  stopPet();
  palBusy = Date.now() + (reducedMotion() ? 0 : 1500);   // the throw and the bounce: taps on the pal wait
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
  // Spins the way it's thrown: the Sweetberry (left) clockwise, the Cragberry (right) counterclockwise.
  const turn = kind === 'climb' ? -1 : 1;
  const shrink = fly.firstChild.firstChild.animate([
    { transform: 'scale(1.7) rotate(0)', opacity: 1 },
    { transform: `scale(.35) rotate(${220 * turn}deg)`, opacity: 1, offset: .85 },
    { transform: `scale(.1) rotate(${280 * turn}deg)`, opacity: 0 }], { ...opts, easing: 'ease-in' });
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
  clearTimeout(celebrate.t);
  // Taken off once the bounce and marks are done: left on, it would bounce again when a pet or dizzy (later in the CSS) ends.
  celebrate.t = setTimeout(() => pal.classList.remove('happy'), 1100);
}

// ---------- Touching the pal (the user's partner asked) ----------
// Tap = boop: a squish and a bubble that depends on today (hungry: a Sweetberry and ?, partway: "More berries please!",
// goal met: hearts pop out, stuffed: "So full…", with a turkey on Thanksgiving Day). Press and hold = pet: the pal rocks
// and hearts float up until you let go. Five taps in 2 seconds = dizzy: a hop and a spin, then a wobble with stars and
// swirls circling its head. Taps wait while a berry is flying in or the pal is bouncing or dizzy.
let palBusy = 0, taps = [], holdTimer, petTimer;
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const SWIRL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a1.5 1.5 0 1 1 2 1.6 3.5 3.5 0 1 1-4.6-4.3A5.5 5.5 0 1 1 6.5 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

function palTouch(pal) {
  pal.addEventListener('contextmenu', e => e.preventDefault());   // a long press would open the phone's image menu
  pal.addEventListener('animationend', e => { if (e.animationName === 'squish') pal.classList.remove('booped'); });
  pal.addEventListener('pointerdown', e => {
    if (!e.target.closest('.pal-body') || e.button > 0) return;
    try { pal.setPointerCapture(e.pointerId); } catch { /* no live pointer: fine, pointerup still comes here */ }
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { holdTimer = null; startPet(); }, 400);
  });
  const up = e => {
    if (petTimer) return stopPet();
    if (!holdTimer) return;
    clearTimeout(holdTimer); holdTimer = null;
    if (e.type === 'pointerup') palTap();
  };
  pal.addEventListener('pointerup', up);
  pal.addEventListener('pointercancel', up);
  pal.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) palTap();
  });
}

function palTap() {
  const now = Date.now();
  if (now < palBusy) return;
  taps = taps.filter(t => now - t < 2000);
  taps.push(now);
  if (taps.length >= 5) { taps = []; dizzy(); } else boop();
}

// Restarts a one-shot animation class, so a quick second tap plays it again.
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// Where the pal's own box sits inside #pal (the photo may be narrower or shorter than the square).
function bodyBox() {
  const pal = $('#pal'), P = pal.getBoundingClientRect(), B = $('.pal-body', pal).getBoundingClientRect();
  return { x: B.left - P.left, y: B.top - P.top, w: B.width, h: B.height };
}

function boop() {
  const pal = $('#pal');
  replay(pal, 'booped');
  const t = byDay(feeds).get(today()), n = berriesOn(t), goal = settings.daily_goal;
  if (n === goal) return heartBurst();
  bubble(!n ? `${berrySvg('daily', 'tiny')}<b>?</b>`
    : n < goal ? 'More berries please!'
    : `So full…${fallNow().tday ? ' 🦃' : cnyNow().feast ? ' 🥟' : halloweenNow().hday ? ' 🍬' : ''}`);
  if (n > goal && !reducedMotion()) for (let i = 0; i < 4; i++) sparkle(i * 120);
}

// A speech bubble over the pal's head for about 2 seconds; a new one replaces it.
function bubble(html) {
  const pal = $('#pal');
  $('.bubble', pal)?.remove();
  const b = document.createElement('span'), box = bodyBox();
  b.className = 'bubble';
  b.setAttribute('aria-hidden', 'true');
  b.innerHTML = html;
  b.style.cssText = `left:${box.x + box.w * .5}px; top:${Math.max(-30, box.y - 6)}px`;
  b.onanimationend = () => b.remove();
  setTimeout(() => b.remove(), 2600);
  pal.append(b);
}

// One heart. from = where it starts inside #pal, dx/dy = how far it travels, kind = burst (goal met) or rise (petting).
function heart(x, y, dx, dy, kind, delay = 0) {
  const h = document.createElement('span');
  h.className = 'heart ' + kind + (Math.random() < .25 ? ' soft' : '');
  h.innerHTML = HEART;
  h.style.cssText = `left:${x}px; top:${y}px; --dx:${dx}px; --dy:${dy}px; --sz:${16 + Math.random() * 10}px; animation-delay:${delay}ms`;
  h.onanimationend = () => h.remove();
  setTimeout(() => h.remove(), 2200 + delay);
  $('#pal').append(h);
}

// Goal met: a fan of hearts pops out of the pal's head.
function heartBurst() {
  $('.bubble', $('#pal'))?.remove();
  const box = bodyBox(), x = box.x + box.w / 2, y = box.y + box.h * .2;
  for (let i = 0; i < 6; i++) {
    const a = (-160 + i * 28 + Math.random() * 12) * Math.PI / 180, r = 60 + Math.random() * 30;
    heart(x, y, Math.cos(a) * r, Math.sin(a) * r - 10, 'burst', i * 40);
  }
}

function startPet() {
  const pal = $('#pal');
  if (!pal || Date.now() < palBusy) return;
  taps = [];
  pal.classList.add('petting');
  const one = () => {
    if (!$('#pal')) return stopPet();
    const box = bodyBox();
    heart(box.x + box.w * (.3 + Math.random() * .4), box.y + box.h * .15, (Math.random() - .5) * 50, -70 - Math.random() * 30, 'rise');
  };
  one();
  petTimer = setInterval(one, 450);
}
function stopPet() {
  clearTimeout(holdTimer); holdTimer = null;
  clearInterval(petTimer); petTimer = null;
  $('#pal')?.classList.remove('petting');
}

// Dizzy: the stars circle where the head is: the hat's spot if one is placed, else near the top of the photo.
function dizzy() {
  const pal = $('#pal'), box = bodyBox();
  palBusy = Date.now() + 3300;
  $('.bubble', pal)?.remove();
  pal.classList.remove('booped');
  replay(pal, 'dizzy');
  const hy = settings.hat?.y ?? ($('.pal-pic', pal) ? .12 : FOX_HAT.y);
  const ring = document.createElement('span');
  ring.className = 'dizzy-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = `left:${box.x + box.w / 2}px; top:${box.y + box.h * hy - 8}px; --rx:${box.w * .32}px; --ry:${box.w * .09}px`;
  ring.innerHTML = [0, 1, 2, 3, 4].map(i => `<span class="orbit" style="--ph:${i / 5}"><span class="orb ${i % 2 ? 'swirl' : 'star'}">${i % 2 ? SWIRL : ''}</span></span>`).join('');
  pal.append(ring);
  setTimeout(() => { pal.classList.remove('dizzy'); ring.remove(); }, 3300);
}

// ---------- Sparkles and sparks ----------
// One timer for both, every half second, only while the Home page is up and the app is on screen.
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
