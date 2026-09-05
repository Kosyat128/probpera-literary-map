/** Bundled, integrity-bound application shell. Never an entitlement or child-policy authority. */
const PREFIX = "literary-planet-pwa-v1-";
const SHA256 = /^[a-f0-9]{64}$/u;
const SCOPE = "/planet/";
const MAX_FILES = 512;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_MARKER_BYTES = 512 * 1024;
const MARKER_PATH = SCOPE + "__pwa_complete__";
const SELECTION_PATH = SCOPE + "__pwa_selection__";
const CLIENT_PATH = SCOPE + "__pwa_client__/";
const PRIVATE_PATH = /\/(?:api|auth|login|logout|license|licenses|entitlements|private|admin|cms|child|children|parent|purchase|billing|payments)(?:\/|$)/iu;
const STATE_QUERY = new Set(["country", "writer", "atlas", "atlasView", "book", "archiveShelf"]);
const encoder = new TextEncoder();

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, allowed, required = allowed) {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) throw new Error("Invalid shell configuration fields");
}
function safePath(input, origin) {
  if (typeof input !== "string" || input.length > 512 || !input.startsWith(SCOPE) || /[\u0000-\u0020\u007f\\?#]/u.test(input)) throw new Error("Shell file must have an exact local scoped pathname");
  const url = new URL(input, origin);
  let decoded;
  try { decoded = decodeURIComponent(input); } catch { throw new Error("Invalid shell pathname encoding"); }
  if (url.origin !== origin || url.pathname !== input || PRIVATE_PATH.test(decoded) || /[\u0000-\u001f\u007f\\?#%]/u.test(decoded) || decoded.includes("/../") || decoded.includes("/./") || decoded.includes("//") || decoded.startsWith(SCOPE + "__pwa_")) throw new Error("Unsafe shell pathname");
  return input;
}
export function normalizePwaWorkerConfig(input, origin = "https://probpera.ru") {
  exactKeys(input, ["schemaVersion", "scopePath", "buildId", "entrypoints", "files", "rollbackReference"], ["schemaVersion", "scopePath", "buildId", "entrypoints", "files"]);
  if (input.schemaVersion !== 1 || input.scopePath !== SCOPE || !SHA256.test(input.buildId)) throw new Error("Unsupported shell identity or scope");
  exactKeys(input.entrypoints, ["root", "ru", "en"], ["ru", "en"]);
  if (input.entrypoints.ru !== SCOPE + "ru/" || input.entrypoints.en !== SCOPE + "en/" || (Object.hasOwn(input.entrypoints, "root") && input.entrypoints.root !== SCOPE)) throw new Error("Exact root and RU/EN shell entrypoints are required");
  if (!Array.isArray(input.files) || input.files.length < 2 || input.files.length > MAX_FILES) throw new Error("Invalid shell file count");
  const routes = new Set();
  let total = 0;
  const files = input.files.map((file) => {
    exactKeys(file, ["url", "bytes", "sha256", "kind", "aliases"], ["url", "bytes", "sha256", "kind"]);
    const url = safePath(file.url, origin);
    if (routes.has(url) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_FILE_BYTES || !SHA256.test(file.sha256) || !["shell", "asset"].includes(file.kind)) throw new Error("Invalid or duplicate shell file");
    if ((file.kind === "shell") !== Object.values(input.entrypoints).includes(url)) throw new Error("Shell HTML must be one of the explicit locale entrypoints");
    routes.add(url);
    total += file.bytes;
    const aliases = file.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.length > 4 || (file.kind === "shell" && aliases.length)) throw new Error("Invalid immutable asset aliases");
    for (const alias of aliases) {
      if (typeof alias !== "string" || alias.length > 640 || !alias.startsWith(url + "?v=") || !/^[A-Za-z0-9._-]{1,96}$/u.test(alias.slice(url.length + 3)) || routes.has(alias)) throw new Error("Only exact version aliases for the same immutable asset are permitted");
      routes.add(alias);
    }
    return Object.freeze({ url, bytes: file.bytes, sha256: file.sha256, kind: file.kind, aliases: Object.freeze([...aliases].sort()) });
  }).sort((left, right) => left.url < right.url ? -1 : left.url > right.url ? 1 : 0);
  if (total > MAX_TOTAL_BYTES || !Object.values(input.entrypoints).every((url) => files.some((file) => file.url === url && file.kind === "shell"))) throw new Error("Shell budget or locale coverage is invalid");
  let rollbackReference;
  if (Object.hasOwn(input, "rollbackReference")) {
    const reference = input.rollbackReference;
    exactKeys(reference, ["buildId", "manifestSha256", "routes"]);
    if (!SHA256.test(reference.buildId) || reference.buildId === input.buildId || !SHA256.test(reference.manifestSha256) || !Array.isArray(reference.routes) || reference.routes.length < 2 || reference.routes.length > MAX_FILES * 5) throw new Error("Invalid rollback anchor");
    let previous = "";
    for (const route of reference.routes) {
      if (typeof route !== "string" || route <= previous) throw new Error("Unsorted or duplicate rollback route");
      const query = route.indexOf("?");
      safePath(query < 0 ? route : route.slice(0, query), origin);
      if (query >= 0 && !/^\?v=[A-Za-z0-9._-]{1,96}$/u.test(route.slice(query))) throw new Error("Unsafe rollback route alias");
      previous = route;
    }
    rollbackReference = Object.freeze({ buildId: reference.buildId, manifestSha256: reference.manifestSha256, routes: Object.freeze([...reference.routes]) });
  }
  const entrypoints = Object.freeze({ ...(Object.hasOwn(input.entrypoints, "root") ? { root: SCOPE } : {}), ru: SCOPE + "ru/", en: SCOPE + "en/" });
  const config = Object.freeze({ schemaVersion: 1, scopePath: SCOPE, buildId: input.buildId, entrypoints, files: Object.freeze(files), ...(rollbackReference ? { rollbackReference } : {}) });
  if (encoder.encode(JSON.stringify(config)).byteLength > MAX_MARKER_BYTES / 2) throw new Error("Shell configuration exceeds metadata budget");
  return config;
}

/** Register listeners on an injected ServiceWorkerGlobalScope; no network during setup. */
export function installPwaWorker(worker, input) {
  const origin = new URL(worker.location.href).origin;
  const scope = new URL(worker.registration.scope);
  if (scope.origin !== origin || scope.pathname !== SCOPE || scope.search || scope.hash) throw new Error("Worker registration scope does not match the PWA boundary");
  const config = normalizePwaWorkerConfig(input, origin);
  const cacheName = PREFIX + config.buildId;
  const markerUrl = new URL(MARKER_PATH, origin).href;
  const selectionUrl = new URL(SELECTION_PATH, origin).href;
  const generation = manifest => Object.freeze({ config: manifest, cacheName: PREFIX + manifest.buildId, entries: new Map(manifest.files.flatMap(file => [file.url, ...file.aliases].map(url => [url, file]))) });
  const engine = generation(config);
  const knownRoutes = new Set([...engine.entries.keys(), ...(config.rollbackReference?.routes ?? [])]);
  let selected = engine, selectionPromise, selectionInvalid = false, blockedClientId = null, rollbackPending = false;
  const ResponseClass = worker.Response ?? Response;
  const RequestClass = worker.Request ?? Request;
  const later = worker.setTimeout?.bind(worker) ?? setTimeout;
  const cancelTimer = worker.clearTimeout?.bind(worker) ?? clearTimeout;
  let fingerprint;
  const sha256 = async (bytes) => [...new Uint8Array(await worker.crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const configHash = () => fingerprint ??= sha256(encoder.encode(JSON.stringify(config)));

  async function readBounded(response, limit) {
    if (!response.body) throw new Error("Missing shell response body");
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel("Shell byte budget exceeded"); throw new Error("Shell byte budget exceeded"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }
  async function verifiedResponse(response, file, buildId) {
    if (!response || response.status !== 200 || response.redirected || ["opaque", "opaqueredirect", "error"].includes(response.type) || /\b(?:no-store|private)\b/iu.test(response.headers.get("Cache-Control") ?? "") || /(?:^|,)\s*(?:\*|cookie|authorization)\s*(?:,|$)/iu.test(response.headers.get("Vary") ?? "")) throw new Error("Shell response is not immutable public content");
    if (response.url && response.url !== new URL(file.url, origin).href) throw new Error("Shell response URL changed");
    const mediaType = (response.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase();
    const requiredMediaTypes = file.kind === "shell" ? ["text/html"]
      : /\.(?:m?js)$/iu.test(file.url) ? ["text/javascript", "application/javascript"]
        : /\.css$/iu.test(file.url) ? ["text/css"]
          : /\.(?:geo)?json$/iu.test(file.url) ? ["application/json", "application/geo+json"] : null;
    if (requiredMediaTypes && !requiredMediaTypes.includes(mediaType)) throw new Error("Shell response has an unusable Content-Type");
    const bytes = await readBounded(response, file.bytes);
    if (bytes.byteLength !== file.bytes || await sha256(bytes) !== file.sha256) throw new Error("Shell integrity mismatch");
    const headers = new Headers(response.headers);
    headers.delete("Content-Encoding");
    headers.delete("Transfer-Encoding");
    headers.delete("Set-Cookie");
    headers.set("Content-Length", String(bytes.byteLength));
    headers.set("X-Literary-Planet-Build", buildId);
    return new ResponseClass(bytes, { status: 200, headers });
  }
  async function download(file, buildId = config.buildId) {
    const controller = new AbortController();
    const timeout = later(() => controller.abort(), 30_000);
    try {
      const request = new RequestClass(new URL(file.url, origin).href, { credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal });
      return await verifiedResponse(await worker.fetch(request), file, buildId);
    } finally { cancelTimer(timeout); }
  }
  async function readMarker(name) {
    if (!new RegExp("^" + PREFIX + "[a-f0-9]{64}$", "u").test(name)) return null;
    try {
      if (!(await worker.caches.keys()).includes(name)) return null;
      const cache = await worker.caches.open(name);
      const response = await cache.match(markerUrl);
      if (!response) return null;
      const marker = JSON.parse(new TextDecoder().decode(await readBounded(response, MAX_MARKER_BYTES)));
      exactKeys(marker, ["state", "manifestSha256", "completedAt", "activationSequence", "manifest"]);
      if (marker.state !== "COMPLETE" || !SHA256.test(marker.manifestSha256) || !Number.isSafeInteger(marker.completedAt) || marker.completedAt < 0 || !Number.isSafeInteger(marker.activationSequence) || marker.activationSequence < 0) return null;
      const manifest = normalizePwaWorkerConfig(marker.manifest, origin);
      if (name !== PREFIX + manifest.buildId || marker.manifestSha256 !== await sha256(encoder.encode(JSON.stringify(manifest)))) return null;
      return { ...marker, manifest };
    } catch { return null; }
  }
  async function verifyCache(name, manifest) {
    const cache = await worker.caches.open(name);
    for (const file of manifest.files) await verifiedResponse(await cache.match(new URL(file.url, origin).href), file, manifest.buildId);
  }
  async function currentComplete(verifyFiles = false) {
    const marker = await readMarker(cacheName);
    if (!marker || marker.manifestSha256 !== await configHash()) return false;
    if (verifyFiles) {
      try { await verifyCache(cacheName, config); } catch { return false; }
    }
    return true;
  }
  async function anchoredPrevious() {
    const reference = config.rollbackReference;
    if (!reference) return null;
    const current = await readMarker(cacheName);
    if (!current || current.manifestSha256 !== await configHash() || current.activationSequence < 1) return null;
    const previous = await readMarker(PREFIX + reference.buildId);
    if (!previous || previous.activationSequence < 1 || previous.activationSequence !== current.activationSequence - 1 || previous.manifestSha256 !== reference.manifestSha256) return null;
    // A previous engine that already rolled back did not last serve its own
    // application build. Do not label that superseded build "previous".
    if (await (await worker.caches.open(PREFIX + reference.buildId)).match(selectionUrl)) return null;
    const routes = previous.manifest.files.flatMap(file => [file.url, ...file.aliases]).sort();
    if (JSON.stringify(routes) !== JSON.stringify(reference.routes)) return null;
    await verifyCache(PREFIX + reference.buildId, previous.manifest);
    return generation(previous.manifest);
  }
  async function loadSelection() {
    return selectionPromise ??= (async () => {
      const cache = await worker.caches.open(cacheName);
      const response = await cache.match(selectionUrl);
      if (!response) return selected;
      try {
        const marker = JSON.parse(new TextDecoder().decode(await readBounded(response, 4096)));
        exactKeys(marker, ["schemaVersion", "engineBuildId", "buildId", "manifestSha256", "requestedBy"]);
        if (marker.schemaVersion !== 1 || marker.engineBuildId !== config.buildId || marker.buildId !== config.rollbackReference?.buildId || marker.manifestSha256 !== config.rollbackReference.manifestSha256 || typeof marker.requestedBy !== "string" || !marker.requestedBy || marker.requestedBy.length > 256) throw new Error("Invalid selected generation");
        const previous = await anchoredPrevious();
        if (!previous) throw new Error("Selected generation is no longer verified");
        selected = previous; blockedClientId = marker.requestedBy;
      } catch { selectionInvalid = true; }
      return selected;
    })();
  }
  async function install() {
    const cache = await worker.caches.open(cacheName);
    if (await cache.match(markerUrl)) {
      if (await currentComplete(true)) return;
      throw new Error("Existing completed cache is incompatible or damaged; do not overwrite it");
    }
    // This build's cache is a candidate until its final COMPLETE marker exists.
    // Different build IDs and all other applications remain untouched on failure.
    try {
      for (const request of await cache.keys()) await cache.delete(request);
      for (const file of config.files) await cache.put(new URL(file.url, origin).href, await download(file));
      const marker = { state: "COMPLETE", manifestSha256: await configHash(), completedAt: Date.now(), activationSequence: 0, manifest: config };
      await cache.put(markerUrl, new ResponseClass(JSON.stringify(marker), { headers: { "Content-Type": "application/json" } }));
    } catch (error) {
      await worker.caches.delete(cacheName).catch(() => undefined);
      throw error;
    }
  }
  async function activate() {
    if (!await currentComplete(true)) throw new Error("Cannot activate an incomplete shell");
    const owned = (await worker.caches.keys()).filter((name) => new RegExp("^" + PREFIX + "[a-f0-9]{64}$", "u").test(name) && name !== cacheName);
    const candidates = [];
    for (const name of owned) { const marker = await readMarker(name); if (marker) candidates.push({ name, marker }); }
    // Installation time is not activation order: clocks can move backwards and
    // a waiting package may never have served a client. Only activated builds
    // qualify as the previous generation; their sequence does not use a clock.
    candidates.sort((a, b) => b.marker.activationSequence - a.marker.activationSequence || a.name.localeCompare(b.name));
    let previous;
    for (const candidate of candidates.filter(({ marker }) => marker.activationSequence > 0)) {
      try {
        await verifyCache(candidate.name, candidate.marker.manifest);
        const selectionResponse = await (await worker.caches.open(candidate.name)).match(selectionUrl);
        if (selectionResponse) {
          const selection = JSON.parse(new TextDecoder().decode(await readBounded(selectionResponse, 4096)));
          exactKeys(selection, ["schemaVersion", "engineBuildId", "buildId", "manifestSha256", "requestedBy"]);
          const reference = candidate.marker.manifest.rollbackReference;
          if (selection.schemaVersion !== 1 || selection.engineBuildId !== candidate.marker.manifest.buildId || !reference || selection.buildId !== reference.buildId || selection.manifestSha256 !== reference.manifestSha256) continue;
          const restored = await readMarker(PREFIX + reference.buildId);
          if (!restored || restored.manifestSha256 !== reference.manifestSha256 || restored.activationSequence !== candidate.marker.activationSequence - 1) continue;
          await verifyCache(PREFIX + reference.buildId, restored.manifest);
          previous = PREFIX + reference.buildId;
        } else previous = candidate.name;
        break;
      } catch { /* Keep searching for the last intact prior app build. */ }
    }
    const currentMarker = await readMarker(cacheName);
    const activationSequence = Math.max(currentMarker.activationSequence, ...candidates.map(({ marker }) => marker.activationSequence)) + 1;
    if (!Number.isSafeInteger(activationSequence)) throw new Error("Activation sequence exhausted");
    const currentCache = await worker.caches.open(cacheName);
    await currentCache.put(markerUrl, new ResponseClass(JSON.stringify({ ...currentMarker, activationSequence }), { headers: { "Content-Type": "application/json" } }));
    // A new explicit worker activation selects its own complete app generation.
    // A later rollback selection belongs only to this engine build.
    await currentCache.delete(selectionUrl);
    selected = engine; selectionPromise = Promise.resolve(engine); selectionInvalid = false; blockedClientId = null;
    // Keep one intact previous package, and never serve its files as a mixed
    // fallback for this build. Failed installs leave its existing worker active.
    await Promise.all(owned.filter((name) => name !== previous).map((name) => worker.caches.delete(name).catch(() => false)));
    await worker.clients.claim();
  }
  function classifyRequest(request) {
    if (request.method !== "GET" || request.headers.has("authorization") || request.headers.has("range") || request.headers.has("x-api-key") || request.headers.has("x-cms-edit")) return null;
    let url;
    try { url = new URL(request.url); } catch { return null; }
    if (url.origin !== origin || !url.pathname.startsWith(SCOPE) || url.username || url.password) return null;
    if (request.mode === "navigate") {
      if (!Object.values(config.entrypoints).includes(url.pathname)) return null;
      // The canonical app keeps its current view in #atlas. A fragment belongs
      // to the document state, not the network/cache key. WindowClient.url keeps
      // it even when a browser removes it from the navigation Request URL.
      try {
        if (url.hash.length > 512 || /[\u0000-\u001f\u007f]/u.test(decodeURIComponent(url.hash.slice(1)))) return null;
      } catch { return null; }
      const keys = new Set();
      for (const [key, value] of url.searchParams) {
        if (!STATE_QUERY.has(key) || keys.has(key) || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
        keys.add(key);
      }
      return knownRoutes.has(url.pathname) ? url.pathname : null;
    }
    if (url.hash) return null;
    const route = url.pathname + url.search;
    return knownRoutes.has(route) && !Object.values(config.entrypoints).includes(url.pathname) ? route : null;
  }
  const clientKey = id => new URL(CLIENT_PATH + encodeURIComponent(id), origin).href;
  const validClientId = id => typeof id === "string" && id.length > 0 && id.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(id);
  async function selectedDocument(clientId, active) {
    if (!validClientId(clientId)) return false;
    try {
      const response = await (await worker.caches.open(cacheName)).match(clientKey(clientId));
      if (!response) return false;
      const marker = JSON.parse(new TextDecoder().decode(await readBounded(response, 2048)));
      exactKeys(marker, ["schemaVersion", "engineBuildId", "buildId", "clientId"]);
      return marker.schemaVersion === 1 && marker.engineBuildId === config.buildId && marker.buildId === active.config.buildId && marker.clientId === clientId;
    } catch { return false; }
  }
  async function bindSelectedDocument(clientId, active) {
    if (!validClientId(clientId)) throw new Error("A rollback navigation requires its resulting WindowClient identity");
    const cache = await worker.caches.open(cacheName);
    const keys = (await cache.keys()).filter(request => new URL(request.url).pathname.startsWith(CLIENT_PATH));
    if (keys.length >= 128) {
      for (const request of keys) {
        const id = decodeURIComponent(new URL(request.url).pathname.slice(CLIENT_PATH.length));
        if (!await worker.clients.get(id)) await cache.delete(request);
      }
      if ((await cache.keys()).filter(request => new URL(request.url).pathname.startsWith(CLIENT_PATH)).length >= 128) throw new Error("Rollback document metadata budget exceeded");
    }
    await cache.put(clientKey(clientId), new ResponseClass(JSON.stringify({ schemaVersion: 1, engineBuildId: config.buildId, buildId: active.config.buildId, clientId }), { headers: { "Content-Type": "application/json" } }));
  }
  async function serve(route, event) {
    const active = await loadSelection();
    const navigation = event.request.mode === "navigate";
    if (selectionInvalid || rollbackPending || (!navigation && event.clientId && event.clientId === blockedClientId)) return ResponseClass.error();
    // A new document is bound before its rollback shell is returned. An older
    // document, including a window racing selection, must never receive prior
    // resources merely because the global selection has changed. Cache metadata
    // preserves this binding across normal service-worker process restarts.
    if (active !== engine && !navigation && !await selectedDocument(event.clientId, active)) return ResponseClass.error();
    const finish = async response => {
      if (selectionInvalid || rollbackPending || selected !== active) return ResponseClass.error();
      if (navigation && active !== engine) await bindSelectedDocument(event.resultingClientId, active);
      if (selectionInvalid || rollbackPending || selected !== active) return ResponseClass.error();
      return response;
    };
    const file = active.entries.get(route);
    if (!file) return ResponseClass.error();
    const marker = await readMarker(active.cacheName);
    const expectedHash = active === engine ? await configHash() : config.rollbackReference?.manifestSha256;
    if (!marker || marker.manifestSha256 !== expectedHash) return ResponseClass.error();
    const cache = await worker.caches.open(active.cacheName);
    try {
      const cached = await cache.match(new URL(file.url, origin).href);
      if (cached) return await finish(await verifiedResponse(cached, file, active.config.buildId));
    } catch { /* An evicted/corrupt file can only be repaired with its exact hash. */ }
    try {
      const response = await download(file, active.config.buildId);
      await cache.put(new URL(file.url, origin).href, response.clone());
      return await finish(response);
    } catch { return ResponseClass.error(); }
  }
  async function sourceClient(event) {
    if (!event.source || event.source.type !== "window" || typeof event.source.id !== "string" || !event.source.id || (event.origin && event.origin !== origin)) return null;
    const client = await worker.clients.get(event.source.id);
    if (!client || client.id !== event.source.id || client.type !== "window") return null;
    let url;
    try { url = new URL(client.url); } catch { return null; }
    return classifyRequest({ url: url.href, method: "GET", mode: "navigate", headers: new Headers() }) ? client : null;
  }
  async function message(event) {
    const client = await sourceClient(event);
    if (!client) return;
    if (event.data.type === "PLANET_ROLLBACK_STATUS" || event.data.type === "PLANET_ACTIVATE_ROLLBACK") {
      await loadSelection();
      let previous;
      try { previous = await anchoredPrevious(); } catch { previous = null; }
      const activeBuildId = selectionInvalid ? null : selected.config.buildId;
      const ready = !selectionInvalid && selected === engine && !!previous && !rollbackPending;
      if (event.data.type === "PLANET_ROLLBACK_STATUS") {
        client.postMessage({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: event.data.requestId, engineBuildId: config.buildId, activeBuildId, rollbackBuildId: ready ? previous.config.buildId : null, ready });
        return;
      }
      let accepted = false, reason = "not-ready";
      if (ready && event.data.targetBuildId === previous.config.buildId) {
        rollbackPending = true;
        try {
          const stillAuthorized = await sourceClient(event);
          if (!stillAuthorized || typeof worker.clients.matchAll !== "function") throw new Error("worker-changed");
          const windows = await worker.clients.matchAll({ type: "window", includeUncontrolled: false });
          const scoped = windows.filter(window => { try { const url = new URL(window.url); const pathname = decodeURIComponent(url.pathname); return url.origin === origin && (pathname === "/planet" || pathname.startsWith(SCOPE)); } catch { return true; } });
          if (scoped.length !== 1 || scoped[0].id !== client.id) throw new Error("multiple-clients");
          // Revalidate after asynchronous client inspection. No network repair or
          // fallback may turn an incomplete prior generation into a rollback.
          const verified = await anchoredPrevious();
          if (!verified) throw new Error("not-ready");
          if (!await sourceClient(event)) throw new Error("worker-changed");
          const selection = { schemaVersion: 1, engineBuildId: config.buildId, buildId: verified.config.buildId, manifestSha256: config.rollbackReference.manifestSha256, requestedBy: client.id };
          await (await worker.caches.open(cacheName)).put(selectionUrl, new ResponseClass(JSON.stringify(selection), { headers: { "Content-Type": "application/json" } }));
          selected = verified; selectionPromise = Promise.resolve(verified); blockedClientId = client.id; accepted = true;
        } catch (error) { reason = error.message === "multiple-clients" ? "multiple-clients" : "not-ready"; }
        finally { rollbackPending = false; }
      }
      client.postMessage({ type: "PLANET_ROLLBACK_ACTIVATION_RESULT", requestId: event.data.requestId, engineBuildId: config.buildId, activeBuildId: selected.config.buildId, targetBuildId: event.data.targetBuildId, accepted, ...(accepted ? {} : { reason }) });
      return;
    }
    const ready = await currentComplete(true);
    if (event.data.type === "PLANET_UPDATE_STATUS") {
      client.postMessage({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: event.data.requestId, buildId: config.buildId, ready });
    } else {
      const stillAuthorized = await sourceClient(event);
      if (!stillAuthorized) return;
      if (ready) await worker.skipWaiting();
      stillAuthorized.postMessage({ type: "PLANET_UPDATE_ACTIVATION_RESULT", requestId: event.data.requestId, buildId: config.buildId, accepted: ready });
    }
  }
  worker.addEventListener("install", (event) => { event.waitUntil(install()); });
  worker.addEventListener("activate", (event) => { event.waitUntil(activate()); });
  worker.addEventListener("fetch", (event) => {
    const route = classifyRequest(event.request);
    if (route) event.respondWith(serve(route, event).catch(() => ResponseClass.error()));
  });
  worker.addEventListener("message", (event) => {
    const data = event.data;
    if (record(data) && ["PLANET_ROLLBACK_STATUS", "PLANET_ACTIVATE_ROLLBACK"].includes(data.type)) {
      if (typeof data.requestId !== "string" || !/^[A-Za-z0-9_-]{1,96}$/u.test(data.requestId) || (Object.hasOwn(data, "engineBuildId") && data.engineBuildId !== config.buildId) || (data.type === "PLANET_ACTIVATE_ROLLBACK" && (data.engineBuildId !== config.buildId || !SHA256.test(data.targetBuildId)))) return;
      event.waitUntil(message(event).catch(() => undefined)); return;
    }
    const discovery = record(data) && data.type === "PLANET_UPDATE_STATUS" && !Object.hasOwn(data, "buildId");
    if (!record(data) || !["PLANET_UPDATE_STATUS", "PLANET_ACTIVATE_UPDATE"].includes(data.type) || (!discovery && data.buildId !== config.buildId) || typeof data.requestId !== "string" || !/^[A-Za-z0-9_-]{1,96}$/u.test(data.requestId)) return;
    event.waitUntil(message(event).catch(() => undefined));
  });
  return Object.freeze({ cacheName, buildId: config.buildId, scopePath: SCOPE });
}
