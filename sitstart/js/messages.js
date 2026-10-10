// ---------- Messages (texting between a student and their coach) ----------
// One thread per student (the messages table). A student reads and sends in their own; only their coach reads and
// sends on the coach side. New messages arrive live (Supabase Realtime), the header's Messages button counts unread
// ones, and a device with notifications turned on gets a push (sw.js, supabase/functions/message-push).

const MSG_PAGE = 40;      // messages loaded at a time (Show Earlier loads the next lot)
const MSG_INBOX = 500;    // the newest messages the coach's inbox reads, for each thread's latest
const PUSH_OFF = 'sitstart.pushOff';   // localStorage: Turn Off was tapped on this device, so don't turn back on by itself
// Unread messages: mine from my coach (as a student), students[id] from each student I coach.
let msgNew = { mine: 0, students: {} };
let msgChan = null, msgFor = null;   // the live channel, and whose sign-in it is for
let msgCtx = null;                   // the open thread: { sid, own, list, more }

// Where the header's Messages button goes: a coach's inbox, a student's own thread (under My Training for staff who
// are also students but don't coach), or nowhere for admin-only staff.
const msgHome = () => !me ? null : me.isCoach ? '#/messages' : me.isStaff ? (me.student ? '#/me/messages' : null)
  : me.student ? '#/messages' : null;
const myThread = () => me.isStaff ? '#/me/messages' : '#/messages';
const msgCount = () => msgNew.mine + Object.values(msgNew.students).reduce((a, b) => a + b, 0);


// The unread counts, from the unread rows the database lets this person read (so no errors before the table exists).
async function loadUnread() {
  if (!me) return;
  const { data } = await sb.from('messages').select('student_id,from_coach').is('read_at', null);
  const n = { mine: 0, students: {} }, own = me?.student?.id;
  for (const r of data || []) {
    if (r.from_coach) { if (r.student_id === own) n.mine++; }
    else if (r.student_id !== own) n.students[r.student_id] = (n.students[r.student_id] || 0) + 1;
  }
  msgNew = n;
  drawMsgBadge();
}

// The header button's red count, the home screen icon's badge, and every [data-msg-n] on the page
// ("all", "mine" or a student's id), hidden at zero.
function drawMsgBadge() {
  const a = $('#msgLink'), href = msgHome(), n = href ? msgCount() : 0;
  a.hidden = !href;
  if (href) a.href = href;
  a.setAttribute('aria-label', n ? `Messages, ${n} unread` : 'Messages');
  const b = $('.badge', a);
  b.hidden = !n;
  b.textContent = n > 99 ? '99+' : n;
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
  for (const el of document.querySelectorAll('[data-msg-n]')) {
    const k = el.dataset.msgN, v = k === 'all' ? n : k === 'mine' ? msgNew.mine : msgNew.students[k] || 0;
    el.hidden = !v;
    el.textContent = v;
  }
}

// After sign-in (loadMe): count unread, listen for new messages, and keep this device's notifications going.
function msgStart() {
  if (!msgHome()) return msgStop();
  if (msgFor !== me.user.id) {
    msgStop();
    msgFor = me.user.id;
    msgChan = sb.channel('messages').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, msgEvent).subscribe();
    if (pushOK()) pushOn().catch(() => {});
  }
  loadUnread();
}
function msgStop() {
  if (msgChan) sb.removeChannel(msgChan);
  msgChan = msgFor = msgCtx = null;
  msgNew = { mine: 0, students: {} };
  drawMsgBadge();
}

