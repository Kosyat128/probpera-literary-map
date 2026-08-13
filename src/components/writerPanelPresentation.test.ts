import { describe, expect, it } from "vitest";

import type { WorkProfile, WriterProfile } from "../data/countries/types";
import type { WriterBiographyDisplay } from "../data/writerBiographyDisplay";
import {
  groupWriterRecordsByStatus,
  writerAwardsForPanel,
  writerBiographyPublicStatus,
  writerDetailViewForKey,
  writerRecordStatusPresentation,
  writerWorksForPanel,
} from "./writerPanelPresentation";

const descriptionRu =
  "Редакционное описание произведения фиксирует его тему, композицию и место в литературной традиции автора. Вторая фраза даёт достаточный контекст для проверенной публичной карточки без добавления новых биографических фактов.";
const descriptionEn =
  "This editorial description records the work's subject, structure, and place within the writer's literary tradition. A second sentence provides enough context for a reviewed public record without adding biographical claims.";

function publicWork(
  id: string,
  title: string,
  status: "reviewed" | "verified",
  distinctions: WorkProfile["distinctions"] = []
): WorkProfile {
  const sourceUrl = `https://example.org/works/${id}`;
  return {
    id,
    title,
    editorial: { status, reviewedAt: "2026-08-13" },
    translations: {
      ru: {
        locale: "ru",
        title,
        description: descriptionRu,
        sourceLanguage: "ru",
        status,
        sourceUrls: [sourceUrl],
        method: "editorial-original",
        reviewedAt: "2026-08-13",
      },
      en: {
        locale: "en",
        title: `Work ${id}`,
        description: descriptionEn,
        sourceLanguage: "en",
        status,
        sourceUrls: [sourceUrl],
        method: "editorial-original",
        reviewedAt: "2026-08-13",
      },
    },
    sources: [
      {
        provider: "Editorial archive",
        url: sourceUrl,
        fields: ["identity", "title", "description"],
        usage: "reference-only",
        retrievedAt: "2026-08-13",
      },
    ],
    distinctions,
  };
}

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

describe("writer card works and awards", () => {
  it("returns every public work without leaking legacy or draft titles", () => {
    const writer: WriterProfile = {
      id: "fixture-writer",
      works: ["Архивное название"],
      workDetails: [
        ...Array.from({ length: 10 }, (_, index) =>
          publicWork(
            `public-${index + 1}`,
            `Проверенное произведение ${index + 1}`,
            index % 2 ? "reviewed" : "verified"
          )
        ),
        {
          id: "draft-work",
          title: "Редакционный черновик",
          editorial: { status: "draft" },
        },
      ],
    };

    const works = writerWorksForPanel(writer, "ru");

    expect(works).toHaveLength(10);
    expect(works.map((work) => work.title)).not.toContain("Архивное название");
    expect(works.map((work) => work.title)).not.toContain(
      "Редакционный черновик"
    );
    expect(works.map((work) => work.status)).toContain("verified");
    expect(works.map((work) => work.status)).toContain("reviewed");
  });

  it("keeps structured work distinctions attached to the public work status", () => {
    const distinctionUrl = "https://example.org/prizes/archive";
    const writer: WriterProfile = {
      id: "distinction-writer",
      workDetails: [
        publicWork("cited-work", "Отмеченное произведение", "reviewed", [
          {
            criterion: "award-cited-work",
            label: "Prize archive: work cited by the jury",
            organization: "Prize archive",
            year: 2001,
            sourceUrl: distinctionUrl,
          },
        ]),
      ],
    };

    const [work] = writerWorksForPanel(writer, "ru");
    const distinctions = writerAwardsForPanel(writer, null, "ru").filter(
      (award) => award.kind === "work-distinction"
    );

    expect(work.distinctions).toEqual([
      expect.objectContaining({
        label: "Prize archive: work cited by the jury",
        sourceUrl: distinctionUrl,
        status: "reviewed",
        workTitle: "Отмеченное произведение",
      }),
    ]);
    expect(distinctions).toEqual(work.distinctions);
  });

  it("shows Pulitzer and other stored awards as legacy records without evidence", () => {
    const writer: WriterProfile = {
      id: "award-writer",
      awards: [
        "Пулитцеровская премия",
        "Национальная книжная премия",
        "  Пулитцеровская премия  ",
      ],
    };

    expect(writerAwardsForPanel(writer, null, "ru")).toEqual([
      expect.objectContaining({
        label: "Пулитцеровская премия",
        status: "legacy",
        sourceCount: 0,
      }),
      expect.objectContaining({
        label: "Национальная книжная премия",
        status: "legacy",
        sourceCount: 0,
      }),
    ]);
  });

  it("marks raw awards reviewed only when the published locale sources cover awards", () => {
    const writer: WriterProfile = {
      id: "reviewed-award-writer",
      awards: ["Пулитцеровская премия 2000"],
    };
    const biography: WriterBiographyDisplay = {
      kind: "published",
      locale: "ru",
      text: "Редакционная справка.",
      editorialStatus: "reviewed",
      publicationGate: "passed",
      factCheckStatus: "existing-publication-metadata",
      provenanceStatus: "recorded",
      rightsStatus: "recorded",
      noticeCode: null,
      sources: [
        {
          provider: "Prize archive",
          url: "https://example.org/prizes/2000",
          fields: ["identity", "awards"],
          usage: "fact-check",
          retrievedAt: "2026-08-13",
        },
      ],
    };

    expect(writerAwardsForPanel(writer, biography, "ru")).toEqual([
      expect.objectContaining({
        label: "Пулитцеровская премия 2000",
        status: "reviewed",
        sourceCount: 1,
        sourceUrl: "https://example.org/prizes/2000",
      }),
    ]);
  });

  it("upgrades only the matching official Nobel record to verified", () => {
    const writer: WriterProfile = {
      id: "nobel-writer",
      awards: [
        "Нобелевская премия по литературе 1999 года",
        "Пулитцеровская премия",
      ],
      nobelAward: {
        category: "literature",
        year: 1999,
        laureateId: 999,
        portion: "1",
        verifiedAt: "2026-08-13",
        sources: [
          {
            title: "Official Nobel record",
            url: "https://www.nobelprize.org/prizes/literature/1999/example/facts/",
            publisher: "Nobel Prize Outreach",
          },
        ],
      },
    };

    const awards = writerAwardsForPanel(writer, null, "ru");

    expect(awards).toEqual([
      expect.objectContaining({
        label: "Нобелевская премия по литературе 1999 года",
        status: "verified",
        sourceCount: 1,
      }),
      expect.objectContaining({
        label: "Пулитцеровская премия",
        status: "legacy",
        sourceCount: 0,
      }),
    ]);
  });

  it("groups verified, reviewed, and legacy records in a stable order", () => {
    const groups = groupWriterRecordsByStatus([
      { status: "legacy" as const, id: "legacy" },
      { status: "verified" as const, id: "verified" },
      { status: "reviewed" as const, id: "reviewed" },
    ]);

    expect(groups.map((group) => group.status)).toEqual([
      "verified",
      "reviewed",
      "legacy",
    ]);
    expect(writerRecordStatusPresentation("legacy")).toEqual({
      code: "legacy",
      label: "Архивная запись",
      detail: "Источник ещё не зафиксирован",
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
