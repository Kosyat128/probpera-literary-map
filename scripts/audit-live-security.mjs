import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ORIGINS = ["https://probpera.ru", "https://admin.probpera.ru"];
const DEFAULT_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_SECURITY_DOCUMENT_LIFETIME_MS = 370 * ONE_DAY_MS;

function normalizeOrigin(value) {
  const origin = new URL(value);
  if (origin.protocol !== "https:") {
    throw new Error(`Live smoke origin must use HTTPS: ${value}`);
  }
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error(`Live smoke origin must not contain credentials, path, query, or hash: ${value}`);
  }
  return origin;
}

function securityFields(document) {
  const fields = new Map();
  for (const rawLine of document.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const values = fields.get(name) || [];
    values.push(value);
    fields.set(name, values);
  }
  return fields;
}

export function validateSecurityHeaders(headers) {
  const errors = [];
  const hsts = headers.get("strict-transport-security") || "";
  const maxAge = Number.parseInt(hsts.match(/(?:^|;)\s*max-age=(\d+)/iu)?.[1] || "", 10);
  if (!Number.isFinite(maxAge) || maxAge < 31_536_000) {
    errors.push("Strict-Transport-Security must include max-age of at least one year");
  }

  if ((headers.get("x-content-type-options") || "").toLowerCase() !== "nosniff") {
    errors.push("X-Content-Type-Options must be nosniff");
  }

  const referrerPolicy = (headers.get("referrer-policy") || "").toLowerCase();
  if (![
    "no-referrer",
    "same-origin",
    "strict-origin",
    "strict-origin-when-cross-origin",
  ].includes(referrerPolicy)) {
    errors.push("Referrer-Policy must use a strict policy");
  }

  const permissionsPolicy = (headers.get("permissions-policy") || "").toLowerCase();
  for (const feature of ["camera", "microphone", "geolocation"]) {
    if (!new RegExp(`(?:^|,)\\s*${feature}=\\(\\)`, "u").test(permissionsPolicy)) {
      errors.push(`Permissions-Policy must disable ${feature}`);
    }
  }

  const frameOptions = (headers.get("x-frame-options") || "").toUpperCase();
  const contentSecurityPolicy = headers.get("content-security-policy") || "";
  if (
    !["DENY", "SAMEORIGIN"].includes(frameOptions) &&
    !/(?:^|;)\s*frame-ancestors\s+[^;]+/iu.test(contentSecurityPolicy)
  ) {
    errors.push("Responses need X-Frame-Options or a CSP frame-ancestors directive");
  }

  return errors;
}

export function validateSecurityDocument(document, originValue, now = Date.now()) {
  const errors = [];
  const origin = normalizeOrigin(originValue);
  const fields = securityFields(document);
  const contacts = fields.get("contact") || [];
  if (!contacts.some((value) => /^(?:mailto:|https:)/iu.test(value))) {
    errors.push("security.txt needs an HTTPS or mailto Contact field");
  }

  const expiresValue = fields.get("expires")?.[0] || "";
  const expiresAt = Date.parse(expiresValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= now + ONE_DAY_MS) {
    errors.push("security.txt Expires must be a valid future timestamp");
  } else if (expiresAt - now > MAX_SECURITY_DOCUMENT_LIFETIME_MS) {
    errors.push("security.txt Expires must not be more than 370 days ahead");
  }

  const expectedCanonical = new URL("/.well-known/security.txt", origin).href;
  const canonicals = fields.get("canonical") || [];
  if (!canonicals.some((value) => {
    try {
      return new URL(value).href === expectedCanonical;
    } catch {
      return false;
    }
  })) {
    errors.push(`security.txt Canonical must include ${expectedCanonical}`);
  }

  return errors;
}

export function validateSecurityDocumentHeaders(headers) {
  const errors = [];
  const contentType = headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("text/plain")) {
    errors.push("security.txt must use a text/plain Content-Type");
  }
  if ((headers.get("x-content-type-options") || "").toLowerCase() !== "nosniff") {
    errors.push("security.txt must use X-Content-Type-Options: nosniff");
  }
  return errors;
}

async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The checks only need headers for this request.
  }
}

