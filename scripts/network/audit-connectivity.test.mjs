import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import {
  DEFAULT_DIRECT_IPV4,
  DEFAULT_DIRECT_IPV6,
  auditConnectivity,
  auditDns,
  auditDnsWithRetries,
  auditRoute,
  buildNodeRequestOptions,
  classifyDnsAnswer,
  inspectRootHtml,
  inspectRedirectManifest,
  inspectLegacyAliasResponse,
  inspectNotFoundHtml,
  normalizeRootHtmlForIntegrity,
  nodeRequestOnce,
  parseCliOptions,
  redactSensitive,
  selectRepresentativeHtmlUrl,
  validateCriticalHeaders,
} from "./audit-connectivity.mjs";
import {
  auditExternalIpv6Origin,
  createGlobalpingForcedIpv6Request,
} from "./globalping-forced-ipv6.mjs";
import { PUBLIC_CONTENT_SECURITY_POLICY } from "../cloudflare/configure-edge-security.mjs";

const RELEASE_SHA = "a".repeat(40);
const ARTICLE_PATH = "/stati/o-literature/representative-publication/";
const ARTICLE_URL = `https://probpera.ru${ARTICLE_PATH}`;
const LEGACY_ALIAS_PATH = "/articles/legacy-000";
const NOT_FOUND_PATH = "/.well-known/probpera-connectivity-audit-not-found";
const redirectManifest = JSON.stringify(Array.from({ length: 157 }, (_, index) => ({
  source: `/articles/legacy-${String(index).padStart(3, "0")}`,
  destination: ARTICLE_PATH,
  permanent: true,
})));

function rootHtml({ beacon = false, suffix = "" } = {}) {
  const cloudflareBeacon = beacon
    ? '<!-- Cloudflare Web Analytics --><script defer src="https://static.cloudflareinsights.com/beacon.min.js/v123" data-cf-beacon="{&quot;token&quot;:&quot;public-zone-id&quot;}"></script><!-- End Cloudflare Web Analytics -->'
    : "";
  return `<!doctype html>
<html lang="ru"><head>
  <link rel="canonical" href="https://probpera.ru/">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:url" content="https://probpera.ru/">
  <meta property="og:image" content="https://probpera.ru/og-v3.webp">
  <script type="application/ld+json">{"@context":"https://schema.org","url":"https://probpera.ru/"}</script>
  <script type="module" src="/assets/site.js"></script>
</head><body><main>${"Литература ".repeat(900)}${suffix}</main>${cloudflareBeacon}</body></html>`;
}

function representativeHtml({ beacon = false } = {}) {
  const cloudflareBeacon = beacon
    ? '<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v123"></script>'
    : "";
  return `<!doctype html><html lang="ru"><head>
    <link rel="canonical" href="${ARTICLE_URL}">
    <meta property="og:url" content="${ARTICLE_URL}">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","url":"${ARTICLE_URL}"}</script>
  </head><body><article>${"Большая публикация. ".repeat(1_200)}</article>${cloudflareBeacon}</body></html>`;
}

function legacyAliasHtml() {
  return `<!doctype html><html lang="ru"><head>
    <meta name="robots" content="noindex,follow">
    <link rel="canonical" href="${ARTICLE_URL}">
    <meta http-equiv="refresh" content="0;url=${ARTICLE_URL}">
  </head><body><p>Материал переехал: <a href="${ARTICLE_URL}">открыть постоянный адрес</a>.</p></body></html>`;
}

function notFoundHtml({ beacon = false } = {}) {
  return `<!doctype html><html lang="ru"><head>
    <meta name="robots" content="noindex,follow">
    <link rel="canonical" href="https://probpera.ru/">
  </head><body><main><span>Ошибка 404</span><h1>Эта страница не найдена</h1></main>${beacon
    ? '<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v123"></script>'
    : ""}</body></html>`;
}

const largeContent = JSON.stringify({
  version: 1,
  articles: [{ id: "article-1", body: "x".repeat(20_000) }],
});

