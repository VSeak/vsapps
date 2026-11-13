// ---------- Settings (#/settings): the photo, the pal's name, and the daily goal ----------
// One photo at a time (the user asked): it's always saved as "pal", so uploading again overwrites the old one.

async function settingsPage() {
  view(loading);
  const tok = ++navToken;
  await loadSettings();
  const url = await photoUrl();
  if (tok !== navToken) return;
  // The hat card only shows in a hat season (the user asked): Santa Hat at Christmas, Autumn Beanie through Thanksgiving.
  // New Year Cap at Chinese New Year. All use the same placement, so a hat placed in November is already on at Christmas.
  const hs = hatSeason(), xmas = !!hs;
  view(`<div class="page-head"><h1 class="big">Settings</h1></div>
    <div class="card">
      <h2>Photo</h2>
      <div class="photo-row">
        <div class="pal thumb">${palPic(url)}</div>
        <div>
          <p class="hint">One photo at a time: a new one replaces the old. PNG, JPG, or WebP. A PNG with a see-through background looks best.</p>
          <div class="row wrap">
            <button type="button" class="fill" id="pickPhoto">${url ? 'Replace Photo' : 'Upload Photo'}</button>
            ${url ? '<button type="button" class="ghost danger" id="rmPhoto">Remove Photo</button>' : ''}
          </div>
          <input type="file" id="photoIn" accept="image/png,image/jpeg,image/webp" hidden>
        </div>
      </div>
    </div>
    <div class="card">
      <form id="setForm" class="stack" data-save>
        <h2>Your Pal</h2>
        <label>Name<input name="name" maxlength="24" required data-need="Give your pal a name." value="${esc(settings.name)}"></label>
        <label>Daily Goal<input type="number" name="goal" min="1" max="10" inputmode="numeric" required data-need="Enter a goal from 1 to 10."
          data-range="Enter a goal from 1 to 10." value="${settings.daily_goal}"></label>
        <p class="hint">How many berries make a full day. Sweetberries and the day's Cragberry both count.</p>
        <div class="row end"><button class="primary">Save</button></div>
      </form>
    </div>
    ${xmas ? `<div class="card">
      <h2>${hs.title}</h2>
      <p class="hint">${hs.thru}, ${esc(settings.name)} wears ${hs.what} on Feed.
        ${url ? (settings.hat ? 'Move it, or take it off.' : 'Place it on your photo to put it on.') : 'The fox wears it between its ears; you can move it.'}</p>
      <div class="row wrap">
        <button type="button" class="fill" id="placeHat">${settings.hat ? 'Move Hat' : 'Place Hat'}</button>
        ${settings.hat ? `<button type="button" class="ghost ${url ? 'danger' : ''}" id="rmHat">${url ? 'Take Off Hat' : 'Reset Hat'}</button>` : ''}
      </div>
    </div>` : ''}
    ${'rug' in settings ? `<div class="card">
      <h2>Rug</h2>
      <p class="hint">The rug ${esc(settings.name)} stands on in front of the fire.</p>
      <div class="rug-picks" id="rugs" role="radiogroup" aria-label="Rug">
        ${RUGS.map(r => `<label class="rug-pick"><input type="radio" name="rug" value="${r.id}" ${r.id === rugOf() ? 'checked' : ''}>
          <span class="rug-floor"><span class="pal">${rugHtml(r.id)}</span></span><span>${r.name}</span></label>`).join('')}
      </div>
    </div>` : ''}
    <div class="card">
      <h2>Window</h2>
      <p class="hint">The window on Feed shows the real sky outside: sunrise, sunset, and the moon where you are.
        ${settings.lat != null ? 'Your location is saved, rounded to about 10 km.' : 'Until your location is saved, it uses 7am and 7pm.'}</p>
      <div class="row wrap">
        <button type="button" class="fill" id="useLoc">${settings.lat != null ? 'Update Location' : 'Use My Location'}</button>
        ${settings.lat != null ? '<button type="button" class="ghost danger" id="forgetLoc">Forget Location</button>' : ''}
      </div>
    </div>`);

  // The phone asks permission once. Saved rounded to 0.1° (about 10 km): enough for sunrise, not an address.
  $('#useLoc').onclick = e => busy(e.target, async () => {
    if (!navigator.geolocation) throw new Error("This browser can't share a location.");
    const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: false, timeout: 20000, maximumAge: 864e5 }))
      .catch(err => { throw new Error(err.code === 1 ? "Location is turned off for this site. Allow it in your browser's site settings, then try again."
        : "Couldn't find your location. Try again in a moment."); });
    const round = n => Math.round(n * 10) / 10;
    await sb.from('pt_settings').update({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) }).eq('id', true).then(must);
    sunDay = null;   // the window works out today's sunrise again
    flash('Location saved.');
    redraw();
  });
  if (settings.lat != null) $('#forgetLoc').onclick = e => busy(e.target, async () => {
    await sb.from('pt_settings').update({ lat: null, lon: null }).eq('id', true).then(must);
    sunDay = null;
    flash('Location forgotten.');
    redraw();
  });

  // A rug saves as soon as it's picked (null for the braided one, the default). A failed save puts the old one back.
  if ($('#rugs')) $('#rugs').onchange = e => busy(null, async () => {
    const was = rugOf(), id = e.target.value;
    try { await sb.from('pt_settings').update({ rug: id === 'braided' ? null : id }).eq('id', true).then(must); }
    catch (err) { $(`#rugs input[value="${was}"]`).checked = true; throw err; }
    settings.rug = id === 'braided' ? null : id;
    flash(`${RUGS.find(r => r.id === id).name} rug down.`);
  });

  $('#pickPhoto').onclick = () => $('#photoIn').click();
  $('#photoIn').onchange = e => {
    const file = e.target.files[0];
    if (file) busy($('#pickPhoto'), async () => {
      const blob = await shrinkPhoto(file);
      await sb.storage.from('pt-photo').upload('pal', blob, { upsert: true, contentType: blob.type, cacheControl: '0' }).then(must);
      // A new photo puts the head somewhere else, so the hat comes off until it's placed again.
      await sb.from('pt_settings').update({ photo_at: new Date().toISOString(), ...('hat' in settings && { hat: null }) }).eq('id', true).then(must);
      flash('Photo saved.');
      redraw();
    });
  };
  if (url) $('#rmPhoto').onclick = async e => {
    if (!await confirmDelete('Remove Photo?', `${esc(settings.name)} goes back to the fox drawing. The photo is deleted.`)) return;
    busy(e.target, async () => {
      await sb.storage.from('pt-photo').remove(['pal']).then(must);
      await sb.from('pt_settings').update({ photo_at: null, ...('hat' in settings && { hat: null }) }).eq('id', true).then(must);
      flash('Photo removed.');
      redraw();
    });
  };
  if (xmas) $('#placeHat').onclick = () => placeHat(url);
  if (xmas && settings.hat) $('#rmHat').onclick = e => busy(e.target, async () => {
    await sb.from('pt_settings').update({ hat: null }).eq('id', true).then(must);
    flash(url ? 'Hat off.' : 'Hat back in its spot.');
    redraw();
  });
  $('#setForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    busy(e.submitter, async () => {
      await sb.from('pt_settings').update({ name: f.get('name').trim(), daily_goal: +f.get('goal') }).eq('id', true).then(must);
      flash('Saved.');
      goTo('#/');
    });
  };
}

