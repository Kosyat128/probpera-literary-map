/** Local QA fixture only. No private key is written, no production service is implemented. */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, realpath, lstat } from "node:fs/promises";
import { randomBytes, createHash, webcrypto } from "node:crypto";
import { spawn } from "node:child_process";
import { build as bundle } from "esbuild";
import { artifactPath, containedFile, pwaAuthoritySha256 } from "../../../scripts/mobile/pwa-artifact.mjs";
import { normalizePwaWorkerConfig } from "../../../src/pwa/serviceWorkerRuntime.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".json": "application/json", ".geojson": "application/geo+json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
const CSP = "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'";
const defaults = () => ({ identity: "authorized", session: "active", offlineSeconds: 300, grantSeconds: 3600, delayMs: 0 });
const exact = (value, fields) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const inside = (root, filename) => { const relative = path.relative(root, filename); return relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative); };
const base64 = bytes => Buffer.from(bytes).toString("base64url");

export async function startPwaQaServer({ root: inputRoot = repoRoot, distPath = "dist-pwa", port = 0, buildQa = false, authorityPath = ".tmp/pwa-qa/authority.json", controlPath = ".tmp/pwa-qa/server.json" } = {}) {
  const root = await realpath(inputRoot);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid local QA port");
  async function fixtureFile(relative, bytes) {
    artifactPath(relative);
    if (!relative.startsWith(".tmp/pwa-qa/")) throw new Error("QA metadata must remain in .tmp/pwa-qa");
    const filename = path.resolve(root, relative);
    let parent = root;
    for (const part of relative.split("/").slice(0, -1)) {
      parent = path.join(parent, part);
      try { await mkdir(parent); } catch (error) { if (error.code !== "EEXIST") throw error; }
      const stat = await lstat(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(parent) !== parent) throw new Error("QA metadata directory escapes checkout");
    }
    try { if ((await lstat(filename)).isSymbolicLink() || await realpath(filename) !== filename) throw new Error("Refuse linked QA metadata"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await writeFile(filename, bytes, { mode: 0o600 });
    return filename;
  }
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const authority = Object.freeze({ issuer: "literary-planet-local-qa-authority", audience: "literary-planet-web-qa", product: "local-qa-base-edition", trustedKeys: [{ kid: "qa-" + randomBytes(8).toString("hex"), jwk: publicKey }] });
  const authorityFile = await fixtureFile(authorityPath, JSON.stringify(authority, null, 2) + "\n");
  const controlToken = randomBytes(32).toString("hex");
  const subject = "local-qa-independent-subject";
  let state = defaults();
  let directory;
  let config;
  let candidate = null;
  let ready = false;
  let closed = false;
  let origin;
  const faults = new Map();
  const sockets = new Set();
  const timers = new Set();
  const requests = [];
  function setLicenseState(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).some(key => !Object.hasOwn(defaults(), key))) throw new Error("Unknown QA license field");
    const next = { ...state, ...patch };
    if (!["authorized", "denied", "unavailable"].includes(next.identity) || !["active", "denied", "revoked", "refunded", "expired", "unavailable"].includes(next.session)
      || !Number.isInteger(next.offlineSeconds) || next.offlineSeconds < 1 || next.offlineSeconds > 86400
      || !Number.isInteger(next.grantSeconds) || next.grantSeconds < next.offlineSeconds || next.grantSeconds > 86400
      || !Number.isInteger(next.delayMs) || next.delayMs < 0 || next.delayMs > 30000) throw new Error("Invalid QA license state");
    state = next;
    return Object.freeze({ ...state });
  }
  function faultPath(value) {
    if (typeof value !== "string" || !value.startsWith("/planet/") || /[?#%\\]/u.test(value)) throw new Error("Exact scoped fault pathname required");
    artifactPath(value.slice("/planet/".length));
    return value;
  }
  function setFault(pathname, mode = "none") {
    faultPath(pathname);
    if (!["none", "corrupt", "unavailable", "stall"].includes(mode)) throw new Error("Unknown QA fault");
    if (mode === "none") faults.delete(pathname); else faults.set(pathname, mode);
  }
  async function setArtifact(relative) {
    artifactPath(relative);
    const proposed = path.resolve(root, relative);
    const resolved = await realpath(proposed);
    if (!inside(root, resolved) || resolved !== proposed || !(await lstat(proposed)).isDirectory()) throw new Error("Controlled QA artifact must be a real checkout directory");
    const artifact = JSON.parse((await containedFile(resolved, "artifact.json")).bytes);
    if (artifact.kind !== "literary-planet-controlled-pwa-preparation" || artifact.releaseReady !== false || artifact.localQaAuthority !== true) throw new Error("Explicit QA artifact required");
    if (artifact.authoritySha256 !== undefined && artifact.authoritySha256 !== pwaAuthoritySha256(authority)) throw new Error("QA authority does not match the current in-memory key");
    const nextConfig = JSON.parse((await containedFile(resolved, "bootstrap-integrity.json")).bytes);
    if (nextConfig.schemaVersion !== 1 || nextConfig.scopePath !== "/planet/" || !/^[a-f0-9]{64}$/u.test(nextConfig.buildId)) throw new Error("Invalid QA artifact identity");
    directory = resolved; config = nextConfig; candidate = null; faults.clear(); ready = true;
    return { buildId: config.buildId };
  }
  async function createCandidate({ corruptPath = null } = {}) {
    if (!ready) throw new Error("QA artifact is not ready");
    const buildId = createHash("sha256").update(JSON.stringify(config) + randomBytes(32).toString("hex")).digest("hex");
    const artifact = JSON.parse((await containedFile(directory, "artifact.json")).bytes);
    const prior = normalizePwaWorkerConfig(config);
    const rollbackReference = artifact.authoritySha256 === pwaAuthoritySha256(authority) ? {
      buildId: prior.buildId,
      manifestSha256: createHash("sha256").update(JSON.stringify(prior)).digest("hex"),
      routes: prior.files.flatMap(file => [file.url, ...(file.aliases ?? [])]).sort(),
    } : null;
    // Legacy preparation fixtures have no verified authority identity and no rollback anchor.
    const { rollbackReference: _oldReference, ...base } = config;
    const changedFile = config.files.find(file => file.kind === "asset" && file.url.endsWith(".js"));
    if (!changedFile) throw new Error("Local QA candidate requires an essential script");
    const originalBytes = (await containedFile(directory, changedFile.url.slice("/planet/".length))).bytes;
    const changedBytes = Buffer.concat([originalBytes, Buffer.from("\n/* local QA candidate " + buildId + " */\n")]);
    const changedRecord = { ...changedFile, bytes: changedBytes.length, sha256: createHash("sha256").update(changedBytes).digest("hex") };
    const replacements = new Map([[changedFile.url, changedBytes]]);
    const ownershipRecord = config.files.find(file => file.url === "/planet/module-ownership.json");
    if (ownershipRecord) {
      const original = (await containedFile(directory, "module-ownership.json")).bytes;
      if (original.length !== ownershipRecord.bytes || createHash("sha256").update(original).digest("hex") !== ownershipRecord.sha256) throw new Error("QA ownership baseline integrity mismatch");
      const ownership = JSON.parse(original);
      if (ownership.schemaVersion !== 1 || !Array.isArray(ownership.entries)) throw new Error("Invalid QA ownership baseline");
      for (const entry of ownership.entries) for (const file of entry.files) if (file.file === changedFile.url.slice("/planet/".length)) {
        if (file.sha256 !== changedFile.sha256) throw new Error("QA owned script baseline integrity mismatch");
        file.sha256 = changedRecord.sha256;
      }
      replacements.set(ownershipRecord.url, Buffer.from(JSON.stringify(ownership, null, 2) + "\n"));
    }
    const manifest = { ...base, buildId, files: config.files.map(file => {
      const bytes = replacements.get(file.url);
      return bytes ? { ...file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") } : file;
    }), ...(rollbackReference ? { rollbackReference } : {}) };
    if (corruptPath !== null && !manifest.files.some(file => file.url === faultPath(corruptPath))) throw new Error("Candidate corruption must target an essential file");
    const output = await bundle({ stdin: { contents: "import { installPwaWorker } from './src/pwa/serviceWorkerRuntime.js'; installPwaWorker(self," + JSON.stringify(manifest) + ");", resolveDir: root, sourcefile: "local-qa-candidate.js" }, bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true });
    candidate = { buildId, manifest, worker: Buffer.from(output.outputFiles[0].contents), changedPath: changedFile.url, replacements };
    faults.clear();
    if (corruptPath) setFault(corruptPath, "corrupt");
    return { buildId, corruptPath, changedPath: changedFile.url };
  }
  function send(response, status, bytes, contentType = "application/json", additional = {}) {
    response.writeHead(status, { "Content-Type": contentType, "Content-Length": Buffer.byteLength(bytes), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": CSP, ...additional });
    response.end(bytes);
  }
  async function jsonBody(request) {
    if (!/^application\/json(?:\s*;|$)/iu.test(request.headers["content-type"] ?? "")) throw new Error("JSON required");
    let size = 0;
    const chunks = [];
    for await (const chunk of request) { size += chunk.length; if (size > 4096) throw new Error("QA request too large"); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  async function grant() {
    const current = Math.floor(Date.now() / 1000);
    const expired = state.session === "expired";
    const claims = { v: 1, iss: authority.issuer, aud: authority.audience, sub: subject, product: authority.product, model: "one-time", status: ["revoked", "refunded"].includes(state.session) ? state.session : "active", jti: randomBytes(16).toString("hex"), iat: current - 60, nbf: current - 60, exp: expired ? current - 1 : current + state.grantSeconds, offlineUntil: expired ? current - 1 : current + state.offlineSeconds };
    const input = base64(JSON.stringify({ alg: "ES256", typ: "lp-web-license+jwt", kid: authority.trustedKeys[0].kid })) + "." + base64(JSON.stringify(claims));
    return input + "." + base64(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
  }
  async function handle(request, response) {
    if (request.headers.host !== new URL(origin).host || !["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)) return send(response, 403, "{} ");
    const url = new URL(request.url, origin);
    const pathname = url.pathname;
    requests.push({ method: request.method, pathname });
    if (requests.length > 2000) requests.shift();
    if (pathname === "/__pwa_qa__/ready" && request.method === "GET") return send(response, ready ? 200 : 503, JSON.stringify({ ready, localQaOnly: true }));
    if (pathname === "/__pwa_qa__/control") {
      if (request.method !== "POST" || request.headers.authorization !== "Bearer " + controlToken || (request.headers.origin && request.headers.origin !== origin) || request.headers["sec-fetch-site"] === "cross-site") return send(response, 403, "{}");
      const body = await jsonBody(request);
      let result;
      if (exact(body, ["action", "state"]) && body.action === "license") result = setLicenseState(body.state);
      else if (exact(body, ["action", "path", "mode"]) && body.action === "fault") { setFault(body.path, body.mode); result = { ok: true }; }
      else if ((exact(body, ["action"]) || exact(body, ["action", "corruptPath"])) && body.action === "candidate") result = await createCandidate(body);
      else if (exact(body, ["action", "directory"]) && body.action === "artifact") result = await setArtifact(body.directory);
      else if (exact(body, ["action"]) && body.action === "reset") { state = defaults(); faults.clear(); candidate = null; result = { ok: true }; }
      else if (exact(body, ["action"]) && body.action === "status") result = { state, buildId: candidate?.buildId ?? config?.buildId, requests: [...requests] };
      else return send(response, 400, "{}");
      return send(response, 200, JSON.stringify(result));
    }
    if (pathname === "/planet/api/license/identity" || pathname === "/planet/api/license/session") {
      if (!ready) return send(response, 503, "{}");
      if (request.method !== "POST" || url.search || (request.headers.origin && request.headers.origin !== origin) || request.headers["sec-fetch-site"] === "cross-site") return send(response, 403, "{}");
      const body = await jsonBody(request);
      const identity = pathname.endsWith("/identity");
      if (!exact(body, identity ? ["v", "audience", "product"] : ["v", "audience", "product", "subject"]) || body.v !== 1 || body.audience !== authority.audience || body.product !== authority.product || (!identity && body.subject !== subject)) return send(response, 403, "{}");
      if (state.delayMs) await new Promise(resolve => { const timer = setTimeout(() => { timers.delete(timer); resolve(); }, state.delayMs); timers.add(timer); });
      if (identity) return send(response, state.identity === "authorized" ? 200 : state.identity === "denied" ? 403 : 503, state.identity === "authorized" ? JSON.stringify({ subject }) : "{}");
      if (state.session === "denied" || state.identity === "denied") return send(response, 403, "{}");
      if (state.session === "unavailable") return send(response, 503, "{}");
      return send(response, 200, JSON.stringify({ grant: await grant() }));
    }
    if (!["GET", "HEAD"].includes(request.method)) return send(response, 405, "{}");
    if (pathname === "/sw.js") return send(response, 200, (await containedFile(root, "public/sw.js")).bytes, "text/javascript", { "Service-Worker-Allowed": "/", "Cache-Control": "no-cache" });
    if (pathname === "/site-qa/") return send(response, 200, '<!doctype html><html lang="en"><title>Local site worker QA</title><body>Local QA fixture</body></html>', "text/html");
    if (!ready) return send(response, 503, "{}");
    if (pathname === "/planet") { response.writeHead(308, { Location: "/planet/" + url.search, "Cache-Control": "no-store" }); response.end(); return; }
    if (!pathname.startsWith("/planet/")) return send(response, 404, "Not found", "text/plain");
    let relative;
    try {
      relative = decodeURIComponent(pathname.slice("/planet/".length));
      if (relative === "" || relative === "ru/" || relative === "en/") relative += "index.html";
      artifactPath(relative);
    }
    catch { return send(response, 400, "Invalid path", "text/plain"); }
    const mode = faults.get(pathname);
    if (mode === "stall") return;
    if (mode === "unavailable") return send(response, 503, "Unavailable", "text/plain");
    let bytes;
    try {
      bytes = relative === "sw.js" && candidate ? candidate.worker : relative === "bootstrap-integrity.json" && candidate ? Buffer.from(JSON.stringify(candidate.manifest)) : candidate?.replacements.has(pathname) ? candidate.replacements.get(pathname) : (await containedFile(directory, relative)).bytes;
    } catch { return send(response, 404, "Not found", "text/plain"); }
    if (mode === "corrupt" && bytes.length) { bytes = Buffer.from(bytes); bytes[0] ^= 1; }
    return send(response, 200, request.method === "HEAD" ? Buffer.alloc(0) : bytes, MIME[path.extname(relative)] ?? "application/octet-stream", { "Content-Length": bytes.length, "Cache-Control": relative === "sw.js" ? "no-cache" : "public, max-age=0, must-revalidate", ...(relative === "sw.js" ? { "Service-Worker-Allowed": "/planet/" } : {}) });
  }
  const server = http.createServer((request, response) => { void handle(request, response).catch(() => { if (!response.headersSent) send(response, 400, "{}"); else response.destroy(); }); });
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  origin = "http://127.0.0.1:" + server.address().port;
  async function close() {
    if (closed) return;
    closed = true;
    ready = false;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
  const controlFile = await fixtureFile(controlPath, JSON.stringify({ localQaOnly: true, origin, controlToken, authorityPath: authorityFile }, null, 2) + "\n");
  try {
    if (buildQa) await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/mobile/build-pwa.mjs", "--qa-authority", authorityPath], { cwd: root, stdio: "inherit", windowsHide: true });
      child.once("error", reject); child.once("exit", code => code === 0 ? resolve() : reject(new Error("Local QA build failed: " + code)));
    });
    await setArtifact(distPath);
  } catch (error) { await close(); throw error; }
  return Object.freeze({ origin, authority, authorityPath: authorityFile, controlPath: controlFile, controlToken, subject, close, setLicenseState, setFault, setArtifact, createCandidate, getRequests: () => [...requests] });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let port = 4293, buildQa = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--port" && /^\d+$/u.test(args[index + 1] ?? "")) port = Number(args[++index]);
    else if (args[index] === "--buildqa") buildQa = true;
    else throw new Error("Usage: node tests/pwa/support/local-server.mjs [--port 4293] [--buildqa]");
  }
  const instance = await startPwaQaServer({ port, buildQa });
  console.log(JSON.stringify({ origin: instance.origin, localQaOnly: true, ready: true, controlPath: instance.controlPath }));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void instance.close().then(() => process.exit(0)); });
}
