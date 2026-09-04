import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCss } from "../audit-stage5-baseline.mjs";

const root = path.resolve(process.cwd());
const artDirectionPath = path.join(
  root,
  "src/styles/stage5-home-art-direction.css"
);
const artDirectionCss = readFileSync(artDirectionPath, "utf8");
const indexCss = readFileSync(path.join(root, "src/index.css"), "utf8");
const mainSource = readFileSync(path.join(root, "src/main.tsx"), "utf8");
const artRules = parseCss(artDirectionCss, "src/styles/stage5-home-art-direction.css");
const indexRules = parseCss(indexCss, "src/index.css");
const typographyRules = parseCss(
  readFileSync(path.join(root, "src/styles/site-typography.css"), "utf8").replace(/\/\*[\s\S]*?\*\//gu, ""),
  "src/styles/site-typography.css"
);

function declarationValue(rules, selector, property, context = null) {
  const declarations = rules
    .filter(
      (candidate) =>
        candidate.selector === selector &&
        (context
          ? candidate.contexts.includes(context)
          : candidate.contexts.every((entry) => entry.startsWith("@layer ")))
    )
    .flatMap((candidate) => candidate.declarations)
    .filter((candidate) => candidate.property === property);
  return declarations.at(-1)?.value;
}

describe("Stage 5B homepage art-direction contract", () => {
  it("pins the shared scale and keeps legacy homepage names as aliases", () => {
    expect(declarationValue(typographyRules, ":root", "--home-title-major")).toBe(
      "var(--type-section-title)"
    );
    expect(declarationValue(typographyRules, ":root", "--home-title-normal")).toBe(
      "var(--type-card-feature-title)"
    );
    expect(declarationValue(typographyRules, ":root", "--home-title-card")).toBe(
      "var(--type-card-title)"
    );
    expect(declarationValue(typographyRules, ":root", "--home-copy")).toBe(
      "var(--type-card-excerpt)"
    );
    expect(
      declarationValue(
        typographyRules,
        ":root",
        "--type-section-title"
      )
    ).toBe("clamp(1.75rem, 3.2vw, 3.25rem)");
    expect(
      declarationValue(
        typographyRules,
        ".article-reader-content",
        "--type-reading",
        "@media (max-width: 560px)"
      )
    ).toBe("1.0625rem");
    expect(declarationValue(typographyRules, ":root", "--type-card-excerpt")).toBe("1rem");
    expect(artRules.flatMap((rule) => rule.declarations).some((declaration) =>
      /^--home-(?:title|copy|metadata|action-size)/u.test(declaration.property)
    )).toBe(false);
  });

  it("assigns scoped roles without global element or owner-lock selectors", () => {
    expect(declarationValue(typographyRules, ".section-heading h2", "font-size")).toBe(
      "var(--type-section-title)"
    );
    expect(
      declarationValue(typographyRules, ".is-featured .article-copy h3", "font-size")
    ).toBe("var(--type-card-feature-title)");
    expect(declarationValue(typographyRules, ".article-copy h3", "font-size")).toBe(
      "var(--type-card-title)"
    );
    expect(declarationValue(typographyRules, ".article-copy p", "font-size")).toBe(
      "var(--type-card-excerpt)"
    );
    expect(declarationValue(typographyRules, ".section-link", "font-size")).toBe(
      "var(--type-card-secondary-action)"
    );

    const forbiddenFragments = [
      ".site-header",
      ".brand",
      ".magazine-hero",
      ".hero-editorial",
      ".atlas-",
      ".globe-",
      ".book-archive",
      ".article-reader",
      ".primary-action",
    ];
    for (const rule of artRules) {
      expect(["h2", "h3", "p", "button"]).not.toContain(rule.selector);
      if (rule.selector === ".hero-editorial .section-kicker") {
        expect(rule.declarations.every((declaration) =>
          ["align-self", "padding", "color", "background", "border-radius"].includes(declaration.property)
        )).toBe(true);
        continue;
      }
      for (const fragment of forbiddenFragments) {
        expect(rule.selector).not.toContain(fragment);
      }
    }
    expect(artRules.flatMap((rule) => rule.declarations)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "overflow", value: "hidden" }),
      ])
    );
  });

  it("keeps fallback surfaces behind the CMS background contract", () => {
    const fallbackBackgroundRules = artRules.filter((rule) =>
      rule.declarations.some((declaration) => declaration.property === "background")
    );
    const surfaceSelectors = fallbackBackgroundRules
      .map((rule) => rule.selector)
      .filter((selector) => !selector.includes("book-action") && !selector.includes("archive-subscribe"));
    expect(surfaceSelectors).toContain(".article-library");
    expect(
      surfaceSelectors
        .filter((selector) => selector !== ".article-library")
        .every((selector) => selector.includes(":not(.cms-core-editable)"))
    ).toBe(true);
    expect(artDirectionCss).not.toContain("!important");
    expect(
      declarationValue(
        indexRules,
        ".cms-core-editable.has-cms-background",
        "background-image"
      )
    ).toMatch(/!important$/u);
  });

  it("uses scoped action orange with white book text and changes Follow Writer colors only", () => {
    expect(
      declarationValue(artRules, ".book-of-day .book-action-primary", "background")
    ).toBe("var(--ui-primary)");
    expect(
      declarationValue(artRules, ".book-of-day .book-action-primary", "color")
    ).toBe("#fff");
    expect(
      declarationValue(
        artRules,
        ".book-of-day .book-action-primary span",
        "color"
      )
    ).toBe("inherit");
    expect(
      declarationValue(
        artRules,
        ".book-of-day .book-action-primary:not(:disabled):hover",
        "background"
      )
    ).toBe("var(--ui-primary-hover)");
    expect(
      declarationValue(
        artRules,
        ".book-of-day .book-action-primary:not(:disabled):hover",
        "color"
      )
    ).toBe("#fff");

    const followWriterRules = artRules.filter((rule) =>
      rule.selector.startsWith(".archive-subscribe.is-writer")
    );
    expect(followWriterRules).toHaveLength(3);
    expect(
      followWriterRules
        .flatMap((rule) => rule.declarations)
        .every((declaration) => declaration.property === "background")
    ).toBe(true);
  });

  it("loads the scoped stylesheet after the established public styles", () => {
    const establishedIndex = mainSource.indexOf("./index.css");
    const accessibilityIndex = mainSource.indexOf(
      "./community/community-accessibility.css"
    );
    const stage5bIndex = mainSource.indexOf(
      "./styles/stage5-home-art-direction.css"
    );
    expect(establishedIndex).toBeGreaterThanOrEqual(0);
    expect(stage5bIndex).toBeGreaterThan(accessibilityIndex);
    expect(accessibilityIndex).toBeGreaterThan(establishedIndex);
  });
});
