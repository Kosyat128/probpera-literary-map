import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { build } from "esbuild";
import worker, { createConfiguredPlanetApi, createPlanetWorker, PLANET_API_ENV_KEYS, type PlanetAssets, type PlanetWorkerBindings } from "./worker";

const origin = "https://probpera.ru";
const request = (pathname: string, init: RequestInit = {}) => new Request(origin + pathname, init);
function assetFixture(overrides: Record<string, () => Response> = {}) {
  const files: Record<string, () => Response> = {
    "/index.html": () => new Response("neutral", { headers: { "content-type": "text/html" } }),
    "/ru/index.html": () => new Response("русский", { headers: { "content-type": "text/html" } }),
    "/en/index.html": () => new Response("English", { headers: { "content-type": "text/html" } }),
    "/404.html": () => new Response("neutral recovery", { headers: { "content-type": "text/html" } }),
    "/en/404.html": () => new Response("English recovery", { headers: { "content-type": "text/html" } }),
    "/ru/404.html": () => new Response("Русская страница восстановления", { headers: { "content-type": "text/html" } }),
    "/assets/app-Abcd1234.js": () => new Response("export const app=true;", { headers: { "content-type": "application/javascript", etag: '"immutable"' } }),
    "/sw.js": () => new Response("self.addEventListener('fetch',()=>{});", { headers: { "content-type": "application/javascript" } }),
    "/brand/logo.png": () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }),
    "/assets/country-flags/ATTRIBUTION.md": () => new Response("Canonical attribution", { headers: { "content-type": "text/markdown" } }),
    ...overrides,
  };
  const fetch = vi.fn(async (incoming: Request) => files[new URL(incoming.url).pathname]?.() ?? new Response(null, { status: 404 }));
  return { fetch, bindings: { ASSETS: { fetch } } };
}
let configured: PlanetWorkerBindings;
beforeAll(async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privateKey = await crypto.subtle.exportKey("jwk", keys.privateKey);
  configured = {
    PLANET_ORIGIN: origin, PLANET_COOKIE_NAME: "__Host-planet-license", PLANET_LICENSE_ISSUER: origin + "/planet",
    PLANET_LICENSE_AUDIENCE: "literary-planet-web", PLANET_LICENSE_PRODUCT: "base-edition", PLANET_LICENSE_KID: "local-ephemeral",
    PLANET_GRANT_SECONDS: "3600", PLANET_OFFLINE_SECONDS: "600", PLANET_RECENT_AUTH_SECONDS: "300",
    PLANET_LICENSE_RATE_LIMIT: "10000", PLANET_LICENSE_RATE_WINDOW_SECONDS: "60",
    SUPABASE_URL: "https://canonical-project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_local_fixture",
    PLANET_COOKIE_AES_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
    PLANET_SIGNING_PRIVATE_JWK: JSON.stringify(privateKey),
  };
});

