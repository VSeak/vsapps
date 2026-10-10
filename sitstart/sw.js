// Sit Start's service worker. It keeps the app on its newest version, shows push notifications for new messages
// (js/messages.js) and opens the thread when one is tapped. It stores nothing, so there is no offline copy to go stale.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Always the newest version (the user asked): the web host lets a browser keep the site's files for 10 minutes without
// asking, so an update could take that long to show. Every request for one of the site's own files asks the server
// whether it has changed (a tiny answer when it hasn't). Supabase, fonts and other sites are left alone.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }));
});

// iPhones and iPads (Safari) stop delivering to an app that gets a push and shows nothing, so there a notification
// is always shown. Everywhere else, none while the app is on screen: the page says "New message from …" itself.
const mustShow = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !/Chrome|Chromium|Firefox|Edg/.test(navigator.userAgent);
const appWindows = async () => (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
  .filter(c => c.url.startsWith(self.registration.scope));

// A push from the message-push Edge Function: { title, body, url } (url is the page's hash, e.g. #/messages).
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch {}
  e.waitUntil((async () => {
    if (!mustShow && (await appWindows()).some(c => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || 'Sit Start', {
      body: d.body || 'You have a new message.',
      icon: 'icon-512.png',
      badge: 'push-badge.png',    // Android's small status bar icon: the Sit Start mark in white (a bell without it)
      tag: d.url || 'messages',   // one notification per thread: a newer message replaces the last
      renotify: true,
      data: { url: typeof d.url === 'string' && d.url.startsWith('#/') ? d.url : '#/' },
    });
  })());
});

// Tapped: show the thread in the app if it's open (the page listens for { go }), or open it.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = e.notification.data?.url || '#/';
  e.waitUntil((async () => {
    const open = (await appWindows())[0];
    if (!open) return self.clients.openWindow(self.registration.scope + go);
    open.postMessage({ go });
    return open.focus();
  })());
});