async function request(fetchImpl, url, init, timeoutMs) {
  return fetchImpl(url, {
    ...init,
    headers: {
      Accept: "*/*",
      "User-Agent": "ProbPeraReleaseSmoke/1.0 (probperasite@yandex.ru)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function auditOrigin(originValue, options = {}) {
  const origin = normalizeOrigin(originValue);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const now = options.now || Date.now();
  const errors = [];
  let checks = 0;

  const httpProbe = new URL("/robots.txt?release-smoke=1", origin);
  httpProbe.protocol = "http:";
  const expectedRedirect = new URL(httpProbe);
  expectedRedirect.protocol = "https:";
  try {
    const response = await request(fetchImpl, httpProbe, { redirect: "manual" }, timeoutMs);
    checks += 1;
    if (![301, 308].includes(response.status)) {
      errors.push(`${httpProbe.href} returned ${response.status}; expected 301 or 308`);
    }
    const location = response.headers.get("location");
    if (!location) {
      errors.push(`${httpProbe.href} did not return a Location header`);
    } else {
      const actualRedirect = new URL(location, httpProbe);
      if (actualRedirect.href !== expectedRedirect.href) {
        errors.push(
          `${httpProbe.href} must preserve host, path, and query when redirecting to ${expectedRedirect.href}`
        );
      }
    }
    await discardBody(response);
  } catch (error) {
    errors.push(`${httpProbe.href} redirect check failed: ${error instanceof Error ? error.message : error}`);
  }

  const rootUrl = new URL("/", origin);
  try {
    const response = await request(fetchImpl, rootUrl, { redirect: "follow" }, timeoutMs);
    checks += 1;
    if (!response.ok) {
      errors.push(`${rootUrl.href} returned ${response.status}`);
    }
    if (response.url && new URL(response.url).protocol !== "https:") {
      errors.push(`${rootUrl.href} redirected away from HTTPS`);
    }
    errors.push(...validateSecurityHeaders(response.headers).map((message) => `${origin.origin}: ${message}`));
    await discardBody(response);
  } catch (error) {
    errors.push(`${rootUrl.href} header check failed: ${error instanceof Error ? error.message : error}`);
  }

  const securityUrl = new URL("/.well-known/security.txt", origin);
  try {
    const response = await request(fetchImpl, securityUrl, { redirect: "follow" }, timeoutMs);
    checks += 1;
    if (!response.ok) {
      errors.push(`${securityUrl.href} returned ${response.status}`);
    }
    errors.push(
      ...validateSecurityDocumentHeaders(response.headers).map(
        (message) => `${securityUrl.href}: ${message}`
      )
    );
    const document = await response.text();
    errors.push(
      ...validateSecurityDocument(document, origin.href, now).map(
        (message) => `${origin.origin}: ${message}`
      )
    );
  } catch (error) {
    errors.push(`${securityUrl.href} check failed: ${error instanceof Error ? error.message : error}`);
  }

  return { origin: origin.origin, checks, errors, ok: errors.length === 0 };
}

function integerOption(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseOptions(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/u);
    if (!match) throw new Error(`Unknown argument: ${argument}`);
    values.set(match[1], match[2]);
  }
  const originInput = values.get("origins") || process.env.LIVE_SMOKE_ORIGINS || DEFAULT_ORIGINS.join(",");
  const origins = originInput.split(",").map((value) => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error("At least one live smoke origin is required");
  return {
    origins,
    attempts: integerOption(values.get("attempts"), DEFAULT_ATTEMPTS, "attempts"),
    retryDelayMs: integerOption(
      values.get("retry-delay-ms"),
      DEFAULT_RETRY_DELAY_MS,
      "retry-delay-ms"
    ),
    timeoutMs: integerOption(values.get("timeout-ms"), DEFAULT_TIMEOUT_MS, "timeout-ms"),
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  let results = [];
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    results = await Promise.all(
      options.origins.map((origin) => auditOrigin(origin, { timeoutMs: options.timeoutMs }))
    );
    for (const result of results) {
      if (result.ok) {
        console.log(`PASS ${result.origin}: ${result.checks} live security checks`);
      } else {
        for (const error of result.errors) console.error(`FAIL ${error}`);
      }
    }
    if (results.every((result) => result.ok)) return;
    if (attempt < options.attempts) {
      console.error(`Retrying live security audit (${attempt + 1}/${options.attempts})...`);
      await wait(options.retryDelayMs);
    }
  }
  process.exitCode = 1;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) await main();