function response(urlValue, options, {
  beacon = false,
  releaseSha = RELEASE_SHA,
  rootSuffix = "",
  assetSuffix = "",
  httpStatus = 308,
  criticalHeaders = true,
  legacyStatic = false,
} = {}) {
  const url = new URL(urlValue);
  const secure = url.protocol === "https:";
  const base = {
    statusCode: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: Buffer.alloc(0),
    url: url.href,
    redirects: [],
    remoteAddress: options.connectIp || (options.lookupFamily === 6 ? "2606:4700::10" : "104.16.1.10"),
    connection: {
      connectAddress: options.connectIp,
      hostHeader: options.hostHeader,
      lookupFamily: options.lookupFamily || (options.connectIp?.includes(":") ? 6 : 4),
      servername: secure ? options.servername : null,
    },
    tls: secure
      ? { authorized: true, authorizationError: null, servername: options.servername }
      : null,
  };
  if (!secure) {
    return {
      ...base,
      statusCode: httpStatus,
      headers: httpStatus === 308 ? { location: "https://probpera.ru/" } : {},
    };
  }
  if (url.hostname === "www.probpera.ru") {
    return {
      ...base,
      statusCode: 308,
      headers: {
        "content-security-policy": PUBLIC_CONTENT_SECURITY_POLICY,
        "cross-origin-opener-policy": "same-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
        "referrer-policy": "strict-origin-when-cross-origin",
        "strict-transport-security": "max-age=31536000",
        "x-content-type-options": "nosniff",
        location: "https://probpera.ru/",
      },
    };
  }
  if (url.pathname === "/") {
    const securityHeaders = criticalHeaders ? {
      "content-security-policy": PUBLIC_CONTENT_SECURITY_POLICY,
      "cross-origin-opener-policy": "same-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
    } : {};
    return {
      ...base,
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...securityHeaders,
      },
      body: Buffer.from(rootHtml({ beacon, suffix: rootSuffix })),
    };
  }
  if (url.pathname === "/sitemap.xml") {
    return {
      ...base,
      headers: { "content-type": "application/xml" },
      body: Buffer.from(`<urlset><url><loc>https://probpera.ru/</loc></url><url><loc>${ARTICLE_URL}</loc></url></urlset>`),
    };
  }
  if (url.pathname === "/robots.txt") {
    return {
      ...base,
      body: Buffer.from("User-agent: *\nAllow: /\nSitemap: https://probpera.ru/sitemap.xml\n"),
    };
  }
  if (url.pathname === "/rss.xml") {
    return {
      ...base,
      headers: { "content-type": "application/rss+xml" },
      body: Buffer.from('<rss><channel><link>https://probpera.ru/</link></channel></rss>'),
    };
  }
  if (url.pathname === "/.well-known/security.txt") {
    return {
      ...base,
      body: Buffer.from([
        "Contact: mailto:probperasite@yandex.ru",
        "Expires: 2099-01-01T00:00:00Z",
        "Canonical: https://probpera.ru/.well-known/security.txt",
      ].join("\n")),
    };
  }
  if (url.pathname === "/cms/published-content.json") {
    return {
      ...base,
      headers: { "content-type": "application/json" },
      body: Buffer.from(largeContent),
    };
  }
  if (url.pathname === "/redirects.generated.json") {
    return {
      ...base,
      headers: { "content-type": "application/json" },
      body: Buffer.from(redirectManifest),
    };
  }
  if (url.pathname === LEGACY_ALIAS_PATH) {
    if (legacyStatic && options.connectIp) {
      return {
        ...base,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: Buffer.from(legacyAliasHtml()),
      };
    }
    return {
      ...base,
      statusCode: 308,
      headers: { location: ARTICLE_URL },
    };
  }
  if (url.pathname === NOT_FOUND_PATH) {
    return {
      ...base,
      statusCode: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: Buffer.from(notFoundHtml({ beacon })),
    };
  }
  if (url.pathname === "/.well-known/probpera-release-head.json") {
    return {
      ...base,
      headers: { "content-type": "application/json" },
      body: Buffer.from(JSON.stringify({ schemaVersion: 1, commitSha: releaseSha })),
    };
  }
  if (url.pathname === "/sw.js") {
    return {
      ...base,
      headers: { "content-type": "text/javascript" },
      body: Buffer.from([
        'self.addEventListener("install", (event) => event.waitUntil(Promise.resolve()));',
        'self.addEventListener("fetch", () => {});',
        "x".repeat(1_024),
      ].join("\n")),
    };
  }
  if (url.pathname === "/site.webmanifest") {
    return {
      ...base,
      headers: { "content-type": "application/manifest+json" },
      body: Buffer.from(JSON.stringify({
        name: "Проба Пера",
        short_name: "Проба Пера",
        start_url: "/",
        scope: "/",
        display: "standalone",
        icons: [{ src: "/brand/probpera-logo.png", sizes: "500x500", type: "image/png" }],
      })),
    };
  }
  if (url.pathname === ARTICLE_PATH) {
    return {
      ...base,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: Buffer.from(representativeHtml({ beacon })),
    };
  }
  if (url.pathname.endsWith(".js")) {
    return {
      ...base,
      headers: { "content-type": "text/javascript" },
      body: Buffer.from(`export const ready = true;${assetSuffix}`),
    };
  }
  if (url.pathname.endsWith(".css")) {
    return {
      ...base,
      headers: { "content-type": "text/css" },
      body: Buffer.from(`body{color:#111}${assetSuffix}`),
    };
  }
  if (url.pathname.endsWith(".webp")) {
    return {
      ...base,
      headers: { "content-type": "image/webp" },
      body: Buffer.from(`RIFF-WEBP-${assetSuffix}`),
    };
  }
  throw new Error(`Unexpected mock URL: ${url.href}`);
}

const successfulDns = async ({ family }) => family === 4
  ? [{ address: "104.16.1.10", ttl: 60 }]
  : [{ address: "2606:4700::10", ttl: 60 }];

const globalpingSecurityHeaders = {
  "content-security-policy": PUBLIC_CONTENT_SECURITY_POLICY,
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
};

function globalpingMeasurement(job, { authorized = true } = {}) {
  let statusCode = 200;
  let headers = { ...globalpingSecurityHeaders, "content-type": "application/json" };
  let rawBody = JSON.stringify({ schemaVersion: 1, commitSha: RELEASE_SHA });
  if (job.check === "http-root") {
    statusCode = 308;
    headers = { location: job.role === "www" ? "https://www.probpera.ru/" : "https://probpera.ru/" };
    rawBody = null;
  } else if (job.role === "www" && job.check === "https-root") {
    statusCode = 308;
    headers = { ...globalpingSecurityHeaders, location: "https://probpera.ru/" };
    rawBody = null;
  } else if (job.role === "www" && job.check === "https-release") {
    statusCode = 308;
    headers = {
      ...globalpingSecurityHeaders,
      location: `https://probpera.ru/.well-known/probpera-release-head.json`,
    };
    rawBody = null;
  }
  return {
    id: `measurement-${job.role}-${job.check}-${job.address.slice(-3).replace(/:/gu, "x")}`,
    status: "finished",
    createdProbesCount: 2,
    request: createGlobalpingForcedIpv6Request(job, 2),
    results: Array.from({ length: 2 }, (_, index) => ({
      probe: {
        country: index ? "DE" : "NL",
        city: index ? "Frankfurt" : "Amsterdam",
        asn: 64_500 + index,
        network: `Datacenter ${index + 1}`,
        tags: ["datacenter-network"],
      },
      result: {
        status: "finished",
        statusCode,
        headers,
        rawBody,
        truncated: false,
        resolvedAddress: job.address,
        tls: job.protocol === "HTTP2" ? {
          authorized,
          error: authorized ? null : "Hostname/IP does not match certificate's altnames",
          subject: { CN: authorized ? job.host : "*.github.io", alt: `DNS:${job.host}` },
          fingerprint256: "AA:BB",
        } : null,
      },
    })),
  };
}

