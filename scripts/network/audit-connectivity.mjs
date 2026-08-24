import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { setTimeout as waitFor } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  brotliDecompressSync,
  gunzipSync,
  inflateSync,
} from "node:zlib";
import { auditExternalIpv6Origin } from "./globalping-forced-ipv6.mjs";
import {
  PUBLIC_CONTENT_SECURITY_POLICY,
  PUBLIC_SECURITY_HEADERS,
} from "../cloudflare/configure-edge-security.mjs";

export const AUDIT_SCHEMA = "probpera-connectivity-audit/v1";
export const DEFAULT_HOST = "probpera.ru";
export const DEFAULT_DIRECT_IPV4 = Object.freeze([
  "185.199.108.153",
  "185.199.109.153",
  "185.199.110.153",
  "185.199.111.153",
]);
export const DEFAULT_DIRECT_IPV6 = Object.freeze([
  "2606:50c0:8000::153",
  "2606:50c0:8001::153",
  "2606:50c0:8002::153",
  "2606:50c0:8003::153",
]);
export const DEFAULT_RESOLVERS = Object.freeze([
  "1.1.1.1",
  "8.8.8.8",
  "9.9.9.9",
]);
const CLOUDFLARE_IPV4_CIDRS = Object.freeze([
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]);
const CLOUDFLARE_IPV6_CIDRS = Object.freeze([
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
]);

const RELEASE_HEAD_PATH = "/.well-known/probpera-release-head.json";
const LARGE_CONTENT_PATH = "/cms/published-content.json";
const REDIRECT_MANIFEST_PATH = "/redirects.generated.json";
const UNKNOWN_NOT_FOUND_PATH = "/.well-known/probpera-connectivity-audit-not-found";
const MINIMUM_LEGACY_REDIRECTS = 157;
// The production root is an intentionally compact, crawlable app shell (~10.8 KiB).
// A separate immutable CMS snapshot proves delivery of an uncompressed body >16 KiB.
const ROOT_MINIMUM_BYTES = 8 * 1024;
const LARGE_CONTENT_MINIMUM_BYTES = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_DNS_RETRY_DELAY_MS = 15_000;
const DEFAULT_MAX_BODY_BYTES = 12 * 1024 * 1024;
const PROOF_LIFETIME_MS = 30 * 60 * 1000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const STRICT_REDIRECT_STATUSES = new Set([301, 308]);
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const NETWORK_UNAVAILABLE_CODES = new Set([
  "ABORT_ERR",
  "EADDRNOTAVAIL",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENETRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
]);
const DNS_MISSING_CODES = new Set(["ENODATA", "ENOTFOUND", "ENXDOMAIN"]);
const TLS_ALTNAME_CODES = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED",
]);

function unique(values) {
  return [...new Set(values)];
}

function commaValues(values) {
  return unique(
    values
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function booleanValue(value, name) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  throw new Error(`${name} must be true or false`);
}

function positiveInteger(value, name, fallback) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function nonnegativeInteger(value, name, fallback) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function normalizeHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw.includes(":")) throw new Error("--host must be a DNS hostname");
  let url;
  try {
    url = new URL(`https://${raw}/`);
  } catch {
    throw new Error("--host must be a valid DNS hostname");
  }
  if (url.hostname !== raw || net.isIP(raw) || !raw.includes(".")) {
    throw new Error("--host must be a valid DNS hostname without a path or port");
  }
  return raw;
}

function normalizeReleaseSha(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const sha = String(value).trim().toLowerCase();
  if (!SHA_PATTERN.test(sha)) {
    throw new Error("--release-sha must be a 40-character Git commit SHA");
  }
  return sha;
}

function validateAddresses(addresses) {
  for (const address of addresses) {
    if (!net.isIP(address)) throw new Error(`Invalid --origin-ip value: ${address}`);
  }
  return addresses;
}

function canonicalIp(address) {
  const family = net.isIP(address);
  if (family === 4) return address;
  if (family === 6) return new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  return null;
}

function cloudflareBlockList() {
  const blocks = new net.BlockList();
  for (const value of [...CLOUDFLARE_IPV4_CIDRS, ...CLOUDFLARE_IPV6_CIDRS]) {
    const [address, prefix] = value.split("/");
    blocks.addSubnet(address, Number(prefix), net.isIP(address) === 4 ? "ipv4" : "ipv6");
  }
  return blocks;
}

const CLOUDFLARE_BLOCKS = cloudflareBlockList();

export function classifyDnsAnswer(records, family, expectedDirectAddresses = null) {
  const addresses = unique(records.map((record) => canonicalIp(record.address))).sort();
  const configuredDirect = Array.isArray(expectedDirectAddresses)
    ? expectedDirectAddresses
    : family === 4 ? DEFAULT_DIRECT_IPV4 : DEFAULT_DIRECT_IPV6;
  const official = configuredDirect
    .filter((address) => net.isIP(address) === family)
    .map(canonicalIp)
    .sort();
  if (addresses.length === official.length && addresses.every((address, index) => address === official[index])) {
    return "direct";
  }
  const type = family === 4 ? "ipv4" : "ipv6";
  if (addresses.length && addresses.every((address) => CLOUDFLARE_BLOCKS.check(address, type))) {
    return "cloudflare";
  }
  return "unknown";
}

function validateResolvers(resolvers) {
  for (const resolver of resolvers) {
    if (!net.isIP(resolver)) throw new Error(`Invalid --resolver value: ${resolver}`);
  }
  return resolvers;
}

function environmentList(environment, name, fallback) {
  if (!Object.prototype.hasOwnProperty.call(environment, name)) return [...fallback];
  return commaValues([environment[name]]);
}

function collectArguments(argv) {
  const values = new Map();
  const booleanNames = new Set(["json", "help"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unknown positional argument: ${argument}`);
    const equals = argument.indexOf("=");
    let name;
    let value;
    if (equals >= 0) {
      name = argument.slice(2, equals);
      value = argument.slice(equals + 1);
    } else {
      name = argument.slice(2);
      const next = argv[index + 1];
      if (!booleanNames.has(name) && next !== undefined && !next.startsWith("--")) {
        value = next;
        index += 1;
      } else {
        value = true;
      }
    }
    const entries = values.get(name) || [];
    entries.push(value);
    values.set(name, entries);
  }
  return values;
}

export function parseCliOptions(argv = process.argv.slice(2), environment = process.env) {
  const argumentsByName = collectArguments(argv);
  const supported = new Set([
    "help",
    "host",
    "expected-dns-route",
    "external-ipv6-proof",
    "dns-attempts",
    "dns-retry-delay-ms",
    "json",
    "mode",
    "origin-ip",
    "release-sha",
    "resolver",
    "timeout-ms",
  ]);
  for (const name of argumentsByName.keys()) {
    if (!supported.has(name)) throw new Error(`Unknown option: --${name}`);
  }

  const last = (name) => argumentsByName.get(name)?.at(-1);
  const mode = String(last("mode") || "all").toLowerCase();
  if (!["all", "direct", "global"].includes(mode)) {
    throw new Error("--mode must be global, direct, or all");
  }
  const expectedDnsRoute = String(
    last("expected-dns-route") || environment.PROBPERA_EXPECTED_DNS_ROUTE ||
      (mode === "global" ? "cloudflare" : "either")
  ).toLowerCase();
  if (!["cloudflare", "direct", "either"].includes(expectedDnsRoute)) {
    throw new Error("--expected-dns-route must be cloudflare, direct, or either");
  }
  const externalIpv6Proof = String(
    last("external-ipv6-proof") || environment.PROBPERA_EXTERNAL_IPV6_PROOF || "none"
  ).toLowerCase();
  if (!["none", "globalping"].includes(externalIpv6Proof)) {
    throw new Error("--external-ipv6-proof must be none or globalping");
  }
  if (mode === "global" && externalIpv6Proof !== "none") {
    throw new Error("--external-ipv6-proof is only valid for direct or all mode");
  }

  const cliOriginIps = commaValues(argumentsByName.get("origin-ip") || []);
  const configuredIpv4 = environmentList(
    environment,
    "PROBPERA_DIRECT_IPV4",
    DEFAULT_DIRECT_IPV4
  );
  const configuredIpv6 = environmentList(
    environment,
    "PROBPERA_DIRECT_IPV6",
    DEFAULT_DIRECT_IPV6
  );
  const originIps = validateAddresses(
    cliOriginIps.length ? cliOriginIps : [...configuredIpv4, ...configuredIpv6]
  );
  if (mode !== "global" && !originIps.some((address) => net.isIP(address) === 4)) {
    throw new Error("Direct audit needs at least one IPv4 --origin-ip");
  }

  const resolverArguments = commaValues(argumentsByName.get("resolver") || []);
  const resolvers = validateResolvers(resolverArguments.length
    ? resolverArguments
    : commaValues([environment.PROBPERA_DNS_RESOLVERS || DEFAULT_RESOLVERS.join(",")]));
  if (!resolvers.length) throw new Error("At least one DNS resolver is required");
  const timeoutMs = positiveInteger(last("timeout-ms"), "--timeout-ms", DEFAULT_TIMEOUT_MS);
  if (timeoutMs > 60_000) throw new Error("--timeout-ms must not exceed 60000");
  const dnsAttempts = positiveInteger(
    last("dns-attempts") || environment.PROBPERA_DNS_ATTEMPTS,
    "--dns-attempts",
    1
  );
  if (dnsAttempts > 20) throw new Error("--dns-attempts must not exceed 20");
  const dnsRetryDelayMs = nonnegativeInteger(
    last("dns-retry-delay-ms") ?? environment.PROBPERA_DNS_RETRY_DELAY_MS,
    "--dns-retry-delay-ms",
    DEFAULT_DNS_RETRY_DELAY_MS
  );
  if (dnsRetryDelayMs > 60_000) throw new Error("--dns-retry-delay-ms must not exceed 60000");

  return {
    help: argumentsByName.has("help"),
    host: normalizeHost(last("host") || environment.PROBPERA_AUDIT_HOST || DEFAULT_HOST),
    json: argumentsByName.has("json") ? booleanValue(last("json"), "--json") : false,
    mode,
    expectedDnsRoute,
    externalIpv6Proof,
    dnsAttempts,
    dnsRetryDelayMs,
    originIps,
    pagesHostname: normalizeHost(
      environment.PROBPERA_PAGES_HOSTNAME || "kosyat128.github.io"
    ),
    releaseSha: normalizeReleaseSha(
      last("release-sha") || environment.EXPECTED_RELEASE_SHA
    ),
    resolvers,
    timeoutMs,
  };
}

export function redactSensitive(value) {
  return String(value ?? "")
    .replace(/\b(authorization\s*:\s*(?:bearer|basic)\s+)[^\s,;]+/giu, "$1[REDACTED]")
    .replace(/\b(token|secret|password|api[_-]?key)\s*[=:]\s*[^\s&,;]+/giu, "$1=[REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/giu, "$1[REDACTED]@")
    .replace(/([?&](?:access_token|api_key|key|signature|token)=)[^&#\s]+/giu, "$1[REDACTED]")
    .replace(/\b(?:gh[oprsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu, "[REDACTED]");
}

function safeError(error) {
  const source = error instanceof Error ? error : new Error(String(error));
  return {
    code: typeof source.code === "string" ? source.code : null,
    message: redactSensitive(source.message || source.name),
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeHeaders(headers = {}) {
  const normalized = {};
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    for (const [name, value] of headers.entries()) normalized[name.toLowerCase()] = value;
    return normalized;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return normalized;
}

function header(response, name) {
  return normalizeHeaders(response.headers)[name.toLowerCase()] || "";
}

function decodeBody(body, contentEncoding, maximumBytes) {
  const encoding = String(contentEncoding || "").split(",")[0].trim().toLowerCase();
  const options = { maxOutputLength: maximumBytes };
  let decoded;
  if (!encoding || encoding === "identity") decoded = body;
  else if (encoding === "gzip" || encoding === "x-gzip") decoded = gunzipSync(body, options);
  else if (encoding === "br") decoded = brotliDecompressSync(body, options);
  else if (encoding === "deflate") decoded = inflateSync(body, options);
  else throw new Error(`Unsupported Content-Encoding: ${encoding}`);
  if (decoded.length > maximumBytes) throw new Error(`Decoded response exceeded ${maximumBytes} bytes`);
  return decoded;
}

function certificateSummary(socket, servername) {
  if (!socket) {
    const error = new Error("TLS socket was unavailable before response processing");
    error.code = "ERR_TLS_SOCKET_UNAVAILABLE";
    throw error;
  }
  const certificate = socket.getPeerCertificate?.() || {};
  const cipher = socket.getCipher?.() || {};
  return {
    authorized: socket.authorized === true,
    authorizationError: socket.authorizationError || null,
    servername,
    protocol: socket.getProtocol?.() || null,
    cipher: cipher.standardName || cipher.name || null,
    validFrom: certificate.valid_from || null,
    validTo: certificate.valid_to || null,
    fingerprint256: certificate.fingerprint256 || null,
    subjectCommonName: certificate.subject?.CN || null,
    issuerCommonName: certificate.issuer?.CN || null,
  };
}

function nodeRequestConfiguration(urlValue, options = {}) {
  const url = new URL(urlValue);
  const secure = url.protocol === "https:";
  if (!secure && url.protocol !== "http:") throw new Error(`Unsupported protocol: ${url.protocol}`);
  const connectIp = options.connectIp || null;
  const hostname = connectIp || url.hostname;
  const lookupFamily = options.lookupFamily === undefined || options.lookupFamily === null
    ? undefined
    : Number(options.lookupFamily);
  if (lookupFamily !== undefined && ![4, 6].includes(lookupFamily)) {
    throw new Error("lookupFamily must be 4 or 6");
  }
  const family = connectIp ? net.isIP(connectIp) : lookupFamily;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maximumBytes = options.maxBodyBytes || DEFAULT_MAX_BODY_BYTES;
  const method = String(options.method || "GET").toUpperCase();
  const servername = options.servername || url.hostname;
  const hostHeader = options.hostHeader || url.host;
  const headers = {
    Accept: "*/*",
    "Accept-Encoding": method === "HEAD" ? "identity" : "gzip, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "User-Agent": "ProbPeraConnectivityAudit/1.0 (+https://probpera.ru)",
    ...options.headers,
  };
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === "host") delete headers[name];
  }
  headers.Host = hostHeader;
  const requestOptions = {
    protocol: url.protocol,
    hostname,
    port: url.port || (secure ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method,
    headers,
    family,
    signal: AbortSignal.timeout(timeoutMs),
    ...(secure
      ? {
          rejectUnauthorized: true,
          servername,
        }
      : {}),
  };
  return {
    url,
    secure,
    connectIp,
    family,
    timeoutMs,
    maximumBytes,
    method,
    servername,
    hostHeader,
    requestOptions,
  };
}

export function buildNodeRequestOptions(urlValue, options = {}) {
  return nodeRequestConfiguration(urlValue, options).requestOptions;
}

export function nodeRequestOnce(urlValue, options = {}) {
  const configuration = nodeRequestConfiguration(urlValue, options);
  const {
    url,
    secure,
    connectIp,
    family,
    timeoutMs,
    maximumBytes,
    method,
    servername,
    hostHeader,
    requestOptions,
  } = configuration;

  return new Promise((resolve, reject) => {
    const transport = secure ? https : http;
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = transport.request(
      requestOptions,
      (response) => {
        let capturedTls = null;
        let capturedRemoteAddress = null;
        try {
          const responseSocket = response.socket;
          capturedRemoteAddress = responseSocket?.remoteAddress || null;
          capturedTls = secure ? certificateSummary(responseSocket, servername) : null;
          options.responseObserver?.(response);
        } catch (error) {
          response.resume();
          finishReject(error);
          return;
        }
        const chunks = [];
        let receivedBytes = 0;
        response.on("data", (chunk) => {
          receivedBytes += chunk.length;
          if (receivedBytes > maximumBytes) {
            const error = new Error(`Response exceeded ${maximumBytes} compressed bytes`);
            error.code = "ERR_RESPONSE_TOO_LARGE";
            response.destroy(error);
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", finishReject);
        response.on("end", () => {
          if (settled) return;
          try {
            const responseHeaders = normalizeHeaders(response.headers);
            const compressedBody = Buffer.concat(chunks);
            const body = method === "HEAD"
              ? Buffer.alloc(0)
              : decodeBody(compressedBody, responseHeaders["content-encoding"], maximumBytes);
            const completedResponse = {
              statusCode: response.statusCode || 0,
              headers: responseHeaders,
              body,
              url: url.href,
              redirects: [],
              remoteAddress: capturedRemoteAddress,
              connection: {
                connectAddress: connectIp || null,
                lookupFamily: family || null,
                hostHeader,
                servername: secure ? servername : null,
              },
              tls: capturedTls,
            };
            settled = true;
            resolve(completedResponse);
          } catch (error) {
            finishReject(error);
          }
        });
      }
    );
    request.setTimeout(timeoutMs, () => {
      const error = new Error(`Request timed out after ${timeoutMs} ms`);
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });
    request.on("error", finishReject);
    request.end();
  });
}

export async function requestResource(urlValue, options = {}) {
  const followRedirects = options.followRedirects !== false;
  const maximumRedirects = options.maxRedirects ?? 5;
  let currentUrl = new URL(urlValue);
  const redirects = [];
  for (let index = 0; index <= maximumRedirects; index += 1) {
    const response = await nodeRequestOnce(currentUrl, options);
    const location = header(response, "location");
    if (!followRedirects || !REDIRECT_STATUSES.has(response.statusCode) || !location) {
      return { ...response, url: currentUrl.href, redirects };
    }
    if (index === maximumRedirects) throw new Error(`Too many redirects for ${urlValue}`);
    const nextUrl = new URL(location, currentUrl);
    redirects.push({
      from: currentUrl.href,
      statusCode: response.statusCode,
      to: nextUrl.href,
    });
    if (nextUrl.protocol !== "https:" || nextUrl.hostname !== options.auditHost) {
      return {
        ...response,
        url: currentUrl.href,
        redirects,
        redirectViolation: `Redirect escaped https://${options.auditHost}`,
      };
    }
    currentUrl = nextUrl;
  }
  throw new Error(`Redirect handling failed for ${urlValue}`);
}

function decodeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function attributes(markup) {
  const result = {};
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
  for (const match of markup.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function openingTags(html, tag) {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>`, "giu");
  return [...html.matchAll(pattern)].map((match) => attributes(match[1]));
}

function normalizedWebUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sameOriginAsset(value, origin) {
  const href = normalizedWebUrl(value, origin);
  if (!href) return null;
  const url = new URL(href);
  return url.origin === new URL(origin).origin ? href : null;
}

export function inspectRootHtml(htmlValue, expectedOriginValue) {
  const html = String(htmlValue || "");
  const expectedOrigin = new URL(expectedOriginValue).origin;
  const expectedRoot = `${expectedOrigin}/`;
  const links = openingTags(html, "link");
  const metas = openingTags(html, "meta");
  const scripts = openingTags(html, "script");
  const images = openingTags(html, "img");
  const canonicals = links
    .filter((item) => item.rel?.toLowerCase().split(/\s+/u).includes("canonical"))
    .map((item) => normalizedWebUrl(item.href, expectedRoot))
    .filter(Boolean);
  const openGraphUrls = metas
    .filter((item) => item.property?.toLowerCase() === "og:url")
    .map((item) => normalizedWebUrl(item.content, expectedRoot))
    .filter(Boolean);
  const jsonLd = [];
  const jsonLdErrors = [];
  const jsonLdPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;
  for (const match of html.matchAll(jsonLdPattern)) {
    const scriptAttributes = attributes(match[1]);
    if (scriptAttributes.type?.toLowerCase() !== "application/ld+json") continue;
    try {
      jsonLd.push(JSON.parse(match[2].trim()));
    } catch {
      jsonLdErrors.push("Malformed application/ld+json document");
    }
  }

  const scriptAssets = scripts
    .map((item) => sameOriginAsset(item.src, expectedRoot))
    .filter(Boolean);
  const styleAssets = links
    .filter((item) => item.rel?.toLowerCase().split(/\s+/u).includes("stylesheet"))
    .map((item) => sameOriginAsset(item.href, expectedRoot))
    .filter(Boolean);
  const imageAssets = [
    ...metas
      .filter((item) => ["og:image", "twitter:image"].includes(
        (item.property || item.name || "").toLowerCase()
      ))
      .map((item) => item.content),
    ...images.map((item) => item.src),
  ]
    .map((item) => sameOriginAsset(item, expectedRoot))
    .filter(Boolean);
  const manifestAssets = links
    .filter((item) => item.rel?.toLowerCase().split(/\s+/u).includes("manifest"))
    .map((item) => sameOriginAsset(item.href, expectedRoot))
    .filter(Boolean);

  const errors = [];
  if (!/^\s*<!doctype\s+html|<html\b/iu.test(html)) errors.push("Root response is not HTML");
  if (canonicals.length !== 1 || canonicals[0] !== expectedRoot) {
    errors.push(`Root canonical must be exactly ${expectedRoot}`);
  }
  if (openGraphUrls.length !== 1 || openGraphUrls[0] !== expectedRoot) {
    errors.push(`Root og:url must be exactly ${expectedRoot}`);
  }
  if (!jsonLd.length || jsonLdErrors.length) {
    errors.push("Root must contain valid JSON-LD");
  } else if (!jsonLd.some((document) => JSON.stringify(document).includes(expectedOrigin))) {
    errors.push("Root JSON-LD must identify the canonical origin");
  }
  if (!scriptAssets.length) errors.push("Root must reference a same-origin JavaScript asset");
  if (!styleAssets.length) errors.push("Root must reference a same-origin CSS asset");
  if (!imageAssets.length) errors.push("Root must reference a same-origin image asset");
  if (!manifestAssets.length) errors.push("Root must reference a same-origin web manifest");

  return {
    canonical: canonicals[0] || null,
    openGraphUrl: openGraphUrls[0] || null,
    jsonLdDocuments: jsonLd.length,
    assets: {
      script: unique(scriptAssets),
      style: unique(styleAssets),
      image: unique(imageAssets),
      manifest: unique(manifestAssets),
    },
    errors: unique([...errors, ...jsonLdErrors]),
  };
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

export function selectRepresentativeHtmlUrl(sitemapValue, expectedOriginValue) {
  const expectedOrigin = new URL(expectedOriginValue).origin;
  const candidates = [...String(sitemapValue || "").matchAll(/<loc\b[^>]*>([^<]+)<\/loc\s*>/giu)]
    .map((match) => normalizedWebUrl(decodeXmlText(match[1].trim()), `${expectedOrigin}/`))
    .filter(Boolean)
    .filter((href) => {
      const url = new URL(href);
      const segments = url.pathname.split("/").filter(Boolean);
      return url.origin === expectedOrigin && segments[0] === "stati" && segments.length >= 3;
    })
    .sort((left, right) => left.localeCompare(right, "en"));
  return unique(candidates)[0] || null;
}

export function inspectRepresentativeHtml(htmlValue, expectedUrlValue) {
  const html = String(htmlValue || "");
  const expectedUrl = new URL(expectedUrlValue).href;
  const links = openingTags(html, "link");
  const metas = openingTags(html, "meta");
  const canonicals = links
    .filter((item) => item.rel?.toLowerCase().split(/\s+/u).includes("canonical"))
    .map((item) => normalizedWebUrl(item.href, expectedUrl))
    .filter(Boolean);
  const openGraphUrls = metas
    .filter((item) => item.property?.toLowerCase() === "og:url")
    .map((item) => normalizedWebUrl(item.content, expectedUrl))
    .filter(Boolean);
  let validJsonLd = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)) {
    if (attributes(match[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try {
      const document = JSON.parse(match[2].trim());
      if (JSON.stringify(document).includes(expectedUrl)) validJsonLd += 1;
    } catch {
      // Invalid JSON-LD does not satisfy the representative page contract.
    }
  }
  const errors = [];
  if (!/^\s*<!doctype\s+html|<html\b/iu.test(html)) errors.push("Representative response is not HTML");
  if (canonicals.length !== 1 || canonicals[0] !== expectedUrl) {
    errors.push(`Representative canonical must be exactly ${expectedUrl}`);
  }
  if (openGraphUrls.length !== 1 || openGraphUrls[0] !== expectedUrl) {
    errors.push(`Representative og:url must be exactly ${expectedUrl}`);
  }
  if (!validJsonLd) errors.push("Representative page must contain canonical JSON-LD");
  return {
    canonical: canonicals[0] || null,
    openGraphUrl: openGraphUrls[0] || null,
    jsonLdDocuments: validJsonLd,
    errors,
  };
}

function normalizedSameOriginHttpsUrl(value, expectedOriginValue) {
  const expectedOrigin = new URL(expectedOriginValue).origin;
  const href = normalizedWebUrl(value, `${expectedOrigin}/`);
  if (!href) return null;
  const url = new URL(href);
  return url.protocol === "https:" && url.origin === expectedOrigin ? href : null;
}

export function inspectRedirectManifest(value, expectedOriginValue) {
  const expectedOrigin = new URL(expectedOriginValue).origin;
  let entries = null;
  try {
    entries = typeof value === "string" || Buffer.isBuffer(value)
      ? JSON.parse(String(value))
      : value;
  } catch {
    // The schema errors below deliberately avoid echoing response content.
  }
  const errors = [];
  if (!Array.isArray(entries)) {
    return { count: 0, entries: [], sample: null, errors: ["Redirect manifest must be a JSON array"] };
  }
  const normalizedEntries = [];
  for (const entry of entries) {
    const source = typeof entry?.source === "string" ? entry.source.trim() : "";
    const destination = normalizedSameOriginHttpsUrl(entry?.destination, expectedOrigin);
    const sourceUrl = normalizedSameOriginHttpsUrl(source, expectedOrigin);
    const sourcePath = sourceUrl ? new URL(sourceUrl).pathname : null;
    if (!sourcePath || sourceUrl !== `${expectedOrigin}${sourcePath}` || !destination || entry?.permanent !== true) {
      errors.push("Every redirect must have a same-origin source path, same-origin HTTPS destination, and permanent=true");
      continue;
    }
    if (sourcePath === new URL(destination).pathname) {
      errors.push("Redirect source and destination must differ");
      continue;
    }
    normalizedEntries.push({ source: sourcePath, destination, permanent: true });
  }
  if (entries.length < MINIMUM_LEGACY_REDIRECTS) {
    errors.push(`Redirect manifest must contain at least ${MINIMUM_LEGACY_REDIRECTS} entries`);
  }
  if (normalizedEntries.length !== entries.length) {
    errors.push("Redirect manifest contains invalid entries");
  }
  const sample = normalizedEntries
    .filter((entry) => /^\/articles\/[^/*:?#[\]]+\/?$/u.test(entry.source))
    .filter((entry) => {
      const segments = new URL(entry.destination).pathname.split("/").filter(Boolean);
      return segments[0] === "stati" && segments.length >= 3;
    })
    .sort((left, right) => left.source.localeCompare(right.source, "en") ||
      left.destination.localeCompare(right.destination, "en"))[0] || null;
  if (!sample) errors.push("Redirect manifest must contain a deterministic /articles/ legacy alias");
  return {
    count: entries.length,
    entries: normalizedEntries,
    sample,
    errors: unique(errors),
  };
}

export function inspectLegacyAliasResponse(response, expectedSourceUrlValue, expectedTargetUrlValue) {
  const expectedSourceUrl = new URL(expectedSourceUrlValue).href;
  const expectedTargetUrl = new URL(expectedTargetUrlValue).href;
  const statusCode = response?.statusCode || 0;
  const location = normalizedWebUrl(header(response || {}, "location"), expectedSourceUrl);
  const body = responseBodyText(response || {});
  const contentType = header(response || {}, "content-type").toLowerCase();
  const errors = [];
  let mode = null;
  let canonical = null;
  if (STRICT_REDIRECT_STATUSES.has(statusCode)) {
    mode = "redirect";
    if (location !== expectedTargetUrl) {
      errors.push(`Legacy redirect Location must be exactly ${expectedTargetUrl}`);
    }
  } else if (statusCode === 200) {
    mode = "static";
    const links = openingTags(body, "link");
    const metas = openingTags(body, "meta");
    const canonicals = links
      .filter((item) => item.rel?.toLowerCase().split(/\s+/u).includes("canonical"))
      .map((item) => normalizedWebUrl(item.href, expectedSourceUrl))
      .filter(Boolean);
    canonical = canonicals[0] || null;
    const robots = metas.find((item) => item.name?.toLowerCase() === "robots")?.content?.toLowerCase() || "";
    const refresh = metas.find((item) => item["http-equiv"]?.toLowerCase() === "refresh")?.content || "";
    const refreshTarget = normalizedWebUrl(refresh.match(/^\s*\d+\s*;\s*url\s*=\s*(.+)\s*$/iu)?.[1] || "", expectedSourceUrl);
    if (!contentType.includes("text/html")) errors.push("Static legacy alias must return text/html");
    if (canonicals.length !== 1 || canonical !== expectedTargetUrl) {
      errors.push(`Static legacy alias canonical must be exactly ${expectedTargetUrl}`);
    }
    if (!/(?:^|,)\s*noindex(?:\s*,|$)/u.test(robots) || !robots.includes("follow")) {
      errors.push("Static legacy alias must be noindex,follow");
    }
    if (refreshTarget !== expectedTargetUrl) {
      errors.push(`Static legacy alias refresh must target exactly ${expectedTargetUrl}`);
    }
    if (!body.includes(expectedTargetUrl)) errors.push("Static legacy alias body must link to the target");
  } else {
    errors.push("Legacy alias must return 200, 301, or 308");
  }
  return {
    statusCode,
    mode,
    location: location || null,
    canonical,
    bodySha256: body ? hash(Buffer.from(normalizeRootHtmlForIntegrity(body))) : null,
    semanticSha256: hash(JSON.stringify({ source: expectedSourceUrl, target: expectedTargetUrl })),
    errors,
  };
}

export function inspectNotFoundHtml(htmlValue, expectedOriginValue) {
  const html = String(htmlValue || "");
  const expectedRoot = `${new URL(expectedOriginValue).origin}/`;
  const links = openingTags(html, "link");
  const metas = openingTags(html, "meta");
  const canonicals = links
    .filter((item) => item.rel?.toLowerCase().split(/\s+/u).includes("canonical"))
    .map((item) => normalizedWebUrl(item.href, expectedRoot))
    .filter(Boolean);
  const robots = metas.find((item) => item.name?.toLowerCase() === "robots")?.content?.toLowerCase() || "";
  const visibleText = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ");
  const errors = [];
  if (!/^\s*<!doctype\s+html|<html\b/iu.test(html)) errors.push("404 response is not HTML");
  if (canonicals.length !== 1 || canonicals[0] !== expectedRoot) {
    errors.push(`404 canonical must be exactly ${expectedRoot}`);
  }
  if (!/(?:^|,)\s*noindex(?:\s*,|$)/u.test(robots)) errors.push("404 page must be noindex");
  if (!/404/u.test(visibleText) || !/не\s+найден/iu.test(visibleText)) {
    errors.push("404 page must visibly explain that the page was not found");
  }
  return { canonical: canonicals[0] || null, robots: robots || null, errors };
}

export function normalizeRootHtmlForIntegrity(htmlValue) {
  const html = String(htmlValue || "");
  const beacon = /(?:<!--\s*Cloudflare Web Analytics\s*-->\s*)?<script\b(?=[^>]*\bsrc=["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/[^"']*)?["'])[^>]*>\s*<\/script\s*>(?:\s*<!--\s*End Cloudflare Web Analytics\s*-->)?/giu;
  return html.replace(beacon, "");
}

export function validateCriticalHeaders(headersValue) {
  const headers = normalizeHeaders(headersValue);
  const errors = [];
  const normalizePolicy = (value) => String(value || "")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\s*;\s*/gu, "; ")
    .replace(/;\s*$/u, "");
  const expectedHeader = (name) => PUBLIC_SECURITY_HEADERS[name].value;
  if (normalizePolicy(headers["strict-transport-security"]) !==
      normalizePolicy(expectedHeader("Strict-Transport-Security"))) {
    errors.push("Strict-Transport-Security must match the repository policy");
  }
  if ((headers["x-content-type-options"] || "").toLowerCase() !== "nosniff") {
    errors.push("X-Content-Type-Options must be nosniff");
  }
  if ((headers["referrer-policy"] || "").toLowerCase() !==
      expectedHeader("Referrer-Policy").toLowerCase()) {
    errors.push("Referrer-Policy must match the repository policy");
  }
  const normalizePermissions = (value) => String(value || "").toLowerCase()
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
  if (normalizePermissions(headers["permissions-policy"]) !==
      normalizePermissions(expectedHeader("Permissions-Policy"))) {
    errors.push("Permissions-Policy must exactly disable camera, microphone, geolocation, and payment");
  }
  if ((headers["cross-origin-opener-policy"] || "").toLowerCase() !==
      expectedHeader("Cross-Origin-Opener-Policy").toLowerCase()) {
    errors.push("Cross-Origin-Opener-Policy must be same-origin");
  }
  if (normalizePolicy(headers["content-security-policy"]) !==
      normalizePolicy(PUBLIC_CONTENT_SECURITY_POLICY)) {
    errors.push("Content-Security-Policy must exactly match the repository policy");
  }
  return errors;
}

function createCheck(id, condition, options = {}) {
  const required = options.required !== false;
  const unavailable = options.unavailable === true;
  return {
    id,
    status: condition ? "passed" : unavailable ? "unavailable" : required ? "failed" : "warning",
    required,
    reason: condition ? null : options.reason || "validation_failed",
    detail: options.detail ? redactSensitive(options.detail) : null,
  };
}

function addCheck(checks, id, condition, options) {
  const check = createCheck(id, condition, options);
  checks.push(check);
  return check;
}

function requiredFailures(checks) {
  return checks.filter((check) => check.required && check.status !== "passed");
}

function unavailableNetworkError(error) {
  return NETWORK_UNAVAILABLE_CODES.has(error?.code) ||
    /network is unreachable|no route to host|address not available|timed out/iu.test(error?.message || "");
}

function directTlsError(error) {
  return TLS_ALTNAME_CODES.has(error?.code) ||
    /hostname\/ip does not match|not cert's cn|not in the cert's altnames|certificate.*(?:name|host)/iu.test(
      error?.message || ""
    );
}

function validTls(response, host) {
  return response.tls?.authorized === true &&
    response.connection?.servername === host &&
    response.connection?.hostHeader === host;
}

function routeDefinition(kind, host, address = null, requestedFamily = 0) {
  const family = address ? net.isIP(address) : requestedFamily;
  return {
    id: kind === "global"
      ? family ? `global-ipv${family}` : "global"
      : `direct-ipv${family}-${address}`,
    kind,
    family,
    address,
    host,
  };
}

async function resolveWithResolver({ host, resolver, family }) {
  const instance = new Resolver({ timeout: 2_500, tries: 2 });
  instance.setServers([resolver]);
  return family === 4
    ? instance.resolve4(host, { ttl: true })
    : instance.resolve6(host, { ttl: true });
}

export async function auditDns({
  host,
  resolvers,
  resolveImpl = resolveWithResolver,
  expectedRoute = "either",
  expectedDirectAddresses = null,
}) {
  if (!Array.isArray(resolvers) || !resolvers.length) {
    throw new Error("DNS audit requires at least one resolver");
  }
  const queries = await Promise.all(resolvers.flatMap((resolver) => [4, 6].map(async (family) => {
      try {
        const answer = await resolveImpl({ host, resolver, family });
        const records = (Array.isArray(answer) ? answer : [])
          .map((entry) => typeof entry === "string" ? { address: entry, ttl: null } : {
            address: entry?.address,
            ttl: Number.isFinite(entry?.ttl) ? entry.ttl : null,
          });
        const invalid = records.filter((record) => net.isIP(record.address) !== family);
        if (invalid.length) {
          return {
            host,
            resolver,
            family,
            status: "invalid",
            required: true,
            reason: "dns_invalid_answer",
            route: "unknown",
            records,
          };
        } else if (!records.length) {
          return {
            host,
            resolver,
            family,
            status: "missing",
            required: false,
            reason: family === 4 ? "dns_ipv4_missing" : "dns_ipv6_unavailable",
            route: null,
            records: [],
          };
        } else {
          const familyDirectAddresses = Array.isArray(expectedDirectAddresses)
            ? expectedDirectAddresses.filter((address) => net.isIP(address) === family)
            : null;
          const route = classifyDnsAnswer(records, family, familyDirectAddresses);
          const accepted = route !== "unknown" && (expectedRoute === "either" || route === expectedRoute);
          return {
            host,
            resolver,
            family,
            status: accepted ? "passed" : "invalid",
            required: !accepted,
            reason: accepted
              ? null
              : route === "unknown" ? "dns_route_unknown" : "dns_route_unexpected",
            route,
            records,
          };
        }
      } catch (error) {
        const details = safeError(error);
        const missing = DNS_MISSING_CODES.has(details.code);
        return {
          host,
          resolver,
          family,
          status: missing ? "missing" : "unavailable",
          required: false,
          reason: missing
            ? family === 4 ? "dns_ipv4_missing" : "dns_ipv6_unavailable"
            : "dns_resolver_unavailable",
          route: null,
          records: [],
          error: details,
        };
      }
    })));
  const quorum = Math.ceil((2 * resolvers.length) / 3);
  const families = [4, 6].map((family) => {
    const familyQueries = queries.filter((query) => query.family === family);
    const answerRoutes = unique(
      familyQueries.filter((query) => query.status === "passed").map((query) => query.route)
    );
    const route = answerRoutes.length === 1 ? answerRoutes[0] : null;
    const successfulResolvers = route
      ? familyQueries.filter((query) => query.status === "passed" && query.route === route).length
      : 0;
    const invalidResolvers = familyQueries.filter((query) => query.status === "invalid").length;
    const routeAgreement = answerRoutes.length <= 1;
    const passed = successfulResolvers >= quorum && invalidResolvers === 0 && routeAgreement;
    const unavailable = successfulResolvers === 0 &&
      familyQueries.every((query) => ["missing", "unavailable"].includes(query.status));
    return {
      host,
      family,
      quorum,
      successfulResolvers,
      totalResolvers: resolvers.length,
      route,
      observedRoutes: answerRoutes,
      status: passed ? "passed" : unavailable ? "unavailable" : "failed",
      required: true,
      reason: passed
        ? null
        : !routeAgreement
          ? "dns_route_policy_mixed"
          : family === 4 ? "dns_ipv4_quorum_unmet" : "dns_ipv6_quorum_unmet",
    };
  });
  return {
    resolvers,
    queries,
    quorum,
    expectedRoute,
    families,
    requiredOk: families.every((family) => family.status === "passed") &&
      !queries.some((query) => query.status === "invalid"),
  };
}

function combineDnsAudits(host, apex, www) {
  const observedRoutes = unique(
    [...apex.families, ...www.families]
      .filter((family) => family.status === "passed" && family.route)
      .map((family) => family.route)
  );
  const policyConsistent = observedRoutes.length === 1;
  return {
    resolvers: apex.resolvers,
    quorum: apex.quorum,
    expectedRoute: apex.expectedRoute,
    observedRoute: policyConsistent ? observedRoutes[0] : null,
    policyConsistent,
    requiredOk: apex.requiredOk && www.requiredOk && policyConsistent,
    hosts: {
      [host]: apex,
      [`www.${host}`]: www,
    },
    queries: [...apex.queries, ...www.queries],
    families: [...apex.families, ...www.families],
  };
}

export async function auditDnsWithRetries({
  host,
  resolvers,
  resolveImpl,
  expectedRoute = "either",
  expectedDirectAddresses = null,
  attempts = 1,
  retryDelayMs = DEFAULT_DNS_RETRY_DELAY_MS,
  sleepImpl = waitFor,
}) {
  const maximumAttempts = positiveInteger(attempts, "DNS attempts", 1);
  if (maximumAttempts > 20) throw new Error("DNS attempts must not exceed 20");
  const delayMs = nonnegativeInteger(retryDelayMs, "DNS retry delay", DEFAULT_DNS_RETRY_DELAY_MS);
  if (delayMs > 60_000) throw new Error("DNS retry delay must not exceed 60000");
  const history = [];
  let combined = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const [apex, www] = await Promise.all([host, `www.${host}`].map((dnsHost) => auditDns({
      host: dnsHost,
      resolvers,
      resolveImpl,
      expectedRoute,
      expectedDirectAddresses,
    })));
    combined = combineDnsAudits(host, apex, www);
    history.push({
      attempt,
      requiredOk: combined.requiredOk,
      observedRoute: combined.observedRoute,
      policyConsistent: combined.policyConsistent,
      families: combined.families.map((family) => ({
        host: family.host,
        family: family.family,
        status: family.status,
        route: family.route,
        successfulResolvers: family.successfulResolvers,
        quorum: family.quorum,
      })),
    });
    if (combined.requiredOk || attempt === maximumAttempts) break;
    await sleepImpl(delayMs);
  }
  return {
    ...combined,
    attemptCount: history.length,
    maximumAttempts,
    retryDelayMs: delayMs,
    attempts: history,
  };
}

function responseBodyText(response) {
  return Buffer.isBuffer(response.body)
    ? response.body.toString("utf8")
    : String(response.body || "");
}

function responseBodyBuffer(response) {
  return Buffer.isBuffer(response.body) ? response.body : Buffer.from(String(response.body || ""));
}

function classifyRouteError(route, error) {
  if (route.kind === "direct" && directTlsError(error)) {
    return { reason: "direct_tls_not_ready", unavailable: false, required: true };
  }
  if (route.kind === "direct" && route.family === 6 && unavailableNetworkError(error)) {
    return { reason: "ipv6_unavailable", unavailable: true, required: false };
  }
  if (route.kind === "direct" && route.family === 4 && unavailableNetworkError(error)) {
    return { reason: "ipv4_unavailable", unavailable: true, required: true };
  }
  if (unavailableNetworkError(error)) {
    return {
      reason: route.family ? `global_ipv${route.family}_unavailable` : "global_route_unavailable",
      unavailable: true,
      required: true,
    };
  }
  return { reason: "request_failed", unavailable: false, required: true };
}

async function requestForRoute(route, requestImpl, url, options = {}) {
  return requestImpl(url, {
    auditHost: route.host,
    connectIp: route.address,
    followRedirects: options.followRedirects,
    headers: options.headers,
    hostHeader: route.host,
    lookupFamily: route.kind === "global" && route.family ? route.family : undefined,
    maxBodyBytes: options.maxBodyBytes || DEFAULT_MAX_BODY_BYTES,
    method: options.method || "GET",
    servername: route.host,
    timeoutMs: options.timeoutMs,
  });
}

function validateHttpsResponse(route, response, checks, id, expectedStatus = 200) {
  addCheck(checks, `${id}.status`, response.statusCode === expectedStatus, {
    reason: "invalid_http_status",
    detail: `received ${response.statusCode}; expected ${expectedStatus}`,
  });
  addCheck(checks, `${id}.redirects`, !response.redirectViolation, {
    reason: "unsafe_redirect",
    detail: response.redirectViolation,
  });
  addCheck(checks, `${id}.tls`, validTls(response, route.host), {
    reason: route.kind === "direct" ? "direct_tls_not_ready" : "tls_authentication_failed",
    detail: response.tls?.authorizationError || "TLS was not authenticated with the requested Host and SNI",
  });
}

export async function auditRoute(routeValue, options = {}) {
  const route = routeDefinition(routeValue.kind, routeValue.host, routeValue.address, routeValue.family);
  const requestImpl = options.requestImpl || requestResource;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const expectedOrigin = `https://${route.host}`;
  const checks = [];
  const result = {
    ...route,
    status: "failed",
    reason: null,
    checks,
    httpRedirect: null,
    tls: null,
    root: null,
    representativeHtml: null,
    largeContent: null,
    legacyRedirects: { manifest: null, sample: null },
    notFound: null,
    releaseHead: null,
    pwa: { serviceWorker: null, manifest: null },
    releaseSha: null,
    assets: [],
  };

  try {
    const response = await requestForRoute(route, requestImpl, `http://${route.host}/`, {
      followRedirects: false,
      method: "HEAD",
      timeoutMs,
    });
    const location = header(response, "location");
    const expectedLocation = `${expectedOrigin}/`;
    const valid = STRICT_REDIRECT_STATUSES.has(response.statusCode) &&
      normalizedWebUrl(location, `http://${route.host}/`) === expectedLocation;
    result.httpRedirect = { statusCode: response.statusCode, location: location || null };
    addCheck(checks, "http.redirect", valid, {
      reason: route.kind === "direct" ? "direct_tls_not_ready" : "http_redirect_invalid",
      detail: `received ${response.statusCode} Location=${location || "<missing>"}; expected 301/308 to ${expectedLocation}`,
    });
    if (route.kind === "global" && route.family) {
      addCheck(checks, "http.network_family", net.isIP(response.remoteAddress) === route.family, {
        reason: "network_family_mismatch",
        detail: `HTTP IPv${route.family} route connected to ${response.remoteAddress || "<unknown>"}`,
      });
    }
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "http.redirect", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  let rootResponse;
  try {
    rootResponse = await requestForRoute(route, requestImpl, `${expectedOrigin}/`, {
      followRedirects: true,
      timeoutMs,
    });
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.root.connection", false, {
      ...classification,
      detail: `${safeError(error).code || "ERROR"}: ${safeError(error).message}`,
    });
    result.reason = classification.reason;
    result.status = classification.unavailable ? "unavailable" : "failed";
    return result;
  }

  validateHttpsResponse(route, rootResponse, checks, "https.root");
  if (route.kind === "global" && route.family) {
    addCheck(checks, "https.root.network_family", net.isIP(rootResponse.remoteAddress) === route.family, {
      reason: "network_family_mismatch",
      detail: `HTTPS IPv${route.family} route connected to ${rootResponse.remoteAddress || "<unknown>"}`,
    });
  }
  result.tls = rootResponse.tls || null;
  const rootBuffer = responseBodyBuffer(rootResponse);
  const rootHtml = responseBodyText(rootResponse);
  const rootInspection = inspectRootHtml(rootHtml, expectedOrigin);
  const rootContentType = header(rootResponse, "content-type").toLowerCase();
  const securityHeaderErrors = validateCriticalHeaders(rootResponse.headers);
  addCheck(checks, "https.root.content_type", rootContentType.includes("text/html"), {
    reason: "root_content_type_invalid",
    detail: rootContentType || "missing Content-Type",
  });
  addCheck(checks, "https.root.minimum_size", rootBuffer.length >= ROOT_MINIMUM_BYTES, {
    reason: "root_html_too_small",
    detail: `${rootBuffer.length} decoded bytes; expected at least ${ROOT_MINIMUM_BYTES}`,
  });
  addCheck(checks, "https.root.metadata", rootInspection.errors.length === 0, {
    reason: "root_metadata_invalid",
    detail: rootInspection.errors.join("; "),
  });
  addCheck(checks, "https.root.security_headers", securityHeaderErrors.length === 0, {
    reason: "critical_security_headers_invalid",
    detail: securityHeaderErrors.join("; "),
  });
  result.root = {
    statusCode: rootResponse.statusCode,
    finalUrl: rootResponse.url,
    redirects: rootResponse.redirects || [],
    bytes: rootBuffer.length,
    sha256: hash(rootBuffer),
    normalizedSha256: hash(Buffer.from(normalizeRootHtmlForIntegrity(rootHtml))),
    canonical: rootInspection.canonical,
    openGraphUrl: rootInspection.openGraphUrl,
    jsonLdDocuments: rootInspection.jsonLdDocuments,
    criticalSecurityHeaders: securityHeaderErrors.length === 0,
  };

  let sitemapDocument = null;
  const endpointSpecs = [
    { id: "sitemap", path: "/sitemap.xml", marker: /<urlset\b/iu, contentTypes: ["xml", "text/plain"] },
    { id: "robots", path: "/robots.txt", marker: new RegExp(`Sitemap:\\s*https://${route.host.replace(/\./gu, "\\.")}\/sitemap\\.xml`, "iu"), contentTypes: ["text/plain"] },
    { id: "rss", path: "/rss.xml", marker: /<rss\b/iu, contentTypes: ["xml", "text/plain"] },
    { id: "security", path: "/.well-known/security.txt", marker: new RegExp(`Canonical:\\s*https://${route.host.replace(/\./gu, "\\.")}\/\\.well-known\/security\\.txt`, "iu"), contentTypes: ["text/plain"] },
  ];

  for (const spec of endpointSpecs) {
    try {
      const response = await requestForRoute(route, requestImpl, `${expectedOrigin}${spec.path}`, {
        followRedirects: true,
        timeoutMs,
      });
      validateHttpsResponse(route, response, checks, `https.${spec.id}`);
      const contentType = header(response, "content-type").toLowerCase();
      const text = responseBodyText(response);
      if (spec.id === "sitemap") sitemapDocument = text;
      addCheck(checks, `https.${spec.id}.content_type`, spec.contentTypes.some((item) => contentType.includes(item)), {
        reason: `${spec.id}_content_type_invalid`,
        detail: contentType || "missing Content-Type",
      });
      addCheck(checks, `https.${spec.id}.content`, spec.marker.test(text), {
        reason: `${spec.id}_content_invalid`,
      });
      if (["sitemap", "rss"].includes(spec.id)) {
        addCheck(checks, `https.${spec.id}.canonical_origin`, text.includes(`${expectedOrigin}/`), {
          reason: `${spec.id}_canonical_origin_invalid`,
        });
      }
      if (spec.id === "security") {
        const expires = text.match(/^Expires:\s*(.+)$/imu)?.[1]?.trim() || "";
        addCheck(checks, "https.security.expiry", Number.isFinite(Date.parse(expires)) && Date.parse(expires) > Date.now(), {
          reason: "security_document_expired",
          detail: expires || "missing Expires field",
        });
        addCheck(checks, "https.security.contact", /^Contact:\s*(?:mailto:|https:)/imu.test(text), {
          reason: "security_document_contact_missing",
        });
      }
    } catch (error) {
      const classification = classifyRouteError(route, error);
      addCheck(checks, `https.${spec.id}.connection`, false, {
        ...classification,
        detail: safeError(error).message,
      });
    }
  }

  const representativeUrl = selectRepresentativeHtmlUrl(sitemapDocument, expectedOrigin);
  addCheck(checks, "https.representative_html.discovery", Boolean(representativeUrl), {
    reason: "representative_html_not_discovered",
    detail: "sitemap.xml did not contain a same-origin published /stati/ page",
  });
  if (representativeUrl) {
    try {
      const response = await requestForRoute(route, requestImpl, representativeUrl, {
        followRedirects: true,
        timeoutMs,
      });
      validateHttpsResponse(route, response, checks, "https.representative_html");
      const body = responseBodyBuffer(response);
      const html = body.toString("utf8");
      const contentType = header(response, "content-type").toLowerCase();
      const inspection = inspectRepresentativeHtml(html, representativeUrl);
      addCheck(checks, "https.representative_html.content_type", contentType.includes("text/html"), {
        reason: "representative_html_content_type_invalid",
        detail: contentType || "missing Content-Type",
      });
      addCheck(checks, "https.representative_html.minimum_size", body.length > LARGE_CONTENT_MINIMUM_BYTES, {
        reason: "representative_html_too_small",
        detail: `${body.length} decoded bytes; expected more than ${LARGE_CONTENT_MINIMUM_BYTES}`,
      });
      addCheck(checks, "https.representative_html.metadata", inspection.errors.length === 0, {
        reason: "representative_html_metadata_invalid",
        detail: inspection.errors.join("; "),
      });
      result.representativeHtml = {
        path: new URL(representativeUrl).pathname,
        statusCode: response.statusCode,
        bytes: body.length,
        rawSha256: hash(body),
        sha256: hash(Buffer.from(normalizeRootHtmlForIntegrity(html))),
        canonical: inspection.canonical,
        openGraphUrl: inspection.openGraphUrl,
        jsonLdDocuments: inspection.jsonLdDocuments,
      };
    } catch (error) {
      const classification = classifyRouteError(route, error);
      addCheck(checks, "https.representative_html.connection", false, {
        ...classification,
        detail: safeError(error).message,
      });
    }
  }

  try {
    const response = await requestForRoute(route, requestImpl, `${expectedOrigin}/sw.js`, {
      followRedirects: true,
      timeoutMs,
    });
    validateHttpsResponse(route, response, checks, "https.pwa.service_worker");
    const body = responseBodyBuffer(response);
    const text = body.toString("utf8");
    const contentType = header(response, "content-type").toLowerCase();
    addCheck(checks, "https.pwa.service_worker.content_type", /(?:javascript|ecmascript)/u.test(contentType), {
      reason: "service_worker_content_type_invalid",
      detail: contentType || "missing Content-Type",
    });
    addCheck(
      checks,
      "https.pwa.service_worker.content",
      body.length >= 1_024 &&
        /self\.addEventListener\s*\(\s*["']install["']/u.test(text) &&
        /self\.addEventListener\s*\(\s*["']fetch["']/u.test(text),
      {
        reason: "service_worker_content_invalid",
        detail: `${body.length} decoded bytes`,
      }
    );
    result.pwa.serviceWorker = {
      path: "/sw.js",
      statusCode: response.statusCode,
      bytes: body.length,
      sha256: hash(body),
    };
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.pwa.service_worker.connection", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  try {
    const manifestUrl = rootInspection.assets.manifest[0] || `${expectedOrigin}/site.webmanifest`;
    const response = await requestForRoute(route, requestImpl, manifestUrl, {
      followRedirects: true,
      timeoutMs,
    });
    validateHttpsResponse(route, response, checks, "https.pwa.manifest");
    const body = responseBodyBuffer(response);
    const contentType = header(response, "content-type").toLowerCase();
    let payload = null;
    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      // The schema check below reports malformed JSON.
    }
    const belongsToSite = (value) => {
      const href = normalizedWebUrl(value, `${expectedOrigin}/`);
      return Boolean(href && new URL(href).origin === expectedOrigin);
    };
    const validSchema = typeof payload?.name === "string" && payload.name.trim().length > 0 &&
      typeof payload?.short_name === "string" && payload.short_name.trim().length > 0 &&
      belongsToSite(payload?.start_url) && belongsToSite(payload?.scope) &&
      Array.isArray(payload?.icons) && payload.icons.some((icon) => belongsToSite(icon?.src)) &&
      ["standalone", "minimal-ui", "fullscreen"].includes(payload?.display);
    addCheck(
      checks,
      "https.pwa.manifest.content_type",
      contentType.includes("json") || contentType.includes("manifest"),
      {
        reason: "web_manifest_content_type_invalid",
        detail: contentType || "missing Content-Type",
      }
    );
    addCheck(checks, "https.pwa.manifest.schema", validSchema, {
      reason: "web_manifest_schema_invalid",
    });
    result.pwa.manifest = {
      path: new URL(manifestUrl).pathname,
      statusCode: response.statusCode,
      bytes: body.length,
      sha256: hash(body),
    };
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.pwa.manifest.connection", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  try {
    const response = await requestForRoute(route, requestImpl, `${expectedOrigin}${LARGE_CONTENT_PATH}`, {
      followRedirects: true,
      timeoutMs,
    });
    validateHttpsResponse(route, response, checks, "https.large_content");
    const body = responseBodyBuffer(response);
    const largeContentType = header(response, "content-type").toLowerCase();
    let payload = null;
    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      // The validation check below reports malformed JSON without logging content.
    }
    const validPayload = payload && typeof payload === "object" && Array.isArray(payload.articles);
    addCheck(checks, "https.large_content.minimum_size", body.length > LARGE_CONTENT_MINIMUM_BYTES, {
      reason: "large_content_too_small",
      detail: `${body.length} decoded bytes; expected more than ${LARGE_CONTENT_MINIMUM_BYTES}`,
    });
    addCheck(checks, "https.large_content.content_type", largeContentType.includes("application/json"), {
      reason: "large_content_type_invalid",
      detail: largeContentType || "missing Content-Type",
    });
    addCheck(checks, "https.large_content.json", validPayload, {
      reason: "large_content_invalid",
    });
    result.largeContent = {
      path: LARGE_CONTENT_PATH,
      statusCode: response.statusCode,
      bytes: body.length,
      sha256: hash(body),
      articles: validPayload ? payload.articles.length : null,
    };
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.large_content.connection", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  let redirectSample = null;
  try {
    const response = await requestForRoute(route, requestImpl, `${expectedOrigin}${REDIRECT_MANIFEST_PATH}`, {
      followRedirects: true,
      timeoutMs,
    });
    validateHttpsResponse(route, response, checks, "https.redirect_manifest");
    const body = responseBodyBuffer(response);
    const contentType = header(response, "content-type").toLowerCase();
    const inspection = inspectRedirectManifest(body, expectedOrigin);
    redirectSample = inspection.sample;
    addCheck(checks, "https.redirect_manifest.content_type", contentType.includes("application/json"), {
      reason: "redirect_manifest_content_type_invalid",
      detail: contentType || "missing Content-Type",
    });
    addCheck(checks, "https.redirect_manifest.schema", inspection.errors.length === 0, {
      reason: "redirect_manifest_invalid",
      detail: inspection.errors.join("; "),
    });
    result.legacyRedirects.manifest = {
      path: REDIRECT_MANIFEST_PATH,
      statusCode: response.statusCode,
      count: inspection.count,
      sha256: hash(body),
      sample: inspection.sample,
    };
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.redirect_manifest.connection", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  if (redirectSample) {
    const sourceUrl = `${expectedOrigin}${redirectSample.source}`;
    try {
      const response = await requestForRoute(route, requestImpl, sourceUrl, {
        followRedirects: false,
        timeoutMs,
      });
      const inspection = inspectLegacyAliasResponse(response, sourceUrl, redirectSample.destination);
      addCheck(checks, "https.legacy_alias.tls", validTls(response, route.host), {
        reason: route.kind === "direct" ? "direct_tls_not_ready" : "tls_authentication_failed",
        detail: response.tls?.authorizationError || "TLS was not authenticated for the legacy alias",
      });
      addCheck(checks, "https.legacy_alias.redirects", !response.redirectViolation, {
        reason: "unsafe_redirect",
        detail: response.redirectViolation,
      });
      addCheck(checks, "https.legacy_alias.semantics", inspection.errors.length === 0, {
        reason: "legacy_alias_invalid",
        detail: inspection.errors.join("; "),
      });
      result.legacyRedirects.sample = {
        path: redirectSample.source,
        target: redirectSample.destination,
        ...inspection,
      };
    } catch (error) {
      const classification = classifyRouteError(route, error);
      addCheck(checks, "https.legacy_alias.connection", false, {
        ...classification,
        detail: safeError(error).message,
      });
    }
  }

  try {
    const notFoundUrl = `${expectedOrigin}${UNKNOWN_NOT_FOUND_PATH}`;
    const response = await requestForRoute(route, requestImpl, notFoundUrl, {
      followRedirects: false,
      timeoutMs,
    });
    const body = responseBodyBuffer(response);
    const html = body.toString("utf8");
    const contentType = header(response, "content-type").toLowerCase();
    const inspection = inspectNotFoundHtml(html, expectedOrigin);
    addCheck(checks, "https.not_found.status", response.statusCode === 404, {
      reason: "unknown_path_status_invalid",
      detail: `received ${response.statusCode}; expected 404`,
    });
    addCheck(checks, "https.not_found.redirects", !response.redirectViolation, {
      reason: "unsafe_redirect",
      detail: response.redirectViolation,
    });
    addCheck(checks, "https.not_found.tls", validTls(response, route.host), {
      reason: route.kind === "direct" ? "direct_tls_not_ready" : "tls_authentication_failed",
      detail: response.tls?.authorizationError || "TLS was not authenticated for the unknown path",
    });
    addCheck(checks, "https.not_found.content_type", contentType.includes("text/html"), {
      reason: "not_found_content_type_invalid",
      detail: contentType || "missing Content-Type",
    });
    addCheck(checks, "https.not_found.semantics", inspection.errors.length === 0, {
      reason: "not_found_semantics_invalid",
      detail: inspection.errors.join("; "),
    });
    result.notFound = {
      path: UNKNOWN_NOT_FOUND_PATH,
      statusCode: response.statusCode,
      bytes: body.length,
      canonical: inspection.canonical,
      sha256: hash(Buffer.from(normalizeRootHtmlForIntegrity(html))),
    };
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.not_found.connection", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  try {
    const response = await requestForRoute(route, requestImpl, `${expectedOrigin}${RELEASE_HEAD_PATH}`, {
      followRedirects: true,
      timeoutMs,
    });
    validateHttpsResponse(route, response, checks, "https.release_head");
    const releaseContentType = header(response, "content-type").toLowerCase();
    addCheck(checks, "https.release_head.content_type", releaseContentType.includes("application/json"), {
      reason: "release_head_content_type_invalid",
      detail: releaseContentType || "missing Content-Type",
    });
    const releaseHeadBody = responseBodyBuffer(response);
    let payload = null;
    try {
      payload = JSON.parse(releaseHeadBody.toString("utf8"));
    } catch {
      // Reported as an invalid release head below.
    }
    const releaseSha = String(payload?.commitSha || "").trim().toLowerCase();
    addCheck(checks, "https.release_head.schema", SHA_PATTERN.test(releaseSha), {
      reason: "release_head_invalid",
    });
    if (options.expectedReleaseSha) {
      addCheck(checks, "https.release_head.expected_sha", releaseSha === options.expectedReleaseSha, {
        reason: "release_sha_mismatch",
        detail: `received ${releaseSha || "<missing>"}; expected ${options.expectedReleaseSha}`,
      });
    }
    result.releaseSha = SHA_PATTERN.test(releaseSha) ? releaseSha : null;
    result.releaseHead = {
      path: RELEASE_HEAD_PATH,
      bytes: releaseHeadBody.length,
      sha256: hash(releaseHeadBody),
    };
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.release_head.connection", false, {
      ...classification,
      detail: safeError(error).message,
    });
  }

  const assetCandidates = [
    ["script", rootInspection.assets.script[0]],
    ["style", rootInspection.assets.style[0]],
    ["image", rootInspection.assets.image[0]],
  ];
  for (const [type, assetUrl] of assetCandidates) {
    if (!assetUrl) continue;
    try {
      const response = await requestForRoute(route, requestImpl, assetUrl, {
        followRedirects: true,
        method: "GET",
        timeoutMs,
      });
      validateHttpsResponse(route, response, checks, `https.asset.${type}`);
      const contentType = header(response, "content-type").toLowerCase();
      const validType = type === "script"
        ? /(?:javascript|ecmascript)/u.test(contentType)
        : type === "style"
          ? contentType.includes("text/css")
          : contentType.startsWith("image/");
      addCheck(checks, `https.asset.${type}.content_type`, validType, {
        reason: "asset_content_type_invalid",
        detail: `${assetUrl} returned ${contentType || "no Content-Type"}`,
      });
      const assetBody = responseBodyBuffer(response);
      addCheck(checks, `https.asset.${type}.body`, assetBody.length > 0, {
        reason: "asset_body_empty",
        detail: assetUrl,
      });
      result.assets.push({
        type,
        url: assetUrl,
        statusCode: response.statusCode,
        contentType: contentType || null,
        contentLength: assetBody.length,
        sha256: hash(assetBody),
      });
    } catch (error) {
      const classification = classifyRouteError(route, error);
      addCheck(checks, `https.asset.${type}.connection`, false, {
        ...classification,
        detail: safeError(error).message,
      });
    }
  }

  const failures = requiredFailures(checks);
  result.status = failures.length ? "failed" : "passed";
  if (failures.some((check) => check.reason === "direct_tls_not_ready")) {
    result.reason = "direct_tls_not_ready";
  } else {
    result.reason = failures[0]?.reason || null;
  }
  return result;
}

async function auditWwwRedirectRoute(apexHost, routeValue, options = {}) {
  const wwwHost = `www.${apexHost}`;
  const route = routeDefinition(routeValue.kind, wwwHost, routeValue.address, routeValue.family);
  const requestImpl = options.requestImpl || requestResource;
  const checks = [];
  const result = {
    ...route,
    id: route.kind === "global"
      ? route.family ? `global-www-ipv${route.family}` : "global-www"
      : `direct-www-ipv${route.family}-${route.address}`,
    role: "www",
    status: "failed",
    reason: null,
    checks,
    tls: null,
    httpRedirect: null,
    httpStatus: null,
    location: null,
  };
  try {
    const response = await requestForRoute(route, requestImpl, `http://${wwwHost}/`, {
      followRedirects: false,
      method: "HEAD",
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    });
    const location = header(response, "location") || null;
    const normalizedLocation = normalizedWebUrl(location, `http://${wwwHost}/`);
    const safeTargets = new Set([`https://${wwwHost}/`, `https://${apexHost}/`]);
    result.httpRedirect = { statusCode: response.statusCode, location };
    addCheck(
      checks,
      "http.www.redirect",
      STRICT_REDIRECT_STATUSES.has(response.statusCode) && safeTargets.has(normalizedLocation),
      {
        reason: route.kind === "direct" ? "direct_tls_not_ready" : "http_redirect_invalid",
        detail: `received ${response.statusCode} Location=${location || "<missing>"}; expected 301/308 to HTTPS www or apex`,
      }
    );
    if (route.kind === "global" && route.family) {
      addCheck(checks, "http.www.network_family", net.isIP(response.remoteAddress) === route.family, {
        reason: "network_family_mismatch",
        detail: `HTTP www IPv${route.family} route connected to ${response.remoteAddress || "<unknown>"}`,
      });
    }
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "http.www.redirect", false, {
      ...classification,
      detail: `${safeError(error).code || "ERROR"}: ${safeError(error).message}`,
    });
  }
  try {
    const response = await requestForRoute(route, requestImpl, `https://${wwwHost}/`, {
      followRedirects: false,
      method: "HEAD",
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    });
    result.tls = response.tls || null;
    result.httpStatus = response.statusCode;
    result.location = header(response, "location") || null;
    addCheck(checks, "https.www.tls", validTls(response, wwwHost), {
      reason: route.kind === "direct" ? "direct_tls_not_ready" : "tls_authentication_failed",
      detail: response.tls?.authorizationError || "TLS was not authenticated with the www Host and SNI",
    });
    const securityHeaderErrors = validateCriticalHeaders(response.headers);
    addCheck(checks, "https.www.security_headers", securityHeaderErrors.length === 0, {
      required: route.kind === "direct",
      reason: "critical_security_headers_invalid",
      detail: securityHeaderErrors.join("; "),
    });
    addCheck(
      checks,
      "https.www.redirect",
      STRICT_REDIRECT_STATUSES.has(response.statusCode) &&
        normalizedWebUrl(result.location, `https://${wwwHost}/`) === `https://${apexHost}/`,
      {
        reason: "www_redirect_invalid",
        detail: `received ${response.statusCode} Location=${result.location || "<missing>"}; expected 301/308 to https://${apexHost}/`,
      }
    );
    if (route.kind === "global" && route.family) {
      addCheck(checks, "https.www.network_family", net.isIP(response.remoteAddress) === route.family, {
        reason: "network_family_mismatch",
        detail: `HTTPS www IPv${route.family} route connected to ${response.remoteAddress || "<unknown>"}`,
      });
    }
  } catch (error) {
    const classification = classifyRouteError(route, error);
    addCheck(checks, "https.www.connection", false, {
      ...classification,
      detail: `${safeError(error).code || "ERROR"}: ${safeError(error).message}`,
    });
  }
  const failures = requiredFailures(checks);
  const unavailable = checks.length > 0 && checks.every((check) => check.status === "unavailable");
  result.status = unavailable ? "unavailable" : failures.length ? "failed" : "passed";
  result.reason = failures.some((check) => check.reason === "direct_tls_not_ready")
    ? "direct_tls_not_ready"
    : failures[0]?.reason || (unavailable ? "ipv6_unavailable" : null);
  return result;
}

function routeRequired(route) {
  return !route.externalIpv6Covered && (
    route.kind === "global" || route.family === 4 || route.status !== "unavailable"
  );
}

function integrityChecks(routes, expectedReleaseSha) {
  const checks = [];
  const comparable = routes.filter((route) =>
    route.root && route.representativeHtml && route.largeContent && route.releaseSha
  );
  const reference = comparable.find((route) => route.kind === "global") || comparable[0];
  if (reference) {
    for (const route of comparable.filter((candidate) => candidate.id !== reference.id)) {
      addCheck(checks, `integrity.${route.id}.root`, route.root.normalizedSha256 === reference.root.normalizedSha256, {
        reason: "root_content_mismatch",
        detail: `${route.id} differs from ${reference.id}`,
      });
      addCheck(checks, `integrity.${route.id}.large_content`, route.largeContent.sha256 === reference.largeContent.sha256, {
        reason: "large_content_mismatch",
        detail: `${route.id} differs from ${reference.id}`,
      });
      addCheck(
        checks,
        `integrity.${route.id}.redirect_manifest`,
        Boolean(route.legacyRedirects?.manifest && reference.legacyRedirects?.manifest &&
          route.legacyRedirects.manifest.path === reference.legacyRedirects.manifest.path &&
          route.legacyRedirects.manifest.count === reference.legacyRedirects.manifest.count &&
          route.legacyRedirects.manifest.sha256 === reference.legacyRedirects.manifest.sha256),
        {
          reason: "redirect_manifest_content_mismatch",
          detail: `${route.id} differs from ${reference.id}`,
        }
      );
      addCheck(
        checks,
        `integrity.${route.id}.legacy_alias`,
        Boolean(route.legacyRedirects?.sample && reference.legacyRedirects?.sample &&
          route.legacyRedirects.sample.path === reference.legacyRedirects.sample.path &&
          route.legacyRedirects.sample.target === reference.legacyRedirects.sample.target &&
          route.legacyRedirects.sample.semanticSha256 === reference.legacyRedirects.sample.semanticSha256),
        {
          reason: "legacy_alias_semantics_mismatch",
          detail: `${route.id} differs from ${reference.id}`,
        }
      );
      addCheck(
        checks,
        `integrity.${route.id}.not_found`,
        Boolean(route.notFound && reference.notFound &&
          route.notFound.path === reference.notFound.path &&
          route.notFound.statusCode === reference.notFound.statusCode &&
          route.notFound.canonical === reference.notFound.canonical &&
          route.notFound.sha256 === reference.notFound.sha256),
        {
          reason: "not_found_content_mismatch",
          detail: `${route.id} differs from ${reference.id}`,
        }
      );
      addCheck(
        checks,
        `integrity.${route.id}.representative_html`,
        route.representativeHtml.path === reference.representativeHtml.path &&
          route.representativeHtml.sha256 === reference.representativeHtml.sha256,
        {
          reason: "representative_html_content_mismatch",
          detail: `${route.id} differs from ${reference.id}`,
        }
      );
      addCheck(checks, `integrity.${route.id}.release_sha`, route.releaseSha === reference.releaseSha, {
        reason: "release_sha_mismatch",
        detail: `${route.id}=${route.releaseSha}; ${reference.id}=${reference.releaseSha}`,
      });
      addCheck(
        checks,
        `integrity.${route.id}.release_head`,
        route.releaseHead?.sha256 === reference.releaseHead?.sha256,
        {
          reason: "release_head_content_mismatch",
          detail: `${route.id} differs from ${reference.id}`,
        }
      );
      for (const type of ["script", "style", "image"]) {
        const referenceAsset = reference.assets.find((asset) => asset.type === type);
        const routeAsset = route.assets.find((asset) => asset.type === type);
        addCheck(
          checks,
          `integrity.${route.id}.asset.${type}`,
          Boolean(referenceAsset && routeAsset &&
            referenceAsset.url === routeAsset.url &&
            referenceAsset.sha256 === routeAsset.sha256),
          {
            reason: "asset_content_mismatch",
            detail: `${route.id} ${type} differs from ${reference.id}`,
          }
        );
      }
      for (const [name, key] of [["service_worker", "serviceWorker"], ["manifest", "manifest"]]) {
        addCheck(
          checks,
          `integrity.${route.id}.pwa.${name}`,
          Boolean(reference.pwa?.[key] && route.pwa?.[key] &&
            reference.pwa[key].sha256 === route.pwa[key].sha256),
          {
            reason: "pwa_content_mismatch",
            detail: `${route.id} ${name} differs from ${reference.id}`,
          }
        );
      }
    }
    const staticAliasHashes = unique(comparable
      .filter((route) => route.legacyRedirects?.sample?.mode === "static")
      .map((route) => route.legacyRedirects.sample.bodySha256)
      .filter(Boolean));
    addCheck(checks, "integrity.legacy_alias_static_body", staticAliasHashes.length <= 1, {
      reason: "legacy_alias_content_mismatch",
      detail: "Static legacy alias bodies differ between routes",
    });
  }
  if (expectedReleaseSha && !comparable.length) {
    addCheck(checks, "integrity.expected_release", false, {
      reason: "release_sha_unavailable",
      detail: `No route returned expected release ${expectedReleaseSha}`,
    });
  }
  return { referenceRoute: reference?.id || null, checks };
}

function uniformValue(values) {
  const present = unique(values.filter((value) => value !== null && value !== undefined));
  return present.length === 1 ? present[0] : null;
}

function buildProof(
  host,
  routes,
  wwwRoutes,
  expectedReleaseSha,
  originIps,
  pagesHostname,
  dnsRequiredOk,
  externalIpv6,
  now
) {
  const directRoutes = routes.filter((route) => route.kind === "direct");
  const directWwwRoutes = wwwRoutes.filter((route) => route.kind === "direct");
  const contentRoutes = directRoutes.filter((route) => route.status === "passed");
  const ipv4Count = originIps.filter((address) => net.isIP(address) === 4).length;
  const ipv6Count = originIps.filter((address) => net.isIP(address) === 6).length;
  const externalCanSubstitute = externalIpv6?.requiredOk === true &&
    externalIpv6?.contentIntegrityBound === true;
  const externalEvidence = (route, role) => route.family === 6 && externalCanSubstitute
    ? externalIpv6?.addresses?.[canonicalIp(route.address)]?.[role] || null
    : null;
  const apexRoutePassed = (route) => route.status === "passed" || (
    route.status === "unavailable" && externalEvidence(route, "apex")?.status === "passed"
  );
  const wwwRoutePassed = (route) => route.status === "passed" || (
    route.status === "unavailable" && externalEvidence(route, "www")?.status === "passed"
  );
  const apexCertificateFor = (route) => route.status === "passed"
    ? route.tls?.authorized === true
    : route.status === "unavailable" && externalEvidence(route, "apex")?.certificateValid === true;
  const apexHostnameFor = (route) => route.status === "passed"
    ? route.tls?.servername === host
    : route.status === "unavailable" && externalEvidence(route, "apex")?.hostnameVerified === true;
  const wwwCertificateFor = (route) => route.status === "passed"
    ? route.tls?.authorized === true
    : route.status === "unavailable" && externalEvidence(route, "www")?.certificateValid === true;
  const wwwHostnameFor = (route) => route.status === "passed"
    ? route.tls?.servername === `www.${host}`
    : route.status === "unavailable" && externalEvidence(route, "www")?.hostnameVerified === true;
  const apexCertificateValid = directRoutes.length === originIps.length && directRoutes.every((route) =>
    apexCertificateFor(route)
  );
  const apexHostnameVerified = apexCertificateValid && directRoutes.every((route) =>
    apexHostnameFor(route)
  );
  const wwwCertificateValid = directWwwRoutes.length === originIps.length && directWwwRoutes.every((route) =>
    wwwCertificateFor(route)
  );
  const wwwHostnameVerified = wwwCertificateValid && directWwwRoutes.every((route) =>
    wwwHostnameFor(route)
  );
  const apexReleaseSha = uniformValue(directRoutes.map((route) =>
    route.releaseSha || (route.status === "unavailable" ? externalEvidence(route, "apex")?.releaseSha : null)
  ));
  const apexStatus = uniformValue(directRoutes.map((route) =>
    route.root?.statusCode ?? (route.status === "unavailable" ? externalEvidence(route, "apex")?.httpStatus : null)
  ));
  const wwwStatus = uniformValue(directWwwRoutes.map((route) =>
    route.httpStatus ?? (route.status === "unavailable" ? externalEvidence(route, "www")?.httpStatus : null)
  ));
  const wwwLocations = directWwwRoutes.map((route) =>
    route.location || (route.status === "unavailable" ? externalEvidence(route, "www")?.redirectTo : null)
  );
  const apexContentLength = contentRoutes.length
    ? Math.min(...contentRoutes.map((route) => route.root?.bytes || 0))
    : 0;
  const apexLargeContentLength = contentRoutes.length
    ? Math.min(...contentRoutes.map((route) => route.largeContent?.bytes || 0))
    : 0;
  const representativeHtmlPath = uniformValue(contentRoutes.map((route) => route.representativeHtml?.path));
  const representativeHtmlStatus = uniformValue(
    contentRoutes.map((route) => route.representativeHtml?.statusCode)
  );
  const representativeHtmlContentLength = contentRoutes.length
    ? Math.min(...contentRoutes.map((route) => route.representativeHtml?.bytes || 0))
    : 0;
  const representativeHtmlSha256 = uniformValue(
    contentRoutes.map((route) => route.representativeHtml?.sha256)
  );
  const redirectManifestPath = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.manifest?.path)
  );
  const redirectManifestCount = contentRoutes.length
    ? Math.min(...contentRoutes.map((route) => route.legacyRedirects?.manifest?.count || 0))
    : 0;
  const redirectManifestSha256 = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.manifest?.sha256)
  );
  const legacyAliasPath = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.sample?.path)
  );
  const legacyAliasTarget = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.sample?.target)
  );
  const legacyAliasStatus = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.sample?.statusCode)
  );
  const legacyAliasMode = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.sample?.mode)
  );
  const legacyAliasSha256 = uniformValue(
    contentRoutes.map((route) => route.legacyRedirects?.sample?.semanticSha256)
  );
  const notFoundPath = uniformValue(contentRoutes.map((route) => route.notFound?.path));
  const notFoundStatus = uniformValue(contentRoutes.map((route) => route.notFound?.statusCode));
  const notFoundCanonical = uniformValue(contentRoutes.map((route) => route.notFound?.canonical));
  const notFoundSha256 = uniformValue(contentRoutes.map((route) => route.notFound?.sha256));
  const configuredAddressSet = new Set(originIps.map(canonicalIp));
  const officialAddresses = [...DEFAULT_DIRECT_IPV4, ...DEFAULT_DIRECT_IPV6].map(canonicalIp);
  const officialAddressSet = new Set(officialAddresses);
  const originCoverage = ipv4Count === DEFAULT_DIRECT_IPV4.length &&
    ipv6Count === DEFAULT_DIRECT_IPV6.length &&
    configuredAddressSet.size === officialAddressSet.size &&
    officialAddresses.every((address) => configuredAddressSet.has(address)) &&
    [...configuredAddressSet].every((address) => officialAddressSet.has(address)) &&
    directRoutes.length === originIps.length &&
    directWwwRoutes.length === originIps.length;
  const apexEndpointsPassed = directRoutes.length === originIps.length && directRoutes.every(apexRoutePassed);
  const wwwEndpointsPassed = directWwwRoutes.length === originIps.length && directWwwRoutes.every(wwwRoutePassed);
  const localIpv4ContentCovered = directRoutes.filter((route) => route.family === 4).length === ipv4Count &&
    directRoutes.filter((route) => route.family === 4).every((route) => route.status === "passed");
  const proofEligible = Boolean(expectedReleaseSha) &&
    dnsRequiredOk === true &&
    originCoverage &&
    apexEndpointsPassed &&
    wwwEndpointsPassed &&
    localIpv4ContentCovered &&
    apexCertificateValid &&
    apexHostnameVerified &&
    wwwCertificateValid &&
    wwwHostnameVerified &&
    Number.isInteger(apexStatus) && apexStatus >= 200 && apexStatus < 300 &&
    apexContentLength >= ROOT_MINIMUM_BYTES &&
    apexLargeContentLength > LARGE_CONTENT_MINIMUM_BYTES &&
    typeof representativeHtmlPath === "string" && representativeHtmlPath.startsWith("/stati/") &&
    Number.isInteger(representativeHtmlStatus) &&
      representativeHtmlStatus >= 200 && representativeHtmlStatus < 300 &&
    representativeHtmlContentLength > LARGE_CONTENT_MINIMUM_BYTES &&
    /^[0-9a-f]{64}$/u.test(representativeHtmlSha256 || "") &&
    redirectManifestPath === REDIRECT_MANIFEST_PATH &&
    redirectManifestCount >= MINIMUM_LEGACY_REDIRECTS &&
    /^[0-9a-f]{64}$/u.test(redirectManifestSha256 || "") &&
    typeof legacyAliasPath === "string" && legacyAliasPath.startsWith("/articles/") &&
    normalizedSameOriginHttpsUrl(legacyAliasTarget, `https://${host}`) === legacyAliasTarget &&
    [301, 308].includes(legacyAliasStatus) &&
    legacyAliasMode === "redirect" &&
    /^[0-9a-f]{64}$/u.test(legacyAliasSha256 || "") &&
    notFoundPath === UNKNOWN_NOT_FOUND_PATH &&
    notFoundStatus === 404 &&
    notFoundCanonical === `https://${host}/` &&
    /^[0-9a-f]{64}$/u.test(notFoundSha256 || "") &&
    apexReleaseSha === expectedReleaseSha &&
    STRICT_REDIRECT_STATUSES.has(wwwStatus) &&
    wwwLocations.every((location) =>
      normalizedWebUrl(location, `https://www.${host}/`) === `https://${host}/`
    );
  const verifiedAt = new Date(now).toISOString();
  return {
    schemaVersion: 1,
    status: proofEligible ? "passed" : "failed",
    proofEligible,
    expectedMainSha: expectedReleaseSha || null,
    pagesHostname,
    publicRecordsFingerprint: null,
    verifiedAt,
    expiresAt: new Date(now + PROOF_LIFETIME_MS).toISOString(),
    originIpsRequired: originIps,
    externalIpv6Proof: externalIpv6?.provider &&
      externalIpv6.status === "passed" &&
      Array.isArray(externalIpv6.measurements) &&
      externalIpv6.measurements.length > 0 ? {
      provider: externalIpv6.provider,
      status: externalIpv6.status,
      requiredOk: externalIpv6.requiredOk,
      addressesRequired: externalIpv6.addressesRequired,
      measurementIds: externalIpv6.measurements?.map((measurement) => measurement.id).filter(Boolean) || [],
    } : null,
    hosts: {
      apex: {
        host,
        status: apexEndpointsPassed ? "passed" : "failed",
        certificateValid: apexCertificateValid,
        hostnameVerified: apexHostnameVerified,
        httpStatus: apexStatus,
        rootContentLength: apexContentLength || null,
        contentPath: LARGE_CONTENT_PATH,
        contentLength: apexLargeContentLength || null,
        largeContentLength: apexLargeContentLength || null,
        representativeHtmlPath,
        representativeHtmlStatus,
        representativeHtmlContentLength: representativeHtmlContentLength || null,
        representativeHtmlSha256,
        redirectManifestPath,
        redirectManifestCount: redirectManifestCount || null,
        redirectManifestSha256,
        legacyAliasPath,
        legacyAliasTarget,
        legacyAliasStatus,
        legacyAliasMode,
        legacyAliasSha256,
        notFoundPath,
        notFoundStatus,
        notFoundCanonical,
        notFoundSha256,
        releaseSha: apexReleaseSha,
        originIpsTested: directRoutes.filter(apexRoutePassed).map((route) => route.address),
      },
      www: {
        host: `www.${host}`,
        status: wwwEndpointsPassed ? "passed" : "failed",
        certificateValid: wwwCertificateValid,
        hostnameVerified: wwwHostnameVerified,
        httpStatus: wwwStatus,
        redirectTo: uniformValue(wwwLocations),
        redirectLocation: uniformValue(wwwLocations),
        location: uniformValue(wwwLocations),
        releaseSha: apexReleaseSha,
        originIpsTested: directWwwRoutes.filter(wwwRoutePassed).map((route) => route.address),
      },
    },
  };
}

