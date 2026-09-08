import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentHistoryProvider, type RecentEntry, type RecentHistorySnapshot, type RecentHistoryStore } from "../planet/RecentHistory";
import type { Country, Writer, BookArchiveEntry } from "../planet/types";
import RecentHistoryPanel, { recentHistoryCopy, resolveRecentHistoryRows, type RecentHistoryPanelProps } from "./RecentHistoryPanel";
const locale = vi.hoisted(() => ({ language: "ru" as "ru" | "en" }));
vi.mock("../planet/localization", async importOriginal => ({ ...await importOriginal<typeof import("../planet/localization")>(), useInterfaceLanguage: () => ({ language: locale.language }) }));
afterEach(() => { locale.language = "ru"; });

function fixture() {
  // Synthetic presentation fixtures. App's separate public-surface gate owns
  // publication eligibility; these names and titles are not editorial evidence.
  const writer = { id: "canonical-writer", name: "Каноническое имя", fullName: "Canonical Name" } as Writer;
  const country = { id: "canonical-country", writers: [writer] } as Country;
  const book = { id: "canonical-work", countryId: country.id, writerId: writer.id, country, writer, writerName: writer.name, translations: {
    ru: { locale: "ru", title: "Название из каталога", description: "" }, en: { locale: "en", title: "Catalog title", description: "" },
  } } as BookArchiveEntry;
  const entries: RecentEntry[] = [{ kind: "writer", countryId: country.id, writerId: writer.id, openedAt: 1 }, { kind: "work", countryId: country.id, writerId: writer.id, workId: book.id, openedAt: 2 }];
  const props: RecentHistoryPanelProps = { countries: [country], books: [book], countryStatus: "ready", bookStatus: "ready", onLoad: vi.fn(), onRetry: vi.fn(), onOpenWriter: vi.fn(), onOpenWork: vi.fn() };
  const store: RecentHistoryStore = { persistence: "best-effort", getSnapshot: () => ({ available: true, loaded: true, entries }), subscribe: vi.fn(() => () => undefined), clear: vi.fn(async () => undefined), record: vi.fn(async () => undefined) };
  return { writer, country, book, entries, props, store };
}
describe("canonical recent-history presentation", () => {
  it.each(["ru", "en"] as const)("resolves current %s labels while keeping only IDs in history", language => {
    locale.language = language;
    const env = fixture();
    const markup = renderToStaticMarkup(<RecentHistoryProvider store={env.store}><RecentHistoryPanel {...env.props} /></RecentHistoryProvider>);
    expect(markup).toContain(language === "ru" ? "Недавно открытое" : "Recently opened");
    expect(markup).toContain(language === "ru" ? "Название из каталога" : "Catalog title");
    expect(markup).toContain(language === "ru" ? "Очистить историю" : "Clear history");
    expect(markup).not.toContain(language === "ru" ? "Catalog title" : "Название из каталога");
    expect(env.props.onLoad).not.toHaveBeenCalled(); expect(env.store.record).not.toHaveBeenCalled();
  });
  it("restores through the existing callbacks with exact canonical objects and return focus", () => {
    const env = fixture(), trigger = {} as HTMLElement;
    const rows = resolveRecentHistoryRows(env.entries, env.props, "en");
    rows[0].open(trigger); rows[1].open(trigger);
    expect(env.props.onOpenWriter).toHaveBeenCalledExactlyOnceWith(env.country, env.writer);
    expect(env.props.onOpenWork).toHaveBeenCalledExactlyOnceWith(env.book, trigger);
  });
  it("skips removed IDs and absent English title/name without guessing a label", () => {
    const env = fixture();
    env.entries.push({ kind: "work", countryId: env.country.id, writerId: env.writer.id, workId: "removed-title", openedAt: 3 });
    expect(resolveRecentHistoryRows(env.entries, env.props, "en")).toHaveLength(2);
    delete env.book.translations!.en;
    expect(resolveRecentHistoryRows(env.entries, env.props, "en")).toHaveLength(1);
    env.writer.fullName = "";
    expect(resolveRecentHistoryRows(env.entries, env.props, "en")).toHaveLength(0);
  });
  it("hides an English placeholder and never restores a quarantined writer from the book snapshot", () => {
    const env = fixture();
    env.writer.fullName = "Author";
    expect(resolveRecentHistoryRows(env.entries, env.props, "en")).toEqual([]);
    env.writer.fullName = "Canonical Name";
    env.country.writers = [];
    expect(env.book.writer).toBe(env.writer);
    expect(resolveRecentHistoryRows(env.entries, env.props, "en")).toEqual([]);
    expect(resolveRecentHistoryRows(env.entries, { ...env.props, countries: [] }, "ru")).toEqual([]);
  });
  it.each(["ru", "en"] as const)("uses current public %s writer labels instead of the book's old embedded writer", language => {
    const env = fixture();
    env.book.writer = { ...env.writer, name: "Устаревшее имя", fullName: "Old Name" };
    const rows = resolveRecentHistoryRows(env.entries, env.props, language);
    expect(rows[1].label).toBe(language === "ru" ? "Название из каталога · Каноническое имя" : "Catalog title · Canonical Name");
  });
  it.each(["ru", "en"] as const)("uses factual %s coauthor credits while preserving the canonical archive target", language => {
    const env = fixture(), trigger = {} as HTMLElement;
    env.book.authorship = { kind: "multiple", authors: [
      { creditNames: { ru: "Первый автор", en: "First Author" } },
      { creditNames: { ru: "Второй автор", en: "Second Author" } },
    ] };
    const rows = resolveRecentHistoryRows(env.entries, env.props, language);
    expect(rows[1].label).toBe(language === "ru" ? "Название из каталога · Первый автор и Второй автор" : "Catalog title · First Author and Second Author");
    rows[1].open(trigger);
    expect(env.props.onOpenWork).toHaveBeenCalledExactlyOnceWith(env.book, trigger);
  });
  it.each(["anonymous", "traditional"] as const)("does not attribute an %s work to its routing writer or hide its factual English credit", kind => {
    const env = fixture();
    env.book.authorship = { kind, authors: [] };
    env.writer.fullName = "";
    const rows = resolveRecentHistoryRows(env.entries, env.props, "en");
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe(`Catalog title · ${kind === "anonymous" ? "Anonymous" : "Traditional work"}`);
    const russian = resolveRecentHistoryRows(env.entries, env.props, "ru");
    expect(russian[1].label).toBe(`Название из каталога · ${kind === "anonymous" ? "Аноним" : "Традиционное произведение"}`);
    env.country.writers = [];
    expect(resolveRecentHistoryRows(env.entries, env.props, "en")).toEqual([]);
  });
  it.each(["ru", "en"] as const)("shows an explicit %s loading/error state for a cold lazy catalog", language => {
    locale.language = language; const env = fixture();
    const loading = renderToStaticMarkup(<RecentHistoryProvider store={env.store}><RecentHistoryPanel {...env.props} countries={[]} books={[]} countryStatus="loading" bookStatus="loading" /></RecentHistoryProvider>);
    expect(loading).toContain(language === "ru" ? "Загружаем карточки" : "Loading cards");
    expect(loading).not.toContain("data-recent-entry");
    const failed = renderToStaticMarkup(<RecentHistoryProvider store={env.store}><RecentHistoryPanel {...env.props} countryStatus="error" /></RecentHistoryProvider>);
    expect(failed).toContain(language === "ru" ? "Повторите попытку" : "Try again");
  });
  it("is a public-site no-op without the authorized scoped provider", () => {
    const env = fixture();
    expect(renderToStaticMarkup(<RecentHistoryPanel {...env.props} />)).toBe("");
    expect(env.props.onLoad).not.toHaveBeenCalled();
  });
});

