import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  MANAGED_RULE_REF,
  PUBLIC_CONTENT_SECURITY_POLICY,
  configureCloudflareEdge,
  desiredImmutableAssetCacheRule,
  desiredPublicHeaderRule,
  planManagedCacheRule,
  planManagedRule,
  redactSensitive,
} from "./configure-edge-security.mjs";

const accountId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const zoneId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const rulesetId = "cccccccccccccccccccccccccccccccc";
const managedRuleId = "dddddddddddddddddddddddddddddddd";
const cacheRulesetId = "11111111111111111111111111111111";
const managedCacheRuleId = "22222222222222222222222222222222";
const token = "cloudflare-test-token-never-print";

function success(result, resultInfo) {
  return {
    success: true,
    errors: [],
    messages: [],
    result,
    ...(resultInfo ? { result_info: resultInfo } : {}),
  };
}

function apiResponse(result, resultInfo) {
  return new Response(JSON.stringify(success(result, resultInfo)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function zoneResult(overrides = {}) {
  return {
    id: zoneId,
    name: "probpera.ru",
    status: "active",
    account: { id: accountId },
    ...overrides,
  };
}

function rulesetResult(rules) {
  return {
    id: rulesetId,
    name: "Default",
    description: "existing entry point",
    kind: "zone",
    phase: "http_response_headers_transform",
    rules,
  };
}

function managedRule(overrides = {}) {
  return {
    id: managedRuleId,
    ...desiredPublicHeaderRule(),
    ...overrides,
  };
}

function managedCacheRule(overrides = {}) {
  return {
    id: managedCacheRuleId,
    ...desiredImmutableAssetCacheRule(),
    ...overrides,
  };
}

function unrelatedRule() {
  return {
    id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    ref: "unrelated-origin-header",
    expression: '(http.host eq "admin.probpera.ru")',
    description: "unrelated admin header",
    action: "rewrite",
    action_parameters: {
      headers: {
        "X-Unrelated": { operation: "set", value: "preserve-me" },
      },
    },
    enabled: true,
  };
}

function makeFetch(options = {}) {
  const calls = [];
  const fetchImpl = async (urlValue, init) => {
    const alwaysUseHttps = options.alwaysUseHttps ?? "on";
    const rules = options.rules ?? [unrelatedRule(), managedRule()];
    const cacheRules = options.cacheRules ?? [managedCacheRule()];
    const zone = options.zone ?? zoneResult();
    const url = new URL(urlValue);
    const resource = `${url.pathname}${url.search}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, resource, body, authorization: init.headers.Authorization });

    if (init.method === "GET" && url.pathname === "/client/v4/zones") {
      return apiResponse([zone], { page: 1, per_page: 50, total_pages: 1 });
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/settings/always_use_https`
    ) {
      return apiResponse({
        id: "always_use_https",
        value: alwaysUseHttps,
        editable: true,
      });
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/rulesets`
    ) {
      return apiResponse(
        [
          { id: rulesetId, kind: "zone", phase: "http_response_headers_transform" },
          { id: cacheRulesetId, kind: "zone", phase: "http_request_cache_settings" },
        ],
        { page: 1, per_page: 50, total_pages: 1 }
      );
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/rulesets/${rulesetId}`
    ) {
      return apiResponse(rulesetResult(rules));
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/rulesets/${cacheRulesetId}`
    ) {
      return apiResponse({
        id: cacheRulesetId,
        name: "Cache rules",
        description: "existing cache entry point",
        kind: "zone",
        phase: "http_request_cache_settings",
        rules: cacheRules,
      });
    }
    if (options.mutate) return options.mutate({ url, init, body, calls });
    throw new Error(`Unexpected mutation: ${init.method} ${url.pathname}`);
  };
  return { fetchImpl, calls };
}

describe("Cloudflare public edge security configurator", () => {
  it("uses the exact public policy and never broadens the rule beyond the apex host", () => {
    const rule = desiredPublicHeaderRule();
    expect(rule.ref).toBe(MANAGED_RULE_REF);
    expect(rule.expression).toBe('(http.host eq "probpera.ru")');
    expect(rule.enabled).toBe(true);
    expect(rule.action_parameters.headers["Content-Security-Policy"].value).toBe(
      PUBLIC_CONTENT_SECURITY_POLICY
    );
    expect(rule.action_parameters.headers["Permissions-Policy"].value).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()"
    );

    const cacheRule = desiredImmutableAssetCacheRule();
    expect(cacheRule.expression).toBe(
      '(http.host eq "probpera.ru" and starts_with(http.request.uri.path, "/assets/"))'
    );
    expect(cacheRule.expression).not.toContain("/textures/");
    expect(cacheRule.expression).not.toContain("/brand/");
    expect(cacheRule.action_parameters).toMatchObject({
      cache: true,
      browser_ttl: { mode: "override_origin", default: 31_536_000 },
      edge_ttl: { mode: "override_origin", default: 31_536_000 },
    });
    expect(existsSync("public/assets")).toBe(false);

    const publicBuilder = readFileSync("scripts/build-article-pages.mjs", "utf8");
    for (const [name, setting] of Object.entries(rule.action_parameters.headers)) {
      expect(publicBuilder).toContain(`${name}: ${setting.value}`);
    }
  });

  it("is idempotent and dry-run performs GET requests only", async () => {
    const { fetchImpl, calls } = makeFetch();
    const result = await configureCloudflareEdge({
      token,
      accountId,
      fetchImpl,
      apply: false,
    });

    expect(result).toEqual({
      mode: "dry-run",
      zone: "probpera.ru",
      active: true,
      plannedChanges: [],
      appliedChanges: [],
      unrelatedResponseHeaderRulesPreserved: 1,
      unrelatedCacheRulesPreserved: 0,
    });
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("patches only the stable managed rule and preserves unrelated rules", async () => {
    let rules = [
      unrelatedRule(),
      managedRule({ expression: '(http.host eq "www.probpera.ru")' }),
    ];
    let alwaysUseHttps = "off";
    const { fetchImpl, calls } = makeFetch({
      get alwaysUseHttps() {
        return alwaysUseHttps;
      },
      get rules() {
        return rules;
      },
      mutate({ url, init, body }) {
        if (
          init.method === "PATCH" &&
          url.pathname === `/client/v4/zones/${zoneId}/settings/always_use_https`
        ) {
          expect(body).toEqual({ value: "on" });
          alwaysUseHttps = "on";
          return apiResponse({ id: "always_use_https", value: "on", editable: true });
        }
        if (
          init.method === "PATCH" &&
          url.pathname ===
            `/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules/${managedRuleId}`
        ) {
          expect(body).toEqual(desiredPublicHeaderRule());
          expect(body).not.toHaveProperty("rules");
          rules = [unrelatedRule(), managedRule()];
          return apiResponse(rulesetResult(rules));
        }
        throw new Error(`Unexpected mutation: ${init.method} ${url.pathname}`);
      },
    });

    const result = await configureCloudflareEdge({
      token,
      accountId,
      fetchImpl,
      apply: true,
    });
    expect(result.appliedChanges).toEqual([
      "enable-always-use-https",
      "update-rule",
    ]);
    expect(result.unrelatedResponseHeaderRulesPreserved).toBe(1);
    expect(result.unrelatedCacheRulesPreserved).toBe(0);
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(2);
    expect(rules[0]).toEqual(unrelatedRule());
  });

  it("adds one rule without submitting or replacing the unrelated rules array", async () => {
    let rules = [unrelatedRule()];
    const { fetchImpl, calls } = makeFetch({
      get rules() {
        return rules;
      },
      mutate({ url, init, body }) {
        if (
          init.method === "POST" &&
          url.pathname === `/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules`
        ) {
          expect(body).toEqual(desiredPublicHeaderRule());
          expect(body).not.toHaveProperty("rules");
          rules = [unrelatedRule(), managedRule()];
          return apiResponse(rulesetResult(rules));
        }
        throw new Error(`Unexpected mutation: ${init.method} ${url.pathname}`);
      },
    });

    const result = await configureCloudflareEdge({
      token,
      accountId,
      fetchImpl,
      apply: true,
    });
    expect(result.appliedChanges).toEqual(["create-rule"]);
    const post = calls.find((call) => call.method === "POST");
    expect(post.resource).toBe(
      `/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules`
    );
  });

  it("fails closed for the wrong account, duplicate ref, and a conflicting rule", async () => {
    const wrongAccount = makeFetch({
      zone: zoneResult({ account: { id: "ffffffffffffffffffffffffffffffff" } }),
    });
    await expect(
      configureCloudflareEdge({ token, accountId, fetchImpl: wrongAccount.fetchImpl })
    ).rejects.toThrow("zone identity did not match");

    expect(() =>
      planManagedRule(rulesetResult([managedRule(), managedRule({ id: zoneId })]))
    ).toThrow("duplicate rules");

    expect(() =>
      planManagedCacheRule({
        rules: [managedCacheRule(), managedCacheRule({ id: zoneId })],
      })
    ).toThrow("duplicate rules");

    expect(() =>
      planManagedRule(
        rulesetResult([
          managedRule(),
          {
            id: zoneId,
            ref: "manual-hsts",
            expression: "true",
            action: "rewrite",
            action_parameters: {
              headers: {
                "Strict-Transport-Security": {
                  operation: "set",
                  value: "max-age=300",
                },
              },
            },
          },
        ])
      )
    ).toThrow("can conflict");
  });

  it("redacts tokens and Cloudflare identifiers from failures", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          success: false,
          result: null,
          errors: [{ code: 1000, message: `Bearer ${token} for ${accountId}` }],
          messages: [],
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );

    let failure;
    try {
      await configureCloudflareEdge({ token, accountId, fetchImpl });
    } catch (error) {
      failure = String(error);
    }
    expect(failure).not.toContain(token);
    expect(failure).not.toContain(accountId);
    expect(failure).toContain("[REDACTED]");
    expect(redactSensitive(`Bearer ${token} ${zoneId}`, [token, zoneId])).not.toContain(
      token
    );
  });

  it("keeps the manual workflow dry-run by default and gated by production controls", () => {
    const workflow = readFileSync(
      ".github/workflows/configure-cloudflare-edge-security.yml",
      "utf8"
    );
    expect(workflow).toContain("default: false");
    expect(workflow).toContain("name: production");
    expect(workflow).toContain("APPLY PROBPERA CLOUDFLARE EDGE");
    expect(workflow).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(workflow).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).toContain('git ls-remote --exit-code origin refs/heads/main');
    expect(workflow).not.toMatch(/echo[^\n]*(?:CLOUDFLARE_API_TOKEN|ACCOUNT_ID)=/u);
  });
});
