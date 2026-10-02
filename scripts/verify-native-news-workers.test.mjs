import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { verifyNativeNewsWorkers, parseNativeNewsWorkerArgs } from "./verify-native-news-workers.mjs";

const accountId = "0123456789abcdef0123456789abcdef";
const apiToken = "test_only_private_token_marker";
const credentials = { accountId, apiToken };
const json = result => new Response(JSON.stringify({ success: true, result }));
function preparationBindings(expected) {
  return [
    { name: "NEWS_AUTOMATION_ENABLED", type: "plain_text", text: expected === "enabled" ? "true" : "false" },
    { name: "NEWS_AUTOMATION_BOOTSTRAP", type: "plain_text", text: expected === "enabled" ? "true" : "false" },
    { name: "NEWS_AUTOMATION_WRITER", type: "plain_text", text: "native" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", type: "secret_text", text: "provider_private_service_key" },
    { name: "TELEGRAM_BOT_TOKEN", type: "secret_text", text: "provider_private_bot_token" },
    { name: "UNRELATED_PRIVATE_SETTING", type: "plain_text", text: "provider_private_other_value" },
  ];
}
function providerFixture(expected = "enabled", override = () => null) {
  const calls = [];
  const replies = [
    { bindings: preparationBindings(expected) },
    { schedules: [{ cron: "17 */2 * * *" }] },
    { bindings: [{ name: "NEWS_DELIVERY_ENABLED", type: "plain_text", text: ["enabled", "delivery-only"].includes(expected) ? "true" : "false" }] },
    { schedules: [{ cron: "0 5-19 * * *" }] },
  ];
  const fetchImpl = vi.fn(async (url, options) => {
    const index = calls.length;
    calls.push({ url: new URL(url), options });
    if (index >= replies.length) throw Error("unexpected fifth request");
    return override(index, replies[index]) ?? json(replies[index]);
  });
  return { calls, fetchImpl, replies };
}
const run = (fixture, expected = "enabled") => verifyNativeNewsWorkers({ ...credentials, expected, fetchImpl: fixture.fetchImpl });

describe("native worker activation read-only postflight", () => {
  it.each(["enabled", "disabled", "delivery-only"])("verifies %s with exactly four fixed HTTPS GETs and no secret output", async expected => {
    const fixture = providerFixture(expected), result = await run(fixture, expected);
    expect(fixture.calls.map(({ url }) => url.href)).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/probpera-literary-news-preparation/settings`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/probpera-literary-news-preparation/schedules`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/probpera-literary-news-delivery/settings`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/probpera-literary-news-delivery/schedules`,
    ]);
    for (const { url, options } of fixture.calls) {
      expect(options.method).toBe("GET");
      expect(options.redirect).toBe("error");
      expect(options.body).toBeUndefined();
      expect(options.headers).toEqual({ Authorization: `Bearer ${apiToken}`, Accept: "application/json" });
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(url.search + url.hash + url.username + url.password).toBe("");
    }
    expect(result).toMatchObject({ readonly: true, externalWrites: 0, providerRequests: 4, expected, deliveryConfirmed: false });
    expect(result.workers).toEqual([
      { worker: "probpera-literary-news-preparation", flags: { NEWS_AUTOMATION_ENABLED: String(expected === "enabled"), NEWS_AUTOMATION_BOOTSTRAP: String(expected === "enabled"), NEWS_AUTOMATION_WRITER: "native" }, cronUtc: "17 */2 * * *" },
      { worker: "probpera-literary-news-delivery", flags: { NEWS_DELIVERY_ENABLED: String(["enabled", "delivery-only"].includes(expected)) }, cronUtc: "0 5-19 * * *" },
    ]);
    expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/provider_private|SUPABASE_SERVICE_ROLE_KEY|TELEGRAM_BOT_TOKEN|UNRELATED_PRIVATE_SETTING|test_only_private_token_marker/);
    expect(JSON.stringify(result)).not.toContain(accountId);
  });

  it("rejects malformed credentials and expectations before any fetch or coercion", async () => {
    const coercion = { toString: vi.fn(() => accountId) };
    const invalid = [
      { accountId: null }, { accountId: 123 }, { accountId: coercion },
      { accountId: "a".repeat(31) }, { accountId: "a".repeat(33) }, { accountId: "g".repeat(32) },
      { accountId: `${accountId}/settings` }, { accountId: ` ${accountId}` },
      { apiToken: null }, { apiToken: 123 }, { apiToken: coercion }, { apiToken: "" },
      { apiToken: "a".repeat(513) }, { apiToken: "token\r\nInjected: secret" },
      { apiToken: "token with spaces" }, { apiToken: "private/../schedules" },
      { expected: true }, { expected: false }, { expected: "true" }, { expected: "ENABLED" }, { expected: coercion },
    ];
    for (const fields of invalid) {
      const fetchImpl = vi.fn();
      await expect(verifyNativeNewsWorkers({ ...credentials, expected: "enabled", ...fields, fetchImpl })).rejects.toThrow("native_check_configuration_invalid");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
    expect(coercion.toString).not.toHaveBeenCalled();
  });

  it("rejects absent, duplicate and wrong-type operational bindings without reading schedules", async () => {
    const variants = [
      bindings => bindings.filter(row => row.name !== "NEWS_AUTOMATION_ENABLED"),
      bindings => [...bindings, { ...bindings[0] }],
      bindings => bindings.map(row => row.name === "NEWS_AUTOMATION_ENABLED" ? { ...row, type: "secret_text" } : row),
      bindings => bindings.map(row => row.name === "NEWS_AUTOMATION_WRITER" ? { ...row, text: "github" } : row),
    ];
    for (const transform of variants) {
      const fixture = providerFixture("enabled", (index, value) => index === 0 ? json({ bindings: transform(value.bindings) }) : null);
      await expect(run(fixture)).rejects.toThrow("native_check_flag_mismatch");
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
    }
    const fixture = providerFixture("enabled", index => index === 0 ? json({ bindings: {} }) : null);
    await expect(run(fixture)).rejects.toThrow("native_check_bindings_invalid");
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires the exact plain-text state rather than truthiness, whitespace or the opposite mode", async () => {
    for (const expected of ["enabled", "disabled", "delivery-only"]) for (const text of [true, false, 1, 0, null, "TRUE", " true", "false ", expected === "enabled" ? "false" : "true"]) {
      const fixture = providerFixture(expected, (index, value) => index === 0 ? json({ bindings: value.bindings.map(row => row.name === "NEWS_AUTOMATION_ENABLED" ? { ...row, text } : row) }) : null);
      await expect(run(fixture, expected)).rejects.toThrow("native_check_flag_mismatch");
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects missing, duplicate, malformed and changed Cron schedules", async () => {
    for (const schedules of [null, {}, [], [{ cron: "17 */2 * * *" }, { cron: "17 */2 * * *" }], [{ cron: "*/10 * * * *" }], [{ cron: true }]]) {
      const fixture = providerFixture("enabled", index => index === 1 ? json({ schedules }) : null);
      await expect(run(fixture)).rejects.toThrow("native_check_schedule_mismatch");
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("does not report partial activation or continue when the delivery worker is disabled", async () => {
    const fixture = providerFixture("enabled", index => index === 2 ? json({ bindings: [{ name: "NEWS_DELIVERY_ENABLED", type: "plain_text", text: "false" }] }) : null);
    await expect(run(fixture)).rejects.toThrow("native_check_flag_mismatch");
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("delivery-only requires preparation and bootstrap off, native ownership, and delivery on", async () => {
    for (const [name, text, index] of [
      ["NEWS_AUTOMATION_ENABLED", "true", 0], ["NEWS_AUTOMATION_BOOTSTRAP", "true", 0],
      ["NEWS_AUTOMATION_WRITER", "github", 0], ["NEWS_DELIVERY_ENABLED", "false", 2],
    ]) {
      const fixture = providerFixture("delivery-only", (at, value) => at === index ? json({ bindings:
        value.bindings.map(row => row.name === name ? { ...row, text } : row) }) : null);
      await expect(run(fixture, "delivery-only")).rejects.toThrow("native_check_flag_mismatch");
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(index + 1);
    }
  });
  it("delivery-only preserves both exact schedules and rejects drift in either worker", async () => {
    for (const index of [1, 3]) {
      const fixture = providerFixture("delivery-only", at => at === index ? json({ schedules: [{ cron: "*/5 * * * *" }] }) : null);
      await expect(run(fixture, "delivery-only")).rejects.toThrow("native_check_schedule_mismatch");
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(index + 1);
    }
  });
  it("parses exactly one explicit mode and rejects conflicting, duplicate or coerced arguments", () => {
    const modes = [["--expect-enabled", "enabled"], ["--expect-disabled", "disabled"], ["--expect-delivery-only", "delivery-only"]];
    for (const [arg, expected] of modes) expect(parseNativeNewsWorkerArgs([arg])).toBe(expected);
    for (const [first] of modes) for (const [second] of modes) {
      expect(() => parseNativeNewsWorkerArgs([first, second])).toThrow("native_check_configuration_invalid");
    }
    const coercion = { toString: vi.fn(() => "--expect-delivery-only") };
    for (const args of [undefined, "--expect-delivery-only", [], [coercion], [null], [true], ["--expect-delivery-only=true"], ["--delivery-only"], ["--expect-delivery-only", "--send"]]) {
      expect(() => parseNativeNewsWorkerArgs(args)).toThrow("native_check_configuration_invalid");
    }
    expect(coercion.toString).not.toHaveBeenCalled();
  });

  it("stops on quota 402 after one GET and cancels the unread private provider body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("provider_private_service_key")); }, cancel });
    const fixture = providerFixture("enabled", () => new Response(body, { status: 402 }));
    await expect(run(fixture)).rejects.toThrow(/^native_check_provider_quota$/);
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not retry authorization or provider errors or echo their diagnostics", async () => {
    for (const status of [401, 403, 429, 500, 503]) {
      const fixture = providerFixture("enabled", () => new Response("provider_private_service_key", { status }));
      await expect(run(fixture)).rejects.toThrow(/^native_check_provider_unavailable$/);
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("replaces a fetch exception containing credentials with a fixed safe code", async () => {
    const fetchImpl = vi.fn(async () => { throw Error(`Bearer ${apiToken} provider_private_service_key`); });
    await expect(verifyNativeNewsWorkers({ ...credentials, expected: "enabled", fetchImpl })).rejects.toThrow(/^native_check_network_unavailable$/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects truncated JSON and unsuccessful or malformed provider envelopes", async () => {
    for (const raw of ["", '{"success":true,"result":', "null", "{}", JSON.stringify({ success: "true", result: {} }), JSON.stringify({ success: false, errors: [{ message: "provider_private_service_key" }] }), JSON.stringify({ success: true, result: null }), JSON.stringify({ success: true, result: "settings" })]) {
      const fixture = providerFixture("enabled", () => new Response(raw));
      await expect(run(fixture)).rejects.toThrow(/^native_check_response_invalid$/);
      expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("fails closed when a successful response has no body", async () => {
    const fixture = providerFixture("enabled", () => new Response(null));
    await expect(run(fixture)).rejects.toThrow(/^native_check_response_invalid$/);
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("cancels an oversized stream at the byte bound without following requests", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { for (let i = 0; i < 3; i++) controller.enqueue(new Uint8Array(256 * 1024)); }, cancel });
    const fixture = providerFixture("enabled", () => new Response(body));
    await expect(run(fixture)).rejects.toThrow(/^native_check_response_too_large$/);
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("accepts a valid envelope exactly at the 512 KiB limit", async () => {
    const fixture = providerFixture("enabled", (index, value) => {
      if (index !== 0) return null;
      const raw = JSON.stringify({ success: true, result: value });
      return new Response(raw + " ".repeat(512 * 1024 - Buffer.byteLength(raw)));
    });
    const result = await run(fixture);
    expect(result.providerRequests).toBe(4);
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("the CLI rejects extra or unknown arguments with safe JSON and invalid credentials without a request", () => {
    const script = fileURLToPath(new URL("./verify-native-news-workers.mjs", import.meta.url));
    for (const args of [[], ["--send"], ["--expect-enabled", "--send"], ["--expect-disabled"], ["--expect-delivery-only"],
      ["--expect-delivery-only", "--expect-enabled"], ["--expect-disabled", "--expect-delivery-only"],
      ["--expect-delivery-only", "--expect-delivery-only"]]) {
      let failure;
      try {
        execFileSync(process.execPath, [script, ...args], { encoding: "utf8", windowsHide: true,
          env: { CLOUDFLARE_ACCOUNT_ID: "invalid_account_private_marker", CLOUDFLARE_API_TOKEN: apiToken }, stdio: "pipe", timeout: 5000 });
      } catch (error) { failure = error; }
      expect(failure?.status).toBe(1);
      expect(failure.stdout).toBe("");
      expect(JSON.parse(failure.stderr)).toEqual({ readonly: true, externalWrites: 0, code: "native_check_configuration_invalid", deliveryConfirmed: false });
      expect(failure.stderr).not.toMatch(/test_only_private_token_marker|invalid_account_private_marker/);
    }
  });
});
