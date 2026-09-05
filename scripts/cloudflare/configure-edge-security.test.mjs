import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  MANAGED_HTTPS_REDIRECT_RULE_REF,
  MANAGED_RULE_REF,
  PUBLIC_CONTENT_SECURITY_POLICY,
  configureCloudflareEdge,
  desiredHttpsRedirectRule,
  desiredImmutableAssetCacheRule,
  desiredPublicHeaderRule,
  planManagedCacheRule,
  planManagedHttpsRedirectRule,
  planManagedRule,
  redactSensitive,
} from "./configure-edge-security.mjs";

const accountId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const zoneId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const rulesetId = "cccccccccccccccccccccccccccccccc";
const managedRuleId = "dddddddddddddddddddddddddddddddd";
const cacheRulesetId = "11111111111111111111111111111111";
const managedCacheRuleId = "22222222222222222222222222222222";
const redirectRulesetId = "33333333333333333333333333333333";
const managedRedirectRuleId = "44444444444444444444444444444444";
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

function managedRedirectRule(overrides = {}) {
  return {
    id: managedRedirectRuleId,
    ...desiredHttpsRedirectRule(),
    ...overrides,
  };
}

function unrelatedRedirectRule(overrides = {}) {
  return {
    id: "55555555555555555555555555555555",
    ref: "unrelated-https-canonical-path",
    expression: '(ssl and http.request.uri.path eq "/old")',
    description: "unrelated HTTPS canonical redirect",
    action: "redirect",
    action_parameters: {
      from_value: {
        target_url: { value: "https://probpera.ru/new" },
        status_code: 301,
        preserve_query_string: true,
      },
    },
    enabled: true,
    ...overrides,
  };
}

