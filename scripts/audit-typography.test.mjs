import { describe, expect, it } from "vitest";
import { auditTypography } from "./audit-typography.mjs";

const canonical = `@layer site-typography {
  :root { --type-title: 1.5rem; --type-body: 1rem; }
  .hero-editorial h1, .article-copy h3, .library-card-copy h3,
  .share-links > span, .article-reader-content, .cms-page-prose { font-size: var(--type-title); }
}`;
const scan = (css, canonicalCss = canonical) => auditTypography({
  "src/styles/site-typography.css": canonicalCss,
  "src/index.css": css,
}).map((issue) => issue.message);

describe("canonical typography audit", () => {
  it("accepts aliases, loaded weights, responsive tokens and icon geometry", () => {
    expect(scan(`@layer site-defaults {
      .article-copy h3 { font-family: var(--serif); font-weight: 400; }
      .share-icon { height: 44px; overflow: hidden; }
      .article-card-footer { min-height: 44px; }
      [data-cms-field="title"] { font-weight: var(--cms-title-weight); }
    }`)).toEqual([]);
  });

  it("detects a contextual duplicate inside a media query", () => {
    expect(scan("@media (max-width: 500px) { .magazine .article-copy h3 { font-size: 23px; } }").join(" "))
      .toContain("second owner");
  });

  it("rejects containment on subgrid carriers across scoped stylesheet rules", () => {
    const results = auditTypography({
      "src/styles/site-typography.css": canonical,
      "src/styles/layout.css": "#sections .section-directory-card { grid-template-rows: subgrid; } #sections .section-directory-card > div { grid-template-rows: subgrid; }",
      "src/styles/cards.css": ".section-directory-card { container-type: inline-size; } .section-directory-card > div { container: card / inline-size; }",
    });
    expect(results.filter((issue) => issue.message.includes("Subgrid carrier"))).toHaveLength(2);
    expect(scan(".card { grid-template-rows: subgrid; } .card .copy { container-type: inline-size; } .card { container-type: normal; }")).toEqual([]);
  });

  it("checks shorthand families and weights as well as longhands", () => {
    const issues = scan('.one { font: 750 14px/1.4 var(--sans); } .two { font: 400 1rem Georgia; } .three { font-weight: 500; font-family: Arial; }');
    expect(issues).toHaveLength(4);
    expect(issues.join(" ")).toContain("no bundled local face");
  });

  it("preserves only the explicitly requested legacy Header/Hero island", () => {
    expect(scan('.brand strong { font-weight: 500; } .hero-editorial > p { overflow-wrap: anywhere; }')).toEqual([]);
    expect(scan('.footer-brand strong { font-weight: 500; } .atlas-controls .interface-language-control button { font-weight: 900; } .article-copy h3 { font-weight: 800; }'))
      .toHaveLength(3);
    expect(auditTypography({
      "src/styles/site-typography.css": canonical,
      "src/styles/header-preserved.css": '.site-header { --sans: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }',
    })).toEqual([]);
    expect(auditTypography({
      "src/styles/site-typography.css": canonical,
      "src/styles/header-preserved.css": ':root { --sans: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }',
    }).length).toBeGreaterThan(0);
  });

  it("rejects truncation and broken words without confusing icon clipping", () => {
    expect(scan('.article-copy h3 { -webkit-line-clamp: 2; } .library-card-copy p { overflow: hidden; } .article-card-footer { height: 40px; } .article-reader-content { overflow-wrap: anywhere; word-break: break-all; }'))
      .toHaveLength(5);
  });

  it("allows emergency URL wrapping only on bibliography anchors", () => {
    expect(scan('.article-reader-sources a { overflow-wrap: anywhere; word-break: normal; }')).toEqual([]);
    expect(scan(`
      .article-reader-sources li { overflow-wrap: anywhere; }
      .article-reader-sources a, .article-reader-sources li { overflow-wrap: anywhere; }
      .article-reader-content a { overflow-wrap: anywhere; }
      .article-reader-sources a { word-break: break-all; }
    `)).toEqual(Array(4).fill(expect.stringContaining("Unsafe public text wrapping")));
  });

  it("rejects tight non-display leading including token aliases and shorthand", () => {
    expect(scan('.article-copy h3 { line-height: 0.9; } .library-card-copy p { line-height: 90%; } .share-links > span { font: 400 1rem/0.8 var(--sans); }')
      .filter((message) => message.includes("line-height is smaller"))).toHaveLength(3);
    expect(scan("", canonical.replace("--type-body: 1rem", "--type-body: 1rem; --leading-copy: 0.95")
      .replace("font-size: var(--type-title)", "font-size: var(--type-title); line-height: var(--leading-copy)")).join(" "))
      .toContain("line-height is smaller");
    expect(scan('.hero-editorial h1 { line-height: 0.95; } .share-icon { line-height: 0; }')).toEqual([]);
  });

  it("detects repeated canonical properties within matching conditions only", () => {
    const repeated = canonical.replace("\n}", `
      .article-copy h3 { font-size: var(--type-body); }
      @media (max-width: 500px) { .article-copy h3 { line-height: 1.2; } }
      @media (max-width: 500px) { .article-copy h3 { line-height: 1.3; } }
    }`);
    expect(scan("", repeated).filter((message) => message.includes("Duplicate canonical property")))
      .toHaveLength(2);
    const distinct = canonical.replace("\n}", `
      .is-featured .article-copy h3 { font-size: var(--type-body); }
      @media (max-width: 500px) { .article-copy h3 { font-size: var(--type-body); } }
      @supports (font-size: 1cqi) { .article-copy h3 { --type-title: 1.75rem; } }
    }`);
    expect(scan("", distinct)).toEqual([]);
  });

  it("fails closed for missing owners, invalid CSS and undersized aliased tokens", () => {
    expect(auditTypography({})).not.toEqual([]);
    expect(scan(".bad { ")).not.toEqual([]);
    expect(scan("", canonical.replace("--type-title: 1.5rem", "--type-title: var(--tiny); --tiny: 0.6875rem" )).join(" "))
      .toContain("smaller than 12px");
    expect(scan("", canonical.replace("font-size: var(--type-title)", "font-size: 23px")).join(" "))
      .toContain("must use tokens");
    expect(scan("", canonical.replace("1.5rem", "clamp(1rem, 0.5rem + 1vw, 2rem)"))).toEqual([]);
    expect(scan(':root { --sans: "Comic Sans MS"; }').join(" ")).toContain("Font alias must start");
  });
});