export async function auditConnectivity(options = {}) {
  const host = normalizeHost(options.host || DEFAULT_HOST);
  const pagesHostname = normalizeHost(options.pagesHostname || "kosyat128.github.io");
  const mode = options.mode || "all";
  const expectedDnsRoute = options.expectedDnsRoute || (mode === "global" ? "cloudflare" : "either");
  const originIps = unique(validateAddresses(options.originIps || [
    ...DEFAULT_DIRECT_IPV4,
    ...DEFAULT_DIRECT_IPV6,
  ]));
  const routes = [];
  const wwwRouteDefinitions = [];
  if (["all", "global"].includes(mode)) {
    routes.push(routeDefinition("global", host, null, 4), routeDefinition("global", host, null, 6));
  }
  if (["all", "direct"].includes(mode)) {
    routes.push(...originIps.map((address) => routeDefinition("direct", host, address)));
  }
  if (["all", "global"].includes(mode)) {
    wwwRouteDefinitions.push(
      routeDefinition("global", `www.${host}`, null, 4),
      routeDefinition("global", `www.${host}`, null, 6)
    );
  }
  if (["all", "direct"].includes(mode)) {
    wwwRouteDefinitions.push(...originIps.map((address) => routeDefinition("direct", `www.${host}`, address)));
  }

  const [dns, routeResults, wwwRouteResults] = await Promise.all([
    auditDnsWithRetries({
      host,
      resolvers: options.resolvers || DEFAULT_RESOLVERS,
      resolveImpl: options.resolveImpl,
      expectedRoute: expectedDnsRoute,
      expectedDirectAddresses: originIps,
      attempts: options.dnsAttempts || 1,
      retryDelayMs: options.dnsRetryDelayMs ?? DEFAULT_DNS_RETRY_DELAY_MS,
      sleepImpl: options.dnsSleepImpl || waitFor,
    }),
    Promise.all(routes.map((route) => auditRoute(route, {
      expectedReleaseSha: options.releaseSha || null,
      requestImpl: options.requestImpl,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    }))),
    Promise.all(wwwRouteDefinitions.map((route) => auditWwwRedirectRoute(host, route, {
      requestImpl: options.requestImpl,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    }))),
  ]);
  const externalIpv6Mode = options.externalIpv6Proof || "none";
  let externalIpv6 = {
    schema: "probpera-external-ipv6-origin-proof/v1",
    provider: externalIpv6Mode === "globalping" ? "globalping" : null,
    status: "disabled",
    requiredOk: null,
    reason: "external_ipv6_proof_not_requested",
    addressesRequired: [],
    addresses: {},
    measurements: [],
  };
  if (externalIpv6Mode === "globalping" && ["all", "direct"].includes(mode)) {
    const configuredIpv6 = originIps.filter((address) => net.isIP(address) === 6).map(canonicalIp);
    const fallbackNeeded = configuredIpv6.some((address) => {
      const apex = routeResults.find((route) => route.kind === "direct" && canonicalIp(route.address) === address);
      const www = wwwRouteResults.find((route) => route.kind === "direct" && canonicalIp(route.address) === address);
      return apex?.status === "unavailable" && www?.status === "unavailable";
    });
    // A manager-consumable proof is a single indivisible evidence bundle: if
    // any local IPv6 route needs substitution, verify every reviewed IPv6
    // origin externally. This prevents a partial marker from being combined
    // with unauthenticated local coverage after the fact.
    const fallbackAddresses = fallbackNeeded ? configuredIpv6 : [];
    if (fallbackAddresses.length) {
      try {
        const externalAuditImpl = options.externalIpv6AuditImpl || auditExternalIpv6Origin;
        externalIpv6 = await externalAuditImpl({
          host,
          ipv6Addresses: fallbackAddresses,
          expectedReleaseSha: options.releaseSha || null,
        }, options.externalIpv6Dependencies || {});
      } catch (error) {
        externalIpv6 = {
          ...externalIpv6,
          status: "failed",
          requiredOk: false,
          reason: "external_ipv6_proof_failed",
          addressesRequired: fallbackAddresses,
          error: safeError(error),
        };
      }
    } else {
      externalIpv6 = {
        ...externalIpv6,
        status: "not-needed",
        requiredOk: true,
        reason: null,
      };
    }
    const allIpv6Covered = configuredIpv6.length > 0 && configuredIpv6.every((address) => {
      const apex = routeResults.find((route) => route.kind === "direct" && canonicalIp(route.address) === address);
      const www = wwwRouteResults.find((route) => route.kind === "direct" && canonicalIp(route.address) === address);
      const localPassed = apex?.status === "passed" && www?.status === "passed";
      const externalPassed = apex?.status === "unavailable" && www?.status === "unavailable" &&
        externalIpv6.addresses?.[address]?.apex?.status === "passed" &&
        externalIpv6.addresses?.[address]?.www?.status === "passed";
      return localPassed || externalPassed;
    });
    if (!allIpv6Covered || externalIpv6.requiredOk !== true) {
      externalIpv6 = {
        ...externalIpv6,
        status: "failed",
        requiredOk: false,
        reason: externalIpv6.reason || "external_ipv6_coverage_incomplete",
      };
    }
  }
  // A post-apply direct audit first waits for recursive DNS quorum, then verifies
  // the ordinary public route through system DNS once. Forced origin content is
  // intentionally not repeated during propagation polling.
  if (mode === "direct" && expectedDnsRoute === "direct") {
    const [publicRoutes, publicWwwRoutes] = await Promise.all([
      Promise.all([4, 6].map((family) => auditRoute(routeDefinition("global", host, null, family), {
        expectedReleaseSha: options.releaseSha || null,
        requestImpl: options.requestImpl,
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      }))),
      Promise.all([4, 6].map((family) => auditWwwRedirectRoute(
        host,
        routeDefinition("global", `www.${host}`, null, family),
        {
          requestImpl: options.requestImpl,
          timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        }
      ))),
    ]);
    for (const route of [...publicRoutes, ...publicWwwRoutes]) {
      route.verification = "post_dns_propagation";
      if (route.family === 6 && route.status === "unavailable" && externalIpv6.requiredOk === true) {
        route.externalIpv6Covered = true;
        route.checks = route.checks.map((check) => check.status === "unavailable"
          ? { ...check, required: false, substitutedBy: "globalping_forced_origin" }
          : check);
      }
    }
    routeResults.push(...publicRoutes);
    wwwRouteResults.push(...publicWwwRoutes);
  }
  const integrity = integrityChecks(routeResults, options.releaseSha || null);
  const routeFailures = routeResults.filter((route) => routeRequired(route) && route.status !== "passed");
  const wwwRouteFailures = wwwRouteResults.filter((route) => routeRequired(route) && route.status !== "passed");
  const integrityFailures = requiredFailures(integrity.checks);
  const externalIpv6RequiredOk = externalIpv6Mode !== "globalping" || externalIpv6.requiredOk === true;
  const requiredOk = dns.requiredOk && routeFailures.length === 0 &&
    wwwRouteFailures.length === 0 && integrityFailures.length === 0 && externalIpv6RequiredOk;
  const generatedAtMs = Date.now();
  const proof = buildProof(
    host,
    routeResults,
    wwwRouteResults,
    options.releaseSha || null,
    originIps,
    pagesHostname,
    dns.requiredOk,
    externalIpv6,
    generatedAtMs
  );
  const allChecks = [
    ...routeResults.flatMap((route) => route.checks.map((check) => ({ ...check, route: route.id }))),
    ...wwwRouteResults.flatMap((route) => route.checks.map((check) => ({ ...check, route: route.id }))),
    ...integrity.checks,
  ];

  return {
    schema: AUDIT_SCHEMA,
    generatedAt: new Date(generatedAtMs).toISOString(),
    host,
    mode,
    expectedReleaseSha: options.releaseSha || null,
    expectedDnsRoute,
    requiredOk,
    directTlsReady: proof.proofEligible,
    counts: {
      routes: routeResults.length + wwwRouteResults.length,
      passedRoutes: [...routeResults, ...wwwRouteResults].filter((route) => route.status === "passed").length,
      failedRoutes: [...routeResults, ...wwwRouteResults].filter((route) => route.status === "failed").length,
      unavailableRoutes: [...routeResults, ...wwwRouteResults].filter((route) => route.status === "unavailable").length,
      passedChecks: allChecks.filter((check) => check.status === "passed").length,
      requiredFailures: allChecks.filter((check) => check.required && check.status !== "passed").length +
        dns.queries.filter((query) => query.status === "invalid").length +
        dns.families.filter((family) => family.status !== "passed").length +
        (dns.policyConsistent ? 0 : 1) +
        (externalIpv6RequiredOk ? 0 : 1),
      warnings: allChecks.filter((check) => ["warning", "unavailable"].includes(check.status)).length +
        dns.queries.filter((query) => ["unavailable", "missing"].includes(query.status) && !query.required).length,
    },
    dns,
    routes: routeResults,
    wwwRoutes: wwwRouteResults,
    integrity,
    externalIpv6,
    proof,
  };
}