test("CLI accepts repeatable/CSV origin IPs and has the official defaults", () => {
  const defaults = parseCliOptions([], {});
  assert.deepEqual(defaults.originIps, [...DEFAULT_DIRECT_IPV4, ...DEFAULT_DIRECT_IPV6]);
  assert.equal(defaults.mode, "all");
  assert.equal(defaults.host, "probpera.ru");

  const parsed = parseCliOptions([
    "--mode=direct",
    "--origin-ip=192.0.2.1,192.0.2.2",
    "--origin-ip",
    "2001:db8::1",
    "--resolver=1.1.1.1,8.8.8.8",
    "--dns-attempts=6",
    "--dns-retry-delay-ms=15000",
    "--external-ipv6-proof=globalping",
    "--release-sha",
    RELEASE_SHA,
    "--json=true",
  ], {});
  assert.deepEqual(parsed.originIps, ["192.0.2.1", "192.0.2.2", "2001:db8::1"]);
  assert.deepEqual(parsed.resolvers, ["1.1.1.1", "8.8.8.8"]);
  assert.equal(parsed.releaseSha, RELEASE_SHA);
  assert.equal(parsed.dnsAttempts, 6);
  assert.equal(parsed.dnsRetryDelayMs, 15_000);
  assert.equal(parsed.externalIpv6Proof, "globalping");
  assert.equal(parsed.json, true);
  assert.throws(() => parseCliOptions(["--origin-ip=not-an-ip"], {}), /Invalid --origin-ip/u);
  assert.throws(() => parseCliOptions(["--timeout-ms=60001"], {}), /must not exceed/u);
});

test("root inspection requires canonical SEO metadata and same-origin JS/CSS/image", () => {
  const inspected = inspectRootHtml(rootHtml(), "https://probpera.ru");
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.canonical, "https://probpera.ru/");
  assert.equal(inspected.openGraphUrl, "https://probpera.ru/");
  assert.equal(inspected.jsonLdDocuments, 1);
  assert.equal(inspected.assets.script[0], "https://probpera.ru/assets/site.js");
  assert.equal(inspected.assets.style[0], "https://probpera.ru/assets/site.css");
  assert.equal(inspected.assets.image[0], "https://probpera.ru/og-v3.webp");
  assert.equal(inspected.assets.manifest[0], "https://probpera.ru/site.webmanifest");

  const invalid = inspectRootHtml("<html><head></head></html>", "https://probpera.ru");
  assert.match(invalid.errors.join("\n"), /canonical/u);
  assert.match(invalid.errors.join("\n"), /JSON-LD/u);
});

test("representative publication is selected deterministically from sitemap", () => {
  const sitemap = `<urlset>
    <url><loc>https://probpera.ru/stati/z-section/z-article/</loc></url>
    <url><loc>https://probpera.ru/stati/</loc></url>
    <url><loc>https://evil.example/stati/a/a/</loc></url>
    <url><loc>https://probpera.ru/stati/a-section/a-article/</loc></url>
  </urlset>`;
  assert.equal(
    selectRepresentativeHtmlUrl(sitemap, "https://probpera.ru"),
    "https://probpera.ru/stati/a-section/a-article/"
  );
});

test("generated redirect manifest selects a deterministic real legacy alias", () => {
  const inspected = inspectRedirectManifest(redirectManifest, "https://probpera.ru");
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.count, 157);
  assert.deepEqual(inspected.sample, {
    source: LEGACY_ALIAS_PATH,
    destination: ARTICLE_URL,
    permanent: true,
  });

  const sparse = inspectRedirectManifest(JSON.stringify([{
    source: LEGACY_ALIAS_PATH,
    destination: ARTICLE_PATH,
    permanent: true,
  }]), "https://probpera.ru");
  assert.match(sparse.errors.join("\n"), /at least 157/u);
});

test("legacy alias and unknown 404 semantics fail closed", () => {
  const staticAlias = inspectLegacyAliasResponse({
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body: Buffer.from(legacyAliasHtml()),
  }, `https://probpera.ru${LEGACY_ALIAS_PATH}`, ARTICLE_URL);
  assert.deepEqual(staticAlias.errors, []);
  assert.equal(staticAlias.mode, "static");

  const wrongRedirect = inspectLegacyAliasResponse({
    statusCode: 308,
    headers: { location: "https://evil.example/" },
    body: Buffer.alloc(0),
  }, `https://probpera.ru${LEGACY_ALIAS_PATH}`, ARTICLE_URL);
  assert.match(wrongRedirect.errors.join("\n"), /Location must be exactly/u);

  assert.deepEqual(inspectNotFoundHtml(notFoundHtml(), "https://probpera.ru").errors, []);
  assert.match(
    inspectNotFoundHtml("<html><body>OK</body></html>", "https://probpera.ru").errors.join("\n"),
    /canonical|noindex|visibly/u
  );
});

test("integrity normalization removes only the recognized Cloudflare beacon", () => {
  assert.equal(
    normalizeRootHtmlForIntegrity(rootHtml({ beacon: true })),
    normalizeRootHtmlForIntegrity(rootHtml())
  );
  const unrelated = '<script src="https://example.com/beacon.min.js"></script>';
  assert.equal(normalizeRootHtmlForIntegrity(unrelated), unrelated);
});

