import assert from "node:assert/strict";
import test from "node:test";
import {
  auditRussianProbes,
  createMeasurementRequest,
  parseArguments,
  runMeasurement,
  summarizeMeasurement,
} from "./audit-russian-probes.mjs";

const RELEASE_SHA = "1234567890abcdef1234567890abcdef12345678";

function options(...arguments_) {
  return parseArguments(arguments_, { EXPECTED_RELEASE_SHA: RELEASE_SHA });
}

function resultItem({
  address = "172.67.161.178",
  server = "cloudflare",
  total = 120,
  statusCode = 200,
  authorized = true,
  country = "RU",
  tags = ["eyeball-network"],
  rawBody = JSON.stringify({ commitSha: RELEASE_SHA }),
  truncated = false,
} = {}) {
  return {
    probe: {
      country,
      city: "Moscow",
      asn: 12345,
      network: "Example eyeball ISP",
      tags,
    },
    result: {
      status: "finished",
      statusCode,
      resolvedAddress: address,
      headers: { server, "cf-ray": server === "cloudflare" ? "example-SVO" : "" },
      timings: { total },
      tls: { authorized },
      rawBody,
      truncated,
      rawHeaders: "must not be copied",
    },
  };
}

test("request is restricted to Russian eyeball HTTPS probes", () => {
  const request = createMeasurementRequest(options("--limit=7"), 6);
  assert.equal(request.target, "probpera.ru");
  assert.deepEqual(request.locations, [
    { country: "RU", tags: ["eyeball-network"], limit: 7 },
  ]);
  assert.equal(request.measurementOptions.ipVersion, 6);
  assert.equal(request.measurementOptions.protocol, "HTTPS");
  assert.equal(request.measurementOptions.request.path, "/");
  const releaseRequest = createMeasurementRequest(options("--limit=7"), 6,
    "/.well-known/probpera-release-head.json");
  assert.equal(releaseRequest.measurementOptions.request.path,
    "/.well-known/probpera-release-head.json");
  assert.equal(releaseRequest.measurementOptions.request.headers.accept, "application/json");
});

test("summary requires TLS, latency, status, and expected route", () => {
  const measurement = {
    id: "measurement-id",
    status: "finished",
    requestedProbesCount: 10,
    createdProbesCount: 2,
    results: [resultItem(), resultItem({ total: 8_000 })],
  };
  const summary = summarizeMeasurement(measurement, options(), 4);
  assert.equal(summary.passed, 1);
  assert.equal(summary.healthPassed, false);
  assert.equal(summary.results[0].route, "cloudflare");
  assert.doesNotMatch(JSON.stringify(summary), /must not be copied/u);
});

test("release-head measurement is bound to the exact expected commit", () => {
  const base = {
    id: "release-measurement",
    status: "finished",
    requestPath: "/.well-known/probpera-release-head.json",
    requestedProbesCount: 10,
    createdProbesCount: 5,
    results: Array.from({ length: 5 }, () => resultItem()),
  };
  const matching = summarizeMeasurement(base, options(), 4);
  assert.equal(matching.kind, "release-head");
  assert.equal(matching.results.every((result) => result.releaseShaMatches), true);
  assert.equal(matching.healthPassed, true);

  const stale = structuredClone(base);
  stale.results[0].result.rawBody = JSON.stringify({ commitSha: "f".repeat(40) });
  const mismatching = summarizeMeasurement(stale, options(), 4);
  assert.equal(mismatching.results[0].releaseShaMatches, false);
  assert.equal(mismatching.successRatio, 0.8);
  assert.equal(mismatching.healthPassed, false);

  const truncated = structuredClone(base);
  truncated.results[0].result.truncated = true;
  assert.equal(summarizeMeasurement(truncated, options(), 4).healthPassed, false);
});

test("sparse result sets are inconclusive and cannot satisfy health", async () => {
  const configured = options("--ip-version=4", "--limit=3");
  const raw = {
    id: "sparse-measurement",
    status: "finished",
    requestedProbesCount: 3,
    createdProbesCount: 1,
    results: [resultItem()],
  };
  const summary = summarizeMeasurement(raw, configured, 4);
  assert.equal(summary.coverage.createdMeetsMinimum, false);
  assert.equal(summary.coverage.resultsMatchCreated, true);
  assert.equal(summary.coverage.complete, false);
  assert.equal(summary.healthPassed, false);
  assert.deepEqual(summary.inconclusiveReasons, ["created_probe_minimum_unmet"]);

  const overall = await auditRussianProbes(configured, {
    fetchImpl: async (url, request = {}) => {
      if (request.method === "POST") {
        return new Response(JSON.stringify({ id: "sparse-measurement", probesCount: 1 }), { status: 202 });
      }
      return new Response(JSON.stringify(raw), { status: 200 });
    },
    sleep: async () => {},
  });
  assert.equal(overall.status, "inconclusive");
});

