// Top Out's service worker. It only keeps the app on its newest version, and stores nothing (no offline copy).

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