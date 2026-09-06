import type { BookArchiveEntry } from "../data/bookArchive";
import type { Country } from "../data/countries/types";
import { isPublicBook } from "../data/bookQuality";

/** References into the existing enriched book runtime, never a rebuilt catalog
 * or raw writer workDetails. The owner tuple is also the canonical book route. */
export function groupPublicBooksForCountry(
  country: Pick<Country, "id" | "writers">,
  books: readonly BookArchiveEntry[]
): ReadonlyMap<string, readonly BookArchiveEntry[]> {
  const publicWriterIds = new Set(country.writers.map(writer => writer.id));
  const grouped = new Map<string, BookArchiveEntry[]>();
  for (const book of books) {
    if (book.countryId !== country.id || !publicWriterIds.has(book.writerId) || !isPublicBook(book)) continue;
    const works = grouped.get(book.writerId) ?? [];
    if (!works.some(work => work.id === book.id)) works.push(book);
    grouped.set(book.writerId, works);
  }
  return grouped;
}

export const writerBookLoadingCopy = {
  reviewStatus: "draft", productionReady: false,
  ru: { loading: "Загружаем каталог произведений…", unavailable: "Каталог произведений пока недоступен. Повторите попытку.", retry: "Повторить загрузку", countPending: "Число произведений будет показано после загрузки каталога" },
  en: { loading: "Loading the works catalog…", unavailable: "The works catalog is currently unavailable. Try again.", retry: "Retry loading", countPending: "The number of works will be shown after the catalog loads" },
} as const;
