import { describe, expect, it } from "vitest";

import {
  articleIdFromPath,
  articlePath,
  articleSeoSlug,
  humanSlug,
  isDirectArticlePath,
  resolveArticleRoute,
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
    expect(isDirectArticlePath("/probpera-literary-map/#journal")).toBe(false);
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
});
