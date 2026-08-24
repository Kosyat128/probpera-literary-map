import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..", "..");
const defaultPlanPath = path.join(
  projectRoot,
  "config",
  "dns",
  "ru-connectivity-plan.json"
);

const expectedIpv4 = [
  "185.199.108.153",
  "185.199.109.153",
  "185.199.110.153",
  "185.199.111.153",
];
const expectedIpv6 = [
  "2606:50c0:8000::153",
  "2606:50c0:8001::153",
  "2606:50c0:8002::153",
  "2606:50c0:8003::153",
];
const expectedPublicHosts = ["probpera.ru", "www.probpera.ru"];
const expectedPreservedTypes = ["CAA", "MX", "NS", "SRV", "TXT"];
const expectedPreconditions = [
  "adminFingerprintPreserved",
  "adminPartialRoutePassed",
  "cloudflareApiSnapshotComplete",
  "cloudflareAdvancedCertificateActive",
  "cloudflareDelegatedDcvReady",
  "cloudflareFullToPartialConversionReviewed",
  "cloudflarePartialEligibilityConfirmed",
  "cloudflarePartialVerificationReady",
  "directCertificateCoversPublicHosts",
  "directDeliveryAccountReady",
  "directHttpRedirectsToHttps",
  "directIpv4Passed",
  "directIpv6Passed",
  "directRepresentativeHtmlPassed",
  "directSecurityContractPassed",
  "directSeoCompatibilityPassed",
  "deploymentAtomicityPassed",
  "githubPagesDnsCheckPassed",
  "githubPagesCertificateRenewalCompatibilityConfirmed",
  "githubPagesHttpsEnforced",
  "providerRollbackVersionReady",
  "parentDsAbsenceFreshlyProven",
  "providerUnsignedCandidateReady",
  "registrarNsChangeReviewed",
  "dnssecPostMigrationPlanReady",
  "releaseParityPassed",
  "trustedDualStackProofPassed",
];
const secretFieldPattern = /(?:api.?key|password|private.?key|secret|token)/iu;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const forbiddenDirectHostnames = new Set([
  "probpera.ru",
  "www.probpera.ru",
  "admin.probpera.ru",
]);

function makeBlockList(entries, family) {
  const blockList = new net.BlockList();
  for (const [address, prefix] of entries) {
    blockList.addSubnet(address, prefix, family);
  }
  return blockList;
}

const nonPublicIpv4 = makeBlockList(
  [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ],
  "ipv4"
);
const nonPublicIpv6 = makeBlockList(
  [
    ["::", 128],
    ["::1", 128],
    ["::ffff:0:0", 96],
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 32],
    ["2001:2::", 48],
    ["2001:10::", 28],
    ["2001:20::", 28],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
  ],
  "ipv6"
);
const globalUnicastIpv6 = makeBlockList([["2000::", 3]], "ipv6");
const cloudflareIpv4 = makeBlockList(
  [
    ["173.245.48.0", 20], ["103.21.244.0", 22], ["103.22.200.0", 22],
    ["103.31.4.0", 22], ["141.101.64.0", 18], ["108.162.192.0", 18],
    ["190.93.240.0", 20], ["188.114.96.0", 20], ["197.234.240.0", 22],
    ["198.41.128.0", 17], ["162.158.0.0", 15], ["104.16.0.0", 13],
    ["104.24.0.0", 14], ["172.64.0.0", 13], ["131.0.72.0", 22],
  ],
  "ipv4"
);
const cloudflareIpv6 = makeBlockList(
  [
    ["2400:cb00::", 32], ["2606:4700::", 32], ["2803:f800::", 32],
    ["2405:b500::", 32], ["2405:8100::", 32], ["2a06:98c0::", 29],
    ["2c0f:f248::", 32],
  ],
  "ipv6"
);

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    sorted(actual).every((value, index) => value === sorted(expected)[index])
  );
}

function normalizeIpAddress(value) {
  const family = net.isIP(value);
  if (family === 4) return value.split(".").map(Number).join(".");
  if (family === 6) {
    return new URL(`http://[${value}]/`).hostname.slice(1, -1).toLowerCase();
  }
  return null;
}

