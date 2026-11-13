// ---------- Christmas in the cozy room (the user asked) ----------
// From the day after Thanksgiving (the fourth Thursday of November) through January 7: a garland with twinkling lights
// and two stockings on the mantel, a wreath on the picture, marshmallows and a candy cane in the cocoa, and the plant
// becomes an advent tree. Each December day from the 1st to the 24th that meets the goal hangs one ornament (24 at
// most; gold with a sparkle on a stuffed day) and puts one present under it. The presents go on December 26; the rest
// comes down on January 8. All worked out from the berries, so nothing is saved for it.
// The Santa hat (settings.hat) shows on the pal in the same weeks; the owner places it on their photo in Settings.

// Thanksgiving: the fourth Thursday of November.
const thanksgiving = y => { const wd = new Date(y, 10, 1).getDay(); return 1 + (4 - wd + 7) % 7 + 21; };
function xmasNow(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const on = (m === 10 && d > thanksgiving(y)) || m === 11 || (m === 0 && d <= 7);
  return { on, treeYear: m === 0 ? y - 1 : y, presents: on && (m === 10 || (m === 11 && d <= 25)) };
}

// ---------- Thanksgiving (the user asked): November 1 through Thanksgiving Day ----------
// Brown leaves blow past the window (setSky), the mug holds cider with a cinnamon stick, the plant is put away for a
// long harvest table with a cornucopia, and the pal wears an autumn beanie. Each November day up to Thanksgiving that
// meets the goal sets one piece of food on the table (gold on a stuffed day). On Thanksgiving Day itself a slice of
// pie sits on the side table and a stuffed pal is "stuffed like a turkey!". Christmas starts the next day.
function fallNow(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), tg = thanksgiving(y);
  return { on: m === 10 && d <= tg, tday: m === 10 && d === tg, year: y };
}
// The days that put food on the table: November 1 to Thanksgiving of that year, goal met, up to today.
function harvestDays(days, goal, year) {
  const out = [];
  for (let i = 1; i <= thanksgiving(year); i++) {
    const d = iso(new Date(year, 10, i));
    if (d > today()) break;
    const e = days.get(d);
    if (berriesOn(e) >= goal) out.push({ day: d, gold: isStuffed(e, goal) });
  }
  return out;
}

// The days that hang an ornament: December 1–24 of that year, goal met, up to today. Today counts once its goal is met.
function ornamentDays(days, goal, year) {
  const out = [];
  for (let i = 1; i <= 24; i++) {
    const d = iso(new Date(year, 11, i));
    if (d > today()) break;
    const e = days.get(d);
    if (berriesOn(e) >= goal) out.push({ day: d, gold: isStuffed(e, goal) });
  }
  return out;
}

// ---------- Drawings ----------

// The advent tree, with room on its left for presents to spill toward the pal. Tree units: 0–80 across, pot foot at 110.
const ORN_SPOTS = [
  [14, 85], [27, 85], [40, 85], [53, 85], [66, 85], [22, 76], [34, 76], [46, 76], [58, 76], [29, 67], [40, 67], [51, 67],
  [21, 57], [33, 57], [47, 57], [59, 57], [28, 48], [40, 47], [52, 48], [34, 40], [46, 40], [29, 33], [51, 33], [40, 23]];
// The order they're hung in: spread over the tree so it fills evenly instead of from the bottom up.
const ORN_ORDER = [10, 2, 17, 6, 13, 23, 0, 15, 8, 20, 4, 11, 18, 1, 14, 21, 7, 3, 16, 9, 22, 5, 19, 12];
// Colors in turn: deep red, cream, plum, and every fourth a Sweetberry. Gold is kept for stuffed days.
const ORN_COLORS = ['#B3263E', '#F6EEDD', '#7A4A8A', 'berry'];
function ornamentSvg(i, gold) {
  const [x, y] = ORN_SPOTS[ORN_ORDER[i]], kind = gold ? 'gold' : ORN_COLORS[i % 4];
  const thread = `<path d="M${x} ${y - 6}v3" stroke="#E0A21B" stroke-width=".5"/>`;
  if (kind === 'berry') return `<g class="orn" data-i="${i}">${thread}<circle cx="${x}" cy="${y}" r="3.1" fill="#D93A55"/><path d="M${x - 3.1} ${y}a3.1 3.1 0 0 0 6.2 0 3.4 1.9 0 0 1-6.2 0z" fill="#000" opacity=".16"/>
    <circle cx="${x + .9}" cy="${y + .4}" r=".35" fill="#FFE7A0" opacity=".8"/><circle cx="${x - .3}" cy="${y + 1.5}" r=".35" fill="#FFE7A0" opacity=".8"/>
    <path d="M${x} ${y - 3}c.6-1.4 2-1.9 3.3-1.6-.3 1.3-1.7 2.2-3.3 1.6z" fill="#4E9A5B"/><circle cx="${x - 1.1}" cy="${y - 1}" r=".8" fill="#fff" opacity=".6"/></g>`;
  const fill = kind === 'gold' ? '#F2B630' : kind;
  return `<g class="orn ${kind === 'gold' ? 'gold' : ''}" data-i="${i}">${thread}<rect x="${x - 1}" y="${y - 4.1}" width="2" height="1.4" rx=".3" fill="#C98A12"/>
    <circle cx="${x}" cy="${y}" r="3.1" fill="${fill}"/>
    ${kind === '#F6EEDD' || kind === '#7A4A8A' ? `<path d="M${x - 3} ${y - .5}h6v1.1h-6z" fill="${kind === '#7A4A8A' ? '#F2C14E' : '#C7334F'}" opacity=".85"/>` : ''}
    <path d="M${x - 3.1} ${y}a3.1 3.1 0 0 0 6.2 0 3.4 1.9 0 0 1-6.2 0z" fill="#000" opacity=".16"/><circle cx="${x - 1.1}" cy="${y - 1.1}" r=".85" fill="#fff" opacity=".7"/>
    ${kind === 'gold' ? `<path class="orn-spark" d="M${x + 4.2} ${y - 5.5}l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#FFE7A0"/>` : ''}</g>`;
}

// Presents in the order they arrive: a heap that grows from under the tree out to the left (toward the pal) and down
// the floor toward you (the user asked for both). Big boxes at the back, then rows of smaller ones in front, staggered
// like bricks so they cover the bottoms of the bigger ones (the user saw loose boxes, then boxes all one size), and
// three small ones stacked on top (the user liked those). The biggest stand behind the tree (back = 1) and peek out
// around it; in front, nothing over the tree reaches above its lowest branches (y 89), so no ornament is covered
// (the user saw the big boxes hide them). [left, width, height, bottom, back] in tree units.
const GIFT_SPOTS = [
  [8, 20, 18, 112], [30, 24, 20, 112], [14, 30, 16, 106, 1], [-13, 22, 18, 112], [55, 20, 19, 112],   // first, under the tree
  [-18, 26, 24, 106, 1], [9, 19, 16, 121], [56, 22, 22, 106, 1], [-34, 22, 20, 112], [28, 18, 13, 121],
  [-8, 17, 14, 121], [-10, 11, 8, 94], [46, 17, 15, 121], [-14, 13, 9, 82, 1], [-26, 18, 15, 121], [63, 15, 14, 121],
  [12, 13, 10, 130], [-30, 14, 10, 92], [26, 15, 12, 130], [-3, 15, 12, 130], [42, 14, 11, 130], [-18, 14, 11, 130],
  [6, 12, 10, 138], [19, 10, 8, 138]];                                                                      // last, smallest, in front
const GIFT_COLORS = [['#C7334F', '#F2C14E'], ['#4E9A5B', '#FFF6EE'], ['#F2EDE4', '#C7334F'], ['#E0A21B', '#7A3A5A'],
  ['#7A4A8A', '#F2C14E'], ['#4A7EC2', '#FFF6EE']];
function giftSvg(i) {
  const [x, w, h, b] = GIFT_SPOTS[i], [box, rib] = GIFT_COLORS[i % GIFT_COLORS.length], y = b - h, cx = x + w / 2;
  const k = w / 16, rw = (1.8 * k).toFixed(2), bw = (2 * k).toFixed(2), bh = (1.2 * k).toFixed(2);   // ribbon and bow grow with the box
  const dots = i % 3 === 1 ? [[.2, .22], [.78, .2], [.24, .78], [.8, .8], [.55, .62]].map(([fx, fy]) =>
    `<circle cx="${(x + w * fx).toFixed(1)}" cy="${(y + h * fy).toFixed(1)}" r="${(.7 * k).toFixed(2)}" fill="#fff" opacity=".4"/>`).join('') : '';
  return `<g class="gift" data-i="${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="${box}"/>${dots}
    <rect x="${cx - rw / 2}" y="${y}" width="${rw}" height="${h}" fill="${rib}"/><rect x="${x}" y="${y + h * .4}" width="${w}" height="${rw}" fill="${rib}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${(h * .16).toFixed(1)}" fill="#fff" opacity=".14"/><path d="M${x} ${(y + h * .16).toFixed(1)}h${w}" stroke="#000" stroke-opacity=".14" stroke-width=".4"/>
    <rect x="${(x + w * .74).toFixed(1)}" y="${y}" width="${(w * .26).toFixed(1)}" height="${h}" fill="#000" opacity=".1"/>
    <ellipse cx="${cx - bw * .9}" cy="${y - bh * .75}" rx="${bw}" ry="${bh}" fill="${rib}"/><ellipse cx="${cx + bw * .9}" cy="${y - bh * .75}" rx="${bw}" ry="${bh}" fill="${rib}"/>
    <ellipse cx="${cx - bw * .9}" cy="${y - bh * .75}" rx="${bw * .5}" ry="${bh * .45}" fill="#000" opacity=".15"/><ellipse cx="${cx + bw * .9}" cy="${y - bh * .75}" rx="${bw * .5}" ry="${bh * .45}" fill="#000" opacity=".15"/>
    <circle cx="${cx}" cy="${y - bh * .5}" r="${(bh * .75).toFixed(2)}" fill="${rib}" stroke="#000" stroke-opacity=".15" stroke-width=".3"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="none" stroke="rgb(0 0 0 / .12)" stroke-width=".5"/></g>`;
}
// Drawn back to front, so a present in front overlaps the one behind it. The ones behind the tree go in their own
// group, drawn before it.
const GIFT_DRAW = GIFT_SPOTS.map((s, i) => i).sort((a, b) => GIFT_SPOTS[a][3] - GIFT_SPOTS[b][3]);

