import { useId, useMemo } from "react";
import { useRecentHistory, recentEntryKey, type RecentEntry } from "../planet/RecentHistory";
import { useInterfaceLanguage } from "../planet/localization";
import { selectBookAuthorByline, selectBookText } from "../planet/selection";
import type { Country, Writer, BookArchiveEntry } from "../planet/types";
import { writerSearchLabel } from "../utils/writerSearchLabel";
import "./recent-history.css";

export const recentHistoryCopy = {
  reviewStatus: "draft", productionReady: false,
  ru: { heading: "Недавно открытое", empty: "Здесь появятся недавно открытые авторы и произведения.", loading: "Загружаем карточки…", failed: "Карточки пока недоступны. Повторите попытку.", retry: "Повторить", clear: "Очистить историю", writer: "Автор", work: "Произведение", storageLoading: "Загружаем историю…", storageSaving: "Сохраняем историю…", storageFailed: "Не удалось подтвердить загрузку или сохранение истории на этом устройстве. Повторите попытку.", storageRetry: "Повторить сохранение или загрузку истории" },
  en: { heading: "Recently opened", empty: "Writers and works you open will appear here.", loading: "Loading cards…", failed: "Cards are currently unavailable. Try again.", retry: "Try again", clear: "Clear history", writer: "Writer", work: "Work", storageLoading: "Loading history…", storageSaving: "Saving history…", storageFailed: "Could not confirm loading or saving history on this device. Try again.", storageRetry: "Retry saving or loading history" },
} as const;
type LoadStatus = "idle" | "loading" | "ready" | "error";
type RecentRow = { key: string; label: string; kind: string; open: (trigger: HTMLElement) => void };
export interface RecentHistoryPanelProps {
  readonly countries: readonly Country[];
  readonly books: readonly BookArchiveEntry[];
  readonly countryStatus: LoadStatus;
  readonly bookStatus: LoadStatus;
  readonly onLoad: () => void;
  readonly onRetry: () => void;
  readonly restartRequired?: boolean;
  readonly onOpenWriter: (country: Country, writer: Writer) => void;
  readonly onOpenWork: (book: BookArchiveEntry, returnFocus: HTMLElement) => void;
}
export function resolveRecentHistoryRows(entries: readonly RecentEntry[], props: RecentHistoryPanelProps, language: "ru" | "en"): RecentRow[] {
  const copy = recentHistoryCopy[language];
  return entries.flatMap<RecentRow>(entry => {
    const country = props.countries.find(item => item.id === entry.countryId);
    const writer = country?.writers.find(item => item.id === entry.writerId);
    if (!country || !writer) return [];
    const writerName = writerSearchLabel(writer, language);
    if (entry.kind === "writer") return writerName ? [{ key: recentEntryKey(entry), label: writerName, kind: copy.writer, open: (_trigger: HTMLElement) => props.onOpenWriter(country, writer) }] : [];
    const book = props.books.find(item => item.countryId === entry.countryId && item.writerId === entry.writerId && item.id === entry.workId);
    if (!book) return [];
    const title = selectBookText(book, language).title;
    if (!title) return [];
    // Public book credits can differ from the writer that owns its archive key.
    // Legacy rows use the current public writer, never the book's stale snapshot.
    const byline = book.authorship ? selectBookAuthorByline(book, language, "") : writerName;
    if (!byline) return [];
    return [{ key: recentEntryKey(entry), label: title + " · " + byline, kind: copy.work, open: (trigger: HTMLElement) => props.onOpenWork(book, trigger) }];
  });
}
export default function RecentHistoryPanel(props: RecentHistoryPanelProps) {
  const history = useRecentHistory();
  const { language } = useInterfaceLanguage();
  const labelId = useId();
  const copy = recentHistoryCopy[language];
  const rows = useMemo(() => resolveRecentHistoryRows(history.entries, props, language), [history.entries, props.countries, props.books, props.onOpenWriter, props.onOpenWork, language]);
  if (!history.available) return null;
  const hasWorks = history.entries.some(entry => entry.kind === "work");
  const failed = props.countryStatus === "error" || (hasWorks && props.bookStatus === "error");
  const storageBusy = history.storageStatus === "loading" || history.storageStatus === "saving";
  const storageFailed = history.storageStatus === "error";
  const storageMessage = history.storageStatus === "loading" ? copy.storageLoading : history.storageStatus === "saving" ? copy.storageSaving : storageFailed ? copy.storageFailed : "";
  const loading = (!history.loaded && !history.storageStatus) || (history.entries.length > 0 && (props.countryStatus !== "ready" || (hasWorks && props.bookStatus !== "ready")));
  return <details className="recent-history editorial-section" data-recent-history="" onToggle={event => { if (event.currentTarget.open) props.onLoad(); }}>
    <summary id={labelId}>{copy.heading}</summary>
    <div className="recent-history__content" aria-labelledby={labelId}>
      {storageMessage ? <p role="status" aria-atomic="true" data-recent-storage-status={history.storageStatus}>{storageMessage}{storageFailed && history.retry ? <> <button type="button" data-recent-storage-retry="" onClick={() => { void history.retry?.(); }}>{copy.storageRetry}</button></> : null}</p> : null}
      {failed ? <p role="status">{copy.failed} <button type="button" data-recent-catalog-retry="" onClick={props.onRetry}>{props.restartRequired ? language === "ru" ? "Перезапустить приложение" : "Restart application" : copy.retry}</button></p> : loading ? <p role="status">{copy.loading}</p> : null}
      {rows.length ? <ol>{rows.map(row => <li key={row.key}><button type="button" data-recent-entry={row.key} onClick={event => row.open(event.currentTarget)}><span className="recent-history__kind">{row.kind}</span><span className="recent-history__label">{row.label}</span></button></li>)}</ol> : history.loaded && !loading && !failed && !storageBusy && !storageFailed ? <p>{copy.empty}</p> : null}
      <button type="button" data-recent-clear="" disabled={!history.entries.length && (!history.storageStatus || (history.loaded && !storageFailed))} onClick={() => { void history.clear(); }}>{copy.clear}</button>
    </div>
  </details>;
}
