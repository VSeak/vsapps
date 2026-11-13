// ---------- The cozy room behind the Feed page (the user asked) ----------
// A wall and a wooden floor, a couch running off the left edge with a throw blanket on its arm, a side table with a
// steaming mug, a plant and a picture on the right, a window showing the real sky on the left, and a rug under the pal. The fireplace
// on the back wall is the flame meter (the user's idea): its fire, glow, and sparks follow flameOf's 7 steps
// (styles.css, .fire.lvl-N). Every color is a token, so dark mode turns it into the room at night.

// The floor starts where the fireplace stands, wherever the layout puts it: placeRoom measures it into --floor-y.
// The couch is drawn far past its left edge, so it runs off the screen instead of ending in a rounded corner (the user asked).
const roomSvg = `<div class="room" aria-hidden="true"><svg class="floor" id="floor"></svg><span class="glow-wall"></span><span class="glow-floor"></span>
  <svg class="wall-pic" viewBox="0 0 46 58"><path d="M13 .5L23-7l10 7.5" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".6"/><circle cx="23" cy="-7" r="1" fill="#000" opacity=".35"/>
    <rect width="46" height="58" rx="4" fill="var(--frame)"/>
    <!-- Texture (the user found it flat): a bevelled frame with grain, a shadow inside its top and left, brushy sky, hill, and sun strokes -->
    <rect x="1" y="1" width="44" height="56" rx="3.4" fill="none" stroke="#fff" stroke-opacity=".16"/><rect x="4.5" y="4.5" width="37" height="49" rx="2.4" fill="none" stroke="#000" stroke-opacity=".22"/>
    <path d="M2.6 12v34M43.4 10v30M10 2.6h22M14 55.4h24" stroke="#000" stroke-opacity=".12" stroke-width=".5"/>
    <rect x="6" y="6" width="34" height="46" rx="2" fill="var(--pic)"/>
    <path d="M9 12c6-1.4 10 1 15-.4M10 24c5-1 9 .8 13-.2M27 28c3-.8 6 .4 9-.2" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M6 44l10-12 8 8 6-6 10 10v8H6z" fill="var(--pic-2)"/>
    <path d="M16 32l3 12M24 40l-2 7M30 34l2 9M10 47c6-1 12 0 18-1" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".9" stroke-linecap="round"/>
    <path d="M16 32l-6 7M30 34l-3 3" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".9" stroke-linecap="round"/>
    <circle cx="31" cy="17" r="4" fill="var(--pic-sun)"/><path d="M29.3 15.6a2.4 2.4 0 0 1 2.6-1.2" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8" stroke-linecap="round"/>
    <path d="M6 6h34v2.2H8.2V52H6z" fill="#000" opacity=".16"/></svg>
  <div class="win-wrap"><div class="window" id="window"><span class="stars"></span><span class="sun"></span>
    <span class="moon"><i id="moonShade"></i></span><span class="cloud"></span><span class="snow">${'<i></i>'.repeat(9)}</span><span class="leaves">${'<i></i>'.repeat(6)}</span><span class="fireworks"><i></i><i></i><i></i></span><span class="bats">${batSvg.repeat(3)}</span><span class="glare"></span></div><span class="sill"></span>
    <svg class="win-wreath" viewBox="6 12 34 36" aria-hidden="true">${wreathSvg}${fuSvg}</svg></div>
  <svg class="couch" viewBox="0 0 130 100">
    <!-- Detail (the user found it flat): a fine diagonal weave over the fabric, piping highlights, tufted buttons,
         seat-cushion seams, a shadow along the bottom, and a second leg. Black/white at low opacity, so it works in both themes. -->
    <defs><pattern id="couchWeave" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <path d="M0 .5h3" stroke="#000" stroke-opacity=".07" stroke-width=".8"/></pattern></defs>
    <rect x="-200" y="95.5" width="332" height="6" rx="3" fill="#000" opacity=".16"/><rect x="-200" y="97" width="330" height="3" rx="1.5" fill="#000" opacity=".12"/>
    <rect x="104" y="92" width="7" height="8" rx="2" fill="var(--mantel)"/><rect x="38" y="92" width="7" height="8" rx="2" fill="var(--mantel)"/>
    <path d="M106 92v8M40 92v8" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/>
    <rect x="-200" width="306" height="74" rx="18" fill="var(--couch)"/><rect x="-200" width="306" height="74" rx="18" fill="url(#couchWeave)"/>
    <rect x="-200" y="2.2" width="294" height="2.4" rx="1.2" fill="#fff" opacity=".14"/>
    <path d="M24 8v38" stroke="#000" stroke-opacity=".14" stroke-width="1"/>
    <g fill="#000" opacity=".2"><circle cx="10" cy="18" r="1.4"/><circle cx="10" cy="36" r="1.4"/><circle cx="90" cy="18" r="1.4"/></g>
    <path d="M7 15.5l3 2.5 3-2.5M7 33.5l3 2.5 3-2.5M87 15.5l3 2.5 3-2.5" fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".7"/>
    <!-- The plaid throw drapes over the top of the backrest and hangs down behind the pillow (the user moved it off the arm) -->
    <g class="blanket"><rect x="40" y="-4" width="60" height="40" rx="7" fill="var(--blanket)"/>
      <rect x="40" y="6" width="60" height="4" fill="var(--blanket-2)"/><rect x="40" y="22" width="60" height="4" fill="var(--blanket-2)"/>
      <rect x="54" y="-4" width="4" height="40" fill="var(--blanket-3)"/><rect x="80" y="-4" width="4" height="40" fill="var(--blanket-3)"/>
      <path d="M40 15.5h60M40 28.8h60" stroke="var(--blanket-2)" stroke-width=".7" opacity=".8"/><path d="M67-4v40M91-4v40" stroke="var(--blanket-3)"/>
      <path d="M54 6h4v4h-4zM80 6h4v4h-4zM54 22h4v4h-4zM80 22h4v4h-4z" fill="#000" opacity=".14"/>
      <rect x="40" y="-4" width="60" height="40" rx="7" fill="url(#couchWeave)"/>
      <path d="M44-3.4h52a5 5 0 0 1 3.6 2.4H40.4A5 5 0 0 1 44-3.4z" fill="#fff" opacity=".18"/>
      <path d="M41 2.2c10 1 20-.6 29 .4s20 1 29-.2" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/>
      <path d="M50 5c-1.5 10-1 20 .5 30M74 5c1 10 .5 21-1 30M88 5c-1 10 0 20 1.5 30" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M52.4 5c-1.5 10-1 20 .5 30M76.2 5c1 10 .5 21-1 30" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M96 0h1.6a2.4 2.4 0 0 1 2.4 2.4V31a5 5 0 0 1-4 4.9z" fill="#000" opacity=".12"/>
      <path d="M44 36v4M50 36v4M56 36v4M62 36v4M68 36v4M74 36v4M80 36v4M86 36v4M92 36v4M97 36v4" stroke="var(--blanket)" stroke-width="1.6" stroke-linecap="round"/></g>
    <rect x="34" y="14" width="42" height="38" rx="12" fill="var(--pillow)"/>
    <rect x="36.5" y="16.5" width="37" height="33" rx="10" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".9"/>
    <path d="M37 22c8 4 14 6 18 11M73 22c-8 4-14 6-18 11" fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".8"/>
    <circle cx="55" cy="33" r="1.7" fill="#000" opacity=".2"/>
    <rect x="-200" y="46" width="320" height="48" rx="14" fill="var(--couch-2)"/><rect x="-200" y="46" width="320" height="48" rx="14" fill="url(#couchWeave)"/>
    <rect x="-200" y="47.5" width="314" height="3" rx="1.5" fill="#fff" opacity=".12"/>
    <path d="M-200 60H104" stroke="#000" stroke-opacity=".13" stroke-width="1"/>
    <path d="M30 49v10M-40 49v10" stroke="#000" stroke-opacity=".18" stroke-width="1"/>
    <path d="M-200 88H106" stroke="#000" stroke-opacity=".14" stroke-width="5"/>
    <rect x="100" y="32" width="28" height="62" rx="12" fill="var(--couch)"/><rect x="100" y="32" width="28" height="62" rx="12" fill="url(#couchWeave)"/>
    <rect x="103" y="34" width="22" height="4" rx="2" fill="#fff" opacity=".16"/>
    <rect x="103.5" y="38" width="21" height="52" rx="9" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".9"/>
    <path d="M104 87.5h20" stroke="#000" stroke-opacity=".12" stroke-width="4" stroke-linecap="round"/></svg>
  <svg class="side-table" viewBox="0 0 50 74">
    <!-- Texture (the user found it flat): a turned leg with a ring and shading, grain rings and a lit rim on the top, a
         shadow on the floor; the mug gets a glaze highlight, shading, a berry-red band, and a lip -->
    <ellipse cx="25" cy="71" rx="17" ry="2.6" fill="#000" opacity=".14"/>
    <ellipse cx="25" cy="67" rx="13" ry="3.5" fill="var(--table)"/><path d="M13 67.6a12 3 0 0 0 24 0" fill="none" stroke="#000" stroke-opacity=".18"/>
    <rect x="22" y="32" width="6" height="35" fill="var(--table-2)"/><rect x="26" y="32" width="2" height="35" fill="#000" opacity=".16"/>
    <rect x="22.8" y="34" width="1" height="31" fill="#fff" opacity=".12"/>
    <rect x="20.5" y="47" width="9" height="3.2" rx="1.6" fill="var(--table-2)"/><rect x="20.5" y="47" width="9" height="1.2" rx=".6" fill="#fff" opacity=".16"/>
    <rect x="2" y="30" width="46" height="4" rx="2" fill="var(--table-2)"/><path d="M4 33.2h42" stroke="#000" stroke-opacity=".2"/>
    <ellipse cx="25" cy="30" rx="23" ry="5.5" fill="var(--table)"/>
    <g fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".5"><ellipse cx="27" cy="30.4" rx="15" ry="3.3"/><ellipse cx="27" cy="30.6" rx="8" ry="1.7"/></g>
    <path d="M4 28.6c6-3.2 14-4 21-4s15 .8 21 4" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".8"/>
    <ellipse cx="25" cy="29.4" rx="8" ry="1.4" fill="#000" opacity=".14"/>
    <path d="M31 18.5h2.5a3.2 3.2 0 0 1 0 6.4H31" fill="none" stroke="var(--mug)" stroke-width="2"/>
    ${caneSvg}${cinnamonSvg}<rect x="18" y="15" width="13" height="14" rx="2.5" fill="var(--mug)"/>
    <rect x="18" y="21" width="13" height="2.2" fill="#C7334F" opacity=".8"/><path d="M28 16.5v11" stroke="#000" stroke-opacity=".1" stroke-width="3"/>
    <path d="M20 17.5v9" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="24.5" cy="15.6" rx="5.3" ry="1.3" fill="#6B3A22"/><path d="M19.2 15.9a5.3 1.3 0 0 0 10.6 0" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".4"/>${cocoaSvg}${ghostSvg}${ciderSvg}${teaSvg}${pieSvg}${dumplingsSvg}
    <g class="steam"><path d="M21 12c-3-3 3-6 0-9s3-6 0-9"/><path d="M24.5 11c-3-3 3-6 0-9s3-6 0-9"/><path d="M28 12c-3-3 3-6 0-9s3-6 0-9"/></g></svg>
  <svg class="plant" viewBox="0 0 44 80"><ellipse cx="12" cy="26" rx="8" ry="20" transform="rotate(-25 12 26)" fill="var(--plant)"/>
    <ellipse cx="32" cy="24" rx="8" ry="22" transform="rotate(20 32 24)" fill="var(--plant)"/><ellipse cx="22" cy="20" rx="7" ry="24" fill="var(--plant-2)"/>
    <ellipse cx="22" cy="78.6" rx="15" ry="2.2" fill="#000" opacity=".18"/><path d="M7 44h30l-4 34H11z" fill="var(--pot)"/>
    <path d="M28 46h7l-3.6 32h-5z" fill="#000" opacity=".12"/><path d="M7 44h30" stroke="#fff" stroke-opacity=".2" stroke-width="1.4"/></svg>
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
// Texture (the user asked): each flame shades from base to tip (gradients in the fireplace's <defs>; it's drawn once,
// so ids are safe), with faint darker veins in the outer flame and a white-hot core at the base of the inner one.
const flamePair = (x, cls) => `<g class="${cls}"><path class="fo" d="M${x} 152c-14 0-19-12-12-26 3 7 7 8 8 3 1-9 5-14 10-21 4 12 14 19 10 33-3 8-8 11-16 11z"/>
  <path class="fvein" d="M${x - 6} 148c-4-6-3-12 0-17M${x + 7} 146c2-7 0-13-3-19" fill="none" stroke-width=".9" stroke-linecap="round"/>
  <path class="fi" d="M${x + 1} 151c-7 0-10-6-6-13 2 3 4 3 4 1 1-4 3-7 5-10 3 7 7 10 4 16-1 4-3 6-7 6z"/>
  <path class="fcore" d="M${x + 1} 150.5c-3 0-4.4-2.6-2.6-5.6 1-1.6 1.8-3 2.6-5 .9 2 1.8 3.4 2.6 5 1.8 3-.4 5.6-2.6 5.6z"/></g>`;
// Detail (the user found the fireplace, mantel, and couch flat): stone blocks in staggered courses over mortar (--mortar,
// lighter than the stone: darkened stone matched the night wall, the user saw it),
// each a slightly different shade (fixed seed, so it's the same every load); an arch of wedge stones with a keystone
// around the opening; firebrick on the back wall inside; a hearth slab at the foot; and the mantel gets a lit top edge,
// wood grain, a knot, and a molding strip under the shelf. Shading is black/white at low opacity, so it works in both themes.
const stoneSvg = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let blocks = '', tints = '';
  for (let y = 19, row = 0; y < 170; y += 15, row++) {
    for (let x = row % 2 ? 4 : 15; x < 135;) {
      const w = 17 + rnd() * 13, a = Math.max(x, 15), b = Math.min(x + w, 135);
      if (b - a > 4) {
        const r = `x="${(a + .7).toFixed(1)}" y="${y + .7}" width="${(b - a - 1.4).toFixed(1)}" height="13.6" rx="2.5"`;
        blocks += `<rect ${r}/>`;
        tints += `<rect ${r} fill="${rnd() < .5 ? '#000' : '#fff'}" opacity="${(.02 + rnd() * .08).toFixed(2)}"/>`;
      }
      x += w;
    }
  }
  // The arch: wedge seams every 18° around the opening (center 75 82, radius 37 → 44), and the straight sides' joints.
  let seams = '';
  for (let d = 18; d < 180; d += 18) {
    if (d === 90) continue;   // the keystone sits there
    const c = Math.cos(d * RAD), s = Math.sin(d * RAD);
    seams += `M${(75 + 37 * c).toFixed(1)} ${(82 - 37 * s).toFixed(1)}L${(75 + 44 * c).toFixed(1)} ${(82 - 44 * s).toFixed(1)}`;
  }
  for (const y of [100, 118, 136, 154]) seams += `M31 ${y}h7M112 ${y}h7`;
  return `<rect x="15" y="12" width="120" height="158" rx="5" fill="var(--mortar)"/>
    <g fill="var(--stone)">${blocks}</g>${tints}
    <path d="M31 170V82a44 44 0 0 1 88 0V170Z" fill="var(--stone)" stroke="var(--mortar)" stroke-width="1.2"/>
    <path d="M31 170V82a44 44 0 0 1 88 0V170Z" fill="#fff" opacity=".07"/>
    <path d="${seams}" stroke="var(--mortar)" stroke-width="1.2"/>
    <path d="M70.6 46.3h8.8l1.3-11h-11.4z" fill="var(--stone)" stroke="var(--mortar)" stroke-width="1.2"/><path d="M70.6 46.3h8.8l1.3-11h-11.4z" fill="#fff" opacity=".14"/>`;
})();
const holeDetailSvg = (() => {
  let brick = '';
  for (let y = 88, row = 0; y < 160; y += 8, row++) {
    brick += `M30 ${y}h90`;
    for (let x = row % 2 ? 44 : 52; x < 112; x += 16) brick += `M${x} ${y}v8`;
  }
  return `<clipPath id="fpHole"><path d="M38 170V82a37 37 0 0 1 74 0V170Z"/></clipPath>
    <g clip-path="url(#fpHole)"><path d="${brick}" stroke="#fff" stroke-opacity=".07" stroke-width=".8"/>
      <path d="M38 170V82a37 37 0 0 1 74 0V170Z" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="10"/></g>`;
})();
const mantelSvg = `<rect x="11" y="15" width="128" height="4.5" rx="1.2" fill="var(--mantel)"/><rect x="11" y="17.5" width="128" height="2" rx="1" fill="#000" opacity=".2"/>
    <rect x="15" y="19.5" width="120" height="1.6" fill="#000" opacity=".16"/>
    <rect x="5" y="4" width="140" height="12" rx="4" fill="var(--mantel)"/>
    <rect x="7" y="4.6" width="136" height="2.2" rx="1.1" fill="#fff" opacity=".16"/>
    <rect x="9" y="13" width="132" height="2.6" rx="1.3" fill="#000" opacity=".18"/>
    <path d="M12 9.2c16-1.2 30 .8 48-.2s34-1 50 .4 22-.4 28-.6M18 11.8c22 .8 40-.8 62 .2s32-.6 52 .2M30 7.4c14-.5 22 .3 36-.2" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".55"/>
    <ellipse cx="104" cy="9.8" rx="2.4" ry="1" fill="none" stroke="#000" stroke-opacity=".2" stroke-width=".55"/>`;
const fireplaceSvg = `<div class="fire" id="fire" role="img">
  <svg viewBox="0 0 150 170" aria-hidden="true">
    <defs><linearGradient id="flOut" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF8A30"/><stop offset=".55" stop-color="#E8442C"/><stop offset="1" stop-color="#B8232A"/></linearGradient>
      <linearGradient id="flIn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE98F"/><stop offset="1" stop-color="#F5A623"/></linearGradient>
      <linearGradient id="flSideOut" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F28A2E"/><stop offset="1" stop-color="#B8401A"/></linearGradient>
      <linearGradient id="flSideIn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFD27A"/><stop offset="1" stop-color="#EB7F20"/></linearGradient></defs>
    ${stoneSvg}
    <path d="M38 170V82a37 37 0 0 1 74 0V170Z" fill="var(--hole)"/>${holeDetailSvg}
    <!-- The hearth sticks out onto the floor (the user found the room's perspective off): its top widens toward you
         like the floorboards, with slab joints running the same way, a front edge, and a shadow on the floor. The floor
         starts at y 170, so this reaches past the drawing's bottom (.fire svg is overflow: visible). -->
    <ellipse cx="75" cy="182.2" rx="72" ry="2.6" fill="#000" opacity=".2"/>
    <path d="M9 166h132l5 11H4z" fill="var(--stone)"/><path d="M9 166h132l5 11H4z" fill="#fff" opacity=".12"/>
    <path d="M42 166l-2.4 11M75 166v11M108 166l2.4 11" stroke="var(--mortar)" stroke-width="1.1"/>
    <path d="M9 166h132" stroke="#000" stroke-opacity=".25"/>
    <rect x="4" y="177" width="142" height="4.6" rx="1" fill="var(--stone)"/><rect x="4" y="177" width="142" height="4.6" rx="1" fill="#000" opacity=".16"/>
    <path d="M4.5 177.2h141" stroke="#fff" stroke-opacity=".2"/>
    ${mantelSvg}${garlandSvg}${lanternsSvg}${hwLightsSvg}${spiderSvg}
    <!-- The logs (texture, the user asked): bark lines, a lit top, a shaded bottom, and cut ends with growth rings -->
    <rect x="47" y="156" width="56" height="9" rx="4.5" fill="#6B4128"/>
    <path d="M52 158.4h18M76 157.8h20M56 161.2h12M73 162h22M51 163.2h9" stroke="#3A2214" stroke-opacity=".55" stroke-width=".7" stroke-linecap="round"/>
    <path d="M51 156.9h45" stroke="#fff" stroke-opacity=".16" stroke-linecap="round"/>
    <ellipse cx="99" cy="160.5" rx="3.6" ry="4.3" fill="#C49A6C"/><ellipse cx="99" cy="160.5" rx="2.2" ry="2.7" fill="none" stroke="#8A5A3C" stroke-width=".5"/>
    <circle cx="99" cy="160.5" r=".7" fill="#8A5A3C"/>
    <path class="log-glow" d="M60 156.7h30M68 160.6l3-1 2.4 1.2 3.2-.9 2.2 1" fill="none" stroke="#FFB347" stroke-width="1.1" stroke-linecap="round"/>
    <g transform="rotate(-8 75 154)"><rect x="54" y="150" width="42" height="8" rx="4" fill="#7A4A2C"/>
      <path d="M58 152.3h14M76 152h16M62 155.4h20" stroke="#3A2214" stroke-opacity=".5" stroke-width=".7" stroke-linecap="round"/>
      <path d="M58 150.9h34" stroke="#fff" stroke-opacity=".16" stroke-linecap="round"/>
      <ellipse cx="57.5" cy="154" rx="3.3" ry="3.9" fill="#C9A275"/><ellipse cx="57.5" cy="154" rx="1.9" ry="2.3" fill="none" stroke="#8A5A3C" stroke-width=".5"/>
      <circle cx="57.5" cy="154" r=".6" fill="#8A5A3C"/>
      <path class="log-glow" d="M64 150.7h24M74 154.2l2.6-.8 2 1 2.8-.8" fill="none" stroke="#FFB347" stroke-width="1.1" stroke-linecap="round"/></g>
    ${flamePair(52, 'fl f-side l')}${flamePair(98, 'fl f-side r')}${flamePair(75, 'fl f-main')}
  </svg>
  <span class="embers" id="embers"></span>
</div>`;

// The floor in perspective (the user found the room's perspective off: even rows of boards read as a brick wall).
// The boards run toward you, their edges meeting at a vanishing point above the fireplace's middle, so they're narrow
// at the wall and wide at the bottom of the screen. End joints come at rows that get taller toward you, staggered
// board to board; each length of board gets its own shade and a line of grain (fixed seed, so it's the same every
// time). The back of the floor is faded toward the floor color and shaded where it meets the wall. Drawn in pixels,
// to fit the floor's real size, each time placeRoom measures (W × H, fx = the fire's middle).
function drawFloor(W, H, fx) {
  const svg = $('#floor');
  if (!svg || W <= 0 || H <= 0) return;
  const d = H * .75, s0 = 26, X = (k, y) => fx + k * s0 * (y + d) / d;   // board edge k at height y
  const N = 9, g = 1.32, rows = Array.from({ length: N + 1 }, (_, j) => H * (g ** j - 1) / (g ** N - 1));
  let seed = 3, tones = '', joints = '', grain = '', edges = '';
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  // The boards narrow toward the wall, so every board on screen shows at the wall's edge: that sets the range.
  const kMin = Math.floor(-fx / s0) - 1, kMax = Math.ceil((W - fx) / s0) + 1;
  for (let k = kMin; k <= kMax; k++) {
    if ((X(k + 1, 0) < 0 && X(k + 1, H) < 0) || (X(k, 0) > W && X(k, H) > W)) continue;
    edges += `M${X(k, 0).toFixed(1)} 0L${X(k, H).toFixed(1)} ${H.toFixed(1)}`;
    const cuts = [0, ...rows.slice(1, -1).filter((_, j) => (j + 1 + ((k % 3) + 3) % 3) % 3 === 0), H];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], t = rnd();
      tones += `<path d="M${X(k, a).toFixed(1)} ${a.toFixed(1)}L${X(k + 1, a).toFixed(1)} ${a.toFixed(1)} ${X(k + 1, b).toFixed(1)} ${b.toFixed(1)} ${X(k, b).toFixed(1)} ${b.toFixed(1)}z" fill="${t < .5 ? '#000' : '#fff'}" opacity="${(.02 + rnd() * .05).toFixed(3)}"/>`;
      if (i > 0) joints += `M${X(k, a).toFixed(1)} ${a.toFixed(1)}L${X(k + 1, a).toFixed(1)} ${a.toFixed(1)}`;
      const gk = k + .25 + rnd() * .5, ga = a + (b - a) * .15, gb = a + (b - a) * (.5 + rnd() * .4);
      grain += `M${X(gk, ga).toFixed(1)} ${ga.toFixed(1)}L${X(gk, gb).toFixed(1)} ${gb.toFixed(1)}`;
    }
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H.toFixed(1)}`);
  svg.innerHTML = `<defs><linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--floor)" stop-opacity=".6"/><stop offset=".5" style="stop-color:var(--floor)" stop-opacity="0"/></linearGradient>
      <linearGradient id="floorWall" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="22"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
    ${tones}<path d="${grain}" stroke="#000" stroke-opacity=".07" stroke-width="1"/>
    <path d="${joints}" stroke="var(--plank)" stroke-width="1.6"/><path d="${edges}" stroke="var(--plank)" stroke-width="1.8"/>
    <rect width="${W}" height="${H.toFixed(1)}" fill="url(#floorFade)"/><rect width="${W}" height="22" fill="url(#floorWall)"/>`;
}

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
    drawFloor(feedEl.clientWidth, feedEl.clientHeight - (F.bottom - top.top), F.left - top.left + F.width / 2);
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
