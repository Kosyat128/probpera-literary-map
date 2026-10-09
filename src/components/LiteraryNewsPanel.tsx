import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import newsLimits from "../../data/news/contract.json";

import { useInterfaceLanguage, type InterfaceLanguage } from "../i18n/InterfaceLanguage";
import { readNewsFeedResponse } from "../news/transport";
import { NEWS_CATEGORIES, NEWS_REGIONS, type NewsFeed, type NewsItem, type NewsRegion } from "../news/types";
import { applyPendingNews, initialNewsUpdatesState, receiveNewsFeed } from "../news/updates";
import { beginNewsWithdrawalUpdate, readKnownNewsWithdrawals, saveKnownNewsWithdrawals } from "../news/withdrawals";
import { calendarDay, eventDateHint, formatNewsDate, getVisitorTimeZone, timeZoneLabel } from "../news/dates";
import { browseNewsItems, newsAnnouncementIsCurrent, newsSourceOrigin, paginateNewsItems, newsPageNumbers, newsPageForAnchor, type NewsSort } from "../news/browse";
import BrandExternalLinkIcon from "./BrandExternalLinkIcon";
import NewsArticleThumbnail from "./NewsArticleThumbnail";
import "../styles/literary-news.css";

type NewsFilter = "all" | "today" | "upcoming";
type NewsTopic = "all" | NewsItem["category"];

const SAVED_NEWS_STORAGE_KEY = "probpera-literary-news-saved-v1";
const READ_NEWS_STORAGE_KEY = "probpera-literary-news-read-v1";

function readStoredNewsIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value) || value.length > newsLimits.maxItems || value.some((id) => typeof id !== "string" || !id.trim() || id.length > 120)) return [];
    return [...new Set(value as string[])];
  } catch {
    return [];
  }
}

type Props = {
  endpoint?: string;
  variant?: "wide" | "sidebar";
  archive?: boolean;
};

