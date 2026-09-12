import { describe, expect, it } from "vitest";

import { buildBookArchive } from "./bookArchive";
import {
  classifyBookArchiveQueue,
  presentBookArchiveQueueItem,
} from "./bookArchiveQueue";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";

const canonicalArchive = buildBookArchive(bookArchiveCountries);

describe("book archive editorial queue", () => {
  it("classifies every canonical book exactly once", () => {
    const queue = classifyBookArchiveQueue(canonicalArchive);
    const keys = queue.all.map((item) => item.key);

    expect(queue.counts).toEqual({ total: 9_763, verified: 69, pending: 9_694 });
    expect(queue.counts.total).toBe(canonicalArchive.length);
    expect(queue.counts.verified + queue.counts.pending).toBe(
      queue.counts.total
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(queue.verified.every(({ book }) => isPublicBook(book))).toBe(true);
    expect(queue.pending.every(({ book }) => !isPublicBook(book))).toBe(true);
    expect(keys).toEqual([...keys].sort());
  });

  it("moves a promoted record out of pending without changing the total", () => {
    const before = classifyBookArchiveQueue(canonicalArchive);
    const promotedKey = before.pending[0]?.key;

    expect(promotedKey).toBeTruthy();

    const after = classifyBookArchiveQueue(
      canonicalArchive,
      (book) =>
        isPublicBook(book) ||
        `${book.countryId}:${book.writerId}:${book.id}` === promotedKey
    );

    expect(after.counts.total).toBe(before.counts.total);
    expect(after.counts.verified).toBe(before.counts.verified + 1);
    expect(after.counts.pending).toBe(before.counts.pending - 1);
    expect(after.pending.some(({ key }) => key === promotedKey)).toBe(false);
    expect(after.verified.some(({ key }) => key === promotedKey)).toBe(true);
  });

  it("shows pending catalog names without substituting private notes or generic descriptions", () => {
    const source = canonicalArchive.find(
      (book) => !isPublicBook(book) && Boolean(book.description?.trim())
    );
    expect(source).toBeDefined();
    const pendingBook = { ...source!, translations: undefined };

    const queue = classifyBookArchiveQueue([pendingBook!]);
    const ru = presentBookArchiveQueueItem(queue.pending[0], "ru");
    const en = presentBookArchiveQueueItem(queue.pending[0], "en");

    expect(ru.description).not.toBe(pendingBook?.description);
    expect(en.description).not.toBe(pendingBook?.description);
    expect(ru.description).toBe("");
    expect(en.description).toBe("");
    expect(ru.descriptionSource).toBe("empty");
    expect(en.descriptionSource).toBe("empty");
    expect(ru.title).toBe(pendingBook!.title);
    expect(en.title).toBeTruthy();
    expect(ru.titleSource).toBe("canonical-title");
    expect(en.titleSource).toBe("canonical-title");
    expect(ru.statusLabel).toBe("Пока не проверено");
    expect(en.statusLabel).toBe("Not yet reviewed");
  });

  it("preserves an original-script catalog name without inventing an English title or synopsis", () => {
    const source = canonicalArchive[0];
    const pending = {
      ...source,
      id: "pending-cyrillic-title",
      title: "Название без проверенного перевода",
      originalTitle: undefined,
      alternateTitles: [],
      translations: undefined,
    };
    const queue = classifyBookArchiveQueue([pending], () => false);
    const english = presentBookArchiveQueueItem(queue.pending[0], "en");

    expect(english.title).toBe("Название без проверенного перевода");
    expect(english.titleSource).toBe("canonical-title");
    expect(english.description).toBe("");
    expect(english.statusLabel).toBe("Not yet reviewed");
  });

  it("publishes explicitly retained RU/EN synopsis candidates with their pending status and keeps private notes out", () => {
    const source = canonicalArchive[0];
    const translations = {
      ru: { locale: "ru" as const, title: "Сохранённая книга", description: "Готовая русская аннотация.", sourceLanguage: "ru", status: "draft" as const, method: "editorial-original" as const, sourceUrls: ["https://example.org/ru"], retainedCatalogSource: "R49N-20260912" },
      en: { locale: "en" as const, title: "Retained Book", description: "The retained English synopsis.", sourceLanguage: "en", status: "draft" as const, method: "editorial-original" as const, sourceUrls: ["https://example.org/en"], retainedCatalogSource: "R49N-20260912" },
    };
    const book = { ...source, translations, description: "PRIVATE top-level fallback", editorial: { status: "draft" as const, notes: "PRIVATE editorial decision" } };
    const item = classifyBookArchiveQueue([book], () => false).pending[0];
    for (const locale of ["ru", "en"] as const) {
      const shown = presentBookArchiveQueueItem(item, locale);
      expect(shown.title).toBe(translations[locale].title);
      expect(shown.description).toBe(translations[locale].description);
      expect(shown.descriptionSource).toBe("candidate-translation");
      expect(shown.statusLabel).toBe(locale === "ru" ? "Пока не проверено" : "Not yet reviewed");
      expect(JSON.stringify(shown)).not.toContain("PRIVATE");
    }
    const unsigned = { ...book, translations: { ...translations, ru: { ...translations.ru, retainedCatalogSource: undefined } } };
    expect(presentBookArchiveQueueItem(classifyBookArchiveQueue([unsigned], () => false).pending[0], "ru").description).toBe("");
    expect(isPublicBook(book)).toBe(false);
  });

  it("keeps a nominally verified record pending when it fails the public gate", () => {
    const source = canonicalArchive[0];
    const incomplete = {
      ...source,
      id: "status-only-verification",
      translations: undefined,
      sources: undefined,
      editorial: { status: "verified" as const, reviewedAt: "2026-08-08" },
    };
    const queue = classifyBookArchiveQueue([incomplete]);

    expect(queue.counts).toEqual({ total: 1, verified: 0, pending: 1 });
  });

  it("uses localized verified copy only for records that passed the gate", () => {
    const queue = classifyBookArchiveQueue(canonicalArchive);
    const verified = queue.verified[0];

    expect(verified).toBeDefined();

    const ru = presentBookArchiveQueueItem(verified, "ru");
    const en = presentBookArchiveQueueItem(verified, "en");

    expect(ru.titleSource).toBe("verified-translation");
    expect(en.titleSource).toBe("verified-translation");
    expect(ru.descriptionSource).toBe("verified-translation");
    expect(en.descriptionSource).toBe("verified-translation");
    expect(ru.statusLabel).toBe("Проверено редакцией");
    expect(en.statusLabel).toBe("Editorially verified");
  });
});
