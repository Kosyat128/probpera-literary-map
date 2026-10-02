import { createPlanetApi } from "./api";
import { createCookieCodec, createGrantSigner } from "./crypto";
import { createCanonicalSupabaseServices } from "./supabase";
import { createCanonicalLicenseRateLimiter } from "./licenseRateLimiterSupabase";
import { createCanonicalPaymentOrderStore } from "./paymentOrdersSupabase";
import { createSandboxPaymentOrders } from "./paymentOrders";
import { createYooKassaSandboxGateway } from "./yookassa";

/** The standard Request/Response subset of the Cloudflare ASSETS Fetcher. */
export interface PlanetAssets { fetch(request: Request): Promise<Response> }
export const PLANET_API_ENV_KEYS = [
  "PLANET_ORIGIN", "PLANET_COOKIE_NAME", "PLANET_LICENSE_ISSUER", "PLANET_LICENSE_AUDIENCE",
  "PLANET_LICENSE_PRODUCT", "PLANET_LICENSE_KID", "PLANET_GRANT_SECONDS", "PLANET_OFFLINE_SECONDS",
  "PLANET_RECENT_AUTH_SECONDS", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "PLANET_COOKIE_AES_KEY", "PLANET_SIGNING_PRIVATE_JWK",
] as const;
export const PLANET_LICENSE_RATE_ENV_KEYS = ["PLANET_LICENSE_RATE_LIMIT", "PLANET_LICENSE_RATE_WINDOW_SECONDS"] as const;
type PlanetEnvKey = (typeof PLANET_API_ENV_KEYS)[number] | (typeof PLANET_LICENSE_RATE_ENV_KEYS)[number];
/** Optional bindings are deliberate: an unconfigured draft still serves its preparing shell. */
export type PlanetWorkerBindings = Partial<Record<PlanetEnvKey, string>> & {
  ASSETS?: PlanetAssets;
  PLANET_DELETION_DISCLOSURE_JSON?: string;
  /** Explicit server-only candidate configuration. Never a production/store PSP. */
  PLANET_YOOKASSA_SANDBOX_JSON?: string;
  PLANET_YOOKASSA_SANDBOX_SECRET?: string;
};
type ApiHandler = (request: Request) => Promise<Response>;
export interface PlanetWorkerOptions {
  /** Code-only test seam; no request/environment value can replace authentication. */
  createApi?: (bindings: PlanetWorkerBindings) => Promise<ApiHandler>;
}

const SCOPE = "/planet/";
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Robots-Tag": "noindex, nofollow",
};
const INTERNAL_FILES = new Set(["artifact.json", "asset-provenance.json", "bootstrap-integrity.json", "package.json", "package-lock.json", "manifest.json", "sha256sums.txt", "agents.md"]);
const ATTRIBUTIONS = new Set(["assets/country-flags/ATTRIBUTION.md", "fonts/editorial/LICENSE.source-sans-3.md", "fonts/editorial/LICENSE.source-serif-4.md"]);
const SHELLS = new Map([["", "index.html"], ["ru/", "ru/index.html"], ["en/", "en/index.html"]]);
const REDIRECTS = new Map([["index.html", ""], ["ru", "ru/"], ["en", "en/"], ["ru/index.html", "ru/"], ["en/index.html", "en/"]]);
const PASSTHROUGH_HEADERS = ["accept", "accept-encoding", "if-none-match", "if-modified-since", "range", "if-range"];

