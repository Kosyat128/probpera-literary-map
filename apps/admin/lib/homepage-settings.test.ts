import { describe, expect, it } from "vitest";

import {
  homepageSettingsPatch,
  isSafeHomepageButtonUrl,
} from "./homepage-settings";

const baseInput = {
  eyebrow: "Надзаголовок",
  description: "Описание",
  buttonText: "Открыть",
  buttonUrl: "/stati/",
};

describe("homepage settings patch", () => {
  it("does not clear article ids when the visual form omits that field", () => {
    const patch = homepageSettingsPatch(baseInput);
    const merged = {
      articleIds: ["article-1", "article-2"],
      ...patch,
    };

    expect(patch).not.toHaveProperty("articleIds");
    expect(merged.articleIds).toEqual(["article-1", "article-2"]);
  });

  it("allows a full form to replace or explicitly clear article ids", () => {
    expect(
      homepageSettingsPatch({
        ...baseInput,
        articleIdsText: "article-3, article-4",
      }).articleIds
    ).toEqual(["article-3", "article-4"]);
    expect(
      homepageSettingsPatch({ ...baseInput, articleIdsText: "" }).articleIds
    ).toEqual([]);
  });

  it("rejects protocol-relative and backslash-based button URLs", () => {
    expect(isSafeHomepageButtonUrl("/stati/")).toBe(true);
    expect(isSafeHomepageButtonUrl("#atlas")).toBe(true);
    expect(isSafeHomepageButtonUrl("mailto:editor@example.com")).toBe(true);
    expect(isSafeHomepageButtonUrl("//attacker.example/path")).toBe(false);
    expect(isSafeHomepageButtonUrl("/\\attacker.example/path")).toBe(false);
    expect(isSafeHomepageButtonUrl("\\attacker.example/path")).toBe(false);
    expect(() =>
      homepageSettingsPatch({
        ...baseInput,
        buttonUrl: "//attacker.example/path",
      })
    ).toThrow("Ссылка кнопки");
  });
});
