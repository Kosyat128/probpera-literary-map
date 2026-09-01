import { describe, expect, it } from "vitest";

import {
  canMutateSiteStudioComponent,
  normalizeSiteStudioColor,
  normalizeSiteStudioDuration,
  normalizeSiteStudioEffect,
  normalizeSiteStudioLayout,
  normalizeSiteStudioLength,
  normalizeSiteStudioShadow,
  normalizeSiteStudioTokenValue,
  resolveSiteStudioCascade,
  siteStudioComponentRegistry,
  siteStudioTokenCategoryValueTypes,
  type SiteStudioCascadeOverride,
} from "./site-studio-contract";

describe("Site Studio code-owned contract", () => {
  it("normalizes safe scalar and structured token values", () => {
    expect(normalizeSiteStudioColor(" #AbC ")).toBe("#aabbcc");
    expect(normalizeSiteStudioColor("#12345678")).toBe("#12345678");
    expect(normalizeSiteStudioLength("1.25rem", { min: 0, max: 10 })).toEqual({
      value: 1.25,
      unit: "rem",
    });
    expect(normalizeSiteStudioDuration("0.24s")).toBe(240);
    expect(
      normalizeSiteStudioShadow({
        x: "0px",
        y: "8px",
        blur: "24px",
        color: "#0008",
      })
    ).toEqual({
      x: { value: 0, unit: "px" },
      y: { value: 8, unit: "px" },
      blur: { value: 24, unit: "px" },
      spread: { value: 0, unit: "px" },
      color: "#00000088",
      inset: false,
    });
    expect(
      normalizeSiteStudioLayout({
        display: "grid",
        columns: 3,
        gap: "1rem",
        maxWidth: "1280px",
        alignItems: "stretch",
      })
    ).toEqual({
      display: "grid",
      columns: 3,
      gap: { value: 1, unit: "rem" },
      maxWidth: { value: 1280, unit: "px" },
      alignItems: "stretch",
    });
  });

  it("rejects arbitrary CSS, functions, remote values and unknown properties", () => {
    expect(() => normalizeSiteStudioColor("url(https://evil.test/x)")).toThrow(
      "site_studio_color_invalid"
    );
    expect(() => normalizeSiteStudioLength("calc(100% - 1px)")).toThrow(
      "site_studio_length_invalid"
    );
    expect(() =>
      normalizeSiteStudioShadow({
        x: "0px",
        y: "0px",
        blur: "1px",
        color: "#000",
        cssText: "position:fixed",
      })
    ).toThrow("site_studio_property_unknown");
    expect(() =>
      normalizeSiteStudioTokenValue("spacing", "effect", "fade")
    ).toThrow("site_studio_token_type_forbidden");
  });

  it("keeps category to value-type mappings closed", () => {
    expect(siteStudioTokenCategoryValueTypes.motion).toEqual([
      "duration",
      "easing",
      "effect",
    ]);
    expect(siteStudioTokenCategoryValueTypes.shadow).toEqual(["shadow"]);
  });

  it("uses only allowlisted effects and removes motion for reduced-motion", () => {
    expect(
      normalizeSiteStudioEffect({
        name: "reveal-up",
        durationMs: "0.4s",
        easing: "ease-in-out",
      })
    ).toEqual({
      name: "reveal-up",
      durationMs: 400,
      easing: "ease-in-out",
      reducedMotionFallback: "fade",
    });
    expect(normalizeSiteStudioEffect("reveal-up", true)).toEqual({
      name: "fade",
      durationMs: 0,
      easing: "linear",
      reducedMotionFallback: "fade",
    });
    expect(
      normalizeSiteStudioEffect({
        name: "reveal-up",
        durationMs: 320,
        easing: "ease-out",
        reducedMotionFallback: "fade",
      })
    ).toMatchObject({ name: "reveal-up", reducedMotionFallback: "fade" });
    expect(() =>
      normalizeSiteStudioEffect({
        name: "reveal-up",
        reducedMotionFallback: "none",
      })
    ).toThrow("site_studio_effect_invalid");
    expect(() => normalizeSiteStudioEffect("spin-and-run-js")).toThrow(
      "site_studio_effect_invalid"
    );
  });

  it("accepts normalized lengths for database and runtime round-trips", () => {
    expect(
      normalizeSiteStudioTokenValue("spacing", "length", {
        value: 12,
        unit: "px",
      })
    ).toEqual({ value: 12, unit: "px" });
    expect(() =>
      normalizeSiteStudioTokenValue("spacing", "length", {
        value: 12,
        unit: "px",
        css: "url(https://bad.test)",
      })
    ).toThrow("site_studio_property_unknown");
  });

  it("locks the globe and bookshelf to owners in the code-owned registry", () => {
    expect(siteStudioComponentRegistry["literary-globe"].ownerLocked).toBe(true);
    expect(siteStudioComponentRegistry.bookshelf.ownerLocked).toBe(true);
    expect(canMutateSiteStudioComponent("literary-globe", "admin")).toBe(false);
    expect(canMutateSiteStudioComponent("bookshelf", "owner")).toBe(true);
    expect(canMutateSiteStudioComponent("magazine", "admin")).toBe(true);
    expect(canMutateSiteStudioComponent("magazine", "editor")).toBe(false);
  });

  it("resolves layer, state and breakpoint precedence deterministically", () => {
    const overrides: SiteStudioCascadeOverride[] = [
      {
        id: "05-instance-mobile-hover",
        layer: "instance",
        targetKey: "article-42",
        breakpoint: "mobile",
        state: "hover",
        values: { "color.text": "#555555", "space.gap": 20 },
      },
      {
        id: "01-site-base",
        layer: "site",
        targetKey: "site",
        breakpoint: "base",
        state: "default",
        values: { "color.text": "#111111", "space.gap": 8 },
      },
      {
        id: "04-page-mobile",
        layer: "page",
        targetKey: "article",
        breakpoint: "mobile",
        state: "default",
        values: { "space.gap": 16 },
      },
      {
        id: "03-template-hover",
        layer: "template",
        targetKey: "article",
        breakpoint: "base",
        state: "hover",
        values: { "color.text": "#444444" },
      },
      {
        id: "03-component-hover",
        layer: "component",
        targetKey: "article-reader",
        breakpoint: "base",
        state: "hover",
        values: { "color.text": "#333333" },
      },
      {
        id: "02-component-mobile",
        layer: "component",
        targetKey: "article-reader",
        breakpoint: "mobile",
        state: "default",
        values: { "color.text": "#222222" },
      },
    ];
    const context = {
      breakpoint: "mobile" as const,
      state: "hover" as const,
      targetKeys: {
        component: "article-reader",
        template: "article",
        page: "article",
        instance: "article-42",
      },
    };
    const forward = resolveSiteStudioCascade(overrides, context);
    const reverse = resolveSiteStudioCascade([...overrides].reverse(), context);

    expect(forward).toEqual(reverse);
    expect(forward.values).toEqual({
      "color.text": "#555555",
      "space.gap": 20,
    });
    expect(forward.sources).toEqual({
      "color.text": "05-instance-mobile-hover",
      "space.gap": "05-instance-mobile-hover",
    });
  });

  it("fails closed on duplicate override IDs and unsafe token names", () => {
    const base: SiteStudioCascadeOverride = {
      id: "duplicate",
      layer: "site",
      targetKey: "site",
      breakpoint: "base",
      state: "default",
      values: { "color.text": "#111111" },
    };
    expect(() => resolveSiteStudioCascade([base, base], { breakpoint: "base" }))
      .toThrow("site_studio_override_id_invalid");
    expect(() =>
      resolveSiteStudioCascade(
        [{ ...base, id: "unsafe", values: { constructor: "bad" } }],
        { breakpoint: "base" }
      )
    ).toThrow("site_studio_token_name_invalid");
  });
});
