import { describe, expect, it, vi } from "vitest";

import { premiumTranslateToEnglish } from "./premium-english-translation";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: { type: "string" } },
} as const;

function response(text: string, id: string, requestId: string) {
  return new Response(
    JSON.stringify({
      id,
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ text }) }],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 40 },
    }),
    { status: 200, headers: { "x-request-id": requestId } }
  );
}

describe("premium English translation", () => {
  it("uses independent pro-max translator and reviewer passes", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response("First draft", "resp_translate", "req_translate")
      )
      .mockResolvedValueOnce(
        response("Final native English", "resp_review", "req_review")
      ) as unknown as typeof fetch;

    const result = await premiumTranslateToEnglish({
      source: { text: "Русский исходник" },
      schema,
      schemaName: "test_translation",
      validate(value) {
        if (
          !value ||
          typeof value !== "object" ||
          typeof (value as { text?: unknown }).text !== "string"
        ) {
          throw new Error("invalid");
        }
        return { text: (value as { text: string }).text };
      },
      apiKey: "test-key",
      model: "gpt-5.6-sol",
      reviewerModel: "gpt-5.6-sol",
      reasoningEffort: "max",
      reasoningMode: "pro",
      reviewerReasoningEffort: "max",
      reviewerReasoningMode: "pro",
      review: true,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.value.text).toBe("Final native English");
    expect(result.translatorModel).toBe("gpt-5.6-sol");
    expect(result.reviewerModel).toBe("gpt-5.6-sol");
    expect(result.translatorReasoningEffort).toBe("max");
    expect(result.translatorReasoningMode).toBe("pro");
    expect(result.reviewerReasoningEffort).toBe("max");
    expect(result.reviewerReasoningMode).toBe("pro");
    expect(result.translatorRequestId).toBe("req_translate");
    expect(result.reviewerRequestId).toBe("req_review");

    const firstBody = JSON.parse(
      String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body)
    );
    const secondBody = JSON.parse(
      String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]?.body)
    );
    expect(firstBody.store).toBe(false);
    expect(firstBody.model).toBe("gpt-5.6-sol");
    expect(firstBody.reasoning).toEqual({ effort: "max", mode: "pro" });
    expect(firstBody.text.format.strict).toBe(true);
    expect(secondBody.model).toBe("gpt-5.6-sol");
    expect(secondBody.reasoning).toEqual({ effort: "max", mode: "pro" });
    expect(secondBody.input).toContain("DRAFT_TRANSLATION");
    expect(secondBody.input).toContain("SOURCE_DATA");
  });

  it("supports explicitly disabling the reviewer for controlled fallback", async () => {
    const fetchImpl = vi.fn(async () =>
      response("Single pass", "resp_single", "req_single")
    ) as unknown as typeof fetch;

    const result = await premiumTranslateToEnglish({
      source: { text: "Текст" },
      schema,
      schemaName: "test_single",
      validate(value) {
        return value as { text: string };
      },
      apiKey: "test-key",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      reasoningMode: "standard",
      review: false,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.value.text).toBe("Single pass");
    expect(result.reviewerModel).toBeNull();
    expect(result.translatorReasoningEffort).toBe("high");
    expect(result.translatorReasoningMode).toBe("standard");
    expect(result.reviewerReasoningEffort).toBeNull();
    expect(result.reviewerReasoningMode).toBeNull();

    const body = JSON.parse(
      String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body)
    );
    expect(body.reasoning).toEqual({ effort: "high", mode: "standard" });
  });

  it("never calls OpenAI without a server API key", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      premiumTranslateToEnglish({
        source: { text: "Текст" },
        schema,
        schemaName: "test_no_key",
        validate(value) {
          return value as { text: string };
        },
        apiKey: "",
        fetchImpl,
      })
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
