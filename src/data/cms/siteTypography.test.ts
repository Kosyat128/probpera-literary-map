import { describe, expect, it } from "vitest";

import {
  buildCmsTypographyStylesheet,
  cmsTypographyPageTarget,
  cmsTypographyTargetKey,
  cmsTypographyTemplateTarget,
  readCmsTypographySnapshot,
} from "./siteTypography";

const fontId = "11111111-1111-4111-8111-111111111111";
const sha = "a".repeat(64);

describe("published CMS typography", () => {
  it("emits only normalized self-hosted fonts and allowlisted declarations", () => {
    const css = buildCmsTypographyStylesheet(
      {
        fonts: [{
          id: fontId,
          familyName: "Archive Serif",
          sourceType: "uploaded",
          format: "woff2",
          publicPath: `cms/fonts/${sha}.woff2`,
          fontStyle: "normal",
          isVariable: true,
          weightMin: 300,
          weightMax: 800,
        }],
        overrides: [{
          layer: "site",
          targetKey: "global",
          semanticScope: "article",
          breakpoint: "base",
          settings: {
            familyId: fontId,
            fontSize: 20,
            lineHeight: 1.65,
            color: "red;position:fixed",
          },
        }],
      },
      "/probpera-literary-map/"
    );

    expect(css).toContain(`url(\"/probpera-literary-map/cms/fonts/${sha}.woff2\")`);
    expect(css).toContain("font-size:20px");
    expect(css).toContain("line-height:1.65");
    expect(css).not.toContain("position");
    expect(css).not.toContain("color:");
    expect(css).not.toContain("@import");
  });

  it("keeps breakpoint and inheritance selectors deterministic", () => {
    const css = buildCmsTypographyStylesheet({
      fonts: [],
      overrides: [
        {
          layer: "site",
          targetKey: "global",
          semanticScope: "h1",
          breakpoint: "base",
          settings: { systemFamily: "georgia", fontWeight: 700 },
        },
        {
          layer: "page",
          targetKey: "about",
          semanticScope: "h1",
          breakpoint: "mobile",
          settings: { fontSize: 32 },
        },
      ],
    });
    expect(css.indexOf("h1{")).toBeLessThan(css.indexOf("@media"));
    expect(css).toContain('[data-typography-page="about"] h1{font-size:32px}');
  });

  it("orders equal-specificity rules by the documented inheritance cascade", () => {
    const css = buildCmsTypographyStylesheet({
      fonts: [],
      overrides: ["instance", "site", "page", "component", "template"].map(
        (layer, index) => ({
          layer,
          targetKey: layer === "site" ? "site" : "sample",
          semanticScope: "h2",
          breakpoint: "base",
          settings: { fontWeight: 500 + index },
        })
      ),
    });
    const positions = ["site", "component", "template", "page", "instance"].map(
      (layer) => layer === "site"
        ? css.indexOf("h2{")
        : css.indexOf(`[data-typography-${layer}=\"sample\"] h2{`)
    );
    expect(positions.every((position, index) => index === 0 || position > positions[index - 1])).toBe(true);
  });

  it("keeps a later layer above responsive rules from earlier layers", () => {
    const css = buildCmsTypographyStylesheet({
      fonts: [],
      overrides: [
        {
          layer: "component",
          targetKey: "sample",
          semanticScope: "h2",
          breakpoint: "mobile",
          settings: { fontWeight: 500 },
        },
        {
          layer: "instance",
          targetKey: "sample",
          semanticScope: "h2",
          breakpoint: "base",
          settings: { fontWeight: 800 },
        },
      ],
    });
    expect(css.indexOf("font-weight:500")).toBeLessThan(css.indexOf("font-weight:800"));
  });

  it("scopes an instance rule to exactly one marked public element", () => {
    const css = buildCmsTypographyStylesheet({
      fonts: [],
      overrides: [{
        layer: "instance",
        targetKey: "article-cms-123",
        semanticScope: "article",
        breakpoint: "base",
        settings: { lineHeight: 1.8 },
      }],
    });
    expect(css).toContain(
      '[data-typography-instance="article-cms-123"] :is(.article-reader-content, [data-typography-scope="article"]){line-height:1.8}'
    );
    expect(css).not.toContain('[data-typography-page="article-cms-123"]');
  });

  it("drops malformed paths, targets and arbitrary records fail closed", () => {
    const value = readCmsTypographySnapshot({
      fonts: [{
        id: fontId,
        familyName: "Bad",
        sourceType: "uploaded",
        format: "woff2",
        publicPath: "https://evil.invalid/font.woff2",
        fontStyle: "normal",
        isVariable: false,
        weightMin: 400,
        weightMax: 400,
      }],
      overrides: [{
        layer: "instance",
        targetKey: 'x\"]{position:fixed}',
        semanticScope: "body",
        breakpoint: "base",
        settings: { fontSize: 100 },
      }],
    });
    expect(value).toEqual({ fonts: [], overrides: [] });
  });

  it("derives a stable page target beneath the configured base", () => {
    expect(
      cmsTypographyPageTarget(
        "/probpera-literary-map/articles/Example/",
        "/probpera-literary-map/"
      )
    ).toBe("articles_sl_example");
    expect(
      cmsTypographyPageTarget(
        "/probpera-literary-map",
        "/probpera-literary-map/"
      )
    ).toBe("home");
    expect(cmsTypographyPageTarget("/%E0%A4%A", "/")).toBe("home");
    expect(cmsTypographyTemplateTarget("/stati/esse/slug/", "/")).toBe("article");
    expect(cmsTypographyTemplateTarget("/stranitsy/about/", "/")).toBe("page");
    expect(cmsTypographyTemplateTarget("/stati/эссе/", "/")).toBe("article");
    expect(cmsTypographyTemplateTarget("/stranitsy/о-нас/", "/")).toBe("page");
    expect(cmsTypographyPageTarget("/stranitsy/о-нас/", "/")).not.toBe(
      cmsTypographyPageTarget("/stranitsy/контакты/", "/")
    );
    expect(cmsTypographyTargetKey(`страница-${"я".repeat(100)}`)).toMatch(
      /^[a-z0-9][a-z0-9_-]{0,79}$/u
    );
  });
});
