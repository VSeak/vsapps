// ---------- Hang Timer: sets of hangs and rests, counted down full screen ----------
// Opened from a student's exercise card (exCardHTML) whose Reps/Time holds a time (a rest time alone is not a hang), or by a
// coach from an open exercise or Coach View (openExTimer), and filled in from the exercise. Staff Home's tile opens it empty.
// Anyone can keep timers to load again (saved_timers, the list under Start). The screen changes color with the phase (Get Ready, Hang, Rest, Done) and the
// ring fills once per hang and once per rest. Repeaters (several hangs a set, "6 × 7 sec") get a short rest between
// the hangs of a set (gap) and the long rest between sets.
const TM_READY = 5;     // seconds counted down before the first hang
const TM_MAX = 3600;    // the longest hang or rest, in seconds
const TM_SETS = 99;
const TM_C = 2 * Math.PI * 90;   // the ring's length (r = 90 in its viewBox)
const TM_GAP = 3;       // a repeater's rest between hangs when the exercise doesn't say: 7 on, 3 off is the usual
const TM_TITLE = 'Hang Timer';   // its heading when no exercise opened it (the staff Home tile)
const TM_NAME_MAX = 40;  // a saved timer's name (saved_timers.name)
// How many timers a person can keep (the user asked). The saved_timers_limit trigger holds the same numbers.
const tmSavesMax = () => me?.isCoach || me?.isAdmin ? 10 : 5;
const TM_LABEL = { ready: 'Get Ready', hang: 'Hang', gap: 'Rest', rest: 'Rest', done: 'Nice Work!' };
const TM_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="14" r="7"/><path d="M12 14v-3.5M9.5 3h5M12 3v4"/></svg>`;

// The times in an exercise's text, in order, as seconds: "53 sec", "10s", "3 min", "1 min 30 sec", "1.5 min", "1:30".
// A plain "5" is reps, not a time. Smaller units right after a time are part of it; anything else starts the next
// one ("7 sec on, 3 sec off" is 7 then 3).
function tmTimes(s) {
  s = String(s ?? '');
  const clock = /(\d+):([0-5]\d)(?!\d)/.exec(s), cap = t => Math.min(TM_MAX, Math.round(t));
  if (clock) return [cap(+clock[1] * 60 + +clock[2])].filter(Boolean);
  const size = { h: 3600, m: 60, s: 1 }, out = [];
  let t = 0, end = -1, unit = Infinity;
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi)) {
    const u = size[m[2][0].toLowerCase()];
    if (end >= 0 && (u >= unit || /\S/.test(s.slice(end, m.index)))) { out.push(t); t = 0; }
    t += parseFloat(m[1].replace(',', '.')) * u;
    end = m.index + m[0].length; unit = u;
  }
  if (end >= 0) out.push(t);
  return out.map(cap).filter(Boolean);
}
// The first one (the hang in Reps/Time, the rest in Rest), or null.
const tmSecs = s => tmTimes(s)[0] ?? null;
// Repeaters: "6 × 7 sec" (or "6x7s", "7 sec x 6") is 6 hangs a set. 1 when it doesn't say.
function tmReps(s) {
  s = String(s ?? '');
  const m = /(\d+)\s*[x×*]\s*\d/i.exec(s) ?? /[a-z]\s*[x×*]\s*(\d+)\s*$/i.exec(s);
  return m ? Math.min(TM_SETS, +m[1]) || 1 : 1;
}
// A repeater's rest between hangs: the second time in Reps/Time ("7 sec on, 3 sec off"), else what the notes say
// after "rest" when it is short ("rest 3 seconds"; a longer one is the rest between sets), else TM_GAP.
function tmGap(x) {
  const noted = tmSecs(/\brest(?:ing)?\b([^.;\n]*)/i.exec(x.notes ?? '')?.[1]);
  return tmTimes(x.reps)[1] ?? (noted && noted <= 30 ? noted : TM_GAP);
}

// The Timer button on an exercise card: only when Reps/Time is a time to hang for. A rest time alone (campus rungs,
// boulders) gets none (the user asked).
const timerBtnHTML = x => tmSecs(x.reps) ? `<div class="timer-row"><button type="button" data-timer="${esc(x.name || 'Exercise')}"
  data-sets="${esc(x.sets)}" data-reps="${esc(x.reps)}" data-rest="${esc(x.rest)}" data-gap="${tmReps(x.reps) > 1 ? tmGap(x) : ''}">${TM_ICON}Timer</button></div>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest('[data-timer]');
  if (b) { e.preventDefault(); openTimer(b.dataset.timer, b.dataset); }
});

