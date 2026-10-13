// ---------- Hang Timer: sets of a hang and a rest, counted down full screen ----------
// Opened from an exercise card (exCardHTML) whose Reps/Time or Rest holds a time, and filled in from the exercise.
// Nothing is saved: it only counts. The screen changes color with the phase (Get Ready, Hang, Rest, Done) and the
// ring fills once per hang and once per rest.
const TM_READY = 5;     // seconds counted down before the first hang
const TM_MAX = 3600;    // the longest hang or rest, in seconds
const TM_SETS = 99;
const TM_C = 2 * Math.PI * 90;   // the ring's length (r = 90 in its viewBox)
const TM_LABEL = { ready: 'Get Ready', hang: 'Hang', rest: 'Rest', done: 'Nice Work!' };
const TM_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="14" r="7"/><path d="M12 14v-3.5M9.5 3h5M12 3v4"/></svg>`;

// A time in an exercise's text, as seconds: "53 sec", "10s", "3 min", "1 min 30 sec", "1.5 min", "1:30". Null when
// there is none (a plain "5" is reps). Only the first time counts ("30 sec on, 15 sec off" is 30), with the smaller
// units right after it added on.
function tmSecs(s) {
  s = String(s ?? '');
  const clock = /(\d+):([0-5]\d)(?!\d)/.exec(s);
  if (clock) return Math.min(TM_MAX, +clock[1] * 60 + +clock[2]) || null;
  const size = { h: 3600, m: 60, s: 1 };
  let t = 0, end = -1, unit = Infinity;
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi)) {
    const u = size[m[2][0].toLowerCase()];
    if (end >= 0 && (u >= unit || /\S/.test(s.slice(end, m.index)))) break;
    t += parseFloat(m[1].replace(',', '.')) * u;
    end = m.index + m[0].length; unit = u;
  }
  return Math.min(TM_MAX, Math.round(t)) || null;
}

// The Timer button on an exercise card: only for an exercise with a time to count.
const timerBtnHTML = x => tmSecs(x.reps) || tmSecs(x.rest) ? `<div class="timer-row"><button type="button" data-timer="${esc(x.name || 'Exercise')}"
  data-sets="${esc(x.sets)}" data-reps="${esc(x.reps)}" data-rest="${esc(x.rest)}">${TM_ICON}Timer</button></div>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest('[data-timer]');
  if (b) openTimer(b.dataset.timer, b.dataset);
});

const tmDlg = Object.assign(document.createElement('dialog'), { id: 'hangTimer', className: 'timer' });
tmDlg.setAttribute('aria-labelledby', 'tmTitle');
document.body.append(tmDlg);
// { name, sets, hang, rest (seconds, as the fields say), phase ('setup', 'ready', 'hang', 'rest', 'done'), set,
//   len (the phase's seconds), endsAt, left (ms left, while paused), shown (the second on screen), raf }
let tm = null;
const tmRunning = () => !!tm && ['ready', 'hang', 'rest'].includes(tm.phase);

