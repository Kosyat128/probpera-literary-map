import { describe, expect, it } from "vitest";

import {
  isMachineOwnedEnglishArticleTranslation,
  premiumArticleMachineContentJson,
  stripPremiumArticleMachineMetadata,
} from "./article-translation-machine-ownership";

describe("premium article translation ownership", () => {
  it("recognizes only a machine marker tied to the persisted Russian source hash", () => {
    const contentJson = premiumArticleMachineContentJson({
      sourceHash: "source-a",
      model: "gpt-5.6-sol",
      reviewerModel: "gpt-5.6-sol",
      translatorRequestId: "req-translate",
      reviewerRequestId: "req-review",
      generatedAt: "2026-08-25T00:00:00.000Z",
    });

    expect(
      isMachineOwnedEnglishArticleTranslation({
        contentJson,
        sourceContentHash: "source-a",
      })
    ).toBe(true);
    expect(
      isMachineOwnedEnglishArticleTranslation({
        contentJson,
        sourceContentHash: "source-b",
      })
    ).toBe(false);
  });

  it("treats legacy/manual English content as human-owned", () => {
    expect(
      isMachineOwnedEnglishArticleTranslation({
        contentJson: { type: "doc", content: [] },
        sourceContentHash: "source-a",
      })
    ).toBe(false);
  });

  it("removes machine ownership when an editor takes over the English version", () => {
    const machine = premiumArticleMachineContentJson({
      sourceHash: "source-a",
      model: "gpt-5.6-sol",
      reviewerModel: "gpt-5.6-sol",
      translatorRequestId: null,
      reviewerRequestId: null,
      generatedAt: "2026-08-25T00:00:00.000Z",
    });
    const stripped = stripPremiumArticleMachineMetadata(machine);

    expect(
      isMachineOwnedEnglishArticleTranslation({
        contentJson: stripped,
        sourceContentHash: "source-a",
      })
    ).toBe(false);
    expect(stripped).toEqual({ type: "doc", content: [] });
  });
});