describe("Cloudflare Worker routing through the actual Fetch interface", () => {
  it.each([["/planet/", "/index.html", "neutral"], ["/planet/ru/", "/ru/index.html", "русский"], ["/planet/en/", "/en/index.html", "English"]])("maps %s to its exact built locale shell", async (url, target, expected) => {
    const env = assetFixture();
    const response = await worker.fetch(request(url), env.bindings);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(expected);
    expect(new URL(env.fetch.mock.calls[0][0].url).pathname).toBe(target);
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("frame-src 'none'");
  });
  it("keeps client navigation query out of static binding requests and strips credentials", async () => {
    const env = assetFixture();
    await worker.fetch(request("/planet/en/?country=fr", { headers: { cookie: "private=credential", authorization: "Bearer do-not-forward", "x-private": "secret", "if-none-match": '"etag"' } }), env.bindings);
    const forwarded = env.fetch.mock.calls[0][0];
    expect(forwarded.url).toBe(origin + "/en/index.html");
    expect(forwarded.headers.get("if-none-match")).toBe('"etag"');
    expect(forwarded.headers.has("cookie")).toBe(false);
    expect(forwarded.headers.has("authorization")).toBe(false);
    expect(forwarded.headers.has("x-private")).toBe(false);
  });
  it.each(["/", "/en/", "/admin/", "/planet", "/planet-other/", "/planet/%2e%76ite/manifest.json", "/planet/%61pi/license/session", "/planet/assets%2fapp.js", "/planet/assets/%252e%252e/artifact.json"])('rejects out-of-scope/encoded path %s without invoking bindings', async (url) => {
    const env = assetFixture(); const createApi = vi.fn();
    expect((await createPlanetWorker({ createApi }).fetch(request(url), env.bindings)).status).toBe(404);
    expect(env.fetch).not.toHaveBeenCalled(); expect(createApi).not.toHaveBeenCalled();
  });
  it.each([".vite/manifest.json", "artifact.json", "asset-provenance.json", "bootstrap-integrity.json", "_headers", "_redirects", "docs/readme.html", "server/planet/worker.js", "src/main.js", "package.json", "requirements/manifest.json", "assets/.secret.json", "api", "assets/AGENTS.md", "assets/hidden.json."])('never serves private artifact path %s', async (relative) => {
    const env = assetFixture();
    expect((await worker.fetch(request("/planet/" + relative, { headers: { accept: "text/html" } }), env.bindings)).status).toBe(404);
    expect(env.fetch).not.toHaveBeenCalled();
  });
  it("preserves the exact canonical runtime attribution exception", async () => {
    const env = assetFixture();
    expect(await (await worker.fetch(request("/planet/assets/country-flags/ATTRIBUTION.md"), env.bindings)).text()).toBe("Canonical attribution");
    expect((await worker.fetch(request("/planet/assets/country-flags/OTHER.md"), env.bindings)).status).toBe(404);
  });
  it.each([["/planet/en", "/planet/en/"], ["/planet/ru/index.html", "/planet/ru/"], ["/planet/index.html", "/planet/"]])("canonicalizes %s locally", async (from, to) => {
    const env = assetFixture(); const response = await worker.fetch(request(from + "?country=fr"), env.bindings);
    expect(response.status).toBe(308); expect(response.headers.get("location")).toBe(to + "?country=fr");
    expect(env.fetch).not.toHaveBeenCalled();
  });
  it("serves actual localized 404 HTML with 404 status without an app-shell fallback for missing JS", async () => {
    const env = assetFixture();
    const response = await worker.fetch(request("/planet/en/missing/", { headers: { accept: "text/html" } }), env.bindings);
    expect(response.status).toBe(404); expect(await response.text()).toBe("English recovery");
    const script = await worker.fetch(request("/planet/assets/missing.js", { headers: { accept: "text/html" } }), env.bindings);
    expect(script.status).toBe(404); expect(await script.text()).not.toContain("recovery");
  });
  it("does not apply missing-resource byte ranges or validators to the recovery document", async () => {
    const incoming: Request[] = [];
    const ASSETS: PlanetAssets = { async fetch(value) {
      incoming.push(value);
      if (new URL(value.url).pathname !== "/en/404.html") return new Response(null, { status: 404 });
      if (value.headers.has("if-none-match")) return new Response(null, { status: 304 });
      if (value.headers.has("range")) return new Response("partial", { status: 206 });
      return new Response("Complete English recovery", { headers: { "content-type": "text/html" } });
    } };
    const result = await worker.fetch(request("/planet/en/missing.html", { headers: { accept: "text/html", range: "bytes=10-20", "if-none-match": '"missing-page"', "if-modified-since": "Mon, 01 Sep 2025 00:00:00 GMT", "if-range": '"old"' } }), { ASSETS });
    expect(result.status).toBe(404); expect(await result.text()).toBe("Complete English recovery");
    expect(incoming).toHaveLength(2);
    expect(incoming[0].headers.has("range")).toBe(true);
    for (const name of ["range", "if-none-match", "if-modified-since", "if-range"]) expect(incoming[1].headers.has(name)).toBe(false);
  });
  it.each([401, 403, 500, 503])("does not expose upstream diagnostic response body with status %s", async status => {
    const env = assetFixture({ "/en/index.html": () => new Response("PRIVATE BINDING DIAGNOSTIC", { status }) });
    const response = await worker.fetch(request("/planet/en/"), env.bindings);
    expect(response.status).toBe(status >= 500 ? 503 : 502);
    expect(await response.text()).not.toContain("PRIVATE");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([206, 304, 404, 500])("fails closed when localized recovery itself returns unexpected status %s", async status => {
    const env = assetFixture({ "/en/404.html": () => new Response(status === 304 ? null : "PRIVATE BINDING DIAGNOSTIC", { status }) });
    const response = await worker.fetch(request("/planet/en/missing/", { headers: { accept: "text/html" } }), env.bindings);
    expect(response.status).toBe(status === 404 ? 404 : 503);
    expect(await response.text()).not.toContain("PRIVATE");
  });
  it("does not forward static Set-Cookie or CORS and applies exact worker scope/cache policy", async () => {
    const env = assetFixture({ "/sw.js": () => new Response("worker", { headers: { "content-type": "application/javascript", "set-cookie": "untrusted=secret", "access-control-allow-origin": "*", "service-worker-allowed": "/", "content-security-policy": "default-src *" } }) });
    const sw = await worker.fetch(request("/planet/sw.js"), env.bindings);
    expect(sw.headers.get("service-worker-allowed")).toBe("/planet/");
    expect(sw.headers.get("cache-control")).toBe("no-cache");
    expect(sw.headers.has("set-cookie")).toBe(false); expect(sw.headers.has("access-control-allow-origin")).toBe(false);
    expect(sw.headers.get("content-security-policy")).toContain("default-src 'self'");
    const js = await worker.fetch(request("/planet/assets/app-Abcd1234.js"), env.bindings);
    expect(js.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(js.headers.has("service-worker-allowed")).toBe(false);
  });
  it("retains byte streaming, HEAD and conditional response semantics", async () => {
    const env = assetFixture({ "/assets/cached-Abcd1234.js": () => new Response(null, { status: 304, headers: { etag: '"known"' } }) });
    const image = await worker.fetch(request("/planet/brand/logo.png"), env.bindings);
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(await (await worker.fetch(request("/planet/en/", { method: "HEAD" }), env.bindings)).text()).toBe("");
    const cached = await worker.fetch(request("/planet/assets/cached-Abcd1234.js"), env.bindings);
    expect(cached.status).toBe(304); expect(cached.headers.get("etag")).toBe('"known"');
  });
  it("rejects unexpected redirects and HTML masquerading as executable JavaScript", async () => {
    for (const response of [() => Response.redirect("https://remote.test/runtime.js"), () => new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } })]) {
      const env = assetFixture({ "/assets/app-Abcd1234.js": response });
      const result = await worker.fetch(request("/planet/assets/app-Abcd1234.js"), env.bindings);
      expect(result.status).toBe(502); expect(result.headers.has("location")).toBe(false);
    }
  });
  it("handles missing assets binding, thrown binding errors and unsupported methods safely", async () => {
    expect((await worker.fetch(request("/planet/en/"), {})).status).toBe(503);
    const broken: PlanetAssets = { async fetch() { throw new Error("SECRET MUST NOT BE REFLECTED"); } };
    const response = await worker.fetch(request("/planet/en/"), { ASSETS: broken });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("SECRET");
    const env = assetFixture(); const rejected = await worker.fetch(request("/planet/en/", { method: "POST" }), env.bindings);
    expect(rejected.status).toBe(405); expect(rejected.headers.get("allow")).toBe("GET, HEAD"); expect(env.fetch).not.toHaveBeenCalled();
  });
  it("routes only exact API subtree to its handler, preserving body/headers and no-store", async () => {
    const api = vi.fn(async (value: Request) => new Response(await value.text(), { headers: { "set-cookie": "__Host-session=encrypted; Secure; Path=/", "cache-control": "public" } }));
    const createApi = vi.fn(async () => api); const env = assetFixture();
    const body = JSON.stringify({ v: 1 });
    const response = await createPlanetWorker({ createApi }).fetch(request("/planet/api/configuration", { method: "POST", body }), env.bindings);
    expect(await response.text()).toBe(body); expect(api).toHaveBeenCalledTimes(1); expect(env.fetch).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.has("set-cookie")).toBe(true);
  });
});

