// ---------- Home: this year's draw and past years ----------

// A draw shown but not saved yet: {year, picks: [{kid_id, adult_id}], repeats}. Drawing again replaces it; leaving the page drops it.
let pending = null;

const byName = (a, b) => a.name.localeCompare(b.name);
const randInt = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Every kid goes to one adult, and the adults' counts differ by at most one (like the old Python script).
// last: kid id → the adult who had them in the latest saved year before this one. Each try deals the kids out in a random
// order, giving each to a random adult with room who didn't have them last year when it can; the try with the fewest
// repeats wins (almost always none).
function drawPicks(adults, kids, last) {
  let best = null;
  for (let t = 0; t < 200 && best?.repeats !== 0; t++) {
    const room = new Map();
    shuffle(adults).forEach((a, i) => room.set(a.id, Math.floor(kids.length / adults.length) + (i < kids.length % adults.length ? 1 : 0)));
    const picks = [];
    let repeats = 0;
    for (const kid of shuffle(kids)) {
      const open = adults.filter(a => room.get(a.id) > 0);
      const fresh = open.filter(a => a.id !== last.get(kid.id));
      const adult = (fresh.length ? fresh : open)[randInt((fresh.length ? fresh : open).length)];
      room.set(adult.id, room.get(adult.id) - 1);
      if (adult.id === last.get(kid.id)) repeats++;
      picks.push({ kid_id: kid.id, adult_id: adult.id });
    }
    if (!best || repeats < best.repeats) best = { picks, repeats };
  }
  return best;
}

// The adults with their kids, for a year's picks. People who left the draw since still show, by name.
function pickGroups(picks, people, last = new Map()) {
  const who = new Map(people.map(p => [p.id, p]));
  const groups = new Map();
  for (const p of picks) {
    if (!groups.has(p.adult_id)) groups.set(p.adult_id, []);
    groups.get(p.adult_id).push({ kid: who.get(p.kid_id), repeat: last.get(p.kid_id) === p.adult_id });
  }
  return [...groups].map(([id, kids]) => ({ adult: who.get(id), kids: kids.sort((a, b) => byName(a.kid, b.kid)) }))
    .sort((a, b) => byName(a.adult, b.adult));
}

function groupsHTML(groups, { animate = false } = {}) {
  let i = 0;
  return `<div class="groups">${groups.map(g => `<div class="group">
      <div class="group-head"><b>${esc(g.adult.name)}</b><span class="muted">${plural(g.kids.length, 'kid')}</span></div>
      <div class="kids">${g.kids.map(k => `<span class="kid${k.repeat ? ' repeat' : ''}${animate ? ' pop' : ''}"${animate ? ` style="--i:${i++}"` : ''}
        ${k.repeat ? 'title="Same as last year"' : ''}>${esc(k.kid.name)}</span>`).join('')}</div>
    </div>`).join('')}</div>`;
}

// "Christmas 2026" and one line per adult, for a family chat.
function pickText(year, groups) {
  return `Christmas ${year}\n` + groups.map(g => `${g.adult.name}: ${g.kids.map(k => k.kid.name).join(', ')}`).join('\n');
}

