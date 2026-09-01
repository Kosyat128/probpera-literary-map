import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  publishableRussianEditorialFacts,
  russianEditorialAllowedContext,
  russianEditorialRefinementProvenanceIssues,
  russianEditorialSourcePayload,
  russianEditorialSourceSha256,
} from "./writer-biography-russian-editorial-contract.mjs";

const record = {
  key: "afghanistan:atiq_rahimi",
  writerName: "Атик Рахими",
  reviewedTextRu:
    "Атик Рахими - афганский писатель и режиссёр. Он пишет о войне и памяти.",
  claims: [
    { textRu: "Получил Гонкуровскую премию в 2008 году.", verdict: "supported" },
    { textRu: "Родился в 1961 году.", verdict: "not-established" },
  ],
  evidence: [
    {
      provider: "Prix Goncourt",
      url: "https://example.org/atiq",
      checkedAt: "2026-08-31",
      findingRu: "Подтверждены премия и 2008 год.",
    },
  ],
};

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("Russian editorial request contract", () => {
  it("SHA-binds key, writer name, source text, claims and evidence", () => {
    const baseline = digest(russianEditorialSourcePayload(record));
    expect(baseline).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      digest(
        russianEditorialSourcePayload({
          ...record,
          writerName: "Другой автор",
        })
      )
    ).not.toBe(baseline);
    expect(
      digest(
        russianEditorialSourcePayload({
          ...record,
          reviewedTextRu: `${record.reviewedTextRu} Изменение.`,
        })
      )
    ).not.toBe(baseline);
  });

  it("uses the same Web Crypto digest required by the Worker", async () => {
    await expect(russianEditorialSourceSha256(record)).resolves.toBe(
      digest(russianEditorialSourcePayload(record))
    );
  });

  it("removes not-established claims from prompt and QA allow-list", () => {
    const facts = publishableRussianEditorialFacts(record);
    expect(facts.claims).toEqual([record.claims[0]]);
    expect(russianEditorialAllowedContext(record)).toContain("2008");
    expect(russianEditorialAllowedContext(record)).not.toContain("1961");
  });

  it("does not expose editorial-process notes as biography facts", () => {
    const withEditorialNote = {
      ...record,
      claims: [
        ...record.claims,
        {
          textRu: "Оценочный суперлатив заменён проверяемой формулировкой.",
          verdict: "corrected",
        },
      ],
      evidence: [
        ...record.evidence,
        {
          ...record.evidence[0],
          findingRu: "Источник обосновывает исправленную формулировку.",
        },
      ],
    };
    expect(russianEditorialAllowedContext(withEditorialNote)).not.toMatch(
      /суперлатив|исправленную/iu
    );
  });

  it("requires the exact translator and independent reviewer pair", () => {
    expect(
      russianEditorialRefinementProvenanceIssues({
        translatorModel: "@cf/google/gemma-4-26b-a4b-it",
        reviewerModel: "@cf/openai/gpt-oss-120b",
      })
    ).toEqual([]);
    expect(
      russianEditorialRefinementProvenanceIssues({
        reviewerModel: "@cf/openai/gpt-oss-120b",
      })
    ).toContain("missing-or-unexpected-translator-model");
  });
});
