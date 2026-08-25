import { describe, expect, it } from "vitest";

import {
  premiumTranslationConfigurationError,
  premiumTranslationRuntimeMetadata,
} from "./premium-translation-runtime";

describe("premium translation runtime metadata", () => {
  it("reports the actual Cloudflare translator and reviewer", () => {
    expect(
      premiumTranslationRuntimeMetadata({
        premiumTranslationProvider: "cloudflare",
        cloudflareTranslationModel: "@cf/translator",
        cloudflareTranslationReviewModel: "@cf/reviewer",
        openAiTranslationModel: "gpt-translator",
        openAiTranslationReviewModel: "gpt-reviewer",
        openAiPremiumTranslationReview: true,
      })
    ).toEqual({
      provider: "cloudflare",
      model: "@cf/translator",
      reviewerModel: "@cf/reviewer",
      twoPassReview: true,
    });
  });

  it("reports OpenAI only when OpenAI is the selected provider", () => {
    expect(
      premiumTranslationRuntimeMetadata({
        premiumTranslationProvider: "openai",
        cloudflareTranslationModel: "@cf/translator",
        cloudflareTranslationReviewModel: "@cf/reviewer",
        openAiTranslationModel: "gpt-translator",
        openAiTranslationReviewModel: "gpt-reviewer",
        openAiPremiumTranslationReview: true,
      })
    ).toEqual({
      provider: "openai",
      model: "gpt-translator",
      reviewerModel: "gpt-reviewer",
      twoPassReview: true,
    });
  });

  it("does not claim a reviewer model when the second pass is disabled", () => {
    expect(
      premiumTranslationRuntimeMetadata({
        premiumTranslationProvider: "cloudflare",
        cloudflareTranslationModel: "@cf/translator",
        cloudflareTranslationReviewModel: "@cf/reviewer",
        openAiTranslationModel: "gpt-translator",
        openAiTranslationReviewModel: "gpt-reviewer",
        openAiPremiumTranslationReview: false,
      }).reviewerModel
    ).toBeNull();
  });

  it("uses provider-specific configuration errors", () => {
    expect(premiumTranslationConfigurationError("cloudflare")).toContain(
      "Cloudflare Workers AI"
    );
    expect(premiumTranslationConfigurationError("openai")).toContain(
      "OPENAI_API_KEY"
    );
  });
});
