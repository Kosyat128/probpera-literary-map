import { describe, expect, it } from "vitest";

import {
  dzenCoverForArticle,
  firstSuitableArticleIllustration,
  positionDzenLeadIllustration,
  safeHttpsImageUrl,
} from "./article-publication-images.mjs";

describe("article publication images", () => {
  it("uses the first meaningful HTTPS illustration for Dzen", () => {
    const article = {
      title: "Книга",
      cover_external_url: "https://cdn.example/cover.webp",
      cover_alt: "Обложка статьи",
      content_html:
        '<p>Вступление</p><img class="icon" src="https://cdn.example/icon.png" alt="Иконка"><img src="https://cdn.example/first.webp" alt="Первая содержательная иллюстрация"><img src="https://cdn.example/second.webp" alt="Вторая иллюстрация">',
    };
    expect(dzenCoverForArticle(article)).toEqual({
      url: "https://cdn.example/first.webp",
      alt: "Первая содержательная иллюстрация",
      source: "first-article-illustration",
    });
  });

  it("rejects unsafe, decorative, tiny, and inaccessible images", () => {
    expect(safeHttpsImageUrl("javascript:alert(1)")).toBeNull();
    expect(
      firstSuitableArticleIllustration(
        '<img src="http://cdn.example/a.jpg" alt="HTTP"><img src="https://cdn.example/pixel.png" width="1" height="1" alt="Пиксель"><img src="https://cdn.example/no-alt.png"><figure class="article ornament"><img src="https://cdn.example/ornament.png" alt="Декоративный орнамент"></figure><img class="media icon" src="https://cdn.example/icon.png" alt="Служебная иконка"><img src="https://cdn.example/ok.jpg" alt="Подходящая фотография">'
      )
    ).toEqual({
      url: "https://cdn.example/ok.jpg",
      alt: "Подходящая фотография",
    });
  });

  it("repairs a missing inline alt consistently for export and feed verification", () => {
    expect(
      dzenCoverForArticle({
        title: "Статья без alt",
        content_html: '<p>Лид.</p><img src="https://cdn.example/lead.jpg">',
        cover_external_url: "https://cdn.example/cover.jpg",
      })
    ).toEqual({
      url: "https://cdn.example/lead.jpg",
      alt: "Иллюстрация к статье «Статья без alt»",
      source: "first-article-illustration",
    });
  });

  it("places a direct lead illustration after the preface and before H2", () => {
    const html = positionDzenLeadIllustration(
      '<img src="https://cdn.example/lead.webp" alt="Ведущая иллюстрация"><p>Первый абзац.</p><p>Второй абзац.</p><h2>Первый раздел</h2><p>Текст.</p>',
      { url: "https://cdn.example/lead.webp", alt: "Ведущая иллюстрация" }
    );
    expect(html.indexOf("Второй абзац")).toBeLessThan(html.indexOf("<img"));
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<h2"));
    expect(html.match(/lead\.webp/gu)).toHaveLength(1);
  });

  it("adds the fallback cover after an explicit lead when the body has no image", () => {
    const html = positionDzenLeadIllustration(
      '<aside class="article-lead"><p>Предисловие.</p></aside><h2>Раздел</h2>',
      { url: "https://cdn.example/cover.webp", alt: "Обложка" }
    );
    expect(html.indexOf("article-lead")).toBeLessThan(html.indexOf("cover.webp"));
    expect(html.indexOf("cover.webp")).toBeLessThan(html.indexOf("<h2"));
  });
});
