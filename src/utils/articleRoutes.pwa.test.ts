import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.hoisted(() => vi.stubEnv("BASE_URL", "/planet/"));
vi.mock("../platform/distribution", () => ({
  isControlledWebEdition: true,
  canonicalJournalOrigin: "https://probpera.ru",
}));

import BootstrapErrorBoundary from "../components/BootstrapErrorBoundary";
import {
  articleIdFromPath,
  articlePath,
  isDirectArticlePath,
  journalPath,
  journalSectionFromPath,
  navigateToArticle,
  navigateToJournal,
  resolveArticleRoute,
  shouldUseClientNavigation,
} from "./articleRoutes";

afterEach(() => vi.unstubAllGlobals());
afterAll(() => vi.unstubAllEnvs());

const article = {
  id: "article-1",
  title: "О книге",
  sectionId: "book-opinions",
  slug: "approved-book-title",
};

function browser(open = vi.fn(() => null)) {
  const target = {
    open,
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    dispatchEvent: vi.fn(),
    requestAnimationFrame: vi.fn(),
    location: { assign: vi.fn(), replace: vi.fn(), href: "/planet/" },
  };
  vi.stubGlobal("window", target);
  return target;
}

function expectNoLocalNavigation(target: ReturnType<typeof browser>) {
  expect(target.history.pushState).not.toHaveBeenCalled();
  expect(target.history.replaceState).not.toHaveBeenCalled();
  expect(target.dispatchEvent).not.toHaveBeenCalled();
  expect(target.requestAnimationFrame).not.toHaveBeenCalled();
  expect(target.location.assign).not.toHaveBeenCalled();
  expect(target.location.replace).not.toHaveBeenCalled();
  expect(target.location.href).toBe("/planet/");
}

describe("controlled PWA outbound journal routing", () => {
  it("keeps canonical article and journal URLs outside the PWA scope", () => {
    expect(import.meta.env.BASE_URL).toBe("/planet/");
    expect(articlePath(article.id, article.title, article.sectionId, article.slug))
      .toBe("https://probpera.ru/stati/mnenie-o-knige/approved-book-title/");
    expect(articlePath(article.id, article.title, article.sectionId))
      .toBe("https://probpera.ru/stati/mnenie-o-knige/o-knige/");
    expect(journalPath()).toBe("https://probpera.ru/stati/");
    expect(journalPath("book-opinions", "books & history"))
      .toBe("https://probpera.ru/stati/mnenie-o-knige/?series=books+%26+history");
  });

  it("cannot change the canonical origin through a slug, section or series", () => {
    const href = articlePath("../id", "О книге", "//elsewhere.invalid", "//elsewhere.invalid");
    expect(href).toBe("https://probpera.ru/stati/materialy/o-knige/");
    const journal = new URL(journalPath("//elsewhere.invalid", "x#https://elsewhere.invalid"));
    expect(journal.origin).toBe("https://probpera.ru");
    expect(journal.pathname).toBe("/stati/materialy/");
    expect(journal.hash).toBe("");
    expect(journal.searchParams.get("series")).toBe("x#https://elsewhere.invalid");
  });

  it.each([
    "/planet/stati/mnenie-o-knige/approved-book-title/",
    "/planet/articles/article-1/",
    "/stati/mnenie-o-knige/approved-book-title/",
  ])("does not mount a duplicate local reader for %s", (pathname) => {
    expect(isDirectArticlePath(pathname)).toBe(false);
    expect(articleIdFromPath([article], pathname)).toBeNull();
    expect(resolveArticleRoute([article], pathname)).toBeNull();
    expect(journalSectionFromPath(pathname)).toBeNull();
  });

  it("does not interpret local archive URLs as a journal route", () => {
    expect(journalSectionFromPath("/planet/stati/")).toBeNull();
    expect(journalSectionFromPath("/planet/stati/mnenie-o-knige/")).toBeNull();
  });

  it("leaves every anchor click to the browser", () => {
    const click = {
      button: 0, defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    };
    for (const variation of [{}, { ctrlKey: true }, { button: 1 }, { defaultPrevented: true }]) {
      expect(shouldUseClientNavigation({ ...click, ...variation })).toBe(false);
    }
  });

  it.each([false, true])("requests a canonical journal once, even when replace is %s", (replace) => {
    const target = browser();
    expect(navigateToJournal("book-opinions", replace, "books & history")).toBeUndefined();
    expect(target.open).toHaveBeenCalledExactlyOnceWith(
      "https://probpera.ru/stati/mnenie-o-knige/?series=books+%26+history",
      "_blank", "noopener,noreferrer"
    );
    expectNoLocalNavigation(target);
  });

  it("does not mistake an opaque/null popup result for failure and retry", () => {
    const target = browser();
    expect(navigateToArticle(article)).toBeUndefined();
    expect(target.open).toHaveBeenCalledExactlyOnceWith(
      "https://probpera.ru/stati/mnenie-o-knige/approved-book-title/",
      "_blank", "noopener,noreferrer"
    );
    expectNoLocalNavigation(target);
  });

  it.each(["article", "journal"])("does not retry or mutate local state if %s opening throws", (kind) => {
    const failure = new Error("Browser refused to open an external window");
    const target = browser(vi.fn(() => { throw failure; }));
    expect(() => kind === "article" ? navigateToArticle(article) : navigateToJournal())
      .toThrow(failure);
    expect(target.open).toHaveBeenCalledTimes(1);
    expectNoLocalNavigation(target);
  });

  it("renders the canonical recovery archive if PWA bootstrap fails", () => {
    const boundary = new BootstrapErrorBoundary({ children: null });
    boundary.state = { failed: true };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain('href="https://probpera.ru/stati/"');
    expect(html).not.toContain('/planet/stati/');
  });
});
