// ---- The same Supabase project as Sit Start, Top Out and FIRE (see SETUP.md) ----
const CONFIG = {
  siteName: "Kiddo Draw",
  supabaseUrl: "https://loxyrqffevvdhwltccxr.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxveHlycWZmZXZ2ZGh3bHRjY3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNzc5NzAsImV4cCI6MjEwNTk1Mzk3MH0.czgnKpu18kuEghIC3Ixy6jR-AFvBHQVH7rDDqmFF_EI",   // the publishable (or "anon") key. Never the secret key.
  siteUrl: "https://vseak.github.io/vsapps/christmas/",   // where emailed reset links go, even when sent from localhost. "" = the current address.
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const BASE = location.origin + location.pathname;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const must = ({ data, error }) => { if (error) throw error; return data; };
const loading = '<p class="muted">Loading…</p>';

let sb;
let me = null;               // {user, isOwner}
let wantsPassword = new URLSearchParams(location.search).has('setpw');
let linkError = null;        // from an expired or used email link
let currentHash = location.hash;
let navToken = 0;            // a page checks it after each await, so a slow page never draws over a newer one

if (location.hash && !location.hash.startsWith('#/')) {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('error_code') === 'otp_expired') linkError = 'That link has expired or was already used. Use Forgot Password below to get a new one.';
  else if (h.get('error_description')) linkError = h.get('error_description');
}

// ---------- Helpers ----------

// A redraw after a save skips the Loading step and keeps the scroll (redrawing, set by redraw()).
let redrawing = false;
function view(html, { keepScroll = false } = {}) {
  if (html === loading && redrawing) return;
  if (redrawing) { keepScroll = true; redrawing = false; }
  app.oninput = app.onchange = app.onclick = app.onsubmit = app.onkeydown = null;
  app.innerHTML = html;
  markUnsaved();   // Save buttons start greyed out
  if (!keepScroll) window.scrollTo(0, 0);
}

let flashTimer;
function flash(msg, kind = 'ok') {
  const f = $('#flash');
  f.textContent = msg; f.className = kind; f.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { f.hidden = true; }, kind === 'error' ? 7000 : 3500);
}

