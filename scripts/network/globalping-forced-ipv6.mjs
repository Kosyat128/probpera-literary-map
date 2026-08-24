import net from "node:net";
import { setTimeout as waitFor } from "node:timers/promises";
import {
  PUBLIC_CONTENT_SECURITY_POLICY,
  PUBLIC_SECURITY_HEADERS,
} from "../cloudflare/configure-edge-security.mjs";

const API_ORIGIN = "https://api.globalping.io/v1";
const RELEASE_HEAD_PATH = "/.well-known/probpera-release-head.json";
const STRICT_REDIRECT_STATUSES = new Set([301, 308]);
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DEFAULT_PROBES = 2;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_POLL_TIMEOUT_MS = 70_000;

function redact(value) {
  return String(value ?? "")
    .slice(0, 1_000)
    .replace(/\b(token|secret|password|api[_-]?key)\s*[=:]\s*[^\s&,;]+/giu, "$1=[REDACTED]")
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/giu, "[REDACTED]");
}

function canonicalIpv6(address) {
  if (net.isIP(address) !== 6) throw new Error(`External IPv6 target is invalid: ${address}`);
  return new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
}

function normalizedHeaders(headers = {}) {
  const result = {};
  for (const [name, value] of Object.entries(headers || {})) {
    result[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  }
  return result;
}

function normalizedLocation(headers, base) {
  const location = normalizedHeaders(headers).location || "";
  if (!location) return null;
  try {
    const url = new URL(location, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function validateGlobalpingCriticalHeaders(headersValue) {
  const headers = normalizedHeaders(headersValue);
  const errors = [];
  const normalizePolicy = (value) => String(value || "")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\s*;\s*/gu, "; ")
    .replace(/;\s*$/u, "");
  const expectedHeader = (name) => PUBLIC_SECURITY_HEADERS[name].value;
  if (normalizePolicy(headers["strict-transport-security"]) !==
      normalizePolicy(expectedHeader("Strict-Transport-Security"))) errors.push("hsts");
  if ((headers["x-content-type-options"] || "").toLowerCase() !== "nosniff") errors.push("nosniff");
  if ((headers["referrer-policy"] || "").toLowerCase() !==
      expectedHeader("Referrer-Policy").toLowerCase()) errors.push("referrer-policy");
  const normalizePermissions = (value) => String(value || "").toLowerCase()
    .split(",").map((item) => item.trim()).filter(Boolean).join(", ");
  if (normalizePermissions(headers["permissions-policy"]) !==
      normalizePermissions(expectedHeader("Permissions-Policy"))) errors.push("permissions-policy");
  if ((headers["cross-origin-opener-policy"] || "").toLowerCase() !==
      expectedHeader("Cross-Origin-Opener-Policy").toLowerCase()) errors.push("coop");
  if (normalizePolicy(headers["content-security-policy"]) !==
      normalizePolicy(PUBLIC_CONTENT_SECURITY_POLICY)) errors.push("csp");
  return errors;
}

function jobsForAddress(apexHost, address) {
  const wwwHost = `www.${apexHost}`;
  return [
    {
      id: `${address}/apex/https-release`,
      address,
      host: apexHost,
      role: "apex",
      check: "https-release",
      protocol: "HTTP2",
      port: 443,
      path: RELEASE_HEAD_PATH,
    },
    {
      id: `${address}/apex/http-root`,
      address,
      host: apexHost,
      role: "apex",
      check: "http-root",
      protocol: "HTTP",
      port: 80,
      path: "/",
    },
    {
      id: `${address}/www/https-root`,
      address,
      host: wwwHost,
      role: "www",
      check: "https-root",
      protocol: "HTTP2",
      port: 443,
      path: "/",
    },
    {
      id: `${address}/www/https-release`,
      address,
      host: wwwHost,
      role: "www",
      check: "https-release",
      protocol: "HTTP2",
      port: 443,
      path: RELEASE_HEAD_PATH,
    },
    {
      id: `${address}/www/http-root`,
      address,
      host: wwwHost,
      role: "www",
      check: "http-root",
      protocol: "HTTP",
      port: 80,
      path: "/",
    },
  ];
}

export function createGlobalpingForcedIpv6Request(job, probes = DEFAULT_PROBES) {
  const address = canonicalIpv6(job.address);
  if (!["HTTP", "HTTP2"].includes(job.protocol)) throw new Error("Unsupported Globalping protocol");
  if (!Number.isInteger(probes) || probes < 1 || probes > 2) {
    throw new Error("External IPv6 proof probes must be 1 or 2");
  }
  return {
    type: "http",
    target: address,
    locations: [{ magic: "datacenter", limit: probes }],
    timeout: 30,
    measurementOptions: {
      protocol: job.protocol,
      port: job.port,
      request: {
        method: "GET",
        path: job.path,
        host: job.host,
        headers: {
          accept: job.check === "https-release" ? "application/json" : "text/html,*/*;q=0.1",
          "cache-control": "no-cache",
        },
      },
    },
  };
}

async function responseJson(response, operation) {
  if (!response?.ok) throw new Error(`${operation} failed with HTTP ${response?.status || 0}`);
  return response.json();
}

export async function runGlobalpingForcedMeasurement(job, {
  fetchImpl = fetch,
  sleepImpl = waitFor,
  probes = DEFAULT_PROBES,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
} = {}) {
  const request = createGlobalpingForcedIpv6Request(job, probes);
  const createResponse = await fetchImpl(`${API_ORIGIN}/measurements`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "ProbPeraConnectivityAudit/1.0 (+https://probpera.ru)",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(15_000),
  });
  const created = await responseJson(createResponse, "Globalping measurement creation");
  if (!/^[A-Za-z0-9_-]{8,160}$/u.test(String(created?.id || "")) ||
      !Number.isInteger(created?.probesCount) || created.probesCount < 1) {
    throw new Error("Globalping returned an invalid creation response");
  }
  const deadline = Date.now() + pollTimeoutMs;
  let etag = null;
  while (Date.now() < deadline) {
    const readResponse = await fetchImpl(`${API_ORIGIN}/measurements/${created.id}`, {
      headers: {
        accept: "application/json",
        ...(etag ? { "if-none-match": etag } : {}),
        "user-agent": "ProbPeraConnectivityAudit/1.0 (+https://probpera.ru)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (readResponse.status === 304) {
      await sleepImpl(pollIntervalMs);
      continue;
    }
    const measurement = await responseJson(readResponse, "Globalping measurement read");
    etag = readResponse.headers?.get?.("etag") || null;
    if (measurement.status !== "in-progress") {
      return {
        ...measurement,
        id: measurement.id || created.id,
        createdProbesCount: created.probesCount,
        request,
      };
    }
    await sleepImpl(pollIntervalMs);
  }
  throw new Error(`Globalping measurement ${created.id} did not finish before timeout`);
}

function probeEvidence(probe = {}) {
  const tags = Array.isArray(probe.tags)
    ? [...new Set(probe.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].sort()
    : [];
  return {
    country: typeof probe.country === "string" ? probe.country : probe.country?.code || null,
    city: probe.city || null,
    asn: Number.isInteger(probe.asn) ? probe.asn : null,
    network: typeof probe.network === "string" ? probe.network : null,
    tags,
    datacenterNetwork: tags.includes("datacenter-network"),
  };
}

function parseReleaseSha(body) {
  try {
    const value = JSON.parse(String(body || ""));
    const sha = String(value?.commitSha || "").trim().toLowerCase();
    return SHA_PATTERN.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

function expectedResponse(job, result, expectedReleaseSha, apexHost) {
  const base = `${job.protocol === "HTTP" ? "http" : "https"}://${job.host}${job.path}`;
  const location = normalizedLocation(result.headers, base);
  const criticalHeaderErrors = job.protocol === "HTTP2"
    ? validateGlobalpingCriticalHeaders(result.headers)
    : [];
  const releaseSha = parseReleaseSha(result.rawBody);
  let responseValid = false;
  let expectedLocations = [];
  let releaseProofMode = null;
  if (job.role === "apex" && job.check === "https-release") {
    responseValid = result.statusCode === 200 && result.truncated === false &&
      releaseSha === expectedReleaseSha;
    releaseProofMode = responseValid ? "body" : null;
  } else if (job.role === "apex" && job.check === "http-root") {
    expectedLocations = [`https://${apexHost}/`];
    responseValid = STRICT_REDIRECT_STATUSES.has(result.statusCode) && expectedLocations.includes(location);
  } else if (job.role === "www" && job.check === "https-root") {
    expectedLocations = [`https://${apexHost}/`];
    responseValid = STRICT_REDIRECT_STATUSES.has(result.statusCode) && expectedLocations.includes(location);
  } else if (job.role === "www" && job.check === "https-release") {
    expectedLocations = [`https://${apexHost}${RELEASE_HEAD_PATH}`];
    const redirectProof = STRICT_REDIRECT_STATUSES.has(result.statusCode) && expectedLocations.includes(location);
    const bodyProof = result.statusCode === 200 && result.truncated === false && releaseSha === expectedReleaseSha;
    responseValid = redirectProof || bodyProof;
    releaseProofMode = bodyProof ? "body" : redirectProof ? "redirect-to-verified-apex" : null;
  } else if (job.role === "www" && job.check === "http-root") {
    expectedLocations = [`https://${job.host}/`, `https://${apexHost}/`];
    responseValid = STRICT_REDIRECT_STATUSES.has(result.statusCode) && expectedLocations.includes(location);
  }
  return {
    responseValid,
    location,
    expectedLocations,
    releaseSha,
    releaseProofMode,
    criticalHeaderErrors,
  };
}

export function summarizeGlobalpingForcedMeasurement(measurement, job, expectedReleaseSha, apexHost) {
  const expectedAddress = canonicalIpv6(job.address);
  const createdProbesCount = Number.isInteger(measurement?.createdProbesCount)
    ? measurement.createdProbesCount
    : Number.isInteger(measurement?.probesCount) ? measurement.probesCount : null;
  const results = Array.isArray(measurement?.results) ? measurement.results : [];
  const requestMatches = measurement?.request
    ? measurement.request.target === expectedAddress &&
      measurement.request.measurementOptions?.protocol === job.protocol &&
      measurement.request.measurementOptions?.port === job.port &&
      measurement.request.measurementOptions?.request?.host === job.host &&
      measurement.request.measurementOptions?.request?.path === job.path
    : true;
  const compactResults = results.map(({ probe = {}, result = {} }) => {
    const probeDetails = probeEvidence(probe);
    const response = expectedResponse(job, result, expectedReleaseSha, apexHost);
    let resolvedAddress = null;
    try {
      resolvedAddress = canonicalIpv6(result.resolvedAddress);
    } catch {
      // The failed exact-target check below records an invalid address safely.
    }
    const tlsAuthorized = job.protocol === "HTTP2" ? result.tls?.authorized === true : null;
    const targetVerified = resolvedAddress === expectedAddress;
    const http2Verified = job.protocol === "HTTP2" && result.status === "finished";
    const passed = result.status === "finished" &&
      probeDetails.datacenterNetwork &&
      targetVerified &&
      response.responseValid &&
      (job.protocol !== "HTTP2" || (
        tlsAuthorized && http2Verified && response.criticalHeaderErrors.length === 0
      ));
    return {
      ...probeDetails,
      status: result.status || "unknown",
      statusCode: Number.isInteger(result.statusCode) ? result.statusCode : null,
      resolvedAddress,
      targetVerified,
      requestHost: job.host,
      tlsAuthorized,
      tlsError: result.tls?.error ? redact(result.tls.error) : null,
      certificateSubjectCommonName: result.tls?.subject?.CN || null,
      certificateAltNames: result.tls?.subject?.alt || null,
      certificateFingerprint256: result.tls?.fingerprint256 || null,
      requestedProtocol: job.protocol,
      http2Verified,
      criticalHeadersValid: response.criticalHeaderErrors.length === 0,
      criticalHeaderErrors: response.criticalHeaderErrors,
      location: response.location,
      releaseSha: response.releaseSha,
      releaseProofMode: response.releaseProofMode,
      passed,
    };
  });
  const coverageValid = measurement?.status === "finished" &&
    requestMatches &&
    createdProbesCount !== null && createdProbesCount >= 1 &&
    results.length === createdProbesCount;
  const passed = coverageValid && compactResults.length > 0 && compactResults.every((result) => result.passed);
  const reasons = [];
  if (measurement?.status !== "finished") reasons.push("measurement_not_finished");
  if (!requestMatches) reasons.push("measurement_request_mismatch");
  if (createdProbesCount === null || createdProbesCount < 1) reasons.push("no_datacenter_probes_created");
  if (createdProbesCount !== null && results.length !== createdProbesCount) reasons.push("incomplete_probe_results");
  if (compactResults.some((result) => !result.datacenterNetwork)) reasons.push("non_datacenter_probe_result");
  if (compactResults.some((result) => !result.targetVerified)) reasons.push("forced_target_mismatch");
  if (job.protocol === "HTTP2" && compactResults.some((result) => !result.tlsAuthorized)) {
    reasons.push("direct_tls_not_ready");
  }
  if (job.protocol === "HTTP2" && compactResults.some((result) => !result.http2Verified)) {
    reasons.push("http2_not_verified");
  }
  if (job.protocol === "HTTP2" && compactResults.some((result) => !result.criticalHeadersValid)) {
    reasons.push("critical_security_headers_invalid");
  }
  if (compactResults.some((result) => !result.passed) && !reasons.length) reasons.push("forced_response_invalid");
  return {
    id: measurement?.id || null,
    url: measurement?.id ? `https://globalping.io?measurement=${measurement.id}` : null,
    jobId: job.id,
    target: expectedAddress,
    host: job.host,
    role: job.role,
    check: job.check,
    protocol: job.protocol,
    port: job.port,
    path: job.path,
    requestedProbes: measurement?.request?.locations?.[0]?.limit || DEFAULT_PROBES,
    createdProbesCount,
    resultsCount: compactResults.length,
    status: passed ? "passed" : "failed",
    reasons: [...new Set(reasons)],
    results: compactResults,
  };
}

function failedMeasurement(job, error) {
  return {
    id: null,
    url: null,
    jobId: job.id,
    target: job.address,
    host: job.host,
    role: job.role,
    check: job.check,
    protocol: job.protocol,
    port: job.port,
    path: job.path,
    requestedProbes: DEFAULT_PROBES,
    createdProbesCount: null,
    resultsCount: 0,
    status: "failed",
    reasons: ["globalping_request_failed"],
    error: redact(error instanceof Error ? error.message : error),
    results: [],
  };
}

function measurementFor(measurements, address, role, check) {
  return measurements.find((measurement) =>
    measurement.target === address && measurement.role === role && measurement.check === check
  );
}

export async function auditExternalIpv6Origin({
  host,
  ipv6Addresses,
  expectedReleaseSha,
  probes = DEFAULT_PROBES,
}, dependencies = {}) {
  const addresses = [...new Set((ipv6Addresses || []).map(canonicalIpv6))];
  const expectedSha = String(expectedReleaseSha || "").trim().toLowerCase();
  if (!SHA_PATTERN.test(expectedSha)) {
    return {
      schema: "probpera-external-ipv6-origin-proof/v1",
      provider: "globalping",
      status: "failed",
      requiredOk: false,
      reason: "expected_release_sha_required",
      addressesRequired: addresses,
      measurements: [],
      addresses: {},
    };
  }
  const jobs = addresses.flatMap((address) => jobsForAddress(host, address));
  const runMeasurementImpl = dependencies.runMeasurementImpl || runGlobalpingForcedMeasurement;
  const measurements = await Promise.all(jobs.map(async (job) => {
    try {
      const measurement = await runMeasurementImpl(job, {
        ...dependencies,
        probes,
      });
      return summarizeGlobalpingForcedMeasurement(measurement, job, expectedSha, host);
    } catch (error) {
      return failedMeasurement(job, error);
    }
  }));
  const addressEvidence = {};
  for (const address of addresses) {
    const apexHttps = measurementFor(measurements, address, "apex", "https-release");
    const apexHttp = measurementFor(measurements, address, "apex", "http-root");
    const wwwHttps = measurementFor(measurements, address, "www", "https-root");
    const wwwRelease = measurementFor(measurements, address, "www", "https-release");
    const wwwHttp = measurementFor(measurements, address, "www", "http-root");
    const apexReleaseSha = apexHttps?.results.length &&
      apexHttps.results.every((result) => result.releaseSha === expectedSha)
      ? expectedSha
      : null;
    const wwwReleaseModes = wwwRelease?.results.map((result) => result.releaseProofMode) || [];
    const wwwReleaseVerified = wwwRelease?.status === "passed" && wwwReleaseModes.length > 0 &&
      wwwReleaseModes.every((mode) => mode === "body" || mode === "redirect-to-verified-apex") &&
      apexReleaseSha === expectedSha;
    const apexPassed = apexHttps?.status === "passed" && apexHttp?.status === "passed";
    const wwwPassed = wwwHttps?.status === "passed" && wwwReleaseVerified && wwwHttp?.status === "passed";
    addressEvidence[address] = {
      apex: {
        host,
        status: apexPassed ? "passed" : "failed",
        certificateValid: apexHttps?.results.length > 0 && apexHttps.results.every((result) => result.tlsAuthorized),
        hostnameVerified: apexHttps?.results.length > 0 && apexHttps.results.every((result) =>
          result.tlsAuthorized && result.requestHost === host
        ),
        http2Verified: apexHttps?.results.length > 0 && apexHttps.results.every((result) => result.http2Verified),
        criticalHeadersValid: apexHttps?.results.length > 0 &&
          apexHttps.results.every((result) => result.criticalHeadersValid),
        httpStatus: apexHttps?.results[0]?.statusCode ?? null,
        releaseSha: apexReleaseSha,
        httpRedirectTo: apexHttp?.results[0]?.location || null,
        measurements: [apexHttps?.id, apexHttp?.id].filter(Boolean),
      },
      www: {
        host: `www.${host}`,
        status: wwwPassed ? "passed" : "failed",
        certificateValid: [wwwHttps, wwwRelease].every((measurement) =>
          measurement?.results.length > 0 && measurement.results.every((result) => result.tlsAuthorized)
        ),
        hostnameVerified: [wwwHttps, wwwRelease].every((measurement) =>
          measurement?.results.length > 0 && measurement.results.every((result) =>
            result.tlsAuthorized && result.requestHost === `www.${host}`
          )
        ),
        http2Verified: [wwwHttps, wwwRelease].every((measurement) =>
          measurement?.results.length > 0 && measurement.results.every((result) => result.http2Verified)
        ),
        criticalHeadersValid: [wwwHttps, wwwRelease].every((measurement) =>
          measurement?.results.length > 0 && measurement.results.every((result) => result.criticalHeadersValid)
        ),
        httpStatus: wwwHttps?.results[0]?.statusCode ?? null,
        redirectTo: wwwHttps?.results[0]?.location || null,
        releaseSha: wwwReleaseVerified ? expectedSha : null,
        releaseProofModes: [...new Set(wwwReleaseModes)].sort(),
        httpRedirectTo: wwwHttp?.results[0]?.location || null,
        measurements: [wwwHttps?.id, wwwRelease?.id, wwwHttp?.id].filter(Boolean),
      },
    };
  }
  const transportReady = addresses.length > 0 &&
    measurements.length === addresses.length * 5 &&
    measurements.every((measurement) => measurement.status === "passed") &&
    Object.values(addressEvidence).every((entry) =>
      entry.apex.status === "passed" && entry.www.status === "passed"
    );
  // Globalping currently proves forced-target TLS, HTTP/2, redirects, headers,
  // and the release SHA. It does not download and bind the representative
  // HTML, CMS, PWA, and static-asset hashes checked on local IPv4 routes.
  // Therefore it is diagnostic evidence only and cannot substitute for a
  // dual-stack runner in a production DNS mutation gate.
  const requiredOk = false;
  return {
    schema: "probpera-external-ipv6-origin-proof/v1",
    provider: "globalping",
    status: "failed",
    requiredOk,
    transportReady,
    contentIntegrityBound: false,
    reason: transportReady ? "external_ipv6_content_integrity_unbound" : measurements.some((measurement) =>
      measurement.reasons.includes("direct_tls_not_ready")
    ) ? "direct_tls_not_ready" : "external_ipv6_proof_failed",
    expectedReleaseSha: expectedSha,
    addressesRequired: addresses,
    addresses: addressEvidence,
    measurements,
  };
}