describe("explicit host configuration and real API initialization", () => {
  it("starts unconfigured API fail-closed without touching static assets or exposing secrets", async () => {
    const env = assetFixture();
    const response = await worker.fetch(request("/planet/api/license/identity", { method: "POST" }), env.bindings);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "service-unavailable" });
    expect(response.headers.get("cache-control")).toBe("no-store"); expect(env.fetch).not.toHaveBeenCalled();
  });
  it("imports supplied ephemeral keys nonextractably and runs the real API with no implicit payment provider", async () => {
    const api = await createConfiguredPlanetApi(configured);
    const response = await api(request("/planet/api/configuration", { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"v":1}' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ v: 1, audience: configured.PLANET_LICENSE_AUDIENCE, product: configured.PLANET_LICENSE_PRODUCT, deletionDisclosure: null });
    const webhook = await api(request("/planet/api/payments/webhook/unconfigured", { method: "POST", body: "{}" }));
    expect(webhook.status).toBe(503);
  });
  it("passes only an explicit synchronized disclosure and refuses duplicate or incomplete configuration", async () => {
    const disclosure = { version: "qa-draft", ru: "Тестовый текст, не одобрение.", en: "Test text, not approval." };
    const api = await createConfiguredPlanetApi({ ...configured, PLANET_DELETION_DISCLOSURE_JSON: JSON.stringify(disclosure) });
    const response = await api(request("/planet/api/configuration", { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"v":1}' }));
    expect((await response.json()).deletionDisclosure).toEqual(disclosure);
    for (const value of ['{"version":"a","ru":"x","en":"y","en":"z"}', '{"version":"a","ru":"x"}', JSON.stringify({ ...disclosure, approval: true }), "x".repeat(32769)]) {
      await expect(createConfiguredPlanetApi({ ...configured, PLANET_DELETION_DISCLOSURE_JSON: value })).rejects.toThrow();
    }
  });
  it.each(PLANET_API_ENV_KEYS)("cannot initialize with missing %s", async (name) => {
    await expect(createConfiguredPlanetApi({ ...configured, [name]: undefined })).rejects.toThrow();
  });
  it.each([
    { PLANET_COOKIE_AES_KEY: "a".repeat(42) }, { PLANET_SIGNING_PRIVATE_JWK: '{"kty":"RSA"}' },
    { PLANET_GRANT_SECONDS: "0" }, { PLANET_GRANT_SECONDS: "86401" }, { PLANET_GRANT_SECONDS: "01" },
    { PLANET_OFFLINE_SECONDS: "3601" }, { PLANET_RECENT_AUTH_SECONDS: "901" },
    { SUPABASE_URL: "http://other.test" }, { PLANET_ORIGIN: "https://probpera.ru/" },
  ])("fails closed for invalid key/context/duration %#", async (change) => {
    await expect(createConfiguredPlanetApi({ ...configured, ...change })).rejects.toThrow();
  });
  it.each([
    { PLANET_LICENSE_RATE_LIMIT: undefined }, { PLANET_LICENSE_RATE_WINDOW_SECONDS: undefined },
    { PLANET_LICENSE_RATE_LIMIT: "0" }, { PLANET_LICENSE_RATE_LIMIT: "10001" }, { PLANET_LICENSE_RATE_LIMIT: "01" },
    { PLANET_LICENSE_RATE_WINDOW_SECONDS: "0" }, { PLANET_LICENSE_RATE_WINDOW_SECONDS: "86401" }, { PLANET_LICENSE_RATE_WINDOW_SECONDS: "1.5" },
  ])("preserves configuration with an unconfigured grant-only policy %#", async change => {
    const api = await createConfiguredPlanetApi({ ...configured, ...change });
    const response = await api(request("/planet/api/configuration", { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"v":1}' }));
    expect(response.status).toBe(200); expect((await response.json()).product).toBe(configured.PLANET_LICENSE_PRODUCT);
  });
  it.each(["valid", "missing", "malformed"] as const)("wires actual private license budget policy %s without signing denied grants", async mode => {
    const authKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", authKeys.publicKey);
    const subject = crypto.randomUUID(), sessionId = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
    const project = "https://worker-budget-" + crypto.randomUUID() + ".supabase.invalid";
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = encode({ alg: "ES256", typ: "JWT", kid: "fixture-auth" }) + "." + encode({
      iss: project + "/auth/v1", aud: "authenticated", sub: subject, session_id: sessionId, exp: now + 3600, iat: now - 1, is_anonymous: false,
    });
    const token = unsigned + "." + Buffer.from(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, authKeys.privateKey, new TextEncoder().encode(unsigned))).toString("base64url");
    const calls: { path: string; body: unknown }[] = [];
    const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      expect(url.origin).toBe(project);
      calls.push({ path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.pathname === "/auth/v1/.well-known/jwks.json") return json({ keys: [{ ...jwk, kid: "fixture-auth", alg: "ES256", use: "sig" }] });
      if (url.pathname === "/auth/v1/user") return json({ id: subject, aud: "authenticated", factors: [], is_anonymous: false });
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer " + configured.SUPABASE_SERVICE_ROLE_KEY);
      if (url.pathname.endsWith("/planet_has_auth_session")) return json(true);
      if (url.pathname.endsWith("/planet_get_web_access")) return json({ active: true, accessBlocked: false, activeReceiptCount: 1, sessionEpoch: 1 });
      if (url.pathname.endsWith("/planet_consume_license_grant_budget")) return json({ allowed: false, retry_after_seconds: 12 });
      throw new Error("Unexpected fixture RPC");
    };
    vi.stubGlobal("fetch", fetcher); const sign = vi.spyOn(crypto.subtle, "sign");
    try {
      const api = await createConfiguredPlanetApi({ ...configured, SUPABASE_URL: project,
        PLANET_LICENSE_RATE_LIMIT: mode === "missing" ? undefined : mode === "malformed" ? "0" : "2", PLANET_LICENSE_RATE_WINDOW_SECONDS: "60" });
      const body = { v: 1, audience: configured.PLANET_LICENSE_AUDIENCE, product: configured.PLANET_LICENSE_PRODUCT };
      const headers = { origin, "content-type": "application/json" };
      const bridge = await api(request("/planet/api/license/bridge", { method: "POST", headers: { ...headers, authorization: "Bearer " + token }, body: JSON.stringify(body) }));
      expect(bridge.status).toBe(200); const cookie = bridge.headers.get("set-cookie")!.split(";")[0];
      const identity = await api(request("/planet/api/license/identity", { method: "POST", headers: { ...headers, cookie }, body: JSON.stringify(body) }));
      expect(identity.status).toBe(200);
      const response = await api(request("/planet/api/license/session", { method: "POST", headers: { ...headers, cookie }, body: JSON.stringify({ ...body, subject }) }));
      expect(response.status).toBe(mode === "valid" ? 429 : 503); expect(sign).not.toHaveBeenCalled();
      const budgetCalls = calls.filter(call => call.path.endsWith("/planet_consume_license_grant_budget"));
      if (mode === "valid") {
        expect(budgetCalls).toEqual([{ path: "/rest/v1/rpc/planet_consume_license_grant_budget", body: { p_subject: subject, p_product_id: configured.PLANET_LICENSE_PRODUCT, p_limit: 2, p_window_seconds: 60 } }]);
        expect(response.headers.get("retry-after")).toBe("12");
      } else { expect(budgetCalls).toHaveLength(0); expect(response.headers.get("retry-after")).toBeNull(); }
    } finally { sign.mockRestore(); vi.unstubAllGlobals(); }
  });
});

describe("local draft Worker packaging", () => {
  it("keeps routing gated by code with no deployment bindings or generated credentials", async () => {
    const filename = path.resolve("server/planet/wrangler.draft.jsonc");
    const parsed = ts.parseConfigFileTextToJson(filename, await readFile(filename, "utf8"));
    expect(parsed.error).toBeUndefined();
    const config = parsed.config;
    expect(config.workers_dev).toBe(false); expect(config.preview_urls).toBe(false);
    expect(config.routes).toBeUndefined(); expect(config.account_id).toBeUndefined(); expect(config.build).toBeUndefined();
    expect(config.vars).toEqual({});
    expect(config.assets).toEqual({ directory: "../../dist-pwa", binding: "ASSETS", run_worker_first: true, html_handling: "none", not_found_handling: "none" });
    expect(path.resolve(path.dirname(filename), config.assets.directory)).toBe(path.resolve("dist-pwa"));
  });
  it("bundles the actual server entry locally without app assets or configured secret material", async () => {
    const built = await build({ entryPoints: ["server/planet/worker.ts"], bundle: true, write: false, platform: "browser", format: "esm", target: "es2022", external: ["node:*"], metafile: true, logLevel: "silent" });
    expect(built.outputFiles).toHaveLength(1);
    const text = built.outputFiles[0].text;
    expect(text).not.toContain(configured.PLANET_COOKIE_AES_KEY);
    expect(text).not.toContain(configured.PLANET_SIGNING_PRIVATE_JWK);
    expect(text).not.toContain("sb_secret_local_fixture");
    const inputs = Object.keys(built.metafile!.inputs);
    expect(inputs).toContain("server/planet/worker.ts"); expect(inputs).toContain("server/planet/supabase.ts");
    expect(inputs).toContain("server/planet/licenseRateLimiterSupabase.ts");
    expect(inputs.some(name => /(?:^|\/)src\/components\//u.test(name))).toBe(false);
  });
});

describe("explicit web/direct sandbox candidate Worker wiring", () => {
  const candidate = { mode: "sandbox", channel: "web-direct", shopId: "100500", catalogVersion: "synthetic-v1", amountMinor: 12345, returnUrl: origin + "/planet/ru/" };
  const webhook = () => request("/planet/api/payments/webhook/yookassa-sandbox", { method: "POST", body: JSON.stringify({ type: "untrusted-hint" }) });
  it("constructs and wires only explicit sandbox inputs without network or client checkout activation", async () => {
    const network = vi.fn<typeof fetch>(async () => { throw Error("No network permitted in fixture"); }); vi.stubGlobal("fetch", network);
    try {
      const api = await createConfiguredPlanetApi({ ...configured, PLANET_LICENSE_PRODUCT: "sandbox.base-v1", PLANET_YOOKASSA_SANDBOX_JSON: JSON.stringify(candidate),
        PLANET_YOOKASSA_SANDBOX_SECRET: "test_synthetic_not_a_key" });
      const configuration = await api(request("/planet/api/configuration", { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"v":1}' }));
      expect(configuration.status).toBe(200); const body = await configuration.json(); expect(body.product).toBe("sandbox.base-v1");
      expect(body).not.toHaveProperty("checkoutEnabled"); expect(body).not.toHaveProperty("secret");
      expect((await api(webhook())).status).toBe(401); expect(network).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([{ mode: "production" }, { channel: "app-store" }, { channel: "google-play" }, { amountMinor: 1.5 }, { amountMinor: 0 },
    { shopId: "../shop" }, { returnUrl: "https://foreign.invalid/planet/ru/" }, { returnUrl: origin + "/admin/" },
    { returnUrl: origin + "/planet/ru/?redirect=foreign" }, { commercialApproval: true }])("leaves candidate unavailable for invalid inputs %o without disabling configuration", async change => {
    const network = vi.fn<typeof fetch>(async () => { throw Error("No network permitted in fixture"); }); vi.stubGlobal("fetch", network);
    try {
      const api = await createConfiguredPlanetApi({ ...configured, PLANET_LICENSE_PRODUCT: "sandbox.base-v1", PLANET_YOOKASSA_SANDBOX_JSON: JSON.stringify({ ...candidate, ...change }),
        PLANET_YOOKASSA_SANDBOX_SECRET: "test_synthetic_not_a_key" });
      expect((await api(webhook())).status).toBe(503);
      expect((await api(request("/planet/api/configuration", { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"v":1}' }))).status).toBe(200);
      expect(network).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([{ PLANET_LICENSE_PRODUCT: "base-v1", PLANET_YOOKASSA_SANDBOX_SECRET: "test_synthetic_not_a_key" },
    { PLANET_LICENSE_PRODUCT: "sandbox.base-v1", PLANET_YOOKASSA_SANDBOX_SECRET: "live_synthetic_not_a_key" },
    { PLANET_LICENSE_PRODUCT: "sandbox.base-v1", PLANET_YOOKASSA_SANDBOX_SECRET: undefined }])("never connects production product/live or missing secret %o", async change => {
    const api = await createConfiguredPlanetApi({ ...configured, PLANET_YOOKASSA_SANDBOX_JSON: JSON.stringify(candidate), ...change });
    expect((await api(webhook())).status).toBe(503);
  });
});
