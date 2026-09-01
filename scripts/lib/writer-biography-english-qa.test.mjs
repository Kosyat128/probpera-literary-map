import { describe, expect, it } from "vitest";

import {
  assertWriterBiographyRussianEditorialQa,
  assertWriterBiographyEnglishQa,
  writerBiographyCheckpointAuditFromWorkerPayload,
  writerBiographyDuplicateEnglishGroups,
  writerBiographyDuplicateRussianGroups,
  writerBiographyEditorialPostEditIssues,
  writerBiographyEnglishQaIssues,
  writerBiographyNumberTokens,
  writerBiographyProtectedLatinTokens,
  writerBiographyPublicEnglishTranslationAuditRecord,
  writerBiographyQuotedSpans,
  writerBiographyPublicEnglishTranslationRecord,
  writerBiographyRussianEditorialQaIssues,
  writerBiographySentenceCount,
  writerBiographyTranslationAuditIssues,
} from "./writer-biography-english-qa.mjs";

const source =
  "Атиq Рахими (1962) - афганский писатель и режиссёр. Он написал романы «Syngué sabour» и «Земля и пепел»; в 2008 году получил Гонкуровскую премию.";
const english =
  'Atiq Rahimi (1962) is an Afghan writer and director. He wrote the novels "Syngué sabour" and "Earth and Ashes"; in 2008 he received the Prix Goncourt.';

