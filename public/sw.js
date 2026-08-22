/* Proba Pera first-party offline shell. Editorial data remains network-first. */
const CACHE_VERSION = "probpera-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const STATIC_CACHE_LIMIT = 160;
const PAGE_CACHE_LIMIT = 40;
const scopeUrl = new URL(self.registration.scope);
const scopePath = scopeUrl.pathname.replace(/\/$/, "");
const scoped = (path) => `${scopePath}${path}` || "/";

function isCacheable(response) {
  return (
    response.ok &&
    !/\bno-store\b/iu.test(response.headers.get("Cache-Control") || "")
  );
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const overflow = requests.length - maxEntries;
  if (overflow <= 0) return;
  await Promise.all(
    requests.slice(0, overflow).map((request) => cache.delete(request))
  );
}

async function rememberResponse(cacheName, request, response, maxEntries) {
  if (!isCacheable(response)) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    await trimCache(cacheName, maxEntries);
  } catch {
    // Offline caching is an enhancement. A quota or CacheStorage failure must
    // never hide a fresh response that was already received from the network.
  }
}

async function cachedResponse(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    return await cache.match(request);
  } catch {
    return undefined;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled([
          cache.add(scoped("/site.webmanifest")),
          cache.add(scoped("/brand/probpera-logo.png")),
        ])
      )
      .then(() => trimCache(STATIC_CACHE, STATIC_CACHE_LIMIT))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() =>
        Promise.allSettled([
          trimCache(STATIC_CACHE, STATIC_CACHE_LIMIT),
          trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT),
        ])
      )
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await rememberResponse(PAGE_CACHE, request, response, PAGE_CACHE_LIMIT);
    return response;
  } catch {
    return (await cachedResponse(PAGE_CACHE, request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await cachedResponse(STATIC_CACHE, request);
  if (cached) return cached;
  const response = await fetch(request);
  await rememberResponse(STATIC_CACHE, request, response, STATIC_CACHE_LIMIT);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.endsWith(".json")) {
    event.respondWith(networkFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