function overlappingRedirectRule(overrides = {}) {
  return unrelatedRedirectRule({
    ref: "unrelated-http-apex-redirect",
    expression:
      '(not ssl and http.host eq "probpera.ru" and http.request.uri.path eq "/old")',
    description: "unrelated HTTP apex redirect",
    ...overrides,
  });
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
    const redirectRulesetExists = options.redirectRulesetExists ?? true;
    const redirectRules = options.redirectRules ?? [managedRedirectRule()];
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
          ...(redirectRulesetExists
            ? [
                {
                  id: redirectRulesetId,
                  kind: "zone",
                  phase: "http_request_dynamic_redirect",
                },
              ]
            : []),
        ],
        { page: 1, per_page: 50, total_pages: 1 }
      );
    }
    if (
      init.method === "GET" &&
      url.pathname === `/client/v4/zones/${zoneId}/rulesets/${redirectRulesetId}`
    ) {
      return apiResponse({
        id: redirectRulesetId,
        name: "Redirect rules",
        description: "existing redirect entry point",
        kind: "zone",
        phase: "http_request_dynamic_redirect",
        rules: redirectRules,
      });
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
  it("permits the dedicated news API only in the connection policy", () => {
    const origin = "https://news.probpera.ru";
    const directives = PUBLIC_CONTENT_SECURITY_POLICY.split(";").map((directive) => directive.trim().split(/\s+/u));
    const connections = directives.find(([name]) => name === "connect-src").slice(1);
    expect(connections.filter((source) => source === origin)).toHaveLength(1);
    expect(connections).not.toContain("https://*.probpera.ru");
    expect(connections).not.toContain("https:");
    expect(connections).not.toContain("*");
    for (const [name, ...sources] of directives) {
      if (name !== "connect-src") expect(sources, name).not.toContain(origin);
    }
  });

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
      '(http.host eq "probpera.ru" and starts_with(http.request.uri.path, "/assets/") and not starts_with(http.request.uri.path, "/assets/country-flags/") and not starts_with(http.request.uri.path, "/assets/writer-portraits/"))'
    );
    expect(cacheRule.expression).not.toContain("/textures/");
    expect(cacheRule.expression).not.toContain("/brand/");
    expect(cacheRule.action_parameters).toMatchObject({
      cache: true,
      browser_ttl: { mode: "override_origin", default: 31_536_000 },
      edge_ttl: { mode: "override_origin", default: 31_536_000 },
    });
    const mutablePublicAssetDirectories = readdirSync("public/assets", {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(mutablePublicAssetDirectories).toEqual([
      "country-flags",
      "writer-portraits",
    ]);
    for (const directory of mutablePublicAssetDirectories) {
      expect(cacheRule.expression).toContain(
        `not starts_with(http.request.uri.path, "/assets/${directory}/")`
      );
    }

    const publicBuilder = readFileSync("scripts/build-article-pages.mjs", "utf8");
    for (const [name, setting] of Object.entries(rule.action_parameters.headers)) {
      expect(publicBuilder).toContain(`${name}: ${setting.value}`);
    }

    const redirectRule = desiredHttpsRedirectRule();
    expect(redirectRule.ref).toBe(MANAGED_HTTPS_REDIRECT_RULE_REF);
    expect(redirectRule.expression).toBe(
      '(not ssl and http.host in {"probpera.ru" "admin.probpera.ru"})'
    );
    expect(redirectRule.action_parameters).toEqual({
      from_value: {
        target_url: {
          expression: 'concat("https://", http.host, http.request.uri.path)',
        },
        status_code: 308,
        preserve_query_string: true,
      },
    });
    expect(
      planManagedHttpsRedirectRule({
        rules: [unrelatedRedirectRule(), managedRedirectRule()],
      }).operation
    ).toBe("none");
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
      unrelatedRedirectRulesPreserved: 0,
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
    expect(result.unrelatedRedirectRulesPreserved).toBe(0);
    expect(result.unrelatedCacheRulesPreserved).toBe(0);
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(2);
    expect(rules[0]).toEqual(unrelatedRule());
  });

  it("appends the managed HTTPS redirect without replacing or reordering unrelated redirects", async () => {
    let redirectRules = [unrelatedRedirectRule()];
    const { fetchImpl, calls } = makeFetch({
      get redirectRules() {
        return redirectRules;
      },
      mutate({ url, init, body }) {
        if (
          init.method === "POST" &&
          url.pathname ===
            `/client/v4/zones/${zoneId}/rulesets/${redirectRulesetId}/rules`
        ) {
          expect(body).toEqual({
            ...desiredHttpsRedirectRule(),
            position: { after: "" },
          });
          expect(body).not.toHaveProperty("rules");
          redirectRules = [unrelatedRedirectRule(), managedRedirectRule()];
          return apiResponse({
            id: redirectRulesetId,
            kind: "zone",
            phase: "http_request_dynamic_redirect",
            rules: redirectRules,
          });
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

    expect(result.appliedChanges).toEqual(["create-redirect-rule"]);
    expect(result.unrelatedRedirectRulesPreserved).toBe(1);
    expect(redirectRules[0]).toEqual(unrelatedRedirectRule());
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(1);
  });

  it("proves foreign redirect disjointness conservatively and ignores disabled rules", () => {
    expect(() =>
      planManagedHttpsRedirectRule({ rules: [overlappingRedirectRule()] })
    ).toThrow("not provably disjoint");
    expect(() =>
      planManagedHttpsRedirectRule({
        rules: [
          unrelatedRedirectRule({
            expression: '(http.request.uri.path eq "/old")',
          }),
        ],
      })
    ).toThrow("not provably disjoint");
    expect(() =>
      planManagedHttpsRedirectRule({
        rules: [
          unrelatedRedirectRule({
            expression: "(ssl and true xor not ssl)",
          }),
        ],
      })
    ).toThrow("not provably disjoint");
    expect(() =>
      planManagedHttpsRedirectRule({
        rules: [
          unrelatedRedirectRule({
            expression: "(ssl and true || not ssl)",
          }),
        ],
      })
    ).toThrow("not provably disjoint");
    expect(() =>
      planManagedHttpsRedirectRule({
        rules: [
          unrelatedRedirectRule({
            expression: "(ssl and true or(not ssl))",
          }),
        ],
      })
    ).toThrow("not provably disjoint");

    expect(
      planManagedHttpsRedirectRule({ rules: [unrelatedRedirectRule()] }).operation
    ).toBe("create-redirect-rule");
    expect(
      planManagedHttpsRedirectRule({
        rules: [
          unrelatedRedirectRule({
            expression:
              '(not ssl and http.host eq "www.probpera.ru" and http.request.uri.path eq "/old")',
          }),
        ],
      }).operation
    ).toBe("create-redirect-rule");
    expect(
      planManagedHttpsRedirectRule({
        rules: [
          unrelatedRedirectRule({
            expression:
              '((ssl and http.host eq "probpera.ru") or http.host in {"example.com" "admin.example.com"})',
          }),
        ],
      }).operation
    ).toBe("create-redirect-rule");
    expect(
      planManagedHttpsRedirectRule({
        rules: [overlappingRedirectRule({ enabled: false })],
      }).operation
    ).toBe("create-redirect-rule");
  });

  it("fails before every mutation when an enabled foreign redirect may overlap", async () => {
    const { fetchImpl, calls } = makeFetch({
      alwaysUseHttps: "off",
      redirectRules: [overlappingRedirectRule()],
    });

    await expect(
      configureCloudflareEdge({ token, accountId, fetchImpl, apply: true })
    ).rejects.toThrow("not provably disjoint");
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("updates only the managed redirect in place and preserves foreign rule order", async () => {
    const disabledOverlap = overlappingRedirectRule({
      id: "77777777777777777777777777777777",
      ref: "disabled-legacy-http-redirect",
      enabled: false,
    });
    let redirectRules = [
      unrelatedRedirectRule(),
      managedRedirectRule({ expression: '(http.host eq "www.probpera.ru")' }),
      disabledOverlap,
    ];
    const { fetchImpl, calls } = makeFetch({
      get redirectRules() {
        return redirectRules;
      },
      mutate({ url, init, body }) {
        if (
          init.method === "PATCH" &&
          url.pathname ===
            `/client/v4/zones/${zoneId}/rulesets/${redirectRulesetId}/rules/${managedRedirectRuleId}`
        ) {
          expect(body).toEqual(desiredHttpsRedirectRule());
          expect(body).not.toHaveProperty("position");
          redirectRules = [
            unrelatedRedirectRule(),
            managedRedirectRule(),
            disabledOverlap,
          ];
          return apiResponse({
            id: redirectRulesetId,
            kind: "zone",
            phase: "http_request_dynamic_redirect",
            rules: redirectRules,
          });
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

    expect(result.appliedChanges).toEqual(["update-redirect-rule"]);
    expect(result.unrelatedRedirectRulesPreserved).toBe(2);
    expect(redirectRules.map((rule) => rule.id)).toEqual([
      unrelatedRedirectRule().id,
      managedRedirectRuleId,
      disabledOverlap.id,
    ]);
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(1);
  });

  it("fails post-apply verification if a foreign redirect changes", async () => {
    let redirectRules = [unrelatedRedirectRule()];
    const { fetchImpl } = makeFetch({
      get redirectRules() {
        return redirectRules;
      },
      mutate({ url, init }) {
        if (
          init.method === "POST" &&
          url.pathname ===
            `/client/v4/zones/${zoneId}/rulesets/${redirectRulesetId}/rules`
        ) {
          redirectRules = [
            unrelatedRedirectRule({ description: "changed concurrently" }),
            managedRedirectRule(),
          ];
          return apiResponse({
            id: redirectRulesetId,
            kind: "zone",
            phase: "http_request_dynamic_redirect",
            rules: redirectRules,
          });
        }
        throw new Error(`Unexpected mutation: ${init.method} ${url.pathname}`);
      },
    });

    await expect(
      configureCloudflareEdge({ token, accountId, fetchImpl, apply: true })
    ).rejects.toThrow("post-apply verification");
  });

  it("preserves semantic whitespace inside foreign redirect string literals", () => {
    const withDoubleSpace = planManagedHttpsRedirectRule({
      rules: [
        unrelatedRedirectRule({
          expression: '(ssl and http.request.uri.path eq "/foo  bar")',
        }),
      ],
    });
    const withSingleSpace = planManagedHttpsRedirectRule({
      rules: [
        unrelatedRedirectRule({
          expression: '(ssl and http.request.uri.path eq "/foo bar")',
        }),
      ],
    });
    expect(withDoubleSpace.unrelatedRuleSnapshot).not.toEqual(
      withSingleSpace.unrelatedRuleSnapshot
    );
  });

  it("fails post-apply verification if Cloudflare does not keep a new fallback last", async () => {
    let redirectRules = [unrelatedRedirectRule()];
    const { fetchImpl } = makeFetch({
      get redirectRules() {
        return redirectRules;
      },
      mutate({ url, init }) {
        if (
          init.method === "POST" &&
          url.pathname ===
            `/client/v4/zones/${zoneId}/rulesets/${redirectRulesetId}/rules`
        ) {
          redirectRules = [managedRedirectRule(), unrelatedRedirectRule()];
          return apiResponse({
            id: redirectRulesetId,
            kind: "zone",
            phase: "http_request_dynamic_redirect",
            rules: redirectRules,
          });
        }
        throw new Error(`Unexpected mutation: ${init.method} ${url.pathname}`);
      },
    });

    await expect(
      configureCloudflareEdge({ token, accountId, fetchImpl, apply: true })
    ).rejects.toThrow("post-apply verification");
  });

  it("creates the zone redirect entry point when the phase does not exist", async () => {
    let redirectRulesetExists = false;
    let redirectRules = [];
    const { fetchImpl, calls } = makeFetch({
      get redirectRulesetExists() {
        return redirectRulesetExists;
      },
      get redirectRules() {
        return redirectRules;
      },
      mutate({ url, init, body }) {
        if (
          init.method === "POST" &&
          url.pathname === `/client/v4/zones/${zoneId}/rulesets`
        ) {
          expect(body).toEqual({
            name: "PROBPERA managed HTTPS redirects",
            description:
              "Zone-level HTTPS redirects managed by the PROBPERA repository",
            kind: "zone",
            phase: "http_request_dynamic_redirect",
            rules: [desiredHttpsRedirectRule()],
          });
          redirectRulesetExists = true;
          redirectRules = [managedRedirectRule()];
          return apiResponse({
            id: redirectRulesetId,
            ...body,
            rules: redirectRules,
          });
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

    expect(result.appliedChanges).toEqual(["create-redirect-ruleset"]);
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(1);
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
      planManagedHttpsRedirectRule({
        rules: [
          managedRedirectRule(),
          managedRedirectRule({ id: "66666666666666666666666666666666" }),
        ],
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
    expect(workflow).toContain("Verify live edge behavior after apply");
    expect(workflow).toContain("node scripts/audit-live-security.mjs --attempts=6");
    expect(workflow).not.toMatch(/echo[^\n]*(?:CLOUDFLARE_API_TOKEN|ACCOUNT_ID)=/u);
  });
});
