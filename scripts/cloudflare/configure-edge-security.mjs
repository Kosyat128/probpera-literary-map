import path from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_ZONE_NAME = "probpera.ru";
export const RESPONSE_HEADERS_PHASE = "http_response_headers_transform";
export const CACHE_SETTINGS_PHASE = "http_request_cache_settings";
export const MANAGED_RULE_REF = "probpera-public-security-response-headers-v1";
export const MANAGED_RULE_DESCRIPTION =
  "PROBPERA public security response headers (repository managed)";
export const MANAGED_CACHE_RULE_REF =
  "probpera-public-immutable-assets-cache-v1";
export const MANAGED_CACHE_RULE_DESCRIPTION =
  "PROBPERA immutable Vite assets cache policy (repository managed)";

export const PUBLIC_CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors https://admin.probpera.ru; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; media-src 'self' blob: https:; worker-src 'self' blob:; upgrade-insecure-requests";

export const PUBLIC_SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": Object.freeze({
    operation: "set",
    value: "nosniff",
  }),
  "Referrer-Policy": Object.freeze({
    operation: "set",
    value: "strict-origin-when-cross-origin",
  }),
  "Permissions-Policy": Object.freeze({
    operation: "set",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  }),
  "Cross-Origin-Opener-Policy": Object.freeze({
    operation: "set",
    value: "same-origin",
  }),
  "Strict-Transport-Security": Object.freeze({
    operation: "set",
    value: "max-age=31536000",
  }),
  "Content-Security-Policy": Object.freeze({
    operation: "set",
    value: PUBLIC_CONTENT_SECURITY_POLICY,
  }),
});

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_ID = /^[a-f0-9]{32}$/u;
const MAX_ERROR_LENGTH = 600;

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function requireCloudflareId(value, name) {
  const identifier = requireString(value, name);
  if (!CLOUDFLARE_ID.test(identifier)) {
    throw new Error(`${name} must be a 32-character lowercase hexadecimal identifier`);
  }
  return identifier;
}

export function redactSensitive(value, secrets = []) {
  let output = String(value ?? "");
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 4) {
      output = output.replaceAll(secret, "[REDACTED]");
    }
  }
  output = output
    .replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/\b[a-f0-9]{32}\b/giu, "[REDACTED_ID]");
  return output.slice(0, MAX_ERROR_LENGTH);
}

function formatApiErrors(payload, secrets) {
  const errors = Array.isArray(payload?.errors) ? payload.errors.slice(0, 3) : [];
  if (!errors.length) return "Cloudflare returned an unsuccessful response";
  return errors
    .map((error) => {
      const code = Number.isFinite(error?.code) ? `[${error.code}] ` : "";
      const message = typeof error?.message === "string" ? error.message : "API error";
      return `${code}${message}`;
    })
    .map((message) => redactSensitive(message, secrets))
    .join("; ");
}

class CloudflareClient {
  constructor({ token, accountId, fetchImpl, baseUrl, timeoutMs }) {
    this.token = requireString(token, "CLOUDFLARE_API_TOKEN");
    this.accountId = requireCloudflareId(accountId, "CLOUDFLARE_ACCOUNT_ID");
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/+$/u, "");
    this.timeoutMs = timeoutMs;
    this.secrets = new Set([this.token, this.accountId]);
  }

  addSecret(value) {
    if (typeof value === "string" && value) this.secrets.add(value);
  }

  async request(method, resource, body) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${resource}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "User-Agent": "ProbPeraEdgeConfigurator/1.0",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cloudflare API request failed before a response: ${redactSensitive(detail, this.secrets)}`
      );
    }

    const responseText = await response.text();
    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      throw new Error(
        `Cloudflare API returned non-JSON data (HTTP ${response.status}); response body withheld`
      );
    }

    if (!response.ok || payload?.success !== true) {
      const detail = formatApiErrors(payload, this.secrets);
      throw new Error(`Cloudflare API request failed (HTTP ${response.status}): ${detail}`);
    }
    if (!("result" in payload)) {
      throw new Error("Cloudflare API response did not include result");
    }
    return payload;
  }
}

export function desiredPublicHeaderRule(zoneName = PUBLIC_ZONE_NAME) {
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This configurator is locked to ${PUBLIC_ZONE_NAME}`);
  }
  return {
    ref: MANAGED_RULE_REF,
    expression: `(http.host eq "${zoneName}")`,
    description: MANAGED_RULE_DESCRIPTION,
    action: "rewrite",
    action_parameters: {
      headers: PUBLIC_SECURITY_HEADERS,
    },
    enabled: true,
  };
}

