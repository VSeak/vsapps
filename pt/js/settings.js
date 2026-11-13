// ---------- Settings (#/settings): the photo, the pal's name, and the daily goal ----------
// One photo at a time (the user asked): it's always saved as "pal", so uploading again overwrites the old one.

async function settingsPage() {
  view(loading);
  const tok = ++navToken;
  await loadSettings();
  const url = await photoUrl();
  if (tok !== navToken) return;
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

  $('#pickPhoto').onclick = () => $('#photoIn').click();
  $('#photoIn').onchange = e => {
    const file = e.target.files[0];
    if (file) busy($('#pickPhoto'), async () => {
      const blob = await shrinkPhoto(file);
      await sb.storage.from('pt-photo').upload('pal', blob, { upsert: true, contentType: blob.type, cacheControl: '0' }).then(must);
      await sb.from('pt_settings').update({ photo_at: new Date().toISOString() }).eq('id', true).then(must);
      flash('Photo saved.');
      redraw();
    });
  };
  if (url) $('#rmPhoto').onclick = async e => {
    if (!await confirmDelete('Remove Photo?', `${esc(settings.name)} goes back to the fox drawing. The photo is deleted.`)) return;
    busy(e.target, async () => {
      await sb.storage.from('pt-photo').remove(['pal']).then(must);
      await sb.from('pt_settings').update({ photo_at: null }).eq('id', true).then(must);
      flash('Photo removed.');
      redraw();
    });
  };
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