// A coach's way in: the open exercise's Timer button (always there, so they can time anything) and Coach View's. The
// values are read on the click, since the coach may have just changed them. A coaching session's description is plan_notes.
const tmOpenHTML = attrs => `<button type="button" class="small tm-open" ${attrs}>${TM_ICON}Timer</button>`;
function openExTimer(x) {
  openTimer(x.name.trim() || 'Exercise', { sets: x.sets, reps: x.reps, rest: x.rest,
    gap: tmReps(x.reps) > 1 ? tmGap({ reps: x.reps, notes: x.plan_notes ?? x.notes }) : '' });
}

const tmDlg = Object.assign(document.createElement('dialog'), { id: 'hangTimer', className: 'timer' });
tmDlg.setAttribute('aria-labelledby', 'tmTitle');
document.body.append(tmDlg);
// { name, sets, reps (hangs a set), hang, gap (the rest between a set's hangs), rest (between sets; seconds, as the
//   fields say), phase ('setup', 'ready', 'hang', 'gap', 'rest', 'done'), set, rep, len (the phase's seconds), endsAt,
//   left (ms left, while paused), shown (the second on screen), raf, savedId (the saved timer on the first screen),
//   editing (the saved timer being edited), before (the first screen's numbers to go back to after editing) }
let tm = null;
let tmSaved = null, tmSavedErr = '';   // this person's saved timers, A to Z; null until loaded or if they couldn't be
const tmRunning = () => !!tm && ['ready', 'hang', 'gap', 'rest'].includes(tm.phase);

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

// x: the exercise's sets, reps and rest as the coach typed them, and gap (timerBtnHTML).
function openTimer(name, x) {
  const sets = /\d+/.exec(x.sets ?? '');
  tm = { name, sets: sets ? Math.min(TM_SETS, +sets[0]) || null : null, reps: tmReps(x.reps), hang: tmSecs(x.reps),
    gap: +x.gap || null, rest: tmSecs(x.rest) };
  tmSaved = null; tmSavedErr = '';
  tmSetup();
  if (!tmDlg.open) tmDlg.showModal();
  tmLoadSaved();
}
// Close leaves the timer; once it is counting, Back goes to the first screen instead (the user asked).
const tmTopHTML = back => `<div class="tm-top"><button type="button" ${back ? 'data-stop>‹ Back' : 'data-close>‹ Close'}</button>
  <button type="button" class="tm-sound" data-sound aria-pressed="${tmSound()}" aria-label="Sound">${tmSoundIcon()}</button></div>`;
// A speaker with sound waves when on, crossed out when off.
const tmSoundIcon = () => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H2v6h4l5 4z"/>${tmSound() ? '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>' : '<path d="m22 9-6 6M16 9l6 6"/>'}</svg>`;
const tmStepHTML = (k, label, v, many) => `<div class="log-step"><div class="log-lab"><b id="tm-${k}">${label}</b></div>
  <div class="log-sp"><button type="button" data-step="-1" data-f="${k}" aria-label="Fewer ${many}">−</button>
    <input data-tm="${k}" aria-labelledby="tm-${k}" inputmode="numeric" maxlength="2" value="${v ?? ''}" placeholder="—" autocomplete="off">
    <button type="button" data-step="1" data-f="${k}" aria-label="More ${many}">+</button></div></div>`;
const tmTimeHTML = (k, label, t) => `<div class="log-step" data-row="${k}"><div class="log-lab"><b>${label}</b></div><div class="tm-time">
  <input data-tm="${k}M" inputmode="numeric" maxlength="2" value="${t >= 60 ? Math.floor(t / 60) : ''}" placeholder="0" aria-label="${label}, minutes" autocomplete="off"><span>min</span>
  <input data-tm="${k}S" inputmode="numeric" maxlength="2" value="${t ? t % 60 : ''}" placeholder="0" aria-label="${label}, seconds" autocomplete="off"><span>sec</span></div></div>`;

