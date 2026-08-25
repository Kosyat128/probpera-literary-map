import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCss } from "../audit-stage5-baseline.mjs";

const root = path.resolve(process.cwd());
const layoutCss = readFileSync(
  path.join(root, "src/styles/stage5-home-layout.css"),
  "utf8"
);
const mainSource = readFileSync(path.join(root, "src/main.tsx"), "utf8");
const rules = parseCss(layoutCss, "src/styles/stage5-home-layout.css");

function value(selector, property, context = null) {
  const declarations = rules
    .filter(
      (candidate) =>
        candidate.selector === selector &&
        (context
          ? candidate.contexts.includes(context)
          : candidate.contexts.length === 0)
    )
    .flatMap((candidate) => candidate.declarations)
    .filter(
      (declaration) => declaration.property === property
    );
  return declarations.at(-1)?.value;
}

describe("Stage 5C homepage layout and community contract", () => {
  it("loads after the closed Stage 5B art-direction layer", () => {
    const stage5b = mainSource.indexOf(
      "./styles/stage5-home-art-direction.css"
    );
    const stage5c = mainSource.indexOf("./styles/stage5-home-layout.css");
    expect(stage5b).toBeGreaterThanOrEqual(0);
    expect(stage5c).toBeGreaterThan(stage5b);
  });

  it("stays scoped and leaves paint and owner locks unchanged", () => {
    const allowed = ["#book-day", "#authors", "#sections", "#community"];
    const forbidden = [
      ".site-header",
      ".brand",
      ".magazine-hero",
      ".hero-editorial",
      ".atlas-",
      ".globe-",
      ".book-archive",
      ".article-reader",
      ":nth-child",
      ":nth-of-type",
      "[data-",
      "[style",
    ];
    const paint = new Set([
      "background",
      "background-color",
      "background-image",
      "border-color",
      "color",
      "fill",
      "stroke",
    ]);

    expect(layoutCss).not.toContain("!important");
    for (const rule of rules) {
      expect(
        allowed.some((prefix) => rule.selector.startsWith(prefix)),
        rule.selector
      ).toBe(true);
      expect(["article", "button", "div", "footer", "h2", "h3", "p"]).not.toContain(
        rule.selector
      );
      for (const fragment of forbidden) {
        expect(rule.selector, fragment).not.toContain(fragment);
      }
    }
    expect(
      rules
        .flatMap((rule) => rule.declarations)
        .filter((declaration) => paint.has(declaration.property))
    ).toEqual([]);
  });

  it("defines the Book Month desktop split and compact responsive flow", () => {
    expect(value("#book-day.daily-grid", "grid-template-columns")).toBe(
      "minmax(0, 1.22fr) minmax(340px, 0.78fr)"
    );
    expect(value("#book-day > .book-of-day", "grid-row")).toBe("auto");
    expect(
      value("#book-day > .book-month-supporting", "grid-template-rows")
    ).toBe("minmax(0, 1fr) auto");
    expect(
      value(
        "#book-day > .book-month-supporting",
        "grid-template-columns",
        "@media (max-width: 1180px)"
      )
    ).toBe("minmax(0, 1.12fr) minmax(250px, 0.88fr)");
    expect(
      value(
        "#book-day > .book-month-supporting",
        "grid-template-columns",
        "@media (max-width: 680px)"
      )
    ).toBe("minmax(0, 1fr)");
    for (const selector of [
      "#book-day > .book-of-day",
      "#book-day .editorial-standard",
      "#book-day .book-fact-card",
    ]) {
      expect(
        value(selector, "min-height", "@media (max-width: 680px)")
      ).toBe("0");
    }
  });

  it("defines shared four, two, and one-column card grids", () => {
    for (const selector of [
      "#authors .author-showcase",
      "#sections > .sections-directory-grid",
    ]) {
      expect(value(selector, "grid-template-columns")).toBe(
        "repeat(4, minmax(0, 1fr))"
      );
      expect(
        value(
          selector,
          "grid-template-columns",
          "@media (max-width: 1180px)"
        )
      ).toBe("repeat(2, minmax(0, 1fr))");
      expect(
        value(selector, "grid-template-columns", "@media (max-width: 680px)")
      ).toBe("minmax(0, 1fr)");
    }
    expect(value("#authors .author-showcase button", "max-height")).toBe(
      "420px"
    );
    expect(
      value(
        "#authors .author-showcase button",
        "max-height",
        "@media (max-width: 680px)"
      )
    ).toBe("400px");
  });

  it("uses one six-row subgrid and preserves empty desktop landmarks", () => {
    expect(value("#sections .section-directory-card", "grid-row")).toBe(
      "span 6"
    );
    expect(
      value("#sections .section-directory-card", "grid-template-rows")
    ).toBe("subgrid");
    expect(
      value("#sections .section-directory-card > div", "grid-template-rows")
    ).toBe("subgrid");
    expect(
      value("#sections .section-directory-card h3", "align-self")
    ).toBe("start");
    expect(value("#sections .section-card-action", "display")).toBe("flex");
    expect(
      value(
        "#sections .section-card-series-slot",
        "min-height",
        "@media (min-width: 681px)"
      )
    ).toBe("72px");
    expect(
      value(
        "#sections .section-card-latest-slot",
        "min-height",
        "@media (min-width: 681px)"
      )
    ).toBe("64px");
    for (const selector of [
      "#sections .section-card-series-slot:empty",
      "#sections .section-card-latest-slot:empty",
    ]) {
      expect(
        value(selector, "display", "@media (max-width: 680px)")
      ).toBe("none");
    }
  });

  it("keeps Community equal-row, supporting, grouped, and responsive", () => {
    expect(
      value("#community.community-section", "grid-template-columns")
    ).toBe("minmax(0, 1.06fr) minmax(380px, 0.94fr)");
    expect(
      value(
        "#community.community-section",
        "grid-template-columns",
        "@media (max-width: 1180px)"
      )
    ).toBe("minmax(0, 1fr)");
    expect(
      value("#community .community-reading-notes", "grid-template-rows")
    ).toBe("auto repeat(3, minmax(68px, 1fr))");
    expect(
      value("#community .community-reading-notes button", "padding")
    ).toBe("12px 14px 12px 17px");
    expect(
      value("#community .community-reading-notes strong", "white-space")
    ).toBe("normal");
    expect(
      value("#community .community-visual-stats strong", "font-size")
    ).toBe("clamp(19px, 1.4vw, 24px)");
    expect(value("#community .community-actions", "display")).toBe("flex");
    expect(
      value(
        "#community .community-actions",
        "grid-template-columns",
        "@media (max-width: 680px)"
      )
    ).toBe("minmax(0, 1fr)");
  });
});