const copy = {
  ru: {
    eyebrow: "Проба Пера · Новости",
    title: "Литературная повестка",
    description: "Новые книги, премии и события со всего мира.",
    prototype: "Локальный прототип",
    all: "Всё",
    today: "Сегодня",
    upcoming: "Скоро",
    filters: "Период литературных событий",
    topic: "Тема новостей",
    allTopics: "Все темы",
    region: "Регион событий",
    allRegions: "Весь мир",
    search: "Поиск в сводке",
    searchPlaceholder: "Книга, автор или событие…",
    clearSearch: "Очистить поиск",
    matched: "Найдено",
    noMatches: "Событий по этому запросу пока нет",
    regions: "Регионов в подборке",
    saved: "Избранное",
    unread: "Непрочитанные",
    markRead: "Отметить прочитанной",
    markUnread: "Отметить непрочитанной",
    readInBrowser: "Отметки прочитанного хранятся в этом браузере.",
    readForSession: "Отметки прочитанного доступны до закрытия страницы: хранилище браузера недоступно.",
    unreadEmptyTitle: "Непрочитанных новостей пока нет",
    unreadFilteredEmptyTitle: "Непрочитанных новостей с такими фильтрами нет",
    unreadEmptyDescription: "Можно изменить фильтры или вернуться ко всем новостям.",
    saveStory: "Сохранить новость",
    removeSaved: "Удалить из избранного",
    savedInBrowser: "Избранное хранится в этом браузере.",
    savedForSession: "Избранное доступно до закрытия страницы: хранилище браузера недоступно.",
    savedEmptyTitle: "Вы ещё не сохранили новости",
    savedEmptyDescription: "Нажмите на закладку у новости, чтобы вернуться к ней позже.",
    savedFilteredEmptyTitle: "В избранном нет новостей с такими фильтрами",
    topicEmptyTitle: "По этой теме за выбранный период событий пока нет",
    filteredEmptyDescription: "Попробуйте другую тему или посмотрите все новости.",
    clearFilters: "Показать все новости",
    refresh: "Обновить ленту",
    loading: "Загружаем литературные события…",
    checked: "Поиск новых публикаций",
    notChecked: "Поиск новых публикаций ещё не выполнен",
    timeZone: "Ваше время",
    selection: "В подборке",
    newArrivals: "Новых событий",
    applyUpdates: "Обновить список",
    keepFilters: "Применить новые поступления, сохранив выбранные фильтры",
    source: "Источник",
    sources: "Источники",
    sourceOk: "Доступен",
    sourcePending: "Доступность не проверена",
    sourceError: "Временно недоступен",
    announcement: "Анонс",
    endedAnnouncement: "Завершённый анонс",
    calendar: "Памятная дата",
    publication: "Публикация",
    reviewed: "Проверено",
    details: "Подробнее",
    feedDetails: "Источники и проверка",
    publicationUnknown: "Дата публикации не указана",
    editorialNote: "Проверенная подборка. Новые материалы проходят проверку.",
    showAll: "Все новости",
    collapse: "Свернуть",
    stale: "Поиск новых публикаций задерживается. Обратите внимание на даты событий.",
    partial: "Часть источников сейчас недоступна. Лента может быть неполной.",
    failed: "Лента временно не обновляется. Показаны последние полученные события.",
    unavailableTitle: "Не удалось получить ленту",
    unavailableDescription: "Попробуйте обновить её через несколько минут.",
    emptyTitle: "Подтверждённых событий пока нет",
    emptyDescription: "События появятся после проверки источников.",
    todayEmptyTitle: "Сегодня подтверждённых событий пока нет",
    todayEmptyDescription: "Последние события можно посмотреть во вкладке «Всё».",
    upcomingEmptyTitle: "Подтверждённых анонсов пока нет",
    upcomingEmptyDescription: "Здесь появятся события с известной будущей датой.",
    coverage: "Подборка из доступных источников",
    countries: "Страны источников",
    more: "Показать ещё",
    telegram: "Telegram-канал",
    sort: "Порядок новостей",
    newest: "Новые сначала",
    oldest: "Старые сначала",
    briefing: "По повестке",
    newestOption: "Новые",
    oldestOption: "Старые",
    briefingOption: "По повестке",
    sourceFilter: "Издание",
    allSources: "Все издания",
    publishedFrom: "Публикация с",
    publishedTo: "Публикация по",
    dateRangeInvalid: "Начальная дата должна быть не позже конечной.",
    unknownDates: "Фильтр по датам показывает материалы с известной датой публикации.",
    refine: "Издание, даты и порядок",
    reset: "Сбросить фильтры",
    pagination: "Страницы новостей",
    previousPage: "Назад",
    nextPage: "Далее",
    page: "Страница",
    of: "из",
    shown: "Показаны",
    publishedUnknownShort: "Дата публикации не указана",
    event: "Событие",
    retry: "Попробовать снова",
    archiveFallback: "Архив временно недоступен. Показана сохранённая подборка актуальных новостей; полный архив загрузится после обновления.",
    read: "Прочитано",
    focus: "В фокусе",
    readerDescription: "Книги, люди и события литературного мира.",
    refineShort: "Фильтры",
    scrollHint: "Листайте новости внутри блока",
    closeStory: "Свернуть текст",
  },
  en: {
    eyebrow: "Proba Pera · News",
    title: "The literary briefing",
    description: "New books, prizes and events from around the world.",
    prototype: "Local prototype",
    all: "All",
    today: "Today",
    upcoming: "Coming up",
    filters: "Literary event period",
    topic: "News topic",
    allTopics: "All topics",
    region: "Event region",
    allRegions: "Worldwide",
    search: "Search the digest",
    searchPlaceholder: "Book, author or event…",
    clearSearch: "Clear search",
    matched: "Matches",
    noMatches: "No events match this search yet",
    regions: "Regions in this selection",
    saved: "Saved",
    unread: "Unread",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    readInBrowser: "Read status is stored in this browser.",
    readForSession: "Read status is available until this page closes: browser storage is unavailable.",
    unreadEmptyTitle: "No unread stories yet",
    unreadFilteredEmptyTitle: "No unread stories match these filters",
    unreadEmptyDescription: "Change the filters or return to all stories.",
    saveStory: "Save story",
    removeSaved: "Remove saved story",
    savedInBrowser: "Saved stories are stored in this browser.",
    savedForSession: "Saved stories are available until this page closes: browser storage is unavailable.",
    savedEmptyTitle: "You have not saved any stories yet",
    savedEmptyDescription: "Select a story's bookmark to return to it later.",
    savedFilteredEmptyTitle: "No saved stories match these filters",
    topicEmptyTitle: "No events on this topic in the selected period yet",
    filteredEmptyDescription: "Try another topic or view all stories.",
    clearFilters: "Show all news",
    refresh: "Refresh news",
    loading: "Loading literary events…",
    checked: "New-publication check",
    notChecked: "New publications have not been checked yet",
    timeZone: "Your time",
    selection: "In this selection",
    newArrivals: "New arrivals",
    applyUpdates: "Update list",
    keepFilters: "Apply new arrivals and keep the selected filters",
    source: "Source",
    sources: "Sources",
    sourceOk: "Available",
    sourcePending: "Availability not checked",
    sourceError: "Temporarily unavailable",
    announcement: "Announcement",
    endedAnnouncement: "Past announcement",
    calendar: "Anniversary",
    publication: "Published",
    reviewed: "Reviewed",
    details: "Details",
    feedDetails: "Sources and review",
    publicationUnknown: "Publication date not provided",
    editorialNote: "A reviewed selection. New material is checked before publication.",
    showAll: "All news",
    collapse: "Show less",
    stale: "The new-publication check is delayed. Please check the event dates.",
    partial: "Some sources are unavailable. The selection may be incomplete.",
    failed: "Updates are temporarily unavailable. Showing the last received events.",
    unavailableTitle: "The news feed is unavailable",
    unavailableDescription: "Please try refreshing it in a few minutes.",
    emptyTitle: "No confirmed events yet",
    emptyDescription: "Events will appear after their sources have been checked.",
    todayEmptyTitle: "No confirmed events for today yet",
    todayEmptyDescription: "You can find the latest events in the All tab.",
    upcomingEmptyTitle: "No confirmed upcoming events yet",
    upcomingEmptyDescription: "Events with a confirmed future date will appear here.",
    coverage: "A selection from available sources",
    countries: "Source countries",
    more: "Show more",
    telegram: "Telegram channel",
    sort: "News order",
    newest: "Newest first",
    oldest: "Oldest first",
    briefing: "Briefing order",
    newestOption: "Newest",
    oldestOption: "Oldest",
    briefingOption: "Briefing",
    sourceFilter: "Publication",
    allSources: "All publications",
    publishedFrom: "Published from",
    publishedTo: "Published through",
    dateRangeInvalid: "The start date must not be after the end date.",
    unknownDates: "Date filters show stories with a known publication date.",
    refine: "Publication, dates and order",
    reset: "Reset filters",
    pagination: "News pages",
    previousPage: "Previous",
    nextPage: "Next",
    page: "Page",
    of: "of",
    shown: "Showing",
    publishedUnknownShort: "Publication date not provided",
    event: "Event",
    retry: "Try again",
    archiveFallback: "The archive is temporarily unavailable. Showing a saved selection of current news; the complete archive will return after an update.",
    read: "Read",
    focus: "In focus",
    readerDescription: "Books, people and events from the literary world.",
    refineShort: "Filters",
    scrollHint: "Scroll inside to read more",
    closeStory: "Show less",
  },
} satisfies Record<InterfaceLanguage, Record<string, string>>;

const categoryCopy: Record<NewsItem["category"], Record<InterfaceLanguage, string>> = {
  releases: { ru: "Новые книги", en: "New books" },
  awards: { ru: "Премии", en: "Prizes" },
  adaptations: { ru: "Экранизации", en: "Adaptations" },
  anniversaries: { ru: "Памятные даты", en: "Anniversaries" },
  festivals: { ru: "Фестивали", en: "Festivals" },
  heritage: { ru: "Литературное наследие", en: "Literary heritage" },
  discoveries: { ru: "Открытия", en: "Discoveries" },
  obituaries: { ru: "Памяти писателя", en: "In memoriam" },
  publishing: { ru: "Книжный мир", en: "Publishing" },
};

