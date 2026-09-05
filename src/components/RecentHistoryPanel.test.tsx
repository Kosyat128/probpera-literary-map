import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentHistoryProvider, type RecentEntry, type RecentHistoryStore } from "../planet/RecentHistory";
import type { Country, Writer, BookArchiveEntry } from "../planet/types";
import RecentHistoryPanel, { resolveRecentHistoryRows, type RecentHistoryPanelProps } from "./RecentHistoryPanel";
const locale = vi.hoisted(() => ({ language: "ru" as "ru" | "en" }));
vi.mock("../planet/localization", async importOriginal => ({ ...await importOriginal<typeof import("../planet/localization")>(), useInterfaceLanguage: () => ({ language: locale.language }) }));
afterEach(() => { locale.language = "ru"; });

function fixture() {
  const writer = { id: "canonical-writer", name: "Каноническое имя", fullName: "Canonical Name" } as Writer;
  const country = { id: "canonical-country", writers: [writer] } as Country;
  const book = { id: "canonical-work", countryId: country.id, writerId: writer.id, translations: {
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
