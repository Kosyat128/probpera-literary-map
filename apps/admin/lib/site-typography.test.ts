import { describe, expect, it } from "vitest";

import {
  expectedTypographyVersionFromForm,
  parseSiteTypographyProperties,
  parseTypographyTarget,
  readSiteTypographyProperties,
  SiteTypographyValidationError,
  typographyPropertiesInputFromForm,
  typographyTargetFromForm,
  type SiteTypographyErrorCode,
  type SiteTypographyOverride,
} from "./site-typography";
import {
  resolveSiteTypography,
  typographyErrorMessage,
  typographyPropertyFormValues,
} from "./site-typography-ui";

const familyId = "2ea3fe6f-9a32-4dad-86e3-4677614f5e56";

function expectTypographyCode(
  operation: () => unknown,
  code: SiteTypographyErrorCode
) {
  try {
    operation();
    throw new Error(`Expected typography validation error: ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(SiteTypographyValidationError);
    expect(error).toMatchObject({ code, message: code });
  }
}

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
    expectTypographyCode(
      () => parseSiteTypographyProperties({ cssText: "position:fixed" }),
      "typography_property_unknown"
    );
    expectTypographyCode(
      () =>
        parseSiteTypographyProperties({
          systemFamily: "url(https://example.test/font)",
        }),
      "typography_value_invalid"
    );
    expectTypographyCode(
      () => parseSiteTypographyProperties({ familyId, systemFamily: "georgia" }),
      "typography_font_source_conflict"
    );
    expectTypographyCode(
      () => parseSiteTypographyProperties({ fontSize: 145 }),
      "typography_number_invalid"
    );
    expectTypographyCode(
      () =>
        parseSiteTypographyProperties({
          familyId: "2ea3fe6f-9a32-6dad-86e3-4677614f5e56",
        }),
      "typography_font_id_invalid"
    );
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
    expectTypographyCode(
      () =>
        parseTypographyTarget({
          layer: "page",
          targetKey: "Article / Home",
          semanticScope: "page",
          breakpoint: "base",
        }),
      "typography_target_key_invalid"
    );
    expectTypographyCode(
      () =>
        parseTypographyTarget({
          layer: "site",
          targetKey: "global",
          semanticScope: "body",
          breakpoint: "base",
        }),
      "typography_site_key_invalid"
    );
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
    expectTypographyCode(
      () => typographyPropertiesInputFromForm(form),
      "typography_family_kind_invalid"
    );
    form.set("family_kind", "asset");
    form.set("familyId", "");
    expectTypographyCode(
      () => typographyPropertiesInputFromForm(form),
      "typography_asset_required"
    );
    form.set("expected_version", "0");
    expectTypographyCode(
      () => expectedTypographyVersionFromForm(form),
      "typography_version_invalid"
    );
  });

  it("maps stable error codes to Russian client copy and hides unknown values", () => {
    expect(typographyErrorMessage("typography_empty")).toContain(
      "Укажите хотя бы один параметр"
    );
    expect(typographyErrorMessage("typography_stale")).toContain(
      "изменена в другой вкладке"
    );
    expect(typographyErrorMessage("произвольный текст из query")).toBe(
      "Не удалось выполнить действие с типографикой."
    );
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

  it("replaces inherited font sources in either direction", () => {
    for (const [earlier, later] of [
      [{ familyId }, { systemFamily: "georgia" as const }],
      [{ systemFamily: "georgia" as const }, { familyId }],
    ]) {
      expect(resolveSiteTypography([
        { layer: "site", targetKey: "site", semanticScope: "article", breakpoint: "base", settings: earlier },
        { layer: "instance", targetKey: "sample", semanticScope: "article", breakpoint: "mobile", settings: later },
      ], {
        semanticScope: "article", breakpoint: "mobile", targetKeys: { instance: "sample" },
      })).toEqual(later);
    }
  });
});
