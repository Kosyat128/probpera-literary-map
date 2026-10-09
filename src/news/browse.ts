import { calendarDay } from "./dates";
import type { NewsItem, NewsRegion } from "./types";

export type NewsPeriod = "all" | "today" | "upcoming";
export type NewsSort = "briefing" | "newest" | "oldest";
export type NewsBrowseFilters = {
  period: NewsPeriod;
  topic: "all" | NewsItem["category"];
  region: "all" | NewsRegion;
  query: string;
  source: string;
  publishedFrom: string;
  publishedTo: string;
  sort: NewsSort;
};

function searchable(value: string) {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/ё/g, "е");
}

export function newsSourceOrigin(item: NewsItem): string {
  return new URL(item.source.url).origin;
}

export function newsPublicationDay(item: NewsItem, timeZone: string): string | null {
  if (item.publishedAt === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)
    ? item.publishedAt : calendarDay(Date.parse(item.publishedAt), timeZone);
}

/** Browse a verified snapshot without manufacturing dates or changing its proof. */
export function newsAnnouncementIsCurrent(item: NewsItem, today: string, timeZone: string): boolean {
  return item.kind !== "announcement" || item.eventDate > today
    || item.eventDate === today && calendarDay(Date.parse(item.verifiedAt), timeZone) >= today;
}

export function browseNewsItems(items: NewsItem[], filters: NewsBrowseFilters, today: string, timeZone: string, { archive = false } = {}): NewsItem[] {
  const terms = searchable(filters.query).trim().split(/\s+/).filter(Boolean);
  const selected = items.filter((item) => {
    const published = newsPublicationDay(item, timeZone);
    return (archive || newsAnnouncementIsCurrent(item, today, timeZone))
      && (filters.period !== "today" || item.eventDate === today)
      && (filters.period !== "upcoming" || item.eventDate > today)
      && (filters.topic === "all" || item.category === filters.topic)
      && (filters.region === "all" || (item.region ?? "global") === filters.region)
      && (!filters.source || newsSourceOrigin(item) === filters.source)
      && (!filters.publishedFrom || published !== null && published >= filters.publishedFrom)
      && (!filters.publishedTo || published !== null && published <= filters.publishedTo)
      && terms.every((term) => searchable(`${item.title.ru} ${item.title.en} ${item.summary.ru} ${item.summary.en} ${item.source.name}`).includes(term));
  });
  if (filters.sort === "briefing") return selected;
  return selected.map((item, index) => ({ item, index })).sort((left, right) => {
    const leftTime = left.item.publishedAt === null ? null : Date.parse(left.item.publishedAt);
    const rightTime = right.item.publishedAt === null ? null : Date.parse(right.item.publishedAt);
    // Unknown publication dates stay explicit and sort last in both directions.
    if (leftTime === null || rightTime === null) return leftTime === rightTime ? left.index - right.index : leftTime === null ? 1 : -1;
    return (filters.sort === "newest" ? rightTime - leftTime : leftTime - rightTime) || left.index - right.index;
  }).map(({ item }) => item);
}

/** A fixed reading page, clamped after withdrawals or reader-state changes. */
export function paginateNewsItems<T>(items: T[], requestedPage: number) {
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(requestedPage) || 1));
  const offset = (page - 1) * pageSize;
  return { page, totalPages, items: items.slice(offset, offset + pageSize),
    start: items.length ? offset + 1 : 0, end: Math.min(offset + pageSize, items.length) };
}

export function newsPageNumbers(page: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page < 4) for (let value = 1; value <= Math.min(5, totalPages); value++) pages.add(value);
  if (page > totalPages - 3) for (let value = Math.max(1, totalPages - 4); value <= totalPages; value++) pages.add(value);
  const selected = [...pages].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b);
  return selected.flatMap((value, index) => index > 0 && value - selected[index - 1] > 1 ? [null, value] : [value]);
}

export function newsPageForAnchor(items: { id: string }[], anchorId: string, fallbackPage: number): number {
  const index = items.findIndex((item) => item.id === anchorId);
  return index < 0 ? paginateNewsItems(items, fallbackPage).page : Math.floor(index / 25) + 1;
}
