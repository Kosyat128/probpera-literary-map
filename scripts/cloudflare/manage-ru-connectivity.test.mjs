import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ADMIN_HOST,
  CONNECTIVITY_AUDIT_SCHEMA,
  DIRECT_TLS_PROOF_SCHEMA_VERSION,
  GITHUB_PAGES_IPV4,
  GITHUB_PAGES_IPV6,
  PUBLIC_HOSTS,
  PUBLIC_ZONE_NAME,
  SNAPSHOT_SCHEMA,
  CloudflareClient,
  assertProofBoundToSnapshot,
  bindDirectTlsProofArtifact,
  confirmationFor,
  createSnapshotDocument,
  directBatchBody,
  manageRuConnectivity,
  normalizeIpAddress,
  parseCliOptions,
  planDirectChanges,
  planRollbackChanges,
  publicRecordsFingerprint,
  redactSensitive,
  rollbackBatchBody,
  sha256Fingerprint,
  stableConfiguration,
  stableStringify,
  unwrapDirectTlsProof,
  validateDirectTlsProof,
  validateDiscoveredZone,
  validateMutationGate,
  validateSnapshotDocument,
  writeSnapshotFile,
} from "./manage-ru-connectivity.mjs";

const accountId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const zoneId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const token = "cloudflare-test-token-never-print";
const expectedMainSha = "1234567890abcdef1234567890abcdef12345678";
const laterMainSha = "abcdef1234567890abcdef1234567890abcdef12";
const pagesHostname = "kosyat128.github.io";
const now = new Date("2026-08-24T12:00:00.000Z");
const renewalEvidenceContent = Buffer.from(
  "Synthetic manager-test evidence for a separately reviewed Pages renewal confirmation."
);

let nextRecordNumber = 1;

function recordId(number = nextRecordNumber++) {
  return number.toString(16).padStart(32, "0");
}

function dnsRecord(overrides = {}) {
  return {
    id: recordId(),
    type: "A",
    name: PUBLIC_ZONE_NAME,
    content: GITHUB_PAGES_IPV4[0],
    ttl: 1,
    proxiable: true,
    proxied: true,
    settings: { ipv4_only: false, ipv6_only: false },
    tags: [],
    comment: null,
    created_on: "2026-08-01T00:00:00.000Z",
    modified_on: "2026-08-01T00:00:00.000Z",
    meta: { auto_added: false },
    ...overrides,
  };
}

function productionRecords() {
  nextRecordNumber = 1;
  return [
    ...GITHUB_PAGES_IPV4.map((content) => dnsRecord({ content })),
    ...GITHUB_PAGES_IPV6.map((content) =>
      dnsRecord({ type: "AAAA", content })
    ),
    dnsRecord({
      type: "CNAME",
      name: `www.${PUBLIC_ZONE_NAME}`,
      content: `${pagesHostname}.`,
      settings: { flatten_cname: false },
    }),
    dnsRecord({
      type: "CAA",
      content: '0 issue "letsencrypt.org"',
      proxiable: false,
      proxied: false,
      ttl: 3600,
    }),
    dnsRecord({
      type: "MX",
      content: "mail.example.test",
      priority: 10,
      proxiable: false,
      proxied: false,
      ttl: 3600,
    }),
    dnsRecord({
      type: "TXT",
      content: "private-verification-value",
      proxiable: false,
      proxied: false,
      ttl: 3600,
    }),
    dnsRecord({
      type: "CNAME",
      name: ADMIN_HOST,
      content: "admin-project.pages.dev",
      proxied: true,
      settings: { flatten_cname: false },
    }),
    dnsRecord({
      type: "SRV",
      name: `_service._tcp.${PUBLIC_ZONE_NAME}`,
      content: "0 5 443 service.example.test",
      data: {
        priority: 0,
        weight: 5,
        port: 443,
        target: "service.example.test",
      },
      proxiable: false,
      proxied: false,
      ttl: 120,
    }),
    dnsRecord({
      type: "NS",
      name: `delegated.${PUBLIC_ZONE_NAME}`,
      content: "ns1.example.test",
      proxiable: false,
      proxied: false,
      ttl: 3600,
    }),
  ];
}

function zone(overrides = {}) {
  return {
    id: zoneId,
    name: PUBLIC_ZONE_NAME,
    status: "active",
    type: "full",
    paused: false,
    account: { id: accountId, name: "Production" },
    name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
    vanity_name_servers: [],
    ...overrides,
  };
}

function state(records = productionRecords(), overrides = {}) {
  return {
    zone: zone(),
    records,
    dnssec: {
      status: "active",
      algorithm: "13",
      digest_algorithm: "SHA256",
      digest: "snapshot-only-digest-value",
    },
    dnsSettings: {
      zone_mode: "standard",
      flatten_all_cnames: false,
      multi_provider: false,
      nameservers: { type: "cloudflare.standard" },
    },
    ...overrides,
  };
}

function passedProof(records = productionRecords(), overrides = {}) {
  const allPagesIps = [...GITHUB_PAGES_IPV4, ...GITHUB_PAGES_IPV6];
  return {
    schemaVersion: DIRECT_TLS_PROOF_SCHEMA_VERSION,
    status: "passed",
    proofEligible: true,
    expectedMainSha,
    pagesHostname,
    publicRecordsFingerprint: publicRecordsFingerprint(records),
    verifiedAt: "2026-08-24T11:45:00.000Z",
    expiresAt: "2026-08-24T12:30:00.000Z",
    hosts: {
      apex: {
        host: PUBLIC_ZONE_NAME,
        status: "passed",
        certificateValid: true,
        hostnameVerified: true,
        httpStatus: 200,
        rootContentLength: 9_100,
        contentPath: "/cms/published-content.json",
        contentLength: 20_000,
        largeContentLength: 20_000,
        representativeHtmlPath: "/stati/russkaya-literatura/test-article",
        representativeHtmlStatus: 200,
        representativeHtmlContentLength: 20_001,
        representativeHtmlSha256: "a".repeat(64),
        redirectManifestPath: "/redirects.generated.json",
        redirectManifestCount: 157,
        redirectManifestSha256: "b".repeat(64),
        legacyAliasPath: "/articles/test-legacy-alias",
        legacyAliasTarget:
          "https://probpera.ru/stati/russkaya-literatura/test-article",
        legacyAliasStatus: 308,
        legacyAliasMode: "redirect",
        legacyAliasSha256: "c".repeat(64),
        notFoundPath: "/.well-known/probpera-connectivity-audit-not-found",
        notFoundStatus: 404,
        notFoundCanonical: "https://probpera.ru/",
        notFoundSha256: "d".repeat(64),
        releaseSha: expectedMainSha,
        originIpsTested: allPagesIps,
        certSANs: [PUBLIC_ZONE_NAME, `www.${PUBLIC_ZONE_NAME}`],
        notAfter: "2026-11-01T00:00:00.000Z",
      },
      www: {
        host: `www.${PUBLIC_ZONE_NAME}`,
        status: "passed",
        certificateValid: true,
        hostnameVerified: true,
        httpStatus: 308,
        redirectTo: `https://${PUBLIC_ZONE_NAME}/`,
        contentLength: 0,
        releaseSha: expectedMainSha,
        originIpsTested: allPagesIps,
        certSANs: [PUBLIC_ZONE_NAME, `www.${PUBLIC_ZONE_NAME}`],
        notAfter: "2026-11-01T00:00:00.000Z",
      },
    },
    ...overrides,
  };
}

