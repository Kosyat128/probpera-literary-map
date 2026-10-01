import path from "node:path";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import http from "node:http";
import { randomUUID, createHash, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { startPwaQaServer } from "./local-server.mjs";
import { verifyWebLicenseGrant } from "../../../src/platform/adapters/web/WebLicense.ts";
import { pwaAuthoritySha256 } from "../../../scripts/mobile/pwa-artifact.mjs";
import { normalizePwaWorkerConfig } from "../../../src/pwa/serviceWorkerRuntime.js";

const root = process.cwd();
const cleanups = [];
const json = value => JSON.stringify(value);
async function fixture() {
  const id = randomUUID();
  const relative = ".tmp/pwa-qa/server-test-" + id;
  const directory = path.join(root, relative);
  await mkdir(directory, { recursive: true });
  const authorityPath = relative + "/authority.json";
  const controlPath = relative + "/server.json";
  cleanups.push(async () => {
    const contained = path.relative(root, directory);
    if (!contained.startsWith(".tmp" + path.sep) || path.isAbsolute(contained) || contained.includes("..")) throw new Error("Unsafe test cleanup");
    await rm(directory, { recursive: true, force: true });
  });
  const files = new Map([
    ["index.html", "<html>neutral</html>"], ["ru/index.html", "<html lang=ru>RU</html>"], ["en/index.html", "<html lang=en>EN</html>"],
    ["assets/app.js", "export const testOnly = true;"], ["assets/app.css", "body{color:black}"], ["sw.js", "/* original QA worker fixture */"],
  ]);
  for (const [name, bytes] of files) { await mkdir(path.dirname(path.join(directory, name)), { recursive: true }); await writeFile(path.join(directory, name), bytes); }
  const config = { schemaVersion: 1, scopePath: "/planet/", buildId: "a".repeat(64), entrypoints: { root: "/planet/", ru: "/planet/ru/", en: "/planet/en/" }, files: [...files].filter(([name]) => name !== "sw.js").map(([name, bytes]) => ({ url: "/planet/" + name.replace(/index\.html$/u, ""), bytes: Buffer.byteLength(bytes), sha256: createHash("sha256").update(bytes).digest("hex"), kind: name.endsWith(".html") ? "shell" : "asset" })) };
  await writeFile(path.join(directory, "bootstrap-integrity.json"), json(config));
  await writeFile(path.join(directory, "artifact.json"), json({ kind: "literary-planet-controlled-pwa-preparation", releaseReady: false, localQaAuthority: true }));
  const server = await startPwaQaServer({ root, distPath: relative, authorityPath, controlPath });
  cleanups.push(() => server.close());
  const post = (pathname, body, headers = {}) => fetch(server.origin + pathname, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: json(body) });
  const control = body => post("/__pwa_qa__/control", body, { Authorization: "Bearer " + server.controlToken });
  const identity = () => post("/planet/api/license/identity", { v: 1, audience: server.authority.audience, product: server.authority.product });
  const session = () => post("/planet/api/license/session", { v: 1, audience: server.authority.audience, product: server.authority.product, subject: server.subject });
  const verify = token => verifyWebLicenseGrant(token, { issuer: server.authority.issuer, audience: server.authority.audience, product: server.authority.product, subject: server.subject }, { trustedKeys: server.authority.trustedKeys, subtle: webcrypto.subtle });
  return { server, post, control, identity, session, verify, directory, config, files };
}
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