function normalizedAddressSet(values) {
  return Array.isArray(values) ? values.map(normalizeIpAddress).filter(Boolean).sort() : [];
}

function hasUniqueAddresses(values) {
  if (!Array.isArray(values)) return false;
  const normalized = normalizedAddressSet(values);
  return normalized.length === values.length && new Set(normalized).size === values.length;
}

function isGloballyRoutableNonCloudflareAddress(address, family) {
  if (net.isIP(address) !== family) return false;
  if (family === 4) {
    return !nonPublicIpv4.check(address, "ipv4") && !cloudflareIpv4.check(address, "ipv4");
  }
  return globalUnicastIpv6.check(address, "ipv6") &&
    !nonPublicIpv6.check(address, "ipv6") &&
    !cloudflareIpv6.check(address, "ipv6");
}

function collectSecretFields(value, prefix = "plan", findings = []) {
  if (!value || typeof value !== "object") return findings;
  for (const [key, child] of Object.entries(value)) {
    const fieldPath = `${prefix}.${key}`;
    if (secretFieldPattern.test(key)) findings.push(fieldPath);
    collectSecretFields(child, fieldPath, findings);
  }
  return findings;
}

function isCloudflarePartialTarget(value, host) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase().replace(/\.$/u, "");
  return normalized === `${host}.cdn.cloudflare.net`;
}

function isDirectDeliveryHostname(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase().replace(/\.$/u, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(normalized)) {
    return false;
  }
  return !forbiddenDirectHostnames.has(normalized) &&
    !normalized.endsWith(".cdn.cloudflare.net") &&
    !normalized.endsWith(".cloudflare.net");
}

function isReviewedRenewalEvidence(value, evidenceContent) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reviewedAt = Date.parse(value.reviewedAt);
  const content =
    typeof evidenceContent === "string" || Buffer.isBuffer(evidenceContent)
      ? Buffer.from(evidenceContent)
      : null;
  return value.schemaVersion === 1 &&
    ["github-support-confirmation", "observed-renewal-cycle"].includes(value.source) &&
    /^config\/dns\/evidence\/github-pages-renewal-[a-z0-9-]+\.md$/u.test(
      String(value.path || "")
    ) &&
    content !== null &&
    content.length >= 32 &&
    createHash("sha256").update(content).digest("hex") === value.evidenceSha256 &&
    sha256Pattern.test(String(value.evidenceSha256 || "")) &&
    /^https:\/\/github\.com\/Kosyat128\/probpera-literary-map\/pull\/[1-9][0-9]*$/u.test(
      String(value.reviewPullRequest || "")
    ) &&
    Number.isFinite(reviewedAt) &&
    reviewedAt <= Date.now() + 5 * 60_000 &&
    Date.now() - reviewedAt <= 90 * 24 * 60 * 60_000;
}

function isFreshParentDsEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const checkedAt = Date.parse(value.checkedAt);
  const now = Date.now();
  return value.status === "absent" &&
    value.parentZone === "ru" &&
    Number.isInteger(value.resolverQuorum) &&
    value.resolverQuorum >= 2 &&
    sha256Pattern.test(String(value.evidenceSha256 || "")) &&
    Number.isFinite(checkedAt) &&
    checkedAt <= now + 5 * 60_000 &&
    now - checkedAt <= 60 * 60_000;
}

