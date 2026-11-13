// ---------- Data every page uses ----------

let settings = null;               // {name, daily_goal, photo_at}
let photo = { at: null, url: null };   // the downloaded photo, kept as a local address until photo_at changes

async function loadSettings() {
  const cols = '*';   // every column, so a page that's newer than the database (a column not added yet) still loads
  settings = await sb.from('pt_settings').select(cols).maybeSingle().then(must)
    ?? await sb.from('pt_settings').insert({}).select(cols).single().then(must);
  return settings;
}

// The photo, or null for none (the page draws its own pal). The bucket is private, so it's downloaded, not linked.
async function photoUrl() {
  if (!settings.photo_at) return null;
  if (photo.at === settings.photo_at) return photo.url;
  const { data, error } = await sb.storage.from('pt-photo').download('pal');
  if (error) { logError('error', 'photo download: ' + (error.message || error)); return null; }
  if (photo.url) URL.revokeObjectURL(photo.url);
  photo = { at: settings.photo_at, url: URL.createObjectURL(data) };
  return photo.url;
}

// Every berry, oldest first. Supabase sends at most 1000 rows a call, so it asks again until a short page.
async function loadFeeds() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = await sb.from('pt_feeds').select('id, kind, fed_at').order('fed_at').range(from, from + 999).then(must);
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

// ---------- Days and streaks (all in this phone's time zone) ----------

const dayOf = ts => iso(new Date(ts));
const addDays = (day, n) => { const d = new Date(day + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());

// day → {daily, climb, rows}
function byDay(feeds) {
  const m = new Map();
  for (const f of feeds) {
    const d = dayOf(f.fed_at);
    if (!m.has(d)) m.set(d, { daily: 0, climb: 0, rows: [] });
    const e = m.get(d);
    e[f.kind]++;
    e.rows.push(f);
  }
  return m;
}
const dailyOn = (days, d) => days.get(d)?.daily || 0;

// Days in a row with at least one daily berry. Today without one yet doesn't break it: the day isn't over.
function streakOf(days) {
  let d = dailyOn(days, today()) ? today() : addDays(today(), -1), n = 0;
  while (dailyOn(days, d)) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak(days) {
  let best = 0;
  for (const d of days.keys()) {
    if (!dailyOn(days, d) || dailyOn(days, addDays(d, -1))) continue;   // only count from the first day of each run
    let n = 0, x = d;
    while (dailyOn(days, x)) { n++; x = addDays(x, 1); }
    best = Math.max(best, n);
  }
  return best;
}

// The flame (the user asked): 0 = grey ember, 1 = yellow core lit, 2 = all lit, then bigger each step up to 7 = full size.
// Each finished day since the first berry: goal met → up a step; some berries (daily, or only climb) → holds;
// none → down a step, never below 0. Today counts only once its goal is met: an unfinished day can't drop it.
// full = days in a row it ended at full size; a week of that (7) sets off the sparks.
const FLAME_TOP = 7;
function flameOf(days, goal) {
  let level = 0, full = 0;
  const first = [...days.keys()].sort()[0];
  if (!first) return { level, full };
  const step = d => {
    const e = days.get(d), n = e?.daily || 0;
    if (n >= goal) level = Math.min(FLAME_TOP, level + 1);
    else if (!e) level = Math.max(0, level - 1);
    full = level === FLAME_TOP ? full + 1 : 0;
  };
  for (let d = first; d < today(); d = addDays(d, 1)) step(d);
  if (dailyOn(days, today()) >= goal) step(today());
  return { level, full };
}

// ---------- Drawings ----------

// Berries: red for daily PT, gold (with a sparkle) for climb PT.
function berrySvg(kind, cls = '') {
  const [body, shade] = kind === 'climb' ? ['#F2B630', '#C98A12'] : ['#D93A55', '#A9243D'];
  return `<svg class="berry ${cls}" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 14V8" stroke="#3E7A48" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M24 11c2.5-5.5 8-7.5 13-6.5-1.2 5-6.5 8.5-13 6.5z" fill="#4E9A5B"/>
    <circle cx="24" cy="29" r="15" fill="${body}"/>
    <path d="M9.4 32.5a15 15 0 0 0 29.2 0 17 12 0 0 1-29.2 0z" fill="${shade}"/>
    <ellipse cx="18" cy="23" rx="4.2" ry="2.6" transform="rotate(-35 18 23)" fill="#fff" opacity=".6"/>
    ${kind === 'climb' ? '<path d="M33 17l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#FFF6D6"/>' : ''}
  </svg>`;
}

const flameSvg = `<svg class="flame" viewBox="0 0 32 32" aria-hidden="true"><path class="outer" d="M16 4.5c.8 4.6 7.5 7.6 7.5 15.2a7.5 7.5 0 0 1-15 0c0-4 2.2-6.7 4-8.4 0 2.6 1 4.2 2.4 4.9C14.6 12 14.3 8 16 4.5z"/><path class="inner" d="M16 27.2a3.3 3.3 0 0 1-3.3-3.3c0-2.4 2.1-3.8 3.3-5.8 1.2 2 3.3 3.4 3.3 5.8a3.3 3.3 0 0 1-3.3 3.3z"/></svg>`;

// Shown until a photo is uploaded: a sleepy fox kit with a flame tail.
const foxSvg = `<svg class="pal-pic" viewBox="40 60 190 210" aria-hidden="true">
  <path d="M165 225C215 215 225 160 200 120c0 30-15 35-20 20-5 30-20 35-30 60z" fill="#F5B428"/>
  <path d="M163 222c32-12 42-47 29-72-4 20-14 22-20 15-2 20-12 30-20 40z" fill="#E8442C"/>
  <ellipse cx="120" cy="205" rx="58" ry="48" fill="#E8762C"/><ellipse cx="120" cy="218" rx="34" ry="30" fill="#FBE7C6"/>
  <path d="M88 112 80 70l32 28z" fill="#E8762C"/><path d="M152 112l8-42-32 28z" fill="#E8762C"/>
  <path d="M90 104l-4-22 18 16z" fill="#7A3418"/><path d="M150 104l4-22-18 16z" fill="#7A3418"/>
  <circle cx="120" cy="138" r="42" fill="#E8762C"/><ellipse cx="120" cy="152" rx="26" ry="20" fill="#FBE7C6"/>
  <path d="M100 134q6 6 12 0M128 134q6 6 12 0" fill="none" stroke="#3A1E10" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="120" cy="150" rx="5" ry="4" fill="#3A1E10"/>
  <circle cx="96" cy="150" r="6" fill="#F29A86" opacity=".8"/><circle cx="144" cy="150" r="6" fill="#F29A86" opacity=".8"/>
</svg>`;

const palPic = url => url ? `<img class="pal-pic" src="${url}" alt="">` : foxSvg;
