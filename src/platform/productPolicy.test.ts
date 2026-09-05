import { describe, expect, it } from "vitest";
import { isAuthorizedPreparationAction, isLocalePreferenceSource, productPolicy } from "./productPolicy";

describe("shared V12 policy boundary", () => {
  it.each(["ip", "nationality", "sim", "store-country", "en", null, { source: "system-language" }])
    ("does not accept %s as a language preference signal", (source) => {
      expect(isLocalePreferenceSource(source)).toBe(false);
    });
  it("accepts only explicit, saved and system language preferences", () => {
    for (const source of ["explicit-selection", "saved-preference", "system-language"]) expect(isLocalePreferenceSource(source)).toBe(true);
  });
  it.each(["submit", "release", "deploy", "merge", "accept-agreement", "upload-draft", "grant-entitlement", "BUILD", null])
    ("rejects ungranted action %s even if its name resembles preparation", (action) => {
      expect(isAuthorizedPreparationAction(action)).toBe(false);
    });
  it("keeps independent local preparation available", () => {
    for (const action of ["validate", "build", "package", "write-draft-files"]) expect(isAuthorizedPreparationAction(action)).toBe(true);
  });
  it("prevents mutation of required locales and safe defaults", () => {
    expect(() => Object.assign(productPolicy, { machineTranslationPublication: true })).toThrow();
    expect(() => (productPolicy.requiredLocales as unknown as string[]).push("fr")).toThrow();
    expect(productPolicy.requiredLocales).toEqual(["ru", "en"]);
  });
});