const xmasTreeSvg = `<svg class="xmas-tree xmas-only" viewBox="-70 0 150 150">
  <ellipse cx="40" cy="110.4" rx="21" ry="2.4" fill="#000" opacity=".18"/>
  <g id="giftsBack"></g><rect x="36" y="86" width="8" height="8" fill="#6B4128"/>
  <path d="M40 44 8 88h64z" fill="var(--plant)"/><path d="M40 24 16 60h48z" fill="var(--plant-2)"/><path d="M40 8 24 36h32z" fill="var(--plant)"/>
  <path d="M40 44 8 88h18zM40 24 16 60h14zM40 8 24 36h9z" fill="rgb(0 0 0 / .08)"/>
  ${[[88, 8, 72, 'var(--plant)'], [60, 16, 64, 'var(--plant-2)'], [36, 24, 56, 'var(--plant)']].map(([by, l, r, f]) => {
    const n = Math.round((r - l) / 6), w = (r - l) / n;
    let d = '';
    for (let i = 0; i < n; i++) d += `M${(l + i * w).toFixed(1)} ${by - .2}a${(w / 2).toFixed(2)} 2 0 0 0 ${w.toFixed(2)} 0z`;
    return `<path d="${d}" fill="${f}"/><path d="${d}" fill="#000" opacity=".1"/>`;
  }).join('')}
  <path d="${(() => {
    let d = '';
    for (const [ay, by, hw, y0] of [[44, 88, 32, 63], [24, 60, 24, 39], [8, 36, 16, 15]])
      for (let y = y0, r = 0; y < by - 2; y += 5, r++) {
        const half = hw * (y - ay) / (by - ay) - 2.5;
        for (let x = 40 - half + (r % 2) * 2.5; x < 40 + half; x += 5) d += `M${(x - 1.4).toFixed(1)} ${y - 1.4}l1.4 1.8 1.4-1.8`;
      }
    return d;
  })()}" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".6" stroke-linecap="round"/>
  <path d="M24 92h32l-4 18H28z" fill="var(--pot)"/><path d="M47 95h8.3l-3.3 15h-6z" fill="#000" opacity=".12"/>
  <rect x="22.5" y="90.5" width="35" height="4" rx="1.2" fill="var(--pot)"/><rect x="22.5" y="90.5" width="35" height="1.2" rx=".6" fill="#fff" opacity=".2"/>
  <path class="tree-star" d="M40 .5l2.1 4.4 4.8.6-3.5 3.3.9 4.8-4.3-2.3-4.3 2.3.9-4.8-3.5-3.3 4.8-.6z" fill="#F2C14E"/>
  <path d="M39.4 3l-1 2.4M38 6.4l-2 .3" stroke="#fff" stroke-opacity=".6" stroke-width=".6" stroke-linecap="round"/>
  <g id="ornaments"></g><g id="gifts"></g>
</svg>`;

// The mantel: a garland in swags with small lights, hung over two stockings (toes pointing out). Fireplace units.
const STOCKING = 'M1.5 5h11v15c0 2 1.5 3 3.5 3.5l3 .7c2.5.6 3.3 2.3 2.8 4-.5 1.8-2.3 2.7-4.3 2.3L7 28.5C3.5 27.8 1.5 25.5 1.5 22z';
const stocking = (tf, body, band) => `<g transform="${tf}"><path d="${STOCKING}" fill="${body}"/>
  <path d="M2.5 9h9.5M2.5 11h9.5M2.5 18.5h9.5M2.5 20.5h10.5" stroke="#000" stroke-opacity=".1" stroke-width=".4"/>
  <path d="M17 24l2.1.5c2.5.6 3.3 2.3 2.8 4-.5 1.8-2.3 2.7-4.3 2.3l-1.4-.3c1.2-2 1.4-4.4.8-6.5z" fill="${band}"/>
  <path d="M1.5 21.4c0 2.6 1.4 4.6 4 5.6.4-2.2-.6-4.2-4-5.6z" fill="${band}"/>
  <path d="M1.5 13h11v3h-11z" fill="${band}"/><path d="M11.6 7v12.6" stroke="#000" stroke-opacity=".14" stroke-width="1.8"/>
  <path d="${STOCKING}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".4" stroke-dasharray=".8 .8" transform="translate(.6 0) scale(.94 1)"/>
  <rect width="14" height="6.5" rx="2.5" fill="#FFF6EE"/>
  ${[1.6, 3.8, 6, 8.2, 10.4, 12.6].map(x => `<circle cx="${x}" cy="6.2" r="1.1" fill="#FFF6EE"/>`).join('')}
  <path d="M3 2.4l.8.8M7 1.8l.4 1.1M10.6 3l.9.4M5 4.6l.8-.4" stroke="#D8CBBB" stroke-width=".6" stroke-linecap="round"/></g>`;
const garlandSvg = (() => {
  const ends = [7, 41, 75, 109, 143], lights = [], colors = ['#FF5A6E', '#F4BF45', '#7CC488', '#6FA8FF'];
  let path = `M${ends[0]} 15`;
  for (let s = 0; s < 4; s++) {
    const a = ends[s], b = ends[s + 1];
    path += ` Q${(a + b) / 2} 28 ${b} 15`;
    for (const t of [.2, .5, .8]) lights.push([a + (b - a) * t, 15 + 26 * t * (1 - t)]);
  }
  return `<g class="xmas-only">
    ${stocking('translate(34 16) scale(-1 1)', '#C7334F', '#F6EEDD')}${stocking('translate(116 16)', '#3E8A50', '#C7334F')}
    <path d="${path}" fill="none" stroke="#2F6B3C" stroke-width="5.5" stroke-linecap="round"/>
    <path d="${path}" fill="none" stroke="#4E9A5B" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 2.5"/>
    <path d="${path}" fill="none" stroke="#1F4D2A" stroke-width="4.6" stroke-linecap="round" stroke-dasharray=".6 2.4" opacity=".7"/>
    <path d="${path}" fill="none" stroke="#7CC488" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1 3" stroke-dashoffset="1.5" opacity=".6"/>
    ${[41, 75, 109].map(x => `<path d="M${x} 15.4l-3.2-1.9v3.8zM${x} 15.4l3.2-1.9v3.8z" fill="#C7334F"/><circle cx="${x}" cy="15.4" r="1" fill="#A82A43"/>`).join('')}
    <g class="lights">${lights.map(([x, y], i) => `<g style="--c:${colors[i % 4]}; animation-delay:${(-(i * 7) % 5) * .37}s">
      <circle class="halo" cx="${x.toFixed(1)}" cy="${(y + 1.6).toFixed(1)}" r="3.4"/><circle cx="${x.toFixed(1)}" cy="${(y + 1.6).toFixed(1)}" r="1.5"/></g>`).join('')}</g>
  </g>`;
})();

// A wreath hung over the picture: a green ring with red berries and a bow at the bottom. Picture units (46 × 58).
const wreathSvg = `<g class="xmas-only">
  <circle cx="23" cy="27" r="12" fill="none" stroke="#2F6B3C" stroke-width="6"/>
  <circle cx="23" cy="27" r="12" fill="none" stroke="#4E9A5B" stroke-width="3" stroke-dasharray="3 2.6"/>
  <circle cx="23" cy="27" r="12" fill="none" stroke="#1F4D2A" stroke-width="5.4" stroke-dasharray=".6 2.2" opacity=".7"/>
  <circle cx="23" cy="27" r="13.8" fill="none" stroke="#7CC488" stroke-width=".8" stroke-dasharray="1 2.4" opacity=".6"/>
  ${[20, 75, 140, 200, 250, 310].map(a => a * Math.PI / 180).map(a => { const bx = +(23 + 12 * Math.cos(a)).toFixed(1), by = +(27 + 12 * Math.sin(a)).toFixed(1);
    return `<circle cx="${bx}" cy="${by}" r="1.5" fill="#D93A55"/><circle cx="${bx - .5}" cy="${by - .5}" r=".45" fill="#fff" opacity=".6"/>`; }).join('')}
  <path d="M23 39l-6-3.5v7zM23 39l6-3.5v7z" fill="#C7334F"/><path d="M22 39l-3 7h2.4l1.6-4zM24 39l3 7h-2.4L23 42z" fill="#A82A43"/>
  <circle cx="23" cy="39" r="1.8" fill="#A82A43"/><path d="M18 37l3.6 1.6M28 37l-3.6 1.6" stroke="#fff" stroke-opacity=".3" stroke-width=".6" stroke-linecap="round"/>
</g>`;

// In the cocoa: a candy cane leaning in it, resting on the mug's right lip with its hook hanging over the outside (the
// user asked: standing straight up looked wrong), pulled a little out of the cup. Drawn before the mug, so the mug and
// the cocoa hide its lower end.
const CANE = 'M21 25V10a2.6 2.6 0 0 1 5.2 0v1.4';   // drawn upright from its foot in the cup, then tipped 30° (the user picked it)
const caneSvg = `<g class="xmas-only" transform="translate(1.5 -2.6) rotate(30 21 25)">   <!-- slid 3 units out along its length (the user asked) -->
  <path d="${CANE}" fill="none" stroke="#FFF6EE" stroke-width="1.7" stroke-linecap="round"/>
  <path d="${CANE}" fill="none" stroke="#D93A55" stroke-width="1.7" stroke-dasharray="1.1 1.1"/>
  <path d="${CANE}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".4" transform="translate(-.45 0)"/>
</g>`;
const cocoaSvg = `<g class="xmas-only">
  <rect x="19.6" y="13.4" width="3" height="2.6" rx=".8" fill="#FFFDF8" transform="rotate(-12 21 14.7)"/>
  <rect x="23" y="13" width="3" height="2.6" rx=".8" fill="#FFFDF8" transform="rotate(8 24.5 14.3)"/>
  <rect x="25.6" y="14" width="2.6" height="2.2" rx=".7" fill="#F4ECE0"/>
  <path d="M19.8 15.6h2.4M23.2 15.3h2.6M25.8 15.9h2.2" stroke="#000" stroke-opacity=".14" stroke-width=".5"/>
</g>`;

// The Santa hat. Its fur band's middle is at (50, 74) of 100 × 90; settings.hat places that point on the photo.
const hatSvg = `<svg class="hat" viewBox="0 0 100 90" aria-hidden="true">
  <path d="M14 70C18 38 40 13 64 10c15-2 25 8 27 24l-8 3c-3-9-9-12-15-8 6 13 12 26 16 41z" fill="#C7334F"/>
  <path d="M68 29c6 13 12 26 16 41H62C66 56 68 42 68 29z" fill="#A82A43"/>
  <path d="M33 66c3-16 10-30 22-44M52 64c1-12 4-24 10-33" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M20 62c4-20 16-38 34-47" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="88" cy="38" r="9" fill="#FFF6EE"/><circle cx="91" cy="41" r="4.5" fill="#EDE3D6"/>
  ${[[82, 33], [86, 30.5], [91, 31], [94.5, 35], [95.5, 40], [80.5, 38], [83, 43.5], [88, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#FFF6EE"/>`).join('')}
  <path d="M84 36l1.2 1.4M89 34.5l.6 1.6M86 41l1.4-.6" stroke="#D8CBBB" stroke-width=".8" stroke-linecap="round"/>
  <rect x="6" y="63" width="88" height="22" rx="11" fill="#FFF6EE"/>
  ${Array.from({ length: 12 }, (_, i) => `<circle cx="${12 + i * 6.9}" cy="${64.4 + (i % 2) * .8}" r="2.8" fill="#FFF6EE"/>`).join('')}
  <path d="M14 78h72" stroke="#EDE3D6" stroke-width="5" stroke-linecap="round"/>
  <path d="${Array.from({ length: 13 }, (_, i) => `M${13 + i * 6} ${70 + (i % 3)}l1.2 1.6`).join('')}" stroke="#D8CBBB" stroke-width=".9" stroke-linecap="round"/>