const regionCopy: Record<NewsRegion, Record<InterfaceLanguage, string>> = {
  global: { ru: "Международные", en: "International" },
  europe: { ru: "Европа", en: "Europe" },
  "north-america": { ru: "Северная Америка", en: "North America" },
  "latin-america": { ru: "Латинская Америка", en: "Latin America" },
  asia: { ru: "Азия", en: "Asia" },
  africa: { ru: "Африка", en: "Africa" },
  oceania: { ru: "Океания", en: "Oceania" },
};

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M19 9a7.5 7.5 0 1 0 .25 5M19 4v5h-5" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-4-6 4v-15a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ReadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12 2.25 2.25 4.75-4.75" />
    </svg>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
}

function newsExcerpt(value: string, limit: number) {
  if (value.length <= limit) return value;
  const boundary = value.lastIndexOf(" ", limit);
  return `${value.slice(0, boundary > limit / 2 ? boundary : limit).replace(/[.,;:!?]+$/u, "")}…`;
}

export default function LiteraryNewsPanel({ endpoint = "https://news.probpera.ru/api/literary-news/feed", variant = "wide", archive = false }: Props) {
  const { language } = useInterfaceLanguage();
  const text = copy[language];
  const sidebar = variant === "sidebar";
  const titleId = useId();
  const listId = useId();
  const [initialWithdrawals] = useState(readKnownNewsWithdrawals);
  const withdrawalHistory = useRef(initialWithdrawals);
  const [updates, setUpdates] = useState(() => initialNewsUpdatesState(initialWithdrawals.rows));
  const { feed, pendingItems } = updates;
  const [timeZone, setTimeZone] = useState(getVisitorTimeZone);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [topic, setTopic] = useState<NewsTopic>("all");
  const [region, setRegion] = useState<NewsRegion | "all">("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [source, setSource] = useState("");
  const [publishedFrom, setPublishedFrom] = useState("");
  const [publishedTo, setPublishedTo] = useState("");
  const [sort, setSort] = useState<NewsSort>(archive ? "newest" : "briefing");
  const [savedOnly, setSavedOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [savedIds, setSavedIds] = useState(() => readStoredNewsIds(SAVED_NEWS_STORAGE_KEY));
  const [readIds, setReadIds] = useState(() => readStoredNewsIds(READ_NEWS_STORAGE_KEY));
  const [persistentSaved, setPersistentSaved] = useState(true);
  const [persistentRead, setPersistentRead] = useState(true);
  const [openStoryIds, setOpenStoryIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const updateScrollAnchor = useRef<{ id: string; top: number } | null>(null);
  const [now, setNow] = useState(Date.now);

  function displayDate(value: string, locale: InterfaceLanguage, withTime = false) {
    return formatNewsDate(value, locale, timeZone, withTime);
  }

  function showPendingNews() {
    const list = document.getElementById(listId);
    const bounds = list?.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll<HTMLElement>(`[id="${listId}"] [data-news-id]`));
    const anchor = bounds ? cards.find((card) => card.getBoundingClientRect().bottom > Math.max(0, bounds.top) && card.getBoundingClientRect().top < Math.min(window.innerHeight, bounds.bottom)) : undefined;
    if (anchor) {
      updateScrollAnchor.current = { id: anchor.dataset.newsId!, top: anchor.getBoundingClientRect().top };
      const nextItems = selectFilteredItems(updates.latestFeed);
      if (nextItems.findIndex((item) => item.id === anchor.dataset.newsId) >= (archive ? 8 : 3)) setExpanded(true);
      setPage(newsPageForAnchor(nextItems, anchor.dataset.newsId!, page));
    }
    setUpdates(applyPendingNews);
    document.getElementById(listId)?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const anchor = updateScrollAnchor.current;
    if (!anchor) return;
    updateScrollAnchor.current = null;
    const card = document.getElementById(`${listId}-item-${encodeURIComponent(anchor.id)}`)?.querySelector("article");
    if (card) {
      const list = document.getElementById(listId);
      const delta = card.getBoundingClientRect().top - anchor.top;
      if (list && list.scrollHeight > list.clientHeight) list.scrollTop += delta;
      else window.scrollBy({ top: delta, behavior: "instant" });
    }
  }, [feed, listId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_NEWS_STORAGE_KEY, JSON.stringify(savedIds));
      setPersistentSaved(true);
    } catch {
      setPersistentSaved(false);
    }
  }, [savedIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(READ_NEWS_STORAGE_KEY, JSON.stringify(readIds));
      setPersistentRead(true);
    } catch {
      setPersistentRead(false);
    }
  }, [readIds]);

  function toggleSaved(id: string) {
    if (savedOnly && savedIds.includes(id)) focusStoryFilter(id, "saved");
    setSavedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [id, ...current].slice(0, newsLimits.maxItems));
  }

  function markRead(id: string) {
    setReadIds((current) => current.includes(id) ? current : [id, ...current].slice(0, newsLimits.maxItems));
  }

  function focusStoryFilter(id: string, filter: "saved" | "unread" = "unread") {
    const item = document.getElementById(`${listId}-item-${encodeURIComponent(id)}`);
    if (!item?.contains(document.activeElement)) return;
    window.requestAnimationFrame(() => document.getElementById(`${listId}-${filter}`)?.focus({ preventScroll: true }));
  }

  function toggleRead(id: string) {
    const wasRead = readIds.includes(id);
    setReadIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [id, ...current].slice(0, newsLimits.maxItems));
    if (!wasRead && unreadOnly && !openStoryIds.includes(id)) focusStoryFilter(id);
  }

  function readFromSource(id: string) {
    markRead(id);
    if (unreadOnly && !openStoryIds.includes(id)) focusStoryFilter(id);
  }

  function setStoryOpen(id: string, open: boolean) {
    if (open) markRead(id);
    else if (unreadOnly && readIds.includes(id) && openStoryIds.includes(id)) focusStoryFilter(id);
    setOpenStoryIds((current) => {
      if (current.includes(id) === open) return current;
      return open ? [...current, id] : current.filter((value) => value !== id);
    });
  }

  function clearFilters() {
    setFilter("all");
    setTopic("all");
    setRegion("all");
    setQuery("");
    setSource("");
    setPublishedFrom("");
    setPublishedTo("");
    setSavedOnly(false);
    setUnreadOnly(false);
    setExpanded(false);
    setOpenStoryIds([]);
    window.requestAnimationFrame(() => document.getElementById(listId)?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    setUpdates((current) => initialNewsUpdatesState(current.knownWithdrawals));
    setFailed(false);
  }, [endpoint, archive]);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      controller = new AbortController();
      const activeController = controller;
      const timeout = window.setTimeout(() => activeController.abort(), 20_000);
      setRefreshing(true);
      try {
        if (!beginNewsWithdrawalUpdate()) {
          withdrawalHistory.current = { ...withdrawalHistory.current, reliable: false };
          throw new Error("Withdrawal history is not writable");
        }
        const url = new URL(endpoint, window.location.href);
        url.searchParams.set("timeZone", timeZone);
        url.searchParams.set("contract", "2");
        if (archive) url.searchParams.set("view", "archive");
        const response = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: activeController.signal,
        });
        if (!response.ok) throw new Error(`News feed returned ${response.status}`);
        const nextFeed = await readNewsFeedResponse(response, { archive });
        if (!disposed) {
          withdrawalHistory.current = saveKnownNewsWithdrawals(nextFeed.withdrawals ?? [], withdrawalHistory.current);
          setUpdates((current) => receiveNewsFeed(current, nextFeed));
          setOpenStoryIds((current) => current.filter((id) => nextFeed.items.some((item) => item.id === id)));
          setFailed(false);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) {
          setFailed(true);
          // A stale release artifact is safe only with complete retained withdrawal history.
          // It keeps its capture time and can never be a social publication proof.
          try {
            // A failed request introduced no accepted new facts; checkpoint the retained history.
            withdrawalHistory.current = saveKnownNewsWithdrawals([], withdrawalHistory.current);
            if (!withdrawalHistory.current.reliable) throw new Error("Withdrawal history is incomplete");
            const fallback = await readNewsFeedResponse(await fetch(`${import.meta.env.BASE_URL}literary-news-snapshot.json`, {
              cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" },
            }));
            if (!disposed) {
              withdrawalHistory.current = saveKnownNewsWithdrawals(fallback.withdrawals ?? [], withdrawalHistory.current);
              if (!withdrawalHistory.current.reliable) throw new Error("Withdrawal history is incomplete");
              setUpdates((current) => current.feed ? current : receiveNewsFeed(current,
                { ...fallback, fallbackCapturedAt: fallback.generatedAt }));
            }
          } catch { /* Keep the honest unavailable state. */ }
        }
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        if (!disposed) setRefreshing(false);
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setNow(Date.now());
      setTimeZone(getVisitorTimeZone());
      void refresh();
    }, 60_000);
    function onVisibilityChange() {
      if (!document.hidden) {
        setNow(Date.now());
        setTimeZone(getVisitorTimeZone());
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [endpoint, refreshVersion, timeZone, archive]);

  const today = calendarDay(now, timeZone);
  useEffect(() => { setPage(1); document.getElementById(listId)?.scrollTo({ top: 0, behavior: "instant" }); }, [query, filter, topic, region, source, publishedFrom, publishedTo, sort, savedOnly, unreadOnly, listId]);
  function selectFilteredItems(candidate: NewsFeed | null) {
    return browseNewsItems(candidate?.items ?? [], { period: filter, topic, region, query, source, publishedFrom, publishedTo, sort }, today, timeZone,
      { archive: archive && candidate?.snapshot?.policy === "reviewed-v2-archive-explicit-withdrawals" }).filter((item) =>
      (!savedOnly || savedIds.includes(item.id))
      && (!unreadOnly || !readIds.includes(item.id) || openStoryIds.includes(item.id))
    );
  }
  const filteredItems = useMemo(() => selectFilteredItems(feed), [feed, filter, today, timeZone, topic, region, query, source, publishedFrom, publishedTo, sort, savedOnly, savedIds, unreadOnly, readIds, openStoryIds, archive]);
  const pagination = paginateNewsItems(filteredItems, page);
  const initialLimit = archive ? 8 : 3;
  const visibleItems = expanded ? pagination.items : filteredItems.slice(0, initialLimit);
  function changePage(nextPage: number) {
    setPage(nextPage);
    window.requestAnimationFrame(() => {
      const list = document.getElementById(listId);
      list?.focus({ preventScroll: true });
      list?.scrollTo({ top: 0, behavior: "instant" });
      if (list && list.getBoundingClientRect().bottom < 0) list.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  const publicationSources = useMemo(() => {
    const byOrigin = new Map<string, string>();
    for (const item of feed?.items ?? []) {
      const origin = newsSourceOrigin(item);
      if (!byOrigin.has(origin)) byOrigin.set(origin, item.source.name);
    }
    return [...byOrigin].sort((left, right) => left[1].localeCompare(right[1], language));
  }, [feed, language]);
  const dateRangeInvalid = Boolean(publishedFrom && publishedTo && publishedFrom > publishedTo);
  const sourceCountries = new Set(feed?.sources.flatMap((source) => source.countryCodes ?? []) ?? []);
  const countryNames = new Intl.DisplayNames([language], { type: "region" });
  const sourceErrors = feed?.sources.some((source) => source.status === "error") ?? false;
  const stale = Boolean(feed?.lastCheckedAt && now - Date.parse(feed.lastCheckedAt) > feed.refreshIntervalSeconds * 2_000);
  const warning = failed && feed ? `${archive && feed.fallbackCapturedAt ? text.archiveFallback : text.failed}${feed.fallbackCapturedAt
    ? ` ${language === "ru" ? "Снимок от" : "Snapshot from"} ${displayDate(feed.fallbackCapturedAt, language, true)}.` : ""}`
    : sourceErrors ? text.partial : stale ? text.stale : null;
  const loading = !feed && refreshing && !failed;
  const unavailable = !feed && failed;
  const emptyTitle = unavailable ? text.unavailableTitle : savedOnly && !savedIds.length ? text.savedEmptyTitle : query.trim() || region !== "all" ? text.noMatches : unreadOnly ? savedOnly || topic !== "all" || filter !== "all" ? text.unreadFilteredEmptyTitle : text.unreadEmptyTitle : savedOnly ? text.savedFilteredEmptyTitle : topic !== "all" ? text.topicEmptyTitle : filter === "today" ? text.todayEmptyTitle : filter === "upcoming" ? text.upcomingEmptyTitle : text.emptyTitle;
  const emptyDescription = unavailable ? text.unavailableDescription : savedOnly && !savedIds.length ? text.savedEmptyDescription : query.trim() || region !== "all" ? text.filteredEmptyDescription : unreadOnly ? text.unreadEmptyDescription : savedOnly || topic !== "all" ? text.filteredEmptyDescription : filter === "today" ? text.todayEmptyDescription : filter === "upcoming" ? text.upcomingEmptyDescription : text.emptyDescription;
  const hasActiveFilters = savedOnly || unreadOnly || topic !== "all" || region !== "all" || query.trim().length > 0 || filter !== "all" || Boolean(source || publishedFrom || publishedTo);
  const regionCount = new Set((feed?.items ?? []).map((item) => item.region).filter((value) => value && value !== "global")).size;
  const expandButton = expanded || filteredItems.length > initialLimit ? (
    <button type="button" className="literary-news__expand" aria-expanded={expanded} aria-controls={listId} onClick={() => { if (expanded) setOpenStoryIds([]); setPage(1); setExpanded((value) => !value); document.getElementById(listId)?.scrollTo({ top: 0, behavior: "instant" }); }}>
      {expanded ? text.collapse : `${text.showAll} (${filteredItems.length})`}<span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
    </button>
  ) : null;
  const freshness = (
    <div className="literary-news__freshness">
      <span>
        {feed?.lastCheckedAt ? <>{text.checked} <time dateTime={feed.lastCheckedAt}>{displayDate(feed.lastCheckedAt, language, true)}</time></> : text.notChecked}
      </span>
      <span className="literary-news__time-zone" title={timeZone}>{text.timeZone}: {timeZoneLabel(now, language, timeZone)}</span>
    </div>
  );
  const sourceDetails = feed && feed.sources.length > 0 ? (
    <details className="literary-news__sources">
      <summary>{text.sources} <span>{feed.sources.length}</span><small>{text.coverage}{sourceCountries.size > 0 && <> · {text.countries}: {sourceCountries.size}</>}</small></summary>
      <ul>
        {feed.sources.map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}<BrandExternalLinkIcon /></a>
            {!!source.countryCodes?.length && <small>{source.countryCodes.map((code) => countryNames.of(code) ?? code).join(", ")}</small>}
            <span className={`literary-news__source-status literary-news__source-status--${source.status}`}>
              {source.status === "ok" ? text.sourceOk : source.status === "error" ? text.sourceError : text.sourcePending}
              {source.lastSuccessAt && <> · <time dateTime={source.lastSuccessAt}>{displayDate(source.lastSuccessAt, language, true)}</time></>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  ) : null;

  return (
    <section id="literary-news" className={`literary-news${sidebar ? " literary-news--sidebar" : ""}${archive ? " literary-news--reader" : ""}${expanded ? " is-expanded" : ""}`} aria-labelledby={titleId} data-news-mode={feed?.mode} data-time-zone={timeZone}>
      <header className="literary-news__header">
        <div>
          <p className="literary-news__eyebrow"><span aria-hidden="true" />{text.eyebrow}</p>
          <h2 id={titleId}>{text.title}</h2>
          <p className="literary-news__description">{archive ? text.readerDescription : text.description}</p>
        </div>
        <div className="literary-news__header-meta">
          {feed?.mode === "local-prototype" && <span className="literary-news__prototype">{text.prototype}</span>}
          {(!sidebar || archive) && <span className="literary-news__today">{displayDate(today, language)}</span>}
        </div>
      </header>


      {archive && <div className="literary-news__reader-search literary-news__search">
        <SearchIcon />
        <input id={`${listId}-search`} type="search" value={query} aria-label={text.search} placeholder={text.searchPlaceholder} maxLength={160} onChange={(event) => { setQuery(event.target.value); setOpenStoryIds([]); }} />
        {query && <button type="button" aria-label={text.clearSearch} onClick={() => { setQuery(""); document.getElementById(`${listId}-search`)?.focus(); }}>×</button>}
      </div>}
      <div className="literary-news__toolbar">
        <div className="literary-news__filters" role="group" aria-label={text.filters}>
          {(["all", "today", "upcoming"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              aria-controls={listId}
              onClick={() => { setFilter(value); setOpenStoryIds([]); }}
            >
              {text[value]}
            </button>
          ))}
        </div>
        {!archive && <button type="button" className="literary-news__search-toggle" aria-label={text.search} title={text.search} aria-expanded={searchOpen} aria-controls={`${listId}-search`} onClick={() => { setSearchOpen((value) => !value); if (searchOpen) setQuery(""); else window.requestAnimationFrame(() => document.getElementById(`${listId}-search`)?.focus()); }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
        </button>}
        <button
          type="button"
          className="literary-news__refresh"
          aria-label={text.refresh}
          title={text.refresh}
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={() => setRefreshVersion((version) => version + 1)}
        >
          <RefreshIcon />
        </button>
      </div>

      {!archive && searchOpen && <div className="literary-news__search"><input id={`${listId}-search`} type="search" value={query} aria-label={text.search} placeholder={text.searchPlaceholder} maxLength={160} onChange={(event) => { setQuery(event.target.value); setOpenStoryIds([]); }} />{query && <button type="button" aria-label={text.clearSearch} onClick={() => { setQuery(""); document.getElementById(`${listId}-search`)?.focus(); }}>×</button>}</div>}

      {!archive && <div className="literary-news__discovery">
        <label className="literary-news__topic">
          <span>{text.topic}</span>
          <select aria-label={text.topic} value={topic} onChange={(event) => { setTopic(event.target.value as NewsTopic); setOpenStoryIds([]); }}>
            <option value="all">{text.allTopics}</option>
            {NEWS_CATEGORIES.map((category) => <option key={category} value={category}>{categoryCopy[category][language]}</option>)}
          </select>
        </label>
        <label className="literary-news__topic literary-news__region">
          <span>{text.region}</span>
          <select aria-label={text.region} value={region} onChange={(event) => { setRegion(event.target.value as NewsRegion | "all"); setOpenStoryIds([]); }}>
            <option value="all">{text.allRegions}</option>
            {NEWS_REGIONS.map((value) => <option key={value} value={value}>{regionCopy[value][language]}</option>)}
          </select>
        </label>
        <button id={`${listId}-saved`} type="button" className="literary-news__saved-filter" aria-pressed={savedOnly} title={persistentSaved ? text.savedInBrowser : text.savedForSession} onClick={() => { setSavedOnly((value) => !value); setOpenStoryIds([]); }}>
          <BookmarkIcon />{text.saved}{savedIds.length > 0 && <span>{savedIds.length}</span>}
        </button>
        <button id={`${listId}-unread`} type="button" className="literary-news__unread-filter" aria-pressed={unreadOnly} title={persistentRead ? text.readInBrowser : text.readForSession} onClick={() => { setUnreadOnly((value) => !value); setOpenStoryIds([]); }}>
          <span className="literary-news__unread-dot" aria-hidden="true" />{text.unread}
        </button>
      </div>}
      {archive && <>
        <div className="literary-news__topic-chips" role="group" aria-label={text.topic}>
          {(["all", "releases", "awards", "festivals"] as const).map((value) => <button type="button" key={value} aria-pressed={topic === value} onClick={() => { setTopic(value); setOpenStoryIds([]); }}>{value === "all" ? text.allTopics : categoryCopy[value][language]}</button>)}
        </div>
        <div className="literary-news__reader-tools">
        <button id={`${listId}-saved`} type="button" className="literary-news__saved-filter" aria-pressed={savedOnly} title={persistentSaved ? text.savedInBrowser : text.savedForSession} onClick={() => { setSavedOnly((value) => !value); setOpenStoryIds([]); }}>
          <BookmarkIcon />{text.saved}{savedIds.length > 0 && <span>{savedIds.length}</span>}
        </button>
        <button id={`${listId}-unread`} type="button" className="literary-news__unread-filter" aria-pressed={unreadOnly} title={persistentRead ? text.readInBrowser : text.readForSession} onClick={() => { setUnreadOnly((value) => !value); setOpenStoryIds([]); }}>
          <span className="literary-news__unread-dot" aria-hidden="true" />{text.unread}
        </button>
          <button type="button" className="literary-news__refine-toggle" aria-expanded={advancedOpen} aria-controls={`${listId}-advanced`} onClick={() => setAdvancedOpen(value => !value)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 17h16M9 4v6M15 14v6" /></svg>{text.refineShort}{(region !== "all" || source || publishedFrom || publishedTo) && <span className="literary-news__filter-indicator" />}</button>
        </div>
      </>}
      {archive && <div className="literary-news__advanced" id={`${listId}-advanced`} hidden={!advancedOpen}>
        <div className="literary-news__archive-filters">
        <label className="literary-news__topic">
          <span>{text.topic}</span>
          <select aria-label={text.topic} value={topic} onChange={(event) => { setTopic(event.target.value as NewsTopic); setOpenStoryIds([]); }}>
            <option value="all">{text.allTopics}</option>
            {NEWS_CATEGORIES.map((category) => <option key={category} value={category}>{categoryCopy[category][language]}</option>)}
          </select>
        </label>
        <label className="literary-news__topic literary-news__region">
          <span>{text.region}</span>
          <select aria-label={text.region} value={region} onChange={(event) => { setRegion(event.target.value as NewsRegion | "all"); setOpenStoryIds([]); }}>
            <option value="all">{text.allRegions}</option>
            {NEWS_REGIONS.map((value) => <option key={value} value={value}>{regionCopy[value][language]}</option>)}
          </select>
        </label>

        <label className="literary-news__topic">
          <span>{text.sourceFilter}</span>
          <select aria-label={text.sourceFilter} value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">{text.allSources}</option>
            {publicationSources.map(([origin, name]) => <option key={origin} value={origin}>{name} · {new URL(origin).hostname}</option>)}
          </select>
        </label>
        <label className="literary-news__topic">
          <span>{text.sort}</span>
          <select aria-label={text.sort} value={sort} onChange={(event) => setSort(event.target.value as NewsSort)}>
            {(["newest", "oldest", "briefing"] as const).map((value) => <option key={value} value={value}>{text[`${value}Option`]}</option>)}
          </select>
        </label>
        <label className="literary-news__topic">
          <span>{text.publishedFrom}</span>
          <input type="date" aria-label={text.publishedFrom} value={publishedFrom} onChange={(event) => setPublishedFrom(event.target.value)} aria-invalid={dateRangeInvalid} aria-describedby={`${listId}-date-note`} />
        </label>
        <label className="literary-news__topic">
          <span>{text.publishedTo}</span>
          <input type="date" aria-label={text.publishedTo} value={publishedTo} onChange={(event) => setPublishedTo(event.target.value)} aria-invalid={dateRangeInvalid} aria-describedby={`${listId}-date-note`} />
        </label>
        </div>
        <p id={`${listId}-date-note`} className="literary-news__saved-note" role={dateRangeInvalid ? "status" : undefined}>{dateRangeInvalid ? text.dateRangeInvalid : text.unknownDates}</p>
      </div>}
      {savedOnly && <p className="literary-news__saved-note" role="status">{persistentSaved ? text.savedInBrowser : text.savedForSession}</p>}
      {unreadOnly && !persistentRead && <p className="literary-news__saved-note" role="status">{text.readForSession}</p>}

      <div className={`literary-news__update-bar${pendingItems.length ? " has-arrivals" : ""}`}>
        <span className="literary-news__update-status" role="status" aria-atomic="true">
          {feed && <>{pendingItems.length ? text.newArrivals : hasActiveFilters ? text.matched : text.selection}: <strong>{pendingItems.length || (hasActiveFilters ? filteredItems.length : feed.items.length)}</strong></>}
        </span>
        {pendingItems.length > 0 && <button type="button" className="literary-news__apply-updates" onClick={showPendingNews} title={text.keepFilters} aria-controls={listId}>{text.applyUpdates}<span aria-hidden="true">↑</span></button>}
        {!pendingItems.length && archive ? <span className="literary-news__coverage-note" title={text.sort}>{text[sort]}</span> : !pendingItems.length && regionCount > 0 && <span className="literary-news__coverage-note" title={text.regions}>{text.regions}: {regionCount}</span>}
        {archive && hasActiveFilters && <button type="button" className="literary-news__clear-filters" onClick={clearFilters}>{text.reset}</button>}
      </div>

      <div className="literary-news__content" id={listId} tabIndex={-1} aria-busy={loading}>
        {loading ? (
          <p className="literary-news__loading" role="status">{text.loading}</p>
        ) : visibleItems.length ? (
          <ol className="literary-news__items" start={expanded ? pagination.start : undefined}>
            {visibleItems.map((item, index) => (
              <li id={`${listId}-item-${encodeURIComponent(item.id)}`} className={`literary-news__item${archive && index === 0 ? " literary-news__item--lead" : ""}`} key={item.id} data-news-read={readIds.includes(item.id)}>
                {archive ? <article data-news-id={item.id} data-read={readIds.includes(item.id)} data-news-region={item.region ?? "global"}>
                  <div className="literary-news__reader-meta">
                    <span className="literary-news__category">{index === 0 && <span className="literary-news__focus">{text.focus} · </span>}{categoryCopy[item.category][language]}</span>
                    <span className="literary-news__event-date" title={item.kind === "news" ? text.publication : text.event}>{item.kind === "news" ? item.publishedAt ? <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time> : text.publishedUnknownShort : <time dateTime={item.eventDate}>{displayDate(item.eventDate, language)}{eventDateHint(item.eventDate, today, language) && <span className="literary-news__date-hint">{eventDateHint(item.eventDate, today, language)}</span>}</time>}</span>
                  </div>
                  {item.kind !== "news" && <span className={`literary-news__reader-kind${item.kind === "announcement" && !newsAnnouncementIsCurrent(item, today, timeZone) ? " literary-news__inline-kind--past" : ""}`}>{item.kind === "calendar" ? text.calendar : !newsAnnouncementIsCurrent(item, today, timeZone) ? text.endedAnnouncement : text.announcement}</span>}
                  <div className="literary-news__story-heading">
                    <h3><button type="button" className="literary-news__headline" aria-expanded={openStoryIds.includes(item.id)} aria-controls={`${listId}-story-${encodeURIComponent(item.id)}`} onClick={() => setStoryOpen(item.id, !openStoryIds.includes(item.id))}>{item.title[language]}</button></h3>
                    <NewsArticleThumbnail item={item} language={language} onRead={() => readFromSource(item.id)} />
                  </div>
                  <p className="literary-news__summary">{openStoryIds.includes(item.id) ? item.summary[language] : newsExcerpt(item.summary[language], index === 0 ? 210 : 145)}</p>
                  <div id={`${listId}-story-${encodeURIComponent(item.id)}`} className="literary-news__reader-details" hidden={!openStoryIds.includes(item.id)}>
                    <div className="literary-news__story-dates">
                      <span>{item.publishedAt ? <>{text.publication}: <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time></> : text.publicationUnknown}</span>
                      {(item.kind !== "news" || item.eventDate !== item.publishedAt?.slice(0, 10)) && <span>{text.event}: <time dateTime={item.eventDate}>{displayDate(item.eventDate, language)}</time></span>}
                      <span>{text.reviewed}: <time dateTime={item.verifiedAt}>{displayDate(item.verifiedAt, language)}</time></span>
                    </div>
                  </div>
                  <footer className="literary-news__item-footer">
                    <div className="literary-news__byline"><a href={item.source.url} target="_blank" rel="noopener noreferrer" aria-label={`${text.source}: ${item.source.name}`} onClick={() => readFromSource(item.id)} onAuxClick={(event) => { if (event.button === 1) readFromSource(item.id); }}>{item.source.name}<BrandExternalLinkIcon /></a>{item.region && <span>{regionCopy[item.region][language]}</span>}</div>
                    <div className="literary-news__reader-actions">
                      <button type="button" className="literary-news__reader-more" aria-expanded={openStoryIds.includes(item.id)} aria-controls={`${listId}-story-${encodeURIComponent(item.id)}`} aria-label={`${openStoryIds.includes(item.id) ? text.closeStory : text.details}: ${item.title[language]}`} onClick={() => setStoryOpen(item.id, !openStoryIds.includes(item.id))}>{openStoryIds.includes(item.id) ? text.closeStory : text.details}<span aria-hidden="true">{openStoryIds.includes(item.id) ? "−" : "+"}</span></button>
                      <span className="literary-news__read-state">{readIds.includes(item.id) ? text.read : ""}</span>
                      <button type="button" className="literary-news__read-toggle" aria-pressed={readIds.includes(item.id)} aria-label={`${readIds.includes(item.id) ? text.markUnread : text.markRead}: ${item.title[language]}`} title={readIds.includes(item.id) ? text.markUnread : text.markRead} onClick={() => toggleRead(item.id)}><ReadIcon /></button>
                      <button type="button" className="literary-news__bookmark" aria-pressed={savedIds.includes(item.id)} aria-label={`${savedIds.includes(item.id) ? text.removeSaved : text.saveStory}: ${item.title[language]}`} title={savedIds.includes(item.id) ? text.removeSaved : text.saveStory} onClick={() => toggleSaved(item.id)}><BookmarkIcon /></button>
                    </div>
                  </footer>
                </article> : (
                <article data-news-id={item.id} data-read={readIds.includes(item.id)} data-news-region={item.region ?? "global"}>
                  <div className="literary-news__item-meta">
                    <span className="literary-news__category">{categoryCopy[item.category][language]}{sidebar && item.kind === "announcement" && <span className={`literary-news__inline-kind${!newsAnnouncementIsCurrent(item, today, timeZone) ? " literary-news__inline-kind--past" : ""}`}> · {!newsAnnouncementIsCurrent(item, today, timeZone) ? text.endedAnnouncement : text.announcement}</span>}</span>
                    <span className="literary-news__event-date" title={archive && item.kind === "news" ? text.publication : text.event}>{archive && item.kind === "news" ? item.publishedAt ? <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time> : text.publishedUnknownShort : <time dateTime={item.eventDate}>{displayDate(item.eventDate, language)}{eventDateHint(item.eventDate, today, language) && <span className="literary-news__date-hint">{eventDateHint(item.eventDate, today, language)}</span>}</time>}</span>
                    <div className="literary-news__item-actions">
                      <button type="button" className="literary-news__read-toggle" aria-pressed={readIds.includes(item.id)} aria-label={`${readIds.includes(item.id) ? text.markUnread : text.markRead}: ${item.title[language]}`} title={readIds.includes(item.id) ? text.markUnread : text.markRead} onClick={() => toggleRead(item.id)}><ReadIcon /></button>
                      <button type="button" className="literary-news__bookmark" aria-pressed={savedIds.includes(item.id)} aria-label={`${savedIds.includes(item.id) ? text.removeSaved : text.saveStory}: ${item.title[language]}`} title={savedIds.includes(item.id) ? text.removeSaved : text.saveStory} onClick={() => toggleSaved(item.id)}><BookmarkIcon /></button>
                    </div>
                  </div>
                  {!sidebar && item.kind !== "news" && (
                    <span className={`literary-news__kind${item.kind === "announcement" && !newsAnnouncementIsCurrent(item, today, timeZone) ? " literary-news__kind--past" : ""}`}>{item.kind === "calendar" ? text.calendar : !newsAnnouncementIsCurrent(item, today, timeZone) ? text.endedAnnouncement : text.announcement}</span>
                  )}
                  {item.region && <span className="literary-news__item-region">{regionCopy[item.region][language]}</span>}
                  <div className="literary-news__story-heading">
                    <h3>{sidebar ? <button type="button" className="literary-news__headline" aria-expanded={openStoryIds.includes(item.id)} aria-controls={`${listId}-story-${encodeURIComponent(item.id)}`} onClick={() => setStoryOpen(item.id, !openStoryIds.includes(item.id))}>{item.title[language]}</button> : archive ? <a href={item.source.url} target="_blank" rel="noopener noreferrer" onClick={() => readFromSource(item.id)} onAuxClick={(event) => { if (event.button === 1) readFromSource(item.id); }}>{item.title[language]}</a> : item.title[language]}</h3>
                    <NewsArticleThumbnail item={item} language={language} onRead={() => readFromSource(item.id)} />
                  </div>
                  {sidebar ? (
                    <details id={`${listId}-story-${encodeURIComponent(item.id)}`} className="literary-news__story-details" open={openStoryIds.includes(item.id)} onToggle={(event) => setStoryOpen(item.id, event.currentTarget.open)}>
                      <summary aria-label={`${text.details}: ${item.title[language]}`}>{text.details}</summary>
                      <p className="literary-news__summary">{item.summary[language]}</p>
                      <div className="literary-news__story-dates">
                        <span>{item.publishedAt ? <>{text.publication}: <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time></> : text.publicationUnknown}</span>
                        {archive && (item.kind !== "news" || item.eventDate !== item.publishedAt?.slice(0, 10)) && <span>{text.event}: <time dateTime={item.eventDate}>{displayDate(item.eventDate, language)}</time></span>}
                        <span>{text.reviewed}: <time dateTime={item.verifiedAt}>{displayDate(item.verifiedAt, language)}</time></span>
                      </div>
                    </details>
                  ) : <p className="literary-news__summary">{item.summary[language]}</p>}
                  <footer className="literary-news__item-footer">
                    <a href={item.source.url} target="_blank" rel="noopener noreferrer" aria-label={`${text.source}: ${item.source.name}`} onClick={() => readFromSource(item.id)} onAuxClick={(event) => { if (event.button === 1) readFromSource(item.id); }}>
                      {item.source.name}<BrandExternalLinkIcon />
                    </a>
                    {!sidebar && !archive && item.publishedAt && (
                      <span>{text.publication}: <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time></span>
                    )}
                    {archive && !sidebar && (item.kind !== "news" || item.eventDate !== item.publishedAt?.slice(0, 10)) && <span>{text.event}: <time dateTime={item.eventDate}>{displayDate(item.eventDate, language)}</time></span>}
                    {!sidebar && <span>{text.reviewed}: <time dateTime={item.verifiedAt}>{displayDate(item.verifiedAt, language)}</time></span>}
                  </footer>
                </article>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="literary-news__empty" role="status">
            <p>{emptyTitle}</p>
            <span>{emptyDescription}</span>
            {!unavailable && hasActiveFilters && <button type="button" className="literary-news__clear-filters" onClick={clearFilters}>{text.clearFilters}</button>}
            {unavailable && <button type="button" className="literary-news__clear-filters" disabled={refreshing} onClick={() => setRefreshVersion((version) => version + 1)}>{text.retry}</button>}
          </div>
        )}
      </div>

      {archive && filteredItems.length > 0 && <p className="literary-news__result-range"><span>{text.scrollHint}<span aria-hidden="true"> ↓</span></span><span>{text.shown} {expanded ? pagination.start : 1}-{expanded ? pagination.end : visibleItems.length} {text.of} {filteredItems.length}</span></p>}
      {expanded && pagination.totalPages > 1 && <nav className="literary-news__pagination" aria-label={text.pagination}>
        <button type="button" disabled={pagination.page === 1} onClick={() => changePage(pagination.page - 1)}><span aria-hidden="true">←</span>{text.previousPage}</button>
        <div>{newsPageNumbers(pagination.page, pagination.totalPages).map((value, index) => value === null ? <span className="literary-news__pagination-gap" key={`gap-${index}`} aria-hidden="true">…</span> : <button type="button" key={value} aria-label={`${text.page} ${value}`} aria-current={value === pagination.page ? "page" : undefined} onClick={() => changePage(value)}>{value}</button>)}</div>
        <button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => changePage(pagination.page + 1)}>{text.nextPage}<span aria-hidden="true">→</span></button>
        <span className="literary-news__pagination-note">{text.page} {pagination.page} {text.of} {pagination.totalPages} · 25 {language === "ru" ? "новостей на странице" : "stories per page"}</span>
      </nav>}
      <nav className="literary-news__channel-links" aria-label={text.eyebrow}>
        <a href="https://t.me/probbaperra" target="_blank" rel="noopener noreferrer">{text.telegram}<BrandExternalLinkIcon /></a>
      </nav>

      {sidebar ? (
        <footer className="literary-news__sidebar-footer">
          <details className="literary-news__feed-details">
            <summary>{text.feedDetails}</summary>
            {warning && <p className="literary-news__warning" role="status">{warning}</p>}
            <p className="literary-news__editorial-note">{text.editorialNote}</p>
            {freshness}
            {sourceDetails}
          </details>
          {expandButton}
        </footer>
      ) : <>
        <footer className="literary-news__footer">{freshness}{expandButton}</footer>
        <details className="literary-news__feed-details literary-news__feed-details--wide">
          <summary>{text.feedDetails}</summary>
          {warning && <p className="literary-news__warning" role="status">{warning}</p>}
          <p className="literary-news__editorial-note">{text.editorialNote}</p>
          {sourceDetails}
        </details>
      </>}
    </section>
  );
}
