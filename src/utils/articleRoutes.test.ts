import { describe, expect, it } from "vitest";

import {
  articleIdFromPath,
  articlePath,
  articleSeoSlug,
  humanSlug,
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
});