</svg>`;
// The autumn beanie, drawn on the same 100 × 90 with its cuff's middle at (50, 74), so it sits where the Santa hat
// was placed: one placement (settings.hat) for both, no SQL. Rust knit, ribbed cuff, a mustard pompom, a gold leaf.
const beanieSvg = `<svg class="hat" viewBox="0 0 100 90" aria-hidden="true">
  <circle cx="50" cy="15" r="10" fill="#F2C14E"/><circle cx="53" cy="18" r="5.5" fill="#E0A21B" opacity=".55"/>
  <path d="M12 68C12 34 29 21 50 21s38 13 38 47z" fill="#C2602E"/>
  <path d="${(() => {
    let d = '';
    for (let y = 27; y < 63; y += 4.4) for (let x = 14; x < 87; x += 4.2) {
      const xx = x + (Math.round((y - 27) / 4.4) % 2) * 2.1;
      if (((xx - 50) / 35) ** 2 + ((y + 1 - 68) / 44) ** 2 < 1) d += `M${(xx - 1.5).toFixed(1)} ${y.toFixed(1)}l1.5 2 1.5-2`;
    }
    return d;
  })()}" fill="none" stroke="#A84F24" stroke-opacity=".75" stroke-width=".8" stroke-linecap="round"/>
  <path d="M30 66c-2-18 3-32 12-41M50 66V22M70 66c2-18-3-32-12-41" fill="none" stroke="#A84F24" stroke-width="2"/>
  <path d="M20 58c0-14 8-26 20-31" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3" stroke-linecap="round"/>
  <path d="M44 12c3 2 4 5 4 8M48 8c1 3 4 5 7 5M55 10c-1 3 0 6 2 8M46 18c3-1 6 0 8 2" fill="none" stroke="#C9900F" stroke-width=".9" stroke-linecap="round"/>
  <rect x="8" y="63" width="84" height="22" rx="8" fill="#9C4A22"/>
  <path d="${Array.from({ length: 11 }, (_, i) => `M${15 + i * 7} 66v16`).join('')}" stroke="#80391A" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M74 67c3-3 5-1 6 1 2-2 5-1 5 1-2 1-2 3-1 5-2 0-4 0-5-1 0 2-2 3-3 3 0-2-1-3-2-4-1 1-3 0-3-1 2-1 3-2 3-4z" fill="#E0A21B"/>
  <path d="M75 73.5l6-4.5M78 71l-.6-2.4M80 69.6l2 .4" fill="none" stroke="#A86E12" stroke-width=".6" stroke-linecap="round"/>
</svg>`;
// Which hat the pal wears now, if any: the Santa hat at Christmas, the beanie through Thanksgiving, the dragon hat at
// Chinese New Year, the witch hat in October.
function hatSeason() {
  if (xmasNow().on) return { title: 'Santa Hat', what: 'a Santa hat', thru: 'Through January 7', svg: hatSvg };
  if (fallNow().on) return { title: 'Autumn Beanie', what: 'an autumn beanie', thru: 'Through Thanksgiving', svg: beanieSvg };
  if (cnyNow().on) return { title: 'Dragon Hat', what: 'a dragon hat', thru: 'Through the Lantern Festival', svg: dragonHatSvg };
  if (halloweenNow().on) return { title: 'Witch Hat', what: 'a witch hat', thru: 'Through October', svg: witchHatSvg };
  return null;
}
// The fox drawing's own spot: between its ears, tilted a little.
const FOX_HAT = { x: .42, y: .2, w: .5, r: -8 };

// ---------- The Thanksgiving table ----------
// A long table in the plant's corner, running off the right edge, with a wicker cornucopia at its right end. Food
// spills out of the horn's mouth and heaps to the left: 28 spots (Thanksgiving falls by November 28), in rows that
// sit in the dips of the row below, filled so the heap grows out of the horn and never floats. Table units: 148 × 72.
const HARVEST_SPOTS = (() => {
  const s = [];
  [9, 8, 7, 4].forEach((n, r) => { for (let i = 0; i < n; i++) s.push({ x: 107 - 4 * r - 8 * i, y: 35 - 7.6 * r, k: i + 1.5 * r, r }); });
  return s.sort((a, b) => a.k - b.k || a.r - b.r).map(p => [p.x, p.y]);
})();
// Drawn bottom row first, so food on top sits over what's under it.
const FRUIT_DRAW = HARVEST_SPOTS.map((s, i) => i).sort((a, b) => HARVEST_SPOTS[b][1] - HARVEST_SPOTS[a][1] || a - b);
// In turn: apple, mini pumpkin, pear, grapes, corn, and a Sweetberry. A stuffed day's piece is gold, whatever it is (the user asked).
const FRUIT_KINDS = ['apple', 'pumpkin', 'pear', 'grapes', 'corn', 'berry'];
function fruitSvg(i, gold) {
  const [x, y] = HARVEST_SPOTS[i], c = (plain, g) => gold ? g : plain;
  const stem = (sx, sy) => `<path d="M${sx} ${sy}q.3-1.8 1.5-2.5" fill="none" stroke="#6B4128" stroke-width=".9" stroke-linecap="round"/>`;
  const leaf = `<path d="M${x + .8} ${y - 4.4}c1.2-1.5 3.1-1.5 3.8-.6-1 1-2.6 1.3-3.8.6z" fill="#4E9A5B"/>`;
  const shine = `<circle cx="${x - 2}" cy="${y - 1.2}" r=".9" fill="#fff" opacity=".55"/>`;
  const body = {
    apple: `<path d="M${x - 5} ${y - 1}c0-3.6 2.6-5.2 5-3.7 2.4-1.5 5 .1 5 3.7 0 3.6-2.5 6-5 6s-5-2.4-5-6z" fill="${c('#C7334F', '#F2B630')}"/>
      <path d="M${x - 4.8} ${y + .4}c.6 2.6 2.6 4.6 4.8 4.6s4.2-2 4.8-4.6c-1.4 1.8-3 2.8-4.8 2.8s-3.4-1-4.8-2.8z" fill="#000" opacity=".16"/>
      <circle cx="${x + 2}" cy="${y + .6}" r=".3" fill="#fff" opacity=".4"/><circle cx="${x + 1}" cy="${y + 2.4}" r=".3" fill="#fff" opacity=".4"/><circle cx="${x - 1.6}" cy="${y + 2}" r=".3" fill="#fff" opacity=".4"/>
      ${stem(x, y - 4)}${leaf}${shine}`,
    pumpkin: `<ellipse cx="${x - 2.5}" cy="${y + 1}" rx="3.2" ry="4" fill="${c('#D9682A', '#E0A21B')}"/><ellipse cx="${x + 2.5}" cy="${y + 1}" rx="3.2" ry="4" fill="${c('#D9682A', '#E0A21B')}"/>
      <ellipse cx="${x}" cy="${y + 1}" rx="2.8" ry="4" fill="${c('#E8843A', '#F2B630')}"/>
      <path d="M${x - 2.6} ${y - 2.4}q-1.4 3.4 0 6.8M${x + 2.6} ${y - 2.4}q1.4 3.4 0 6.8" fill="none" stroke="#000" stroke-opacity=".18" stroke-width=".5"/>
      <path d="M${x - .9} ${y - 1.4}q-.5 2 0 3.8" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".6" stroke-linecap="round"/>
      <path d="M${x - 5.6} ${y + 3}c2 2.2 9.2 2.2 11.2 0" fill="none" stroke="#000" stroke-opacity=".14"/>
      <path d="M${x - .7} ${y - 2.6}l.4-2.2h1.5l-.3 2.2z" fill="#5C7A34"/>`,
    pear: `<path d="M${x} ${y - 6}c1.6 0 2 1.8 2 3 0 1.2 2.6 2.2 2.6 5 0 1.9-2 3-4.6 3s-4.6-1.1-4.6-3c0-2.8 2.6-3.8 2.6-5 0-1.2.4-3 2-3z" fill="${c('#B5B04A', '#F2B630')}"/>
      <path d="M${x + 4.2} ${y + 1}c0 2-1.8 3.4-4.2 3.4-1.4 0-2.6-.4-3.4-1.2 2.4.6 5.6.1 7.6-2.2z" fill="#000" opacity=".15"/>
      ${[[1.4, 0], [-1.6, 1.8], [2, 2.6], [-.4, 3.4], [.8, -2.6]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r=".28" fill="#6B6A20" opacity=".55"/>`).join('')}
      ${stem(x, y - 5.6)}${shine}`,
    grapes: `${[[-3.2, -1.8], [0, -1.8], [3.2, -1.8], [-1.6, .9], [1.6, .9], [0, 3.4]].map(([dx, dy]) =>
      `<circle cx="${x + dx}" cy="${y + dy}" r="1.8" fill="${c('#7A4A8A', '#F2B630')}"/><path d="M${x + dx - 1.7} ${y + dy + .3}a1.8 1.8 0 0 0 3.4 0 1.8 1 0 0 1-3.4 0z" fill="#000" opacity=".18"/>
      <circle cx="${x + dx - .6}" cy="${y + dy - .6}" r=".45" fill="#fff" opacity=".45"/>`).join('')}${stem(x, y - 3.4)}${leaf}`,
    corn: `<path d="M${x - 3.5} ${y + .4}q-3-1.6-5-.6 2.4.6 4.4 3.6zM${x - 3.5} ${y + 4}q-3 1.6-5 .6 2.4-.6 4.4-3.6z" fill="#A79A55"/>
      <ellipse cx="${x + 1}" cy="${y + 2.2}" rx="5.6" ry="2.8" fill="${c('#F2C14E', '#F2B630')}"/>
      <path d="M${x - 2} ${y}v4.4M${x + .8} ${y - .5}v5.4M${x + 3.6} ${y}v4.4" stroke="${c('#D9A230', '#C98A12')}" stroke-width=".6"/>
      <path d="M${x - 3.6} ${y + 1.3}h9.4M${x - 3.8} ${y + 3}h9.6" stroke="${c('#D9A230', '#C98A12')}" stroke-width=".45"/>
      <path d="M${x - 2.4} ${y + 1}q1.6-1 4 -1" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".5" stroke-linecap="round"/>
      <path d="M${x - 4} ${y + 1.4}q-2-1-3.6-.8M${x - 4} ${y + 3.2}q-2 1-3.6.8" fill="none" stroke="#7E7340" stroke-width=".4"/>`,
    berry: `<circle cx="${x}" cy="${y + .6}" r="4.4" fill="${c('#D93A55', '#F2B630')}"/><path d="M${x - 4.4} ${y + .6}a4.4 4.4 0 0 0 8.8 0 4.8 2.8 0 0 1-8.8 0z" fill="#000" opacity=".16"/>
      ${[[1.4, .4], [-.6, 2.2], [1.6, 2.6], [-1.8, .2]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r=".4" fill="#FFE7A0" opacity=".8"/>`).join('')}<path d="M${x} ${y - 3.8}c.9-2 2.9-2.7 4.7-2.3-.4 1.9-2.4 3.1-4.7 2.3z" fill="#4E9A5B"/>${shine}`,
  }[FRUIT_KINDS[i % FRUIT_KINDS.length]];
  const spark = gold ? `<path class="orn-spark" d="M${x + 5} ${y - 7}l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#FFE7A0"/>` : '';
  return `<g class="fruit" data-i="${i}">${body}${spark}</g>`;
}
const harvestTableSvg = `<svg class="harvest fall-only" viewBox="0 0 148 72">
  <rect x="30" y="69.6" width="152" height="4.4" rx="2.2" fill="#000" opacity=".16"/>
  <rect x="34" y="48" width="4" height="24" fill="var(--table-2)"/><rect x="118" y="48" width="4" height="24" fill="var(--table-2)"/>
  <path d="M33 35.4h150V39H30z" fill="#F4E9D4"/><path d="M33 35.4h150" stroke="#000" stroke-opacity=".1" stroke-width=".6"/>
  <path d="M36.8 50v20M120.8 50v20" stroke="#000" stroke-opacity=".18"/>
  <path d="M30 39h152v12H30z" fill="#EADCC2"/><path d="M30.5 39v12" stroke="#000" stroke-opacity=".12"/>
  <path d="${Array.from({ length: 25 }, (_, i) => `M${32 + i * 5} 40.5v10`).join('')}" stroke="#000" stroke-opacity=".035" stroke-width="1.6"/>
  <path d="M46 41.5v9.5M74 42v9M100 41.5v9.5M130 42v9" stroke="#000" stroke-opacity=".08" stroke-width="2.4" stroke-linecap="round"/><path d="M30 39h152v1.4H30z" fill="rgb(0 0 0 / .06)"/>
  <path d="M30 46.5h152v1.8H30z" fill="#B5562E"/><path d="M30 50h152v1H30z" fill="rgb(0 0 0 / .1)"/>
  <path d="M112 14C126 15 137 23 141 34l.5 4.5c-8 2-20 2-29.5 1.5z" fill="#C4914F"/>
  <path d="${(() => {
    let d = '';
    for (let y = 17, r = 0; y < 39; y += 2.6, r++)
      for (let x = 114 + (r % 2) * 1.8; x < 140; x += 3.6) {
        const top = 14.5 + 22 * ((x - 112) / 29) ** 1.7;
        if (y > top + 1.2) d += `M${x.toFixed(1)} ${y.toFixed(1)}q.9 .8 1.8 0`;
      }
    return d;
  })()}" fill="none" stroke="#9C6B35" stroke-width=".6" stroke-linecap="round"/>
  <path d="M119 15.5c2 7 2 16 0 24.5M126 18c1.8 6 1.8 14 0 21.8M133 23c1.2 4.6 1.2 10.6 0 16" fill="none" stroke="#9C6B35" stroke-width="1.6"/>
  <path d="M114 15.4c10 .8 18 6 23.6 14.6" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".9" stroke-linecap="round"/>
  <path d="M113 39.6c9 .6 19 .4 28.4-1.2" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.2"/>
  <path d="M141.5 37c4-1 5.6-6 3.4-9.4-1.6-2.4-4.6-2.2-5.6 0" fill="none" stroke="#C4914F" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="112" cy="27" rx="4.2" ry="13" fill="#6B4128"/><ellipse cx="112.8" cy="27" rx="2.6" ry="10.4" fill="#000" opacity=".25"/>
  <ellipse cx="112" cy="27" rx="4.2" ry="13" fill="none" stroke="#9C6B35" stroke-width="2"/>
  <path d="M110.6 15.6q-1.6 5-.6 10" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width=".7" stroke-linecap="round"/>
  <g id="fruits"></g>