function externalIpv6DiagnosticWrapper(records = productionRecords()) {
  let sequence = 0;
  const measurements = [];
  const addresses = {};
  const jobs = [
    ["apex", "https-release", "HTTP2", 443, "/.well-known/probpera-release-head.json"],
    ["apex", "http-root", "HTTP", 80, "/"],
    ["www", "https-root", "HTTP2", 443, "/"],
    ["www", "https-release", "HTTP2", 443, "/.well-known/probpera-release-head.json"],
    ["www", "http-root", "HTTP", 80, "/"],
  ];
  for (const address of GITHUB_PAGES_IPV6) {
    const ids = { apex: [], www: [] };
    for (const [role, check, protocol, port, requestPath] of jobs) {
      sequence += 1;
      const id = `gp-proof-measurement-${String(sequence).padStart(2, "0")}`;
      const host = role === "apex" ? PUBLIC_ZONE_NAME : `www.${PUBLIC_ZONE_NAME}`;
      const release = check === "https-release";
      const location = check === "http-root" || check === "https-root"
        ? `https://${PUBLIC_ZONE_NAME}/`
        : null;
      const statusCode = release ? 200 : 308;
      ids[role].push(id);
      measurements.push({
        id,
        target: address,
        host,
        role,
        check,
        protocol,
        port,
        path: requestPath,
        createdProbesCount: 1,
        resultsCount: 1,
        status: "passed",
        reasons: [],
        results: [{
          passed: true,
          datacenterNetwork: true,
          targetVerified: true,
          resolvedAddress: address,
          requestHost: host,
          requestedProtocol: protocol,
          tlsAuthorized: protocol === "HTTP2" ? true : null,
          http2Verified: protocol === "HTTP2",
          criticalHeadersValid: true,
          statusCode,
          location,
          releaseSha: release ? expectedMainSha : null,
          releaseProofMode: release ? "body" : null,
        }],
      });
    }
    addresses[address] = {
      apex: {
        host: PUBLIC_ZONE_NAME,
        status: "passed",
        certificateValid: true,
        hostnameVerified: true,
        http2Verified: true,
        criticalHeadersValid: true,
        httpStatus: 200,
        releaseSha: expectedMainSha,
        httpRedirectTo: `https://${PUBLIC_ZONE_NAME}/`,
        measurements: ids.apex,
      },
      www: {
        host: `www.${PUBLIC_ZONE_NAME}`,
        status: "passed",
        certificateValid: true,
        hostnameVerified: true,
        http2Verified: true,
        criticalHeadersValid: true,
        httpStatus: 308,
        redirectTo: `https://${PUBLIC_ZONE_NAME}/`,
        releaseSha: expectedMainSha,
        httpRedirectTo: `https://${PUBLIC_ZONE_NAME}/`,
        measurements: ids.www,
      },
    };
  }
  const marker = {
    provider: "globalping",
    status: "passed",
    requiredOk: true,
    addressesRequired: [...GITHUB_PAGES_IPV6],
    measurementIds: measurements.map(({ id }) => id),
  };
  return {
    schema: CONNECTIVITY_AUDIT_SCHEMA,
    requiredOk: true,
    directTlsReady: true,
    proof: passedProof(records, { externalIpv6Proof: marker }),
    externalIpv6: {
      schema: "probpera-external-ipv6-origin-proof/v1",
      provider: "globalping",
      status: "passed",
      requiredOk: true,
      expectedReleaseSha: expectedMainSha,
      addressesRequired: [...GITHUB_PAGES_IPV6],
      addresses,
      measurements,
    },
  };
}

function apiPayload(result, resultInfo) {
  return {
    success: true,
    errors: [],
    messages: [],
    result,
    ...(resultInfo ? { result_info: resultInfo } : {}),
  };
}

