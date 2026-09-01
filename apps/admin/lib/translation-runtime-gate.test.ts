import { describe, expect, it, vi } from "vitest";

import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";

function supabaseProbe(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, eq, maybeSingle };
}

describe("premium translation runtime gate", () => {
  it("requires the persisted successful probe for the current model", async () => {
    const probe = supabaseProbe({
      test_passed: true,
      model: "@cf/google/gemma-4-26b-a4b-it",
      last_test_at: "2026-09-01T10:00:00.000Z",
    });
    await expect(
      premiumTranslationRuntimeGate(probe.client as never, {
        provider: "cloudflare",
        aiBinding: { run: vi.fn() },
        model: "@cf/google/gemma-4-26b-a4b-it",
        now: Date.parse("2026-09-01T11:00:00.000Z"),
      })
    ).resolves.toBe(true);
    expect(probe.from).toHaveBeenCalledWith("translation_provider_self_tests");
  });

  it("fails closed when the successful probe is stale", async () => {
    const probe = supabaseProbe({
      test_passed: true,
      model: "gpt-test",
      last_test_at: "2026-08-30T10:00:00.000Z",
    });
    await expect(
      premiumTranslationRuntimeGate(probe.client as never, {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        now: Date.parse("2026-09-01T11:00:00.000Z"),
      })
    ).resolves.toBe(false);
  });

  it("fails closed on a database error", async () => {
    const probe = supabaseProbe(null, { code: "PGRST000" });
    await expect(
      premiumTranslationRuntimeGate(probe.client as never, {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
      })
    ).resolves.toBe(false);
  });
});
