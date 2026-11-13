// ---------- The cozy room behind the Feed page (the user asked) ----------
// A wall and a wooden floor, a couch cut off at the left, a plant on the right, a picture on the wall, and a rug under
// the pal. The fireplace on the back wall is the flame meter (the user's idea): its fire, glow, and sparks follow
// flameOf's 7 steps (styles.css, .fire.lvl-N). Every color is a token, so dark mode turns it into the room at night.

// The floor starts where the fireplace stands, wherever the layout puts it: placeRoom measures it into --floor-y.
const roomSvg = `<div class="room" aria-hidden="true">
  <svg class="wall-pic" viewBox="0 0 46 58"><rect width="46" height="58" rx="4" fill="var(--frame)"/><rect x="6" y="6" width="34" height="46" rx="2" fill="var(--pic)"/>
    <path d="M6 44l10-12 8 8 6-6 10 10v8H6z" fill="var(--pic-2)"/><circle cx="31" cy="17" r="4" fill="var(--pic-sun)"/></svg>
  <svg class="couch" viewBox="0 0 130 100"><rect x="18" y="92" width="7" height="8" rx="2" fill="var(--mantel)"/><rect x="104" y="92" width="7" height="8" rx="2" fill="var(--mantel)"/>
    <rect width="106" height="74" rx="18" fill="var(--couch)"/><rect x="34" y="12" width="42" height="38" rx="12" fill="var(--pillow)"/>
    <rect y="46" width="120" height="48" rx="14" fill="var(--couch-2)"/><rect x="100" y="32" width="28" height="62" rx="12" fill="var(--couch)"/></svg>
  <svg class="plant" viewBox="0 0 44 80"><ellipse cx="12" cy="26" rx="8" ry="20" transform="rotate(-25 12 26)" fill="var(--plant)"/>
    <ellipse cx="32" cy="24" rx="8" ry="22" transform="rotate(20 32 24)" fill="var(--plant)"/><ellipse cx="22" cy="20" rx="7" ry="24" fill="var(--plant-2)"/>
    <path d="M7 44h30l-4 34H11z" fill="var(--pot)"/></svg>
</div>`;

// The fireplace. Flames are drawn at full size and scaled per step in CSS; the side flames join at steps 6 and 7.
const flamePair = (x, cls) => `<g class="${cls}"><path class="fo" d="M${x} 152c-14 0-19-12-12-26 3 7 7 8 8 3 1-9 5-14 10-21 4 12 14 19 10 33-3 8-8 11-16 11z"/>
  <path class="fi" d="M${x + 1} 151c-7 0-10-6-6-13 2 3 4 3 4 1 1-4 3-7 5-10 3 7 7 10 4 16-1 4-3 6-7 6z"/></g>`;
const fireplaceSvg = `<div class="fire" id="fire" role="img">
  <span class="glow-wall"></span><span class="glow-floor"></span>
  <svg viewBox="0 0 150 170" aria-hidden="true">
    <rect x="15" y="12" width="120" height="158" rx="5" fill="var(--stone)"/>
    <rect x="5" y="4" width="140" height="12" rx="4" fill="var(--mantel)"/>
    <path d="M38 170V82a37 37 0 0 1 74 0V170Z" fill="var(--hole)"/>
    <g class="ash"><ellipse cx="75" cy="160" rx="22" ry="6" fill="#6B5E62"/><ellipse cx="72" cy="156" rx="12" ry="4.5" fill="#7D7074"/>
      <circle class="coal" cx="67" cy="158" r="2.2"/><circle class="coal c2" cx="83" cy="159" r="1.8"/></g>
    <rect x="47" y="156" width="56" height="9" rx="4.5" fill="#6B4128"/>
    <rect x="54" y="150" width="42" height="8" rx="4" fill="#7A4A2C" transform="rotate(-8 75 154)"/>
    ${flamePair(61, 'fl f-side l')}${flamePair(89, 'fl f-side r')}${flamePair(75, 'fl f-main')}
  </svg>
  <span class="embers" id="embers"></span>
</div>`;

// Keeps --floor-y on the feed at the fireplace's foot as the page lays out, fonts load, or the phone turns.
let roomWatch;
function placeRoom() {
  const feedEl = $('.feed'), fire = $('#fire');
  roomWatch?.disconnect();
  if (!feedEl || !fire) return;
  const place = () => feedEl.style.setProperty('--floor-y', `${fire.getBoundingClientRect().bottom - feedEl.getBoundingClientRect().top}px`);
  roomWatch = new ResizeObserver(place);
  roomWatch.observe(feedEl);
  roomWatch.observe($('.status'));
  place();
}

// The fire's step, with a whoosh (a flash of glow) when it goes up while you watch.
let shownLevel = null;
function setFire(level, egg) {
  const fire = $('#fire');
  if (!fire) return;
  const up = shownLevel !== null && level > shownLevel;
  fire.className = `fire lvl-${level} ${egg ? 'egg' : ''}`;
  fire.setAttribute('aria-label', level ? `Fire: step ${level} of ${FLAME_TOP}` : `Fire: cold, step 0 of ${FLAME_TOP}`);
  if (up && !reducedMotion()) { void fire.offsetWidth; fire.classList.add('whoosh'); }
  shownLevel = level;
}
