import { describe, expect, it, vi } from "vitest";

import {
  premiumTranslateToEnglish,
  type WorkersAiBinding,
} from "./premium-english-translation";

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

function validateText(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { text?: unknown }).text !== "string"
  ) {
    throw new Error("invalid");
  }
  return { text: (value as { text: string }).text };
}

describe("premium English translation", () => {
  it("uses independent pro-max translator and reviewer passes on explicit OpenAI", async () => {
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
      validate: validateText,
      provider: "openai",
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

  it("uses Workers AI for both free premium passes without an OpenAI key", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        id: "cf_translate",
        model: "@cf/google/gemma-4-26b-a4b-it",
        response: { text: "First Workers AI draft" },
        usage: { prompt_tokens: 90, completion_tokens: 35 },
      })
      .mockResolvedValueOnce({
        id: "cf_review",
        model: "@cf/zai-org/glm-4.7-flash",
        response: { text: "Final Workers AI English" },
        usage: { prompt_tokens: 125, completion_tokens: 30 },
      });
    const aiBinding = { run } as unknown as WorkersAiBinding;

    const result = await premiumTranslateToEnglish({
      source: { text: "Русский исходник" },
      schema,
      schemaName: "workers_ai_translation",
      validate: validateText,
      provider: "cloudflare",
      aiBinding,
      review: true,
    });

    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0]?.[0]).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(run.mock.calls[1]?.[0]).toBe("@cf/zai-org/glm-4.7-flash");
    expect(result.value.text).toBe("Final Workers AI English");
    expect(result.translatorRequestId).toBe("cf_translate");
    expect(result.reviewerRequestId).toBe("cf_review");
    expect(result.inputTokens).toBe(90);
    expect(result.reviewOutputTokens).toBe(30);
    expect(result.translatorReasoningEffort).toBe("none");
    expect(result.translatorReasoningMode).toBe("standard");

    const firstInput = run.mock.calls[0]?.[1] as Record<string, unknown>;
    const secondInput = run.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(firstInput.response_format).toEqual({
      type: "json_schema",
      json_schema: schema,
    });
    expect(JSON.stringify(secondInput)).toContain("DRAFT_TRANSLATION");
    expect(JSON.stringify(secondInput)).toContain("SOURCE_DATA");
  });

  it("supports explicitly disabling the reviewer for controlled OpenAI fallback", async () => {
    const fetchImpl = vi.fn(async () =>
      response("Single pass", "resp_single", "req_single")
    ) as unknown as typeof fetch;

    const result = await premiumTranslateToEnglish({
      source: { text: "Текст" },
      schema,
      schemaName: "test_single",
      validate: validateText,
      provider: "openai",
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
        validate: validateText,
        provider: "openai",
        apiKey: "",
        fetchImpl,
      })
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not silently fall back to paid OpenAI when Workers AI is unavailable", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      premiumTranslateToEnglish({
        source: { text: "Текст" },
        schema,
        schemaName: "test_no_binding",
        validate: validateText,
        provider: "cloudflare",
        aiBinding: null,
        apiKey: "paid-key-must-not-be-used",
        fetchImpl,
      })
    ).rejects.toThrow("Cloudflare Workers AI binding is not configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