describe("writer biography English QA", () => {
  it("accepts a complete translation with stable facts and title cardinality", () => {
    expect(
      assertWriterBiographyEnglishQa({
        sourceText: source,
        englishText: english,
        writerName: "Atiq Rahimi",
      })
    ).toBe(english);
  });

  it("blocks changed dates, lost titles, Cyrillic and identity omissions", () => {
    const issues = writerBiographyEnglishQaIssues({
      sourceText: source,
      englishText:
        "A writer was born in 1961. This draft mentions Syngué sabour, Земля и пепел, and an award received in 2009.",
      writerName: "Atiq Rahimi",
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        "english-length-out-of-range",
        "english-contains-cyrillic",
        "english-writer-identity-opening-missing",
        "numeric-facts-changed",
        "quoted-work-count-changed",
        "latin-writer-identity-omitted",
      ])
    );
  });

  it("compares numerical facts as a multiset", () => {
    expect(writerBiographyNumberTokens("1917, 1917; 1944")).toEqual([
      "1917",
      "1917",
      "1944",
    ]);
    expect(writerBiographyNumberTokens("1944 / 1917 / 1917")).toEqual([
      "1917",
      "1917",
      "1944",
    ]);
  });

  it("does not count personal-name initials as separate sentences", () => {
    expect(
      writerBiographySentenceCount(
        "T. S. Eliot was an English-language poet and critic. His work shaped modernist poetry."
      )
    ).toBe(2);
  });

  it("counts a sentence ending after a regnal Roman numeral", () => {
    expect(
      writerBiographySentenceCount(
        "The university was named for Mohammed V. In 2003, Fatima Mernissi shared the Prince of Asturias Award for Letters."
      )
    ).toBe(2);
  });

  it("counts paired Russian and English title quotes", () => {
    expect(writerBiographyQuotedSpans("«Один» и «Два»")).toEqual([
      "Один",
      "Два",
    ]);
    expect(writerBiographyQuotedSpans('"One" and “Two”')).toEqual([
      "One",
      "Two",
    ]);
  });

  it("requires every Manto Latin token at exact token boundaries", () => {
    const mantoSource =
      "Саадат Хасан Манто (1912-1955) - писатель на урду, драматург и автор рассказов. Среди его произведений - «Toba Tek Singh», «Thanda Gosht» и «Khol Do»; в 2012 году он был посмертно награждён Nishan-e-Imtiaz.";
    const complete =
      'Saadat Hasan Manto (1912-1955) was an Urdu short-story writer and playwright. His works include "Toba Tek Singh", "Thanda Gosht", and "Khol Do"; he received Nishan-e-Imtiaz posthumously in 2012.';
    const substringOnly =
      'Saadat Hasan Manto (1912-1955) was an Urdu short-story writer and playwright. His documented works include "Toba Tek Singh", "Thanda Gosht", and "Open It"; he received Nishan-e-Imtiaz posthumously in 2012.';

    expect(writerBiographyProtectedLatinTokens(mantoSource)).toEqual([
      "Do",
      "Gosht",
      "Khol",
      "Nishan-e-Imtiaz",
      "Singh",
      "Tek",
      "Thanda",
      "Toba",
    ]);
    expect(
      writerBiographyEnglishQaIssues({
        sourceText: mantoSource,
        englishText: complete,
        writerName: "Saadat Hasan Manto",
      })
    ).not.toContain("source-latin-token-omitted");
    expect(
      writerBiographyEnglishQaIssues({
        sourceText: mantoSource,
        englishText: substringOnly,
        writerName: "Saadat Hasan Manto",
      })
    ).toContain("source-latin-token-omitted");
  });

  it("detects duplicate English prose after Unicode, whitespace and case normalization", () => {
    expect(
      writerBiographyDuplicateEnglishGroups(
        [{ key: "a" }, { key: "b" }, { key: "c" }],
        {
          a: { text: "A distinct biography. It has a second sentence." },
          b: { text: "  a DISTINCT biography.  It has a second sentence. " },
          c: { text: "Another biography. It has different facts." },
        }
      )
    ).toEqual([["a", "b"]]);
  });

  it("detects duplicate Russian editorial prose after normalization", () => {
    expect(
      writerBiographyDuplicateRussianGroups(
        [{ key: "a" }, { key: "b" }],
        {
          a: { text: "Автор написал роман. Это второе предложение." },
          b: { text: "  АВТОР написал роман.  Это второе предложение. " },
        }
      )
    ).toEqual([["a", "b"]]);
  });

  it("requires durable request-ID and usage fields for translation audit", () => {
    const complete = {
      translatorRequestId: "translation-id",
      reviewerRequestId: "review-id",
      usage: {
        inputTokens: null,
        outputTokens: null,
        reviewInputTokens: null,
        reviewOutputTokens: null,
      },
      passes: [
        {
          phase: "translation",
          model: "translator",
          requestId: "translation-id",
          inputTokens: null,
          outputTokens: null,
        },
        {
          phase: "review",
          model: "reviewer",
          requestId: "review-id",
          inputTokens: null,
          outputTokens: null,
        },
      ],
    };
    expect(writerBiographyTranslationAuditIssues(complete)).toEqual([]);
    expect(
      writerBiographyTranslationAuditIssues({
        translatorRequestId: "translation-id",
        reviewerRequestId: "review-id",
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          reviewInputTokens: 40,
          reviewOutputTokens: 60,
        },
        passes: [
          {
            phase: "translation",
            model: "translator",
            requestId: "translation-id",
            inputTokens: 10,
            outputTokens: 20,
          },
          {
            phase: "repair",
            model: "reviewer",
            requestId: "repair-id",
            inputTokens: 15,
            outputTokens: 25,
          },
          {
            phase: "review",
            model: "reviewer",
            requestId: "review-id",
            inputTokens: 25,
            outputTokens: 35,
          },
        ],
      })
    ).toEqual([]);
    expect(
      writerBiographyTranslationAuditIssues({
        translatorRequestId: null,
        usage: { inputTokens: null },
      })
    ).toEqual(
      expect.arrayContaining([
        "missing-reviewerRequestId",
        "missing-usage-outputTokens",
        "missing-usage-reviewInputTokens",
        "missing-usage-reviewOutputTokens",
      ])
    );
  });

  it("preserves worker passes in the private checkpoint and strips them from public output", () => {
    const audit = writerBiographyCheckpointAuditFromWorkerPayload({
      translatorRequestId: "draft-id",
      reviewerRequestId: "review-id",
      inputTokens: 10,
      outputTokens: 20,
      reviewInputTokens: 30,
      reviewOutputTokens: 40,
      passes: [
        {
          phase: "translation",
          model: "translator",
          requestId: "draft-id",
          inputTokens: 10,
          outputTokens: 20,
        },
        {
          phase: "review",
          model: "reviewer",
          requestId: "review-id",
          inputTokens: 30,
          outputTokens: 40,
        },
      ],
    });
    expect(audit.passes).toHaveLength(2);
    expect(writerBiographyTranslationAuditIssues(audit)).toEqual([]);

    const publicRecord = writerBiographyPublicEnglishTranslationRecord({
      text: english,
      sourceHash: "a".repeat(64),
      generatedAt: "2026-08-31T12:00:00.000Z",
      reviewedAt: "2026-08-31",
      translatorModel: "translator",
      reviewerModel: "reviewer",
      editorialPostEdit: {
        editedAt: "2026-08-31T16:14:09.805Z",
        editor: "Codex bilingual editorial QA",
        reasonCodes: ["english-style-polish"],
      },
      ...audit,
    });
    expect(publicRecord).not.toHaveProperty("passes");
    expect(publicRecord).not.toHaveProperty("usage");
    expect(publicRecord).not.toHaveProperty("translatorRequestId");
    expect(publicRecord).not.toHaveProperty("reviewerRequestId");
    expect(publicRecord).toMatchObject({
      editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
      editorialPostEditor: "Codex bilingual editorial QA",
      editorialPostEditReasonCodes: ["english-style-polish"],
    });

    const publicAudit = writerBiographyPublicEnglishTranslationAuditRecord({
      text: english,
      sourceHash: "a".repeat(64),
      generatedAt: "2026-08-31T12:00:00.000Z",
      reviewedAt: "2026-08-31",
      translatorModel: "translator",
      reviewerModel: "reviewer",
      editorialPostEdit: {
        editedAt: "2026-08-31T16:14:09.805Z",
        editor: "Codex bilingual editorial QA",
        reasonCodes: ["english-style-polish"],
      },
      ...audit,
    });
    expect(publicAudit).not.toHaveProperty("usage");
    expect(publicAudit).not.toHaveProperty("translatorRequestId");
    expect(publicAudit).not.toHaveProperty("reviewerRequestId");
    expect(publicAudit.passes).toEqual([
      { phase: "translation", model: "translator" },
      { phase: "review", model: "reviewer" },
    ]);
    expect(publicAudit.editorialPostEdit).toMatchObject({
      editor: "Codex bilingual editorial QA",
      reasonCodes: ["english-style-polish"],
    });
  });

  it("validates optional editorial post-edit provenance", () => {
    expect(writerBiographyEditorialPostEditIssues(undefined)).toEqual([]);
    expect(
      writerBiographyEditorialPostEditIssues({
        editedAt: "2026-08-31T16:14:09.805Z",
        editor: "Codex bilingual editorial QA",
        reasonCodes: ["source-fact-restoration", "english-style-polish"],
      })
    ).toEqual([]);
    expect(
      writerBiographyEditorialPostEditIssues({
        editedAt: "not-a-date",
        editor: "",
        reasonCodes: ["unknown-reason", "unknown-reason"],
      })
    ).toEqual(
      expect.arrayContaining([
        "invalid-editorial-post-edit-timestamp",
        "invalid-editorial-post-edit-editor",
        "duplicate-editorial-post-edit-reason-code",
        "unknown-editorial-post-edit-reason-code",
      ])
    );
  });

  it("accepts a concise Russian editorial refinement using only reviewed facts", () => {
    const refined =
      "Атиq Рахими (1962) - афганский писатель и режиссёр, работающий с темами войны, памяти и человеческого достоинства. Он написал романы «Syngué sabour» и «Земля и пепел» и получил Гонкуровскую премию в 2008 году.";
    expect(
      assertWriterBiographyRussianEditorialQa({
        sourceText: source,
        allowedContext: "Атиq Рахими писал о войне, памяти и достоинстве.",
        writerName: "Атик Рахими",
        russianText: refined,
      })
    ).toBe(refined);
  });

  it("blocks source narration, repeated prose and unreviewed numbers", () => {
    const invalid =
      "Согласно источнику, Атиq Рахими (1962) - писатель, получивший премию в 2009 году. Согласно источнику, Атиq Рахими (1962) - писатель, получивший премию в 2009 году.";
    expect(
      writerBiographyRussianEditorialQaIssues({
        sourceText: source,
        allowedContext: "",
        writerName: "Атик Рахими",
        russianText: invalid,
      })
    ).toEqual(
      expect.arrayContaining([
        "russian-contains-source-narration",
        "russian-contains-repeated-sentence",
        "russian-unreviewed-number-added",
        "russian-source-work-omitted",
      ])
    );
  });

  it("blocks expanded source narration formulas and a missing writer identity", () => {
    for (const text of [
      "Профиль издателя подтверждает, что автор писал прозу. Второе предложение дополняет служебное описание без необходимых сведений об авторе.",
      "Архив университета включает сведения о писателе. Второе предложение дополняет служебное описание без необходимых сведений об авторе.",
      "Академическое издание определяет его как поэта. Второе предложение дополняет служебное описание без необходимых сведений об авторе.",
    ]) {
      expect(
        writerBiographyRussianEditorialQaIssues({
          sourceText:
            "Атик Рахими - афганский писатель. Он создаёт литературную прозу.",
          allowedContext: "",
          writerName: "Атик Рахими",
          russianText: text,
        })
      ).toEqual(
        expect.arrayContaining([
          "russian-contains-source-narration",
          "russian-writer-identity-omitted",
        ])
      );
    }
  });
});
