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
  if (kind === 'berry') return `<g class="orn" data-i="${i}">${thread}<circle cx="${x}" cy="${y}" r="3.1" fill="#D93A55"/>
    <path d="M${x} ${y - 3}c.6-1.4 2-1.9 3.3-1.6-.3 1.3-1.7 2.2-3.3 1.6z" fill="#4E9A5B"/><circle cx="${x - 1.1}" cy="${y - 1}" r=".8" fill="#fff" opacity=".6"/></g>`;
  const fill = kind === 'gold' ? '#F2B630' : kind;
  return `<g class="orn ${kind === 'gold' ? 'gold' : ''}" data-i="${i}">${thread}<rect x="${x - 1}" y="${y - 4.1}" width="2" height="1.4" rx=".3" fill="#C98A12"/>
    <circle cx="${x}" cy="${y}" r="3.1" fill="${fill}"/><circle cx="${x - 1.1}" cy="${y - 1.1}" r=".85" fill="#fff" opacity=".7"/>
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
  return `<g class="gift" data-i="${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="${box}"/>
    <rect x="${cx - rw / 2}" y="${y}" width="${rw}" height="${h}" fill="${rib}"/><rect x="${x}" y="${y + h * .4}" width="${w}" height="${rw}" fill="${rib}"/>
    <ellipse cx="${cx - bw * .9}" cy="${y - bh * .75}" rx="${bw}" ry="${bh}" fill="${rib}"/><ellipse cx="${cx + bw * .9}" cy="${y - bh * .75}" rx="${bw}" ry="${bh}" fill="${rib}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="none" stroke="rgb(0 0 0 / .12)" stroke-width=".5"/></g>`;
}
// Drawn back to front, so a present in front overlaps the one behind it. The ones behind the tree go in their own
// group, drawn before it.
const GIFT_DRAW = GIFT_SPOTS.map((s, i) => i).sort((a, b) => GIFT_SPOTS[a][3] - GIFT_SPOTS[b][3]);

const xmasTreeSvg = `<svg class="xmas-tree xmas-only" viewBox="-70 0 150 150">
  <g id="giftsBack"></g><rect x="36" y="86" width="8" height="8" fill="#6B4128"/>
  <path d="M40 44 8 88h64z" fill="var(--plant)"/><path d="M40 24 16 60h48z" fill="var(--plant-2)"/><path d="M40 8 24 36h32z" fill="var(--plant)"/>
  <path d="M40 44 8 88h18zM40 24 16 60h14zM40 8 24 36h9z" fill="rgb(0 0 0 / .08)"/>
  <path d="M24 92h32l-4 18H28z" fill="var(--pot)"/>
  <path class="tree-star" d="M40 .5l2.1 4.4 4.8.6-3.5 3.3.9 4.8-4.3-2.3-4.3 2.3.9-4.8-3.5-3.3 4.8-.6z" fill="#F2C14E"/>
  <g id="ornaments"></g><g id="gifts"></g>
</svg>`;