// ---------- Error log ----------
// Unexpected errors and server calls over 4 seconds (skewFetch) go to the shared app_errors table
// (supabase-shared/2026-10-03-app-errors.sql). The app can only add rows. At most 10 a page load, each message once.
// Messages never hold names: they come from the code or the server, not from what was typed.
const logged = new Set();
function logError(kind, message, detail = '') {
  message = String(message ?? '').slice(0, 1000);
  if (!sb || !message || logged.size >= 10 || logged.has(kind + message)) return;
  if (/invalid login credentials|failed to fetch|load failed|networkerror|_fkey|duplicate key|^Script error.?$|ResizeObserver loop/i.test(message)) return;
  logged.add(kind + message);
  sb.from('app_errors').insert({ app: 'christmas', kind, message, detail: String(detail ?? '').slice(0, 4000),
    page: location.hash.slice(0, 300), user_agent: navigator.userAgent.slice(0, 300) }).then(() => {}, () => {});
}
window.addEventListener('error', e => logError('error', e.message, e.error?.stack || `${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', e => logError('error', e.reason?.message ?? e.reason, e.reason?.stack));

function msgOf(e) {
  const m = e?.message || String(e);
  logError('error', m, e?.stack);
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Forgot your password? Tap Forgot Password below.";
  if (/failed to fetch/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
  if (/does not exist|could not find the function|schema cache/i.test(m)) return m + ' (Has christmas/supabase/schema.sql been run?)';
  if (/xmas_picks_(kid|adult)_id_fkey/.test(m)) return "They're in a saved year, so they can't be deleted. Take them out of the draw instead.";
  return m;
}

async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (e) { flash(msgOf(e), 'error'); }
  finally { if (btn) btn.disabled = false; }
}

// Field errors: a red field with a message under it, instead of the browser's pop-up.
// Each required field says what to do in data-need. Typing in the field clears it.
function fieldError(el, msg) {
  clearFieldError(el);
  el.setAttribute('aria-invalid', 'true');
  const err = document.createElement('span');
  err.className = 'field-error';
  err.id = 'err-' + Math.random().toString(36).slice(2);
  err.textContent = msg;
  el.setAttribute('aria-describedby', err.id);
  const label = el.closest('label');
  if (label) label.append(err); else el.after(err);
}
function clearFieldError(el) {
  if (el.getAttribute('aria-invalid') !== 'true') return;
  el.removeAttribute('aria-invalid');
  document.getElementById(el.getAttribute('aria-describedby'))?.remove();
  el.removeAttribute('aria-describedby');
}

// A small red * after the label of every required field (both other apps do the same).
function markRequired() {
  const want = new Set();
  for (const el of document.querySelectorAll(':is(input, select, textarea)[required]:not([type="checkbox"], [type="radio"])')) {
    const label = el.closest('label');
    if (label) want.add(label);
  }
  for (const star of document.querySelectorAll('.req')) if (!want.has(star.parentElement)) star.remove();
  for (const label of want) {
    if (label.querySelector(':scope > .req')) continue;
    const star = Object.assign(document.createElement('span'), { className: 'req', textContent: '*' });
    star.setAttribute('aria-hidden', 'true');
    const text = [...label.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    // A label whose words are in a span (one the page rewrites, like Yearly Salary / Hourly Rate): the star goes after it.
    if (!text) { const lead = label.firstElementChild; if (lead?.matches('span:not(.unit)')) lead.after(star); else label.prepend(star); continue; }
    const end = text.textContent.trimEnd().length;
    if (end < text.textContent.length) text.splitText(end);
    text.after(star);
  }
}
new MutationObserver(markRequired).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['required'] });
function validityMsg(el) {
  const v = el.validity;
  if (v.valueMissing || v.customError) return el.dataset.need || 'Fill this in.';
  if (v.typeMismatch && el.type === 'email') return 'Enter a full email address, like name@example.com.';
  if (v.patternMismatch) return 'Enter a number, like 1250.50.';
  if (v.rangeUnderflow || v.rangeOverflow) return el.dataset.range || el.validationMessage;
  if (v.tooShort) return `Use at least ${el.minLength} characters.`;
  return el.validationMessage;
}
let focusedError = false;
document.addEventListener('invalid', e => {
  e.preventDefault();
  fieldError(e.target, validityMsg(e.target));
  if (!focusedError) { focusedError = true; e.target.focus(); setTimeout(() => { focusedError = false; }); }
}, true);
document.addEventListener('input', e => {
  if (e.target.matches?.('input, textarea, select')) clearFieldError(e.target);
}, true);

// One <dialog>. Returns the form's FormData when confirmed, or null. Settles on submit, not close.
// extra: another button beside OK, e.g. Delete; its value comes back as FormData's 'button'. onOpen(form) wires fields.
function ask({ title, body = '', ok = 'OK', warn = false, cancel = true, wide = false, extra = null, onOpen = null }) {
  const d = $('#dlg');
  d.className = wide ? 'wide' : '';
  d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${body}
    <div class="row end">${extra ? `<button value="${extra.value}" formnovalidate class="ghost danger push-left">${esc(extra.label)}</button>` : ''}
    ${cancel ? '<button value="cancel" formnovalidate class="ghost">Cancel</button>' : ''}
    <button value="ok" class="${warn ? 'risky' : 'fill'}">${esc(ok)}</button></div></form>`;
  return new Promise(resolveNow => {
    const f = d.querySelector('form');
    // Back closes the dialog (the user asked): opening it adds a history step with the same address, and closing it
    // any other way takes that step back first, so a goTo or replaceState after the answer lands on the right entry.
    history.pushState({ dlg: true }, '');
    let popped = false, settled = false;
    const onPop = () => { popped = true; if (d.open) d.close(); };
    addEventListener('popstate', onPop);
    const resolve = v => {
      if (settled) return;
      settled = true;
      removeEventListener('popstate', onPop);
      if (popped || !history.state?.dlg) return resolveNow(v);
      addEventListener('popstate', () => resolveNow(v), { once: true });
      history.back();
    };
    // Enter in a field means OK. (The browser would press the first button in the form, which is Cancel.)
    f.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || !e.target.matches('input:not([type="button"], [type="submit"])')) return;
      e.preventDefault();
      f.requestSubmit(f.querySelector('button[value="ok"]'));
    });
    f.addEventListener('submit', e => {
      const v = e.submitter?.value;
      if (v === 'ok') resolve(new FormData(f));
      else if (extra && v === extra.value) { const fd = new FormData(f); fd.set('button', v); resolve(fd); }
      else resolve(null);
    }, { once: true });
    d.addEventListener('cancel', () => resolve(null), { once: true });
    const onClose = () => { if (d.open && f.isConnected) return; d.removeEventListener('close', onClose); resolve(null); };
    d.addEventListener('close', onClose);
    d.showModal();
    // On a touch screen, don't open with the keyboard up over the dialog.
    if (matchMedia('(pointer: coarse)').matches && document.activeElement?.matches('input:not([type="checkbox"], [type="radio"]), textarea')) {
      d.tabIndex = -1;
      d.focus();
    }
    onOpen?.(f);
  });
}
const confirmDelete = (title, body) => ask({ title, body: `<p>${body}</p>`, ok: 'Delete', warn: true });

