import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("./stage5f-responsive-accessibility.css", import.meta.url),
  "utf8"
);
const entrypoint = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");

describe("Stage 5F responsive accessibility stylesheet", () => {
  it("loads after the locked home and shelf styles", () => {
    const shelfImport = entrypoint.indexOf(
      "./styles/stage5-book-shelf.css"
    );
    const stage5fImport = entrypoint.indexOf(
      "./styles/stage5f-responsive-accessibility.css"
    );

    expect(shelfImport).toBeGreaterThan(-1);
    expect(stage5fImport).toBeGreaterThan(shelfImport);
  });

  it("limits 44px coarse-pointer targets to established control families", () => {
    expect(css).toContain("@media (any-pointer: coarse)");
    expect(css).toContain("min-inline-size: 44px");
    expect(css).toContain("min-block-size: 44px");
    expect(css).toContain("button.ui-action");
    expect(css).toContain("a.ui-action");
    expect(css).toContain("button.ui-icon-button");
    expect(css).toContain(".footer-map a");
    expect(css).toMatch(
      /\.footer-map a\s*\{[^}]*display: inline-flex;[^}]*min-inline-size: 44px;[^}]*min-block-size: 44px;/s
    );
    expect(css).toContain(
      ".article-reader-bar .display-mode-control.is-compact button"
    );
    expect(css).toContain(
      ".article-reader-bar .interface-language-control button"
    );
    expect(css).not.toMatch(/(?:^|,)\s*a\s*(?:,|\{)/m);
    expect(css).not.toMatch(/\bsvg\b/);
  });

  it("replaces the fixed mobile author height with a bounded portrait ratio", () => {
    expect(css).toContain("inline-size: min(100%, 336px, 64svh)");
    expect(css).toContain("max-block-size: min(80svh, 420px)");
    expect(css).toContain("aspect-ratio: 4 / 5");
    expect(css).not.toContain("470px");
  });

  it("paint-contains only deep static landmarks without hiding semantic DOM", () => {
    expect(css).toContain("@supports (content-visibility: auto)");
    expect(css).toContain("#sections.sections-directory");
    expect(css).toContain("#editorial-policy.trust-center");
    expect(css).toContain(".site-footer");
    expect(css).toContain("content-visibility: auto");
    expect(css).toContain("contain-intrinsic-size: auto 760px");
    expect(css).not.toContain("content-visibility: hidden");
    expect(css).not.toContain("display: none");
  });

  it("covers tablet, 200%-zoom and phone reflow without global clipping", () => {
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("@media (max-width: 430px)");
    expect(css).toContain("320 / 360 / 390 / 430px");
    expect(css).not.toMatch(/\b(?:html|body)\b[^{}]*\{[^{}]*overflow/);
    expect(css).not.toContain("overflow-x: hidden");
    expect(css).not.toContain("overflow: clip");
  });

  it("does not target locked Header, Hero, Globe or Book Shelf surfaces", () => {
    expect(css).not.toMatch(
      /\.(?:site-header|hero|literary-globe|book-shelf|bookshelf|book-archive)/
    );
  });
});
