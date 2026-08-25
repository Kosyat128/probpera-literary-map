import path from "node:path";
import { pathToFileURL } from "node:url";

import { validateSecurityDocument } from "./audit-live-security.mjs";
import { inspectCloudflareEdgeApplicability } from "./cloudflare/verify-edge-applicability.mjs";

export const PUBLIC_DIRECT_ORIGIN = "https://probpera.ru";
const DEFAULT_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 12_000;

function normalizeOrigin(value) {
  const origin = new URL(value);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(`Direct public origin must be a bare HTTPS origin: ${value}`);
  }
  return origin;
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function request(fetchImpl, url, init, timeoutMs) {
  return fetchImpl(url, {
    ...init,
    headers: {
      Accept: "*/*",
      "Cache-Control": "no-cache",
      "User-Agent": "ProbPeraDirectOriginAudit/1.0 (probperasite@yandex.ru)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The redirect/root probes only need status and headers.
  }
}

export async function auditDirectPublicOrigin(originValue = PUBLIC_DIRECT_ORIGIN, options = {}) {
  const origin = normalizeOrigin(originValue);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
  const now = options.now || Date.now();
  const errors = [];
  let checks = 0;

  try {
    const edge = await inspectCloudflareEdgeApplicability({
      origin: origin.href,
      fetchImpl,
      timeoutMs,
    });
    checks += 1;
    if (edge.edgeTrafficProxied) {
      errors.push(
        `${origin.origin} unexpectedly traverses Cloudflare edge (CF-Ray present); public availability policy requires DNS-only/direct delivery`
      );
    }
  } catch (error) {
    errors.push(
      `${origin.origin} direct-path probe failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const httpProbe = new URL("/.well-known/security.txt?direct-origin-audit=1", origin);
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
    errors.push(
      `${httpProbe.href} redirect check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const rootUrl = new URL("/", origin);
  try {
    const response = await request(fetchImpl, rootUrl, { redirect: "follow" }, timeoutMs);
    checks += 1;
    if (!response.ok) errors.push(`${rootUrl.href} returned ${response.status}`);
    if (response.url && new URL(response.url).protocol !== "https:") {
      errors.push(`${rootUrl.href} redirected away from HTTPS`);
    }
    await discardBody(response);
  } catch (error) {
    errors.push(
      `${rootUrl.href} availability check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const securityUrl = new URL("/.well-known/security.txt", origin);
  try {
    const response = await request(fetchImpl, securityUrl, { redirect: "follow" }, timeoutMs);
    checks += 1;
    if (!response.ok) errors.push(`${securityUrl.href} returned ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("text/plain")) {
      errors.push(`${securityUrl.href}: security.txt must use a text/plain Content-Type`);
    }
    const document = await response.text();
    errors.push(
      ...validateSecurityDocument(document, origin.href, now).map(
        (message) => `${origin.origin}: ${message}`
      )
    );
  } catch (error) {
    errors.push(
      `${securityUrl.href} check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { origin: origin.origin, checks, errors, ok: errors.length === 0 };
}

function parseOptions(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/u);
    if (!match) throw new Error(`Unknown argument: ${argument}`);
    if (values.has(match[1])) throw new Error(`Duplicate argument: --${match[1]}`);
    values.set(match[1], match[2]);
  }
  for (const name of values.keys()) {
    if (!["origin", "attempts", "retry-delay-ms", "timeout-ms"].includes(name)) {
      throw new Error(`Unknown argument: --${name}`);
    }
  }
  return {
    origin: values.get("origin") || PUBLIC_DIRECT_ORIGIN,
    attempts: positiveInteger(values.get("attempts"), DEFAULT_ATTEMPTS, "--attempts"),
    retryDelayMs: positiveInteger(
      values.get("retry-delay-ms"),
      DEFAULT_RETRY_DELAY_MS,
      "--retry-delay-ms"
    ),
    timeoutMs: positiveInteger(values.get("timeout-ms"), DEFAULT_TIMEOUT_MS, "--timeout-ms"),
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    const result = await auditDirectPublicOrigin(options.origin, {
      timeoutMs: options.timeoutMs,
    });
    if (result.ok) {
      console.log(
        `PASS ${result.origin}: ${result.checks} direct-origin availability/security checks; Cloudflare proxy is off as required`
      );
      return;
    }
    for (const error of result.errors) console.error(`FAIL ${error}`);
    if (attempt < options.attempts) {
      console.error(`Retrying direct-origin audit (${attempt + 1}/${options.attempts})...`);
      await wait(options.retryDelayMs);
    }
  }
  process.exitCode = 1;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) await main();