// The full trail from Home, with a Back button to the page one level up.
function crumbs(items) {
  const up = items.filter(([, href]) => href).at(-1)?.[1];
  return `<div class="crumb-bar">${up ? `<a class="back" href="${up}">‹ Back</a>` : ''}
    <nav class="crumbs" aria-label="Breadcrumb">${items.map(([label, href]) =>
    href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`).join('<span>/</span>')}</nav></div>`;
}

// ---------- The year ----------

// The Christmas a draw is for: this calendar year.
const thisYear = () => new Date().getFullYear();
const Cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- Install banner ----------
// On a phone, a banner under the header offers to put the app on the home screen. Android's Install opens its own box;
// iPhones have none, so there it says how. Never once installed; Not Now hides it on this device for 30 days.
const INSTALL_LATER = 'christmas.installLater';
const SHARE_ICON = '<svg class="share-ic" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg>';
let installBox = null;
function installBanner(how) {
  const bar = $('#installBar');
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  if (!matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) > 600) return;   // phones only
  try { if (Date.now() < +localStorage.getItem(INSTALL_LATER)) return; } catch {}
  $('p', bar).innerHTML = how === 'ios'
    ? `Install the ${esc(CONFIG.siteName)} web app on your phone!<br><small>Tap Share ${SHARE_ICON} then <b>Add to Home Screen</b>.</small>`
    : `Install the ${esc(CONFIG.siteName)} web app on your phone!`;
  $('[data-install="go"]', bar).hidden = how === 'ios';
  bar.hidden = false;
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installBox = e; installBanner('android'); });
window.addEventListener('appinstalled', () => { $('#installBar').hidden = true; });
if (/iPhone|iPod/.test(navigator.userAgent) && /Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) installBanner('ios');
$('#installBar').addEventListener('click', async e => {
  const b = e.target.closest('[data-install]');
  if (!b) return;
  if (b.dataset.install === 'go' && installBox) {
    installBox.prompt();
    const { outcome } = await installBox.userChoice;
    installBox = null;
    if (outcome !== 'accepted') return;
  } else try { localStorage.setItem(INSTALL_LATER, Date.now() + 30 * 864e5); } catch {}
  $('#installBar').hidden = true;
});

// ---------- Always the newest version ----------
navigator.serviceWorker?.register('sw.js').catch(() => {});
