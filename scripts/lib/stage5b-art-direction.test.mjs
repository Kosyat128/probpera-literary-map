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

function declarationValue(rules, selector, property, context = null) {
  const rule = rules
    .filter(
      (candidate) =>
        candidate.selector === selector &&
        (context
          ? candidate.contexts.includes(context)
          : candidate.contexts.length === 0)
    )
    .at(-1);
  const declaration = rule?.declarations.find(
    (candidate) => candidate.property === property
  );
  return declaration?.value;
}

describe("Stage 5B homepage art-direction contract", () => {
  it("pins the approved desktop and mobile type scales", () => {
    expect(declarationValue(artRules, ":root", "--home-title-major")).toBe(
      "clamp(34px, 3.1vw, 44px)"
    );
    expect(declarationValue(artRules, ":root", "--home-title-normal")).toBe(
      "clamp(30px, 2.7vw, 38px)"
    );
    expect(declarationValue(artRules, ":root", "--home-title-card")).toBe(
      "clamp(23px, 2vw, 32px)"
    );
    expect(declarationValue(artRules, ":root", "--home-copy")).toBe(
      "clamp(16px, 1.15vw, 18px)"
    );
    expect(
      declarationValue(
        artRules,
        ":root",
        "--home-title-major",
        "@media (max-width: 680px)"
      )
    ).toBe("clamp(27px, 8vw, 34px)");
    expect(
      declarationValue(
        artRules,
        ":root",
        "--home-copy",
        "@media (max-width: 680px)"
      )
    ).toBe("clamp(15px, 4.2vw, 17px)");
  });

  it("assigns scoped roles without global element or owner-lock selectors", () => {
    expect(declarationValue(artRules, ".section-heading h2", "font-size")).toBe(
      "var(--home-title-major)"
    );
    expect(
      declarationValue(artRules, ".is-featured .article-copy h3", "font-size")
    ).toBe("var(--home-title-normal)");
    expect(declarationValue(artRules, ".article-copy h3", "font-size")).toBe(
      "var(--home-title-card)"
    );
    expect(declarationValue(artRules, ".article-copy p", "font-size")).toBe(
      "var(--home-copy)"
    );
    expect(declarationValue(artRules, ".section-link", "font-size")).toBe(
      "var(--home-action-size)"
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

  it("uses canonical action orange and changes Follow Writer colors only", () => {
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
        ".book-of-day .book-action-primary:hover",
        "background"
      )
    ).toBe("var(--ui-primary-hover)");
    expect(
      declarationValue(
        artRules,
        ".book-of-day .book-action-primary:hover",
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
