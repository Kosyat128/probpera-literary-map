import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validatePlan } from "./validate-ru-connectivity-plan.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const planPath = path.join(projectRoot, "config", "dns", "ru-connectivity-plan.json");

async function loadPlan() {
  return JSON.parse(await fs.readFile(planPath, "utf8"));
}

test("committed plan is valid but intentionally blocked", async () => {
  const plan = await loadPlan();
  assert.deepEqual(validatePlan(plan), []);
  assert.match(validatePlan(plan, { requireReady: true }).join("\n"), /intentionally blocked/u);
});

test("blocked plan cannot claim that GeoDNS is already active", async () => {
  const plan = await loadPlan();
  plan.productionRoutingState = "geodns-ru-direct";
  assert.match(validatePlan(plan).join("\n"), /blocked plan must report/u);
});

test("ready plan needs exact dual-stack and rollback gates", async () => {
  const plan = await loadPlan();
  const renewalEvidenceContent = Buffer.from(
    "Synthetic unit-test evidence for a separately reviewed Pages renewal confirmation."
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
    source: "github-support-confirmation",
    path: "config/dns/evidence/github-pages-renewal-unit-test.md",
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
    hostname: "Kosyat128.github.io",
    ipv4: [...plan.contentOrigin.ipv4],
    ipv6: [...plan.contentOrigin.ipv6],
    customCertificateReady: true,
    certificateAutomation: "github-pages-managed",
    artifactSyncReady: true,
    securityPolicyReady: true,
  };
  plan.routing.ru.aliasTargets = {
    "probpera.ru": "Kosyat128.github.io",
    "www.probpera.ru": "Kosyat128.github.io",
  };
  plan.routing.default.cnameTargets = {
    "probpera.ru": "probpera.ru.cdn.cloudflare.net",
    "www.probpera.ru": "www.probpera.ru.cdn.cloudflare.net",
  };
  plan.routing.admin.cnameTarget = "admin.probpera.ru.cdn.cloudflare.net";
  for (const key of Object.keys(plan.preconditions)) plan.preconditions[key] = true;

  assert.deepEqual(
    validatePlan(plan, { requireReady: true, renewalEvidenceContent }),
    []
  );

  const renewalEvidence = plan.contentOrigin.longTermCertificateRenewalEvidence;
  plan.contentOrigin.longTermCertificateRenewalEvidence = null;
  assert.match(
    validatePlan(plan, { requireReady: true, renewalEvidenceContent }).join("\n"),
    /hash-bound evidence file/u
  );
  plan.contentOrigin.longTermCertificateRenewalEvidence = renewalEvidence;

  plan.delegationSafety.parentDs.checkedAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  assert.match(
    validatePlan(plan, { requireReady: true, renewalEvidenceContent }).join("\n"),
    /fresh multi-resolver/u
  );
  plan.delegationSafety.parentDs.checkedAt = new Date().toISOString();

  plan.contentOrigin.ipv6.pop();
  assert.match(validatePlan(plan, { renewalEvidenceContent }).join("\n"), /IPv6 set/u);
});

test("admin can never enter the managed public host set", async () => {
  const plan = await loadPlan();
  plan.publicHosts.push("admin.probpera.ru");
  assert.match(validatePlan(plan).join("\n"), /publicHosts|preserved/u);
});

test("credential-shaped fields are rejected", async () => {
  const plan = await loadPlan();
  plan.authoritativeProvider.apiToken = "must-not-be-here";
  assert.match(validatePlan(plan).join("\n"), /credential fields/u);
});

test("required gate names cannot be replaced by arbitrary true flags", async () => {
  const plan = await loadPlan();
  delete plan.preconditions.directIpv6Passed;
  plan.preconditions.looksReady = true;
  assert.match(validatePlan(plan).join("\n"), /exact required production gate names/u);
});

