const CACHE_NAME = 'fungolf-static-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(loadFromNetwork(request));
});

async function loadFromNetwork(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      return (await caches.match('./index.html')) || (await caches.match('index.html')) || new Response('오프라인', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response('오프라인', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
