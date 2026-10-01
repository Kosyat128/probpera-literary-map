import { describe, expect, it, vi } from "vitest";
import { createCanonicalLicenseRateLimiter } from "./licenseRateLimiterSupabase";

const subject = "b7d3c04e-a59a-4bda-8db4-4b2f8c573e74", product = "fixture-base-v1";
function fixture() {
  let reply: unknown = { allowed: true, retry_after_seconds: 0 }, status = 200;
  const fetcher = vi.fn<typeof fetch>(async (_input, _init) => new Response(JSON.stringify(reply), {
    status, headers: { "Content-Type": "application/json" },
  }));
  const options = { canonicalProjectUrl: "https://license-budget.supabase.invalid", publishableKey: "qa-publishable-fixture",
    serviceRoleKey: "qa-service-role-fixture", recentAuthenticationSeconds: 300, fetch: fetcher };
  const policy = { limit: 2, windowSeconds: 60 };
  const limiter = createCanonicalLicenseRateLimiter(options, policy);
  return { options, policy, limiter, fetcher, reply: (value: unknown, code = 200) => { reply = value; status = code; } };
}

describe("canonical durable license grant budget adapter", () => {
  it("uses only the service RPC, captures explicit configuration and bounds transport without exposing keys", async () => {
    const f = fixture(); expect(f.fetcher).not.toHaveBeenCalled();
    const project = f.options.canonicalProjectUrl, key = f.options.serviceRoleKey;
    f.options.canonicalProjectUrl = "https://mutated.invalid"; f.options.serviceRoleKey = "different-private-key";
    f.policy.limit = 900; f.policy.windowSeconds = 900;
    const decision = await f.limiter.consume(subject, product);
    expect(decision).toEqual({ allowed: true, retryAfterSeconds: 0 }); expect(Object.isFrozen(decision)).toBe(true);
    const [input, init] = f.fetcher.mock.calls[0];
    expect(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).href).toBe(project + "/rest/v1/rpc/planet_consume_license_grant_budget");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer " + key);
    expect(JSON.parse(String(init?.body))).toEqual({ p_subject: subject, p_product_id: product, p_limit: 2, p_window_seconds: 60 });
    expect(init?.redirect).toBe("error"); expect(init?.cache).toBe("no-store"); expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(decision)).not.toContain(key);
    f.reply({ allowed: false, retry_after_seconds: 60 });
    expect(await f.limiter.consume(subject, product)).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });
  it("rejects malformed or inconsistent RPC acknowledgements instead of treating them as grants", async () => {
    const f = fixture();
    for (const reply of [null, [], {}, { allowed: 1, retry_after_seconds: 0 }, { allowed: true, retry_after_seconds: 1 },
      { allowed: false, retry_after_seconds: 0 }, { allowed: false, retry_after_seconds: 61 }, { allowed: false, retry_after_seconds: 1.5 },
      { allowed: false, retry_after_seconds: "1" }, { allowed: true, retry_after_seconds: 0, token: "private" }]) {
      f.reply(reply); await expect(f.limiter.consume(subject, product)).rejects.toThrow("Canonical license grant budget unavailable");
    }
  });
  it("fails closed on HTTP errors and transport outages with generic errors", async () => {
    const f = fixture();
    f.reply({ code: "P0001", message: "private-SQL-detail" }, 503);
    await expect(f.limiter.consume(subject, product)).rejects.toThrow(/^Canonical license grant budget unavailable$/u);
    f.fetcher.mockRejectedValue(new Error("private-network-detail"));
    await expect(f.limiter.consume(subject, product)).rejects.toThrow(/^Canonical license grant budget unavailable$/u);
  });
  it("requires bounded explicit policy and canonical credentials before any network call", () => {
    const f = fixture();
    for (const policy of [{ limit: 0, windowSeconds: 60 }, { limit: 10001, windowSeconds: 60 }, { limit: 1.5, windowSeconds: 60 },
      { limit: 2, windowSeconds: 0 }, { limit: 2, windowSeconds: 86401 }, { limit: 2, windowSeconds: 1.5 }, { limit: 2, windowSeconds: 60, extra: true }]) {
      expect(() => createCanonicalLicenseRateLimiter(f.options, policy)).toThrow("Invalid explicit license rate policy");
    }
    for (const change of [{ canonicalProjectUrl: "http://wrong.invalid" }, { canonicalProjectUrl: f.options.canonicalProjectUrl + "/" },
      { serviceRoleKey: f.options.publishableKey }, { recentAuthenticationSeconds: 0 }]) {
      expect(() => createCanonicalLicenseRateLimiter({ ...f.options, ...change }, f.policy)).toThrow();
    }
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("rejects noncanonical subject/product inputs without sending raw caller data", async () => {
    const f = fixture();
    for (const [id, name] of [["unknown", product], [subject, "../base"], [subject, ""], [subject, "a".repeat(121)]]) {
      await expect(f.limiter.consume(id, name)).rejects.toThrow("Invalid license budget identity");
    }
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
