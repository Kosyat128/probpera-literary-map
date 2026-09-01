import { describe, expect, it } from "vitest";

import { translationErrorCode, translationErrorMessage } from "./translation-errors";

describe("translation errors", () => {
  it("classifies provider failures without exposing provider payloads", () => {
    expect(
      translationErrorCode(
        "OpenAI translation did not match the editorial schema: Invalid input"
      )
    ).toBe("provider_invalid_response");
    expect(
      translationErrorCode("Cloudflare Workers AI review request failed: secret detail")
    ).toBe("provider_request_failed");
  });

  it("renders only allow-listed Russian messages", () => {
    expect(translationErrorMessage("provider_invalid_response")).toContain(
      "редакционную проверку"
    );
    expect(translationErrorMessage("raw provider error")).toBeNull();
    expect(translationErrorMessage("database_write_failed")).toContain(
      "сохранить"
    );
    expect(translationErrorMessage("invalid_input")).toContain("полей");
    expect(translationErrorMessage("self_test_cooldown")).toContain("self-test");
  });

  it("classifies self-test schema failures without retaining their text", () => {
    expect(translationErrorCode("translation self-test schema mismatch")).toBe(
      "provider_invalid_response"
    );
  });
});
