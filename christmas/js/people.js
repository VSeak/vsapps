// ---------- People: the adults who shop and the kids they shop for ----------

const KINDS = { adult: { title: 'Adults', one: 'adult', hint: 'The ones who shop.' }, kid: { title: 'Kids', one: 'kid', hint: 'The ones who get gifts.' } };

async function peoplePage() {
  const token = ++navToken;
  view(loading);
  const [people, picks] = await Promise.all([
    sb.from('xmas_people').select('id, name, kind, active').then(must),
    sb.from('xmas_picks').select('kid_id, adult_id').then(must),
  ]);
  if (token !== navToken) return;
  const drawn = new Set(picks.flatMap(p => [p.kid_id, p.adult_id]));   // in a saved year, so they can't be deleted
  const cards = Object.entries(KINDS).map(([kind, k]) => {
    const list = people.filter(p => p.kind === kind).sort(byName);
    const inDraw = list.filter(p => p.active).length;
    return `<div class="card">
      <div class="row between"><h2>${k.title}</h2><span class="muted">${inDraw} of ${list.length} in the draw</span></div>
      <p class="hint">${k.hint} Untick someone to leave them out this year.</p>
      <ul class="people">${list.map(p => `<li class="${p.active ? '' : 'off'}">
          <label class="check"><input type="checkbox" data-active="${p.id}" ${p.active ? 'checked' : ''} aria-label="${esc(p.name)} is in the draw"></label>
          <span class="name">${esc(p.name)}</span>
          <button class="ghost small" data-edit="${p.id}">Edit</button></li>`).join('') || `<li class="muted">No ${k.title.toLowerCase()} yet.</li>`}</ul>
      <form class="add" data-kind="${kind}" data-save>
        <label>Add ${Cap(k.one)}s <span class="muted">several at once with commas</span><input name="names" autocomplete="off" required data-need="Type a name."></label>
        <button class="primary">Add</button>
      </form></div>`;
  }).join('');
  view(`<div class="page-head"><h1 class="big">People</h1></div><div class="people-grid">${cards}</div>`);

  app.onchange = e => {
    const box = e.target.closest('[data-active]');
    if (!box) return;
    busy(box, async () => {
      await sb.from('xmas_people').update({ active: box.checked }).eq('id', box.dataset.active).then(must);
      box.defaultChecked = box.checked;   // saved, so it doesn't count as an unsaved change
      redraw();
    });
  };
  app.onsubmit = e => {
    e.preventDefault();
    const f = e.target, kind = f.dataset.kind;
    const have = new Set(people.map(p => p.name.toLowerCase()));
    const names = [...new Set(f.elements.names.value.split(/[,\n]/).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean))];
    const tooLong = names.find(n => n.length > 40);
    if (tooLong) return fieldError(f.elements.names, `Keep each name to 40 characters.`);
    const fresh = names.filter(n => !have.has(n.toLowerCase()));
    if (!fresh.length) return fieldError(f.elements.names, names.length > 1 ? 'They are all on the list already.' : `${names[0]} is on the list already.`);
    busy(e.submitter, async () => {
      await sb.from('xmas_people').insert(fresh.map(name => ({ name, kind }))).then(must);
      f.reset();
      const skipped = names.length - fresh.length;
      flash(`Added ${plural(fresh.length, KINDS[kind].one)}${skipped ? ` (${skipped} already on the list)` : ''}.`);
      redraw();
    });
  };
  app.onclick = async e => {
    const b = e.target.closest('[data-edit]');
    if (!b) return;
    const p = people.find(x => x.id === b.dataset.edit);
    const canDelete = !drawn.has(p.id);
    const f = await ask({ title: `Edit ${Cap(KINDS[p.kind].one)}`, ok: 'Save', extra: canDelete ? { value: 'delete', label: 'Delete' } : null,
      body: `<label>Name<input name="name" value="${esc(p.name)}" maxlength="40" autocomplete="off" required data-need="Type a name."></label>
        <label>Adult or Kid<select name="kind">${Object.entries(KINDS).map(([v, k]) => `<option value="${v}" ${v === p.kind ? 'selected' : ''}>${Cap(k.one)}</option>`).join('')}</select></label>
        ${canDelete ? '' : `<p class="hint">${esc(p.name)} is in a saved year, so they can't be deleted. Untick them to leave them out.</p>`}`,
      onOpen: form => { if (drawn.has(p.id)) form.elements.kind.disabled = true; } });
    if (!f) return;
    if (f.get('button') === 'delete') {
      if (!await confirmDelete(`Delete ${p.name}?`, `${esc(p.name)} comes off the list.`)) return;
      return busy(b, async () => {
        await sb.from('xmas_people').delete().eq('id', p.id).then(must);
        flash(`${p.name} deleted.`);
        redraw();
      });
    }
    const name = f.get('name').trim().replace(/\s+/g, ' ');
    if (people.some(x => x.id !== p.id && x.name.toLowerCase() === name.toLowerCase())) return flash(`${name} is on the list already.`, 'error');
    busy(b, async () => {
      await sb.from('xmas_people').update({ name, ...(f.get('kind') ? { kind: f.get('kind') } : {}) }).eq('id', p.id).then(must);
      flash('Saved.');
      redraw();
    });
  };
}