describe("local QA authority and isolation", () => {
  it("serves readiness and writes only the public ES256 authority plus test control metadata", async () => {
    const env = await fixture();
    expect(await (await fetch(env.server.origin + "/__pwa_qa__/ready")).json()).toEqual({ ready: true, localQaOnly: true });
    const authority = JSON.parse(await readFile(env.server.authorityPath, "utf8"));
    expect(authority).toEqual(env.server.authority);
    expect(authority.trustedKeys[0].jwk).not.toHaveProperty("d");
    expect(authority.trustedKeys[0].jwk.key_ops).toEqual(["verify"]);
    expect((await fetch(env.server.origin + "/.tmp/pwa-qa/server.json")).status).toBe(404);
    const identity = await env.identity();
    expect(await identity.json()).toEqual({ subject: env.server.subject });
    const response = await env.session();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await env.verify((await response.json()).grant)).toMatchObject({ status: "authorized" });
  });
  it("rejects missing/wrong control token, foreign Origin/Host and unauthenticated identity shape", async () => {
    const env = await fixture();
    for (const headers of [{}, { Authorization: "Bearer wrong" }, { Authorization: "Bearer " + env.server.controlToken, Origin: "https://other.test" }]) {
      expect((await env.post("/__pwa_qa__/control", { action: "reset" }, headers)).status).toBe(403);
    }
    // Node fetch controls Host itself; use an actual HTTP request to exercise
    // DNS-rebinding protection with the exact hostile header on the wire.
    const hostileHost = await new Promise((resolve, reject) => {
      const request = http.request(env.server.origin + "/__pwa_qa__/control", { method: "POST", headers: { Host: "other.test", Authorization: "Bearer " + env.server.controlToken, "Content-Type": "application/json" } }, response => { response.resume(); resolve(response.statusCode); });
      request.on("error", reject); request.end(json({ action: "reset" }));
    });
    expect(hostileHost).toBe(403);
    expect((await env.post("/planet/api/license/identity", { v: 1, audience: env.server.authority.audience, product: env.server.authority.product, subject: "guessed" })).status).toBe(403);
    expect((await env.post("/planet/api/license/session", { v: 1, audience: env.server.authority.audience, product: env.server.authority.product, subject: "guessed" })).status).toBe(403);
    expect((await env.post("/planet/api/license/identity", {}, { Origin: "https://other.test" })).status).toBe(403);
  });
  it.each(["revoked", "refunded", "expired"])("produces an actual signed %s assertion", async (session) => {
    const env = await fixture();
    expect((await env.control({ action: "license", state: { session } })).status).toBe(200);
    expect(await env.verify((await (await env.session()).json()).grant)).toMatchObject({ status: "denied", reason: session });
  });
  it("supports denial, network fault, short offline expiry and deterministic reset", async () => {
    const env = await fixture();
    await env.control({ action: "license", state: { session: "denied" } });
    expect((await env.session()).status).toBe(403);
    await env.control({ action: "license", state: { session: "unavailable" } });
    expect((await env.session()).status).toBe(503);
    await env.control({ action: "license", state: { session: "active", offlineSeconds: 2, grantSeconds: 4 } });
    const result = await env.verify((await (await env.session()).json()).grant);
    expect(result.status).toBe("authorized");
    expect(result.claims.exp - result.claims.offlineUntil).toBe(2);
    await env.control({ action: "reset" });
    const status = await (await env.control({ action: "status" })).json();
    expect(status.state).toEqual({ identity: "authorized", session: "active", offlineSeconds: 300, grantSeconds: 3600, delayMs: 0 });
    expect(status.requests.some(request => request.pathname === "/planet/api/license/session")).toBe(true);
  });
});