function routeText(route) {
  const target = route.kind === "global" ? "system DNS" : route.address;
  const marker = route.status === "passed" ? "PASS" : route.status === "unavailable" ? "N/A" : "FAIL";
  const details = [
    route.reason,
    route.releaseSha ? `release=${route.releaseSha}` : null,
    route.root ? `root=${route.root.bytes}B` : null,
  ].filter(Boolean).join("; ");
  return `  [${marker}] ${route.id} (${target})${details ? `: ${details}` : ""}`;
}

export function formatTextSummary(summary) {
  const lines = [
    `ProbPera connectivity audit: ${summary.requiredOk ? "PASS" : "FAIL"}`,
    `Host: ${summary.host}`,
    `Mode: ${summary.mode}`,
    `Direct TLS proof: ${summary.directTlsReady ? "READY" : "NOT READY"}`,
    `External IPv6 proof: ${summary.externalIpv6?.provider || "disabled"} / ${summary.externalIpv6?.status || "disabled"}`,
    "Routes:",
    ...summary.routes.map(routeText),
    ...summary.wwwRoutes.map(routeText),
    "DNS:",
    ...summary.dns.families.map((family) =>
      `  [${family.status.toUpperCase()}] ${family.host} IPv${family.family} route=${family.route || "unknown"} quorum: ${family.successfulResolvers}/${family.totalResolvers} (need ${family.quorum})`
    ),
    ...summary.dns.queries.map((query) => {
      const records = query.records.map((record) => record.address).join(", ") || query.reason;
      return `  [${query.status.toUpperCase()}] ${query.host} via ${query.resolver} IPv${query.family} route=${query.route || "unknown"}: ${records}`;
    }),
    `Integrity reference: ${summary.integrity.referenceRoute || "unavailable"}`,
    `Checks: ${summary.counts.passedChecks} passed, ${summary.counts.requiredFailures} required failures, ${summary.counts.warnings} warnings`,
  ];
  const failures = [
    ...summary.routes.flatMap((route) => route.checks
      .filter((check) => check.required && check.status !== "passed")
      .map((check) => `${route.id}/${check.id}: ${check.reason}${check.detail ? ` (${check.detail})` : ""}`)),
    ...summary.wwwRoutes.flatMap((route) => route.checks
      .filter((check) => check.required && check.status !== "passed")
      .map((check) => `${route.id}/${check.id}: ${check.reason}${check.detail ? ` (${check.detail})` : ""}`)),
    ...summary.integrity.checks
      .filter((check) => check.required && check.status !== "passed")
      .map((check) => `${check.id}: ${check.reason}${check.detail ? ` (${check.detail})` : ""}`),
    ...summary.dns.families
      .filter((family) => family.status !== "passed")
      .map((family) => `dns.${family.host}.ipv${family.family}: ${family.reason} (${family.successfulResolvers}/${family.totalResolvers}, need ${family.quorum})`),
    ...summary.dns.queries
      .filter((query) => query.status === "invalid")
      .map((query) => `dns.${query.resolver}.ipv${query.family}: ${query.reason}`),
    ...(summary.dns.policyConsistent ? [] : ["dns.policy: dns_route_policy_mixed"]),
    ...(summary.externalIpv6?.provider && summary.externalIpv6.requiredOk !== true
      ? [`external-ipv6.${summary.externalIpv6.provider}: ${summary.externalIpv6.reason || "external_ipv6_proof_failed"}`]
      : []),
  ];
  if (failures.length) lines.push("Required failures:", ...failures.map((failure) => `  - ${failure}`));
  return redactSensitive(lines.join("\n"));
}