// The first screen, grouped like the workout (the user asked): Sets and the rest between them, then what Each Set is,
// then a line saying it all back, Start and Clear. A rest only shows when it can happen: Rest Between Reps for a repeater
// (more than 1 rep a set), Rest Between Sets unless it is 1 set.
function tmSetup() {
  cancelAnimationFrame(tm.raf);
  tmAwake(false);
  tm.phase = 'setup'; tm.left = null;
  tmDlg.dataset.phase = 'setup';
  tmDlg.classList.remove('paused');
  const ed = tm.editing;
  tmDlg.innerHTML = `${tmTopHTML(!!ed)}<form class="tm-setup" novalidate><div class="tm-head">${tmHeadHTML()}</div>
    ${ed ? `<label class="tm-name-field">Name<input data-tm-name required maxlength="${TM_NAME_MAX}" value="${esc(ed.name)}" autocomplete="off"></label>` : ''}
    ${tmStepHTML('sets', 'Sets', tm.sets || 1, 'sets')}${tmTimeHTML('rest', 'Rest Between Sets', tm.rest)}
    <span class="eyebrow tm-group">Each Set</span>
    ${tmStepHTML('reps', 'Reps Per Set', tm.reps || 1, 'reps')}
    ${tmTimeHTML('hang', 'Hang Time', tm.hang)}${tmTimeHTML('gap', 'Rest Between Reps', tm.gap)}
    <p class="tm-sum"></p>
    <p class="tm-err" role="alert"></p>
    ${ed ? `<div class="tm-go"><button type="button" data-stop>Cancel</button><button class="fill">Save Changes</button></div>
      <button type="button" class="ghost danger tm-del" data-tm-del>Delete Timer</button>`
    : '<div class="tm-go"><button type="button" data-clear>Clear</button><button class="fill">Start</button></div><section class="tm-saved"></section>'}</form>`;
  tmRows();
  tmDrawSaved();
}
const tmLoaded = () => tmSaved?.find(s => s.id === tm.savedId) ?? null;
const tmHeading = () => tmLoaded()?.name || tm.name || TM_TITLE;
function tmHeadHTML() {
  if (tm.editing) return '<h2 id="tmTitle">Edit Timer</h2>';
  const from = !tmLoaded() && tm.name;
  return `${tmLoaded() || tm.name ? '<span class="eyebrow">Hang Timer</span>' : ''}<h2 id="tmTitle">${esc(tmHeading())}</h2>
    ${from ? '<p class="hint">Filled in from the exercise where it could be. Change anything you need.</p>' : ''}`;
}
function tmRead() {
  const n = k => { const v = parseInt(tmDlg.querySelector(`[data-tm="${k}"]`).value, 10); return v > 0 ? v : 0; };
  tm.sets = Math.min(TM_SETS, n('sets')) || null;
  tm.reps = Math.min(TM_SETS, n('reps')) || 1;
  tm.hang = Math.min(TM_MAX, n('hangM') * 60 + n('hangS')) || null;
  tm.gap = Math.min(TM_MAX, n('gapM') * 60 + n('gapS')) || null;
  tm.rest = Math.min(TM_MAX, n('restM') * 60 + n('restS')) || null;
}
// What stops it starting, or '' when it is ready.
const tmProblem = (doing = 'start') => !tm.sets || !tm.hang ? `Fill in the sets and the hang time to ${doing}.`
  : tm.reps > 1 && !tm.gap ? 'Add a rest between reps, or make it 1 rep per set.'
  : tm.sets > 1 && !tm.rest ? 'Add a rest between sets, or make it 1 set.' : '';
const tmLong = s => [s >= 60 ? `${Math.floor(s / 60)} min` : '', s % 60 ? `${s % 60} sec` : ''].filter(Boolean).join(' ');
// The workout in words, with how long it takes (not counting Get Ready). Only once it can start.
function tmWords({ sets, reps, hang, gap, rest }) {
  const many = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const total = (reps * hang + (reps - 1) * (gap ?? 0)) * sets + (sets - 1) * (rest ?? 0);
  return { top: reps > 1 ? `${many(sets, 'set')} of ${reps} reps · ${tmLong(hang)} on, ${tmLong(gap)} off` : `${many(sets, 'set')} · ${tmLong(hang)} hang`,
    between: sets > 1 ? `${tmLong(rest)} between sets · ` : '', total: `${tmLong(total)} total` };
}
function tmSummary() {
  if (tmProblem()) return '';
  const w = tmWords(tm);
  return `<b>${w.top}</b>${w.between}${w.total}`;
}
// After any change on the first screen: which rests show, and the summary. Changing a loaded timer's numbers makes it
// no longer that timer (changing the saved one is what Edit is for), so its name comes off the heading.
function tmRows() {
  tmRead();
  tmDlg.querySelector('[data-row="gap"]').hidden = !(tm.reps > 1);
  tmDlg.querySelector('[data-row="rest"]').hidden = tm.sets === 1;
  tmDlg.querySelector('.tm-sum').innerHTML = tmSummary();
  if (!tmProblem()) tmDlg.querySelector('.tm-err').textContent = '';
  if (tm.savedId && !tm.editing && !tmSame(tm, tmLoaded())) {
    tm.savedId = null;
    tmDlg.querySelector('.tm-head').innerHTML = tmHeadHTML();
    tmDrawSaved();
  }
}

