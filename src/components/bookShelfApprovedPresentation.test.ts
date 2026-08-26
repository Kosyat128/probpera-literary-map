import { existsSync, readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

const frame = readFileSync(new URL("./BookShelfFrame.tsx", import.meta.url), "utf8");
const controller = readFileSync(
  new URL("./BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const scene = readFileSync(new URL("./BookShelfScene.tsx", import.meta.url), "utf8");
const loader = readFileSync(
  new URL("./BookShelfBrandLoader.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../styles/stage5-book-shelf.css", import.meta.url),
  "utf8"
);

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^$()|[\]{}]/gu, "\\$&");
  const match = css.match(
    new RegExp(escaped + "\\s*\\{([\\s\\S]*?)\\}", "u")
  );
  if (!match) throw new Error("Missing CSS rule: " + selector);
  return match[1];
}

describe("approved Complete Shelf outer presentation", () => {
  it("keeps the warm library below every interactive layer", () => {
    expect(cssRule(".book-shelf-frame")).toContain("width: 100%");
    expect(cssRule(".book-shelf-frame")).toContain("max-width: none");
    expect(cssRule(".book-shelf-controls__brand")).toContain("order: 1");
    expect(cssRule(".book-shelf-controls__search")).toContain("order: 2");
    expect(cssRule(".book-shelf-controls__views")).toContain("order: 3");
    expect(cssRule(".book-shelf-controls__scope")).toContain("order: 4");
    expect(cssRule(".book-shelf-frame__library-backdrop")).toContain(
      "z-index: 0"
    );
    expect(css).toMatch(
      /\.book-shelf-frame__atmosphere\s*\{[^}]*z-index:\s*1/iu
    );
    expect(css).toMatch(
      /\.book-shelf-frame__scene::after\s*\{[^}]*z-index:\s*1/iu
    );
    expect(css).toMatch(/\.book-shelf-scene\s*\{[^}]*z-index:\s*2/iu);
    expect(css).toMatch(
      /\.book-shelf-frame__detail\s*\{[^}]*z-index:\s*3/iu
    );
    expect(css).toMatch(
      /\.book-shelf-frame__navigation\s*\{[^}]*z-index:\s*4/iu
    );
    expect(css).toMatch(
      /\.book-shelf-scene__accessible-actions\s*\{[^}]*z-index:\s*5/iu
    );

    expect(css).toContain("--cms-core-background");
    expect(cssRule(".book-shelf-frame__cms-background")).toContain(
      "background: transparent"
    );
    expect(cssRule(".book-shelf-frame__cms-background")).not.toContain(
      "background-image"
    );
    expect(css).toContain("/brand/library-archive-background-v1.avif");
    expect(css).toContain("/brand/library-archive-background-v1.webp");
    expect(css).toContain("/brand/library-archive-background-mobile-v1.avif");
    expect(css).toContain("/brand/library-archive-background-mobile-v1.webp");
    expect(cssRule(".book-shelf-frame__detail")).toContain(
      "rgba(16, 16, 29, 0.94)"
    );
    expect(cssRule(".book-shelf-frame__detail")).not.toContain(
      "rgba(255, 247, 236"
    );
    expect(css).toMatch(
      /\.book-shelf-frame\.is-shelf[\s\S]*?\.book-detail-cover\s*\{[\s\S]*?display:\s*none/iu
    );
  });

  it("uses optimized desktop and mobile library assets", () => {
    const assets = [
      ["library-archive-background-v1.avif", 240 * 1024],
      ["library-archive-background-v1.webp", 270 * 1024],
      ["library-archive-background-mobile-v1.avif", 150 * 1024],
      ["library-archive-background-mobile-v1.webp", 170 * 1024],
    ] as const;

    for (const [fileName, byteLimit] of assets) {
      const url = new URL("../../public/brand/" + fileName, import.meta.url);
      expect(existsSync(url), fileName).toBe(true);
      expect(statSync(url).size, fileName).toBeLessThanOrEqual(byteLimit);
    }
  });

  it("shows only the existing orange quill while the scene loads", () => {
    expect(loader).toContain("<BrandQuillIcon />");
    expect(loader).not.toContain("brand/probpera-logo.png");
    expect(loader).toContain('role="status"');
    expect(loader).toContain("{label}");
    expect(loader).not.toMatch(/<svg\b|BrandBookIcon/u);
    expect(loader).not.toMatch(/[А-Яа-яЁё]/u);
    expect(scene).toContain(
      "fallback={<BookShelfBrandLoader label={props.loadingLabel} />}"
    );
    expect(scene).toMatch(
      /support === "ready"[\s\S]*?<BookShelfBrandLoader label=\{props\.loadingLabel\}/u
    );
  });

  it("passes the controller-owned transition state through without local phase state", () => {
    expect(scene).toContain("year?: number");
    expect(scene).toContain("phase: BookShelfPhase");
    expect(scene).toContain("requestId: number");
    expect(scene).toContain("data-book-shelf-phase={props.phase}");
    expect(scene).not.toMatch(/useState\s*<\s*BookShelfPhase|setPhase/u);

    const passThroughProps = [
      "phase",
      "requestId",
      "onRequestCoverOpen",
      "onRequestInspectionClose",
      "onCrackCover",
      "onStartPageDrag",
      "onRequestPageSettle",
      "onMotionReached",
      "onMotionSettled",
      "onInspectionEntered",
      "onCoverOpened",
      "onPageSettled",
      "onInspectionClosed",
      "onShelfRestored",
    ];

    for (const name of passThroughProps) {
      expect(scene).toContain(name + "={props." + name + "}");
    }

    expect(scene).toContain("openBookLabel?: string");
    expect(scene).toContain("closeInspectionLabel?: string");
    expect(scene).toContain("onRequestPageTurn: () => void");
    expect(scene).toContain("pageTurnLabel?: string");
    expect(scene).toContain('props.phase === "BOOK_OPEN"');
    expect(controller).toContain('event.key !== "Escape"');
    expect(controller).toContain("advancedFiltersOpen");
    expect(controller).toContain("pendingBookCloseRef.current");
    expect(controller).toContain("onRequestPageTurn={requestSelectedPageTurn}");
    expect(controller).toContain("economical={economicalRendering}");
    expect(controller).not.toContain("economical={reducedMotion");
    expect(scene).toContain("tabIndex={-1}");
    expect(controller).toContain('if (viewMode === "shelf") return;');
    expect(controller).toContain(
      "finalizeBookDetailClose(pendingClose.returnFocus)"
    );
    expect(controller).toContain('className="book-detail-page-turn"');
    expect(scene).toContain('type="button"');
  });

  it("retains responsive, focus, reduced-motion and forced-color fallbacks", () => {
    expect(css).toContain("@media (max-width: 1100px)");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("animation: none !important");
    expect(css).toContain(".book-shelf-frame button:focus-visible");
    expect(css).toContain(".book-shelf-scene:focus-visible");
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.book-shelf-frame__workspace\s*\{[\s\S]*?display:\s*flex[\s\S]*?\.book-shelf-frame__primary\s*\{[\s\S]*?order:\s*1[\s\S]*?\.book-shelf-frame__detail\s*\{[\s\S]*?position:\s*relative[\s\S]*?order:\s*2/iu
    );
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?\.book-shelf-frame__library-backdrop[\s\S]*?display:\s*none/iu
    );
  });

  it("does not add a playback surface to the owned outer UI", () => {
    const forbidden =
      /AudioContext|webkitAudioContext|new\s+Audio\s*\(|<audio\b|\.(?:mp3|wav)(?:[?"'\s]|$)|\b(?:mute|volume|autoplay|foley|music)\b/iu;
    for (const source of [frame, scene, loader, css]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});
