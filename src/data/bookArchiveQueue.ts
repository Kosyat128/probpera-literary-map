import {
  bookArchiveKey,
  type BookArchiveEntry,
} from "./bookArchive";
import { selectBookText } from "./bookLocalization";
import { isPublicBook } from "./bookQuality";
import type { WorkLocale } from "./countries/types";

export type BookArchiveQueueStatus = "verified" | "pending";

export type BookArchiveQueueItem = {
  key: string;
  status: BookArchiveQueueStatus;
  book: BookArchiveEntry;
};

export type BookArchiveQueue = {
  all: BookArchiveQueueItem[];
  verified: BookArchiveQueueItem[];
  pending: BookArchiveQueueItem[];
  counts: {
    total: number;
    verified: number;
    pending: number;
  };
};

export type BookArchiveQueuePresentation = {
  title: string;
  description: string;
  statusLabel: string;
  titleSource:
    | "verified-translation"
    | "candidate-translation"
    | "canonical-title"
    | "placeholder";
  descriptionSource: "verified-translation" | "empty";
};

export type BookVerificationPredicate = (book: BookArchiveEntry) => boolean;

const queueCopy = {
  ru: {
    verified: "Проверено редакцией",
    pending: "Не проверено",
    untitled: "Название уточняется",
  },
  en: {
    verified: "Editorially verified",
    pending: "Not verified",
    untitled: "Title pending review",
  },
} as const;

function queueKey(book: BookArchiveEntry) {
  return bookArchiveKey(book.countryId, book.writerId, book.id);
}

export function bookArchiveQueueItem(
  book: BookArchiveEntry,
  isVerified: BookVerificationPredicate = isPublicBook
): BookArchiveQueueItem {
  return {
    key: queueKey(book),
    status: isVerified(book) ? "verified" : "pending",
    book,
  };
}

function compareQueueItems(
  left: BookArchiveQueueItem,
  right: BookArchiveQueueItem
) {
  if (left.key === right.key) return 0;
  return left.key < right.key ? -1 : 1;
}

/**
 * Splits the complete canonical archive into the visitor-ready verified set
 * and the editorial queue. Stable archive keys keep the country/writer/work
 * relation intact and make a later promotion a move, never a copy.
 */
export function classifyBookArchiveQueue(
  books: readonly BookArchiveEntry[],
  isVerified: BookVerificationPredicate = isPublicBook
): BookArchiveQueue {
  const uniqueBooks = new Map<string, BookArchiveEntry>();

  for (const book of books) {
    const key = queueKey(book);
    if (!uniqueBooks.has(key)) uniqueBooks.set(key, book);
  }

  const all = [...uniqueBooks.entries()]
    .map(([, book]) => bookArchiveQueueItem(book, isVerified))
    .sort(compareQueueItems);
  const verified = all.filter((item) => item.status === "verified");
  const pending = all.filter((item) => item.status === "pending");

  return {
    all,
    verified,
    pending,
    counts: {
      total: all.length,
      verified: verified.length,
      pending: pending.length,
    },
  };
}

/**
 * Pending records may expose a candidate title for identification, but never
 * their draft description. Only a book that passed the shared publication
 * gate can expose its localized editorial description.
 */
export function presentBookArchiveQueueItem(
  item: BookArchiveQueueItem,
  locale: WorkLocale
): BookArchiveQueuePresentation {
  const copy = queueCopy[locale];
  const localized = selectBookText(item.book, locale);
  const localizedTitle =
    item.status === "verified" ? localized.title.trim() : "";
  const canonicalTitle =
    locale === "en"
      ? [
          item.book.originalTitle,
          item.book.title,
          ...(item.book.alternateTitles || []),
        ]
          .map((title) => title?.trim() || "")
          .find(
            (title) =>
              /\p{Script=Latin}/u.test(title) &&
              !/\p{Script=Cyrillic}/u.test(title)
          ) || ""
      : item.book.title.trim();
  const verifiedDescription =
    item.status === "verified" ? localized.description.trim() : "";

  const title = localizedTitle || canonicalTitle || copy.untitled;
  const titleSource = localizedTitle
    ? "verified-translation"
    : canonicalTitle
      ? "canonical-title"
      : "placeholder";

  return {
    title,
    description: verifiedDescription,
    statusLabel:
      item.status === "verified" ? copy.verified : copy.pending,
    titleSource,
    descriptionSource: verifiedDescription
      ? "verified-translation"
      : "empty",
  };
}

export function presentBookArchiveEntry(
  book: BookArchiveEntry,
  locale: WorkLocale,
  isVerified: BookVerificationPredicate = isPublicBook
) {
  return presentBookArchiveQueueItem(
    bookArchiveQueueItem(book, isVerified),
    locale
  );
}
