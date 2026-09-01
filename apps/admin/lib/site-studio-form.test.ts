import { describe, expect, it } from "vitest";

import {
  parseSiteDesignChangeSetForm,
  parseSiteDesignTokenForm,
  SiteStudioFormError,
} from "./site-studio-form";

function tokenForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    layer: "component",
    target_key: "magazine",
    token_key: "color.surface",
    category: "color",
    value_type: "color",
    breakpoint: "base",
    state: "default",
    description: "Основной фон",
    draft_value: '"#ff7619"',
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("Site Studio form boundary", () => {
  it("normalizes a typed token payload", () => {
    expect(parseSiteDesignTokenForm(tokenForm())).toMatchObject({
      id: null,
      layer: "component",
      targetKey: "magazine",
      tokenKey: "color.surface",
      draftValue: "#ff7619",
      expectedVersion: null,
    });
  });

  it("requires identity and version to stay paired for existing tokens", () => {
    expect(() =>
      parseSiteDesignTokenForm(
        tokenForm({ token_id: "87fba928-735e-4eb3-88c7-672091076b21" })
      )
    ).toThrow("site_studio_version_invalid");
  });

  it("rejects arbitrary CSS-like values and category drift", () => {
    const invalidOverrides: Array<Record<string, string>> = [
      { draft_value: '"url(https://evil.test/x)"' },
      { category: "spacing", value_type: "effect", draft_value: '"fade"' },
      { target_key: "../unsafe" },
    ];
    for (const overrides of invalidOverrides) {
      expect(() => parseSiteDesignTokenForm(tokenForm(overrides))).toThrow(
        SiteStudioFormError
      );
    }
  });

  it("parses bounded change-set metadata", () => {
    const form = new FormData();
    form.set("name", "Осеннее оформление");
    form.set("description", "Проверенный набор токенов");
    expect(parseSiteDesignChangeSetForm(form)).toEqual({
      id: null,
      name: "Осеннее оформление",
      description: "Проверенный набор токенов",
      expectedVersion: null,
    });
  });
});
