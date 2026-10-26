// ---------- Start-up & routing ----------

async function boot() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey || !window.supabase) {
    authPage('Almost there,', 'one more step.', `<p>This site isn't connected to Supabase yet. Follow <strong>SETUP.md</strong>.</p>`);
    return;
  }
  sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { auth: { flowType: 'implicit' }, global: { fetch: skewFetch } });
  sb.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') wantsPassword = true;
    if (event === 'SIGNED_OUT' && me) { me = null; setTimeout(route); }
  });

  const { data: { session } } = await sb.auth.getSession();   // also reads a reset link's token from the URL
  if (location.search || !location.hash.startsWith('#/')) history.replaceState(null, '', BASE + '#/');
  currentHash = location.hash;

  if (session) {
    try { await loadMe(session.user); }
    catch (e) { showError(e); return; }
  }
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('beforeunload', e => { if (unsaved()) { e.preventDefault(); e.returnValue = ''; } });
  route();
}

// A token refreshed just now can reach the database a moment before its clock catches up ("JWT issued at future").
async function skewFetch(url, opts) {
  for (let i = 1; ; i++) {
    const t0 = performance.now();
    const res = await fetch(url, opts);
    slowCheck(url, opts, performance.now() - t0);
    if (res.status !== 401 || i > 3 || !/issued at future/i.test(await res.clone().text())) return res;
    await new Promise(r => setTimeout(r, 1000 * i));
  }
}

// A call over 4 seconds goes to the error log, by address without the query. Not while the page is hidden.
function slowCheck(url, opts, ms) {
  const path = new URL(String(url)).pathname;
  if (ms > 4000 && !document.hidden && !path.endsWith('/app_errors'))
    logError('slow', `${opts?.method || 'GET'} ${path}`, `${(ms / 1000).toFixed(1)} s`);
}

// Only the owner gets in: xmas_owner holds one email, and every table checks it. Any other login reads no row here.
async function loadMe(user) {
  const row = await sb.from('xmas_owner').select('email').maybeSingle().then(must);
  me = { user, isOwner: !!row };
  // The home page shows its Kiddo Draw card only on a device where the owner has signed in here (looks only; the tables are what keep it private).
  try { me.isOwner ? localStorage.setItem('vsapps.xmasOwner', '1') : localStorage.removeItem('vsapps.xmasOwner'); } catch {}
}

// Unsaved edits: a form field on the page that differs from how the page drew it.
const fieldChanged = el => el.type === 'checkbox' || el.type === 'radio' ? el.checked !== el.defaultChecked
  : el.tagName === 'SELECT' ? el.selectedIndex !== Math.max(0, [...el.options].findIndex(o => o.defaultSelected))
  : el.value !== el.defaultValue;
const unsaved = () => [...app.querySelectorAll('form:not([data-nosave]) :is(input, textarea, select)')].some(fieldChanged);

async function okToLeave(signOut = false) {
  if (!unsaved()) return true;
  return !!await ask({ title: signOut ? 'Sign Out Without Saving?' : 'Leave Without Saving?', ok: signOut ? 'Sign Out' : 'Leave', warn: true,
    body: "<p>You have changes on this page that haven't been saved.</p>" });
}
// A card with an unsaved form gets a red edge and an Unsaved tag, and its Save button turns on.
function markUnsaved() {
  for (const f of app.querySelectorAll('form[data-save]')) {
    const on = [...f.querySelectorAll('input, textarea, select')].some(fieldChanged);
    f.querySelectorAll('.primary').forEach(b => { b.disabled = !on; });
    f.closest('.card')?.classList.toggle('unsaved', on);
  }
}
['input', 'change', 'reset'].forEach(t => app.addEventListener(t, () => requestAnimationFrame(markUnsaved)));

// Goes to another page without the leave check, after a save, add or delete that ends there.
function goTo(hash) {
  app.querySelectorAll('form').forEach(f => f.reset());
  location.hash = hash;
}

async function onHashChange() {
  if (location.hash === currentHash) return;
  if (!await okToLeave()) { history.replaceState(null, '', currentHash); return; }
  currentHash = location.hash;
  route();
}

function route() {
  const [, page] = location.hash.split('/');
  const nav = $('.nav');
  nav.hidden = !me?.isOwner || wantsPassword;
  nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + (page || '')));
  $('#signOut').hidden = !me;
  if (!me) return viewLogin();
  if (wantsPassword) return viewSetPassword();
  if (!me.isOwner) return viewNoAccess();
  const go = page === 'people' ? peoplePage() : homePage();
  Promise.resolve(go).catch(showError);
}