test("critical global security header validation is strict", () => {
  const valid = {
    "content-security-policy": PUBLIC_CONTENT_SECURITY_POLICY,
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
  };
  assert.deepEqual(validateCriticalHeaders(valid), []);
  assert.match(validateCriticalHeaders({}).join("\n"), /Strict-Transport-Security/u);
  assert.match(validateCriticalHeaders({}).join("\n"), /Content-Security-Policy/u);
  assert.match(validateCriticalHeaders({ ...valid,
    "content-security-policy": "default-src 'self'; frame-ancestors *",
  }).join("\n"), /exactly match/u);
  assert.match(validateCriticalHeaders({ ...valid,
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  }).join("\n"), /payment/u);
  assert.match(validateCriticalHeaders({ ...valid,
    "cross-origin-opener-policy": "unsafe-none",
  }).join("\n"), /same-origin/u);
});

test("forced HTTPS transport pins the IP but preserves Host, SNI, and certificate verification", () => {
  const options = buildNodeRequestOptions("https://probpera.ru/example?q=1", {
    connectIp: "185.199.108.153",
    hostHeader: "probpera.ru",
    servername: "probpera.ru",
    headers: { host: "unsafe.example", Accept: "text/html" },
  });
  assert.equal(options.hostname, "185.199.108.153");
  assert.equal(options.family, 4);
  assert.equal(options.headers.Host, "probpera.ru");
  assert.equal(Object.hasOwn(options.headers, "host"), false);
  assert.equal(options.servername, "probpera.ru");
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.path, "/example?q=1");
});

test("Globalping IPv6 diagnostic pins raw target but cannot replace full content parity", async () => {
  const job = {
    address: DEFAULT_DIRECT_IPV6[0],
    host: "probpera.ru",
    role: "apex",
    check: "https-release",
    protocol: "HTTP2",
    port: 443,
    path: "/.well-known/probpera-release-head.json",
  };
  const request = createGlobalpingForcedIpv6Request(job, 2);
  assert.equal(request.target, DEFAULT_DIRECT_IPV6[0]);
  assert.equal(request.measurementOptions.protocol, "HTTP2");
  assert.equal(request.measurementOptions.request.host, "probpera.ru");
  assert.equal(Object.hasOwn(request.measurementOptions, "ipVersion"), false);
  assert.deepEqual(request.locations, [{ magic: "datacenter", limit: 2 }]);

  const proof = await auditExternalIpv6Origin({
    host: "probpera.ru",
    ipv6Addresses: [DEFAULT_DIRECT_IPV6[0]],
    expectedReleaseSha: RELEASE_SHA,
  }, {
    runMeasurementImpl: async (measurementJob) => globalpingMeasurement(measurementJob),
  });
  assert.equal(proof.transportReady, true);
  assert.equal(proof.contentIntegrityBound, false);
  assert.equal(proof.requiredOk, false);
  assert.equal(proof.status, "failed");
  assert.equal(proof.reason, "external_ipv6_content_integrity_unbound");
  assert.equal(proof.measurements.length, 5);
  assert.equal(proof.measurements.filter((measurement) => measurement.protocol === "HTTP2").length, 3);
  assert.equal(proof.addresses[DEFAULT_DIRECT_IPV6[0]].apex.http2Verified, true);
  assert.equal(proof.addresses[DEFAULT_DIRECT_IPV6[0]].www.releaseSha, RELEASE_SHA);
  assert.equal(proof.measurements.every((measurement) => measurement.resultsCount === 2), true);
});

test("Globalping IPv6 evidence stays red on certificate mismatch", async () => {
  const proof = await auditExternalIpv6Origin({
    host: "probpera.ru",
    ipv6Addresses: [DEFAULT_DIRECT_IPV6[0]],
    expectedReleaseSha: RELEASE_SHA,
  }, {
    runMeasurementImpl: async (job) => globalpingMeasurement(job, {
      authorized: job.role !== "apex",
    }),
  });
  assert.equal(proof.requiredOk, false);
  assert.equal(proof.reason, "direct_tls_not_ready");
  assert.equal(proof.addresses[DEFAULT_DIRECT_IPV6[0]].apex.certificateValid, false);
  assert.equal(JSON.stringify(proof).includes("*.github.io"), true);
});

