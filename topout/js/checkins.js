// ---------- Check-ins (on the member page) ----------
// A check-in is a snapshot on a day, as often as the coach likes: answers to the admin's questions (Proud Of, Want to
// Improve with area tags, …), the member's level, their ranking of the Rated focus areas (strongest to weakest, their
// own view; another coach's idea, replacing 1–5 ratings), and grades: the hardest circuit color, board grades with the
// angle, outdoor boulder and route grades. All optional. The newest one shows in full with how each value changed since
// the check-in before; older ones fold into History.

const AREA_GROUPS = { physical: 'Physical', skill: 'Skill', mental: 'Mental' };
// Areas in Physical, Skill, Mental order, then the admin's order.
const byGroup = areas => Object.keys(AREA_GROUPS).flatMap(g => areas.filter(a => a.area_group === g));
// An area's 1–10 ladder (Focus Area Levels in Settings): what each level looks like, for reference only.
const ladderHTML = a => a.guide.some(g => g.trim()) ? `<ol class="ladder">${a.guide.map((g, i) => g.trim()
  ? `<li><b>${i + 1}</b><span>${esc(g)}</span></li>` : '').join('')}</ol>` : '<p class="muted">No levels written for this area yet.</p>';
// An area's score on a check-in from its place in the ranking: the top area 10, the bottom 1, evenly between, so
// rankings of different lengths average fairly. Null when it isn't ranked.
function rankScore(c, id) {
  const r = c.ranking || [], i = r.indexOf(id);
  return i < 0 ? null : r.length === 1 ? 10 : 10 - 9 * i / (r.length - 1);
}
const scoreText = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
// Area chips to tick (checkboxes called `name`), in a row per group. Used for check-in tags, Team Focus and practices.
const areaChips = (name, list, picked, label) => {
  const chip = a => `<label class="chip-check"><input type="checkbox" name="${name}" value="${a.id}"${picked.includes(a.id) ? ' checked' : ''}><span>${esc(a.name)}</span></label>`;
  return `<div class="tag-pick" role="group" aria-label="${esc(label)}">
  ${Object.entries(AREA_GROUPS).map(([g, gl]) => {
    const inG = list.filter(a => a.area_group === g);
    return inG.length ? `<div class="tag-group"><small>${gl}</small>${inG.map(chip).join('')}</div>` : '';
  }).join('')}</div>`;
};

const canChangeCheckin = c => me.isAdmin || c.author_id === me.user.id;

// Each grade: its label, how to read it for display, and a number to compare (higher = harder).
function gradeParts(c, circuits) {
  const circ = circuits.find(x => x.id === c.circuit_id), proj = circuits.find(x => x.id === c.project_circuit_id);
  const board = (g, a) => g == null ? null : vText(g) + (a != null ? ` @ ${a}°` : '');
  const color = x => x ? `${swatch(x.color)}${esc(x.name)}` : null;
  return [
    { key: 'circuit', label: 'Hardest Circuit', show: color(circ), sub: circ ? circuitRange(circ) : '', rank: circ?.position },
    { key: 'project', label: 'Project Circuit', show: color(proj), sub: proj ? circuitRange(proj) : '', rank: proj?.position },
    { key: 'tb2', label: 'Tension Board 2', show: esc(board(c.tb2_grade, c.tb2_angle)), rank: c.tb2_grade },
    { key: 'kilter', label: 'Kilter Board', show: esc(board(c.kilter_grade, c.kilter_angle)), rank: c.kilter_grade },
    { key: 'moon', label: 'MoonBoard', show: esc(board(c.moon_grade, c.moon_angle)), rank: c.moon_grade },
    { key: 'boulder', label: 'Boulder (Outdoor/Other)', show: c.boulder_grade == null ? null : vText(c.boulder_grade), rank: c.boulder_grade },
    { key: 'route', label: 'Route', show: c.route_grade ? esc(c.route_grade) : null, rank: c.route_grade ? ROUTE_GRADES.indexOf(c.route_grade) : null },
  ].filter(p => p.show);
}
// ↑ or ↓ against the value from the check-in before (the newest older one that has it).
const delta = (now, before) => now == null || before == null || now === before ? ''
  : `<span class="delta ${now > before ? 'up' : 'down'}" title="${now > before ? 'Up' : 'Down'} since the check-in before">${now > before ? '↑' : '↓'}</span>`;
// Answered questions on a check-in: [{ q, text, tags: [area] }].
const answered = (c, questions, areas) => questions.map(q => ({ q, text: (c.answers[q.id] || '').trim(),
  tags: byGroup(areas).filter(a => (c.tags[q.id] || []).includes(a.id)) })).filter(x => x.text || x.tags.length);

