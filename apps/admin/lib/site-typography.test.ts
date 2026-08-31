import { describe, expect, it } from "vitest";

import {
  expectedTypographyVersionFromForm,
  parseSiteTypographyProperties,
  parseTypographyTarget,
  readSiteTypographyProperties,
  resolveSiteTypography,
  typographyPropertiesInputFromForm,
  typographyPropertyFormValues,
  typographyTargetFromForm,
  type SiteTypographyOverride,
} from "./site-typography";

const familyId = "2ea3fe6f-9a32-4dad-86e3-4677614f5e56";

describe("site typography contract", () => {
  it("parses only the publication allowlist and preserves camelCase keys", () => {
    expect(
      parseSiteTypographyProperties({
        familyId: familyId.toUpperCase(),
        fontSize: "18.5",
        fontWeight: "625",
        fontStyle: "italic",
        lineHeight: "1.55",
        letterSpacing: "0.02",
        textAlign: "justify",
        textTransform: "none",
        textDecoration: "underline",
        textIndent: "1.2",
        wordSpacing: "0.1",
      })
    ).toEqual({
      familyId,
      fontSize: 18.5,
      fontWeight: 625,
      fontStyle: "italic",
      lineHeight: 1.55,
      letterSpacing: 0.02,
      textAlign: "justify",
      textTransform: "none",
      textDecoration: "underline",
      textIndent: 1.2,
      wordSpacing: 0.1,
    });
  });

  it("rejects raw CSS, remote font families and conflicting family sources", () => {
    expect(() =>
      parseSiteTypographyProperties({ cssText: "position:fixed" })
    ).toThrow("неизвестное CSS-свойство");
    expect(() =>
      parseSiteTypographyProperties({ systemFamily: "url(https://example.test/font)" })
    ).toThrow("Недопустимое");
    expect(() =>
      parseSiteTypographyProperties({ familyId, systemFamily: "georgia" })
    ).toThrow("либо загруженный, либо системный");
    expect(() =>
      parseSiteTypographyProperties({ fontSize: 145 })
    ).toThrow("144");
    expect(() =>
      parseSiteTypographyProperties({
        familyId: "2ea3fe6f-9a32-6dad-86e3-4677614f5e56",
      })
    ).toThrow("неизвестный файл");
  });

  it("validates semantic targets and exact target_key policy", () => {
    expect(
      parseTypographyTarget({
        layer: "component",
        targetKey: "article-card_2",
        semanticScope: "h2",
        breakpoint: "tablet",
      })
    ).toEqual({
      layer: "component",
      targetKey: "article-card_2",
      semanticScope: "h2",
      breakpoint: "tablet",
    });
    expect(() =>
      parseTypographyTarget({
        layer: "page",
        targetKey: "Article / Home",
        semanticScope: "page",
        breakpoint: "base",
      })
    ).toThrow("a-z, 0-9");
    expect(() =>
      parseTypographyTarget({
        layer: "site",
        targetKey: "global",
        semanticScope: "body",
        breakpoint: "base",
      })
    ).toThrow("ключ области должен быть «site»");
  });

  it("builds strict values from forms and parses the rendered version", () => {
    const form = new FormData();
    form.set("layer", "page");
    form.set("target_key", "literature");
    form.set("semantic_scope", "lead");
    form.set("breakpoint", "mobile");
    form.set("family_kind", "system");
    form.set("systemFamily", "system-serif");
    form.set("familyId", familyId);
    form.set("fontSize", "21");
    form.set("expected_version", "7");

    expect(typographyTargetFromForm(form)).toEqual({
      layer: "page",
      targetKey: "literature",
      semanticScope: "lead",
      breakpoint: "mobile",
    });
    expect(typographyPropertiesInputFromForm(form)).toEqual({
      systemFamily: "system-serif",
      fontSize: 21,
    });
    expect(expectedTypographyVersionFromForm(form)).toBe(7);

    form.set("family_kind", "remote");
    expect(() => typographyPropertiesInputFromForm(form)).toThrow(
      "неизвестный источник"
    );
    form.set("family_kind", "asset");
    form.set("familyId", "");
    expect(() => typographyPropertiesInputFromForm(form)).toThrow(
      "менеджера шрифтов"
    );
    form.set("expected_version", "0");
    expect(() => expectedTypographyVersionFromForm(form)).toThrow("Версия");
  });

  it("resolves site to instance and base to breakpoint deterministically", () => {
    const overrides: SiteTypographyOverride[] = [
      {
        layer: "site",
        targetKey: "site",
        semanticScope: "body",
        breakpoint: "base",
        settings: { systemFamily: "georgia", fontSize: 16, lineHeight: 1.5 },
      },
      {
        layer: "site",
        targetKey: "site",
        semanticScope: "body",
        breakpoint: "mobile",
        settings: { fontSize: 15 },
      },
      {
        layer: "component",
        targetKey: "reader",
        semanticScope: "body",
        breakpoint: "base",
        settings: { fontSize: 18, textAlign: "justify" },
      },
      {
        layer: "component",
        targetKey: "reader",
        semanticScope: "body",
        breakpoint: "mobile",
        settings: { fontSize: 17 },
      },
      {
        layer: "page",
        targetKey: "article",
        semanticScope: "body",
        breakpoint: "mobile",
        settings: { lineHeight: 1.7 },
      },
    ];

    expect(
      resolveSiteTypography(overrides, {
        semanticScope: "body",
        breakpoint: "mobile",
        targetKeys: { component: "reader", page: "article" },
      })
    ).toEqual({
      systemFamily: "georgia",
      fontSize: 17,
      lineHeight: 1.7,
      textAlign: "justify",
    });
  });

  it("fails closed when stored JSON is invalid and returns stable form values", () => {
    expect(readSiteTypographyProperties({ fontFamily: "Comic Sans" })).toEqual({});
    expect(typographyPropertyFormValues({ systemFamily: "times", fontSize: 20 }))
      .toMatchObject({ systemFamily: "times", fontSize: "20", familyId: "" });
  });
});