</svg>`;

// Cider with a cinnamon stick in the mug (no orange slice; the user asked). The stick is drawn before the mug so the
// mug hides its foot; the cider is drawn over the cocoa.
const cinnamonSvg = `<g class="fall-only" transform="rotate(-18 24.5 26)">
  <rect x="23.3" y="6.5" width="2.4" height="19.5" rx=".9" fill="#8A4A24"/><path d="M24.1 7v18.5" stroke="#5E3017" stroke-width=".5"/><path d="M25.1 7.4v18" stroke="#B26A3A" stroke-width=".35"/>
  <path d="M23.4 9h2.2M23.4 14h2.2M23.4 19h2.2" stroke="#5E3017" stroke-opacity=".5" stroke-width=".3"/>
</g>`;
const ciderSvg = `<ellipse class="fall-only" cx="24.5" cy="15.6" rx="5.3" ry="1.3" fill="#B8732C"/>`;
// Thanksgiving Day only: a slice of pumpkin pie with a dollop of cream on a plate beside the mug.
const pieSvg = `<g class="tday-only">
  <ellipse cx="42" cy="28.4" rx="5.2" ry="1.3" fill="#FFF6EE"/><path d="M37.8 28h8.4v-4.2z" fill="#D2782E"/>
  <rect x="45.4" y="23.2" width="1.8" height="5" rx=".7" fill="#E3B26B"/><path d="M38 28.2h8.6" stroke="#E3B26B" stroke-width=".9"/>
  <circle cx="42.6" cy="24.9" r="1.2" fill="#FFF6EE"/>
  <path d="M37.8 28h8.4v-1.4z" fill="#000" opacity=".12"/><path d="M46.3 23.6v4.2" stroke="#C9934E" stroke-width=".5" stroke-dasharray=".5 .5"/>
  <path d="M42 24.9q.6-.8 1.3 0" fill="none" stroke="#E8DCCB" stroke-width=".35"/>
