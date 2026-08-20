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

    expect(queue.counts).toEqual({ total: 9_729, verified: 48, pending: 9_681 });
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

  it("never presents an unverified description as editorial copy", () => {
    const pendingBook = canonicalArchive.find(
      (book) => !isPublicBook(book) && Boolean(book.description?.trim())
    );

    expect(pendingBook).toBeDefined();

    const queue = classifyBookArchiveQueue([pendingBook!]);
    const ru = presentBookArchiveQueueItem(queue.pending[0], "ru");
    const en = presentBookArchiveQueueItem(queue.pending[0], "en");

    expect(ru.description).not.toBe(pendingBook?.description);
    expect(en.description).not.toBe(pendingBook?.description);
    expect(ru.description).toBe("");
    expect(en.description).toBe("");
    expect(ru.descriptionSource).toBe("empty");
    expect(en.descriptionSource).toBe("empty");
    expect(ru.statusLabel).toBe("Не проверено");
    expect(en.statusLabel).toBe("Not verified");
  });

  it("does not expose an unverified Cyrillic title as an English localization", () => {
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

    expect(english.title).toBe("Title pending review");
    expect(english.title).not.toMatch(/\p{Script=Cyrillic}/u);
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