// A message was added, read or deleted somewhere: recount, and bring the open thread or inbox up to date.
let msgTimer;
function msgSoon() {
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { loadUnread(); if ($('#msgInbox')) adminMessages(true); }, 400);
}
function msgEvent(p) {
  msgSoon();
  const c = $('#msgThread') && msgCtx, gone = p.eventType === 'DELETE' && p.old?.id;
  // A new message for me while I'm somewhere else in the app: say so on the page (sw.js shows no notification
  // while the app is on screen).
  const m = p.eventType === 'INSERT' && p.new;
  if (m && m.author_id !== me?.user.id && c?.sid !== m.student_id && !document.hidden) {
    if (m.from_coach) flash(`New message from ${m.author_name || 'your coach'}.`);
    else sb.from('students').select('name').eq('id', m.student_id).maybeSingle()
      .then(r => flash(`New message from ${r.data?.name || 'a student'}.`));
  }
  if (!c) return;
  if (gone) {
    if (c.list.some(m => m.id === gone)) { c.list = c.list.filter(m => m.id !== gone); msgDraw(); }
  } else if (p.new?.student_id === c.sid) { msgPut(p.new); msgDraw(); msgRead(); }
}
// A phone pauses the page in the background, so catch up when it comes back.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !me || !msgFor) return;
  msgSoon();
  const c = $('#msgThread') && msgCtx;
  if (!c) return;
  const page = await msgFetch(c.sid).catch(() => null);
  if (!page || c !== msgCtx) return;
  const first = page.rows[0]?.created_at;
  c.list = [...c.list.filter(m => first && m.created_at < first), ...page.rows];
  msgDraw();
  msgRead();
});

// ---------- A thread ----------

// The newest MSG_PAGE messages (before a time, for Show Earlier), oldest first. more: there are older ones.
async function msgFetch(sid, before) {
  let q = sb.from('messages').select('*').eq('student_id', sid).order('created_at', { ascending: false }).limit(MSG_PAGE + 1);
  if (before) q = q.lt('created_at', before);
  const rows = await q.then(must);
  return { more: rows.length > MSG_PAGE, rows: rows.slice(0, MSG_PAGE).reverse() };
}
function msgPut(row) {
  const list = msgCtx.list, i = list.findIndex(m => m.id === row.id);
  if (i >= 0) list[i] = row;
  else { list.push(row); list.sort((a, b) => a.created_at.localeCompare(b.created_at)); }
}

const msgTime = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
// Today, Yesterday, or "Wed, Oct 1" (with the year when it isn't this one).
function msgDay(t) {
  const d = new Date(t), now = new Date(), mid = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const ago = Math.round((mid(now) - mid(d)) / 864e5);
  return ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
}

// Bubbles like the plan notes: the reader's own on the right. A day line starts each day. The last of your own
// messages the other side has seen says Read.
function msgListHTML() {
  const { list, more, own } = msgCtx, mine = m => m.author_id === me.user.id;
  const lastRead = list.findLast(m => mine(m) && m.read_at)?.id;
  let prev = '';
  return (more ? '<div class="msg-more"><button type="button" class="small" data-msg-more>Show Earlier</button></div>' : '')
    + (list.map(m => {
      const d = msgDay(m.created_at), head = d !== prev ? `<p class="msg-day">${d}</p>` : '';
      prev = d;
      return `${head}<div class="note msg${mine(m) ? ' mine' : ''}"><p>${para(m.body)}</p>
        <div class="note-meta">${m.from_coach && !mine(m) ? `${esc(m.author_name || 'Coach')} · ` : ''}${msgTime(m.created_at)}${m.id === lastRead ? ' · Read' : ''}${
          mine(m) ? ` · <button type="button" class="link" data-del-msg="${m.id}">Delete</button>` : ''}</div></div>`;
    }).join('') || `<p class="muted msg-none">No messages yet.${own ? ' Say hi, or ask your coach a question.' : ''}</p>`);
}
// Redraws the bubbles, which scroll inside the card (so a long thread never makes a long page). Stays at the newest message if the reader was there (or toEnd), so a new one is in view.
function msgDraw(toEnd = false) {
  const box = $('#msgList');
  if (!box || !msgCtx) return;
  const atEnd = toEnd || box.scrollTop + box.clientHeight >= box.scrollHeight - 80;
  box.innerHTML = msgListHTML();
  if (atEnd) box.scrollTop = box.scrollHeight;
}
// Marks the other side's messages read once they are on screen (not while the page is in the background).
async function msgRead() {
  const c = msgCtx, theirs = m => !m.read_at && m.from_coach === c.own;
  if (!c || !c.canRead || !$('#msgThread') || document.hidden || !c.list.some(theirs)) return;
  const { error } = await sb.rpc('mark_messages_read', { p_student: c.sid });
  if (error) return;
  const now = new Date().toISOString();
  c.list.forEach(m => { if (theirs(m)) m.read_at = now; });
  loadUnread();
}

