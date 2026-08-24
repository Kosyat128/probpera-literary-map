import path from "node:path";
import { pathToFileURL } from "node:url";

const apiOrigin = "https://api.globalping.io/v1";
const releaseHeadPath = "/.well-known/probpera-release-head.json";
const commitShaPattern = /^[0-9a-f]{40}$/u;
const officialPagesAddresses = new Set([
  "185.199.108.153",
  "185.199.109.153",
  "185.199.110.153",
  "185.199.111.153",
  "2606:50c0:8000::153",
  "2606:50c0:8001::153",
  "2606:50c0:8002::153",
  "2606:50c0:8003::153",
]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseInteger(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

export function parseArguments(argv = process.argv.slice(2), environment = process.env) {
  const options = {
    host: environment.PROBPERA_AUDIT_HOST || "probpera.ru",
    ipVersions: [4, 6],
    limit: 10,
    expectedRoute: environment.PROBPERA_EXPECTED_RU_ROUTE || "cloudflare",
    expectedReleaseSha: environment.EXPECTED_RELEASE_SHA || "",
    maxTotalMs: 5_000,
    minimumSuccessRatio: 1,
    pollIntervalMs: 2_000,
    pollTimeoutMs: 60_000,
    json: false,
  };

  for (const argument of argv) {
    if (argument === "--json") options.json = true;
    else if (argument.startsWith("--host=")) options.host = argument.slice(7);
    else if (argument.startsWith("--ip-version=")) {
      const value = argument.slice(13);
      if (value === "both") options.ipVersions = [4, 6];
      else if (value === "4" || value === "6") options.ipVersions = [Number(value)];
      else throw new Error("--ip-version must be 4, 6, or both");
    } else if (argument.startsWith("--limit=")) {
      options.limit = parseInteger(argument.slice(8), "--limit", 1, 25);
    } else if (argument.startsWith("--expected-route=")) {
      options.expectedRoute = argument.slice(17);
    } else if (argument.startsWith("--release-sha=")) {
      options.expectedReleaseSha = argument.slice(14);
    } else if (argument.startsWith("--max-total-ms=")) {
      options.maxTotalMs = parseInteger(argument.slice(15), "--max-total-ms", 250, 30_000);
    } else if (argument.startsWith("--minimum-success-ratio=")) {
      const ratio = Number(argument.slice(24));
      if (ratio !== 1) {
        throw new Error("--minimum-success-ratio must be 1 for fail-closed health");
      }
      options.minimumSuccessRatio = ratio;
    } else if (argument.startsWith("--poll-interval-ms=")) {
      options.pollIntervalMs = parseInteger(
        argument.slice(19),
        "--poll-interval-ms",
        100,
        10_000
      );
    } else if (argument.startsWith("--poll-timeout-ms=")) {
      options.pollTimeoutMs = parseInteger(
        argument.slice(18),
        "--poll-timeout-ms",
        5_000,
        180_000
      );
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu.test(options.host)) {
    throw new Error("--host must be a DNS hostname");
  }
  if (!['cloudflare', 'direct', 'either'].includes(options.expectedRoute)) {
    throw new Error("--expected-route must be cloudflare, direct, or either");
  }
  options.expectedReleaseSha = String(options.expectedReleaseSha || "").trim().toLowerCase();
  if (!commitShaPattern.test(options.expectedReleaseSha)) {
    throw new Error("--release-sha or EXPECTED_RELEASE_SHA must be an exact 40-character commit SHA");
  }
  if (options.ipVersions.length * options.limit * 2 > 50) {
    throw new Error("anonymous Globalping runs are limited to 50 total probes");
  }
  return options;
}

export function createMeasurementRequest(options, ipVersion, requestPath = "/") {
  if (!["/", releaseHeadPath].includes(requestPath)) {
    throw new Error("Russian probe request path is unsupported");
  }
  return {
    type: "http",
    target: options.host,
    locations: [
      {
        country: "RU",
        tags: ["eyeball-network"],
        limit: options.limit,
      },
    ],
    timeout: 30,
    measurementOptions: {
      protocol: "HTTPS",
      port: 443,
      ipVersion,
      request: {
        method: "GET",
        path: requestPath,
        headers: {
          accept: requestPath === releaseHeadPath ? "application/json" : "text/html,*/*;q=0.1",
          "cache-control": "no-cache",
        },
      },
    },
  };
}

async function readJson(response, operation) {
  if (!response.ok) {
    throw new Error(`${operation} failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function runMeasurement(
  options,
  ipVersion,
  requestPath = "/",
  dependencies = {}
) {
  if (requestPath && typeof requestPath === "object") {
    dependencies = requestPath;
    requestPath = "/";
  }
  const { fetchImpl = fetch, sleep = delay } = dependencies;
  const createResponse = await fetchImpl(`${apiOrigin}/measurements`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "probpera-ru-connectivity-audit/1",
    },
    body: JSON.stringify(createMeasurementRequest(options, ipVersion, requestPath)),
  });
  const created = await readJson(createResponse, "Globalping measurement creation");
  if (!created.id || !Number.isInteger(created.probesCount)) {
    throw new Error("Globalping returned an invalid creation response");
  }

  const deadline = Date.now() + options.pollTimeoutMs;
  while (Date.now() < deadline) {
    const resultResponse = await fetchImpl(`${apiOrigin}/measurements/${created.id}`, {
      headers: { "user-agent": "probpera-ru-connectivity-audit/1" },
    });
    const measurement = await readJson(resultResponse, "Globalping measurement read");
    if (measurement.status !== "in-progress") {
      return {
        ...measurement,
        createdProbesCount: created.probesCount,
        requestedProbesCount: options.limit,
        requestPath,
      };
    }
    await sleep(options.pollIntervalMs);
  }
  throw new Error(`Globalping measurement ${created.id} did not finish before timeout`);
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)];
}

function normalizedHeader(headers, name) {
  const entry = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  if (!entry) return "";
  return Array.isArray(entry[1]) ? entry[1].join(", ") : String(entry[1]);
}

function routeFor(result) {
  const server = normalizedHeader(result.headers, "server").toLowerCase();
  const cfRay = normalizedHeader(result.headers, "cf-ray");
  if (server.includes("cloudflare") || cfRay) return "cloudflare";
  if (
    officialPagesAddresses.has(String(result.resolvedAddress || "").toLowerCase()) &&
    server.toLowerCase().includes("github")
  ) {
    return "direct";
  }
  return "unknown";
}

function releaseShaFromResult(result) {
  if (result.truncated !== false) return null;
  try {
    const parsed = JSON.parse(String(result.rawBody || ""));
    const sha = String(parsed?.commitSha || "").trim().toLowerCase();
    return commitShaPattern.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

function probeCountry(probe) {
  const value = probe.countryCode ?? probe.country?.code ?? probe.country;
  return typeof value === "string" ? value.trim().toUpperCase() : null;
}

function probeTags(probe) {
  const values = Array.isArray(probe.tags)
    ? probe.tags
    : typeof probe.tags === "string"
      ? probe.tags.split(",")
      : [];
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))].sort();
}

function eligibleRussianEyeballProbe(probe) {
  const country = probeCountry(probe);
  const tags = probeTags(probe);
  const network = typeof probe.network === "string" ? probe.network.trim() : "";
  const asn = Number.isInteger(probe.asn) && probe.asn > 0 ? probe.asn : null;
  const explicitEyeballTag = tags.includes("eyeball-network");
  // Some Globalping result payloads omit the selection tags. In that API
  // variant, an ASN plus named provider is the returned eyeball context.
  const providerContext = tags.length === 0 && Boolean(network) && asn !== null;
  return {
    country,
    tags,
    countryValid: country === "RU",
    eyeballContextValid: explicitEyeballTag || providerContext,
  };
}

export function summarizeMeasurement(measurement, options, ipVersion) {
  const requestPath = measurement.requestPath || "/";
  const releaseHeadMeasurement = requestPath === releaseHeadPath;
  const compactResults = (measurement.results || []).map(({ probe = {}, result = {} }) => {
    const probeEligibility = eligibleRussianEyeballProbe(probe);
    const route = routeFor(result);
    const totalMs = Number.isFinite(result.timings?.total) ? result.timings.total : null;
    const releaseSha = releaseHeadMeasurement ? releaseShaFromResult(result) : null;
    const releaseShaMatches = !releaseHeadMeasurement || releaseSha === options.expectedReleaseSha;
    const passed =
      result.status === "finished" &&
      result.statusCode === 200 &&
      result.tls?.authorized === true &&
      totalMs !== null &&
      totalMs <= options.maxTotalMs &&
      probeEligibility.countryValid &&
      probeEligibility.eyeballContextValid &&
      releaseShaMatches &&
      (options.expectedRoute === "either" || route === options.expectedRoute);
    return {
      country: probeEligibility.country,
      city: probe.city || null,
      asn: Number.isInteger(probe.asn) ? probe.asn : null,
      network: probe.network || null,
      tags: probeEligibility.tags,
      countryValid: probeEligibility.countryValid,
      eyeballContextValid: probeEligibility.eyeballContextValid,
      status: result.status || "unknown",
      statusCode: result.statusCode ?? null,
      totalMs,
      resolvedAddress: result.resolvedAddress || null,
      tlsAuthorized: result.tls?.authorized === true,
      route,
      releaseSha,
      releaseShaMatches,
      passed,
    };
  });

  const passed = compactResults.filter((result) => result.passed).length;
  const totals = compactResults
    .map((result) => result.totalMs)
    .filter((value) => Number.isFinite(value));
  const cities = [...new Set(compactResults.map((result) => result.city).filter(Boolean))].sort();
  const networks = [
    ...new Set(compactResults.map((result) => result.network).filter(Boolean)),
  ].sort();
  const asns = [
    ...new Set(compactResults.map((result) => result.asn).filter(Number.isInteger)),
  ].sort((left, right) => left - right);
  const ratio = compactResults.length ? passed / compactResults.length : 0;
  const p50TotalMs = percentile(totals, 0.5);
  const p95TotalMs = percentile(totals, 0.95);
  const requestedProbes = Number.isInteger(measurement.requestedProbesCount)
    ? measurement.requestedProbesCount
    : options.limit;
  const createdProbes = Number.isInteger(measurement.createdProbesCount)
    ? measurement.createdProbesCount
    : null;
  const minimumRequiredProbes = ipVersion === 4 ? 5 : 3;
  const creationCountKnown = createdProbes !== null;
  const createdMeetsMinimum = creationCountKnown && createdProbes >= minimumRequiredProbes;
  const resultsMatchCreated = creationCountKnown && compactResults.length === createdProbes;
  const allRussian = compactResults.length > 0 && compactResults.every((result) => result.countryValid);
  const allEyeball = compactResults.length > 0 &&
    compactResults.every((result) => result.eyeballContextValid);
  const coverageComplete = createdMeetsMinimum && resultsMatchCreated && allRussian && allEyeball;
  const inconclusiveReasons = [];
  if (!creationCountKnown) inconclusiveReasons.push("creation_count_missing");
  if (creationCountKnown && !createdMeetsMinimum) inconclusiveReasons.push("created_probe_minimum_unmet");
  if (creationCountKnown && !resultsMatchCreated) inconclusiveReasons.push("incomplete_probe_results");
  if (!allRussian) inconclusiveReasons.push("non_russian_probe_results");
  if (!allEyeball) inconclusiveReasons.push("non_eyeball_probe_results");
  if (measurement.status !== "finished") inconclusiveReasons.push("measurement_not_finished");

  return {
    id: measurement.id,
    url: `https://globalping.io?measurement=${measurement.id}`,
    ipVersion,
    kind: releaseHeadMeasurement ? "release-head" : "root",
    requestPath,
    status: measurement.status,
    probesCount: compactResults.length,
    requestedProbesCount: requestedProbes,
    createdProbesCount: createdProbes,
    passed,
    failed: compactResults.length - passed,
    successRatio: ratio,
    p50TotalMs,
    p95TotalMs,
    coverage: {
      cities,
      asns,
      networks,
      hasMoscow: cities.some((city) => /^moscow$/iu.test(city)),
      hasSaintPetersburg: cities.some((city) => /^(?:saint|st\.?)[ -]petersburg$/iu.test(city)),
      minimumRequiredProbes,
      creationCountKnown,
      createdMeetsMinimum,
      resultsMatchCreated,
      allRussian,
      allEyeball,
      complete: coverageComplete,
    },
    inconclusiveReasons,
    healthPassed:
      measurement.status === "finished" &&
      coverageComplete &&
      ratio === 1 &&
      p95TotalMs !== null && p95TotalMs <= options.maxTotalMs,
    results: compactResults,
  };
}

export async function auditRussianProbes(
  options,
  dependencies = {}
) {
  const measurements = [];
  for (const ipVersion of options.ipVersions) {
    for (const requestPath of ["/", releaseHeadPath]) {
      const raw = await runMeasurement(options, ipVersion, requestPath, dependencies);
      measurements.push(summarizeMeasurement(raw, options, ipVersion));
    }
  }

  const allHealthy = measurements.every((measurement) => measurement.healthPassed);
  const allConclusive = measurements.every((measurement) =>
    measurement.status === "finished" && measurement.coverage.complete
  );
  const cities = new Set(measurements.flatMap((measurement) => measurement.coverage.cities));
  const networks = new Set(
    measurements.flatMap((measurement) => measurement.coverage.networks)
  );
  return {
    status: allHealthy ? "passed" : allConclusive ? "failed" : "inconclusive",
    target: options.host,
    expectedRoute: options.expectedRoute,
    expectedReleaseSha: options.expectedReleaseSha,
    measuredAt: new Date().toISOString(),
    measurements,
    coverage: {
      cities: [...cities].sort(),
      networks: [...networks].sort(),
      ipv4: measurements.some((measurement) => measurement.ipVersion === 4),
      ipv6: measurements.some((measurement) => measurement.ipVersion === 6),
    },
    contentIntegrity: {
      scope: "root-health-and-exact-release-head",
      releaseHeadPath,
      releaseHeadVerified: options.ipVersions.every((ipVersion) => measurements.some((measurement) =>
        measurement.ipVersion === ipVersion &&
        measurement.kind === "release-head" &&
        measurement.healthPassed
      )),
      fullAssetParityVerified: false,
    },
    russiaConfirmation: "requires_final_isp_test",
    confirmationReason:
      "Globalping eyeball probes do not prove that a probe is on a mobile access link; final Moscow, Saint Petersburg, mobile-ASN, and fixed-ISP production tests are required.",
  };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArguments(argv);
  const summary = await auditRussianProbes(options, dependencies);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== "passed") process.exitCode = 1;
  return summary;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    await main();
  } catch (error) {
    console.error(
      JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : String(error) })
    );
    process.exitCode = 1;
  }
}
