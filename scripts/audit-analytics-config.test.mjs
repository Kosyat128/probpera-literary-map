import { describe, expect, it } from "vitest";

import {
  cspDirectiveIncludes,
  validateMetrikaCounterId,
} from "./audit-analytics-config.mjs";

describe("Yandex Metrika environment contract", () => {
  it("keeps an absent public counter disabled", () => {
    expect(validateMetrikaCounterId(undefined)).toEqual({
      configured: false,
      counterId: "",
    });
    expect(validateMetrikaCounterId("  ")).toEqual({
      configured: false,
      counterId: "",
    });
  });

  it("accepts a proven numeric counter and rejects invented-looking values", () => {
    expect(validateMetrikaCounterId(" 12345678 ")).toEqual({
      configured: true,
      counterId: "12345678",
    });
    expect(() => validateMetrikaCounterId("counter-123")).toThrow(
      "positive safe numeric"
    );
    expect(() => validateMetrikaCounterId("0")).toThrow(
      "positive safe numeric"
    );
    expect(() => validateMetrikaCounterId("9999999999999999")).toThrow(
      "positive safe numeric"
    );
  });

  it("checks CSP directives without depending on source ordering", () => {
    const policySource = `export const policy = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://mc.yandex.ru https://yastatic.net; connect-src 'self' https://mc.yandex.kz;";`;

    expect(
      cspDirectiveIncludes(policySource, "script-src", [
        "'self'",
        "https://mc.yandex.ru",
        "https://yastatic.net",
      ])
    ).toBe(true);
    expect(
      cspDirectiveIncludes(policySource, "connect-src", [
        "https://mc.yandex.kz",
      ])
    ).toBe(true);
    expect(
      cspDirectiveIncludes(policySource, "script-src", [
        "https://untrusted.example",
      ])
    ).toBe(false);
  });
});
