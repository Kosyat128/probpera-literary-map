import { describe, expect, it } from "vitest";

import { premiumTranslationFeatureEnabled } from "./env";

describe("premium translation environment gate", () => {
  it("fails closed when the Worker secret is absent", () => {
    expect(
      premiumTranslationFeatureEnabled({ apiKey: "", setting: "" })
    ).toBe(false);
    expect(
      premiumTranslationFeatureEnabled({ apiKey: "   ", setting: "true" })
    ).toBe(false);
  });

  it("enables automation by default only when a server key exists", () => {
    expect(
      premiumTranslationFeatureEnabled({ apiKey: "sk-server-only", setting: "" })
    ).toBe(true);
  });

  it("preserves an explicit operational kill switch", () => {
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "sk-server-only",
        setting: "false",
      })
    ).toBe(false);
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "sk-server-only",
        setting: " FALSE ",
      })
    ).toBe(false);
  });
});