describe("recent-history persistence feedback", () => {
  function renderStorage(language: "ru" | "en", snapshot: Partial<RecentHistorySnapshot>, withRetry = true) {
    locale.language = language;
    const env = fixture();
    const retry = vi.fn(async () => undefined);
    const current: RecentHistorySnapshot = { available: true, loaded: true, entries: env.entries, ...snapshot };
    env.store.getSnapshot = () => current;
    if (withRetry) env.store.retry = retry;
    const markup = renderToStaticMarkup(<RecentHistoryProvider store={env.store}><RecentHistoryPanel {...env.props} /></RecentHistoryProvider>);
    return { env, retry, markup };
  }
  it.each(["ru", "en"] as const)("distinguishes native %s history loading from catalog loading", language => {
    const { env, retry, markup } = renderStorage(language, { loaded: false, entries: [], storageStatus: "loading" });
    expect(markup).toContain(recentHistoryCopy[language].storageLoading);
    expect(markup).toContain('role="status" aria-atomic="true" data-recent-storage-status="loading"');
    expect(markup).not.toContain(recentHistoryCopy[language].loading);
    expect(markup).not.toContain(recentHistoryCopy[language].empty);
    expect(markup).not.toContain("data-recent-storage-retry");
    expect(markup).toContain('data-recent-clear=""');
    expect(markup).not.toContain('data-recent-clear="" disabled=""');
    expect(env.store.clear).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });
  it.each(["ru", "en"] as const)("shows pending %s clear without claiming the empty history is already saved", language => {
    const { markup } = renderStorage(language, { entries: [], storageStatus: "saving" });
    expect(markup).toContain(recentHistoryCopy[language].storageSaving);
    expect(markup).toContain('data-recent-storage-status="saving"');
    expect(markup).toContain('data-recent-clear="" disabled=""');
    expect(markup).not.toContain(recentHistoryCopy[language].empty);
  });
  it.each(["ru", "en"] as const)("offers a distinct %s persistence retry after a failed clear, then shows empty only after confirmation", language => {
    const { env, retry, markup } = renderStorage(language, { entries: [], storageStatus: "error" });
    expect(markup).toContain(recentHistoryCopy[language].storageFailed);
    expect(markup).toContain(recentHistoryCopy[language].storageRetry);
    expect(markup).toContain('data-recent-storage-retry=""');
    expect(markup).not.toContain("data-recent-catalog-retry");
    expect(markup).not.toContain(recentHistoryCopy[language].empty);
    expect(markup).not.toContain('data-recent-clear="" disabled=""');
    expect(env.props.onRetry).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    const confirmed = renderStorage(language, { entries: [], storageStatus: "ready" }).markup;
    expect(confirmed).toContain(recentHistoryCopy[language].empty);
    expect(confirmed).not.toContain("data-recent-storage-status");
  });
  it("keeps card loading retry separate and canonical rows usable during a persistence error", () => {
    const env = fixture();
    env.store.getSnapshot = () => ({ available: true, loaded: true, entries: env.entries, storageStatus: "error" });
    env.store.retry = vi.fn(async () => undefined);
    const markup = renderToStaticMarkup(<RecentHistoryProvider store={env.store}><RecentHistoryPanel {...env.props} countryStatus="error" /></RecentHistoryProvider>);
    expect(markup).toContain('data-recent-storage-retry=""');
    expect(markup).toContain('data-recent-catalog-retry=""');
    expect(markup).toContain("data-recent-entry");
    expect(markup).toContain(recentHistoryCopy.ru.storageFailed);
    expect(markup).toContain(recentHistoryCopy.ru.failed);
  });
  it("lets Clear supersede a pending native write while entries are still present", () => {
    const { env, markup } = renderStorage("en", { storageStatus: "saving" });
    expect(markup).toContain(recentHistoryCopy.en.storageSaving);
    expect(markup).toContain('data-recent-clear=""');
    expect(markup).not.toContain('data-recent-clear="" disabled=""');
    expect(env.store.clear).not.toHaveBeenCalled();
  });
  it("keeps the existing Web store's optional contract free of unsupported persistence controls", () => {
    const legacy = renderStorage("en", {}, false).markup;
    expect(legacy).toContain("Catalog title");
    expect(legacy).not.toContain("data-recent-storage-status");
    expect(legacy).not.toContain("data-recent-storage-retry");
    expect(renderStorage("en", { entries: [] }, false).markup).toContain('data-recent-clear="" disabled=""');
    const withoutRetry = renderStorage("en", { storageStatus: "error" }, false).markup;
    expect(withoutRetry).toContain(recentHistoryCopy.en.storageFailed);
    expect(withoutRetry).not.toContain("data-recent-storage-retry");
    expect(recentHistoryCopy.reviewStatus).toBe("draft");
    expect(recentHistoryCopy.productionReady).toBe(false);
  });
});
