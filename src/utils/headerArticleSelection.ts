import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";

export type ShowcasePin = { articleId: string; order: number; startsAt: string; endsAt: string; timezone: "UTC" };
export type ShowcaseArticle = ArticleCatalogEntry & { status?: string; withdrawn?: boolean };
export const SHOWCASE_FRESH_POOL = 28;
const months = ["ЯНВАРЯ", "ФЕВРАЛЯ", "МАРТА", "АПРЕЛЯ", "МАЯ", "ИЮНЯ", "ИЮЛЯ", "АВГУСТА", "СЕНТЯБРЯ", "ОКТЯБРЯ", "НОЯБРЯ", "ДЕКАБРЯ"];

/** Date-only publications mean UTC midnight; timestamps must carry an explicit offset. */
export function showcaseDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const clock = /T(\d{2}):(\d{2}):(\d{2})/u.exec(value);
  if (clock && (Number(clock[1]) > 23 || Number(clock[2]) > 59 || Number(clock[3]) > 59)) return null;
  const result = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(result) ? result : null;
}

export function showcasePublishedTime(article: ArticleCatalogEntry) {
  // An explicitly invalid machine date never inherits a seemingly newer human label.
  if (article.publishedAt) return showcaseDate(article.publishedAt) ?? 0;
  const match = article.publishedLabel.toUpperCase().match(/(\d{1,2})\s+([А-ЯЁ]+)\s+(\d{4})/u);
  if (!match || !months.includes(match[2])) return 0;
  return showcaseDate(`${match[3]}-${String(months.indexOf(match[2]) + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`) ?? 0;
}

export function parseShowcasePins(value: unknown): ShowcasePin[] {
  if (!Array.isArray(value) || value.length > 7) throw new Error("В витрине допустимо не более семи закреплений.");
  const ids = new Set<string>();
  return value.map((pin) => {
    const start = showcaseDate(pin?.startsAt), end = showcaseDate(pin?.endsAt);
    if (!pin || typeof pin.articleId !== "string" || !pin.articleId.trim() || pin.articleId.length > 200 ||
        ids.has(pin.articleId) || !Number.isInteger(pin.order) || pin.order < 0 || pin.order > 6 ||
        pin.timezone !== "UTC" || !pin.startsAt?.endsWith("Z") || !pin.endsAt?.endsWith("Z") ||
        start === null || end === null || end <= start) throw new Error("Проверьте ID, порядок и период закреплений в UTC; повторы недопустимы.");
    ids.add(pin.articleId);
    return { articleId: pin.articleId, order: pin.order, startsAt: pin.startsAt, endsAt: pin.endsAt, timezone: "UTC" };
  });
}

export function readShowcasePins(value: unknown): ShowcasePin[] {
  try { return parseShowcasePins(value ?? []); } catch { return []; }
}

export function selectHeaderArticles(articles: readonly ShowcaseArticle[], language: "ru" | "en", pins: readonly ShowcasePin[] = [], now = Date.now()) {
  const unique = new Map<string, ArticleCatalogEntry>();
  for (const article of articles) {
    if (article.withdrawn || (article.status && article.status !== "published") || showcasePublishedTime(article) > now) continue;
    if (language === "en") {
      const release = article.translations?.en?.translationPublishedAt;
      if (release && (showcaseDate(release) === null || showcaseDate(release)! > now)) continue;
    }
    const localized = articleCatalogEntryForLanguage(article, language);
    if (!localized || showcasePublishedTime(localized) > now || unique.has(article.id)) continue;
    unique.set(article.id, localized);
  }
  const sorted = [...unique.values()].sort((a, b) => showcasePublishedTime(b) - showcasePublishedTime(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const active = [...pins].filter(pin => {
    const start = showcaseDate(pin.startsAt), end = showcaseDate(pin.endsAt);
    return start !== null && end !== null && start <= now && now < end && unique.has(pin.articleId);
  }).sort((a, b) => a.order - b.order || a.articleId.localeCompare(b.articleId));
  const selected: ArticleCatalogEntry[] = [];
  const add = (article: ArticleCatalogEntry | undefined) => { if (article && !selected.some(item => item.id === article.id) && selected.length < 7) selected.push(article); };
  active.forEach(pin => add(unique.get(pin.articleId)));
  if (!selected.length) add(sorted[0]);
  const pool = sorted.slice(0, SHOWCASE_FRESH_POOL);
  const sections = new Set(selected.map(article => article.sectionId));
  pool.forEach(article => { if (!sections.has(article.sectionId)) { add(article); sections.add(article.sectionId); } });
  pool.forEach(add);
  const boundaries = pins.flatMap(pin => [showcaseDate(pin.startsAt), showcaseDate(pin.endsAt)]).filter((time): time is number => time !== null && time > now);
  return { lead: selected[0], more: selected.slice(1), count: unique.size, editorialChoice: Boolean(active.some(pin => pin.articleId === selected[0]?.id)), nextBoundary: boundaries.length ? Math.min(...boundaries) : null };
}