</g>`;

// Sets the table and the Thanksgiving classes; renderStatus calls it with setXmas. A new piece pops in, and so does a
// piece turning gold (a day going stuffed); one losing its gold (an Undo) just changes.
let shownFruit = null;
function setFall(days, goal) {
  const feedEl = $('.feed');
  if (!feedEl) return;
  const f = fallNow();
  feedEl.classList.toggle('fall', f.on);
  feedEl.classList.toggle('tday', f.tday);
  if (!f.on) { shownFruit = null; return; }
  const got = harvestDays(days, goal, f.year);
  $('#fruits').innerHTML = FRUIT_DRAW.filter(i => i < got.length).map(i => fruitSvg(i, got[i].gold)).join('');
  if (shownFruit && !reducedMotion()) got.forEach((o, i) => {
    if (i < shownFruit.length && (o.gold === shownFruit[i].gold || !o.gold)) return;
    pop($(`.fruit[data-i="${i}"]`), 0);
  });
  shownFruit = got;
}

// ---------- Hanging them ----------
// renderStatus calls this after every berry and at midnight. An ornament (and its present) that's new since the last
// draw pops out of nowhere with a burst of sparkles (the user asked); a day turning stuffed turns its ornament gold, with
// the same pop. The first draw of the page just shows what's there.
let shownOrn = null;
function setXmas(days, goal) {
  const feedEl = $('.feed');
  if (!feedEl) return;
  const x = xmasNow();
  feedEl.classList.toggle('xmas', x.on);
  if (!x.on) { shownOrn = null; return; }
  const orn = ornamentDays(days, goal, x.treeYear);
  $('#ornaments').innerHTML = orn.map((o, i) => ornamentSvg(i, o.gold)).join('');
  const gifts = back => x.presents ? GIFT_DRAW.filter(i => i < orn.length && !GIFT_SPOTS[i][4] === !back).map(giftSvg).join('') : '';
  $('#giftsBack').innerHTML = gifts(true);
  $('#gifts').innerHTML = gifts(false);
  if (shownOrn && !reducedMotion()) orn.forEach((o, i) => {
    if (i < shownOrn.length && (o.gold === shownOrn[i].gold || !o.gold)) return;   // turning gold pops; losing it (an Undo) doesn't
    pop($(`.orn[data-i="${i}"]`), 0);
    if (i >= shownOrn.length) pop($(`.gift[data-i="${i}"]`), 220);
  });
  shownOrn = orn;
}

// Pops out of nothing (too big, then settles) with a small burst of sparkles around it.
function pop(el, delay) {
  if (!el) return;
  el.style.animationDelay = delay + 'ms';
  el.classList.add('pop');
  const layer = $('#sparkles');
  if (!layer) return;
  const L = layer.getBoundingClientRect(), R = el.getBoundingClientRect();
  const cx = R.left - L.left + R.width / 2, cy = R.top - L.top + R.height / 2;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 18;
    const s = document.createElement('span');
    s.className = 'sparkle' + (Math.random() < .6 ? ' gold' : '');
    s.style.cssText = `left:${cx + Math.cos(a) * r}px; top:${cy + Math.sin(a) * r}px; --sz:${6 + Math.random() * 7}px;
      animation-delay:${delay + 120 + Math.random() * 300}ms`;
    s.onanimationend = () => s.remove();
    setTimeout(() => s.remove(), 2500 + delay);
    layer.append(s);
  }
}

// ---------- Chinese New Year (the user asked): New Year's Eve through the Lantern Festival (day 15) ----------
// Red lanterns hang from the mantel, a 福 (good fortune) diamond hangs on the window, the mug holds tea, and the plant
// is put away for an offering table (incense, mandarins, apples) with a kumquat tree on it. Each day of the 16 (Eve to Lantern Festival) that meets the
// goal hangs one red envelope on it (gold with a sparkle on a stuffed day). Fireworks go off in the window after dark on
// Eve, New Year's Day, and the Lantern Festival; on Eve and New Year's Day a plate of dumplings sits on the side table
// and a stuffed pal "is stuffed with dumplings!". The pal wears a dragon hat (same placement as the other hats).
// The lunar calendar has no simple rule, so the dates are a table: add more before 2041.
const CNY_DATES = { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11',
  2033: '01-31', 2034: '02-19', 2035: '02-08', 2036: '01-28', 2037: '02-15', 2038: '02-04', 2039: '01-24', 2040: '02-12' };
const CNY_DAYS = 16;   // Eve, then days 1–15
const cnyEve = y => CNY_DATES[y] ? addDays(`${y}-${CNY_DATES[y]}`, -1) : null;
function cnyNow(now = new Date()) {
  const y = now.getFullYear(), eve = cnyEve(y), t = iso(now);
  if (!eve || t < eve || t > addDays(eve, CNY_DAYS - 1)) return { on: false, feast: false, boom: false, year: y };
  let n = 0;   // 0 = Eve, 1 = New Year's Day, 15 = Lantern Festival
  while (addDays(eve, n) < t) n++;
  return { on: true, feast: n <= 1, boom: n <= 1 || n === 15, year: y };
}
// The days that hang an envelope: Eve through the Lantern Festival of that year, goal met, up to today.
function cnyDays(days, goal, year) {
  const out = [], eve = cnyEve(year);
  if (!eve) return out;
  for (let i = 0; i < CNY_DAYS; i++) {
    const d = addDays(eve, i);
    if (d > today()) break;
    const e = days.get(d);
    if (berriesOn(e) >= goal) out.push({ day: d, gold: isStuffed(e, goal) });
  }
  return out;
}

// The kumquat tree: a round bush with a few small fruit, in a blue-and-white pot. Tree units 80 × 110, pot foot at 110.
// Envelope spots in the order they're hung, spread over the bush (rows staggered so none overlap; the user agreed to
// a bigger tree, envelopes half again as big, and fewer kumquats so the envelopes read at phone size).
const HB_SPOTS = [[27, 46], [48, 33], [46, 60], [14, 46], [34, 20], [59, 60], [66, 46], [20, 33], [40, 46], [21, 60],
  [60, 33], [46, 20], [53, 46], [34, 60], [32, 33], [40, 72]];
const KUMQUATS = [[40, 37], [33, 53], [53, 53], [27, 68], [56, 68], [54, 26]];
function envelopeSvg(i, gold) {
  const [x, y] = HB_SPOTS[i], body = gold ? '#F2B630' : '#C7233A', flap = gold ? '#D9981C' : '#A11B2F', seal = gold ? '#C7233A' : '#F2C14E';
  return `<g class="hb" data-i="${i}"><path d="M${x} ${y - 9}v4" stroke="#E0A21B" stroke-width=".6"/>
    <rect x="${x - 3.9}" y="${y - 5.2}" width="7.8" height="10.8" rx=".9" fill="${body}"/>
    <rect x="${x - 3.2}" y="${y - 4.5}" width="6.4" height="9.4" rx=".6" fill="none" stroke="${gold ? '#C98A12' : '#F2C14E'}" stroke-width=".35" opacity=".8"/>
    <rect x="${x + 2}" y="${y - 4.6}" width="1.6" height="9.8" fill="#000" opacity=".12"/>
    <path d="M${x - 3.9} ${y - 4.3}l3.9 3 3.9-3v-.3a.9.9 0 0 0-.9-.6h-6a.9.9 0 0 0-.9.6z" fill="${flap}"/>
    <circle cx="${x}" cy="${y + 1.3}" r="1.6" fill="${seal}"/><circle cx="${x - .5}" cy="${y + .8}" r=".45" fill="#fff" opacity=".5"/>
    ${gold ? `<path class="orn-spark" d="M${x + 5.5} ${y - 8}l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#FFE7A0"/>` : ''}</g>`;
}
const kumquatTree = `<rect x="37.5" y="70" width="5" height="16" fill="#6B4128"/>
  <circle cx="40" cy="46" r="29" fill="var(--plant)"/><circle cx="25" cy="38" r="15" fill="var(--plant-2)"/>
  <circle cx="55" cy="38" r="15" fill="var(--plant-2)"/><circle cx="40" cy="24" r="14" fill="var(--plant-2)"/>
  <path d="M11 50a29 29 0 0 0 58 0 29 29 0 0 1-58 0z" fill="rgb(0 0 0 / .1)"/>
  ${(() => {
    let seed = 5, dark = '', lit = '';
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 27, x = 40 + Math.cos(a) * r, y = 44 + Math.sin(a) * r * .95;
      if (y < 12) continue;
      const seg = `M${x.toFixed(1)} ${y.toFixed(1)}q1.3-1.4 2.8-.4`;
      if (x + y < 70) lit += seg; else dark += seg;
    }
    return `<path d="${dark}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".7" stroke-linecap="round"/>
      <path d="${lit}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".7" stroke-linecap="round"/>`;
  })()}
  ${KUMQUATS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#F08A24"/><circle cx="${x - .7}" cy="${y - .7}" r=".7" fill="#fff" opacity=".5"/>`).join('')}
  <path d="M19 84h42l-4 26H23z" fill="#F4F1EA"/><rect x="17" y="82" width="46" height="4" rx="1.5" fill="#E8E2D6"/>
  <path d="M21.5 90h37M23.5 104.5h33" stroke="#2F5DA8" stroke-width="1.6"/>
  <path d="M32 97c2.5-3 5.5-3 8 0s5.5 3 8 0" fill="none" stroke="#2F5DA8" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M21 86h38l-.6 3.4H21.6z" fill="#000" opacity=".1"/><path d="M24 88q1 9 3.4 20" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M51 86l-3.4 24h5.4L57 86z" fill="#000" opacity=".06"/>
  <g id="envelopes"></g>`;

// The offering table (the user asked): a low red-lacquer table running off the right edge, with an incense burner
// (three sticks, glowing tips, smoke curling up), a pyramid of mandarins, and a dish of apples, and the kumquat tree
// standing on the floor behind it, its pot peeking over the fruit. The table starts at x 52: the fireplace is on a
// layer above the room, so anything further left was hidden behind it (the user saw the incense covered on a phone).
// Corner units: 170 across, tabletop at y 104.
const fruitBall = (x, y, r, fill, leaf) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>
  <path d="M${x - r} ${y}a${r} ${r} 0 0 0 ${2 * r} 0 ${r * 1.1} ${r * .65} 0 0 1 ${-2 * r} 0z" fill="#000" opacity=".15"/>
  <circle cx="${x + r * .3}" cy="${y - r * .1}" r=".3" fill="#000" opacity=".15"/><circle cx="${x - r * .1}" cy="${y + r * .35}" r=".3" fill="#000" opacity=".15"/>
  <circle cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .22}" fill="#fff" opacity=".45"/>
  ${leaf ? `<path d="M${x} ${y - r + .4}c1-2 3-2.6 4.6-2.1-.5 1.8-2.6 2.8-4.6 2.1z" fill="#4E9A5B"/>` : `<circle cx="${x}" cy="${y - r + .8}" r=".7" fill="#5C7A34"/>`}`;
const incense = [[14.5, 92, 12.5, 66], [18, 92, 18, 63], [21.5, 92, 23.5, 66]];
const cnyCornerSvg = `<svg class="cny-corner cny-only" viewBox="0 -30 170 190">
  <g transform="translate(68 -37.5) scale(1.25)">${kumquatTree}</g>
  <rect x="52" y="155.4" width="250" height="4.4" rx="2.2" fill="#000" opacity=".18"/>
  <path d="M55.5 100.6h250v3.6H52z" fill="#C73348"/><path d="M58 101.6h110" stroke="#fff" stroke-opacity=".25" stroke-linecap="round"/>
  <rect x="52" y="104" width="250" height="5" rx="1.5" fill="#B3263E"/><rect x="52" y="109" width="250" height="8" rx="1" fill="#8E1B30"/>
  <path d="M53 113h250" stroke="#E0A21B" stroke-width=".9"/>
  <path d="M54 105.2h120" stroke="#fff" stroke-opacity=".3" stroke-linecap="round"/><path d="M60 111h80" stroke="#fff" stroke-opacity=".12" stroke-linecap="round"/>
  <path d="M59 120v32M148 120v32" stroke="#fff" stroke-opacity=".16" stroke-linecap="round"/>
  <path d="M57 117h7v37c0 2 2 3 4 3h-11zM146 117h7v40h-11c2 0 4-1 4-3z" fill="#7A1628"/>
  <g transform="translate(46 0)">${incense.map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#9C3A26" stroke-width="1.1"/>
    <circle class="ember-tip" cx="${x2}" cy="${y2}" r="1.2" fill="#FF8A3D"/>`).join('')}
  <g class="smoke">${incense.map(([, , x, y]) => `<path d="M${x} ${y - 1}c-3-4 3-7 0-11s3-7 0-11"/>`).join('')}</g>
  <path d="M8 92h20c0 7-4 12-10 12S8 99 8 92z" fill="#B8862F"/><ellipse cx="18" cy="92" rx="10" ry="2" fill="#8A6420"/>
  <ellipse cx="18" cy="92.2" rx="8" ry="1.3" fill="#D8CFC2"/><path d="M14 92.3h.6M19 92h.6M21.6 92.5h.5" stroke="#8A8278" stroke-width=".5"/>
  <path d="M9.6 95.4h16.8" stroke="#E0B95A" stroke-width=".8"/><path d="M10.4 94.6q1.4 5.2 5 7.6" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".8" stroke-linecap="round"/>
  <path d="M28 92c0 7-4 12-10 12 3-2.4 6-6.8 6.4-12z" fill="#000" opacity=".14"/><path d="M11 101l-1 3.5M25 101l1 3.5" stroke="#8A6420" stroke-width="1.6" stroke-linecap="round"/></g>
  <g transform="translate(50 0)"><ellipse cx="46" cy="103.6" rx="13" ry="2.4" fill="#F4F1EA"/><ellipse cx="46" cy="103.6" rx="9" ry="1.2" fill="none" stroke="#2F5DA8" stroke-width=".5"/>
  ${[[37, 98.6], [46, 98.6], [55, 98.6], [41.5, 91], [50.5, 91]].map(([x, y]) => fruitBall(x, y, 4.6, '#F08A24')).join('')}${fruitBall(46, 83.4, 4.6, '#F08A24', true)}</g>
  <g transform="translate(51 0)"><ellipse cx="77" cy="103.6" rx="10" ry="2" fill="#F4F1EA"/>
  ${fruitBall(72.5, 99, 4.3, '#C7334F')}${fruitBall(81.5, 99, 4.3, '#B8323F')}${fruitBall(77, 91.6, 4.3, '#D9433F', true)}</g>