describe("real isolated static serving and update faults", () => {
  it("updates the hash-bound ownership sidecar with a changed candidate script while keeping the disk baseline intact", async () => {
    const env = await fixture();
    const script = env.config.files.find(file => file.url === "/planet/assets/app.js");
    const ownership = { schemaVersion: 1, sourceInputsSha256: "a".repeat(64), entries: [{ source: "src/main.js", sourceSha256: "b".repeat(64), files: [{ file: "assets/app.js", sha256: script.sha256 }] }] };
    const baseline = JSON.stringify(ownership, null, 2) + "\n";
    env.config.files.push({ url: "/planet/module-ownership.json", bytes: Buffer.byteLength(baseline), sha256: createHash("sha256").update(baseline).digest("hex"), kind: "asset" });
    await writeFile(path.join(env.directory, "module-ownership.json"), baseline);
    await writeFile(path.join(env.directory, "bootstrap-integrity.json"), json(env.config));
    await env.server.setArtifact(path.relative(root, env.directory).split(path.sep).join("/"));
    await env.server.createCandidate();
    const manifest = await (await fetch(env.server.origin + "/planet/bootstrap-integrity.json")).json();
    const updatedBytes = Buffer.from(await (await fetch(env.server.origin + "/planet/module-ownership.json")).arrayBuffer());
    const updated = JSON.parse(updatedBytes);
    const changedScript = manifest.files.find(file => file.url === script.url);
    expect(changedScript.sha256).not.toBe(script.sha256);
    expect(updated.entries[0].files[0].sha256).toBe(changedScript.sha256);
    expect(manifest.files.find(file => file.url === "/planet/module-ownership.json")).toMatchObject({ bytes: updatedBytes.length, sha256: createHash("sha256").update(updatedBytes).digest("hex") });
    expect(await readFile(path.join(env.directory, "module-ownership.json"), "utf8")).toBe(baseline);
    await env.control({ action: "reset" });
    expect(await (await fetch(env.server.origin + "/planet/module-ownership.json")).text()).toBe(baseline);
  });
  it("anchors rollback only to the current artifact with the same ephemeral public authority", async () => {
    const env = await fixture();
    await env.server.createCandidate();
    expect(await (await fetch(env.server.origin + "/planet/bootstrap-integrity.json")).json()).not.toHaveProperty("rollbackReference");
    const metadata = JSON.parse(await readFile(path.join(env.directory, "artifact.json"), "utf8"));
    metadata.authoritySha256 = pwaAuthoritySha256(env.server.authority);
    await writeFile(path.join(env.directory, "artifact.json"), json(metadata));
    await env.server.setArtifact(path.relative(root, env.directory).split(path.sep).join("/"));
    await env.server.createCandidate();
    const manifest = await (await fetch(env.server.origin + "/planet/bootstrap-integrity.json")).json();
    const normalized = normalizePwaWorkerConfig(env.config);
    expect(manifest.rollbackReference).toEqual({ buildId: env.config.buildId, manifestSha256: createHash("sha256").update(json(normalized)).digest("hex"), routes: normalized.files.flatMap(file => [file.url, ...file.aliases]).sort() });
    metadata.authoritySha256 = "f".repeat(64);
    await writeFile(path.join(env.directory, "artifact.json"), json(metadata));
    await expect(env.server.setArtifact(path.relative(root, env.directory).split(path.sep).join("/"))).rejects.toThrow("authority");
  });
  it("serves exact shell routes, correct executable MIME/CSP/HEAD and updated canonical site worker", async () => {
    const env = await fixture();
    for (const [pathname, body] of [["/planet/", "neutral"], ["/planet/ru/?country=russia", "RU"], ["/planet/en/", "EN"]]) {
      const response = await fetch(env.server.origin + pathname);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain(body);
    }
    const script = await fetch(env.server.origin + "/planet/assets/app.js");
    expect(script.headers.get("content-type")).toBe("text/javascript");
    expect(script.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(script.headers.get("cache-control")).not.toContain("no-store");
    const head = await fetch(env.server.origin + "/planet/assets/app.js", { method: "HEAD" });
    expect(Number(head.headers.get("content-length"))).toBe(Buffer.byteLength(env.files.get("assets/app.js")));
    expect(await head.text()).toBe("");
    const worker = await fetch(env.server.origin + "/sw.js");
    expect(worker.headers.get("service-worker-allowed")).toBe("/");
    expect(await worker.text()).toContain('pathname.startsWith("/planet/")');
    expect((await fetch(env.server.origin + "/planet/not-a-route/")).status).toBe(400);
    expect((await fetch(env.server.origin + "/planet/%2e%2e%2fpackage.json")).status).toBe(400);
  });
  it("creates versioned workers and hash-breaking assets without modifying the artifact", async () => {
    const env = await fixture();
    const original = await readFile(path.join(env.directory, "sw.js"), "utf8");
    const clean = await (await env.control({ action: "candidate" })).json();
    expect(clean.buildId).toMatch(/^[a-f0-9]{64}$/u);
    expect(clean.buildId).not.toBe(env.config.buildId);
    expect(await (await fetch(env.server.origin + "/planet/sw.js")).text()).toContain(clean.buildId);
    const corrupt = await (await env.control({ action: "candidate", corruptPath: "/planet/assets/app.js" })).json();
    expect(corrupt.buildId).not.toBe(clean.buildId);
    const bytes = Buffer.from(await (await fetch(env.server.origin + "/planet/assets/app.js")).arrayBuffer());
    const corruptManifest = await (await fetch(env.server.origin + "/planet/bootstrap-integrity.json")).json();
    expect(bytes.byteLength).toBe(corruptManifest.files.find(file => file.url === "/planet/assets/app.js").bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).not.toBe(corruptManifest.files.find(file => file.url === "/planet/assets/app.js").sha256);
    expect(bytes.toString()).not.toBe(env.files.get("assets/app.js"));
    expect(await readFile(path.join(env.directory, "sw.js"), "utf8")).toBe(original);
    expect((await env.control({ action: "artifact", directory: "../outside" })).status).toBe(400);
    await env.control({ action: "reset" });
    expect(await (await fetch(env.server.origin + "/planet/sw.js")).text()).toBe(original);
  });
});

describe("canonical local QA license admission responses", () => {
  it("returns bounded canonical 429 headers while identity and reset retain their original contracts", async () => {
    const env = await fixture();
    const originalState = { identity: "authorized", session: "active", offlineSeconds: 300, grantSeconds: 3600, delayMs: 0 };
    expect((await (await env.control({ action: "status" })).json()).state).toEqual(originalState);
    for (const seconds of [1, 86400]) {
      expect((await env.control({ action: "license", state: { session: "rate-limited", retryAfterSeconds: seconds } })).status).toBe(200);
      const response = await env.session();
      expect(response.status).toBe(429);
      expect(response.url).toBe(env.server.origin + "/planet/api/license/session");
      expect(response.redirected).toBe(false);
      expect(response.headers.get("retry-after")).toBe(String(seconds));
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(await response.json()).toEqual({});
      const identity = await env.identity();
      expect(identity.status).toBe(200);
      expect(await identity.json()).toEqual({ subject: env.server.subject });
    }
    expect((await env.control({ action: "reset" })).status).toBe(200);
    expect((await (await env.control({ action: "status" })).json()).state).toEqual(originalState);
    const active = await env.session();
    expect(active.status).toBe(200);
    expect(active.headers.get("retry-after")).toBeNull();
    expect(await env.verify((await active.json()).grant)).toMatchObject({ status: "authorized" });
  });

  it("rejects missing, out-of-bounds and non-integer retry intervals before mutating QA state", async () => {
    const env = await fixture();
    const before = (await (await env.control({ action: "status" })).json()).state;
    const invalid = [
      { session: "rate-limited" },
      ...[0, -1, 86401, 1.5, "60", null].map(retryAfterSeconds => ({ session: "rate-limited", retryAfterSeconds })),
      { session: "active", retryAfterSeconds: 0 },
    ];
    for (const state of invalid) {
      expect((await env.control({ action: "license", state })).status).toBe(400);
      expect((await (await env.control({ action: "status" })).json()).state).toEqual(before);
    }
    expect((await env.control({ action: "license", state: { session: "rate-limited", retryAfterSeconds: 60 } })).status).toBe(200);
    const response = await env.session();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toEqual({});
  });

  it("keeps a delayed session reply bound to its captured admission state after control changes", async () => {
    const env = await fixture();
    expect((await env.control({ action: "license", state: { session: "rate-limited", retryAfterSeconds: 7, delayMs: 1000 } })).status).toBe(200);
    const before = env.server.getSessionAdmissions();
    let settled = false;
    const held = env.session().then(response => { settled = true; return response; });
    try {
      await expect.poll(() => env.server.getSessionAdmissions(), { timeout: 2000, interval: 10 }).toBe(before + 1);
      expect((await env.control({ action: "license", state: { session: "active", delayMs: 0 } })).status).toBe(200);
      expect(settled).toBe(false);
      const response = await held;
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("7");
      expect(await response.json()).toEqual({});
      const subsequent = await env.session();
      expect(subsequent.status).toBe(200);
      expect(subsequent.headers.get("retry-after")).toBeNull();
      expect(await env.verify((await subsequent.json()).grant)).toMatchObject({ status: "authorized" });
    } finally {
      await held.catch(() => undefined);
    }
  });
});
