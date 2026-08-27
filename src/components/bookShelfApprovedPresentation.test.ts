import { existsSync, readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

const frame = readFileSync(new URL("./BookShelfFrame.tsx", import.meta.url), "utf8");
const controller = readFileSync(
  new URL("./BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const controls = readFileSync(
  new URL("./BookShelfControls.tsx", import.meta.url),
  "utf8"
);
const scene = readFileSync(new URL("./BookShelfScene.tsx", import.meta.url), "utf8");
const qualityController = readFileSync(
  new URL("../books/bookShelfQualityController.ts", import.meta.url),
  "utf8"
);
const mobileDetailController = readFileSync(
  new URL("../books/bookShelfMobileDetail.ts", import.meta.url),
  "utf8"
);
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
    expect(cssRule(".book-shelf-controls__search")).toContain("order: 2");
    expect(cssRule(".book-shelf-controls__scope")).toContain("order: 3");
    expect(cssRule(".book-shelf-controls__views")).toContain("order: 4");
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
      /\.book-shelf-frame\.is-shelf\s+\.book-shelf-frame__detail\s+\.book-detail-cover\s*\{[^}]*display:\s*grid/iu
    );
    expect(css).not.toMatch(
      /\.book-shelf-frame\.is-shelf\s+\.book-shelf-frame__detail\s+\.book-detail-cover\s*\{[^}]*display:\s*none/iu
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

  it("defers the bookshelf WebGL context until the archive approaches the viewport", () => {
    expect(controller).toContain("archiveSectionRef");
    expect(controller).toContain('rootMargin: "720px 0px"');
    expect(controller).toContain("sceneNearViewport");
    expect(controller).toContain(
      "sceneNearViewport || Boolean(selectedBook || requestedBook)"
    );
    expect(scene).toContain('props.active && support === "ready"');
  });

  it("keeps only the compact quill mark in the archive header and gives spine selection a quiet interactive hint", () => {
    expect(controls).toContain("BrandQuillIcon");
    expect(controls).toContain('className="book-shelf-controls__mark"');
    expect(controls).not.toContain("book-shelf-controls__brand");
    expect(controls).not.toContain("brandName");
    expect(css).not.toContain(".book-shelf-controls__brand");
    expect(cssRule(".book-shelf-controls__mark")).toContain("width: 40px");
    expect(cssRule(".book-shelf-controls__topline")).toContain(
      "minmax(180px, 240px)"
    );
    expect(cssRule(".book-shelf-controls__topline")).toContain(
      "max-content"
    );
    expect(
      cssRule(
        ".book-shelf-controls.book-archive-toolbar .book-shelf-controls__input input"
      )
    ).toContain("min-width: 0");
    expect(cssRule(".book-shelf-controls .book-filter-copy")).toContain(
      "text-align: center"
    );
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.book-shelf-controls__search\s*\{[\s\S]*?grid-column:\s*2/iu
    );
    expect(css).toMatch(
      /@media \(min-width: 1101px\) and \(max-width: 1560px\)[\s\S]*?\.book-shelf-controls__scope\s*\{[^}]*grid-column:\s*3[^}]*grid-row:\s*1[\s\S]*?\.book-shelf-controls__views\s*\{[^}]*grid-column:\s*4[^}]*grid-row:\s*1[\s\S]*?\.book-shelf-controls \.book-filter-panel\s*\{[^}]*grid-column:\s*5[^}]*grid-row:\s*1/iu
    );
    expect(controller).toContain('className="book-shelf-scene-hint"');
    expect(controller).toContain('t("Выберите книгу")');
    expect(controller).toContain("Нажмите на корешок — книга выйдет вперёд");
    expect(cssRule(".book-shelf-scene-hint")).toContain("z-index: 4");
  });

  it("keeps edition artwork compact beside the book description", () => {
    const coverRule = cssRule(
      ".book-shelf-frame__detail .book-detail-cover"
    );
    expect(coverRule).toContain("float: left");
    expect(coverRule).toContain("width: 96px");
    expect(coverRule).toContain("min-height: 136px");
    expect(controller).toContain(
      'sizes="(max-width: 680px) 82px, 96px"'
    );
  });

  it("discovers across the full archive while quality settings bound the live shelf", () => {
    expect(controller).toContain("candidates: queue.all");
    expect(controller).toContain("rememberRandomBookArchiveItem");
    expect(controller).toContain('t("Случайное произведение")');
    expect(controls).toContain('className="book-shelf-controls__random"');
    expect(controls).not.toMatch(
      /book-shelf-controls__random[\s\S]{0,300}aria-pressed/iu
    );
    expect(controller).toContain(
      "bookShelfQualityControllerSettings(qualityController)"
    );
    expect(controller).toContain("qualitySettings={qualitySettings}");
    expect(controller).toMatch(
      /qualityDispatch\(\{\s*type:\s*"degrade"\s*\}\)/u
    );
    expect(controller).toMatch(
      /qualityDispatch\(\{\s*type:\s*"recover"\s*\}\)/u
    );
    expect(controller).toContain(
      "onContextRestored={handleShelfContextRestored}"
    );
    expect(scene).toContain("qualitySettings?: BookShelfQualitySettings");
    expect(scene).toContain("qualitySettings={qualitySettings}");
    expect(qualityController).toContain("liveBookLimit");
    expect(qualityController).toContain('profile === "HIGH"');
    expect(controller).toContain('t("Предыдущие 13 произведений")');
    expect(controller).toContain('t("Следующие 13 произведений")');
  });

  it("opens the focused shelf book with Enter or Space", () => {
    expect(controller).toContain(
      'aria-keyshortcuts="ArrowLeft ArrowRight Home End PageUp PageDown Enter Space"'
    );
    expect(controller).toContain(
      'event.key === "Enter" || event.key === " "'
    );
    expect(controller).toContain(
      "focusedBookKeyRef.current || filteredItems[0]?.key || null"
    );
    expect(controller).toContain("handleSceneOpenBook(focusedKey)");
  });

  it("integrates the deterministic mobile detail sheet without stealing horizontal shelf gestures", () => {
    expect(mobileDetailController).toContain(
      "bookShelfMobileDetailReducer"
    );
    expect(mobileDetailController).toContain(
      'axis !== "vertical"'
    );
    expect(controller).toContain(
      "createInitialBookShelfMobileDetailState(\"collapsed\", reduced)"
    );
    expect(controller).toContain("if (!qualitySettings.mobile) return;");
    expect(controller).toContain(
      'position: selectedBook ? "half" : "collapsed"'
    );
    expect(controller).toContain(
      "getBookShelfMobileDetailMotion(reducedMotion)"
    );
    expect(controller).toContain(
      "data-mobile-position={mobileDetailDisplayPosition}"
    );
    expect(controller).toContain(
      "data-mobile-phase={mobileDetailState.phase}"
    );
    expect(controller).toContain(
      "onPointerDown={handleMobileDetailPointerDown}"
    );
    expect(controller).toContain(
      "onPointerMove={handleMobileDetailPointerMove}"
    );
    expect(controller).toContain(
      "onPointerUp={handleMobileDetailPointerUp}"
    );
    expect(controller).toContain(
      'aria-expanded={mobileDetailDisplayPosition !== "collapsed"}'
    );
    expect(controller).toContain(
      "if (horizontalDirection)"
    );
    expect(controller).toContain("handleSceneOpenBook(nextKey)");
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
    expect(controller).toContain("qualitySettings={qualitySettings}");
    expect(controller).not.toContain("economical={economicalRendering}");
    expect(controller).not.toContain("economical={reducedMotion");
    expect(scene).toContain("tabIndex={-1}");
    expect(controller).toContain('if (viewMode === "shelf") return;');
    expect(controller).toContain(
      "finalizeBookDetailClose(pendingClose.returnFocus)"
    );
    expect(controller).toMatch(
      /className="book-detail-page-turn is-(?:previous|next)"/u
    );
    expect(scene).toContain('type="button"');
  });

  it("retains responsive, focus, reduced-motion and forced-color fallbacks", () => {
    const mobileStart = css.indexOf("@media (max-width: 767px)");
    const mobileEnd = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      mobileStart
    );
    const mobileCss = css.slice(mobileStart, mobileEnd);

    expect(css).toContain("@media (max-width: 1100px)");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("animation: none !important");
    expect(css).toContain(".book-shelf-frame button:focus-visible");
    expect(css).toContain(".book-shelf-scene:focus-visible");
    expect(mobileCss).toMatch(
      /\.book-shelf-frame__workspace\s*\{[^}]*position:\s*relative[^}]*display:\s*flex[^}]*overflow:\s*hidden/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-frame__primary\s*\{[^}]*order:\s*1/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-frame__detail\s*\{[^}]*position:\s*absolute[^}]*inset:\s*auto 0 0/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-frame__detail\[data-mobile-position="collapsed"\]\s*\{[^}]*height:\s*104px/iu
    );
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?\.book-shelf-frame__library-backdrop[\s\S]*?display:\s*none/iu
    );
  });

  it("centres mobile control copy without clipping or horizontal overflow", () => {
    const mobileCss = css.slice(css.lastIndexOf("@media (max-width: 767px)"));

    expect(mobileCss).toMatch(
      /\.book-shelf-controls\.book-archive-toolbar\s+\.book-shelf-controls__input\s*\{[^}]*height:\s*44px[^}]*border-color:\s*rgba\(246,\s*117,\s*24,\s*0\.82\)/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-controls\.book-archive-toolbar\s+\.book-shelf-controls__input input\s*\{[^}]*height:\s*42px[^}]*line-height:\s*42px/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-controls \.book-archive-filters\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*overflow:\s*hidden/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-controls \.book-archive-filters > button\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*min-width:\s*0/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-navigation__position\s*\{[^}]*grid-template-columns:\s*56px minmax\(82px,\s*1fr\) 56px[^}]*align-items:\s*center/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-navigation__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/iu
    );
    expect(mobileCss).toMatch(
      /\.book-shelf-navigation__actions > button\s*\{[^}]*height:\s*50px[^}]*min-height:\s*50px/iu
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
