// FIRE's service worker. It only keeps the app on its newest version, and stores nothing (no offline copy).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Always the newest version: the web host lets a browser keep the site's files for 10 minutes without asking, so every
// request for one of the site's own files asks the server whether it has changed. Supabase and fonts are left alone.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }));
});