export function desiredImmutableAssetCacheRule(zoneName = PUBLIC_ZONE_NAME) {
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This configurator is locked to ${PUBLIC_ZONE_NAME}`);
  }
  return {
    ref: MANAGED_CACHE_RULE_REF,
    expression: `(http.host eq "${zoneName}" and starts_with(http.request.uri.path, "/assets/"))`,
    description: MANAGED_CACHE_RULE_DESCRIPTION,
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      edge_ttl: {
        mode: "override_origin",
        default: 31_536_000,
        status_code_ttl: [
          { status_code_range: { from: 200, to: 299 }, value: 31_536_000 },
          { status_code_range: { from: 300, to: 499 }, value: 0 },
          { status_code_range: { from: 500, to: 599 }, value: -1 },
        ],
      },
      browser_ttl: {
        mode: "override_origin",
        default: 31_536_000,
      },
    },
    enabled: true,
  };
}

function normalizeExpression(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return null;
  const entries = Object.entries(headers).map(([name, operation]) => [
    name.toLowerCase(),
    {
      operation: operation?.operation,
      ...(operation?.value === undefined ? {} : { value: operation.value }),
      ...(operation?.expression === undefined
        ? {}
        : { expression: operation.expression }),
    },
  ]);
  const names = entries.map(([name]) => name);
  if (new Set(names).size !== names.length) return null;
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function comparableRule(rule) {
  return {
    ref: rule?.ref,
    expression: normalizeExpression(rule?.expression),
    description: rule?.description,
    action: rule?.action,
    action_parameters: {
      headers: normalizeHeaders(rule?.action_parameters?.headers),
    },
    enabled: rule?.enabled !== false,
  };
}

export function managedRuleIsCurrent(rule, zoneName = PUBLIC_ZONE_NAME) {
  return (
    JSON.stringify(comparableRule(rule)) ===
    JSON.stringify(comparableRule(desiredPublicHeaderRule(zoneName)))
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  );
}

function comparableCacheRule(rule) {
  return canonicalize({
    ref: rule?.ref,
    expression: normalizeExpression(rule?.expression),
    description: rule?.description,
    action: rule?.action,
    action_parameters: rule?.action_parameters,
    enabled: rule?.enabled !== false,
  });
}

export function managedCacheRuleIsCurrent(rule, zoneName = PUBLIC_ZONE_NAME) {
  return (
    JSON.stringify(comparableCacheRule(rule)) ===
    JSON.stringify(comparableCacheRule(desiredImmutableAssetCacheRule(zoneName)))
  );
}

function targetHeaderNames() {
  return new Set(Object.keys(PUBLIC_SECURITY_HEADERS).map((name) => name.toLowerCase()));
}

function touchesManagedHeader(rule) {
  const headers = normalizeHeaders(rule?.action_parameters?.headers);
  if (!headers) return false;
  const managedNames = targetHeaderNames();
  return Object.keys(headers).some((name) => managedNames.has(name));
}

function couldConflictWithPublicRule(rule, zoneName) {
  if (rule?.enabled === false || rule?.action !== "rewrite" || !touchesManagedHeader(rule)) {
    return false;
  }
  const expression = normalizeExpression(rule.expression);
  const desiredExpression = normalizeExpression(desiredPublicHeaderRule(zoneName).expression);
  if (expression === desiredExpression || expression === "true") return true;

  // Only a simple equality for a different host is provably disjoint. More
  // complex expressions may still match the apex, so fail closed instead of
  // attempting to evaluate the Cloudflare rules language locally.
  const disjointHost = expression.match(
    /^\(?\s*http\.host\s+eq\s+"([a-z0-9.-]+)"\s*\)?$/u
  )?.[1];
  return !disjointHost || disjointHost === zoneName;
}

function validateZoneResult(payload, accountId, zoneName) {
  if (!Array.isArray(payload.result) || payload.result.length !== 1) {
    throw new Error(`Expected exactly one active Cloudflare zone named ${zoneName}`);
  }
  if (Number(payload.result_info?.total_pages || 1) > 1) {
    throw new Error("Cloudflare zone discovery returned an incomplete paginated result");
  }
  const zone = payload.result[0];
  if (
    zone?.name !== zoneName ||
    zone?.status !== "active" ||
    zone?.account?.id !== accountId
  ) {
    throw new Error(`Cloudflare zone identity did not match active ${zoneName}`);
  }
  requireCloudflareId(zone.id, "Cloudflare zone id");
  return zone;
}

async function discoverZone(client, accountId, zoneName) {
  const query = new URLSearchParams({
    name: zoneName,
    status: "active",
    "account.id": accountId,
    match: "all",
    page: "1",
    per_page: "50",
  });
  const payload = await client.request("GET", `/zones?${query.toString()}`);
  const zone = validateZoneResult(payload, accountId, zoneName);
  client.addSecret(zone.id);
  return zone;
}

async function readAlwaysUseHttps(client, zoneId) {
  const payload = await client.request(
    "GET",
    `/zones/${zoneId}/settings/always_use_https`
  );
  const setting = payload.result;
  if (
    setting?.id !== "always_use_https" ||
    !["on", "off"].includes(setting?.value)
  ) {
    throw new Error("Cloudflare returned an invalid always_use_https setting");
  }
  if (setting.value === "off" && setting.editable === false) {
    throw new Error("Cloudflare always_use_https is off and not editable for this zone");
  }
  return setting;
}

function validateRulesetList(payload, phase) {
  if (!Array.isArray(payload.result)) {
    throw new Error("Cloudflare ruleset listing did not return an array");
  }
  if (Number(payload.result_info?.total_pages || 1) > 1) {
    throw new Error("Cloudflare ruleset listing is paginated; refusing an incomplete inspection");
  }
  const phaseRulesets = payload.result.filter(
    (ruleset) =>
      ruleset?.kind === "zone" && ruleset?.phase === phase
  );
  if (phaseRulesets.length > 1) {
    throw new Error(`Cloudflare returned multiple zone entry-point rulesets for ${phase}`);
  }
  return phaseRulesets[0] || null;
}

async function readPhaseRuleset(client, zoneId, phase) {
  const listing = await client.request(
    "GET",
    `/zones/${zoneId}/rulesets?page=1&per_page=50`
  );
  const summary = validateRulesetList(listing, phase);
  if (!summary) return null;

  const rulesetId = requireCloudflareId(summary.id, "Cloudflare ruleset id");
  client.addSecret(rulesetId);
  const payload = await client.request("GET", `/zones/${zoneId}/rulesets/${rulesetId}`);
  const ruleset = payload.result;
  if (
    ruleset?.id !== rulesetId ||
    ruleset?.kind !== "zone" ||
    ruleset?.phase !== phase ||
    !Array.isArray(ruleset?.rules)
  ) {
    throw new Error(`Cloudflare returned an invalid ${phase} ruleset definition`);
  }
  return ruleset;
}

async function readResponseHeaderRuleset(client, zoneId) {
  return readPhaseRuleset(client, zoneId, RESPONSE_HEADERS_PHASE);
}

async function readCacheRuleset(client, zoneId) {
  return readPhaseRuleset(client, zoneId, CACHE_SETTINGS_PHASE);
}

export function planManagedRule(ruleset, zoneName = PUBLIC_ZONE_NAME) {
  const rules = ruleset?.rules || [];
  const matches = rules.filter((rule) => rule?.ref === MANAGED_RULE_REF);
  if (matches.length > 1) {
    throw new Error(`Cloudflare contains duplicate rules with ref ${MANAGED_RULE_REF}`);
  }

  const target = matches[0] || null;
  if (target) requireCloudflareId(target.id, "Cloudflare managed rule id");

  const conflicts = rules.filter(
    (rule) =>
      rule !== target &&
      (rule?.description === MANAGED_RULE_DESCRIPTION ||
        couldConflictWithPublicRule(rule, zoneName))
  );
  if (conflicts.length) {
    throw new Error(
      "Cloudflare contains another response-header rule that can conflict with the managed public rule"
    );
  }

  return {
    operation: !ruleset
      ? "create-ruleset"
      : !target
        ? "create-rule"
        : managedRuleIsCurrent(target, zoneName)
          ? "none"
          : "update-rule",
    target,
    unrelatedRuleCount: rules.length - (target ? 1 : 0),
  };
}

function cacheRuleCouldOverlapAssets(rule, zoneName) {
  if (rule?.enabled === false || rule?.action !== "set_cache_settings") return false;
  const expression = normalizeExpression(rule.expression);
  const disjointHost = expression.match(
    /^\(?\s*http\.host\s+eq\s+"([a-z0-9.-]+)"\s*\)?$/u
  )?.[1];
  return !disjointHost || disjointHost === zoneName;
}

export function planManagedCacheRule(ruleset, zoneName = PUBLIC_ZONE_NAME) {
  const rules = ruleset?.rules || [];
  const matches = rules.filter((rule) => rule?.ref === MANAGED_CACHE_RULE_REF);
  if (matches.length > 1) {
    throw new Error(`Cloudflare contains duplicate rules with ref ${MANAGED_CACHE_RULE_REF}`);
  }

  const target = matches[0] || null;
  if (target) requireCloudflareId(target.id, "Cloudflare managed cache rule id");

  const conflicts = rules.filter(
    (rule) =>
      rule !== target &&
      (rule?.description === MANAGED_CACHE_RULE_DESCRIPTION ||
        cacheRuleCouldOverlapAssets(rule, zoneName))
  );
  if (conflicts.length) {
    throw new Error(
      "Cloudflare contains another cache rule that may overlap the immutable public assets rule"
    );
  }

  return {
    operation: !ruleset
      ? "create-cache-ruleset"
      : !target
        ? "create-cache-rule"
        : managedCacheRuleIsCurrent(target, zoneName)
          ? "none"
          : "update-cache-rule",
    target,
    unrelatedRuleCount: rules.length - (target ? 1 : 0),
  };
}

async function inspectConfiguration(client, accountId, zoneName) {
  const zone = await discoverZone(client, accountId, zoneName);
  const [alwaysUseHttps, ruleset, cacheRuleset] = await Promise.all([
    readAlwaysUseHttps(client, zone.id),
    readResponseHeaderRuleset(client, zone.id),
    readCacheRuleset(client, zone.id),
  ]);
  const rulePlan = planManagedRule(ruleset, zoneName);
  const cacheRulePlan = planManagedCacheRule(cacheRuleset, zoneName);
  return {
    zone,
    alwaysUseHttps,
    ruleset,
    rulePlan,
    cacheRuleset,
    cacheRulePlan,
    plannedChanges: [
      ...(alwaysUseHttps.value === "on" ? [] : ["enable-always-use-https"]),
      ...(rulePlan.operation === "none" ? [] : [rulePlan.operation]),
      ...(cacheRulePlan.operation === "none" ? [] : [cacheRulePlan.operation]),
    ],
  };
}

async function applyRulePlan(client, state, zoneName) {
  const zoneId = state.zone.id;
  const desiredRule = desiredPublicHeaderRule(zoneName);
  switch (state.rulePlan.operation) {
    case "none":
      return;
    case "create-ruleset":
      await client.request("POST", `/zones/${zoneId}/rulesets`, {
        name: "PROBPERA managed response headers",
        description: "Zone-level response headers managed by the PROBPERA repository",
        kind: "zone",
        phase: RESPONSE_HEADERS_PHASE,
        rules: [desiredRule],
      });
      return;
    case "create-rule":
      await client.request(
        "POST",
        `/zones/${zoneId}/rulesets/${state.ruleset.id}/rules`,
        desiredRule
      );
      return;
    case "update-rule":
      await client.request(
        "PATCH",
        `/zones/${zoneId}/rulesets/${state.ruleset.id}/rules/${state.rulePlan.target.id}`,
        desiredRule
      );
      return;
    default:
      throw new Error("Unknown Cloudflare response-header rule plan");
  }
}

async function applyCacheRulePlan(client, state, zoneName) {
  const zoneId = state.zone.id;
  const desiredRule = desiredImmutableAssetCacheRule(zoneName);
  switch (state.cacheRulePlan.operation) {
    case "none":
      return;
    case "create-cache-ruleset":
      await client.request("POST", `/zones/${zoneId}/rulesets`, {
        name: "PROBPERA immutable public assets cache",
        description: "Zone-level cache rules managed by the PROBPERA repository",
        kind: "zone",
        phase: CACHE_SETTINGS_PHASE,
        rules: [desiredRule],
      });
      return;
    case "create-cache-rule":
      await client.request(
        "POST",
        `/zones/${zoneId}/rulesets/${state.cacheRuleset.id}/rules`,
        desiredRule
      );
      return;
    case "update-cache-rule":
      await client.request(
        "PATCH",
        `/zones/${zoneId}/rulesets/${state.cacheRuleset.id}/rules/${state.cacheRulePlan.target.id}`,
        desiredRule
      );
      return;
    default:
      throw new Error("Unknown Cloudflare immutable asset cache rule plan");
  }
}

export async function configureCloudflareEdge(options) {
  const zoneName = options?.zoneName || PUBLIC_ZONE_NAME;
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This configurator is locked to ${PUBLIC_ZONE_NAME}`);
  }
  const accountId = requireCloudflareId(
    options?.accountId,
    "CLOUDFLARE_ACCOUNT_ID"
  );
  const apply = options?.apply === true;
  const client = new CloudflareClient({
    token: options?.token,
    accountId,
    fetchImpl: options?.fetchImpl || globalThis.fetch,
    baseUrl: options?.baseUrl || CLOUDFLARE_API_BASE,
    timeoutMs: options?.timeoutMs || 20_000,
  });

  const state = await inspectConfiguration(client, accountId, zoneName);
  if (!apply) {
    return {
      mode: "dry-run",
      zone: zoneName,
      active: true,
      plannedChanges: state.plannedChanges,
      appliedChanges: [],
      unrelatedResponseHeaderRulesPreserved: state.rulePlan.unrelatedRuleCount,
      unrelatedCacheRulesPreserved: state.cacheRulePlan.unrelatedRuleCount,
    };
  }

  // Apply the optional optimization first. If the zone plan or token does not
  // support Cache Rules, security settings are left untouched.
  await applyCacheRulePlan(client, state, zoneName);
  if (state.alwaysUseHttps.value !== "on") {
    await client.request(
      "PATCH",
      `/zones/${state.zone.id}/settings/always_use_https`,
      { value: "on" }
    );
  }
  await applyRulePlan(client, state, zoneName);

  const [verifiedSetting, verifiedRuleset, verifiedCacheRuleset] = await Promise.all([
    readAlwaysUseHttps(client, state.zone.id),
    readResponseHeaderRuleset(client, state.zone.id),
    readCacheRuleset(client, state.zone.id),
  ]);
  const verifiedPlan = planManagedRule(verifiedRuleset, zoneName);
  const verifiedCachePlan = planManagedCacheRule(verifiedCacheRuleset, zoneName);
  if (
    verifiedSetting.value !== "on" ||
    verifiedPlan.operation !== "none" ||
    verifiedCachePlan.operation !== "none"
  ) {
    throw new Error("Cloudflare post-apply verification did not match the requested policy");
  }

  return {
    mode: "apply",
    zone: zoneName,
    active: true,
    plannedChanges: state.plannedChanges,
    appliedChanges: state.plannedChanges,
    unrelatedResponseHeaderRulesPreserved: verifiedPlan.unrelatedRuleCount,
    unrelatedCacheRulesPreserved: verifiedCachePlan.unrelatedRuleCount,
  };
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
    if (!["apply", "zone"].includes(name)) throw new Error(`Unknown argument: --${name}`);
  }
  const applyValue = values.get("apply") ?? "false";
  if (!["true", "false"].includes(applyValue)) {
    throw new Error("--apply must be exactly true or false");
  }
  const zoneName = values.get("zone") || PUBLIC_ZONE_NAME;
  return { apply: applyValue === "true", zoneName };
}

function summarize(result) {
  const changes = result.plannedChanges.length
    ? result.plannedChanges.join(", ")
    : "none";
  const outcome = result.mode === "apply" ? "applied and verified" : "planned only";
  return [
    `Cloudflare edge mode: ${result.mode}`,
    `Zone: ${result.zone} (active and account-verified)`,
    `Changes: ${changes} (${outcome})`,
    `Unrelated response-header rules preserved: ${result.unrelatedResponseHeaderRulesPreserved}`,
    `Unrelated cache rules preserved: ${result.unrelatedCacheRulesPreserved}`,
  ].join("\n");
}

async function main() {
  const cli = parseCliOptions(process.argv.slice(2));
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.ACCOUNT_ID;
  try {
    const result = await configureCloudflareEdge({
      ...cli,
      token,
      accountId,
    });
    console.log(summarize(result));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Cloudflare edge configuration failed: ${redactSensitive(detail, [token, accountId])}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) await main();
