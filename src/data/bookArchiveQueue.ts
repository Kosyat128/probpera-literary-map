import {
  bookArchiveKey,
  type BookArchiveEntry,
} from "./bookArchive";
import { selectBookText } from "./bookLocalization";
import { isPublicBook } from "./bookQuality";
import type { WorkLocale, WorkTranslationProfile } from "./countries/types";

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
  descriptionSource: "verified-translation" | "candidate-translation" | "empty";
};

export type BookVerificationPredicate = (book: BookArchiveEntry) => boolean;

const queueCopy = {
  ru: {
    verified: "Проверено редакцией",
    pending: "Пока не проверено",
    untitled: "Название уточняется",
  },
  en: {
    verified: "Editorially verified",
    pending: "Not yet reviewed",
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
 * Labels the complete visible canonical archive by editorial verification.
 * Stable archive keys keep the country/writer/work
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
 * Catalog visibility is independent of editorial verification. Present only
 * the public title and requested-locale synopsis fields; private editorial
 * notes and evidence-review payloads never become visitor copy.
 */
export function presentBookArchiveQueueItem(
  item: BookArchiveQueueItem,
  locale: WorkLocale
): BookArchiveQueuePresentation {
  const copy = queueCopy[locale];
  const verified = item.status === "verified";
  const localized = selectBookText(item.book, locale);
  const localizedTitle = localized.title.trim();
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
            ) || item.book.originalTitle?.trim() || item.book.title.trim()
        : item.book.title.trim();
  const translation = item.book.translations?.[locale] as
    | (WorkTranslationProfile & { retainedCatalogSource?: string })
    | undefined;
  const description =
    verified || translation?.retainedCatalogSource === "R49N-20260912"
      ? localized.description.trim()
      : "";

  const title = localizedTitle || canonicalTitle || copy.untitled;
  const titleSource = localizedTitle
    ? verified ? "verified-translation" : "candidate-translation"
    : canonicalTitle
      ? "canonical-title"
      : "placeholder";

  return {
    title,
    description,
    statusLabel:
      verified ? copy.verified : copy.pending,
    titleSource,
    descriptionSource: description
      ? verified ? "verified-translation" : "candidate-translation"
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