function usage() {
  return [
    "Usage: node scripts/network/audit-connectivity.mjs [options]",
    "  --mode=global|direct|all       Audit normal DNS, forced origin IPs, or both (default: all)",
    "  --host=probpera.ru             Public hostname and TLS SNI",
    "  --expected-dns-route=ROUTE     cloudflare, direct, or either",
    "  --external-ipv6-proof=MODE     none or globalping forced-origin fallback",
    "  --origin-ip=IP[,IP...]         Repeatable forced GitHub Pages address",
    "  --resolver=IP[,IP...]          DNS resolvers (default: 1.1.1.1,8.8.8.8,9.9.9.9)",
    "  --dns-attempts=1               DNS quorum attempts (maximum: 20)",
    "  --dns-retry-delay-ms=15000     Delay between DNS attempts (maximum: 60000)",
    "  --release-sha=40_HEX           Require this deployed release SHA",
    "  --json=true|false              Emit machine-readable JSON",
    "  --timeout-ms=12000             Per-request timeout",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  let options;
  try {
    options = parseCliOptions(argv, environment);
  } catch (error) {
    console.error(redactSensitive(`Connectivity audit configuration error: ${error.message}`));
    process.exitCode = 2;
    return null;
  }
  if (options.help) {
    console.log(usage());
    return null;
  }
  const summary = await auditConnectivity(options);
  console.log(options.json ? JSON.stringify(summary, null, 2) : formatTextSummary(summary));
  if (!summary.requiredOk) process.exitCode = 1;
  return summary;
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPoint === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(redactSensitive(`Connectivity audit failed: ${safeError(error).message}`));
    process.exitCode = 1;
  }
}