function checkinDetailHTML(c, older, { m, circuits, areas, questions, levels }) {
  const prevRank = key => { for (const o of older) { const p = gradeParts(o, circuits).find(x => x.key === key); if (p) return p.rank; } return null; };
  const grades = gradeParts(c, circuits);
  const answers = answered(c, questions, areas);
  const level = levels.find(l => l.id === c.level_id);
  // The ranking, strongest first, each with how many places it moved since the last check-in that has a ranking.
  const ranked = c.ranking.map(id => areas.find(a => a.id === id)).filter(Boolean);
  const before = older.find(o => o.ranking.length)?.ranking || [];
  const moved = a => {
    const was = before.indexOf(a.id), now = c.ranking.indexOf(a.id), n = was - now;
    return was < 0 || !n ? '' : `<span class="delta ${n > 0 ? 'up' : 'down'}" title="${n > 0 ? 'Up' : 'Down'} ${Math.abs(n)} since the check-in before">${n > 0 ? '↑' : '↓'}${Math.abs(n)}</span>`;
  };
  return `${answers.length ? `<div class="answers">${answers.map(x => `<div class="answer"><small>${esc(x.q.prompt)}</small>
      ${x.text ? `<div>${para(x.text)}</div>` : ''}${x.tags.length ? `<span class="chips">${x.tags.map(a => `<span class="chip">${esc(a.name)}</span>`).join('')}</span>` : ''}</div>`).join('')}</div>` : ''}
    ${level || grades.length ? `<div class="grades">${level ? `<div class="grade"><small>Level</small><b>${esc(level.name)}</b>${level.about ? `<small>${esc(level.about)}</small>` : ''}</div>` : ''}
      ${grades.map(p => `<div class="grade"><small>${p.label}</small>
      <b>${p.show}${delta(p.rank, prevRank(p.key))}</b>${p.sub ? `<small>${p.sub}</small>` : ''}</div>`).join('')}</div>` : ''}
    ${ranked.length ? `<div class="ranked"><small>${esc(m?.first_name || 'Member')}'s Ranking <span class="muted">(strongest first)</span></small>
      <ol>${ranked.map(a => `<li><span>${esc(a.name)}</span>${moved(a)}</li>`).join('')}</ol></div>` : ''}
    ${!answers.length && !grades.length && !ranked.length && !level ? '<p class="muted">No answers, ranking or grades recorded.</p>' : ''}
    ${c.notes ? `<div class="note-body">${para(c.notes)}</div>` : ''}
    <div class="row between wrap check-foot"><span class="hint">Check-in by ${esc(c.author_name || 'staff')}${c.edited_at ? ' · edited' : ''}</span>
      ${canChangeCheckin(c) ? `<span class="row"><button type="button" class="small ghost" data-checkin="edit" data-id="${c.id}">Edit</button>
        <button type="button" class="small ghost danger" data-checkin="delete" data-id="${c.id}">Delete</button></span>` : ''}</div>`;
}