function output(status: number, error: string | null, method = "GET", extra: Record<string, string> = {}): Response {
  return new Response(error && method !== "HEAD" ? JSON.stringify({ error }) : null, {
    status, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}
function publicPath(pathname: string): string | null {
  if (!pathname.startsWith(SCOPE) || pathname.length > 1024 || /[%\\\u0000-\u0020\u007f]/u.test(pathname)) return null;
  const relative = pathname.slice(SCOPE.length);
  const parts = relative.split("/");
  if (parts.some((part, index) => (!part && index !== parts.length - 1) || part.startsWith(".") || part.startsWith("_") || part.endsWith(".")
    || INTERNAL_FILES.has(part.toLowerCase()) || /^(?:src|server|scripts|node_modules|apps|docs|requirements|tests?|private|admin|cms|auth|license|licenses|entitlements|child|children|parent|purchase|billing|payments)$/iu.test(part))) return null;
  return relative;
}
function mimeMatches(filename: string, contentType: string | null): boolean {
  const mime = contentType?.split(";", 1)[0].trim().toLowerCase();
  if (/\.html$/u.test(filename)) return mime === "text/html";
  if (/\.js$/u.test(filename)) return mime === "application/javascript" || mime === "text/javascript";
  if (/\.css$/u.test(filename)) return mime === "text/css";
  if (/\.json$/u.test(filename)) return mime === "application/json";
  if (/\.webmanifest$/u.test(filename)) return mime === "application/manifest+json" || mime === "application/json";
  return true;
}
function secret(bindings: PlanetWorkerBindings, name: PlanetEnvKey, max = 8192): string {
  const value = bindings[name];
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw new Error("Missing/invalid server configuration");
  return value;
}
function seconds(bindings: PlanetWorkerBindings, name: PlanetEnvKey): number {
  const value = secret(bindings, name, 5);
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error("Invalid explicit duration");
  return Number(value);
}
function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new Error("Invalid server key encoding");
  const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/"));
  const canonical = btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
  if (canonical !== value || binary.length !== 32) throw new Error("Invalid server key length");
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function privateJwk(source: string, kid: string): JsonWebKey {
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid private key");
  const key = value as Record<string, unknown>;
  if (Object.keys(key).some(field => !["kty", "crv", "x", "y", "d", "kid", "alg", "use", "key_ops", "ext"].includes(field))
    || key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string" || typeof key.d !== "string"
    || (key.kid !== undefined && key.kid !== kid) || (key.alg !== undefined && key.alg !== "ES256")
    || (key.use !== undefined && key.use !== "sig") || (key.ext !== undefined && typeof key.ext !== "boolean")
    || (key.key_ops !== undefined && (!Array.isArray(key.key_ops) || key.key_ops.length !== 1 || key.key_ops[0] !== "sign"))) throw new Error("Invalid private signing key");
  decodeKey(key.x); decodeKey(key.y); decodeKey(key.d);
  // Metadata was checked above; only explicit signing fields reach WebCrypto.
  return { kty: "EC", crv: "P-256", x: key.x, y: key.y, d: key.d, alg: "ES256", use: "sig", key_ops: ["sign"], ext: false };
}
function deletionDisclosure(source: string | undefined): { version: string; ru: string; en: string } | null {
  if (source === undefined) return null;
  if (typeof source !== "string" || new TextEncoder().encode(source).length > 32768) throw new Error("Invalid disclosure size");
  JSON.parse(source); // Enforce JSON whitespace/grammar before duplicate-aware scalar parsing.
  let rest = source.trim();
  const values: Record<string, string> = Object.create(null);
  const stringToken = () => {
    const match = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/u.exec(rest);
    if (!match) throw new Error("Invalid disclosure field");
    rest = rest.slice(match[0].length).trimStart();
    return JSON.parse(match[0]) as string;
  };
  if (!rest.startsWith("{")) throw new Error("Invalid disclosure");
  rest = rest.slice(1).trimStart();
  if (!rest.startsWith("}")) while (true) {
    const key = stringToken();
    if (Object.hasOwn(values, key) || !rest.startsWith(":")) throw new Error("Duplicate/invalid disclosure");
    rest = rest.slice(1).trimStart(); values[key] = stringToken();
    if (!rest.startsWith(",")) break;
    rest = rest.slice(1).trimStart();
  }
  if (rest !== "}" || Object.keys(values).sort().join(",") !== "en,ru,version") throw new Error("Invalid disclosure fields");
  return { version: values.version, ru: values.ru, en: values.en };
}

export async function createConfiguredPlanetApi(bindings: PlanetWorkerBindings): Promise<ApiHandler> {
  // Snapshot configuration before awaits; request-specific identities never live
  // in module globals and no runtime key is created or exported here.
  const config = Object.freeze(Object.fromEntries([
    ...PLANET_API_ENV_KEYS.map(name => [name, secret(bindings, name)]),
    ...PLANET_LICENSE_RATE_ENV_KEYS.map(name => [name, bindings[name]]),
  ]));
  const disclosure = deletionDisclosure(bindings.PLANET_DELETION_DISCLOSURE_JSON);
  const kid = config.PLANET_LICENSE_KID;
  const [cookieKey, signingKey] = await Promise.all([
    crypto.subtle.importKey("raw", decodeKey(config.PLANET_COOKIE_AES_KEY), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
    crypto.subtle.importKey("jwk", privateJwk(config.PLANET_SIGNING_PRIVATE_JWK, kid), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]),
  ]);
  const canonical = { canonicalProjectUrl: config.SUPABASE_URL,
    publishableKey: config.SUPABASE_PUBLISHABLE_KEY, serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    recentAuthenticationSeconds: seconds(config, "PLANET_RECENT_AUTH_SECONDS") };
  const services = createCanonicalSupabaseServices(canonical);
  let sandboxOrders: ReturnType<typeof createSandboxPaymentOrders> | undefined;
  if (bindings.PLANET_YOOKASSA_SANDBOX_JSON !== undefined || bindings.PLANET_YOOKASSA_SANDBOX_SECRET !== undefined) {
    try {
      const source = bindings.PLANET_YOOKASSA_SANDBOX_JSON;
      if (typeof source !== "string" || new TextEncoder().encode(source).length > 8192) throw new Error("Invalid sandbox configuration size");
      const candidate: unknown = JSON.parse(source);
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Invalid sandbox configuration");
      const value = candidate as Record<string, unknown>;
      if (Object.keys(value).sort().join(",") !== "amountMinor,catalogVersion,channel,mode,returnUrl,shopId" || value.mode !== "sandbox" || value.channel !== "web-direct"
        || !/^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$/u.test(config.PLANET_LICENSE_PRODUCT)
        || typeof value.shopId !== "string" || typeof value.catalogVersion !== "string" || typeof value.returnUrl !== "string" || typeof value.amountMinor !== "number"
        || typeof bindings.PLANET_YOOKASSA_SANDBOX_SECRET !== "string") throw new Error("Sandbox candidate unavailable");
      const returnRoute = new URL(value.returnUrl);
      if (returnRoute.origin !== config.PLANET_ORIGIN || !["/planet/ru/", "/planet/en/"].includes(returnRoute.pathname)
        || returnRoute.search || returnRoute.hash || returnRoute.username || returnRoute.password) throw new Error("Invalid sandbox return route");
      sandboxOrders = createSandboxPaymentOrders({ catalog: [{ product: config.PLANET_LICENSE_PRODUCT, version: value.catalogVersion,
        amountMinor: value.amountMinor, currency: "RUB" }], returnUrl: value.returnUrl, leaseSeconds: 60,
        gateway: createYooKassaSandboxGateway({ mode: "sandbox", shopId: value.shopId, secretKey: bindings.PLANET_YOOKASSA_SANDBOX_SECRET }),
        store: createCanonicalPaymentOrderStore(canonical), ledger: services.ledger });
    } catch {
      // Invalid/incomplete candidate inputs leave only payments unavailable.
      // No key, default price, commercial approval or native channel is inferred.
    }
  }
  let licenseRateLimiter: ReturnType<typeof createCanonicalLicenseRateLimiter> | undefined;
  try {
    licenseRateLimiter = createCanonicalLicenseRateLimiter(canonical, {
      limit: seconds(config, "PLANET_LICENSE_RATE_LIMIT"), windowSeconds: seconds(config, "PLANET_LICENSE_RATE_WINDOW_SECONDS"),
    });
  } catch {
    // Missing/invalid grant policy supplies no limiter. Existing account routes
    // stay available; license/session denies the absent capability before signing.
  }
  return createPlanetApi({ origin: config.PLANET_ORIGIN, audience: config.PLANET_LICENSE_AUDIENCE,
    product: config.PLANET_LICENSE_PRODUCT, cookieName: config.PLANET_COOKIE_NAME,
    deletionDisclosure: disclosure,
    services: { ...services,
      licenseRateLimiter,
      ...(sandboxOrders ? { paymentOrders: sandboxOrders, payments: sandboxOrders.verification } : {}),
      cookies: createCookieCodec({ key: cookieKey, origin: config.PLANET_ORIGIN, cookieName: config.PLANET_COOKIE_NAME }),
      signer: createGrantSigner({ privateKey: signingKey, kid, issuer: config.PLANET_LICENSE_ISSUER,
        audience: config.PLANET_LICENSE_AUDIENCE, product: config.PLANET_LICENSE_PRODUCT,
        grantSeconds: seconds(config, "PLANET_GRANT_SECONDS"), offlineSeconds: seconds(config, "PLANET_OFFLINE_SECONDS") }),
      // The default draft has no provider. Candidate wiring above makes no call
      // on construction and never accepts production keys/products/channels.
    },
  });
}

export function createPlanetWorker(options: PlanetWorkerOptions = {}) {
  const apiFactory = options.createApi ?? createConfiguredPlanetApi;
  return {
    async fetch(request: Request, bindings: PlanetWorkerBindings): Promise<Response> {
      let url: URL;
      try { url = new URL(request.url); } catch { return output(400, "invalid-request", request.method); }
      if (!url.pathname.startsWith(SCOPE) || url.hash || url.username || url.password || /[%\\\u0000-\u0020\u007f]/u.test(url.pathname)) return output(404, "not-found", request.method);
      if (url.pathname.startsWith(SCOPE + "api/")) {
        try {
          const api = await apiFactory(bindings);
          const result = await api(request);
          const headers = new Headers(result.headers);
          for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
          headers.set("Cache-Control", "no-store");
          return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
        } catch { return output(503, "service-unavailable", request.method); }
      }
      const relative = publicPath(url.pathname);
      if (relative === null || relative === "api") return output(404, "not-found", request.method);
      if (!["GET", "HEAD"].includes(request.method)) return output(405, "method-not-allowed", request.method, { Allow: "GET, HEAD" });
      if (REDIRECTS.has(relative)) return output(308, null, request.method, { Location: SCOPE + REDIRECTS.get(relative) + url.search });
      if (!bindings.ASSETS || typeof bindings.ASSETS.fetch !== "function") return output(503, "assets-unavailable", request.method);
      const knownFile = SHELLS.get(relative) ?? relative;
      const assetExtension = /\.(?:html|js|css|json|webmanifest|png|jpe?g|webp|avif|svg|woff2?|ttf|otf|mp3|m4a|ogg|wav|wasm|txt)$/u.test(knownFile) || ATTRIBUTIONS.has(knownFile);
      const navigation = request.headers.get("accept")?.includes("text/html") === true;
      if (!assetExtension && !navigation) return output(404, "not-found", request.method);
      const fetchAsset = async (filename: string, recovery = false) => {
        const target = new URL("/" + filename, url.origin);
        const headers = new Headers();
        // A recovery document is a different representation; validators and byte
        // ranges belonging to the missing resource must never apply to it.
        for (const name of recovery ? ["accept", "accept-encoding"] : PASSTHROUGH_HEADERS) { const value = request.headers.get(name); if (value !== null) headers.set(name, value); }
        return bindings.ASSETS!.fetch(new Request(target, { method: request.method, headers, redirect: "error", signal: request.signal }));
      };
      try {
        let filename = knownFile;
        let result = assetExtension ? await fetchAsset(filename) : new Response(null, { status: 404 });
        let status = result.status;
        if (status === 404 && navigation && !/\.(?:js|css|json|webmanifest)$/u.test(knownFile)) {
          void result.body?.cancel().catch(() => undefined);
          filename = (relative.startsWith("en/") ? "en/" : relative.startsWith("ru/") ? "ru/" : "") + "404.html";
          result = await fetchAsset(filename, true);
          if (result.status !== 200) {
            void result.body?.cancel().catch(() => undefined);
            return output(result.status === 404 ? 404 : 503, result.status === 404 ? "not-found" : "assets-unavailable", request.method);
          }
          status = 404;
        }
        if (result.status >= 500) {
          void result.body?.cancel().catch(() => undefined);
          return output(503, "assets-unavailable", request.method);
        }
        if (result.status >= 300 && result.status < 400 && result.status !== 304) {
          void result.body?.cancel().catch(() => undefined);
          return output(502, "invalid-asset-response", request.method);
        }
        if (![200, 206, 304, 404, 416].includes(result.status)) {
          void result.body?.cancel().catch(() => undefined);
          return output(502, "invalid-asset-response", request.method);
        }
        if ([200, 206].includes(result.status) && !mimeMatches(filename, result.headers.get("content-type"))) {
          void result.body?.cancel().catch(() => undefined);
          return output(502, "invalid-asset-response", request.method);
        }
        const headers = new Headers(result.headers);
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
        for (const name of ["set-cookie", "location", "service-worker-allowed", "access-control-allow-origin", "access-control-allow-credentials"]) headers.delete(name);
        const fingerprinted = /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/u.test(filename);
        headers.set("Cache-Control", status >= 400 ? "no-store" : fingerprinted ? "public, max-age=31536000, immutable" : "no-cache");
        if (relative === "sw.js") headers.set("Service-Worker-Allowed", SCOPE);
        return new Response(request.method === "HEAD" ? null : result.body, { status, statusText: status === result.status ? result.statusText : "Not Found", headers });
      } catch { return output(503, "assets-unavailable", request.method); }
    },
  };
}

export default createPlanetWorker();