// A student's thread: their own (own, at #/messages or #/me/messages) or, for their coach, #/messages/<student id>.
// fromStudent: opened from the student page's Messages card (#/student/<id>/messages), so the trail and Back lead
// back there instead of to the inbox (the user asked).
async function msgThread(sid, fromStudent = false) {
  const t = ++navToken;
  const own = !!me.student && sid === me.student.id;
  view(loading);
  const [s, page, coaches] = await Promise.all([
    sb.from('students').select('*').eq('id', sid).maybeSingle().then(must),
    msgFetch(sid),
    own ? sb.rpc('coaches_of', { p_id: sid }).then(must) : [],
  ]);
  if (t !== navToken) return;
  if (!s) return redirect(own ? '#/' : '#/messages');
  const p = pro(s.pronouns), coach = coaches.find(c => c.is_current);
  const canSend = own ? !!s.coach_id : canCoach(s);
  msgCtx = { sid, own, list: page.rows, more: page.more, canRead: own || canSend };
  const why = own ? "You don't have a coach right now, so there's nobody to message."
    : `Only ${esc(s.first_name)}'s coach can message ${p.them}.`;

  view(`${crumbs(own ? [['Home', '#/'], ...(me.isStaff ? [['My Training', '#/me']] : []), ['Messages']]
      : fromStudent ? [['Home', '#/'], ['Students', '#/students'], [s.name, '#/student/' + sid], ['Messages']]
      : [['Home', '#/'], ['Messages', '#/messages'], [s.name]])}
    <div class="page-head"><div>${own ? `<h1>Messages</h1>${coach ? `<span class="eyebrow msg-with">With ${esc(coach.name)}</span>` : ''}`
      : `<span class="eyebrow">Messages</span><h1>${esc(s.name) + pronounsTag(s.pronouns)}</h1>`}</div>
      ${own || fromStudent ? '' : `<a href="#/student/${sid}">Open Student Page</a>`}</div>
    <section class="card msg-card" id="msgThread">
      <div id="pushBox"></div>
      <div id="msgList" class="msg-list"></div>
      ${canSend ? `<form id="msgForm" class="msg-form">
        <textarea name="body" rows="1" maxlength="4000" data-grow aria-label="Message"
          placeholder="Message ${own ? (coach ? esc(coach.name.split(' ')[0]) : 'your coach') : esc(s.first_name)}…"></textarea>
        <button class="fill">Send</button></form>` : `<p class="muted msg-why">${why}</p>`}
    </section>`);
  msgDraw(true);
  msgRead();
  drawPushBox(own ? 'your coach' : 'a student');

  $('#msgThread').onclick = async e => {
    const del = e.target.closest('[data-del-msg]');
    if (del) {
      if (!await ask({ title: 'Delete This Message?', body: "<p>It's removed for both of you. This can't be undone.</p>", ok: 'Delete', warn: true })) return;
      return busy(del, async () => {
        must(await sb.from('messages').delete().eq('id', del.dataset.delMsg));
        msgCtx.list = msgCtx.list.filter(m => m.id !== del.dataset.delMsg);
        msgDraw();
      });
    }
    const more = e.target.closest('[data-msg-more]');
    if (more) busy(more, async () => {
      const c = msgCtx, box = $('#msgList'), was = box.scrollHeight;
      const older = await msgFetch(sid, c.list[0].created_at);
      if (c !== msgCtx) return;
      c.list = [...older.rows, ...c.list];
      c.more = older.more;
      msgDraw();
      box.scrollTop = box.scrollHeight - was;   // the message that was on top stays put
    });
  };

  const form = $('#msgForm');
  if (!form) return;
  form.onsubmit = e => {
    e.preventDefault();
    const box = form.elements.body, body = box.value.trim(), send = form.querySelector('button');
    if (send.disabled) return;   // Enter again while the last one is still going
    if (!body) return box.focus();
    busy(send, async () => {
      const m = await sb.from('messages').insert({ student_id: sid, body, from_coach: !own }).select().single().then(must);
      box.value = '';
      grow(box);
      if (msgCtx?.sid === sid) { msgPut(m); msgDraw(true); }
      box.focus();
      // The other side's notification. It only works once push is set up (SETUP.md), and never holds up the page.
      // A device the push service turned down goes to the error log, so a missing notification can be traced.
      if (CONFIG.vapidKey) sb.functions.invoke('message-push', { body: { id: m.id } }).then(({ data }) => {
        console.info('message-push', data);
        if (data?.failed?.length) logError('push', 'A notification was not accepted', JSON.stringify(data.failed));
      }).catch(() => {});
    });
  };
  // Tapping Send leaves the focus in the box, so a phone's keyboard stays up instead of dropping and coming back.
  form.querySelector('button').onmousedown = e => e.preventDefault();
  // Enter sends with a keyboard (Shift+Enter for a new line); on a phone Enter is a new line and Send sends.
  form.elements.body.onkeydown = e => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || touch.matches) return;
    e.preventDefault();
    form.requestSubmit();
  };
}

