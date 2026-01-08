// Self-destructing service worker to unregister old Create React App service workers
// This file replaces the old CRA service-worker.js that was caching stale content
// It clears all caches, unregisters itself, and reloads the page to serve fresh content

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );

      // Unregister this service worker
      await self.registration.unregister();

      // Reload all open tabs to get fresh content
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Pass through all requests (don't cache anything)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
