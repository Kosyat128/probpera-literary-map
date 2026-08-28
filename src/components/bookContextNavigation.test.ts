import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const archive = readFileSync(
  new URL("./BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const reader = readFileSync(
  new URL("./ArticleReader.tsx", import.meta.url),
  "utf8"
);

describe("Stage 5E book context navigation", () => {
  it("keeps Book to Article and Author on the existing history graphs", () => {
    expect(archive).toContain("persistNavigationContext(focusOrigin)");
    expect(archive).toContain("navigateToArticle(article)");
    expect(archive).toContain("navigateToArticle(action.article)");
    expect(archive).not.toContain("window.location.assign(");
    expect(archive).toContain('data-book-navigation-origin="book-author"');
    expect(archive).toContain("bookArchiveArticleFocusOrigin(article.id)");
    expect(archive).toContain("commitAtlasUrlState(");
    expect(archive).toContain("countryId: null");
    expect(archive).toContain("writerId: null");
  });

  it("restores selection, inspection state, scroll, and exact origin focus", () => {
    expect(archive).toContain("historyContext.inspectionOpen");
    expect(archive).toContain("historyContext.focusOrigin");
    expect(archive).toContain("onInspectionEntered={handleInspectionEntered}");
    expect(archive).toContain('type: "request-cover-open"');
    expect(archive).toContain("window.scrollTo(context.scroll.x, context.scroll.y)");
    expect(archive).toContain("element.dataset.bookNavigationOrigin");
    expect(archive).toContain("target.focus({ preventScroll: true })");
    expect(archive).toContain(
      "restoredNavigationContextRef.current?.selectedBookKey === nextBookKey"
    );
  });

  it("returns mentioned books through the same book history entry", () => {
    expect(reader).toContain("readBookArchiveNavigationContext");
    expect(reader).toContain("serializeBookArchiveLocation");
    expect(reader).toContain("BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY");
    expect(reader).toContain("BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY");
    expect(reader).toContain('window.dispatchEvent(new Event("probpera:navigation"))');
    expect(reader).toContain("data-article-book-origin={book.key}");
    expect(reader).toContain("element.dataset.articleBookOrigin");
    expect(reader).toContain(
      "(target || closeButtonRef.current)?.focus({ preventScroll: true })"
    );
  });

  it("performs one local initial or resume scroll after article content loads", () => {
    expect(reader).not.toContain("scrollRef.current?.scrollTo({ top: 0 });");
    expect(reader).toContain('`${resumable ? "resume" : "top"}:${article.id}`');
    expect(reader).toContain("progressToRestore / 100");
  });
});
