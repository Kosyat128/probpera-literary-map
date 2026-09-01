import { describe, expect, it, vi } from "vitest";

import worker, {
  refineRussianBiography,
  validRussianEditorialRequest,
} from "./writer-biography-english-translation-worker";

const validRequest = {
  key: "afghanistan:atiq_rahimi",
  writerName: "Атик Рахими",
  reviewedTextRu:
    "Атик Рахими - афганский писатель и режиссёр. Его проза обращается к памяти и последствиям войны.",
  claims: [
    {
      textRu: "Атик Рахими является писателем и режиссёром.",
      verdict: "supported",
    },
  ],
  evidence: [
    {
      provider: "Authority source",
      url: "https://example.org/atiq-rahimi",
      checkedAt: "2026-08-31",
      findingRu: "Источник подтверждает профессию автора.",
    },
  ],
  expectedSourceHash: "a".repeat(64),
};

describe("writer biography Workers AI request validation", () => {
  it("validates the record-local claims and evidence arrays", () => {
    expect(validRussianEditorialRequest(validRequest)).toBe(true);
  });

  it("rejects malformed claims and evidence before an AI call", () => {
    expect(
      validRussianEditorialRequest({
        ...validRequest,
        claims: [{ textRu: "Факт", verdict: "unknown" }],
      })
    ).toBe(false);
    expect(
      validRussianEditorialRequest({
        ...validRequest,
        evidence: [{ ...validRequest.evidence[0], url: "http://example.org" }],
      })
    ).toBe(false);
  });

  it("uses a successful reviewer repair as the final second pass", async () => {
    const repairedText =
      "Атик Рахими - афганский писатель и режиссёр, чьё творчество связано с темами войны и памяти. Его литературная проза обращается к последствиям войны и сохранению человеческой памяти.";
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        id: "draft-id",
        response: { text: "Короткий черновик." },
        usage: { input_tokens: 11, output_tokens: 3 },
      })
      .mockResolvedValueOnce({
        id: "repair-id",
        response: { text: repairedText },
        usage: { input_tokens: 17, output_tokens: 29 },
      });

    const result = await refineRussianBiography(validRequest, {
      AI: { run },
    } as unknown as WriterBiographyEnglishWorkerEnv);

    expect(run).toHaveBeenCalledTimes(2);
    expect(result.value.text).toBe(repairedText);
    expect(result.translatorRequestId).toBe("draft-id");
    expect(result.reviewerRequestId).toBe("repair-id");
    expect(result.reviewInputTokens).toBe(17);
    expect(result.reviewOutputTokens).toBe(29);
  });

  it("audits every English translation, repair and review inference", async () => {
    const finalText =
      "Atiq Rahimi is an Afghan writer and director whose literary work addresses war, memory and the consequences of conflict. His prose returns to the relationship between remembered experience and the aftermath of war.";
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        id: "en-translation-id",
        response: { text: "Short." },
        usage: { input_tokens: 5, output_tokens: 2 },
      })
      .mockResolvedValueOnce({
        id: "en-repair-id",
        response: { text: finalText },
        usage: { input_tokens: 7, output_tokens: 11 },
      })
      .mockResolvedValueOnce({
        id: "en-review-id",
        response: { text: finalText },
        usage: { input_tokens: 13, output_tokens: 17 },
      });
    const response = await worker.fetch(
      new Request("http://127.0.0.1/en", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: validRequest.key,
          writerName: validRequest.writerName,
          text: validRequest.reviewedTextRu,
        }),
      }),
      { AI: { run } } as unknown as WriterBiographyEnglishWorkerEnv
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(3);
    const firstInput = run.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(firstInput)).toContain("requiredQuotedSpanCount");
    expect(JSON.stringify(firstInput)).toContain("requiredLatinTokens");
    expect(JSON.stringify(firstInput)).toContain("nicknames");
    expect(payload).toMatchObject({
      translatorRequestId: "en-translation-id",
      reviewerRequestId: "en-review-id",
      reviewInputTokens: 20,
      reviewOutputTokens: 28,
      passes: [
        { phase: "translation", requestId: "en-translation-id" },
        { phase: "repair", requestId: "en-repair-id" },
        { phase: "review", requestId: "en-review-id" },
      ],
    });
  });
});
