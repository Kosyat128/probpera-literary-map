import path from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_ORIGIN = "https://probpera.ru";
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
    throw new Error(`Cloudflare edge applicability origin must be a bare HTTPS origin: ${value}`);
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

export function responseTraversedCloudflare(headers) {
  return Boolean(headers?.get?.("cf-ray")?.trim());
}

async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The probe only needs status and response headers.
  }
}

export async function inspectCloudflareEdgeApplicability(options = {}) {
  const origin = normalizeOrigin(options.origin || PUBLIC_ORIGIN);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = positiveInteger(
    options.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    "timeoutMs"
  );
  const probe = new URL("/.well-known/security.txt", origin);
  probe.searchParams.set("edge-applicability", "1");

  let response;
  try {
    response = await fetchImpl(probe, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/plain,*/*;q=0.1",
        "Cache-Control": "no-cache",
        "User-Agent": "ProbPeraCloudflareApplicability/1.0 (probperasite@yandex.ru)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cloudflare edge applicability probe failed before a response: ${detail}`);
  }

  const result = {
    origin: origin.origin,
    status: response.status,
    edgeTrafficProxied: responseTraversedCloudflare(response.headers),
  };
  await discardBody(response);

  if (response.status < 200 || response.status >= 500) {
    throw new Error(
      `Cloudflare edge applicability probe returned unexpected HTTP ${response.status}`
    );
  }
  return result;
}

function parseCliOptions(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.*)$/u);
    if (!match) throw new Error(`Unknown argument: ${argument}`);
    if (values.has(match[1])) throw new Error(`Duplicate argument: --${match[1]}`);
    values.set(match[1], match[2]);
  }
  for (const name of values.keys()) {
    if (!["origin", "require-proxied", "timeout-ms"].includes(name)) {
      throw new Error(`Unknown argument: --${name}`);
    }
  }
  const requireValue = values.get("require-proxied") ?? "false";
  if (!["true", "false"].includes(requireValue)) {
    throw new Error("--require-proxied must be exactly true or false");
  }
  return {
    origin: values.get("origin") || PUBLIC_ORIGIN,
    requireProxied: requireValue === "true",
    timeoutMs: positiveInteger(
      values.get("timeout-ms"),
      DEFAULT_TIMEOUT_MS,
      "--timeout-ms"
    ),
  };
}

function summarize(result) {
  return [
    `Public origin: ${result.origin}`,
    `Probe status: HTTP ${result.status}`,
    `Cloudflare edge path: ${result.edgeTrafficProxied ? "active (CF-Ray present)" : "inactive (CF-Ray absent)"}`,
  ].join("\n");
}

async function main() {
  try {
    const cli = parseCliOptions(process.argv.slice(2));
    const result = await inspectCloudflareEdgeApplicability(cli);
    console.log(summarize(result));
    if (cli.requireProxied && !result.edgeTrafficProxied) {
      throw new Error(
        `${result.origin} is not traversing the Cloudflare edge. Response Header Transform Rules and other edge rules cannot be treated as active; refusing production apply before any Cloudflare API mutation.`
      );
    }
  } catch (error) {
    console.error(
      `Cloudflare edge applicability check failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) await main();