</svg>`;

// Two red lanterns hung from the mantel's ends, swaying a little; their glow grows with the fire. Fireplace units.
const lantern = x => `<g class="lantern" style="transform-origin:${x}px 16px">
  <path d="M${x} 16v4" stroke="#6B4128" stroke-width="1"/>
  <circle class="halo" cx="${x}" cy="30" r="13"/>
  <rect x="${x - 5}" y="19.5" width="10" height="3" rx="1" fill="#E0A21B"/>
  <ellipse cx="${x}" cy="30" rx="10" ry="8.5" fill="#D62D3E"/>
  <path d="M${x} 21.5v17M${x - 5} 22.6c-2.6 4.6-2.6 10.2 0 14.8M${x + 5} 22.6c2.6 4.6 2.6 10.2 0 14.8" fill="none" stroke="#A11B2F" stroke-width=".8"/>
  <path d="M${x - 2.6} 21.8c-1.2 5-1.2 11.4 0 16.4M${x + 2.6} 21.8c1.2 5 1.2 11.4 0 16.4" fill="none" stroke="#A11B2F" stroke-width=".45"/>
  <path d="M${x - 7.2} 26.4c-.9 2.4-.9 5.4 0 7.6" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M${x + 3} 31.6c2.2 0 5-.6 6.6-2.2-.4 3.8-3 6.4-6.6 7.6z" fill="#000" opacity=".12"/>
  <rect x="${x - 5}" y="37.5" width="10" height="3" rx="1" fill="#E0A21B"/>
  <path d="M${x - 4.4} 20h8.8M${x - 4.4} 38h8.8" stroke="#fff" stroke-opacity=".4" stroke-width=".6" stroke-linecap="round"/>
  <path d="M${x} 40.5v3M${x - 1.6} 43.5h3.2l.6 7h-4.4z" stroke="#E0A21B" stroke-width="1" fill="#F2C14E"/>
  <path d="M${x - .9} 44.4v6M${x} 44.4v6.2M${x + .9} 44.4v6" stroke="#C98A12" stroke-width=".35"/>
</g>`;
const lanternsSvg = `<g class="cny-only lanterns">${lantern(22)}${lantern(128)}</g>`;

// 福 on a red diamond, hung on the window. Window-decor units (the wreath's box: 6 12 34 36).
const fuSvg = `<g class="cny-only">
  <path d="M23 9.6v3.6M23 47v3.6" stroke="#E0A21B" stroke-width=".7"/><path d="M22.2 50.2h1.6l.4 3.4h-2.4z" fill="#E0A21B"/>
  <rect x="11" y="18" width="24" height="24" rx="1.5" transform="rotate(45 23 30)" fill="#C7233A"/>
  <path d="M23 13.4 39.6 30H6.4z" fill="#fff" opacity=".1"/>
  <rect x="13" y="20" width="20" height="20" rx="1" transform="rotate(45 23 30)" fill="none" stroke="#F2C14E" stroke-width=".8"/>
  <text x="23" y="35.6" text-anchor="middle" font-size="15" font-weight="700" fill="#F2C14E"
    font-family="'Noto Serif SC', 'Songti SC', 'SimSun', serif">福</text>
</g>`;

// Tea in the mug, drawn over the cocoa.
const teaSvg = `<ellipse class="cny-only" cx="24.5" cy="15.6" rx="5.3" ry="1.3" fill="#B58A2E"/>`;
// Eve and New Year's Day: a plate of three dumplings beside the mug. Side-table units.
const dumpling = (x, y) => `<path d="M${x - 2.6} ${y}c0-2.2 1.2-3.4 2.6-3.4s2.6 1.2 2.6 3.4z" fill="#F6EBD6"/>
  <path d="M${x - 2.6} ${y}h5.2c0-.5-.1-.9-.2-1.2h-4.8c-.1.3-.2.7-.2 1.2z" fill="#000" opacity=".1"/>
  <path d="M${x - 1.6} ${y - 1}q.3-1.4 1.2-1.9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".35" stroke-linecap="round"/>
  <path d="M${x - 1.3} ${y - 2.4}l.3.8M${x} ${y - 3}v.9M${x + 1.3} ${y - 2.4}l-.3.8" stroke="#D9C6A2" stroke-width=".5" stroke-linecap="round"/>`;
const dumplingsSvg = `<g class="feast-only">
  <ellipse cx="42" cy="28.4" rx="5.8" ry="1.4" fill="#FFF6EE"/><ellipse cx="42" cy="28.4" rx="3.8" ry=".7" fill="none" stroke="#2F5DA8" stroke-width=".35"/>
  ${dumpling(39.6, 27.8)}${dumpling(44.4, 27.8)}${dumpling(42, 28.6)}
</g>`;

// The dragon hat (the user asked, in place of a New Year cap): a red dragon's head worn as a hat, with gold antlers, a
// gold mane along the top, big cartoon eyes, a gold snout for the band with two nostrils, little fangs hanging over the
// forehead, and whiskers curling out the sides. Same 100 × 90 as the other hats, the snout band's middle at (50, 74).
const dragonHatSvg = `<svg class="hat" viewBox="0 0 100 90" aria-hidden="true">
  <path d="M35 32C30 22 26 14 21 4M28 18l-9 1M65 32c5-10 9-18 14-28M72 18l9 1" fill="none" stroke="#E0A21B" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M18 52l-6-12 10 2-3-14 11 6 1-14 9 9 10-14 10 14 9-9 1 14 11-6-3 14 10-2-6 12z" fill="#F2B630"/>
  <path d="M30 18l-3 1.5M33 26l-3 1M70 18l3 1.5M67 26l3 1" stroke="#B07A12" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M30 36l-6-6M38 30l-2-8M50 29v-10M62 30l2-8M70 36l6-6" fill="none" stroke="#D9981C" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M12 68C12 40 29 26 50 26s38 14 38 42z" fill="#C7233A"/>
  <path d="M19 58c1-14 10-24 22-28" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>
  <path d="M26 58a5 5 0 0 1 10 0M42 58a5 5 0 0 1 10 0M58 58a5 5 0 0 1 10 0M34 48a5 5 0 0 1 10 0M50 48a5 5 0 0 1 10 0M42 38a5 5 0 0 1 10 0"
    fill="none" stroke="#A11B2F" stroke-width="1.4"/>
  <path d="M26 39c3-4 9-4 12 0M62 39c3-4 9-4 12 0" fill="none" stroke="#F2C14E" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="32" cy="48" rx="7.5" ry="8.5" fill="#FFFDF8"/><ellipse cx="68" cy="48" rx="7.5" ry="8.5" fill="#FFFDF8"/>
  <circle cx="33.5" cy="50" r="4.2" fill="#2A2033"/><circle cx="66.5" cy="50" r="4.2" fill="#2A2033"/>
  <circle cx="35" cy="48.4" r="1.4" fill="#fff"/><circle cx="68" cy="48.4" r="1.4" fill="#fff"/>
  <path d="M9 72c-7-3-11 3-7 7s8-1 4-3M91 72c7-3 11 3 7 7s-8-1-4-3" fill="none" stroke="#E0A21B" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M20 84l3 5.5 3-5.5zM74 84l3 5.5 3-5.5zM36 84l2 3.5 2-3.5zM60 84l2 3.5 2-3.5z" fill="#FFFDF8"/>
  <rect x="8" y="64" width="84" height="20" rx="10" fill="#F2B630"/><path d="M14 80h72" stroke="#D9981C" stroke-width="2" stroke-linecap="round"/>
  <path d="M16 67.4h68" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M24 71v6M32 70v8M68 70v8M76 71v6" stroke="#D9981C" stroke-width=".9" stroke-linecap="round"/>
  <ellipse cx="42" cy="72" rx="3" ry="2.2" fill="#A86E12"/><ellipse cx="58" cy="72" rx="3" ry="2.2" fill="#A86E12"/>