test("real transport resolves after end even when IncomingMessage.socket becomes null", async (t) => {
  let receivedHost = null;
  const server = createServer((request, responseValue) => {
    receivedHost = request.headers.host;
    responseValue.setHeader("Connection", "close");
    responseValue.setHeader("Content-Type", "text/plain");
    responseValue.end("transport-ok");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.equal(typeof address, "object");

  const result = await nodeRequestOnce(`http://audit.invalid:${address.port}/probe`, {
    connectIp: "127.0.0.1",
    hostHeader: "probpera.ru",
    maxBodyBytes: 1_024,
    responseObserver(incoming) {
      // Reproduce Node's post-end cleanup while retaining the socket snapshot
      // captured by nodeRequestOnce at response callback time.
      Object.defineProperty(incoming, "socket", {
        configurable: true,
        value: null,
      });
    },
    timeoutMs: 1_000,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.toString("utf8"), "transport-ok");
  assert.equal(result.remoteAddress, "127.0.0.1");
  assert.equal(receivedHost, "probpera.ru");
});

test("a forced direct route uses the public Host and SNI for every HTTPS request", async () => {
  const calls = [];
  const requestImpl = async (url, options) => {
    calls.push({ url: String(url), ...options });
    return response(url, options);
  };
  const route = await auditRoute({
    kind: "direct",
    host: "probpera.ru",
    address: "185.199.108.153",
  }, {
    expectedReleaseSha: RELEASE_SHA,
    requestImpl,
    timeoutMs: 100,
  });

  assert.equal(route.status, "passed");
  assert.equal(route.reason, null);
  assert.equal(route.root.bytes >= 8 * 1024, true);
  assert.equal(route.largeContent.bytes > 16 * 1024, true);
  assert.equal(route.representativeHtml.bytes > 16 * 1024, true);
  assert.equal(route.representativeHtml.path, ARTICLE_PATH);
  assert.equal(route.legacyRedirects.manifest.count, 157);
  assert.equal(route.legacyRedirects.sample.path, LEGACY_ALIAS_PATH);
  assert.equal(route.legacyRedirects.sample.mode, "redirect");
  assert.equal(route.notFound.statusCode, 404);
  assert.equal(route.assets.length, 3);
  assert.equal(route.pwa.serviceWorker.bytes >= 1_024, true);
  assert.equal(route.pwa.manifest.statusCode, 200);
  assert.equal(route.assets.every((asset) => /^[0-9a-f]{64}$/u.test(asset.sha256)), true);
  assert.equal(calls.every((call) => call.connectIp === "185.199.108.153"), true);
  assert.equal(calls.every((call) => call.hostHeader === "probpera.ru"), true);
  assert.equal(
    calls.filter((call) => call.url.startsWith("https:")).every((call) => call.servername === "probpera.ru"),
    true
  );
});

test("plaintext HTTP on a direct IP is a fail-closed direct_tls_not_ready result", async () => {
  const route = await auditRoute({
    kind: "direct",
    host: "probpera.ru",
    address: "185.199.108.153",
  }, {
    expectedReleaseSha: RELEASE_SHA,
    requestImpl: (url, options) => response(url, options, { httpStatus: 200 }),
  });
  assert.equal(route.status, "failed");
  assert.equal(route.reason, "direct_tls_not_ready");
  assert.equal(
    route.checks.some((check) => check.id === "http.redirect" && check.required && check.status === "failed"),
    true
  );
});

test("direct route cannot become proof-ready without the global critical security contract", async () => {
  const route = await auditRoute({
    kind: "direct",
    host: "probpera.ru",
    address: "185.199.108.153",
  }, {
    expectedReleaseSha: RELEASE_SHA,
    requestImpl: (url, options) => response(url, options, { criticalHeaders: false }),
  });
  assert.equal(route.status, "failed");
  assert.equal(route.reason, "critical_security_headers_invalid");
  assert.equal(
    route.checks.some((check) => check.id === "https.root.security_headers" && check.required && check.status === "failed"),
    true
  );
});

test("a direct certificate name mismatch is structured and never retried insecurely", async () => {
  const calls = [];
  const route = await auditRoute({
    kind: "direct",
    host: "probpera.ru",
    address: "185.199.108.153",
  }, {
    requestImpl: async (url, options) => {
      calls.push(options);
      if (String(url).startsWith("https:")) {
        const error = new Error("Hostname/IP does not match certificate's altnames");
        error.code = "ERR_TLS_CERT_ALTNAME_INVALID";
        throw error;
      }
      return response(url, options);
    },
  });
  assert.equal(route.status, "failed");
  assert.equal(route.reason, "direct_tls_not_ready");
  assert.equal(calls.every((call) => call.rejectUnauthorized !== false), true);
});

test("IPv6 network absence is reported as unavailable, not as an invalid origin", async () => {
  const route = await auditRoute({
    kind: "direct",
    host: "probpera.ru",
    address: "2606:50c0:8000::153",
  }, {
    requestImpl: async () => {
      const error = new Error("connect ENETUNREACH");
      error.code = "ENETUNREACH";
      throw error;
    },
  });
  assert.equal(route.status, "unavailable");
  assert.equal(route.reason, "ipv6_unavailable");
  assert.equal(route.checks.every((check) => check.required === false), true);
});

test("IPv4 network absence stays a required unavailable result", async () => {
  const route = await auditRoute({
    kind: "direct",
    host: "probpera.ru",
    address: "185.199.108.153",
  }, {
    requestImpl: async () => {
      const error = new Error("connect EHOSTUNREACH");
      error.code = "EHOSTUNREACH";
      throw error;
    },
  });
  assert.equal(route.status, "unavailable");
  assert.equal(route.reason, "ipv4_unavailable");
  assert.equal(route.checks.some((check) => check.required), true);
});

test("all-mode compares normalized HTML and exact CMS, release-head, and asset bytes", async () => {
  const requestImpl = async (url, options) => response(url, options, {
    beacon: !options.connectIp,
  });
  const matching = await auditConnectivity({
    host: "probpera.ru",
    mode: "all",
    originIps: ["185.199.108.153"],
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl,
  });
  assert.equal(matching.requiredOk, true);
  assert.equal(matching.integrity.checks.every((check) => check.status === "passed"), true);
  assert.equal(matching.wwwRoutes.every((route) => route.status === "passed"), true);
  assert.equal(matching.proof.proofEligible, false, "one IP is deliberately insufficient for a bundled proof");

  const mismatching = await auditConnectivity({
    host: "probpera.ru",
    mode: "all",
    originIps: ["185.199.108.153"],
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl: (url, options) => response(url, options, {
      beacon: !options.connectIp,
      assetSuffix: options.connectIp ? "-different" : "",
    }),
  });
  assert.equal(mismatching.requiredOk, false);
  assert.equal(
    mismatching.integrity.checks.some((check) => check.reason === "asset_content_mismatch" && check.status === "failed"),
    true
  );
});

test("global mode independently requires ordinary IPv4 and IPv6 HTTP/TLS/content routes", async () => {
  const calls = [];
  const healthy = await auditConnectivity({
    host: "probpera.ru",
    mode: "global",
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl: async (url, requestOptions) => {
      calls.push({ url: String(url), lookupFamily: requestOptions.lookupFamily });
      return response(url, requestOptions);
    },
  });
  assert.equal(healthy.requiredOk, true);
  assert.deepEqual(healthy.routes.map((route) => route.family).sort(), [4, 6]);
  assert.deepEqual(healthy.wwwRoutes.map((route) => route.family).sort(), [4, 6]);
  assert.equal(healthy.routes.every((route) => route.status === "passed"), true);
  assert.equal(calls.some((call) => call.lookupFamily === 4), true);
  assert.equal(calls.some((call) => call.lookupFamily === 6), true);

  const brokenIpv6 = await auditConnectivity({
    host: "probpera.ru",
    mode: "global",
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl: async (url, requestOptions) => {
      const result = response(url, requestOptions);
      return requestOptions.lookupFamily === 6
        ? { ...result, remoteAddress: "104.16.1.10" }
        : result;
    },
  });
  assert.equal(brokenIpv6.requiredOk, false);
  assert.equal(brokenIpv6.routes.find((route) => route.family === 6).status, "failed");
  assert.equal(brokenIpv6.routes.find((route) => route.family === 6).checks.some((check) =>
    check.reason === "network_family_mismatch" && check.status === "failed"), true);
});

test("bundled direct proof covers apex and www across all four A and four AAAA addresses", async () => {
  const summary = await auditConnectivity({
    host: "probpera.ru",
    mode: "direct",
    originIps: [...DEFAULT_DIRECT_IPV4, ...DEFAULT_DIRECT_IPV6],
    pagesHostname: "Kosyat128.GitHub.io",
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl: (url, options) => response(url, options),
  });
  assert.equal(summary.requiredOk, true);
  assert.equal(summary.directTlsReady, true);
  assert.equal(summary.proof.schemaVersion, 1);
  assert.equal(summary.proof.status, "passed");
  assert.equal(summary.proof.proofEligible, true);
  assert.equal(summary.proof.expectedMainSha, RELEASE_SHA);
  assert.equal(summary.proof.pagesHostname, "kosyat128.github.io");
  assert.equal(summary.proof.publicRecordsFingerprint, null);
  assert.equal(summary.proof.hosts.apex.httpStatus, 200);
  assert.equal(summary.proof.hosts.apex.rootContentLength >= 8 * 1024, true);
  assert.equal(summary.proof.hosts.apex.contentLength > 16 * 1024, true);
  assert.equal(summary.proof.hosts.apex.representativeHtmlPath, ARTICLE_PATH);
  assert.equal(summary.proof.hosts.apex.representativeHtmlStatus, 200);
  assert.equal(summary.proof.hosts.apex.representativeHtmlContentLength > 16 * 1024, true);
  assert.match(summary.proof.hosts.apex.representativeHtmlSha256, /^[0-9a-f]{64}$/u);
  assert.equal(summary.proof.hosts.apex.redirectManifestCount, 157);
  assert.equal(summary.proof.hosts.apex.legacyAliasPath, LEGACY_ALIAS_PATH);
  assert.equal(summary.proof.hosts.apex.legacyAliasTarget, ARTICLE_URL);
  assert.equal(summary.proof.hosts.apex.legacyAliasMode, "redirect");
  assert.equal(summary.proof.hosts.apex.notFoundStatus, 404);
  assert.equal(summary.proof.hosts.apex.notFoundCanonical, "https://probpera.ru/");
  assert.equal(summary.proof.hosts.apex.originIpsTested.length, 8);
  assert.equal(summary.proof.hosts.www.httpStatus, 308);
  assert.equal(summary.proof.hosts.www.redirectTo, "https://probpera.ru/");
  assert.equal(summary.proof.hosts.www.originIpsTested.length, 8);
  assert.equal(Date.parse(summary.proof.expiresAt) > Date.parse(summary.proof.verifiedAt), true);
});

test("portable HTTP 200 legacy fallback cannot authorize a direct production route", async () => {
  const summary = await auditConnectivity({
    host: "probpera.ru",
    mode: "direct",
    originIps: [...DEFAULT_DIRECT_IPV4, ...DEFAULT_DIRECT_IPV6],
    pagesHostname: "Kosyat128.github.io",
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl: (url, options) => response(url, options, { legacyStatic: true }),
  });
  assert.equal(summary.requiredOk, true);
  assert.equal(summary.directTlsReady, false);
  assert.equal(summary.proof.proofEligible, false);
  assert.equal(summary.proof.hosts.apex.legacyAliasMode, "static");
});

test("external Globalping transport evidence cannot substitute for IPv6 content parity", async () => {
  const summary = await auditConnectivity({
    host: "probpera.ru",
    mode: "direct",
    expectedDnsRoute: "direct",
    originIps: [...DEFAULT_DIRECT_IPV4, ...DEFAULT_DIRECT_IPV6],
    externalIpv6Proof: "globalping",
    externalIpv6Dependencies: {
      runMeasurementImpl: async (job) => globalpingMeasurement(job),
    },
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: async ({ family }) => (family === 4 ? DEFAULT_DIRECT_IPV4 : DEFAULT_DIRECT_IPV6)
      .map((address) => ({ address, ttl: 60 })),
    requestImpl: async (url, requestOptions) => {
      if ((requestOptions.connectIp && requestOptions.connectIp.includes(":")) ||
          requestOptions.lookupFamily === 6) {
        const error = new Error("connect ENETUNREACH");
        error.code = "ENETUNREACH";
        throw error;
      }
      return response(url, requestOptions);
    },
  });
  assert.equal(summary.routes.filter((route) => route.family === 6).every((route) =>
    route.status === "unavailable"), true);
  assert.equal(summary.routes.find((route) =>
    route.kind === "global" && route.family === 6).externalIpv6Covered, undefined);
  assert.equal(summary.externalIpv6.transportReady, true);
  assert.equal(summary.externalIpv6.contentIntegrityBound, false);
  assert.equal(summary.externalIpv6.status, "failed");
  assert.equal(summary.externalIpv6.reason, "external_ipv6_content_integrity_unbound");
  assert.equal(summary.externalIpv6.measurements.length, 20);
  assert.equal(summary.requiredOk, false);
  assert.equal(summary.proof.proofEligible, false);
  assert.equal(summary.proof.hosts.apex.originIpsTested.length, 4);
  assert.equal(summary.proof.hosts.www.originIpsTested.length, 4);
  assert.equal(summary.proof.externalIpv6Proof, null);
});

test("www plaintext HTTP cannot produce an eligible direct proof", async () => {
  const summary = await auditConnectivity({
    host: "probpera.ru",
    mode: "direct",
    originIps: [...DEFAULT_DIRECT_IPV4, ...DEFAULT_DIRECT_IPV6],
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    resolveImpl: successfulDns,
    requestImpl: (url, options) => {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" && parsed.hostname === "www.probpera.ru") {
        return response(url, options, { httpStatus: 200 });
      }
      return response(url, options);
    },
  });
  assert.equal(summary.requiredOk, false);
  assert.equal(summary.proof.proofEligible, false);
  assert.equal(summary.proof.status, "failed");
  assert.equal(summary.wwwRoutes.every((route) => route.reason === "direct_tls_not_ready"), true);
});

test("DNS keeps unavailable IPv6 separate from malformed answers", async () => {
  const dns = await auditDns({
    host: "probpera.ru",
    resolvers: ["resolver-a", "resolver-b"],
    resolveImpl: async ({ resolver, family }) => {
      if (resolver === "resolver-a" && family === 4) return [{ address: "104.16.1.7", ttl: 30 }];
      if (resolver === "resolver-a" && family === 6) {
        const error = new Error("no AAAA data");
        error.code = "ENODATA";
        throw error;
      }
      if (family === 4) return [{ address: "not-an-address", ttl: 30 }];
      const error = new Error("resolver timed out");
      error.code = "ETIMEDOUT";
      throw error;
    },
  });
  assert.equal(dns.queries.find((query) => query.resolver === "resolver-a" && query.family === 6).status, "missing");
  assert.equal(dns.queries.find((query) => query.resolver === "resolver-a" && query.family === 6).required, false);
  assert.equal(dns.queries.find((query) => query.resolver === "resolver-b" && query.family === 4).status, "invalid");
  assert.equal(dns.requiredOk, false);
});

test("DNS requires a two-of-three quorum for both A and AAAA", async () => {
  const resolvers = ["1.1.1.1", "8.8.8.8", "9.9.9.9"];
  const quorum = await auditDns({
    host: "probpera.ru",
    resolvers,
    resolveImpl: async ({ resolver, family }) => {
      if (resolver === "9.9.9.9") {
        const error = new Error("timed out");
        error.code = "ETIMEDOUT";
        throw error;
      }
      return family === 4
        ? [{ address: "104.16.1.10", ttl: 60 }]
        : [{ address: "2606:4700::10", ttl: 60 }];
    },
  });
  assert.equal(quorum.quorum, 2);
  assert.equal(quorum.requiredOk, true);
  assert.equal(quorum.families.every((family) => family.status === "passed"), true);

  const unavailable = await auditDns({
    host: "probpera.ru",
    resolvers,
    resolveImpl: async () => {
      const error = new Error("network unavailable");
      error.code = "ENETUNREACH";
      throw error;
    },
  });
  assert.equal(unavailable.requiredOk, false);
  assert.equal(unavailable.families.every((family) => family.status === "unavailable"), true);
});

test("DNS propagation retries stop at quorum without hiding the failed attempt", async () => {
  let queries = 0;
  const sleeps = [];
  const dns = await auditDnsWithRetries({
    host: "probpera.ru",
    expectedRoute: "direct",
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    attempts: 3,
    retryDelayMs: 0,
    sleepImpl: async (milliseconds) => sleeps.push(milliseconds),
    resolveImpl: async ({ family }) => {
      queries += 1;
      const attempt = Math.ceil(queries / 12);
      if (attempt === 1) {
        return family === 4
          ? [{ address: "104.16.1.10", ttl: 60 }]
          : [{ address: "2606:4700::10", ttl: 60 }];
      }
      return (family === 4 ? DEFAULT_DIRECT_IPV4 : DEFAULT_DIRECT_IPV6)
        .map((address) => ({ address, ttl: 60 }));
    },
  });
  assert.equal(dns.requiredOk, true);
  assert.equal(dns.attemptCount, 2);
  assert.equal(dns.attempts[0].requiredOk, false);
  assert.equal(dns.attempts[1].requiredOk, true);
  assert.deepEqual(sleeps, [0]);
});

test("post-apply direct mode verifies the normal public route only after DNS quorum", async () => {
  let dnsQueries = 0;
  const calls = [];
  const summary = await auditConnectivity({
    host: "probpera.ru",
    mode: "direct",
    expectedDnsRoute: "direct",
    originIps: [DEFAULT_DIRECT_IPV4[0], DEFAULT_DIRECT_IPV6[0]],
    releaseSha: RELEASE_SHA,
    resolvers: ["1.1.1.1"],
    dnsAttempts: 2,
    dnsRetryDelayMs: 0,
    dnsSleepImpl: async () => {},
    resolveImpl: async ({ family }) => {
      dnsQueries += 1;
      const attempt = Math.ceil(dnsQueries / 4);
      if (attempt === 1) {
        return family === 4
          ? [{ address: "104.16.1.10", ttl: 60 }]
          : [{ address: "2606:4700::10", ttl: 60 }];
      }
      return [{
        address: family === 4 ? DEFAULT_DIRECT_IPV4[0] : DEFAULT_DIRECT_IPV6[0],
        ttl: 60,
      }];
    },
    requestImpl: async (url, requestOptions) => {
      calls.push({ url: String(url), connectIp: requestOptions.connectIp });
      return response(url, requestOptions, { beacon: !requestOptions.connectIp });
    },
  });
  assert.equal(summary.requiredOk, true);
  assert.equal(summary.dns.attemptCount, 2);
  assert.equal(summary.routes.some((route) =>
    route.kind === "global" && route.verification === "post_dns_propagation" && route.status === "passed"), true);
  assert.equal(calls.some((call) => call.url === "https://probpera.ru/" && call.connectIp === null), true);
  assert.equal(calls.filter((call) =>
    call.url === "https://probpera.ru/" && call.connectIp === DEFAULT_DIRECT_IPV4[0]).length, 1);
});

test("DNS route classification rejects stale and mixed syntactically valid answers", async () => {
  assert.equal(classifyDnsAnswer([{ address: "104.16.1.1" }], 4), "cloudflare");
  assert.equal(
    classifyDnsAnswer(DEFAULT_DIRECT_IPV4.map((address) => ({ address })), 4),
    "direct"
  );
  assert.equal(classifyDnsAnswer([{ address: "203.0.113.10" }], 4), "unknown");

  const stale = await auditDns({
    host: "probpera.ru",
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    resolveImpl: async ({ family }) => family === 4
      ? [{ address: "203.0.113.10", ttl: 60 }]
      : [{ address: "2001:db8::10", ttl: 60 }],
  });
  assert.equal(stale.requiredOk, false);
  assert.equal(stale.queries.every((query) => query.reason === "dns_route_unknown"), true);

  const mixed = await auditDns({
    host: "probpera.ru",
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    resolveImpl: async ({ resolver, family }) => {
      if (resolver === "9.9.9.9") {
        return (family === 4 ? DEFAULT_DIRECT_IPV4 : DEFAULT_DIRECT_IPV6)
          .map((address) => ({ address, ttl: 60 }));
      }
      return family === 4
        ? [{ address: "104.16.1.10", ttl: 60 }]
        : [{ address: "2606:4700::10", ttl: 60 }];
    },
  });
  assert.equal(mixed.requiredOk, false);
  assert.equal(mixed.families.every((family) => family.reason === "dns_route_policy_mixed"), true);
});

test("direct DNS gate requires each resolver to return the exact official Pages sets", async () => {
  const direct = await auditDns({
    host: "probpera.ru",
    expectedRoute: "direct",
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    resolveImpl: async ({ family }) => (family === 4 ? DEFAULT_DIRECT_IPV4 : DEFAULT_DIRECT_IPV6)
      .map((address) => ({ address, ttl: 60 })),
  });
  assert.equal(direct.requiredOk, true);
  assert.equal(direct.families.every((family) => family.route === "direct"), true);

  const incomplete = await auditDns({
    host: "probpera.ru",
    expectedRoute: "direct",
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    resolveImpl: async ({ family }) => [{
      address: family === 4 ? DEFAULT_DIRECT_IPV4[0] : DEFAULT_DIRECT_IPV6[0],
      ttl: 60,
    }],
  });
  assert.equal(incomplete.requiredOk, false);
  assert.equal(incomplete.queries.every((query) => query.reason === "dns_route_unknown"), true);
});

test("DNS direct classification follows the reviewed configured origin sets", async () => {
  const customOrigins = ["192.0.2.40", "192.0.2.41", "2001:db8:40::1"];
  assert.equal(
    classifyDnsAnswer(customOrigins.slice(0, 2).map((address) => ({ address })), 4, customOrigins),
    "direct"
  );
  const custom = await auditDns({
    host: "probpera.ru",
    expectedRoute: "direct",
    expectedDirectAddresses: customOrigins,
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    resolveImpl: async ({ family }) => customOrigins
      .filter((address) => (address.includes(":") ? 6 : 4) === family)
      .map((address) => ({ address, ttl: 60 })),
  });
  assert.equal(custom.requiredOk, true);
  assert.equal(custom.families.every((family) => family.route === "direct"), true);

  const staleOfficial = await auditDns({
    host: "probpera.ru",
    expectedRoute: "direct",
    expectedDirectAddresses: customOrigins,
    resolvers: ["1.1.1.1"],
    resolveImpl: async ({ family }) => (family === 4 ? DEFAULT_DIRECT_IPV4 : DEFAULT_DIRECT_IPV6)
      .map((address) => ({ address, ttl: 60 })),
  });
  assert.equal(staleOfficial.requiredOk, false);
  assert.equal(staleOfficial.queries.every((query) => query.reason === "dns_route_unknown"), true);
});

test("connectivity summary requires independent DNS quorum for apex and www", async () => {
  const summary = await auditConnectivity({
    host: "probpera.ru",
    mode: "global",
    resolvers: ["1.1.1.1", "8.8.8.8", "9.9.9.9"],
    resolveImpl: async ({ host, family }) => {
      if (host === "www.probpera.ru" && family === 6) {
        const error = new Error("no www AAAA response");
        error.code = "ENODATA";
        throw error;
      }
      return family === 4
        ? [{ address: "104.16.1.10", ttl: 60 }]
        : [{ address: "2606:4700::10", ttl: 60 }];
    },
    requestImpl: (url, options) => response(url, options),
  });
  assert.equal(summary.dns.hosts["probpera.ru"].requiredOk, true);
  assert.equal(summary.dns.hosts["www.probpera.ru"].requiredOk, false);
  assert.equal(summary.dns.requiredOk, false);
  assert.equal(summary.requiredOk, false);
  assert.equal(
    summary.dns.families.some((family) =>
      family.host === "www.probpera.ru" && family.family === 6 && family.status === "unavailable"
    ),
    true
  );
});

test("diagnostics redact credentials and common tokens", () => {
  const output = redactSensitive(
    "Authorization: Bearer abc123 token=secret-value https://user:pass@example.com/?api_key=top-secret ghp_abcdefghijklmnopqrstuvwxyz123456"
  );
  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("secret-value"), false);
  assert.equal(output.includes("user:pass"), false);
  assert.equal(output.includes("top-secret"), false);
  assert.equal(output.includes("ghp_"), false);
  assert.match(output, /\[REDACTED\]/u);
});
