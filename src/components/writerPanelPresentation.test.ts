import { describe, expect, it } from "vitest";

import type { WriterBiographyDisplay } from "../data/writerBiographyDisplay";
import {
  writerBiographyPublicStatus,
  writerDetailViewForKey,
} from "./writerPanelPresentation";

describe("writer card public status", () => {
  it("describes a source-backed published biography without overstating review", () => {
    const biography: WriterBiographyDisplay = {
      kind: "published",
      locale: "ru",
      text: "Проверенный текст.",
      editorialStatus: "reviewed",
      publicationGate: "passed",
      factCheckStatus: "existing-publication-metadata",
      provenanceStatus: "recorded",
      rightsStatus: "recorded",
      noticeCode: null,
      sources: [
        {
          provider: "Archive",
          url: "https://example.org/archive",
          fields: ["identity"],
          usage: "fact-check",
          retrievedAt: "2026-08-13",
        },
      ],
    };

    expect(writerBiographyPublicStatus(biography)).toEqual({
      code: "reviewed",
      label: "Проверено редакцией",
      detail: "Источники зафиксированы",
      sourceCount: 1,
    });
  });

  it("distinguishes a verified publication from a reviewed one", () => {
    const biography: WriterBiographyDisplay = {
      kind: "published",
      locale: "ru",
      text: "Подтверждённый текст.",
      editorialStatus: "verified",
      publicationGate: "passed",
      factCheckStatus: "existing-publication-metadata",
      provenanceStatus: "recorded",
      rightsStatus: "recorded",
      noticeCode: null,
      sources: [
        {
          provider: "Archive",
          url: "https://example.org/archive",
          fields: ["identity"],
          usage: "fact-check",
          retrievedAt: "2026-08-13",
        },
      ],
    };

    expect(writerBiographyPublicStatus(biography).code).toBe("verified");
    expect(writerBiographyPublicStatus(biography).label).toBe(
      "Подтверждено источниками"
    );
  });

  it("does not claim source verification when source metadata is empty", () => {
    const biography: WriterBiographyDisplay = {
      kind: "published",
      locale: "ru",
      text: "Редакционный текст без опубликованной библиографии.",
      editorialStatus: "verified",
      publicationGate: "passed",
      factCheckStatus: "existing-publication-metadata",
      provenanceStatus: "recorded",
      rightsStatus: "recorded",
      noticeCode: null,
      sources: [],
    };

    expect(writerBiographyPublicStatus(biography)).toEqual({
      code: "reviewed",
      label: "Проверено редакцией",
      detail: "Источники ещё не зафиксированы",
      sourceCount: 0,
    });
  });

  it("marks legacy prose as an unverified archive record", () => {
    const biography: WriterBiographyDisplay = {
      kind: "legacy-unverified",
      locale: "ru",
      text: "Архивный текст.",
      editorialStatus: "unverified",
      publicationGate: "not-passed",
      factCheckStatus: "not-recorded",
      provenanceStatus: "not-recorded",
      rightsStatus: "not-recorded",
      noticeCode: "legacy-biography-unverified",
      sources: [],
    };

    expect(writerBiographyPublicStatus(biography)).toEqual({
      code: "archive",
      label: "Архивная справка · не проверена",
      detail: "Источники ещё не зафиксированы",
      sourceCount: 0,
    });
  });

  it("keeps a withheld biography visibly pending", () => {
    expect(writerBiographyPublicStatus(null)).toEqual({
      code: "pending",
      label: "В редакционной очереди",
      detail: "Проверенная биография готовится",
      sourceCount: 0,
    });
  });
});

describe("writer card tab keyboard navigation", () => {
  it("moves through all tabs and wraps at both edges", () => {
    expect(writerDetailViewForKey("biography", "ArrowRight")).toBe("works");
    expect(writerDetailViewForKey("works", "ArrowRight")).toBe("sources");
    expect(writerDetailViewForKey("sources", "ArrowRight")).toBe("biography");
    expect(writerDetailViewForKey("biography", "ArrowLeft")).toBe("sources");
  });

  it("supports Home and End without intercepting unrelated keys", () => {
    expect(writerDetailViewForKey("sources", "Home")).toBe("biography");
    expect(writerDetailViewForKey("biography", "End")).toBe("sources");
    expect(writerDetailViewForKey("works", "Tab")).toBeNull();
  });
});