function apiResponse(result, resultInfo, status = 200) {
  return new Response(JSON.stringify(apiPayload(result, resultInfo)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clone(value) {
  return structuredClone(value);
}

function readyPagesDeliveryPlan() {
  const plan = JSON.parse(
    readFileSync(
      new URL("../../config/dns/ru-connectivity-plan.json", import.meta.url),
      "utf8"
    )
  );
  plan.status = "ready";
  plan.authoritativeProvider.accountReady = true;
  plan.cloudflarePartial.eligible = true;
  plan.cloudflarePartial.advancedCertificateActive = true;
  plan.cloudflarePartial.delegatedDcvReady = true;
  plan.cloudflarePartial.verificationTxtReady = true;
  plan.contentOrigin.longTermCertificateRenewalConfirmed = true;
  plan.contentOrigin.longTermCertificateRenewalEvidence = {
    schemaVersion: 1,
    source: "observed-renewal-cycle",
    path: "config/dns/evidence/github-pages-renewal-manager-test.md",
    evidenceSha256: createHash("sha256").update(renewalEvidenceContent).digest("hex"),
    reviewPullRequest: "https://github.com/Kosyat128/probpera-literary-map/pull/999",
    reviewedAt: new Date().toISOString(),
  };
  plan.delegationSafety = {
    parentDs: {
      status: "absent",
      parentZone: "ru",
      checkedAt: new Date().toISOString(),
      resolverQuorum: 3,
      evidenceSha256: "b".repeat(64),
    },
    providerUnsignedCandidateReady: true,
    registrarNsChangeReviewed: true,
    dnssecPostMigrationPlanReady: true,
  };
  plan.directDelivery = {
    mode: "github-pages",
    provider: "github-pages",
    accountReady: true,
    hostname: pagesHostname,
    ipv4: [...GITHUB_PAGES_IPV4],
    ipv6: [...GITHUB_PAGES_IPV6],
    customCertificateReady: true,
    certificateAutomation: "github-pages-managed",
    artifactSyncReady: true,
    securityPolicyReady: true,
  };
  plan.routing.ru.aliasTargets = {
    [PUBLIC_ZONE_NAME]: pagesHostname,
    [`www.${PUBLIC_ZONE_NAME}`]: pagesHostname,
  };
  plan.routing.default.cnameTargets = {
    [PUBLIC_ZONE_NAME]: `${PUBLIC_ZONE_NAME}.cdn.cloudflare.net`,
    [`www.${PUBLIC_ZONE_NAME}`]: `www.${PUBLIC_ZONE_NAME}.cdn.cloudflare.net`,
  };
  plan.routing.admin.cnameTarget = `${ADMIN_HOST}.cdn.cloudflare.net`;
  for (const key of Object.keys(plan.preconditions)) plan.preconditions[key] = true;
  return plan;
}

function makeFetch({
  initialState = state(),
  pages,
  advertisedTotalCount,
  mutate,
  failedResponse,
  ambiguousFirstBatch = false,
  ambiguousFirstBatchBeforeMutation = false,
} = {}) {
  let current = clone(initialState);
  const calls = [];
  let batchCallCount = 0;
  const fetchImpl = async (urlValue, init) => {
    const url = new URL(urlValue);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({
      method: init.method,
      pathname: url.pathname,
      search: url.search,
      body,
      authorization: init.headers.Authorization,
    });
    if (failedResponse) return failedResponse;
    if (init.method === "GET" && url.pathname === "/client/v4/zones") {
      return apiResponse([current.zone], {
        page: 1,
        per_page: 50,
        total_pages: 1,
        total_count: 1,
      });
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/dns_records`
    ) {
      const page = Number(url.searchParams.get("page"));
      const recordPages = pages || [current.records];
      return apiResponse(recordPages[page - 1] || [], {
        page,
        per_page: 100,
        total_pages: recordPages.length,
        total_count: advertisedTotalCount ?? recordPages.flat().length,
      });
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/dnssec`
    ) {
      return apiResponse(current.dnssec);
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/dns_settings`
    ) {
      return apiResponse(current.dnsSettings);
    }
    if (
      init.method === "POST" &&
      url.pathname === `/client/v4/zones/${zoneId}/dns_records/batch`
    ) {
      batchCallCount += 1;
      if (ambiguousFirstBatchBeforeMutation && batchCallCount === 1) {
        throw new Error("simulated request timeout before commit");
      }
      if (mutate) {
        current = mutate({ current: clone(current), body, calls }) || current;
      } else {
        const desired = new Map(body.patches.map((patch) => [patch.id, patch.proxied]));
        current.records = current.records.map((record) =>
          desired.has(record.id)
            ? {
                ...record,
                proxied: desired.get(record.id),
                modified_on: "2026-08-24T12:01:00.000Z",
              }
            : record
        );
      }
      if (ambiguousFirstBatch && batchCallCount === 1) {
        throw new Error("simulated response timeout after commit");
      }
      return apiResponse({ patches: body.patches });
    }
    throw new Error(`Unexpected request: ${init.method} ${url.pathname}`);
  };
  return { fetchImpl, calls, getState: () => clone(current) };
}

function managerOptions(fetchImpl, overrides = {}) {
  return {
    token,
    accountId,
    fetchImpl,
    now,
    expectedMainSha,
    repositorySha: expectedMainSha,
    snapshotMainSha: expectedMainSha,
    pagesHostname,
    deliveryPlan: readyPagesDeliveryPlan(),
    renewalEvidenceContent,
    reconciliationDelayImpl: async () => {},
    tlsProof: passedProof(),
    ...overrides,
  };
}

describe("Cloudflare RU connectivity pure safety policy", () => {
  it("accepts only an explicit active, unpaused, authoritative full zone", () => {
    const payload = (zoneValue) =>
      apiPayload([zoneValue], {
        page: 1,
        per_page: 50,
        total_pages: 1,
        total_count: 1,
      });
    expect(validateDiscoveredZone(payload(zone()), accountId)).toMatchObject({
      type: "full",
      paused: false,
    });

    const missingType = zone();
    delete missingType.type;
    expect(() => validateDiscoveredZone(payload(missingType), accountId)).toThrow(
      "not an authoritative full zone"
    );
    expect(() =>
      validateDiscoveredZone(payload(zone({ type: "partial" })), accountId)
    ).toThrow("not an authoritative full zone");

    const missingPaused = zone();
    delete missingPaused.paused;
    expect(() => validateDiscoveredZone(payload(missingPaused), accountId)).toThrow(
      "explicit paused=false"
    );
    expect(() =>
      validateDiscoveredZone(payload(zone({ paused: true })), accountId)
    ).toThrow("paused");
  });

  it("recognizes every current official GitHub Pages A and AAAA address", () => {
    expect(GITHUB_PAGES_IPV4).toEqual([
      "185.199.108.153",
      "185.199.109.153",
      "185.199.110.153",
      "185.199.111.153",
    ]);
    expect(GITHUB_PAGES_IPV6).toHaveLength(4);
    expect(normalizeIpAddress("2606:50C0:8000:0:0:0:0:153", 6)).toBe(
      normalizeIpAddress("2606:50c0:8000::153", 6)
    );
  });

  it("plans only proxied public Pages records and preserves admin and passive records", () => {
    const records = productionRecords();
    const plan = planDirectChanges(records, { pagesHostname });
    expect(plan.operation).toBe("disable-public-proxy");
    expect(plan.changes).toHaveLength(9);
    expect(plan.changes.every((change) => PUBLIC_HOSTS.includes(change.name))).toBe(true);
    expect(plan.changes.every((change) => change.from && !change.to)).toBe(true);
    expect(plan.changes.some((change) => change.name === ADMIN_HOST)).toBe(false);
    expect(plan.admin_record_count).toBe(1);
    expect(plan.admin_records_fingerprint).toMatch(/^[a-f0-9]{64}$/u);

    const body = directBatchBody(plan);
    expect(Object.keys(body)).toEqual(["patches"]);
    expect(body.patches).toHaveLength(9);
    for (const patch of body.patches) {
      expect(patch).toEqual({ id: expect.stringMatching(/^[a-f0-9]{32}$/u), proxied: false });
      expect(patch).not.toHaveProperty("content");
      expect(patch).not.toHaveProperty("name");
      expect(patch).not.toHaveProperty("ttl");
    }
  });

  it("allows a DNS-only public record without trying to modify it", () => {
    const records = productionRecords();
    records[0].proxied = false;
    const plan = planDirectChanges(records, { pagesHostname });
    expect(plan.eligible_record_count).toBe(9);
    expect(plan.changes).toHaveLength(8);
  });

  it("allows one flattened Pages CNAME beside passive apex CAA/MX/TXT records", () => {
    const records = productionRecords().filter(
      (record) =>
        !(
          record.name === PUBLIC_ZONE_NAME &&
          ["A", "AAAA"].includes(record.type)
        )
    );
    records.push(
      dnsRecord({
        type: "CNAME",
        name: PUBLIC_ZONE_NAME,
        content: pagesHostname,
        settings: { flatten_cname: true },
      })
    );
    const plan = planDirectChanges(records, { pagesHostname });
    expect(plan.eligible_record_count).toBe(2);
    expect(plan.changes).toHaveLength(2);
    expect(records.filter((record) => ["CAA", "MX", "TXT"].includes(record.type))).toHaveLength(3);
  });

  it("fails closed for wrong targets, unknown records, CNAME conflicts, and missing hosts", () => {
    const wrongA = productionRecords();
    wrongA[0].content = "192.0.2.1";
    expect(() => planDirectChanges(wrongA, { pagesHostname })).toThrow(
      "exact official GitHub Pages A and AAAA sets"
    );

    const wrongCname = productionRecords();
    wrongCname.find((record) => record.name.startsWith("www.")).content = "attacker.example";
    expect(() => planDirectChanges(wrongCname, { pagesHostname })).toThrow(
      "not the configured Pages hostname"
    );

    const unknown = productionRecords();
    unknown.push(
      dnsRecord({
        type: "HTTPS",
        name: PUBLIC_ZONE_NAME,
        content: "1 . alpn=h2",
        proxiable: false,
        proxied: false,
      })
    );
    expect(() => planDirectChanges(unknown, { pagesHostname })).toThrow(
      "unknown or conflicting"
    );

    const cnameWithPassive = productionRecords();
    cnameWithPassive.push(
      dnsRecord({
        type: "TXT",
        name: `www.${PUBLIC_ZONE_NAME}`,
        content: "verification",
        proxiable: false,
        proxied: false,
      })
    );
    expect(() => planDirectChanges(cnameWithPassive, { pagesHostname })).not.toThrow();

    const cnameConflict = productionRecords();
    cnameConflict.push(
      dnsRecord({
        type: "A",
        name: `www.${PUBLIC_ZONE_NAME}`,
        content: GITHUB_PAGES_IPV4[0],
      })
    );
    expect(() => planDirectChanges(cnameConflict, { pagesHostname })).toThrow(
      "conflicting CNAME"
    );

    const missingWww = productionRecords().filter(
      (record) => record.name !== `www.${PUBLIC_ZONE_NAME}`
    );
    expect(() => planDirectChanges(missingWww, { pagesHostname })).toThrow(
      "has no direct GitHub Pages routing record"
    );

    const partial = productionRecords().filter(
      (record) => !(record.type === "AAAA" && record.name === PUBLIC_ZONE_NAME)
    );
    expect(() => planDirectChanges(partial, { pagesHostname })).toThrow(
      "exact official GitHub Pages A and AAAA sets"
    );

    const noAdmin = productionRecords().filter((record) => record.name !== ADMIN_HOST);
    expect(() => planDirectChanges(noAdmin, { pagesHostname })).toThrow(
      "Admin DNS record set is missing"
    );
  });

  it("does not accept arbitrary Pages-like or zone names", () => {
    expect(() =>
      planDirectChanges(productionRecords(), { pagesHostname: "example.pages.dev" })
    ).toThrow("configured *.github.io hostname");
    expect(() =>
      planDirectChanges(productionRecords(), {
        zoneName: "example.com",
        pagesHostname,
      })
    ).toThrow(`locked to ${PUBLIC_ZONE_NAME}`);
  });
});

describe("direct TLS proof gates", () => {
  it("accepts a fresh exact-SHA proof bound to every public record and official address", () => {
    const records = productionRecords();
    expect(
      validateDirectTlsProof(passedProof(records), {
        expectedMainSha,
        pagesHostname,
        records,
        now,
      }).status
    ).toBe("passed");
  });

  it("accepts only the known audit wrapper and requires it to pass", () => {
    const proof = passedProof();
    const wrapper = {
      schema: CONNECTIVITY_AUDIT_SCHEMA,
      requiredOk: true,
      directTlsReady: true,
      proof,
    };
    expect(unwrapDirectTlsProof(wrapper)).toBe(proof);
    expect(() => unwrapDirectTlsProof({ ...wrapper, requiredOk: false })).toThrow(
      "did not pass"
    );
    expect(() =>
      unwrapDirectTlsProof({ schema: "unknown/v1", proof })
    ).toThrow("wrapper schema is unsupported");
  });

  it("rejects transport-only external IPv6 evidence even when all 20 measurements pass", () => {
    const records = productionRecords();
    const wrapper = externalIpv6DiagnosticWrapper(records);
    expect(() =>
      validateDirectTlsProof(wrapper, {
        expectedMainSha,
        pagesHostname,
        records,
        now,
      })
    ).toThrow("does not bind full content integrity");
  });

  it("requires a full wrapper and exact unique Globalping measurement coverage", () => {
    const records = productionRecords();
    const wrapper = externalIpv6DiagnosticWrapper(records);
    expect(() =>
      validateDirectTlsProof(wrapper.proof, {
        expectedMainSha,
        pagesHostname,
        records,
        now,
      })
    ).toThrow("full external IPv6 evidence");

    const sparse = structuredClone(wrapper);
    sparse.proof.externalIpv6Proof.measurementIds.pop();
    expect(() =>
      validateDirectTlsProof(sparse, { expectedMainSha, pagesHostname, records, now })
    ).toThrow("exactly 20 measurement ids");

    const duplicated = structuredClone(wrapper);
    duplicated.proof.externalIpv6Proof.measurementIds[19] =
      duplicated.proof.externalIpv6Proof.measurementIds[0];
    expect(() =>
      validateDirectTlsProof(duplicated, { expectedMainSha, pagesHostname, records, now })
    ).toThrow("invalid or duplicated");
  });

  it("rejects forged forced-target and HTTP/2 TLS evidence", () => {
    const records = productionRecords();
    const wrongTarget = externalIpv6DiagnosticWrapper(records);
    wrongTarget.externalIpv6.measurements[0].results[0].resolvedAddress =
      GITHUB_PAGES_IPV6[1];
    expect(() =>
      validateDirectTlsProof(wrongTarget, { expectedMainSha, pagesHostname, records, now })
    ).toThrow("forced target and request host");

    const unauthorized = externalIpv6DiagnosticWrapper(records);
    unauthorized.externalIpv6.measurements[0].results[0].tlsAuthorized = false;
    expect(() =>
      validateDirectTlsProof(unauthorized, { expectedMainSha, pagesHostname, records, now })
    ).toThrow("HTTP/2 TLS or security evidence failed");
  });

  it("allows a null fingerprint only for a read-only in-memory plan binding", () => {
    const records = productionRecords();
    const proof = passedProof(records, { publicRecordsFingerprint: null });
    expect(() =>
      validateDirectTlsProof(proof, {
        expectedMainSha,
        pagesHostname,
        records,
        now,
      })
    ).toThrow("not bound");
    expect(
      validateDirectTlsProof(proof, {
        expectedMainSha,
        pagesHostname,
        records,
        now,
        allowUnboundFingerprint: true,
      }).status
    ).toBe("passed");
    expect(proof.publicRecordsFingerprint).toBeNull();
  });

  it.each([
    ["failed status", (proof) => (proof.status = "failed"), "status is not passed"],
    [
      "ineligible proof",
      (proof) => (proof.proofEligible = false),
      "not eligible for a production DNS change",
    ],
    [
      "wrong SHA",
      (proof) => (proof.expectedMainSha = "f".repeat(40)),
      "different main commit",
    ],
    [
      "stale proof",
      (proof) => {
        proof.verifiedAt = "2026-08-24T09:00:00.000Z";
        proof.expiresAt = "2026-08-24T12:30:00.000Z";
      },
      "stale, expired",
    ],
    [
      "TLS mismatch",
      (proof) => (proof.hosts.apex.hostnameVerified = false),
      "certificate proof failed",
    ],
    [
      "small apex",
      (proof) => (proof.hosts.apex.rootContentLength = 8_191),
      "root content proof was too small",
    ],
    [
      "small large endpoint",
      (proof) => (proof.hosts.apex.largeContentLength = 16_383),
      "large-content proof failed",
    ],
    [
      "shallow representative article",
      (proof) => (proof.hosts.apex.representativeHtmlPath = "/stati/test"),
      "not an eligible same-origin article",
    ],
    [
      "small representative article",
      (proof) => (proof.hosts.apex.representativeHtmlContentLength = 16_384),
      "content proof was too small",
    ],
    [
      "failed representative article status",
      (proof) => (proof.hosts.apex.representativeHtmlStatus = 404),
      "response proof failed",
    ],
    [
      "invalid representative article hash",
      (proof) => (proof.hosts.apex.representativeHtmlSha256 = "not-a-hash"),
      "hash proof was invalid",
    ],
    [
      "incomplete legacy redirect manifest",
      (proof) => (proof.hosts.apex.redirectManifestCount = 156),
      "redirect manifest proof failed",
    ],
    [
      "external legacy canonical target",
      (proof) => (proof.hosts.apex.legacyAliasTarget = "https://example.com/stati/test"),
      "did not preserve the canonical",
    ],
    [
      "static legacy alias fallback",
      (proof) => {
        proof.hosts.apex.legacyAliasMode = "static";
        proof.hosts.apex.legacyAliasStatus = 200;
      },
      "alias semantic proof failed",
    ],
    [
      "invalid custom 404",
      (proof) => (proof.hosts.apex.notFoundStatus = 200),
      "Custom 404 semantic proof failed",
    ],
    [
      "www not permanent",
      (proof) => (proof.hosts.www.httpStatus = 200),
      "response proof failed",
    ],
    [
      "www wrong target",
      (proof) => (proof.hosts.www.redirectTo = "https://example.com/"),
      "did not target canonical",
    ],
    [
      "incomplete address set",
      (proof) => proof.hosts.apex.originIpsTested.pop(),
      "official Pages address set",
    ],
  ])("rejects %s", (_name, mutate, message) => {
    const records = productionRecords();
    const proof = passedProof(records);
    mutate(proof);
    expect(() =>
      validateDirectTlsProof(proof, {
        expectedMainSha,
        pagesHostname,
        records,
        now,
      })
    ).toThrow(message);
  });

  it("binds a complete unbound audit proof to an integrity-checked snapshot", () => {
    const baseline = state();
    const snapshot = createSnapshotDocument(baseline, { now, expectedMainSha });
    const unbound = passedProof(baseline.records, { publicRecordsFingerprint: null });
    const wrapper = {
      schema: CONNECTIVITY_AUDIT_SCHEMA,
      requiredOk: true,
      directTlsReady: true,
      proof: unbound,
    };
    const bound = bindDirectTlsProofArtifact(wrapper, snapshot, {
      expectedMainSha,
      pagesHostname,
      now,
    });
    expect(bound.proof.publicRecordsFingerprint).toBe(
      snapshot.public_records_fingerprint
    );
    expect(bound.proof.snapshotConfigurationFingerprint).toBe(
      snapshot.configuration_fingerprint
    );
    expect(unbound.publicRecordsFingerprint).toBeNull();
    expect(() =>
      validateDirectTlsProof(bound, {
        expectedMainSha,
        pagesHostname,
        records: baseline.records,
        now,
      })
    ).not.toThrow();
    expect(() => assertProofBoundToSnapshot(bound, snapshot)).not.toThrow();
    const otherSnapshot = createSnapshotDocument(
      state(
        baseline.records.map((record) =>
          record.name === ADMIN_HOST ? { ...record, ttl: 300 } : record
        )
      ),
      { now, expectedMainSha }
    );
    expect(() => assertProofBoundToSnapshot(bound, otherSnapshot)).toThrow(
      "not cryptographically bound"
    );
  });
});

describe("complete snapshot and rollback", () => {
  it("snapshots every record type, nameservers, DNSSEC, settings, proxy flags, and integrity", () => {
    const current = state();
    const snapshot = createSnapshotDocument(current, { now, expectedMainSha });
    expect(snapshot.schema).toBe(SNAPSHOT_SCHEMA);
    expect(snapshot.records).toHaveLength(current.records.length);
    expect(new Set(snapshot.records.map((record) => record.type))).toEqual(
      new Set(["A", "AAAA", "CNAME", "CAA", "MX", "TXT", "SRV", "NS"])
    );
    expect(snapshot.records.some((record) => record.proxied === true)).toBe(true);
    expect(snapshot.records.some((record) => record.ttl === 3600)).toBe(true);
    expect(snapshot.records.some((record) => record.settings)).toBe(true);
    expect(snapshot.zone.name_servers).toEqual([
      "ada.ns.cloudflare.com",
      "bob.ns.cloudflare.com",
    ]);
    expect(snapshot.dnssec.status).toBe("active");
    expect(snapshot.dns_settings.zone_mode).toBe("standard");
    expect(snapshot.expected_main_sha).toBe(expectedMainSha);
    expect(snapshot.integrity_fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(validateSnapshotDocument(snapshot)).toBe(snapshot);
  });

  it("detects snapshot tampering, including admin and public records", () => {
    const snapshot = createSnapshotDocument(state(), { now });
    const contentTamper = clone(snapshot);
    contentTamper.records[0].content = "192.0.2.1";
    expect(() => validateSnapshotDocument(contentTamper)).toThrow("integrity validation failed");

    const fingerprintTamper = clone(snapshot);
    fingerprintTamper.admin_records_fingerprint = "f".repeat(64);
    const { integrity_fingerprint: _old, ...base } = fingerprintTamper;
    fingerprintTamper.integrity_fingerprint = sha256Fingerprint(base);
    expect(() => validateSnapshotDocument(fingerprintTamper)).toThrow(
      "admin-record fingerprint"
    );
  });

  it("plans an exact rollback and patches only proxy flags", () => {
    const baseline = state();
    const snapshot = createSnapshotDocument(baseline, { now, expectedMainSha });
    const direct = planDirectChanges(baseline.records, { pagesHostname });
    const changed = new Set(direct.changes.map((change) => change.id));
    const current = state(
      baseline.records.map((record) =>
        changed.has(record.id)
          ? { ...record, proxied: false, modified_on: "2026-08-24T12:01:00.000Z" }
          : record
      )
    );
    const rollback = planRollbackChanges(snapshot, current, { pagesHostname });
    expect(rollback.operation).toBe("restore-public-proxy");
    expect(rollback.changes).toHaveLength(9);
    const body = rollbackBatchBody(rollback);
    expect(body).toEqual({
      patches: rollback.changes.map((change) => ({ id: change.id, proxied: true })),
    });
    expect(stableStringify(baseline.dnssec)).toBe(stableStringify(current.dnssec));
  });

  it("rollback fails for concurrent content, admin, DNSSEC, record-set, or proxy changes", () => {
    const baseline = state();
    const snapshot = createSnapshotDocument(baseline, { now });
    const changed = clone(baseline);
    changed.records[0].proxied = false;

    const content = clone(changed);
    content.records[0].ttl = 300;
    expect(() => planRollbackChanges(snapshot, content, { pagesHostname })).toThrow(
      "definition changed"
    );

    const admin = clone(changed);
    admin.records.find((record) => record.name === ADMIN_HOST).proxied = false;
    expect(() => planRollbackChanges(snapshot, admin, { pagesHostname })).toThrow(
      "not an exact result"
    );

    const dnssec = clone(changed);
    dnssec.dnssec.status = "disabled";
    expect(() => planRollbackChanges(snapshot, dnssec, { pagesHostname })).toThrow(
      "DNSSEC or zone DNS settings changed"
    );

    const missing = clone(changed);
    missing.records.pop();
    expect(() => planRollbackChanges(snapshot, missing, { pagesHostname })).toThrow(
      "record set changed"
    );

    const passive = clone(changed);
    passive.records.find((record) => record.type === "TXT").proxied = true;
    expect(() => planRollbackChanges(snapshot, passive, { pagesHostname })).toThrow(
      "not an exact result"
    );
  });
});

describe("CLI and mutation gates", () => {
  it("defaults to inspect and requires every mutation input explicitly", () => {
    expect(parseCliOptions([])).toMatchObject({ command: "inspect", zoneName: PUBLIC_ZONE_NAME });
    expect(parseCliOptions(["inspect"])).toMatchObject({ command: "inspect" });
    expect(() => parseCliOptions(["snapshot"])).toThrow("requires --snapshot");
    expect(() =>
      parseCliOptions([
        "apply-direct",
        `--expected-main-sha=${expectedMainSha}`,
        `--pages-hostname=${pagesHostname}`,
      ])
    ).toThrow("requires --tls-proof");
    expect(() => parseCliOptions(["inspect", "--apply=true"])).toThrow("Unknown CLI option");
    let malformed = "";
    try {
      parseCliOptions(["inspect", "--CLOUDFLARE_API_TOKEN=must-not-leak"]);
    } catch (error) {
      malformed = String(error);
    }
    expect(malformed).not.toContain("must-not-leak");
    expect(() => parseCliOptions(["inspect", "--zone=example.com"])).toThrow("locked");
    expect(() =>
      parseCliOptions([
        "rollback",
        "--snapshot=cloudflare-before.json",
        `--expected-main-sha=${laterMainSha}`,
        `--pages-hostname=${pagesHostname}`,
        `--confirm=${confirmationFor("rollback", laterMainSha)}`,
      ])
    ).toThrow("requires --snapshot-main-sha");
  });

  it("accepts the explicit command contract and the proof alias", () => {
    const confirmation = confirmationFor("apply-direct", expectedMainSha);
    expect(
      parseCliOptions([
        "apply-direct",
        "--snapshot=cloudflare-before.json",
        "--delivery-plan=config/dns/ru-connectivity-plan.json",
        "--direct-tls-proof=artifacts/direct-connectivity.json",
        `--expected-main-sha=${expectedMainSha}`,
        `--pages-hostname=${pagesHostname}`,
        `--confirm=${confirmation}`,
      ])
    ).toEqual({
      command: "apply-direct",
      zoneName: PUBLIC_ZONE_NAME,
      snapshotPath: "cloudflare-before.json",
      snapshotMainSha: undefined,
      boundProofPath: undefined,
      tlsProofPath: "artifacts/direct-connectivity.json",
      expectedMainSha,
      pagesHostname,
      confirmation,
      deliveryPlanPath: "config/dns/ru-connectivity-plan.json",
    });
  });

  it("parses the explicit read-only bind-proof artifact contract", () => {
    expect(
      parseCliOptions([
        "bind-proof",
        "--snapshot=cloudflare-before.json",
        "--tls-proof=artifacts/direct-connectivity.json",
        "--bound-proof=artifacts/direct-connectivity-bound.json",
        `--expected-main-sha=${expectedMainSha}`,
        `--pages-hostname=${pagesHostname}`,
      ])
    ).toMatchObject({
      command: "bind-proof",
      snapshotPath: "cloudflare-before.json",
      tlsProofPath: "artifacts/direct-connectivity.json",
      boundProofPath: "artifacts/direct-connectivity-bound.json",
    });
  });

  it("parses distinct reviewed-code and attested-snapshot SHAs for rollback", () => {
    expect(
      parseCliOptions([
        "rollback",
        "--snapshot=cloudflare-before.json",
        `--snapshot-main-sha=${expectedMainSha}`,
        `--expected-main-sha=${laterMainSha}`,
        `--pages-hostname=${pagesHostname}`,
        `--confirm=${confirmationFor("rollback", laterMainSha)}`,
      ])
    ).toMatchObject({
      command: "rollback",
      expectedMainSha: laterMainSha,
      snapshotMainSha: expectedMainSha,
      confirmation: confirmationFor("rollback", laterMainSha),
    });
  });

  it("requires exact checked-out SHA, snapshot SHA, and confirmation", () => {
    const snapshot = createSnapshotDocument(state(), { now, expectedMainSha });
    expect(
      validateMutationGate({
        command: "apply-direct",
        expectedMainSha,
        repositorySha: expectedMainSha,
        confirmation: confirmationFor("apply-direct", expectedMainSha),
        snapshot,
      })
    ).toBe(expectedMainSha);
    expect(() =>
      validateMutationGate({
        command: "apply-direct",
        expectedMainSha,
        repositorySha: "f".repeat(40),
        confirmation: confirmationFor("apply-direct", expectedMainSha),
        snapshot,
      })
    ).toThrow("does not equal");
    expect(() =>
      validateMutationGate({
        command: "apply-direct",
        expectedMainSha,
        repositorySha: expectedMainSha,
        confirmation: "yes",
        snapshot,
      })
    ).toThrow("Exact apply-direct confirmation");
    expect(() =>
      validateMutationGate({
        command: "apply-direct",
        expectedMainSha: laterMainSha,
        repositorySha: laterMainSha,
        confirmation: confirmationFor("apply-direct", laterMainSha),
        snapshot,
      })
    ).toThrow("Apply snapshot main SHA");

    expect(
      validateMutationGate({
        command: "rollback",
        expectedMainSha: laterMainSha,
        repositorySha: laterMainSha,
        snapshotMainSha: expectedMainSha,
        confirmation: confirmationFor("rollback", laterMainSha),
        snapshot,
      })
    ).toBe(laterMainSha);
    expect(() =>
      validateMutationGate({
        command: "rollback",
        expectedMainSha: laterMainSha,
        repositorySha: laterMainSha,
        snapshotMainSha: laterMainSha,
        confirmation: confirmationFor("rollback", laterMainSha),
        snapshot,
      })
    ).toThrow("does not match workflow provenance");
  });
});

describe("Cloudflare API orchestration", () => {
  it("inspect is strictly read-only and paginates the complete record set", async () => {
    const records = productionRecords();
    const { fetchImpl, calls } = makeFetch({
      initialState: state(records),
      pages: [records.slice(0, 5), records.slice(5)],
    });
    const result = await manageRuConnectivity({
      command: "inspect",
      token,
      accountId,
      fetchImpl,
      now,
    });
    expect(result.mode).toBe("read-only");
    expect(result.authoritative).toBe(true);
    expect(result.recordCount).toBe(records.length);
    expect(result.recordTypeCounts).toMatchObject({ A: 4, AAAA: 4, CNAME: 2 });
    expect(result.mutationCount).toBe(0);
    expect(calls.filter((call) => call.pathname.endsWith("/dns_records"))).toHaveLength(2);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("fails closed when pagination advertises records that were not returned", async () => {
    const { fetchImpl, calls } = makeFetch({ advertisedTotalCount: 999 });
    await expect(
      manageRuConnectivity({ command: "inspect", token, accountId, fetchImpl, now })
    ).rejects.toThrow("did not return the advertised record count");
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("snapshot writes once only to the required path and makes no API mutation", async () => {
    const { fetchImpl, calls } = makeFetch();
    const writes = [];
    const result = await manageRuConnectivity({
      command: "snapshot",
      token,
      accountId,
      fetchImpl,
      now,
      expectedMainSha,
      snapshotPath: "cloudflare-before.json",
      writeFileImpl: async (...args) => writes.push(args),
    });
    expect(result.snapshotWritten).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe("cloudflare-before.json");
    expect(writes[0][2]).toMatchObject({ flag: "wx", mode: 0o600 });
    const written = JSON.parse(writes[0][1]);
    expect(written.records).toHaveLength(productionRecords().length);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("refuses to overwrite a snapshot", async () => {
    await expect(
      writeSnapshotFile("existing.json", {}, async () => {
        const error = new Error("exists");
        error.code = "EEXIST";
        throw error;
      })
    ).rejects.toThrow("refusing to overwrite");
  });

  it("plan-direct remains read-only and may bind a null proof in memory", async () => {
    const records = productionRecords();
    const { fetchImpl, calls } = makeFetch({ initialState: state(records) });
    const result = await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "plan-direct",
        tlsProof: passedProof(records, { publicRecordsFingerprint: null }),
      })
    );
    expect(result.plannedChangeCount).toBe(9);
    expect(result.mutationCount).toBe(0);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("bind-proof writes one exclusive artifact, verifies snapshot/current state, and never mutates Cloudflare", async () => {
    const baseline = state();
    const snapshot = createSnapshotDocument(baseline, { now, expectedMainSha });
    const { fetchImpl, calls } = makeFetch({ initialState: baseline });
    const writes = [];
    const result = await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "bind-proof",
        snapshot,
        tlsProof: {
          schema: CONNECTIVITY_AUDIT_SCHEMA,
          requiredOk: true,
          directTlsReady: true,
          proof: passedProof(baseline.records, { publicRecordsFingerprint: null }),
        },
        boundProofPath: "artifacts/direct-connectivity-bound.json",
        writeFileImpl: async (...args) => writes.push(args),
      })
    );
    expect(result.mode).toBe("proof-binding-only");
    expect(result.mutationCount).toBe(0);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe("artifacts/direct-connectivity-bound.json");
    expect(writes[0][2]).toMatchObject({ flag: "wx", mode: 0o600 });
    const artifact = JSON.parse(writes[0][1]);
    expect(artifact.proof.publicRecordsFingerprint).toBe(
      snapshot.public_records_fingerprint
    );
  });

  it("apply-direct uses one batch PATCH list, preserves fields, and verifies", async () => {
    const initial = state();
    const snapshot = createSnapshotDocument(initial, { now, expectedMainSha });
    const proof = bindDirectTlsProofArtifact(passedProof(initial.records), snapshot, {
      expectedMainSha,
      pagesHostname,
      now,
    });
    const { fetchImpl, calls, getState } = makeFetch({ initialState: initial });
    const result = await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "apply-direct",
        snapshot,
        confirmation: confirmationFor("apply-direct", expectedMainSha),
        tlsProof: proof,
      })
    );
    expect(result.appliedChangeCount).toBe(9);
    expect(result.mutationCount).toBe(1);
    const mutations = calls.filter((call) => call.method !== "GET");
    expect(mutations).toHaveLength(1);
    expect(mutations[0].method).toBe("POST");
    expect(mutations[0].pathname).toBe(
      `/client/v4/zones/${zoneId}/dns_records/batch`
    );
    expect(Object.keys(mutations[0].body)).toEqual(["patches"]);
    expect(mutations[0].body.patches.every((patch) => patch.proxied === false)).toBe(true);

    const after = getState();
    expect(after.records.find((record) => record.name === ADMIN_HOST).proxied).toBe(true);
    expect(after.dnssec).toEqual(initial.dnssec);
    expect(after.dnsSettings).toEqual(initial.dnsSettings);
    for (const beforeRecord of initial.records) {
      const afterRecord = after.records.find((record) => record.id === beforeRecord.id);
      expect(afterRecord.content).toBe(beforeRecord.content);
      expect(afterRecord.ttl).toBe(beforeRecord.ttl);
      expect(afterRecord.settings).toEqual(beforeRecord.settings);
      expect(afterRecord.tags).toEqual(beforeRecord.tags);
    }
  });

  it("apply refuses the committed blocked delivery plan before mutation", async () => {
    const initial = state();
    const snapshot = createSnapshotDocument(initial, { now, expectedMainSha });
    const proof = bindDirectTlsProofArtifact(passedProof(initial.records), snapshot, {
      expectedMainSha,
      pagesHostname,
      now,
    });
    const blockedPlan = JSON.parse(
      readFileSync(
        new URL("../../config/dns/ru-connectivity-plan.json", import.meta.url),
        "utf8"
      )
    );
    const { fetchImpl, calls } = makeFetch({ initialState: initial });
    await expect(
      manageRuConnectivity(
        managerOptions(fetchImpl, {
          command: "apply-direct",
          snapshot,
          tlsProof: proof,
          deliveryPlan: blockedPlan,
          confirmation: confirmationFor("apply-direct", expectedMainSha),
        })
      )
    ).rejects.toThrow(/delivery plan is not ready|intentionally blocked/u);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("apply rejects mixed and already-direct public proxy baselines", async () => {
    for (const mode of ["mixed", "all-direct"]) {
      const records = productionRecords();
      const publicRouting = records.filter(
        (record) => PUBLIC_HOSTS.includes(record.name) && ["A", "AAAA", "CNAME"].includes(record.type)
      );
      for (const [index, record] of publicRouting.entries()) {
        if (mode === "all-direct" || index === 0) record.proxied = false;
      }
      const initial = state(records);
      const snapshot = createSnapshotDocument(initial, { now, expectedMainSha });
      const proof = bindDirectTlsProofArtifact(passedProof(initial.records), snapshot, {
        expectedMainSha,
        pagesHostname,
        now,
      });
      const { fetchImpl, calls } = makeFetch({ initialState: initial });
      await expect(
        manageRuConnectivity(
          managerOptions(fetchImpl, {
            command: "apply-direct",
            snapshot,
            tlsProof: proof,
            confirmation: confirmationFor("apply-direct", expectedMainSha),
          })
        )
      ).rejects.toThrow(/every eligible public routing record to start proxied/u);
      expect(calls.every((call) => call.method === "GET")).toBe(true);
    }
  });

  it("reconciles an ambiguous committed POST and restores the snapshot automatically", async () => {
    const initial = state();
    const snapshot = createSnapshotDocument(initial, { now, expectedMainSha });
    const proof = bindDirectTlsProofArtifact(passedProof(initial.records), snapshot, {
      expectedMainSha,
      pagesHostname,
      now,
    });
    const { fetchImpl, calls, getState } = makeFetch({
      initialState: initial,
      ambiguousFirstBatch: true,
    });
    await expect(
      manageRuConnectivity(
        managerOptions(fetchImpl, {
          command: "apply-direct",
          snapshot,
          tlsProof: proof,
          confirmation: confirmationFor("apply-direct", expectedMainSha),
        })
      )
    ).rejects.toThrow(/automatically restored/u);
    expect(sha256Fingerprint(stableConfiguration(getState()))).toBe(
      snapshot.configuration_fingerprint
    );
    const mutations = calls.filter((call) => call.method === "POST");
    expect(mutations).toHaveLength(2);
    expect(mutations[0].body.patches.every((patch) => patch.proxied === false)).toBe(true);
    expect(mutations[1].body.patches.every((patch) => patch.proxied === true)).toBe(true);
  });

  it("apply fails before mutation for invalid proof, confirmation, snapshot drift, or SHA", async () => {
    const scenarios = [
      {
        overrides: { tlsProof: passedProof(productionRecords(), { status: "failed" }) },
        message: "status is not passed",
      },
      {
        overrides: { tlsProof: passedProof(productionRecords()) },
        message: "not cryptographically bound",
      },
      {
        overrides: { confirmation: "yes" },
        message: "Exact apply-direct confirmation",
      },
      {
        mutateSnapshot: (snapshot) => {
          snapshot.expected_main_sha = "f".repeat(40);
          const { integrity_fingerprint: _old, ...base } = snapshot;
          snapshot.integrity_fingerprint = sha256Fingerprint(base);
        },
        message: "Apply snapshot main SHA",
      },
      {
        overrides: { repositorySha: "f".repeat(40) },
        message: "Checked-out repository SHA",
      },
    ];
    for (const scenario of scenarios) {
      const initial = state();
      const snapshot = createSnapshotDocument(initial, { now, expectedMainSha });
      const proof = bindDirectTlsProofArtifact(passedProof(initial.records), snapshot, {
        expectedMainSha,
        pagesHostname,
        now,
      });
      scenario.mutateSnapshot?.(snapshot);
      const { fetchImpl, calls } = makeFetch({ initialState: initial });
      await expect(
        manageRuConnectivity(
          managerOptions(fetchImpl, {
            command: "apply-direct",
            snapshot,
            confirmation: confirmationFor("apply-direct", expectedMainSha),
            tlsProof: proof,
            ...scenario.overrides,
          })
        )
      ).rejects.toThrow(scenario.message);
      expect(calls.every((call) => call.method === "GET")).toBe(true);
    }
  });

  it("rollback validates the direct state and restores it with one batch request", async () => {
    const baseline = state();
    const snapshot = createSnapshotDocument(baseline, { now, expectedMainSha });
    const direct = planDirectChanges(baseline.records, { pagesHostname });
    const ids = new Set(direct.changes.map((change) => change.id));
    const directState = state(
      baseline.records.map((record) =>
        ids.has(record.id) ? { ...record, proxied: false } : record
      )
    );
    const { fetchImpl, calls, getState } = makeFetch({ initialState: directState });
    const result = await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "rollback",
        snapshot,
        tlsProof: undefined,
        confirmation: confirmationFor("rollback", expectedMainSha),
      })
    );
    expect(result.appliedChangeCount).toBe(9);
    expect(result.mutationCount).toBe(1);
    const mutations = calls.filter((call) => call.method !== "GET");
    expect(mutations).toHaveLength(1);
    expect(mutations[0].body.patches.every((patch) => patch.proxied === true)).toBe(true);
    expect(sha256Fingerprint(stableConfiguration(getState()))).toBe(
      snapshot.configuration_fingerprint
    );
  });

  it("rollback retries after an ambiguous pre-commit timeout and verifies exact state", async () => {
    const baseline = state();
    const snapshot = createSnapshotDocument(baseline, { now, expectedMainSha });
    const direct = planDirectChanges(baseline.records, { pagesHostname });
    const ids = new Set(direct.changes.map((change) => change.id));
    const directState = state(
      baseline.records.map((record) =>
        ids.has(record.id) ? { ...record, proxied: false } : record
      )
    );
    const { fetchImpl, calls, getState } = makeFetch({
      initialState: directState,
      ambiguousFirstBatchBeforeMutation: true,
    });
    const result = await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "rollback",
        snapshot,
        tlsProof: undefined,
        confirmation: confirmationFor("rollback", expectedMainSha),
      })
    );
    expect(result.mutationCount).toBe(2);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
    expect(sha256Fingerprint(stableConfiguration(getState()))).toBe(
      snapshot.configuration_fingerprint
    );
  });

  it("applies snapshot A and later rolls it back under separately reviewed main B", async () => {
    const baseline = state();
    const snapshotA = createSnapshotDocument(baseline, {
      now,
      expectedMainSha,
    });
    const proofA = bindDirectTlsProofArtifact(
      passedProof(baseline.records),
      snapshotA,
      { expectedMainSha, pagesHostname, now }
    );
    const appliedRecordIds = new Set(
      planDirectChanges(baseline.records, { pagesHostname }).changes.map(
        (change) => change.id
      )
    );
    const { fetchImpl, calls, getState } = makeFetch({ initialState: baseline });

    await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "apply-direct",
        snapshot: snapshotA,
        tlsProof: proofA,
        expectedMainSha,
        repositorySha: expectedMainSha,
        confirmation: confirmationFor("apply-direct", expectedMainSha),
      })
    );
    expect(
      getState().records.filter(
        (record) => appliedRecordIds.has(record.id) && record.proxied === false
      )
    ).toHaveLength(9);

    await manageRuConnectivity(
      managerOptions(fetchImpl, {
        command: "rollback",
        snapshot: snapshotA,
        tlsProof: undefined,
        expectedMainSha: laterMainSha,
        repositorySha: laterMainSha,
        snapshotMainSha: expectedMainSha,
        confirmation: confirmationFor("rollback", laterMainSha),
      })
    );

    expect(sha256Fingerprint(stableConfiguration(getState()))).toBe(
      snapshotA.configuration_fingerprint
    );
    const mutations = calls.filter((call) => call.method !== "GET");
    expect(mutations).toHaveLength(2);
    expect(mutations[0].body.patches.every((patch) => patch.proxied === false)).toBe(true);
    expect(mutations[1].body.patches.every((patch) => patch.proxied === true)).toBe(true);
  });

  it("does not expose API tokens, record contents, or identifiers in API failures", async () => {
    const secretContent = "very-secret-record-content.example";
    const failedResponse = new Response(
      JSON.stringify({
        success: false,
        result: null,
        errors: [
          {
            code: 1000,
            message: `Bearer ${token} ${accountId} ${zoneId} ${secretContent}`,
          },
        ],
        messages: [],
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
    const { fetchImpl } = makeFetch({ failedResponse });
    const client = new CloudflareClient({ token, accountId, fetchImpl });
    let failure = "";
    try {
      await client.request("GET", "/zones");
    } catch (error) {
      failure = String(error);
    }
    expect(failure).toContain("error codes: 1000");
    expect(failure).not.toContain(token);
    expect(failure).not.toContain(accountId);
    expect(failure).not.toContain(zoneId);
    expect(failure).not.toContain(secretContent);
    expect(redactSensitive(`Bearer ${token} ${accountId}`, [token, accountId])).not.toContain(
      token
    );
  });

  it("source contains no delete, put, NS, DNSSEC, or zone-settings mutation path", () => {
    const source = readFileSync("scripts/cloudflare/manage-ru-connectivity.mjs", "utf8");
    expect(source).not.toContain('request("DELETE"');
    expect(source).not.toContain('request("PUT"');
    expect(source).not.toMatch(/request\("PATCH",\s*`\/zones\/\$\{[^}]+\}\/dnssec/u);
    expect(source).not.toMatch(/request\("PATCH",\s*`\/zones\/\$\{[^}]+\}\/dns_settings/u);
    expect(source).not.toContain('"deletes"');
    expect(source).not.toContain('"puts"');
  });
});