// Beeps on the last three seconds and at each change, since nobody watches a screen mid-hang. Sound On / Off is kept
// on this device.
let tmAudio = null;
function tmSound() { try { return localStorage.getItem('sitstart.timerSound') !== 'off'; } catch { return true; } }
function tmBeep(hz, secs) {
  if (!tmAudio || !tmSound()) return;
  try {
    const o = tmAudio.createOscillator(), g = tmAudio.createGain(), t = tmAudio.currentTime;
    o.frequency.value = hz;
    o.connect(g); g.connect(tmAudio.destination);
    g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + secs);
    o.start(t); o.stop(t + secs);
  } catch {}
}
// The screen stays on while it counts (a 3 minute rest would lock the phone). The lock is dropped when the page is
// hidden, so it is asked for again when it comes back.
let tmLock = null;
async function tmAwake(on) {
  try {
    if (!on) { const l = tmLock; tmLock = null; await l?.release(); }
    else if (!tmLock && document.visibilityState === 'visible') {
      tmLock = await navigator.wakeLock?.request('screen') ?? null;
      tmLock?.addEventListener('release', () => { tmLock = null; });
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (tmRunning()) { tmAwake(true); tmTick(); } });

// x: the exercise's sets, reps and rest as the coach typed them.
function openTimer(name, x) {
  const sets = /\d+/.exec(x.sets ?? '');
  tm = { name, sets: sets ? Math.min(TM_SETS, +sets[0]) || null : null, hang: tmSecs(x.reps), rest: tmSecs(x.rest) };
  tmSetup();
  if (!tmDlg.open) tmDlg.showModal();
}
const tmTopHTML = () => `<div class="tm-top"><button type="button" data-close>‹ Close</button>
  <button type="button" data-sound aria-pressed="${tmSound()}">Sound ${tmSound() ? 'On' : 'Off'}</button></div>`;
const tmTimeHTML = (k, label, t) => `<div class="log-step"><div class="log-lab"><b>${label}</b></div><div class="tm-time">
  <input data-tm="${k}M" inputmode="numeric" maxlength="2" value="${t >= 60 ? Math.floor(t / 60) : ''}" placeholder="0" aria-label="${label}, minutes" autocomplete="off"><span>min</span>
  <input data-tm="${k}S" inputmode="numeric" maxlength="2" value="${t ? t % 60 : ''}" placeholder="0" aria-label="${label}, seconds" autocomplete="off"><span>sec</span></div></div>`;

// The first screen: Sets, Hang Time and Rest Time, then Start and Clear.
function tmSetup() {
  cancelAnimationFrame(tm.raf);
  tmAwake(false);
  tm.phase = 'setup'; tm.left = null;
  tmDlg.dataset.phase = 'setup';
  tmDlg.classList.remove('paused');
  tmDlg.innerHTML = `${tmTopHTML()}<form class="tm-setup" novalidate><span class="eyebrow">Hang Timer</span>
    <h2 id="tmTitle">${esc(tm.name)}</h2>
    <p class="hint">Filled in from your plan where it could be. Change anything you need.</p>
    <div class="log-step"><div class="log-lab"><b id="tm-sets">Sets</b></div>
      <div class="log-sp"><button type="button" data-step="-1" aria-label="Fewer sets">−</button>
        <input data-tm="sets" aria-labelledby="tm-sets" inputmode="numeric" maxlength="2" value="${tm.sets ?? ''}" placeholder="—" autocomplete="off">
        <button type="button" data-step="1" aria-label="More sets">+</button></div></div>
    ${tmTimeHTML('hang', 'Hang Time', tm.hang)}${tmTimeHTML('rest', 'Rest Time', tm.rest)}
    <p class="tm-err" role="alert"></p>
    <div class="tm-go"><button type="button" data-clear>Clear</button><button class="fill">Start</button></div></form>`;
}
function tmRead() {
  const n = k => { const v = parseInt(tmDlg.querySelector(`[data-tm="${k}"]`).value, 10); return v > 0 ? v : 0; };
  tm.sets = Math.min(TM_SETS, n('sets')) || null;
  tm.hang = Math.min(TM_MAX, n('hangM') * 60 + n('hangS')) || null;
  tm.rest = Math.min(TM_MAX, n('restM') * 60 + n('restS')) || null;
}

function tmStart() {
  tmRead();
  const err = !tm.sets || !tm.hang ? 'Fill in the sets and the hang time to start.'
    : tm.sets > 1 && !tm.rest ? 'Add a rest time, or make it 1 set.' : '';
  if (err) { tmDlg.querySelector('.tm-err').textContent = err; return; }
  // Made on this tap: browsers only let sound start from one.
  try { tmAudio ??= new (window.AudioContext || window.webkitAudioContext)(); tmAudio.resume(); } catch {}
  tmAwake(true);
  tmDlg.innerHTML = `${tmTopHTML()}<div class="tm-run"><p class="tm-name" id="tmTitle">${esc(tm.name)}</p>
    <div class="tm-ring"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="tm-track" cx="100" cy="100" r="90"/>
      <circle class="tm-fill" cx="100" cy="100" r="90" stroke-dasharray="${TM_C}" stroke-dashoffset="${TM_C}"/></svg>
      <div class="tm-mid"><span class="tm-phase" role="status"></span><span class="tm-left"></span><span class="tm-set"></span></div></div>
    <div class="tm-btns"><button type="button" data-pause>Pause</button><button type="button" data-stop>Stop</button></div></div>`;
  tm.left = null;
  tmPhase('ready', 0, Date.now());
  tmTick();
  tmDlg.querySelector('[data-pause]').focus();
}

// Starts a phase at the moment the one before it ended (at), so a late frame never adds time.
function tmPhase(phase, set, at) {
  const len = phase === 'ready' ? TM_READY : tm[phase];
  Object.assign(tm, { phase, set, len, endsAt: at + len * 1000, shown: null });
  tmDlg.dataset.phase = phase;
  tmDlg.querySelector('.tm-phase').textContent = TM_LABEL[phase];
  tmDlg.querySelector('.tm-set').textContent = phase === 'hang' ? `Set ${set} of ${tm.sets}` : `Next: Set ${set + 1} of ${tm.sets}`;
  if (phase !== 'ready') tmBeep(phase === 'hang' ? 880 : 440, .6);
}
// After a hang comes its rest, except the last one, which ends the timer.
function tmNext() {
  if (tm.phase === 'hang' && tm.set >= tm.sets) return tmDone();
  if (tm.phase === 'hang' && tm.rest) return tmPhase('rest', tm.set, tm.endsAt);
  tmPhase('hang', tm.set + 1, tm.endsAt);
}
function tmDone() {
  tm.phase = 'done';
  tmDlg.dataset.phase = 'done';
  tmAwake(false);
  tmRing(1);
  tmDlg.querySelector('.tm-phase').textContent = TM_LABEL.done;
  tmDlg.querySelector('.tm-left').textContent = 'Done';
  tmDlg.querySelector('.tm-set').textContent = `${tm.sets} set${tm.sets === 1 ? '' : 's'} finished`;
  tmDlg.querySelector('.tm-btns').innerHTML = '<button type="button" data-again>Go Again</button><button type="button" data-close>Close</button>';
  tmBeep(660, .2); setTimeout(() => tmBeep(990, .7), 220);
}

const tmRing = p => tmDlg.querySelector('.tm-fill').setAttribute('stroke-dashoffset', TM_C * (1 - Math.min(1, Math.max(0, p))));
const tmClock = s => s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
// Every frame: the ring by the clock (not by counting frames, so a page left in the background catches up), and the
// number when its second changes.
function tmTick() {
  cancelAnimationFrame(tm?.raf);
  if (!tmRunning() || tm.left != null) return;
  const now = Date.now();
  while (tmRunning() && now >= tm.endsAt) tmNext();
  if (!tmRunning()) return;
  const left = tm.endsAt - now, secs = Math.ceil(left / 1000);
  tmRing(1 - left / (tm.len * 1000));
  if (secs !== tm.shown) {
    tm.shown = secs;
    tmDlg.querySelector('.tm-left').textContent = tmClock(secs);
    if (secs <= 3 && secs < tm.len) tmBeep(660, .12);
  }
  tm.raf = requestAnimationFrame(tmTick);
}

tmDlg.addEventListener('submit', e => { e.preventDefault(); tmStart(); });
tmDlg.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !tm) return;
  const d = b.dataset;
  if ('close' in d) return tmDlg.close();
  if ('sound' in d) {
    try { localStorage.setItem('sitstart.timerSound', tmSound() ? 'off' : 'on'); } catch {}
    b.setAttribute('aria-pressed', tmSound());
    b.textContent = `Sound ${tmSound() ? 'On' : 'Off'}`;
    return;
  }
  if (d.step) {
    const input = tmDlg.querySelector('[data-tm="sets"]'), v = parseInt(input.value, 10);
    input.value = v > 0 ? Math.min(TM_SETS, Math.max(1, v + +d.step)) : 1;
    return;
  }
  if ('clear' in d) {
    tmDlg.querySelectorAll('[data-tm]').forEach(i => { i.value = ''; });
    tmDlg.querySelector('.tm-err').textContent = '';
    return tmDlg.querySelector('[data-tm="sets"]').focus();
  }
  if ('pause' in d) {
    if (tm.left == null) { tm.left = tm.endsAt - Date.now(); cancelAnimationFrame(tm.raf); }
    else { tm.endsAt = Date.now() + tm.left; tm.left = null; tmTick(); }
    tmDlg.classList.toggle('paused', tm.left != null);
    b.textContent = tm.left != null ? 'Resume' : 'Pause';
    return;
  }
  if ('stop' in d) return tmSetup();
  // Go Again: the same numbers, straight into the countdown.
  if ('again' in d) { tmSetup(); tmStart(); }
});
// Closing it (Close, or Esc) stops everything.
tmDlg.addEventListener('close', () => {
  cancelAnimationFrame(tm?.raf);
  tmAwake(false);
  tm = null;
  tmDlg.innerHTML = '';
});
