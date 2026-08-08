import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { countBiographySentences, selectWriterBiography } from "../writerBiography";
import { countries } from "./index";
import {
  writerBiographyResearchBatch01,
  writerBiographyResearchBatch01ApprovedKeys,
  writerBiographyResearchBatch01QaHolds,
} from "./writerBiographyResearchBatch01";
import {
  isWriterBiographyResearchDraftPublishable,
  mergeReviewedWriterBiographyDrafts,
  writerBiographyResearchDraftIssues,
  type WriterBiographyResearchDraft,
} from "./writerBiographyResearch";

function approvedFixture(
  source = writerBiographyResearchBatch01[0]
): WriterBiographyResearchDraft {
  const draft = structuredClone(source);
  draft.status = "reviewed";
  draft.review = {
    independentReviewRequired: true,
    decision: "approved",
    reviewer: "Independent QA test fixture",
    reviewedAt: "2026-08-09",
  };
  return draft;
}

function researchFixture(
  source = writerBiographyResearchBatch01[0]
): WriterBiographyResearchDraft {
  const draft = structuredClone(source);
  draft.status = "research";
  draft.review = {
    independentReviewRequired: true,
    decision: "pending",
    reviewer: null,
    reviewedAt: null,
  };
  return draft;
}

describe("writer biography research batch 01", () => {
  it("contains 20 unique exact keys and promotes only independently approved records", () => {
    const manifest = JSON.parse(
      readFileSync("reports/writer-biography-enrichment-manifest.json", "utf8")
    ) as { items: Array<{ key: string }> };
    const manifestKeys = new Set(manifest.items.map((item) => item.key));
    const keys = writerBiographyResearchBatch01.map((draft) => draft.key);

    expect(keys).toHaveLength(20);
    expect(new Set(keys).size).toBe(20);
    expect(writerBiographyResearchBatch01ApprovedKeys.size).toBe(20);
    expect(Object.keys(writerBiographyResearchBatch01QaHolds)).toHaveLength(0);
    for (const draft of writerBiographyResearchBatch01) {
      const approved = writerBiographyResearchBatch01ApprovedKeys.has(draft.key);
      expect(manifestKeys.has(draft.key), draft.key).toBe(!approved);
      const country = countries.find((item) => item.id === draft.countryId);
      const writer = country?.writers.find((item) => item.id === draft.writerId);
      expect(writer, draft.key).toBeDefined();
      expect(selectWriterBiography(writer!, "ru")?.text || null, draft.key).toBe(
        approved ? draft.translations.ru.text : null
      );
      expect(selectWriterBiography(writer!, "en")?.text || null, draft.key).toBe(
        approved ? draft.translations.en.text : null
      );
    }
  });

  it("records honest provenance and leaves every unsupported interpretation in research", () => {
    for (const draft of writerBiographyResearchBatch01) {
      const approved = writerBiographyResearchBatch01ApprovedKeys.has(draft.key);
      expect(writerBiographyResearchDraftIssues(draft), draft.key).toEqual([]);
      expect(isWriterBiographyResearchDraftPublishable(draft), draft.key).toBe(approved);
      expect(draft.author).toBe("Codex editorial draft");
      expect(draft.status).toBe(approved ? "reviewed" : "research");
      expect(draft.review).toEqual(
        approved
          ? {
              independentReviewRequired: true,
              decision: "approved",
              reviewer: "Codex independent factual QA",
              reviewedAt: "2026-08-08",
            }
          : {
              independentReviewRequired: true,
              decision: "pending",
              reviewer: null,
              reviewedAt: null,
            }
      );
      expect(draft.rights).toMatchObject({
        sourceUse: "facts-only",
        proseCreation: "project-original-editorial-draft",
        sourceProseCopied: false,
        wikipediaUsed: false,
      });
    }
    expect(
      writerBiographyResearchBatch01.filter((draft) => draft.status === "reviewed")
    ).toHaveLength(20);
    expect(
      writerBiographyResearchBatch01
        .filter((draft) => draft.status === "research")
        .map((draft) => draft.key)
        .sort()
    ).toEqual(Object.keys(writerBiographyResearchBatch01QaHolds).sort());
  });

  it("provides polished locale-exact RU and EN drafts of 2-4 sentences", () => {
    for (const draft of writerBiographyResearchBatch01) {
      const ru = draft.translations.ru;
      const en = draft.translations.en;
      expect(countBiographySentences(ru.text), `${draft.key}:ru`).toBeGreaterThanOrEqual(2);
      expect(countBiographySentences(ru.text), `${draft.key}:ru`).toBeLessThanOrEqual(4);
      expect(countBiographySentences(en.text), `${draft.key}:en`).toBeGreaterThanOrEqual(2);
      expect(countBiographySentences(en.text), `${draft.key}:en`).toBeLessThanOrEqual(4);
      expect(ru.text.length, `${draft.key}:ru`).toBeGreaterThanOrEqual(120);
      expect(en.text.length, `${draft.key}:en`).toBeGreaterThanOrEqual(120);
      expect(ru.text, `${draft.key}:ru`).toMatch(/[\u0400-\u04ff]/u);
      expect(en.text, `${draft.key}:en`).toMatch(/[A-Za-z]/u);
      expect(en.text, `${draft.key}:en`).not.toMatch(/[\u0400-\u04ff]/u);
      expect(en.text).not.toBe(ru.text);
      expect(ru).toMatchObject({
        locale: "ru",
        sourceLanguage: "ru",
        method: "editorial-original",
      });
      expect(en).toMatchObject({
        locale: "en",
        sourceLanguage: "en",
        method: "editorial-original",
      });
      expect(en.translatedFromLocale).toBeUndefined();
      expect(en.sourceTextRights).toBeUndefined();
    }
  });

  it("maps every fact to a declared source that supports that exact field", () => {
    const expectedField = {
      identity: "identity",
      lifeDates: "life-dates",
      nationalLiteraryContext: "biography-facts",
      notableWorks: "works",
    } as const;

    for (const draft of writerBiographyResearchBatch01) {
      const providers = new Set(draft.sources.map((source) => source.provider));
      const domains = new Set(
        draft.sources.map((source) => new URL(source.url).hostname)
      );
      expect(providers.size, draft.key).toBeGreaterThanOrEqual(2);
      expect(domains.size, draft.key).toBeGreaterThanOrEqual(2);
      expect(providers, draft.key).toContain("Nobel Prize Outreach");
      expect(providers, draft.key).toContain("Library of Congress");
      expect(domains, draft.key).toContain("www.nobelprize.org");
      expect(domains, draft.key).toContain("id.loc.gov");
      expect(draft.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
      expect(
        draft.sources.some(
          (source) =>
            source.provider === "Library of Congress" &&
            source.fields.every((field) =>
              (["identity", "life-dates"] as string[]).includes(field)
            )
        )
      ).toBe(true);
      expect(draft.sources.some((source) => /wikipedia/iu.test(source.url))).toBe(
        false
      );

      for (const [factName, fact] of Object.entries(draft.facts)) {
        expect(fact.summary.trim(), `${draft.key}:${factName}`).not.toBe("");
        expect(fact.sourceUrls.length, `${draft.key}:${factName}`).toBeGreaterThan(0);
        expect(
          new Set(fact.evidence.map((item) => item.sourceUrl)),
          `${draft.key}:${factName}:evidence`
        ).toEqual(new Set(fact.sourceUrls));
        expect(
          fact.evidence.every((item) => Boolean(item.supports.trim())),
          `${draft.key}:${factName}:evidence`
        ).toBe(true);
        for (const url of fact.sourceUrls) {
          const source = draft.sources.find((candidate) => candidate.url === url);
          expect(source, `${draft.key}:${factName}:${url}`).toBeDefined();
          expect(source!.fields, `${draft.key}:${factName}:${url}`).toContain(
            expectedField[factName as keyof typeof expectedField]
          );
          if (factName === "nationalLiteraryContext") {
            expect(url, `${draft.key}:${factName}`).toMatch(
              /\/(?:facts|biographical)\/$/u
            );
          }
          if (factName === "notableWorks") {
            expect(url, `${draft.key}:${factName}`).toMatch(
              /\/(?:biographical|bibliography)\/$/u
            );
          }
        }
        if (factName === "nationalLiteraryContext") {
          expect(
            fact.sourceUrls.some((url) => url.endsWith("/biographical/")),
            `${draft.key}:${factName}`
          ).toBe(true);
        }
      }
    }
  });

  it("rejects undeclared and field-mismatched fact citations", () => {
    const undeclared = structuredClone(writerBiographyResearchBatch01[0]);
    undeclared.facts.notableWorks.sourceUrls = ["https://example.org/unknown"];
    expect(writerBiographyResearchDraftIssues(undeclared)).toContain(
      "notableWorks: unknown source URL"
    );

    const mismatched = structuredClone(writerBiographyResearchBatch01[0]);
    mismatched.facts.notableWorks.sourceUrls = [
      mismatched.sources.find((source) => source.fields.includes("identity"))!.url,
    ];
    expect(writerBiographyResearchDraftIssues(mismatched)).toContain(
      "notableWorks: source does not declare works support"
    );
  });

  it("promotes only an independently approved zero-issue fixture", () => {
    const researched = researchFixture();
    const fixtureCountries = [
      { id: researched.countryId, name: "Fixture", writers: [{ id: researched.writerId }] },
    ];
    expect(
      mergeReviewedWriterBiographyDrafts(fixtureCountries, [researched])[0].writers[0]
        .biographyTranslations
    ).toBeUndefined();

    const approved = approvedFixture(researched);
    expect(isWriterBiographyResearchDraftPublishable(approved)).toBe(true);
    const promoted = mergeReviewedWriterBiographyDrafts(fixtureCountries, [approved]);
    expect(selectWriterBiography(promoted[0].writers[0], "ru")?.text).toBe(
      approved.translations.ru.text
    );
    expect(selectWriterBiography(promoted[0].writers[0], "en")?.text).toBe(
      approved.translations.en.text
    );
  });

  it("preserves a ready RU locale while adding an independently approved EN locale", () => {
    const approved = approvedFixture();
    const initiallyPromoted = mergeReviewedWriterBiographyDrafts(
      [{ id: approved.countryId, name: "Fixture", writers: [{ id: approved.writerId }] }],
      [approved]
    )[0].writers[0];
    const existingRussian = initiallyPromoted.biographyTranslations!.ru!;
    const result = mergeReviewedWriterBiographyDrafts(
      [
        {
          id: approved.countryId,
          name: "Fixture",
          writers: [
            {
              id: approved.writerId,
              biographyTranslations: { ru: existingRussian },
            },
          ],
        },
      ],
      [approved]
    )[0].writers[0];

    expect(result.biographyTranslations?.ru).toBe(existingRussian);
    expect(selectWriterBiography(result, "en")?.text).toBe(
      approved.translations.en.text
    );
  });

  it("rejects self-approval, invalid review dates and duplicate batch keys", () => {
    const selfApproved = approvedFixture();
    selfApproved.review.reviewer = "  CODEX   EDITORIAL DRAFT ";
    expect(
      writerBiographyResearchDraftIssues(selfApproved, { requireApproval: true })
    ).toContain("draft author cannot approve their own text");

    const invalidDate = approvedFixture();
    invalidDate.review.reviewedAt = "2026-02-30";
    expect(
      writerBiographyResearchDraftIssues(invalidDate, { requireApproval: true })
    ).toContain("review date is missing or invalid");

    const cyrillicEnglish = approvedFixture();
    cyrillicEnglish.translations.en.text += " І";
    expect(writerBiographyResearchDraftIssues(cyrillicEnglish)).toContain(
      "en: biography must be English-only"
    );

    const approved = approvedFixture();
    const fixtureCountries = [
      { id: approved.countryId, name: "Fixture", writers: [{ id: approved.writerId }] },
    ];
    const result = mergeReviewedWriterBiographyDrafts(fixtureCountries, [
      approved,
      structuredClone(approved),
    ]);
    expect(result[0].writers[0].biographyTranslations).toBeUndefined();

    const duplicateTarget = mergeReviewedWriterBiographyDrafts(
      [
        {
          id: approved.countryId,
          name: "Fixture",
          writers: [{ id: approved.writerId }, { id: approved.writerId }],
        },
      ],
      [approved]
    );
    expect(
      duplicateTarget.every((country) =>
        country.writers.every((writer) => !writer.biographyTranslations)
      )
    ).toBe(true);
  });
});