export function validatePlan(
  plan,
  { requireReady = false, renewalEvidenceContent = null } = {}
) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(plan && typeof plan === "object" && !Array.isArray(plan), "plan must be an object");
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return errors;

  check(plan.schemaVersion === 1, "schemaVersion must be 1");
  check(["blocked", "ready"].includes(plan.status), "status must be blocked or ready");
  check(
    ["cloudflare-full", "geodns-ru-direct"].includes(plan.productionRoutingState),
    "productionRoutingState must be cloudflare-full or geodns-ru-direct"
  );
  if (plan.status === "blocked") {
    check(
      plan.productionRoutingState === "cloudflare-full",
      "a blocked plan must report the unchanged Cloudflare production route"
    );
  }
  check(plan.zone === "probpera.ru", "zone must be exactly probpera.ru");
  check(
    plan.canonicalOrigin === "https://probpera.ru",
    "canonicalOrigin must remain https://probpera.ru"
  );
  check(
    sameSet(plan.publicHosts, expectedPublicHosts),
    "publicHosts must contain only apex and www"
  );
  check(
    Array.isArray(plan.preserveHosts) &&
      plan.preserveHosts.includes("admin.probpera.ru") &&
      !plan.publicHosts?.some((host) => plan.preserveHosts.includes(host)),
    "admin.probpera.ru must be preserved and outside publicHosts"
  );
  check(
    sameSet(plan.preserveRecordTypes, expectedPreservedTypes),
    "NS/MX/TXT/CAA/SRV must all be preserved"
  );

  const origin = plan.contentOrigin || {};
  check(origin.provider === "github-pages", "content origin must be GitHub Pages");
  check(
    String(origin.hostname || "").toLowerCase() === "kosyat128.github.io",
    "GitHub Pages hostname must be Kosyat128.github.io"
  );
  check(sameSet(origin.ipv4, expectedIpv4), "GitHub Pages IPv4 set is incomplete or changed");
  check(sameSet(origin.ipv6, expectedIpv6), "GitHub Pages IPv6 set is incomplete or changed");
  check(origin.ipv4?.every((address) => net.isIP(address) === 4), "invalid IPv4 address");
  check(origin.ipv6?.every((address) => net.isIP(address) === 6), "invalid IPv6 address");

  const directDelivery = plan.directDelivery || {};
  check(
    ["unselected", "github-pages", "custom-edge"].includes(directDelivery.mode),
    "direct delivery mode must be unselected, github-pages, or custom-edge"
  );
  check(
    typeof directDelivery.accountReady === "boolean" &&
      typeof directDelivery.customCertificateReady === "boolean" &&
      typeof directDelivery.artifactSyncReady === "boolean" &&
      typeof directDelivery.securityPolicyReady === "boolean",
    "direct delivery readiness flags must be explicit booleans"
  );
  check(Array.isArray(directDelivery.ipv4), "direct delivery IPv4 targets must be an array");
  check(Array.isArray(directDelivery.ipv6), "direct delivery IPv6 targets must be an array");
  if (directDelivery.mode === "custom-edge") {
    check(
      isDirectDeliveryHostname(directDelivery.hostname),
      "custom edge hostname must be external and cannot self-loop through a public/admin host"
    );
    check(
      hasUniqueAddresses(directDelivery.ipv4) &&
        directDelivery.ipv4.length > 0 &&
        directDelivery.ipv4.every((address) =>
          isGloballyRoutableNonCloudflareAddress(address, 4)
        ),
      "custom edge IPv4 targets must be unique, globally routable, and outside Cloudflare"
    );
    check(
      hasUniqueAddresses(directDelivery.ipv6) &&
        directDelivery.ipv6.length > 0 &&
        directDelivery.ipv6.every((address) =>
          isGloballyRoutableNonCloudflareAddress(address, 6)
        ),
      "custom edge IPv6 targets must be unique, globally routable, and outside Cloudflare"
    );
    check(
      false,
      "custom edge cannot be ready until a provider-specific attested proof adapter is implemented"
    );
  }

  const ru = plan.routing?.ru || {};
  const global = plan.routing?.default || {};
  const admin = plan.routing?.admin || {};
  check(sameSet(ru.countries, ["RU"]), "RU policy must contain only country RU");
  check(ru.target === "direct-delivery", "RU policy must select direct-delivery");
  check(sameSet(ru.addressFamilies, ["A", "AAAA"]), "RU policy must cover A and AAAA");
  check(
    ru.aliasTargets && sameSet(Object.keys(ru.aliasTargets), expectedPublicHosts),
    "RU policy must define one direct ALIAS target per public host"
  );
  check(
    global.target === "cloudflare-partial",
    "default policy must select cloudflare-partial"
  );
  check(
    sameSet(global.addressFamilies, ["A", "AAAA"]),
    "default policy must cover A and AAAA"
  );
  check(
    global.cnameTargets &&
      sameSet(Object.keys(global.cnameTargets), expectedPublicHosts),
    "default policy must define one CNAME target per public host"
  );
  check(
    admin.target === "cloudflare-partial" &&
      admin.countries === "all" &&
      admin.applicationConfiguration === "preserve",
    "admin must remain on Cloudflare Partial for every geography"
  );
  check(
    Number.isInteger(plan.ttlSeconds) &&
      plan.ttlSeconds >= 60 &&
      plan.ttlSeconds <= 300,
    "routing TTL must be between 60 and 300 seconds"
  );

  check(
    sameSet(plan.cloudflarePartial?.requiredPlan, ["business", "enterprise"]),
    "Cloudflare Partial eligibility must require Business or Enterprise"
  );
  check(
    plan.cloudflarePartial?.cloudflareRegistrarAllowed === false,
    "the plan must reject Cloudflare Registrar with Partial setup"
  );
  check(
    typeof plan.cloudflarePartial?.advancedCertificateActive === "boolean" &&
      typeof plan.cloudflarePartial?.delegatedDcvReady === "boolean" &&
      typeof plan.cloudflarePartial?.verificationTxtReady === "boolean",
    "Cloudflare certificate/DCV/verification readiness must be explicit"
  );
  check(
    typeof origin.longTermCertificateRenewalConfirmed === "boolean",
    "direct origin certificate renewal compatibility must be explicit"
  );
  if (origin.longTermCertificateRenewalConfirmed === true) {
    check(
      isReviewedRenewalEvidence(
        origin.longTermCertificateRenewalEvidence,
        renewalEvidenceContent
      ),
      "long-term Pages renewal requires a hash-bound evidence file and reviewed PR declaration"
    );
  } else {
    check(
      origin.longTermCertificateRenewalEvidence === null,
      "unconfirmed Pages renewal must not include guessed evidence"
    );
  }
  check(
    plan.authoritativeProvider?.requiresEcsAndCountryFiltering === true &&
      plan.authoritativeProvider?.requiresApexAlias === true &&
      plan.authoritativeProvider?.requiresAtomicVersionActivation === true,
    "GeoDNS provider must support ECS/country, apex ALIAS, and atomic rollback"
  );
  const delegationSafety = plan.delegationSafety || {};
  check(
    ["unproven", "absent", "present"].includes(delegationSafety.parentDs?.status) &&
      typeof delegationSafety.providerUnsignedCandidateReady === "boolean" &&
      typeof delegationSafety.registrarNsChangeReviewed === "boolean" &&
      typeof delegationSafety.dnssecPostMigrationPlanReady === "boolean",
    "delegation and DNSSEC readiness must be explicit"
  );

  const secretFields = collectSecretFields(plan);
  check(
    secretFields.length === 0,
    `plan must not contain credential fields: ${secretFields.join(", ")}`
  );

  const preconditionObject = plan.preconditions || {};
  check(
    preconditionObject &&
      typeof preconditionObject === "object" &&
      !Array.isArray(preconditionObject) &&
      sameSet(Object.keys(preconditionObject), expectedPreconditions),
    "preconditions must contain the exact required production gate names"
  );
  const preconditions = expectedPreconditions.map((key) => preconditionObject[key]);
  check(
    preconditions.every((value) => typeof value === "boolean"),
    "every production precondition must be boolean"
  );
  const allPreconditionsPassed = preconditions.every((value) => value === true);
  const targetsReady = expectedPublicHosts.every((host) =>
    isCloudflarePartialTarget(global.cnameTargets?.[host], host)
  ) && isCloudflarePartialTarget(admin.cnameTarget, "admin.probpera.ru");
  const pagesDirectReady =
    directDelivery.mode === "github-pages" &&
    directDelivery.provider === "github-pages" &&
    directDelivery.accountReady === true &&
    String(directDelivery.hostname || "").toLowerCase() === "kosyat128.github.io" &&
    sameSet(directDelivery.ipv4, expectedIpv4) &&
    sameSet(directDelivery.ipv6, expectedIpv6) &&
    directDelivery.customCertificateReady === true &&
    directDelivery.certificateAutomation === "github-pages-managed" &&
    directDelivery.artifactSyncReady === true &&
    directDelivery.securityPolicyReady === true &&
    origin.longTermCertificateRenewalConfirmed === true;
  // A custom edge must eventually be validated by a provider-specific adapter
  // that independently attests the full DNS chain, ASN ownership, certificate
  // automation, and artifact parity. Inline JSON claims are deliberately never
  // sufficient to make this generic plan ready.
  const customEdgeReady = false;
  const directDeliveryReady = pagesDirectReady || customEdgeReady;
  const ruTargetsReady = expectedPublicHosts.every(
    (host) =>
      typeof directDelivery.hostname === "string" &&
      String(ru.aliasTargets?.[host] || "").toLowerCase().replace(/\.$/u, "") ===
        directDelivery.hostname.toLowerCase().replace(/\.$/u, "")
  );

  if (plan.status === "ready" || requireReady) {
    check(plan.status === "ready", "plan is intentionally blocked, not ready for apply");
    check(plan.authoritativeProvider?.accountReady === true, "GeoDNS account is not ready");
    check(plan.cloudflarePartial?.eligible === true, "Cloudflare Partial is not confirmed");
    check(
      plan.cloudflarePartial?.advancedCertificateActive === true &&
        plan.cloudflarePartial?.delegatedDcvReady === true &&
        plan.cloudflarePartial?.verificationTxtReady === true,
      "Advanced Certificate, delegated DCV, and verification TXT are not ready"
    );
    check(
      directDeliveryReady,
      "neither GitHub Pages renewal nor a custom-certificate direct edge is production-ready"
    );
    check(
      isFreshParentDsEvidence(delegationSafety.parentDs),
      "parent .ru DS absence needs fresh multi-resolver evidence"
    );
    check(
      delegationSafety.providerUnsignedCandidateReady === true &&
        delegationSafety.registrarNsChangeReviewed === true &&
        delegationSafety.dnssecPostMigrationPlanReady === true,
      "provider unsigned candidate, registrar NS change, and post-migration DNSSEC plan are not ready"
    );
    check(ruTargetsReady, "exact RU direct delivery ALIAS targets are missing");
    check(targetsReady, "exact Cloudflare Partial CNAME targets are missing");
    check(allPreconditionsPassed, "not all production preconditions have passed");
  } else {
    check(
      directDelivery.mode === "unselected" &&
        directDelivery.provider === null &&
        directDelivery.hostname === null &&
        Array.isArray(directDelivery.ipv4) &&
        directDelivery.ipv4.length === 0 &&
        Array.isArray(directDelivery.ipv6) &&
        directDelivery.ipv6.length === 0,
      "blocked plan must not guess a direct delivery provider or target"
    );
    check(
      expectedPublicHosts.every((host) => ru.aliasTargets?.[host] === null),
      "blocked plan must not guess RU direct ALIAS targets"
    );
    check(
      expectedPublicHosts.every((host) => global.cnameTargets?.[host] === null),
      "blocked plan must not guess Cloudflare Partial targets"
    );
    check(admin.cnameTarget === null, "blocked plan must not guess the admin Partial target");
  }

  return errors;
}

function parseArguments(argv) {
  const options = { file: defaultPlanPath, requireReady: false };
  for (const argument of argv) {
    if (argument === "--require-ready") options.requireReady = true;
    else if (argument.startsWith("--file=")) options.file = path.resolve(argument.slice(7));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const plan = JSON.parse(await fs.readFile(options.file, "utf8"));
  let renewalEvidenceContent = null;
  const evidencePath = plan.contentOrigin?.longTermCertificateRenewalEvidence?.path;
  if (typeof evidencePath === "string") {
    const resolved = path.resolve(projectRoot, evidencePath);
    const evidenceRoot = path.join(projectRoot, "config", "dns", "evidence");
    const relative = path.relative(evidenceRoot, resolved);
    if (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`)) {
      try {
        renewalEvidenceContent = await fs.readFile(resolved);
      } catch {
        renewalEvidenceContent = null;
      }
    }
  }
  const errors = validatePlan(plan, {
    requireReady: options.requireReady,
    renewalEvidenceContent,
  });
  const summary = {
    status: errors.length ? "failed" : plan.status,
    schemaVersion: plan.schemaVersion,
    zone: plan.zone,
    readyForApply: errors.length === 0 && plan.status === "ready",
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exitCode = 1;
  return summary;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  await run();
}
