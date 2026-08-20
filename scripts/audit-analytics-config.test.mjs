import { describe, expect, it } from "vitest";

import { validateMetrikaCounterId } from "./audit-analytics-config.mjs";

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
});
