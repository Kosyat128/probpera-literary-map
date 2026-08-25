import { describe, expect, it } from "vitest";

import { premiumTranslationFeatureEnabled } from "./env";

describe("premium translation environment gate", () => {
  it("fails closed for OpenAI when the server secret is absent", () => {
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "",
        setting: "",
        provider: "openai",
      })
    ).toBe(false);
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "   ",
        setting: "true",
        provider: "openai",
      })
    ).toBe(false);
  });

  it("enables OpenAI automation only when a server key exists", () => {
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "sk-server-only",
        setting: "",
        provider: "openai",
      })
    ).toBe(true);
  });

  it("enables Cloudflare Workers AI without an OpenAI key", () => {
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "",
        setting: "",
        provider: "cloudflare",
      })
    ).toBe(true);
  });

  it("preserves an explicit operational kill switch for every provider", () => {
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "sk-server-only",
        setting: "false",
        provider: "openai",
      })
    ).toBe(false);
    expect(
      premiumTranslationFeatureEnabled({
        apiKey: "",
        setting: " FALSE ",
        provider: "cloudflare",
      })
    ).toBe(false);
  });
});