// Place Hat (the user asked): drag the hat onto the head (or tap where it goes), then size and tilt it with the sliders.
// Arrow keys move it too. Saved as fractions of the photo, so it stays on the head at any size.
async function placeHat(url) {
  if (!('hat' in settings)) { flash("The hat needs a database update first (see SETUP.md).", 'error'); return; }
  const h = { ...(palHat(url) ?? { x: .5, y: .22, w: .5, r: 0 }) };
  const f = await ask({ title: 'Place Hat', ok: 'Save',
    body: `<p class="hint">Drag the hat onto ${esc(settings.name)}'s head, or tap where it goes.</p>
      <div class="hat-stage"><div class="pal placing">${palPic(url, h)}</div></div>
      <label>Size<input type="range" name="w" min="15" max="100" value="${Math.round(h.w * 100)}"></label>
      <label>Tilt<input type="range" name="r" min="-45" max="45" value="${Math.round(h.r)}"></label>`,
    onOpen: form => {
      const body = form.querySelector('.pal-body'), hat = form.querySelector('.hat');
      const show = () => { for (const [k, v] of Object.entries({ hx: h.x, hy: h.y, hw: h.w, hr: h.r })) hat.style.setProperty('--' + k, v); };
      const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
      const at = e => { const R = body.getBoundingClientRect(); return [(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height]; };
      let grab = null;
      hat.tabIndex = 0;
      hat.setAttribute('role', 'img');
      hat.setAttribute('aria-label', `${hatSeason()?.title ?? 'Hat'}: drag it, or move it with the arrow keys`);
      body.addEventListener('pointerdown', e => {
        e.preventDefault();
        const [px, py] = at(e);
        // On the hat: keep hold of the spot you grabbed. Anywhere else: the hat jumps there.
        grab = hat.contains(e.target) ? [h.x - px, h.y - py] : [0, 0];
        body.setPointerCapture(e.pointerId);
        move(e);
      });
      const move = e => {
        if (!grab) return;
        const [px, py] = at(e);
        h.x = clamp(px + grab[0], -.2, 1.2); h.y = clamp(py + grab[1], 0, 1);
        show();
      };
      body.addEventListener('pointermove', move);
      body.addEventListener('pointerup', () => { grab = null; });
      body.addEventListener('pointercancel', () => { grab = null; });
      hat.addEventListener('keydown', e => {
        const d = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }[e.key];
        if (!d) return;
        e.preventDefault();
        h.x = clamp(h.x + d[0], -.2, 1.2); h.y = clamp(h.y + d[1], 0, 1);
        show();
      });
      form.addEventListener('input', e => {
        if (e.target.name === 'w') h.w = e.target.value / 100;
        if (e.target.name === 'r') h.r = +e.target.value;
        show();
      });
    } });
  if (!f) return;
  const r3 = n => Math.round(n * 1000) / 1000;
  await busy($('#placeHat'), async () => {
    await sb.from('pt_settings').update({ hat: { x: r3(h.x), y: r3(h.y), w: r3(h.w), r: Math.round(h.r) } }).eq('id', true).then(must);
    flash('Hat saved.');
    redraw();
  });
}

// About 600px on the long side, so a phone photo of several MB uploads as roughly 100 KB. WebP keeps a see-through
// background; a browser that can't make WebP (older Safari) gives PNG instead.
async function shrinkPhoto(file) {
  let img;
  try { img = await createImageBitmap(file); }
  catch { throw new Error("That photo couldn't be opened. Try a PNG or JPG."); }
  const scale = Math.min(1, 600 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const make = (type, q) => new Promise(r => c.toBlob(r, type, q));
  let blob = await make('image/webp', .88);
  if (blob?.type !== 'image/webp') blob = await make('image/png');
  return blob;
}