// ---------- The coach's inbox ----------

// #/messages for a coach: a row per student they can message, the latest message first, then the rest A to Z.
// again: a quiet redraw when a message arrives.
async function adminMessages(again = false) {
  const t = again ? navToken : ++navToken;
  if (!again) view(loading);
  const [students, rows] = await Promise.all([
    sb.from('students').select('id,name,pronouns,email,coach_id,training_ended_at').order('name').then(must),
    sb.from('messages').select('student_id,from_coach,author_id,body,created_at').order('created_at', { ascending: false }).limit(MSG_INBOX).then(must),
  ]);
  if (t !== navToken || (again && !$('#msgInbox'))) return;
  const last = {};
  for (const r of rows) last[r.student_id] ??= r;
  const mine = students.filter(s => !isSelf(s) && (last[s.id] || (canCoach(s) && s.coach_id && !s.training_ended_at)))
    .sort((a, b) => (last[b.id]?.created_at || '').localeCompare(last[a.id]?.created_at || '') || a.name.localeCompare(b.name));
  const row = (href, name, m, key, you) => `<a class="person msg-row" href="${href}"><span class="ini">${initials(name)}</span>
    <span class="person-body"><span class="row between"><b>${esc(name)}</b>${m ? `<span class="muted msg-when">${msgDay(m.created_at) === 'Today' ? msgTime(m.created_at) : msgDay(m.created_at)}</span>` : ''}</span>
      <span class="person-sub msg-prev${m ? '' : ' blank'}">${m ? (you(m) ? 'You: ' : '') + esc(m.body.replace(/\*\*/g, '')) : 'No messages yet'}</span></span>
    <span class="msg-n" data-msg-n="${key}" hidden></span></a>`;
  const own = me.student && last[me.student.id] !== undefined || me.student?.coach_id
    ? row('#/me/messages', 'Your Coach', last[me.student.id], 'mine', m => !m.from_coach) : '';
  view(`${crumbs([['Home', '#/'], ['Messages']])}
    <div class="page-head"><h1>Messages</h1></div>
    <div id="msgInbox" class="msg-inbox"><div id="pushBox"></div>
      <div class="people">${own}${mine.map(s => row('#/messages/' + s.id, s.name, last[s.id], s.id, m => m.from_coach)).join('')}</div>
      ${own || mine.length ? '' : '<p class="muted">You\'re not coaching anyone yet, so there is nobody to message.</p>'}
    </div>`, { keepScroll: again });
  drawMsgBadge();
  drawPushBox('a student');
}