// ---------- Saved timers (saved_timers): the list under Start, a person's own, on every device ----------
// The numbers a timer really uses: a rest that can't happen isn't kept.
const tmNums = t => ({ sets: t.sets, reps: t.reps, hang: t.hang, gap: t.reps > 1 ? t.gap : null, rest: t.sets > 1 ? t.rest : null });
const tmSame = (a, b) => !!b && JSON.stringify(tmNums(a)) === JSON.stringify(tmNums(b));
const TM_COLS = 'id,name,sets,reps,hang,gap,rest';
const tmSortSaved = () => tmSaved.sort((a, b) => a.name.localeCompare(b.name));
// Loading can fail at a gym with no signal. The timer itself needs no server, so it just says so and keeps working.
async function tmLoadSaved() {
  try {
    tmSaved = await sb.from('saved_timers').select(TM_COLS).then(must);
    tmSortSaved();
  } catch (e) {
    msgOf(e);
    tmSavedErr = "Couldn't load your saved timers. The timer still works.";
  }
  tmDrawSaved();
}
function tmDrawSaved() {
  const box = tm && !tm.editing && tm.phase === 'setup' ? tmDlg.querySelector('.tm-saved') : null;
  if (!box) return;
  const max = tmSavesMax(), n = tmSaved?.length ?? 0, room = tmSaved && n < max;
  box.innerHTML = `<div class="tm-saved-head"><div><h3>Saved Timers</h3>${tmSaved ? `<span class="hint">${n} of ${max}</span>` : ''}</div>
      ${room ? '<button type="button" class="small" data-tm-save>+ Save This Timer</button>' : ''}</div>
    ${!tmSaved ? `<p class="hint">${tmSavedErr ? esc(tmSavedErr) : 'Loading…'}</p>`
    : !n ? '<p class="hint">None yet. Fill in the numbers above, then save them here to use them again.</p>'
    : `<ul class="tm-list">${tmSaved.map(s => {
      const w = tmWords(s), on = s.id === tm.savedId;
      return `<li class="tm-item${on ? ' on' : ''}"><button type="button" class="tm-load" data-tm-load="${s.id}" aria-pressed="${on}">
          <b>${esc(s.name)}</b><span>${w.top} · ${w.total}</span></button>
        <button type="button" class="small" data-tm-edit="${s.id}" aria-label="Edit ${esc(s.name)}">Edit</button></li>`;
    }).join('')}</ul>`}
    ${tmSaved && !room ? `<p class="hint">You've saved ${max}, the most you can. Delete one to save another.</p>` : ''}`;
}
// Why a name won't do, or ''. skip: the timer being edited, which may keep its own name.
function tmNameProblem(name, skip) {
  const key = String(name ?? '').trim().toLowerCase();
  if (!key) return 'Give it a name.';
  return tmSaved.some(s => s.id !== skip && s.name.trim().toLowerCase() === key) ? 'You already have a timer with that name.' : '';
}
// A flash would sit behind this full-screen dialog, so errors show on its own line.
function tmFail(e) {
  tmDlg.querySelector('.tm-err').textContent = e?.code === '23505' ? 'You already have a timer with that name.' : e?.code === 'P0001' ? e.message : msgOf(e);
}
// Picking one fills in the first screen, with Start right there; nothing starts until it is tapped.
function tmPick(id) {
  Object.assign(tm, tmNums(tmSaved.find(s => s.id === id)), { savedId: id });
  tmSetup();
  tmDlg.scrollTo({ top: 0 });
  tmDlg.querySelector('.tm-go .fill').focus({ preventScroll: true });
}
async function tmSaveNew(btn) {
  tmRead();
  const err = tmProblem('save');
  if (err) { tmDlg.querySelector('.tm-err').textContent = err; return; }
  const w = tmWords(tm);
  const f = await ask({ title: 'Save Timer', ok: 'Save', fill: true,
    body: `<label>Name<input name="name" required maxlength="${TM_NAME_MAX}" value="${esc(tm.name || '')}" placeholder="E.g. Max Hangs" autocomplete="off"></label>
      <p class="hint">${w.top}<br>${w.between}${w.total}</p>`,
    check: d => { const bad = tmNameProblem(d.get('name')); return bad ? ['name', bad] : null; } });
  if (!f || !tm) return;
  btn.disabled = true;
  try {
    const row = await sb.from('saved_timers').insert({ name: f.get('name').trim(), ...tmNums(tm) }).select(TM_COLS).single().then(must);
    tmSaved.push(row); tmSortSaved();
    tm.savedId = row.id;
    tmDlg.querySelector('.tm-head').innerHTML = tmHeadHTML();
    tmDrawSaved();
  } catch (e) { tmFail(e); btn.disabled = false; }
}
// Editing uses the first screen itself, with a Name box and Save Changes, so it looks like what it sets up.
function tmEdit(id) {
  tmRead();
  const s = tmSaved.find(x => x.id === id);
  tm.before = { sets: tm.sets, reps: tm.reps, hang: tm.hang, gap: tm.gap, rest: tm.rest, savedId: tm.savedId };
  Object.assign(tm, tmNums(s), { editing: s });
  tmSetup();
  tmDlg.scrollTo({ top: 0 });
}
// Back to the first screen as it was, or (after Save Changes) with the timer just saved loaded.
function tmEndEdit(row) {
  Object.assign(tm, tm.before, { editing: null, before: null }, row ? { ...tmNums(row), savedId: row.id } : {});
  tmSetup();
}
async function tmSaveEdit() {
  tmRead();
  const input = tmDlg.querySelector('[data-tm-name]'), err = tmProblem('save'), bad = tmNameProblem(input.value, tm.editing.id);
  if (bad) { fieldError(input, bad); input.focus(); return; }
  if (err) { tmDlg.querySelector('.tm-err').textContent = err; return; }
  const btn = tmDlg.querySelector('.tm-go .fill');
  btn.disabled = true;
  try {
    const row = await sb.from('saved_timers').update({ name: input.value.trim(), ...tmNums(tm) }).eq('id', tm.editing.id).select(TM_COLS).single().then(must);
    tmSaved[tmSaved.findIndex(s => s.id === row.id)] = row; tmSortSaved();
    tmEndEdit(row);
  } catch (e) { tmFail(e); btn.disabled = false; }
}
async function tmDelete() {
  const { id, name } = tm.editing;
  if (!await ask({ title: 'Delete Timer?', body: `<p>${esc(name)} will be gone from your saved timers.</p>`, ok: 'Delete Timer', warn: true })) return;
  try {
    await sb.from('saved_timers').delete().eq('id', id).then(must);
    tmSaved = tmSaved.filter(s => s.id !== id);
    if (tm.before.savedId === id) tm.before.savedId = null;
    tmEndEdit();
  } catch (e) { tmFail(e); }
}
tmDlg.addEventListener('input', e => { if (e.target.dataset.tm) tmRows(); });

