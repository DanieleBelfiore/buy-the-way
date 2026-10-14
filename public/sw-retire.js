/*
 * Retiring service worker for the old domain buy-the-way.danielebelfiore.dev.
 * netlify.toml serves this file as /sw.js on that host only.
 *
 * PWAs installed from the old domain keep a service worker that answers
 * every navigation from its cache, so the 301 to buytheway.app never runs.
 * When that worker checks for an update it gets this script instead: it
 * takes over, drops the caches, unregisters itself and reloads its windows,
 * so the next request reaches the network and follows the redirect.
 * See tasks/domain-migration.md.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    })(),
  );
});