function checkinsCardHTML(ctx) {
  const { checkins, circuits } = ctx;
  const [latest, ...older] = checkins;
  const summary = c => {
    const circ = circuits.find(x => x.id === c.circuit_id);
    const bits = gradeParts(c, circuits).filter(p => p.key !== 'circuit' && p.key !== 'project').map(p => `${p.key === 'tb2' ? 'TB2' : p.key === 'kilter' ? 'Kilter' : p.key === 'moon' ? 'Moon' : ''} ${p.show}`.trim());
    return `<b>${fmtDate(c.checkin_date)}</b>${circ ? circuitChip(circ) : ''}<span class="muted">${[...bits.slice(0, 2), c.author_name ? `by ${esc(c.author_name)}` : ''].filter(Boolean).join(' · ')}</span>`;
  };
  return `<section class="card checkins-card">
    <div class="row between"><h2>Check-Ins</h2><button type="button" class="fill small" data-checkin="new">+ New Check-In</button></div>
    ${latest ? `<p class="hint">Latest: <strong>${fmtDate(latest.checkin_date)}</strong>. Arrows compare with the check-in before.</p>
      ${checkinDetailHTML(latest, older, ctx)}
      ${older.length ? `<h3>History</h3>${older.map((c, i) => `<details class="history"><summary>${summary(c)}</summary>
        ${checkinDetailHTML(c, older.slice(i + 1), ctx)}</details>`).join('')}` : ''}`
    : `<p class="muted">No check-ins yet. A check-in records a chat with them (what they're proud of, what they want to improve),
      their level, how they rank their focus areas, and their grades, whenever it suits you: monthly, each season or once a year.</p>`}
  </section>`;
}

async function checkinAction(btn, ctx) {
  const c = ctx.checkins.find(x => x.id === btn.dataset.id);
  if (btn.dataset.checkin === 'delete') {
    if (!await confirmDelete('Delete Check-In?', `The check-in from ${fmtDate(c.checkin_date)} will be gone for good.`)) return;
    return busy(btn, async () => { await sb.from('team_checkins').delete().eq('id', c.id).then(must); flash('Check-in deleted.'); redraw(); });
  }
  checkinForm(c || null, ctx);
}

async function checkinForm(c, { m, goals, checkins, circuits, areas, questions, levels }) {
  // A new check-in starts as a copy of the latest one (level, ranking, grades and notes, but not the answers), dated today.
  const last = checkins[0];
  const v = c || (last ? { ...last, checkin_date: today(), answers: {}, tags: {} }
    : { checkin_date: today(), ranking: [], level_id: null, answers: {}, tags: {}, notes: '' });
  const vOpts = sel => `<option value="">—</option>${V_GRADES.map(g => `<option value="${g}"${g === sel ? ' selected' : ''}>V${g}</option>`).join('')}`;
  const angle = (name, val) => `<label>Angle<input type="number" name="${name}" min="0" max="70" step="5" inputmode="numeric" value="${val ?? ''}"
    placeholder="E.g. 40" data-range="Use an angle from 0° to 70°."></label>`;
  // Hidden questions and areas still show on a check-in that has them, so nothing is lost by editing it.
  const shownQs = questions.filter(q => q.active || v.answers[q.id] || v.tags[q.id]?.length);
  const tagsOn = q => q.tags || v.tags[q.id]?.length;
  const tagAreas = q => byGroup(areas.filter(a => a.active || (v.tags[q.id] || []).includes(a.id)));
  const tagPick = q => areaChips('t_' + q.id, tagAreas(q), v.tags[q.id] || [], `Focus areas for ${q.prompt}`);
  // The ranking: the saved order, then any Rated, shown area it doesn't have yet (added since) at the bottom. An area
  // that is no longer Rated or shown stays while this check-in ranks it.
  const inRank = v.ranking.map(id => areas.find(a => a.id === id)).filter(Boolean);
  const rankAreas = [...inRank, ...byGroup(areas.filter(a => a.rated && a.active && !inRank.includes(a)))];
  const levelOf = id => levels.find(l => l.id === id);
  // A circuit pick with its hint under the label (the user asked for both).
  const circuitPick = (name, label, hint) => `<label>${label}<small class="label-hint">${hint}</small>
    <select name="${name}"><option value="">—</option>${circuits.map(x =>
      `<option value="${x.id}"${x.id === v[name] ? ' selected' : ''}>${esc(x.name)}${circuitRange(x) ? ` (${circuitRange(x)})` : ''}</option>`).join('')}</select></label>`;
  const pr = pronounWords(m.pronouns);
  // A reminder from their intake and goals, to talk about progress against what they came for (the user asked).
  const cur = goals.filter(g => g.status === 'current');
  const recap = m.intake_wants.trim() || cur.length ? `<div class="intake-recap">
      ${m.intake_wants.trim() ? `<p><b>What ${Cap(pr.subj)} ${pr.plural ? 'Want' : 'Wants'} From Adult Team:</b> ${esc(m.intake_wants)}</p>` : ''}
      ${cur.length ? `<p><b>Current Goals</b></p><ul>${cur.map(g => `<li>${esc(g.body)}</li>`).join('')}</ul>` : ''}</div>` : '';
  const f = await ask({ title: c ? 'Edit Check-In' : `Check-In: ${m.first_name}`, ok: c ? 'Save Check-In' : 'Add Check-In', wide: true,
    body: `<div class="two"><label>Date<input type="date" name="checkin_date" required value="${v.checkin_date}" max="${today()}" data-need="Pick the date."
        data-range="A check-in can't be in the future."></label>
      <label>Level<select name="level_id"><option value="">—</option>${levels.map(l =>
        `<option value="${l.id}"${l.id === v.level_id ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
        <small class="level-about" data-level-about>${esc(levelOf(v.level_id)?.about || '')}</small></label></div>
      <p class="hint">Record what's useful. Everything below is optional.${!c && last ? ` Level, ranking, grades and notes start from the last check-in (${fmtDate(last.checkin_date)}), so change what's new.` : ''}</p>
      ${recap}
      ${shownQs.length ? `<h3 class="sec">Questions</h3>${shownQs.map(q => `<div class="q-block"><label>${esc(q.prompt)}${rich(`<textarea name="a_${q.id}" rows="2"
        placeholder="${esc(q.hint)}">${esc(v.answers[q.id] || '')}</textarea>`)}</label>${tagsOn(q) ? tagPick(q) : ''}</div>`).join('')}` : ''}
      <h3 class="sec">Grades</h3>
      <div class="two">${circuitPick('circuit_id', 'Hardest Circuit', "The hardest color they've sent, even once.")}
        ${circuitPick('project_circuit_id', 'Project Circuit', 'The color where most of their projects are. It can be below Hardest if those sends were one-offs.')}</div>
      <fieldset><legend>Tension Board 2</legend><div class="two"><label>Grade<select name="tb2_grade">${vOpts(v.tb2_grade)}</select></label>${angle('tb2_angle', v.tb2_angle)}</div></fieldset>
      <fieldset><legend>Kilter Board</legend><div class="two"><label>Grade<select name="kilter_grade">${vOpts(v.kilter_grade)}</select></label>${angle('kilter_angle', v.kilter_angle)}</div></fieldset>
      <fieldset><legend>MoonBoard</legend><div class="two"><label>Grade<select name="moon_grade">${vOpts(v.moon_grade)}</select></label>${angle('moon_angle', v.moon_angle)}</div></fieldset>
      <div class="two"><label>Boulder (Outdoor/Other)<select name="boulder_grade">${vOpts(v.boulder_grade)}</select></label>
        <label>Route<select name="route_grade"><option value="">—</option>${ROUTE_GRADES.map(g => `<option${g === v.route_grade ? ' selected' : ''}>${g}</option>`).join('')}</select></label></div>
      ${rankAreas.length ? `<h3 class="sec">${esc(m.first_name)}'s Ranking</h3>
        <p class="hint">How ${esc(m.first_name)} sees ${pr.self}: drag ${pr.pos} strongest focus area to the top and weakest to the bottom
          (you move them for ${pr.obj}). Tap a name for what each level looks like.</p>
        <p class="hint rank-none"${v.ranking.length ? ' hidden' : ''}>Not ranked yet. Moving any area ranks them all in this order.</p>
        <ol class="rank-list">${rankAreas.map(a => `<li class="rank-row" data-kind="rank" data-id="${a.id}">${GRIP}
          <details class="rank-ladder"><summary>${esc(a.name)}</summary>${ladderHTML(a)}</details></li>`).join('')}</ol>
        <input type="hidden" name="ranking" value="${v.ranking.length ? rankAreas.map(a => a.id).join(',') : ''}">
        <button type="button" class="small ghost" data-rank-clear${v.ranking.length ? '' : ' hidden'}>Clear Ranking</button>` : ''}
      <h3 class="sec">Notes</h3>
      ${rich(`<textarea name="notes" rows="3" aria-label="Notes" placeholder="E.g. Moved up a color since spring. Wants to try the Kilter at 45° next.">${esc(v.notes)}</textarea>`)}`,
    onOpen: form => {
      // Moving an area saves the whole order; Clear Ranking leaves this check-in unranked.
      const hidden = form.elements.ranking, clear = form.querySelector('[data-rank-clear]');
      const set = ids => {
        hidden.value = ids.join(',');
        form.querySelector('.rank-none').hidden = !!ids.length;
        clear.hidden = !ids.length;
      };
      if (hidden) wireGrips((kind, ids) => set(ids), form);
      clear?.addEventListener('click', () => set([]));
      form.elements.level_id.addEventListener('change', e => { form.querySelector('[data-level-about]').textContent = levelOf(e.target.value)?.about || ''; });
    } });
  if (!f) return;
  const num = k => f.get(k) === '' || f.get(k) == null ? null : +f.get(k);
  // Answers and tags on questions not in the form (none today, but an old check-in could have some) are kept.
  const keep = (now, old, shown) => { if (old) for (const [k, x] of Object.entries(old)) if (!shown.some(s => s.id === k)) now[k] = x; return now; };
  const answers = {}, tags = {};
  for (const q of shownQs) {
    const text = (f.get('a_' + q.id) || '').trim(), t = f.getAll('t_' + q.id);
    if (text) answers[q.id] = text;
    if (t.length) tags[q.id] = t;
  }
  const row = {
    checkin_date: f.get('checkin_date'), level_id: f.get('level_id') || null,
    circuit_id: f.get('circuit_id') || null, project_circuit_id: f.get('project_circuit_id') || null,
    tb2_grade: num('tb2_grade'), tb2_angle: num('tb2_grade') == null ? null : num('tb2_angle'),
    kilter_grade: num('kilter_grade'), kilter_angle: num('kilter_grade') == null ? null : num('kilter_angle'),
    moon_grade: num('moon_grade'), moon_angle: num('moon_grade') == null ? null : num('moon_angle'),
    boulder_grade: num('boulder_grade'), route_grade: f.get('route_grade') || null,
    ranking: (f.get('ranking') || '').split(',').filter(Boolean),
    answers: keep(answers, c?.answers, shownQs), tags: keep(tags, c?.tags, shownQs), notes: f.get('notes').trim(),
  };
  await busy(null, async () => {
    if (c) await sb.from('team_checkins').update(row).eq('id', c.id).then(must);
    else await sb.from('team_checkins').insert({ ...row, member_id: m.id }).then(must);
    flash(c ? 'Check-in saved.' : 'Check-in added.');
    redraw();
  });
}