function tmStart() {
  tmRead();
  const err = tmProblem();
  if (err) { tmDlg.querySelector('.tm-err').textContent = err; return; }
  // Made on this tap: browsers only let sound start from one.
  try { tmAudio ??= new (window.AudioContext || window.webkitAudioContext)(); tmAudio.resume(); } catch {}
  tmAwake(true);
  tmDlg.innerHTML = `${tmTopHTML(true)}<div class="tm-run"><p class="tm-name" id="tmTitle">${esc(tmHeading())}</p>
    <div class="tm-ring"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="tm-track" cx="100" cy="100" r="90"/>
      <circle class="tm-fill" cx="100" cy="100" r="90" stroke-dasharray="${TM_C}" stroke-dashoffset="${TM_C}"/></svg>
      <div class="tm-mid"><span class="tm-phase" role="status"></span><span class="tm-left"></span><span class="tm-set"></span></div></div>
    <div class="tm-btns"><button type="button" data-pause>Pause</button><button type="button" data-stop>Stop</button></div></div>`;
  tm.left = null;
  tmPhase('ready', 0, 0, Date.now());
  tmTick();
  tmDlg.querySelector('[data-pause]').focus();
}

// Starts a phase at the moment the one before it ended (at), so a late frame never adds time. set and rep: the hang
// it is, or the one just done.
function tmPhase(phase, set, rep, at) {
  const len = phase === 'ready' ? TM_READY : tm[phase];
  Object.assign(tm, { phase, set, rep, len, endsAt: at + len * 1000, shown: null });
  tmDlg.dataset.phase = phase;
  tmDlg.querySelector('.tm-phase').textContent = TM_LABEL[phase];
  tmDlg.querySelector('.tm-set').textContent = phase === 'hang' ? `Set ${set} of ${tm.sets}${tm.reps > 1 ? ` · Rep ${rep} of ${tm.reps}` : ''}`
    : phase === 'gap' ? `Next: Rep ${rep + 1} of ${tm.reps}` : `Next: Set ${set + 1} of ${tm.sets}`;
  if (phase !== 'ready') tmBeep(phase === 'hang' ? 880 : 440, .6);
}
// After a hang comes the short rest and the set's next hang; after a set's last hang, the long rest and the next
// set. The last hang of the last set ends the timer.
function tmNext() {
  const { phase, set, rep, endsAt: at } = tm;
  if (phase === 'gap') return tmPhase('hang', set, rep + 1, at);
  if (phase !== 'hang') return tmPhase('hang', set + 1, 1, at);
  if (rep < tm.reps) return tmPhase('gap', set, rep, at);
  if (set >= tm.sets) return tmDone();
  if (tm.rest) return tmPhase('rest', set, rep, at);
  tmPhase('hang', set + 1, 1, at);
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

tmDlg.addEventListener('submit', e => { e.preventDefault(); tm.editing ? tmSaveEdit() : tmStart(); });
tmDlg.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !tm) return;
  const d = b.dataset;
  if ('close' in d) return tmDlg.close();
  if ('sound' in d) {
    try { localStorage.setItem('sitstart.timerSound', tmSound() ? 'off' : 'on'); } catch {}
    b.setAttribute('aria-pressed', tmSound());
    b.innerHTML = tmSoundIcon();
    return;
  }
  if (d.step) {
    const input = tmDlg.querySelector(`[data-tm="${d.f}"]`), v = parseInt(input.value, 10);
    input.value = v > 0 ? Math.min(TM_SETS, Math.max(1, v + +d.step)) : 1;
    return tmRows();
  }
  if ('clear' in d) {
    tmDlg.querySelectorAll('[data-tm]').forEach(i => { i.value = ''; });
    tmDlg.querySelector('.tm-err').textContent = '';
    tmRows();
    return tmDlg.querySelector('[data-tm="sets"]').focus();
  }
  if ('pause' in d) {
    if (tm.left == null) { tm.left = tm.endsAt - Date.now(); cancelAnimationFrame(tm.raf); }
    else { tm.endsAt = Date.now() + tm.left; tm.left = null; tmTick(); }
    tmDlg.classList.toggle('paused', tm.left != null);
    b.textContent = tm.left != null ? 'Resume' : 'Pause';
    return;
  }
  if ('stop' in d) return tm.editing ? tmEndEdit() : tmSetup();
  if ('tmSave' in d) return tmSaveNew(b);
  if (d.tmLoad) return tmPick(d.tmLoad);
  if (d.tmEdit) return tmEdit(d.tmEdit);
  if ('tmDel' in d) return tmDelete();
  // Go Again: the same numbers, straight into the countdown.
  if ('again' in d) { tmSetup(); tmStart(); }
});
// Esc matches the top button: back to the first screen while counting, closed from there.
tmDlg.addEventListener('cancel', e => {
  if (!tm) return;
  if (tm.editing) { e.preventDefault(); tmEndEdit(); }
  else if (tm.phase !== 'setup') { e.preventDefault(); tmSetup(); }
});
// Closing it (Close, or Esc) stops everything.
tmDlg.addEventListener('close', () => {
  cancelAnimationFrame(tm?.raf);
  tmAwake(false);
  tm = null;
  tmDlg.innerHTML = '';
});