</svg>`;

// Hangs the envelopes and sets the classes; renderStatus calls it with setXmas. New ones pop in, as do ones turning gold.
let shownHb = null;
function setCny(days, goal) {
  const feedEl = $('.feed');
  if (!feedEl) return;
  const c = cnyNow();
  feedEl.classList.toggle('cny', c.on);
  feedEl.classList.toggle('feast', c.feast);
  if (!c.on) { shownHb = null; return; }
  const got = cnyDays(days, goal, c.year);
  $('#envelopes').innerHTML = got.map((o, i) => envelopeSvg(i, o.gold)).join('');
  if (shownHb && !reducedMotion()) got.forEach((o, i) => {
    if (i < shownHb.length && (o.gold === shownHb[i].gold || !o.gold)) return;
    pop($(`.hb[data-i="${i}"]`), 0);
  });
  shownHb = got;
}

// ---------- Halloween (the user asked): all of October ----------
// Orange lights on the mantel with a spider bobbing on a thread from its underside, above the fire; bats flap past an
// orange moon in the window after dark; a marshmallow ghost floats in the cocoa; the pal wears a witch hat. The plant is
// put away for a dark table with a tattered, cobwebby runner and a big pumpkin on it that gets carved, one cut every 4
// goal days (the user picked a cat on the moon): the lid, the crescent moon, the cat's body, its head, its tail, then
// three stars. At 28 goal days a candle lights inside, and it always lights on Halloween itself. Under the table, a small
// jack-o'-lantern for every 3 goal days (10 at most; the user found 31 too many), gold if one of its days was stuffed.
// On the 31st a candy bowl sits on the side table and a stuffed pal "is stuffed on candy!" (the user's words).
function halloweenNow(now = new Date()) {
  const m = now.getMonth(), d = now.getDate();
  return { on: m === 9, hday: m === 9 && d === 31, year: now.getFullYear() };
}
// The days that count: October 1–31 of that year, goal met, up to today.
function halloweenDays(days, goal, year) {
  const out = [];
  for (let i = 1; i <= 31; i++) {
    const d = iso(new Date(year, 9, i));
    if (d > today()) break;
    const e = days.get(d);
    if (berriesOn(e) >= goal) out.push({ day: d, gold: isStuffed(e, goal) });
  }
  return out;
}
const CARVE_EVERY = 4, LIT_AT = 28, JACK_EVERY = 3;

// The carving, in table units (the pumpkin's middle is at 114, 22). Each cut is drawn in the hole color: dark flesh
// before the candle, candlelight after. The moon is a crescent (a circle with a circle masked out of it), opening up
// and to the right; the cat sits in its hollow on the lower horn, its tail coming out of the moon.
const star4 = (x, y, r) => `M${x} ${y - r}L${x + r * .3} ${y - r * .3} ${x + r} ${y} ${x + r * .3} ${y + r * .3} ${x} ${y + r} ${x - r * .3} ${y + r * .3} ${x - r} ${y} ${x - r * .3} ${y - r * .3}z`;
const CUTS = [
  h => `<path d="M104.9 10.4l2.6-2 2.6 2 2.6-2 2.6 2 2.6-2 2.6 2 2.6-2" fill="none" stroke="${h}" stroke-width="1" stroke-linejoin="round"/>`,   // the lid
  () => `<circle cx="112" cy="24" r="10" mask="url(#hwMoon)"/>`,                                                       // the moon
  () => `<ellipse cx="116.8" cy="25.6" rx="2.6" ry="3.4"/>`,                                                         // the cat's body
  () => `<circle cx="117.8" cy="20.8" r="2.2"/><path d="M115.9 20.2l.3-3.1 1.9 1.7zM119.7 20.2l-.3-3.1-1.9 1.7z"/>`,  // its head and ears
  h => `<path d="M114.6 28.4c-2.6.2-3.6-1.6-2.4-3.8" fill="none" stroke="${h}" stroke-width="1.1" stroke-linecap="round"/>`,   // its tail
  () => `<path d="${star4(100, 13, 2.4)}${star4(127.5, 12, 2)}${star4(129, 27, 1.8)}"/>`,                            // three stars
];
function carvingSvg(cuts, lit) {
  const h = lit ? '#FFD36B' : '#5A2A10';
  return `<g class="carving ${lit ? 'lit' : ''}" fill="${h}" ${lit ? 'filter="url(#hwGlow)"' : ''}>
    ${CUTS.slice(0, cuts).map((c, i) => `<g class="cut" data-i="${i}">${c(h)}</g>`).join('')}</g>`;
}

// Small jack-o'-lanterns on the floor under the table: [x, bottom, scale]. A front row of 6 and a smaller back row of 4,
// filled from the middle out, back and front mixed so it never looks lopsided.
const JACK_SPOTS = [[92, 72, 1], [108, 72, 1], [100, 66.5, .8], [76, 72, 1], [124, 72, 1], [84, 66.5, .8], [116, 66.5, .8],
  [60, 72, 1], [138, 72, 1], [68, 66.5, .8]];
const JACK_FACES = [
  '<path d="M-2.6-6.4l1-1.8 1 1.8zM.6-6.4l1-1.8 1 1.8z"/><path d="M-3-4.2c1.6 2.4 4.4 2.4 6 0-.8.5-1.4.2-1.8.7l-.6-.7-.6.8-.6-.8-.6.8c-.6-.3-1.2-.4-1.8-.8z"/>',
  '<circle cx="-1.6" cy="-6.4" r=".9"/><circle cx="1.6" cy="-6.4" r=".9"/><ellipse cx="0" cy="-3.4" rx="1" ry="1.3"/>',
  '<path d="M-2.8-7.4l2 1.1v1h-2zM2.8-7.4l-2 1.1v1h2z"/><path d="M-3-4l1 .8 1-.8 1 .8 1-.8 1 .8v1.4l-1-.8-1 .8-1-.8-1 .8-1-.8z"/>',
  '<path d="M-2.6-6.2q.8-1.2 1.6 0M1-6.2q.8-1.2 1.6 0" fill="none" stroke="#FFD36B" stroke-width=".7"/><path d="M-2.6-4.4h5.2a2.6 2.2 0 0 1-5.2 0z"/>',
];
function jackSvg(i, gold) {
  const [x, b, k] = JACK_SPOTS[i], body = gold ? '#F2B630' : '#E8812E', side = gold ? '#D9981C' : '#C9621E';
  return `<g transform="translate(${x} ${b}) scale(${k})"><g class="jack" data-i="${i}">
    <ellipse cx="0" cy="0" rx="9" ry="1.8" fill="#FFB13B" opacity=".22"/>
    <ellipse cx="-3" cy="-5" rx="3.6" ry="5" fill="${side}"/><ellipse cx="3" cy="-5" rx="3.6" ry="5" fill="${side}"/>
    <ellipse cx="0" cy="-5.1" rx="3.6" ry="5.1" fill="${body}"/>
    <path d="M-2.4-9.4q-1.8 4.3 0 8.6M2.4-9.4q1.8 4.3 0 8.6" fill="none" stroke="#000" stroke-opacity=".15" stroke-width=".4"/>
    <path d="M-6.4-2.6c1.6 2 4 2.6 6.4 2.6s4.8-.6 6.4-2.6c-1.8 1-4 1.4-6.4 1.4s-4.6-.4-6.4-1.4z" fill="#000" opacity=".15"/>
    <path d="M-.6-9.9l.3-1.8h1.2l-.2 1.8z" fill="#5C6B2E"/>
    <g class="jack-face" fill="#FFD36B" style="animation-delay:${-(i * 7 % 5) * .53}s">${JACK_FACES[i % JACK_FACES.length]}</g>
    ${gold ? `<path class="orn-spark" d="M5.5-11l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#FFE7A0"/>` : ''}</g></g>`;
}

// Halloween only: a heaped bowl of candy on the table, left of the big pumpkin (the user asked: it was small on the side
// table): candy corn and wrapped candies over a black bowl with an orange band. Table units; the tabletop is y 37.
const candyCorn = (x, y, r) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 1.8} ${y}l1.8-4.8 1.8 4.8z" fill="#F08A24"/>
  <path d="M${x - 1.8} ${y}h3.6l-.45-1.2h-2.7z" fill="#F2C14E"/><path d="M${x - .6} ${y - 3.3}l.6-1.5.6 1.5z" fill="#FFFDF8"/></g>`;
const wrapped = (x, y, c) => `<path d="M${x - 3.9} ${y - 1.3}l1.8 1.3-1.8 1.3zM${x + 3.9} ${y - 1.3}l-1.8 1.3 1.8 1.3z" fill="${c}"/>
  <circle cx="${x}" cy="${y}" r="2.1" fill="${c}"/><path d="M${x - 1.4} ${y + 1.3}l2.8-2.6" stroke="#fff" stroke-opacity=".35" stroke-width=".5"/>
  <path d="M${x - 2.4} ${y - .8}v1.6M${x + 2.4} ${y - .8}v1.6" stroke="#000" stroke-opacity=".25" stroke-width=".4"/>
  <circle cx="${x - .7}" cy="${y - .7}" r=".6" fill="#fff" opacity=".5"/>`;
const candyBowlSvg = `<g class="hday-only">
  ${wrapped(68, 28.4, '#7A4A8A')}${candyCorn(73.2, 29, -12)}${wrapped(79.4, 28.2, '#4E9A5B')}${candyCorn(70.6, 26.4, 16)}
  ${candyCorn(76.4, 26, -4)}${wrapped(73.8, 24.8, '#C7334F')}${candyCorn(81.6, 28.6, 20)}
  <path d="M63.6 28.6h20.8c0 5-4.6 7.6-10.4 7.6s-10.4-2.6-10.4-7.6z" fill="#2A2033"/>
  <path d="M64.4 31.4h19.2q-.5 1.2-1.4 2.2H65.8q-.9-1-1.4-2.2z" fill="#E07A24"/>
  <path d="M65.4 32.9${Array.from({ length: 8 }, (_, i) => `l1.1-.9 1.1.9`).join('')}" fill="none" stroke="#2A2033" stroke-width=".4"/>
  <path d="M65.6 29.6q.6 2.8 2.8 4.4" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width=".8" stroke-linecap="round"/>
  <path d="M63.6 28.6h20.8" stroke="#3B2A4F" stroke-width="1" stroke-linecap="round"/>
  <path d="M70 36.2h8l.8.8h-9.6z" fill="#2A2033"/>
</g>`;

// The table: dark wood, one leg showing (the other is off the right edge), a cobweb in the corner under the top, and a
// grey gauze runner hanging over the front edge in tatters with strands of web trailing from it. Table units 148 × 72,
// like the harvest table; nothing starts left of x 40, so the fireplace (a layer above the room) hides none of it.
const hwTableSvg = `<svg class="hw-table halloween-only" viewBox="0 0 148 72">
  <defs><mask id="hwMoon"><circle cx="112" cy="24" r="10" fill="#fff"/><circle cx="116.5" cy="20" r="8.6" fill="#000"/></mask>
    <filter id="hwGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect x="40" y="69.4" width="160" height="4.4" rx="2.2" fill="#000" opacity=".2"/>
  <g id="jacksBack"></g>
  <rect x="46" y="43" width="5" height="29" fill="#3E2A22"/><rect x="45" y="66" width="7" height="6" rx="1" fill="#33221C"/>
  <path d="M51 43.6h14M51 43.6l13 6M51 43.6l9 10.6M51 43.6v14M53.6 43.6q-.6 2.2-2.6 2.6M57.4 43.6q-1 4.2-6.4 5M61.6 43.6q-1.6 6.6-10.6 7.4"
    fill="none" stroke="#D9D4CC" stroke-width=".35" opacity=".85"/>
  <path d="M43 33.4h160V37H40z" fill="#5A3E30"/><path d="M58.4 33.4h150V37H56z" fill="#C9C3BA" opacity=".88"/>
  <path d="M46 35.2h8M60 35.4c14-.4 30 .3 46 0" fill="none" stroke="#2E1F18" stroke-width=".4"/>
  <rect x="40" y="37" width="160" height="7" rx="1" fill="#4A3328"/><path d="M40 37.4h160" stroke="#6B4C3A" stroke-width=".8"/>
  <path d="M42 40c14-.8 26 .6 40-.2M44 42.4c10 .4 18-.4 30 .2M40 41.2c4 0 7-.3 9-.1" fill="none" stroke="#2E1F18" stroke-width=".5"/>
  <path d="M49.6 44v28" stroke="#000" stroke-opacity=".25" stroke-width="1.4"/>
  <path d="M56 37h150v9.5l-3 2.6-2.4-2.4-3.2 3.4-2-2.8-3 3.6-2.6-3.4-2.4 2.4-3-2.8-3.2 4-2.2-3.4-3 2.6-2.6-2.8-2.6 3.4-3.2-3-2.4 2.4-2.6-3.2-3 3.8-2.4-3.4-2.8 2.4-3-2.6-2.4 3.4-3-3.2-2.6 2.6-2.4-2.4-3.2 3.2-2.2-3.2-3 2.8-2.6-2.4-2.8 3.6-2.4-3.6-3.2 2.4-2.4-2.6-2.6 3.2-3-3z"
    fill="#C9C3BA" opacity=".88"/>
  <path d="M66 49.2q.6 4-.8 7M83 50.4q-.4 3.4.8 5.6M101 49.6q.8 3.6 0 6.4M126 50.2q-.6 3 .4 5" fill="none" stroke="#D9D4CC" stroke-width=".35" opacity=".8"/>
  <ellipse class="pk-halo" cx="114" cy="22" rx="30" ry="24" fill="#FFB13B" opacity=".18"/>
  <ellipse cx="114" cy="39.2" rx="23" ry="2.2" fill="rgb(0 0 0 / .2)"/>
  <path d="M113.2 6.4l-.8-5.4 2.8-.6.6 6z" fill="#5C6B2E"/>
  <ellipse cx="100" cy="22" rx="12" ry="16.5" fill="#C9621E"/><ellipse cx="128" cy="22" rx="12" ry="16.5" fill="#C9621E"/>
  <ellipse cx="107" cy="22" rx="12" ry="17.4" fill="#E0762A"/><ellipse cx="121" cy="22" rx="12" ry="17.4" fill="#E0762A"/>
  <ellipse cx="114" cy="22" rx="10" ry="17.8" fill="#EE8A34"/>
  <path d="M107 5.4q-5 16.6 0 33.2M121 5.4q5 16.6 0 33.2M100 6.6q-9 15.4 0 30.8M128 6.6q9 15.4 0 30.8" fill="none" stroke="#B8521A" stroke-width=".7" opacity=".7"/>
  <path d="M89 26c2 9 12 13.6 25 13.6s23-4.6 25-13.6c-4 7-12 10-25 10s-21-3-25-10z" fill="#000" opacity=".15"/>
  <path d="M95 14q-1.6 4 0 10" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".25"/>
  <path d="M112.4 8.6q-1 4 0 8M116 8.6q1 3 0 6" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".2"/>
  <path d="M113.6 6l-.6-4.6M114.6 6l-.2-4.8" stroke="#3E4A1E" stroke-width=".4"/>
  <path d="M115.8 1.6c2-1.6 4.6-.8 4.2 1.2-.3 1.4-2 1.2-1.8.2" fill="none" stroke="#5C6B2E" stroke-width=".6" stroke-linecap="round"/>
  <g id="carving"></g>${candyBowlSvg}
  <g id="jacksFront"></g>
</svg>`;