// The mantel: a garland in swags with small lights, hung over two stockings (toes pointing out). Fireplace units.
const STOCKING = 'M1.5 5h11v15c0 2 1.5 3 3.5 3.5l3 .7c2.5.6 3.3 2.3 2.8 4-.5 1.8-2.3 2.7-4.3 2.3L7 28.5C3.5 27.8 1.5 25.5 1.5 22z';
const stocking = (tf, body, band) => `<g transform="${tf}"><path d="${STOCKING}" fill="${body}"/><path d="M1.5 13h11v3h-11z" fill="${band}"/>
  <rect width="14" height="6.5" rx="2.5" fill="#FFF6EE"/></g>`;
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
    <g class="lights">${lights.map(([x, y], i) => `<g style="--c:${colors[i % 4]}; animation-delay:${(-(i * 7) % 5) * .37}s">
      <circle class="halo" cx="${x.toFixed(1)}" cy="${(y + 1.6).toFixed(1)}" r="3.4"/><circle cx="${x.toFixed(1)}" cy="${(y + 1.6).toFixed(1)}" r="1.5"/></g>`).join('')}</g>
  </g>`;
})();

// A wreath hung over the picture: a green ring with red berries and a bow at the bottom. Picture units (46 × 58).
const wreathSvg = `<g class="xmas-only">
  <circle cx="23" cy="27" r="12" fill="none" stroke="#2F6B3C" stroke-width="6"/>
  <circle cx="23" cy="27" r="12" fill="none" stroke="#4E9A5B" stroke-width="3" stroke-dasharray="3 2.6"/>
  ${[20, 75, 140, 200, 250, 310].map(a => a * Math.PI / 180).map(a => `<circle cx="${(23 + 12 * Math.cos(a)).toFixed(1)}" cy="${(27 + 12 * Math.sin(a)).toFixed(1)}" r="1.5" fill="#D93A55"/>`).join('')}
  <path d="M23 39l-6-3.5v7zM23 39l6-3.5v7z" fill="#C7334F"/><path d="M22 39l-3 7h2.4l1.6-4zM24 39l3 7h-2.4L23 42z" fill="#A82A43"/>
  <circle cx="23" cy="39" r="1.8" fill="#A82A43"/>
</g>`;

// In the cocoa: a candy cane leaning in it, resting on the mug's right lip with its hook hanging over the outside (the
// user asked: standing straight up looked wrong), pulled a little out of the cup. Drawn before the mug, so the mug and
// the cocoa hide its lower end.
const CANE = 'M21 25V10a2.6 2.6 0 0 1 5.2 0v1.4';   // drawn upright from its foot in the cup, then tipped 30° (the user picked it)
const caneSvg = `<g class="xmas-only" transform="translate(1.5 -2.6) rotate(30 21 25)">   <!-- slid 3 units out along its length (the user asked) -->
  <path d="${CANE}" fill="none" stroke="#FFF6EE" stroke-width="1.7" stroke-linecap="round"/>
  <path d="${CANE}" fill="none" stroke="#D93A55" stroke-width="1.7" stroke-dasharray="1.1 1.1"/>
</g>`;
const cocoaSvg = `<g class="xmas-only">
  <rect x="19.6" y="13.4" width="3" height="2.6" rx=".8" fill="#FFFDF8" transform="rotate(-12 21 14.7)"/>
  <rect x="23" y="13" width="3" height="2.6" rx=".8" fill="#FFFDF8" transform="rotate(8 24.5 14.3)"/>
  <rect x="25.6" y="14" width="2.6" height="2.2" rx=".7" fill="#F4ECE0"/>
</g>`;

// The Santa hat. Its fur band's middle is at (50, 74) of 100 × 90; settings.hat places that point on the photo.
const hatSvg = `<svg class="hat" viewBox="0 0 100 90" aria-hidden="true">
  <path d="M14 70C18 38 40 13 64 10c15-2 25 8 27 24l-8 3c-3-9-9-12-15-8 6 13 12 26 16 41z" fill="#C7334F"/>
  <path d="M68 29c6 13 12 26 16 41H62C66 56 68 42 68 29z" fill="#A82A43"/>
  <circle cx="88" cy="38" r="9" fill="#FFF6EE"/><circle cx="91" cy="41" r="4.5" fill="#EDE3D6"/>
  <rect x="6" y="63" width="88" height="22" rx="11" fill="#FFF6EE"/>
  <path d="M14 78h72" stroke="#EDE3D6" stroke-width="5" stroke-linecap="round"/>
</svg>`;
// The fox drawing's own spot: between its ears, tilted a little.
const FOX_HAT = { x: .42, y: .2, w: .5, r: -8 };

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
    if (i < shownOrn.length && o.gold === shownOrn[i].gold) return;
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
