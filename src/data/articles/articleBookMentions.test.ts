import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildPublicBookArchive,
  isCoverArtworkDisplayAllowed,
} from "../bookArchive";
import { countries } from "../countries";
import { articleCatalog } from "./catalog";

type ArticleBookMention = {
  key: string;
  countryId: string;
  writerId: string;
  bookId: string;
  coverUrl?: string;
  kind: "review" | "feature" | "mention";
  localizations: {
    ru: { title: string; writerName: string };
    en: { title: string; writerName: string };
  };
};

type MentionIndex = {
  version: number;
  articleCount: number;
  byBook: Record<string, Array<{ id: string }>>;
  byArticle: Record<string, ArticleBookMention[]>;
};

const index = JSON.parse(
  readFileSync(
    new URL("../../../public/articles/book-mentions.json", import.meta.url),
    "utf8"
  )
) as MentionIndex;

const publicBooks = new Map(
  buildPublicBookArchive(countries).map((book) => [
    `${book.countryId}:${book.writerId}:${book.id}`,
    book,
  ])
);

describe("книги, рекомендуемые после статьи", () => {
  it("ссылается только на актуальный публичный каталог статей", () => {
    const publicArticleIds = new Set(articleCatalog.map((article) => article.id));

    expect(index.articleCount).toBe(publicArticleIds.size);
    expect(Object.keys(index.byArticle).every((id) => publicArticleIds.has(id))).toBe(
      true
    );
    for (const mentions of Object.values(index.byBook)) {
      expect(mentions.every((mention) => publicArticleIds.has(mention.id))).toBe(
        true
      );
      expect(new Set(mentions.map((mention) => mention.id)).size).toBe(
        mentions.length
      );
    }
  });

  it("публикует не более шести уникальных книг на статью", () => {
    expect(index.version).toBe(2);
    expect(Object.keys(index.byArticle).length).toBeGreaterThan(0);

    for (const books of Object.values(index.byArticle)) {
      expect(books.length).toBeGreaterThan(0);
      expect(books.length).toBeLessThanOrEqual(6);
      expect(new Set(books.map((book) => book.key)).size).toBe(books.length);
    }
  });

  it("не пропускает в рекомендации черновики и обложки без разрешения", () => {
    for (const books of Object.values(index.byArticle)) {
      for (const book of books) {
        const source = publicBooks.get(book.key);
        expect(source, book.key).toBeDefined();
        expect(book.key).toBe(
          `${book.countryId}:${book.writerId}:${book.bookId}`
        );
        if (book.coverUrl) {
          expect(isCoverArtworkDisplayAllowed(source!)).toBe(true);
          expect([source!.coverThumbnailUrl, source!.coverUrl]).toContain(
            book.coverUrl
          );
        }
      }
    }
  });

  it("сохраняет обратную связь и не подменяет English русским текстом", () => {
    for (const [articleId, books] of Object.entries(index.byArticle)) {
      for (const book of books) {
        expect(index.byBook[book.key]?.some((item) => item.id === articleId)).toBe(
          true
        );
        expect(book.localizations.ru.title.trim()).not.toBe("");
        expect(book.localizations.en.title).toMatch(/[A-Za-z]/u);
        expect(book.localizations.en.title).not.toMatch(/\p{Script=Cyrillic}/u);
        expect(book.localizations.en.writerName).not.toMatch(
          /\p{Script=Cyrillic}/u
        );
      }
    }
  });
});
