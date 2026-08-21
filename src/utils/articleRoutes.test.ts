import { describe, expect, it, vi } from "vitest";

import {
  articleIdFromPath,
  articlePath,
  articleSectionArchivePath,
  articleSeoSlug,
  humanSlug,
  isDirectArticlePath,
  journalPath,
  journalSectionFromPath,
  navigateToJournal,
  resolveArticleRoute,
  shouldUseClientNavigation,
} from "./articleRoutes";

describe("SEO-адреса статей", () => {
  it("создаёт читаемый адрес из русского заголовка", () => {
    expect(humanSlug("Редкие слова, которые помогут вам читать")).toBe(
      "redkie-slova-kotorye-pomogut-vam-chitat"
    );
  });

  it("не добавляет к читаемому адресу технический хвост", () => {
    expect(articleSeoSlug("article-1", "О книге")).toBe("o-knige");
  });

  it("понимает новый и старый адрес", () => {
    const catalog = [{ id: "article-1", title: "О книге", sectionId: "book-opinions" }];
    const slug = articleSeoSlug("article-1", "О книге");
    expect(articlePath("article-1", "О книге", "book-opinions")).toContain(
      `/stati/mnenie-o-knige/${slug}/`
    );
    expect(articleIdFromPath(catalog, `/stati/mnenie-o-knige/${slug}/`)).toBe(
      "article-1"
    );
    expect(
      articleIdFromPath(catalog, "/stati/mnenie-o-knige/o-knige-1wzedz/")
    ).toBe("article-1");
    expect(
      articleIdFromPath(catalog, "/articles/article-1/")
    ).toBe("article-1");
  });

  it("resolves an approved English slug from a localized catalogue", () => {
    const catalog = [
      {
        id: "article-1",
        title: "An approved English title",
        sectionId: "literary-essays",
        slug: "approved-english-title",
      },
    ];

    expect(
      articleIdFromPath(
        catalog,
        "/stati/o-literature/approved-english-title/"
      )
    ).toBe("article-1");
  });

  it("distinguishes article routes from the journal homepage", () => {
    expect(
      isDirectArticlePath(
        "/probpera-literary-map/stati/mnenie-o-knige/o-knige/"
      )
    ).toBe(true);
    expect(
      isDirectArticlePath("/probpera-literary-map/articles/article-1/")
    ).toBe(true);
    expect(isDirectArticlePath("/probpera-literary-map/stati/")).toBe(false);
    expect(
      isDirectArticlePath("/probpera-literary-map/stati/mnenie-o-knige/")
    ).toBe(false);
  });

  it("creates crawlable journal and section archive URLs", () => {
    expect(articleSectionArchivePath()).toBe("/stati/");
    expect(articleSectionArchivePath("book-opinions")).toBe(
      "/stati/mnenie-o-knige/"
    );
    expect(journalPath()).toContain("/stati/");
    expect(journalPath("book-opinions")).toContain(
      "/stati/mnenie-o-knige/"
    );
    expect(journalPath("book-opinions")).not.toContain("#journal");
    expect(journalSectionFromPath(journalPath())).toBe("all");
    expect(journalSectionFromPath(journalPath("book-opinions"))).toBe(
      "book-opinions"
    );
    expect(
      journalSectionFromPath(
        journalPath("book-opinions").replace("mnenie-o-knige", "neizvestno")
      )
    ).toBeNull();
  });

  it("keeps enhanced journal navigation inside the loaded application", () => {
    const pushState = vi.fn();
    const replaceState = vi.fn();
    const dispatchEvent = vi.fn();
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal("window", {
      history: { pushState, replaceState },
      dispatchEvent,
      requestAnimationFrame,
      matchMedia: () => ({ matches: false }),
    });

    navigateToJournal("book-opinions");
    expect(pushState).toHaveBeenCalledWith(
      { probperaJournal: "book-opinions" },
      "",
      journalPath("book-opinions")
    );
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    navigateToJournal("language", true);
    expect(replaceState).toHaveBeenCalledWith(
      { probperaJournal: "language" },
      "",
      journalPath("language")
    );
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("repairs a valid slug placed under an outdated section", () => {
    const catalog = [
      {
        id: "article-1",
        title: "Зарубежные классики литературы и их профессии",
        sectionId: "writers-world",
        slug: "zarubezhnye-klassiki-literatury-i-ih-professii",
      },
    ];
    const resolution = resolveArticleRoute(
      catalog,
      "/stati/literaturnye-istorii/zarubezhnye-klassiki-literatury-i-ih-professii/"
    );

    expect(resolution).toEqual({
      articleId: "article-1",
      canonicalPath:
        "/stati/pisateli-mira/zarubezhnye-klassiki-literatury-i-ih-professii/",
      isCanonical: false,
    });
  });

  it("canonicalizes the trailing slash and refuses an ambiguous cross-section slug", () => {
    const catalog = [
      {
        id: "article-1",
        title: "Первый материал",
        sectionId: "writers-world",
        slug: "shared-slug",
      },
      {
        id: "article-2",
        title: "Второй материал",
        sectionId: "author-stories",
        slug: "shared-slug",
      },
    ];

    expect(
      resolveArticleRoute(catalog, "/stati/pisateli-mira/shared-slug")
    ).toMatchObject({ articleId: "article-1", isCanonical: false });
    expect(
      resolveArticleRoute(catalog, "/stati/o-literature/shared-slug/")
    ).toBeNull();
  });

  it("preserves native new-tab and modified-click navigation", () => {
    const plainClick = {
      button: 0,
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };

    expect(shouldUseClientNavigation(plainClick)).toBe(true);
    expect(shouldUseClientNavigation({ ...plainClick, ctrlKey: true })).toBe(
      false
    );
    expect(shouldUseClientNavigation({ ...plainClick, button: 1 })).toBe(false);
  });
});
