// ---------- The cozy room behind the Feed page (the user asked) ----------
// A wall and a wooden floor, a couch running off the left edge with a throw blanket on its arm, a side table with a
// steaming mug, a plant and a picture on the right, a window showing the real sky on the left, and a rug under the pal. The fireplace
// on the back wall is the flame meter (the user's idea): its fire, glow, and sparks follow flameOf's 7 steps
// (styles.css, .fire.lvl-N). Every color is a token, so dark mode turns it into the room at night.

// The floor starts where the fireplace stands, wherever the layout puts it: placeRoom measures it into --floor-y.
// The couch is drawn far past its left edge, so it runs off the screen instead of ending in a rounded corner (the user asked).
const roomSvg = `<div class="room" aria-hidden="true"><span class="glow-wall"></span><span class="glow-floor"></span>
  <svg class="wall-pic" viewBox="0 0 46 58"><rect width="46" height="58" rx="4" fill="var(--frame)"/><rect x="6" y="6" width="34" height="46" rx="2" fill="var(--pic)"/>
    <path d="M6 44l10-12 8 8 6-6 10 10v8H6z" fill="var(--pic-2)"/><circle cx="31" cy="17" r="4" fill="var(--pic-sun)"/></svg>
  <div class="win-wrap"><div class="window" id="window"><span class="stars"></span><span class="sun"></span>
    <span class="moon"><i id="moonShade"></i></span><span class="cloud"></span><span class="snow">${'<i></i>'.repeat(9)}</span><span class="leaves">${'<i></i>'.repeat(6)}</span><span class="fireworks"><i></i><i></i><i></i></span><span class="bats">${batSvg.repeat(3)}</span></div><span class="sill"></span>
    <svg class="win-wreath" viewBox="6 12 34 36" aria-hidden="true">${wreathSvg}${fuSvg}</svg></div>
  <svg class="couch" viewBox="0 0 130 100"><rect x="104" y="92" width="7" height="8" rx="2" fill="var(--mantel)"/>
    <rect x="-200" width="306" height="74" rx="18" fill="var(--couch)"/>
    <!-- The plaid throw drapes over the top of the backrest and hangs down behind the pillow (the user moved it off the arm) -->
    <g class="blanket"><rect x="40" y="-4" width="60" height="40" rx="7" fill="var(--blanket)"/>
      <rect x="40" y="6" width="60" height="4" fill="var(--blanket-2)"/><rect x="40" y="22" width="60" height="4" fill="var(--blanket-2)"/>
      <rect x="54" y="-4" width="4" height="40" fill="var(--blanket-3)"/><rect x="80" y="-4" width="4" height="40" fill="var(--blanket-3)"/>
      <path d="M44 36v4M50 36v4M56 36v4M62 36v4M68 36v4M74 36v4M80 36v4M86 36v4M92 36v4M97 36v4" stroke="var(--blanket)" stroke-width="1.6" stroke-linecap="round"/></g>
    <rect x="34" y="14" width="42" height="38" rx="12" fill="var(--pillow)"/>
    <rect x="-200" y="46" width="320" height="48" rx="14" fill="var(--couch-2)"/><rect x="100" y="32" width="28" height="62" rx="12" fill="var(--couch)"/></svg>
  <svg class="side-table" viewBox="0 0 50 74">
    <ellipse cx="25" cy="67" rx="13" ry="3.5" fill="var(--table)"/><rect x="22" y="32" width="6" height="35" fill="var(--table-2)"/>
    <rect x="2" y="30" width="46" height="4" rx="2" fill="var(--table-2)"/><ellipse cx="25" cy="30" rx="23" ry="5.5" fill="var(--table)"/>
    <path d="M31 18.5h2.5a3.2 3.2 0 0 1 0 6.4H31" fill="none" stroke="var(--mug)" stroke-width="2"/>
    ${caneSvg}${cinnamonSvg}<rect x="18" y="15" width="13" height="14" rx="2.5" fill="var(--mug)"/><ellipse cx="24.5" cy="15.6" rx="5.3" ry="1.3" fill="#6B3A22"/>${cocoaSvg}${ghostSvg}${ciderSvg}${teaSvg}${pieSvg}${dumplingsSvg}${candyBowlSvg}
    <g class="steam"><path d="M21 12c-3-3 3-6 0-9s3-6 0-9"/><path d="M24.5 11c-3-3 3-6 0-9s3-6 0-9"/><path d="M28 12c-3-3 3-6 0-9s3-6 0-9"/></g></svg>
  <svg class="plant" viewBox="0 0 44 80"><ellipse cx="12" cy="26" rx="8" ry="20" transform="rotate(-25 12 26)" fill="var(--plant)"/>
    <ellipse cx="32" cy="24" rx="8" ry="22" transform="rotate(20 32 24)" fill="var(--plant)"/><ellipse cx="22" cy="20" rx="7" ry="24" fill="var(--plant-2)"/>
    <path d="M7 44h30l-4 34H11z" fill="var(--pot)"/></svg>
  ${xmasTreeSvg}${harvestTableSvg}${cnyCornerSvg}${hwTableSvg}
</div>`;

