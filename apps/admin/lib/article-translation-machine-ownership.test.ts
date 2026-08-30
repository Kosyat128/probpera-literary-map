import { describe, expect, it } from "vitest";

import {
  isMachineOwnedEnglishArticleTranslation,
  machineArticleContentJsonFromHtml,
  premiumArticleMachineContentJson,
  rebindPremiumArticleMachineSourceHash,
  refreshArticleMachineMediaReferences,
  stripPremiumArticleMachineMetadata,
} from "./article-translation-machine-ownership";

const MEDIA_A = "11111111-1111-4111-8111-111111111111";
const MEDIA_B = "22222222-2222-4222-8222-222222222222";

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

  it("keeps ordered non-deduplicated media references beside the HTML fallback", () => {
    const contentJson = machineArticleContentJsonFromHtml(`
      <figure><img src="https://cdn.example/a.webp" alt="First" data-media-id="${MEDIA_A}"></figure>
      <img src="https://cdn.example/b.webp" alt="" data-decorative="true" data-media-id="${MEDIA_B}">
      <img src="https://cdn.example/a.webp" alt="First again" data-media-id="${MEDIA_A}">
    `);

    expect(contentJson).toEqual({
      type: "doc",
      content: [],
      __probperaMediaReferences: [
        {
          mediaId: MEDIA_A,
          src: "https://cdn.example/a.webp",
          alt: "First",
          decorative: false,
        },
        {
          mediaId: MEDIA_B,
          src: "https://cdn.example/b.webp",
          alt: "",
          decorative: true,
        },
        {
          mediaId: MEDIA_A,
          src: "https://cdn.example/a.webp",
          alt: "First again",
          decorative: false,
        },
      ],
    });
  });

  it("places fallback media references outside premium ownership metadata", () => {
    const contentJson = premiumArticleMachineContentJson(
      {
        sourceHash: "source-a",
        model: "gpt-5.6-sol",
        reviewerModel: null,
        translatorRequestId: null,
        reviewerRequestId: null,
        generatedAt: "2026-08-25T00:00:00.000Z",
      },
      `<img src="https://cdn.example/a.webp" alt="First" data-media-id="${MEDIA_A}">`
    ) as Record<string, unknown>;

    expect(contentJson.__probperaMediaReferences).toEqual([
      {
        mediaId: MEDIA_A,
        src: "https://cdn.example/a.webp",
        alt: "First",
        decorative: false,
      },
    ]);
    expect(contentJson.__probperaPremiumTranslation).not.toHaveProperty(
      "__probperaMediaReferences"
    );
  });

  it("refreshes legacy fallback references from canonical HTML without losing ownership", () => {
    const legacy = premiumArticleMachineContentJson({
      sourceHash: "source-a",
      model: "gpt-5.6-sol",
      reviewerModel: null,
      translatorRequestId: null,
      reviewerRequestId: null,
      generatedAt: "2026-08-25T00:00:00.000Z",
    }) as Record<string, unknown>;
    legacy.__probperaMediaReferences = [{ mediaId: MEDIA_A, src: "/old" }];

    const refreshed = refreshArticleMachineMediaReferences(
      legacy,
      `<img src="/new.webp?x=1&amp;y=2" alt="New &amp; exact" data-media-id="${MEDIA_A}">`
    ) as Record<string, unknown>;

    expect(refreshed.__probperaMediaReferences).toEqual([
      {
        mediaId: MEDIA_A,
        src: "/new.webp?x=1&y=2",
        alt: "New & exact",
        decorative: false,
      },
    ]);
    expect(refreshed.__probperaPremiumTranslation).toEqual(
      legacy.__probperaPremiumTranslation
    );
  });

  it("rebinds machine ownership to the canonical Russian source hash only", () => {
    const machine = premiumArticleMachineContentJson({
      sourceHash: "raw-source",
      model: "gpt-5.6-sol",
      reviewerModel: null,
      translatorRequestId: null,
      reviewerRequestId: null,
      generatedAt: "2026-08-25T00:00:00.000Z",
    });
    const rebound = rebindPremiumArticleMachineSourceHash(
      machine,
      "canonical-source"
    );
    expect(
      isMachineOwnedEnglishArticleTranslation({
        contentJson: rebound,
        sourceContentHash: "canonical-source",
      })
    ).toBe(true);
    const human = { type: "doc", content: [{ type: "paragraph" }] };
    expect(rebindPremiumArticleMachineSourceHash(human, "canonical-source")).toBe(human);
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

  it("keeps fallback references for an empty document but drops them after structured editing", () => {
    const machine = premiumArticleMachineContentJson(
      {
        sourceHash: "source-a",
        model: "gpt-5.6-sol",
        reviewerModel: null,
        translatorRequestId: null,
        reviewerRequestId: null,
        generatedAt: "2026-08-25T00:00:00.000Z",
      },
      `<img src="https://cdn.example/a.webp" alt="First" data-media-id="${MEDIA_A}">`
    ) as Record<string, unknown>;

    expect(stripPremiumArticleMachineMetadata(machine)).toHaveProperty(
      "__probperaMediaReferences"
    );
    expect(
      stripPremiumArticleMachineMetadata({
        ...machine,
        content: [
          {
            type: "editorialImage",
            attrs: {
              mediaId: MEDIA_A,
              src: "https://cdn.example/a.webp",
              alt: "First",
              decorative: false,
            },
          },
        ],
      })
    ).not.toHaveProperty("__probperaMediaReferences");
  });
});