// Redraws the page (after a save), keeping the scroll.
function redraw() { redrawing = true; route(); }

function showError(e) {
  authPage('Sorry,', 'something went wrong.', `<p>${esc(msgOf(e))}</p><p><a href="#/">Back to the start</a></p>`);
}

$('#signOut').onclick = async () => {
  if (!await okToLeave(true)) return;
  await sb.auth.signOut({ scope: 'local' });   // this device only: the same login may be signed in to the other apps elsewhere
  try { localStorage.removeItem('vsapps.xmasOwner'); } catch {}
  me = null;
  history.replaceState(null, '', BASE + '#/');
  currentHash = location.hash;
  route();
};

// ---------- Sign-in pages ----------

function authPage(head, sub, card, note = '') {
  view(`<section class="auth"><h1 class="hey">${head}<span> ${sub}</span></h1>
    <div class="card auth-card">${card}</div>${note ? `<p class="hint auth-note">${note}</p>` : ''}</section>`);
}

function viewLogin() {
  authPage('Welcome back,', "let's draw names.", `
    ${linkError ? `<p class="alert">${esc(linkError)}</p>` : ''}
    <form id="loginForm" class="stack" data-nosave>
      <label>Email<input type="email" name="email" autocomplete="email" required data-need="Enter your email."></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" required data-need="Enter your password."></label>
      <button class="fill">Sign In</button>
    </form>
    <button type="button" id="forgotBtn" class="link">Forgot Password?</button>`,
    'Private. Sign in with the email and password you use for the other apps.');
  $('#forgotBtn').onclick = e => forgotPassword(e.target);
  $('#loginForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    busy(e.submitter, async () => {
      const { data, error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
      if (error) throw error;
      await loadMe(data.user);
      linkError = null;
      route();
    });
  };
}

// Emails a reset link that leads to "Choose a Password". The page always says the same thing either way.
async function forgotPassword(btn) {
  const typed = $('#loginForm').elements.email.value.trim();
  const f = await ask({ title: 'Reset Password', ok: 'Send Link',
    body: `<p class="muted">Enter the email you sign in with. If it has an account, we'll email you a link to choose a new password.</p>
      <label>Email<input type="email" name="email" value="${esc(typed)}" autocomplete="email" required data-need="Enter your email."></label>` });
  if (!f) return;
  await busy(btn, async () => {
    const { error } = await sb.auth.resetPasswordForEmail(f.get('email').trim(), { redirectTo: (CONFIG.siteUrl || BASE) + '?setpw=1' });
    if (error) throw error;
    await ask({ title: 'Check Your Email', cancel: false,
      body: `<p>If ${esc(f.get('email').trim())} has an account, a link to reset your password is on its way. It can take a few minutes, so check your spam folder too.</p>` });
  });
}

function viewSetPassword() {
  authPage('Welcome back,', 'choose a password.', `
    <p>You'll sign in with <strong>${esc(me.user.email)}</strong> and this password from now on. Passwords must be at least 8 characters long.</p>
    <form id="pwForm" class="stack" data-nosave>
      <label>New Password<input type="password" name="pw" minlength="8" autocomplete="new-password" required data-need="Choose a password."></label>
      <label>Confirm Password<input type="password" name="pw2" minlength="8" autocomplete="new-password" required data-need="Enter the same password again."></label>
      <button class="fill">Save Password</button>
    </form>`, 'This is your password for the other apps too: they all share one sign-in.');
  $('#pwForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get('pw') !== f.get('pw2')) { const el = e.target.elements.pw2; fieldError(el, "The passwords don't match."); el.focus(); return; }
    busy(e.submitter, async () => {
      let { data, error } = await sb.auth.updateUser({ password: f.get('pw'), data: { password_set: true } });
      if (error?.code === 'same_password') ({ data, error } = await sb.auth.updateUser({ data: { password_set: true } }));
      if (error) throw error;
      me.user = data.user;
      wantsPassword = false;
      flash('Password saved.');
      route();
    });
  };
}

function viewNoAccess() {
  authPage('Hmm,', 'no access here.', `<p>You're signed in as <strong>${esc(me.user.email)}</strong>. Kiddo Draw is private to its owner.</p>`);
}