// Orange lights in swags along the mantel on a thin dark wire (the user asked), twinkling like the Christmas ones. Fireplace units.
const hwLightsSvg = (() => {
  const ends = [7, 41, 75, 109, 143], lights = [], colors = ['#FF8A2A', '#FFB13B'];
  let path = `M${ends[0]} 15`;
  for (let s = 0; s < 4; s++) {
    const a = ends[s], b = ends[s + 1];
    path += ` Q${(a + b) / 2} 24 ${b} 15`;
    for (const t of [.2, .5, .8]) lights.push([a + (b - a) * t, 15 + 18 * t * (1 - t)]);
  }
  return `<g class="halloween-only">
    <path d="${path}" fill="none" stroke="#2A2033" stroke-width=".9"/>
    <g class="lights">${lights.map(([x, y], i) => `<g style="--c:${colors[i % 2]}; animation-delay:${(-(i * 7) % 5) * .37}s">
      <circle class="halo" cx="${x.toFixed(1)}" cy="${(y + 1.8).toFixed(1)}" r="3.2"/><ellipse cx="${x.toFixed(1)}" cy="${(y + 1.8).toFixed(1)}" rx="1.3" ry="1.7"/></g>`).join('')}</g>
  </g>`;
})();

// A spider on a thread from the underside of the mantel, above the fire (the user asked), bobbing slowly up and down:
// the spider moves and its thread stretches with it. Fireplace units: the mantel's bottom is y 16.
const SPIDER_LEGS = 'M90.6 37.6q-2.6-2.4-4.8-.4M90.2 38.8q-3-1.2-5 .8M90.2 40q-2.8.2-4.4 2.8M90.6 41q-2 1.4-2.8 3.8';
const spiderSvg = `<g class="halloween-only">
  <path class="spider-thread" d="M92 16v19" stroke="#D9D4CC" stroke-width=".45"/>
  <g class="spider">
    <path d="${SPIDER_LEGS}" fill="none" stroke="#2A2033" stroke-width=".75" stroke-linecap="round"/>
    <path d="${SPIDER_LEGS}" transform="matrix(-1 0 0 1 184 0)" fill="none" stroke="#2A2033" stroke-width=".75" stroke-linecap="round"/>
    <circle cx="92" cy="39.4" r="2.9" fill="#2A2033"/><circle cx="92" cy="36" r="1.7" fill="#2A2033"/>
    <circle cx="91.3" cy="36.3" r=".4" fill="#fff"/><circle cx="92.7" cy="36.3" r=".4" fill="#fff"/>
    <circle cx="91" cy="38.4" r=".9" fill="#fff" opacity=".2"/><path d="M92 38.4v2.4M90.9 39.5h2.2" stroke="#E07A24" stroke-width=".5" stroke-linecap="round"/>
  </g>
</g>`;

// A bat for the October window (the user asked), seen side-on and facing right, the way it flies: the head and ears at the
// front, the near wing and a fainter far wing swept back from the shoulder, beating down through the body and back up
// (the wings' base is y 0). The first one was seen from the front, so it looked like it flapped toward you while moving
// sideways (the user saw it).
const BAT_WING = 'M1.2 0C.4-2.2-1.8-3.6-5-3.8c.6.8.6 1.6.1 2.2 1-.1 1.6.4 1.4 1.3.9-.3 1.6 0 1.7.3z';
const batSvg = `<i><svg viewBox="-6 -4.4 10.4 7.4"><g class="wings"><path d="${BAT_WING}" transform="translate(-.9 -.3)" opacity=".55"/><path d="${BAT_WING}"/><path d="M.6-.2C-.6-1.6-2.4-2.4-4.2-2.8M.4 0c-1.2-.8-2.4-.9-3.4-.6" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".25"/></g>
  <ellipse cx="-.2" cy=".6" rx="2.6" ry="1.1"/><circle cx="2.6" cy=".2" r="1.05"/><path d="M2.1-.5l.1-1.3.7 1zM2.9-.4l.4-1.2.4 1.1z"/><circle cx="3.1" cy=".05" r=".28" fill="#FFB13B"/></svg></i>`;

// A marshmallow ghost floating in the cocoa: drawn over it, with a little cocoa in front so it sits in the drink. Side-table units.
const ghostSvg = `<g class="halloween-only">
  <path d="M21.9 15.8v-4.4a2.6 2.6 0 0 1 5.2 0v4.4z" fill="#FFFDF8"/>
  <circle cx="23.5" cy="11.6" r=".5" fill="#2A2033"/><circle cx="25.5" cy="11.6" r=".5" fill="#2A2033"/>
  <ellipse cx="24.5" cy="13.4" rx=".5" ry=".7" fill="#2A2033"/>
  <path d="M26.2 11.4v4.4h.9v-4.4a2.6 2.6 0 0 0-1.5-2.3c.4.6.6 1.4.6 2.3z" fill="#000" opacity=".08"/>
  <circle cx="22.8" cy="12.6" r=".45" fill="#F2A0A8" opacity=".7"/><circle cx="26.2" cy="12.6" r=".45" fill="#F2A0A8" opacity=".7"/>
  <path d="M21.4 15.4q1.4.8 3.1.8t3.1-.8v.6q-1.4.8-3.1.8t-3.1-.8z" fill="#6B3A22"/>
</g>`;
// The witch hat (the user asked): a tall bent cone over a wide brim, an orange band with a gold buckle. Same 100 × 90 as
// the other hats; the brim's middle is at (50, 74), where the Santa hat's fur band sits, so one placement fits all.
const witchHatSvg = `<svg class="hat" viewBox="0 0 100 90" aria-hidden="true">
  <path d="M26 70C32 50 40 32 52 18c4-5 11-9 19-10-4 4-6 8-7 13 2 16 6 32 10 49z" fill="#3B2A4F"/>
  <path d="M64 21c2 16 6 32 10 49H62c2-16 2-33 2-49z" fill="#2E2040"/>
  <path d="M38 52c4-2 8-1 11 1M44 38c3-1 6 0 8 2M54 26c2 0 4 1 5 3" fill="none" stroke="#1F1530" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M33 62c5-18 13-34 24-46" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M46 42l9-1.4 1.2 8.6-9 1.2z" fill="#5A4372"/><path d="M47.2 43.2l7-1.1M48.4 49l7-1M47.6 43.6l.8 5.2M54.4 42.4l.8 5.4" fill="none" stroke="#C9A6E8" stroke-width=".5" stroke-dasharray="1 .8"/>
  <ellipse cx="50" cy="74" rx="47" ry="9" fill="#2E2040"/><ellipse cx="50" cy="72.6" rx="38" ry="5.4" fill="#3B2A4F"/>
  <path d="M5 75.4c16 5 74 5 90 0" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M27.4 62h46.2l1.8 9.2C64 73.6 36 73.6 25.4 71.2z" fill="#E07A24"/>
  <path d="M28 63.6h45M26.6 69.6c11 2.4 37 2.4 48 0" fill="none" stroke="#9C4A12" stroke-width=".6" stroke-dasharray="1.6 1.2"/>
  <rect x="43.5" y="61" width="13" height="11" rx="1.5" fill="none" stroke="#F2C14E" stroke-width="2.6"/>
  <path d="M44.4 62.6h4" stroke="#fff" stroke-opacity=".6" stroke-width="1" stroke-linecap="round"/>
</svg>`;

// Carves the pumpkin, sets out the jack-o'-lanterns, and sets the classes; renderStatus calls it with setXmas. A new cut
// or lantern pops in with sparkles, and so does a lantern turning gold; one losing its gold (an Undo) just changes.
let shownJack = null, shownCuts = null;
function setHalloween(days, goal) {
  const feedEl = $('.feed');
  if (!feedEl) return;
  const h = halloweenNow();
  feedEl.classList.toggle('halloween', h.on);
  feedEl.classList.toggle('hday', h.hday);
  if (!h.on) { shownJack = shownCuts = null; return; }
  const got = halloweenDays(days, goal, h.year), n = got.length;
  const cuts = Math.min(CUTS.length, Math.floor(n / CARVE_EVERY)), lit = n >= LIT_AT || h.hday;
  $('#carving').innerHTML = carvingSvg(cuts, lit);
  $('.hw-table').classList.toggle('lit', lit);
  const jacks = Array.from({ length: Math.min(JACK_SPOTS.length, Math.floor(n / JACK_EVERY)) },
    (_, i) => ({ gold: got.slice(i * JACK_EVERY, (i + 1) * JACK_EVERY).some(o => o.gold) }));
  const row = back => jacks.map((o, i) => (JACK_SPOTS[i][2] < 1) === back ? jackSvg(i, o.gold) : '').join('');
  $('#jacksBack').innerHTML = row(true);
  $('#jacksFront').innerHTML = row(false);
  if (shownJack && !reducedMotion()) {
    jacks.forEach((o, i) => {
      if (i < shownJack.length && (o.gold === shownJack[i].gold || !o.gold)) return;
      pop($(`.jack[data-i="${i}"]`), 0);
    });
    for (let i = shownCuts; i < cuts; i++) pop($(`.cut[data-i="${i}"]`), 200);
  }
  shownJack = jacks;
  shownCuts = cuts;
}