test("a lookalike Cloudflare suffix is not accepted as a Partial target", async () => {
  const plan = await loadPlan();
  plan.status = "ready";
  plan.authoritativeProvider.accountReady = true;
  plan.cloudflarePartial.eligible = true;
  plan.cloudflarePartial.advancedCertificateActive = true;
  plan.cloudflarePartial.delegatedDcvReady = true;
  plan.cloudflarePartial.verificationTxtReady = true;
  plan.contentOrigin.longTermCertificateRenewalConfirmed = true;
  plan.directDelivery = {
    mode: "github-pages",
    provider: "github-pages",
    accountReady: true,
    hostname: "Kosyat128.github.io",
    ipv4: [...plan.contentOrigin.ipv4],
    ipv6: [...plan.contentOrigin.ipv6],
    customCertificateReady: true,
    certificateAutomation: "github-pages-managed",
    artifactSyncReady: true,
    securityPolicyReady: true,
  };
  plan.routing.ru.aliasTargets = {
    "probpera.ru": "Kosyat128.github.io",
    "www.probpera.ru": "Kosyat128.github.io",
  };
  plan.routing.default.cnameTargets = {
    "probpera.ru": "wrong-probpera.cdn.cloudflare.net",
    "www.probpera.ru": "www.probpera.ru.cdn.cloudflare.net",
  };
  plan.routing.admin.cnameTarget = "admin.probpera.ru.cdn.cloudflare.net";
  for (const key of Object.keys(plan.preconditions)) plan.preconditions[key] = true;
  assert.match(validatePlan(plan).join("\n"), /exact Cloudflare Partial CNAME targets/u);
});

test("a custom edge cannot self-attest readiness without a provider adapter", async () => {
  const plan = await loadPlan();
  plan.status = "ready";
  plan.authoritativeProvider.accountReady = true;
  plan.cloudflarePartial.eligible = true;
  plan.cloudflarePartial.advancedCertificateActive = true;
  plan.cloudflarePartial.delegatedDcvReady = true;
  plan.cloudflarePartial.verificationTxtReady = true;
  plan.contentOrigin.longTermCertificateRenewalConfirmed = false;
  plan.directDelivery = {
    mode: "custom-edge",
    provider: "reviewed-ru-edge",
    accountReady: true,
    hostname: "delivery.example.net",
    ipv4: ["8.8.8.8"],
    ipv6: ["2001:4860:4860::8888"],
    customCertificateReady: true,
    certificateAutomation: "dns-01",
    artifactSyncReady: true,
    securityPolicyReady: true,
  };
  plan.routing.ru.aliasTargets = {
    "probpera.ru": "delivery.example.net",
    "www.probpera.ru": "delivery.example.net",
  };
  plan.routing.default.cnameTargets = {
    "probpera.ru": "probpera.ru.cdn.cloudflare.net",
    "www.probpera.ru": "www.probpera.ru.cdn.cloudflare.net",
  };
  plan.routing.admin.cnameTarget = "admin.probpera.ru.cdn.cloudflare.net";
  for (const key of Object.keys(plan.preconditions)) plan.preconditions[key] = true;

  assert.match(
    validatePlan(plan, { requireReady: true }).join("\n"),
    /provider-specific attested proof adapter|production-ready/u
  );
});

test("custom edge rejects special-purpose, Cloudflare, duplicate, and self-loop targets", async () => {
  const plan = await loadPlan();
  plan.directDelivery = {
    mode: "custom-edge",
    provider: "lookalike-provider",
    accountReady: true,
    hostname: "probpera.ru",
    ipv4: ["192.0.2.10", "192.0.2.10", "104.16.1.1"],
    ipv6: ["2001:db8::10", "2606:4700::1111"],
    customCertificateReady: true,
    certificateAutomation: "dns-01",
    artifactSyncReady: true,
    securityPolicyReady: true,
  };
  const errors = validatePlan(plan).join("\n");
  assert.match(errors, /self-loop/u);
  assert.match(errors, /IPv4 targets must be unique, globally routable, and outside Cloudflare/u);
  assert.match(errors, /IPv6 targets must be unique, globally routable, and outside Cloudflare/u);
  assert.match(errors, /provider-specific attested proof adapter/u);
});

test("custom edge rejects Cloudflare address space even under a lookalike provider", async () => {
  const plan = await loadPlan();
  plan.directDelivery = {
    mode: "custom-edge",
    provider: "reviewed-edge",
    accountReady: true,
    hostname: "delivery.example.net",
    ipv4: ["104.16.1.1"],
    ipv6: ["2606:4700::1111"],
    customCertificateReady: true,
    certificateAutomation: "provider-managed",
    artifactSyncReady: true,
    securityPolicyReady: true,
  };
  const errors = validatePlan(plan).join("\n");
  assert.match(errors, /outside Cloudflare/u);
});