async function homePage() {
  const token = ++navToken;
  view(loading);
  const [people, picks] = await Promise.all([
    sb.from('xmas_people').select('id, name, kind, active').then(must),
    sb.from('xmas_picks').select('year, kid_id, adult_id, saved_at').order('year', { ascending: false }).then(must),
  ]);
  if (token !== navToken) return;
  const year = thisYear();
  const adults = people.filter(p => p.kind === 'adult' && p.active).sort(byName);
  const kids = people.filter(p => p.kind === 'kid' && p.active).sort(byName);
  const years = [...new Set(picks.map(p => p.year))];
  const saved = picks.filter(p => p.year === year);
  const lastYear = years.find(y => y < year);
  const last = new Map(picks.filter(p => p.year === lastYear).map(p => [p.kid_id, p.adult_id]));
  if (pending?.year !== year) pending = null;

  const ready = adults.length && kids.length;
  const each = ready ? (kids.length % adults.length ? `${Math.floor(kids.length / adults.length)}–${Math.ceil(kids.length / adults.length)}` : kids.length / adults.length) : 0;
  const lastNote = lastYear ? `Avoids giving anyone a kid they had in ${lastYear}.` : '';

  let main;
  if (pending) {
    const groups = pickGroups(pending.picks, people, last);
    main = `<div class="card hero-card">
      <div class="row between wrap"><div><p class="eyebrow">Not saved yet</p><h2>Christmas ${year}</h2></div>
        <div class="row">${saved.length ? '<button id="keep" class="ghost">Keep Saved</button>' : ''}<button id="again" class="ghost">Draw Again</button><button id="save" class="fill">Save ${year}</button></div></div>
      ${lastYear ? `<p class="hint">${pending.repeats ? `${plural(pending.repeats, 'kid')} couldn't avoid last year's adult (marked).` : `No one has a kid they had in ${lastYear}.`}</p>` : ''}
      ${groupsHTML(groups, { animate: true })}</div>`;
  } else if (saved.length) {
    const groups = pickGroups(saved, people, last);
    main = `<div class="card hero-card">
      <div class="row between wrap"><div><p class="eyebrow">Saved ${fmtDate(iso(new Date(saved[0].saved_at)))}</p><h2>Christmas ${year}</h2></div>
        <div class="row"><button id="copy" class="ghost small">Copy</button><button id="redo" class="ghost small">Redraw</button><button class="ghost small danger" data-del="${year}">Delete</button></div></div>
      ${groupsHTML(groups)}</div>`;
  } else if (!ready) {
    main = `<div class="card empty hero-card"><h2>Christmas ${year}</h2>
      <p class="muted">Add at least one adult and one kid to draw names.</p><a class="button fill" href="#/people">Add People</a></div>`;
  } else {
    main = `<div class="card hero-card draw-card"><p class="eyebrow">Ready to draw</p><h2>Christmas ${year}</h2>
      <p class="muted">${plural(adults.length, 'adult')} and ${plural(kids.length, 'kid')}: about ${each} kids each. ${lastNote}</p>
      <button id="draw" class="fill big-btn">Draw Names</button>
      <p class="hint">Who's in: ${esc(adults.map(a => a.name).join(', '))}. <a href="#/people">Change</a></p></div>`;
  }

  const past = years.filter(y => y !== year);
  view(`<div class="page-head"><h1 class="big">Kiddo Draw</h1></div>
    ${main}
    ${past.length ? `<h2 class="section">Past Years</h2>
      ${past.map(y => {
        const yp = picks.filter(p => p.year === y);
        const before = years.find(o => o < y);
        const groups = pickGroups(yp, people, new Map(picks.filter(p => p.year === before).map(p => [p.kid_id, p.adult_id])));
        return `<details class="card year"><summary><h3>Christmas ${y}</h3><span class="muted">${plural(groups.length, 'adult')}, ${plural(yp.length, 'kid')}</span></summary>
          ${groupsHTML(groups)}
          <div class="row end"><button class="ghost small" data-copy="${y}">Copy</button><button class="ghost small danger" data-del="${y}">Delete ${y}</button></div></details>`;
      }).join('')}` : ''}`);

  const copy = async (y, btn) => {
    const groups = pickGroups(picks.filter(p => p.year === y), people);
    await busy(btn, async () => { await navigator.clipboard.writeText(pickText(y, groups)); flash('Copied. Paste it anywhere.'); });
  };
  const doDraw = () => { pending = { year, ...drawPicks(adults, kids, last) }; redraw(); };
  if ($('#draw')) $('#draw').onclick = doDraw;
  if ($('#again')) $('#again').onclick = doDraw;
  if ($('#keep')) $('#keep').onclick = () => { pending = null; redraw(); };
  if ($('#copy')) $('#copy').onclick = e => copy(year, e.target);
  if ($('#redo')) $('#redo').onclick = async () => {
    if (!await ask({ title: `Redraw ${year}?`, ok: 'Redraw', warn: true,
      body: `<p>You'll get a new draw to look at first. The saved one stays until you save the new one.</p>` })) return;
    doDraw();
  };
  if ($('#save')) $('#save').onclick = e => busy(e.target, async () => {
    // Save over this year: write every pick, then drop any kid from an older save of this year who isn't in the draw now.
    await sb.from('xmas_picks').upsert(pending.picks.map(p => ({ year, ...p, saved_at: new Date().toISOString() }))).then(must);
    const ids = pending.picks.map(p => p.kid_id);
    await sb.from('xmas_picks').delete().eq('year', year).not('kid_id', 'in', `(${ids.join(',')})`).then(must);
    pending = null;
    flash(`Christmas ${year} saved.`);
    redraw();
  });
  app.onclick = async e => {
    const c = e.target.closest('[data-copy]');
    if (c) return copy(+c.dataset.copy, c);
    const d = e.target.closest('[data-del]');
    if (!d) return;
    const y = +d.dataset.del;
    if (!await confirmDelete(`Delete ${y}?`, `This removes who had whom in ${y}. It can't be undone.`)) return;
    busy(d, async () => {
      await sb.from('xmas_picks').delete().eq('year', y).then(must);
      flash(`${y} deleted.`);
      redraw();
    });
  };
}