// The Messages card on a student's home page, and on the coach's student page (key: 'mine' or the student's id).
// The count is filled in as the card is drawn; drawMsgBadge keeps it right after that.
function msgCardHTML(href, blurb, key) {
  const n = key === 'mine' ? msgNew.mine : msgNew.students[key] || 0;
  return `<a class="card tile msg-tile" id="msgCard" href="${href}">
    <div><h2>Messages</h2><p class="muted">${blurb}</p></div><span class="msg-n" data-msg-n="${key}"${n ? '' : ' hidden'}>${n}</span>${ICON_ARROW}</a>`;
}

// ---------- Push notifications ----------
// A service worker (sw.js: it shows notifications and keeps pages fresh, storing nothing) and the browser's push address, saved
// in push_subscriptions. Off until CONFIG.vapidKey is set. iPhones only allow it for an app on the home screen.

const pushOK = () => !!CONFIG.vapidKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pushWasOff = () => { try { return !!localStorage.getItem(PUSH_OFF); } catch { return false; } };

// Saves this device's push address for the signed-in person. asked: from the Turn On button, so the browser may show
// its permission box (it must be the first thing the tap does). Otherwise it only refreshes one already allowed.
async function pushOn(asked = false) {
  if (!pushOK() || !me) return false;
  if (!asked && (Notification.permission !== 'granted' || pushWasOff())) return false;
  if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') return false;
  try { localStorage.removeItem(PUSH_OFF); } catch {}
  await navigator.serviceWorker.register('sw.js');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // Made with an older key: start again with this one.
  if (sub && sub.options.applicationServerKey && b64u(sub.options.applicationServerKey) !== CONFIG.vapidKey) { await sub.unsubscribe(); sub = null; }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(CONFIG.vapidKey) });
  const j = sub.toJSON();
  must(await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_agent: navigator.userAgent }));
  return true;
}
const pushSub = async () => (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
// Turn Off: this device stops for good (until Turn On). Sign Out (forget: false): it stops for this person, and
// starts again by itself when they sign back in.
async function pushOff(forget = true) {
  if (!pushOK()) return;
  if (forget) try { localStorage.setItem(PUSH_OFF, '1'); } catch {}
  const sub = await pushSub();
  if (!sub) return;
  await sb.rpc('drop_push_subscription', { p_endpoint: sub.endpoint });
  if (forget) await sub.unsubscribe();
}
async function pushState() {
  if (!CONFIG.vapidKey) return 'none';
  if (!pushOK()) return /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone ? 'ios' : 'none';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && await pushSub() ? 'on' : 'off';
}
// The notifications line at the top of a thread or the inbox (#pushBox). who: "your coach" or "a student".
async function drawPushBox(who) {
  const state = await pushState().catch(() => 'none'), box = $('#pushBox');
  if (!box) return;
  box.innerHTML = state === 'off' ? `<div class="push-box"><span>Get a notification on this device when ${who} messages you.</span>
      <button type="button" class="primary small" data-push="on">Turn On Notifications</button></div>`
    : state === 'on' ? '<p class="hint push-hint">Notifications are on for this device. <button type="button" class="link" data-push="off">Turn Off</button></p>'
    : state === 'blocked' ? '<p class="hint push-hint">Notifications are blocked for this site. Allow them in your browser or phone settings to get one when a message arrives.</p>'
    : state === 'ios' ? `<p class="hint push-hint">To get notifications on an iPhone, install the app first: tap Share ${SHARE_ICON} then <b>Add to Home Screen</b>, and open it from there.</p>`
    : '';
  box.onclick = e => {
    const b = e.target.closest('[data-push]');
    if (b) busy(b, async () => {
      if (b.dataset.push === 'off') await pushOff();
      else if (!await pushOn(true)) flash('Notifications weren\'t allowed, so they stay off.', 'error');
      await drawPushBox(who);
    });
  };
}
// Registered on every load, with or without notifications: sw.js also keeps the app on its newest version.
navigator.serviceWorker?.register('sw.js').catch(() => {});
// Tapping a notification while the app is open: the service worker says which thread to show.
navigator.serviceWorker?.addEventListener('message', e => {
  if (typeof e.data?.go === 'string' && e.data.go.startsWith('#/')) location.hash = e.data.go;
});