test("wrong-country and explicitly wrong-tag probes fail closed", () => {
  const measurement = {
    id: "wrong-probes",
    status: "finished",
    requestedProbesCount: 2,
    createdProbesCount: 2,
    results: [
      resultItem({ country: "US" }),
      resultItem({ tags: ["datacenter-network"] }),
    ],
  };
  const summary = summarizeMeasurement(measurement, options("--limit=2"), 4);
  assert.equal(summary.results[0].countryValid, false);
  assert.equal(summary.results[1].eyeballContextValid, false);
  assert.equal(summary.results.every((result) => result.passed === false), true);
  assert.equal(summary.coverage.complete, false);
  assert.equal(summary.healthPassed, false);
  assert.deepEqual(summary.inconclusiveReasons, [
    "created_probe_minimum_unmet",
    "non_russian_probe_results",
    "non_eyeball_probe_results",
  ]);
});

test("best-effort IPv6 capacity is conclusive when all four created probes return", () => {
  const measurement = {
    id: "provider-context",
    status: "finished",
    requestedProbesCount: 10,
    createdProbesCount: 4,
    results: Array.from({ length: 4 }, () => resultItem({ tags: undefined })),
  };
  const summary = summarizeMeasurement(measurement, options("--limit=10"), 6);
  assert.equal(summary.results[0].eyeballContextValid, true);
  assert.equal(summary.coverage.minimumRequiredProbes, 3);
  assert.equal(summary.coverage.resultsMatchCreated, true);
  assert.equal(summary.coverage.complete, true);
  assert.equal(summary.healthPassed, true);
});

test("one failed or over-budget probe degrades an otherwise complete sample", () => {
  const measurement = {
    id: "selective-failure",
    status: "finished",
    requestedProbesCount: 10,
    createdProbesCount: 5,
    results: [
      resultItem(),
      resultItem(),
      resultItem(),
      resultItem(),
      resultItem({ total: 25_000 }),
    ],
  };
  const summary = summarizeMeasurement(measurement, options(), 4);
  assert.equal(summary.coverage.complete, true);
  assert.equal(summary.successRatio, 0.8);
  assert.equal(summary.p95TotalMs, 25_000);
  assert.equal(summary.healthPassed, false);
});

test("direct route is recognized only on official Pages IP without Cloudflare", () => {
  const measurement = {
    id: "direct-measurement",
    status: "finished",
    requestedProbesCount: 2,
    createdProbesCount: 2,
    results: [
      resultItem({ address: "185.199.108.153", server: "GitHub.com" }),
      resultItem({ address: "203.0.113.1", server: "GitHub.com" }),
    ],
  };
  const summary = summarizeMeasurement(
    measurement,
    options("--expected-route=direct"),
    4
  );
  assert.equal(summary.results[0].route, "direct");
  assert.equal(summary.results[0].passed, true);
  assert.equal(summary.results[1].route, "unknown");
  assert.equal(summary.results[1].passed, false);
});

test("measurement polling returns final API response", async () => {
  const responses = [
    new Response(JSON.stringify({ id: "abc", probesCount: 1 }), { status: 202 }),
    new Response(
      JSON.stringify({ id: "abc", status: "finished", results: [resultItem()] }),
      { status: 200 }
    ),
  ];
  const measurement = await runMeasurement(options("--ip-version=4"), 4, {
    fetchImpl: async () => responses.shift(),
    sleep: async () => {},
  });
  assert.equal(measurement.status, "finished");
});

test("unsafe or excessive CLI inputs fail closed", () => {
  assert.throws(() => options("--host=https://probpera.ru"), /DNS hostname/u);
  assert.throws(() => options("--limit=26"), /integer/u);
  assert.throws(() => options("--ip-version=both", "--limit=13"), /50 total probes/u);
  assert.throws(() => options("--expected-route=worker"), /expected-route/u);
  assert.throws(() => options("--minimum-success-ratio=0.8"), /must be 1/u);
  assert.throws(() => parseArguments([], {}), /exact 40-character commit SHA/u);
});