// ---------- The window: the real sky outside (the user asked) ----------
// Sunrise and sunset from the saved location (Settings), worked out once a day with the usual solar formulas (the
// ones sunrise tables use). Dawn and dusk are the half hour either side. No location (or polar day/night): 7am and 7pm.
// The moon is drawn in tonight's real phase. Snow falls outside in winter (Dec–Feb, or Jun–Aug south of the equator).
const RAD = Math.PI / 180;
function sunTimes(date, lat, lon) {
  const J1970 = 2440588, J2000 = 2451545, e = RAD * 23.4397;
  const d = date / 864e5 - .5 + J1970 - J2000, lw = RAD * -lon, phi = RAD * lat;
  const n = Math.round(d - .0009 - lw / (2 * Math.PI));
  const ds = .0009 + lw / (2 * Math.PI) + n;
  const M = RAD * (357.5291 + .98560028 * ds);
  const L = M + RAD * (1.9148 * Math.sin(M) + .02 * Math.sin(2 * M) + .0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const noon = J2000 + ds + .0053 * Math.sin(M) - .0069 * Math.sin(2 * L);
  const w = Math.acos((Math.sin(RAD * -.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  if (Number.isNaN(w)) return null;   // the sun doesn't rise or doesn't set today
  const set = J2000 + .0009 + (w + lw) / (2 * Math.PI) + n + .0053 * Math.sin(M) - .0069 * Math.sin(2 * L);
  const toDate = j => new Date((j + .5 - J1970) * 864e5);
  return { rise: toDate(noon - (set - noon)), set: toDate(set) };
}
// 0 = new moon, .5 = full. From a known new moon (6 Jan 2000) and the average month between new moons.
const moonPhase = now => (((now - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1 + 1) % 1;

let sunDay = null, sun = null;
function setSky() {
  const win = $('#window');
  if (!win) return;
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), dt = now.getDate();
  if (sunDay !== today()) {
    sunDay = today();
    sun = settings.lat != null ? sunTimes(new Date(y, mo, dt, 12), +settings.lat, +settings.lon) : null;
  }
  const rise = sun?.rise ?? new Date(y, mo, dt, 7), set = sun?.set ?? new Date(y, mo, dt, 19), half = 30 * 60e3;
  const phase = Math.abs(now - rise) <= half ? 'dawn' : Math.abs(now - set) <= half ? 'dusk' : now > rise && now < set ? 'day' : 'night';
  const snowy = settings.lat < 0 ? [5, 6, 7].includes(mo) : [11, 0, 1].includes(mo);
  // Brown leaves blow past from November 1 through Thanksgiving (the user asked).
  // Fireworks after dark on Chinese New Year's Eve, New Year's Day, and the Lantern Festival (the user asked for the holiday).
  const boom = cnyNow().boom && (phase === 'night' || phase === 'dusk');
  // In October bats flap past an orange moon after dark (the user asked).
  win.className = `window sky-${phase} ${snowy ? 'snowy' : ''} ${fallNow().on ? 'leafy' : ''} ${boom ? 'boom' : ''} ${halloweenNow().on ? 'batty' : ''}`;
  // The moon's shadow: a sky-colored disc sliding across it. Waxing, the lit side grows from the right; waning, it shrinks to the left.
  const k = moonPhase(now);
  $('#moonShade').style.transform = `translateX(${(k < .5 ? -k : 1 - k) * 200}%)`;
}

// The fireplace. Flames are drawn at full size and scaled per step in CSS; the side flames join at steps 6 and 7.
const flamePair = (x, cls) => `<g class="${cls}"><path class="fo" d="M${x} 152c-14 0-19-12-12-26 3 7 7 8 8 3 1-9 5-14 10-21 4 12 14 19 10 33-3 8-8 11-16 11z"/>
  <path class="fi" d="M${x + 1} 151c-7 0-10-6-6-13 2 3 4 3 4 1 1-4 3-7 5-10 3 7 7 10 4 16-1 4-3 6-7 6z"/></g>`;
const fireplaceSvg = `<div class="fire" id="fire" role="img">
  <svg viewBox="0 0 150 170" aria-hidden="true">
    <rect x="15" y="12" width="120" height="158" rx="5" fill="var(--stone)"/>
    <path d="M38 170V82a37 37 0 0 1 74 0V170Z" fill="var(--hole)"/>
    <rect x="5" y="4" width="140" height="12" rx="4" fill="var(--mantel)"/>${garlandSvg}${lanternsSvg}${hwLightsSvg}${spiderSvg}
    <rect x="47" y="156" width="56" height="9" rx="4.5" fill="#6B4128"/>
    <rect x="54" y="150" width="42" height="8" rx="4" fill="#7A4A2C" transform="rotate(-8 75 154)"/>
    ${flamePair(52, 'fl f-side l')}${flamePair(98, 'fl f-side r')}${flamePair(75, 'fl f-main')}
  </svg>
  <span class="embers" id="embers"></span>
</div>`;

// Keeps --floor-y on the feed at the fireplace's foot as the page lays out, fonts load, or the phone turns.
let roomWatch;
function placeRoom() {
  const feedEl = $('.feed'), fire = $('#fire');
  roomWatch?.disconnect();
  if (!feedEl || !fire) return;
  // 7px up: the baseboard runs behind the fireplace's foot, so it stands on the floor instead of floating above the trim.
  // --fire-x / --fire-gy: where the firelight on the wall centers (the glow lives in the room, behind the furniture).
  const place = () => {
    const F = fire.getBoundingClientRect(), top = feedEl.getBoundingClientRect();
    feedEl.style.setProperty('--floor-y', `${F.bottom - top.top - 7}px`);
    feedEl.style.setProperty('--fire-x', `${F.left - top.left + F.width / 2}px`);
    feedEl.style.setProperty('--fire-gy', `${F.top - top.top + F.height * .6}px`);
  };
  roomWatch = new ResizeObserver(place);
  roomWatch.observe(feedEl);
  roomWatch.observe($('.status'));
  place();
}

// The fire's step, with a whoosh (a flash of glow) when it goes up while you watch. Going down (an Undo) eases
// without the bounce: a bouncy shrink overshoots past zero and the flame flipped upside down for a moment.
let shownLevel = null;
function setFire(level, egg) {
  const fire = $('#fire');
  if (!fire) return;
  const up = shownLevel !== null && level > shownLevel, down = shownLevel !== null && level < shownLevel;
  fire.className = `fire lvl-${level} ${egg ? 'egg' : ''} ${down ? 'down' : ''}`;
  fire.setAttribute('aria-label', level ? `Fire: step ${level} of ${FLAME_TOP}` : `Fire: cold, step 0 of ${FLAME_TOP}`);
  // The room's firelight (glow on the wall and floor, the pal's rim light) follows the step too.
  const feedEl = $('.feed');
  feedEl.dataset.lvl = level;
  feedEl.classList.toggle('egg', egg);
  feedEl.classList.remove('whoosh');
  if (up && !reducedMotion()) { void feedEl.offsetWidth; feedEl.classList.add('whoosh'); }
  $('#rimFlood')?.setAttribute('flood-opacity', (.95 * level / FLAME_TOP).toFixed(2));
  shownLevel = level;
}
