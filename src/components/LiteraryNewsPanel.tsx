import { useEffect, useId, useMemo, useState } from "react";

import { useInterfaceLanguage, type InterfaceLanguage } from "../i18n/InterfaceLanguage";
import { parseNewsFeed } from "../news/feed";
import { NEWS_CATEGORIES, NEWS_REGIONS, type NewsItem, type NewsRegion } from "../news/types";
import { applyPendingNews, initialNewsUpdatesState, receiveNewsFeed } from "../news/updates";
import { calendarDay, eventDateHint, formatNewsDate, getVisitorTimeZone, timeZoneLabel } from "../news/dates";
import BrandExternalLinkIcon from "./BrandExternalLinkIcon";
import "../styles/literary-news.css";
import "../styles/book-month-news-composition.css";

type NewsFilter = "all" | "today" | "upcoming";
type NewsTopic = "all" | NewsItem["category"];

const SAVED_NEWS_STORAGE_KEY = "probpera-literary-news-saved-v1";
const READ_NEWS_STORAGE_KEY = "probpera-literary-news-read-v1";

function readStoredNewsIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value) || value.length > 500 || value.some((id) => typeof id !== "string" || !id.trim() || id.length > 120)) return [];
    return [...new Set(value as string[])];
  } catch {
    return [];
  }
}

type Props = {
  endpoint?: string;
  variant?: "wide" | "sidebar";
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
    calendar: "Памятная дата",
    publication: "Публикация",
    reviewed: "Проверено",
    details: "Подробнее",
    feedDetails: "Источники и проверка",
    publicationUnknown: "Дата публикации не указана",
    editorialNote: "Проверенная подборка. Новые материалы проходят проверку.",
    showAll: "Все события",
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
    calendar: "Anniversary",
    publication: "Published",
    reviewed: "Reviewed",
    details: "Details",
    feedDetails: "Sources and review",
    publicationUnknown: "Publication date not provided",
    editorialNote: "A reviewed selection. New material is checked before publication.",
    showAll: "All events",
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

function searchable(value: string) {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/ё/g, "е");
}

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

export default function LiteraryNewsPanel({ endpoint = "/__literary-news/feed", variant = "wide" }: Props) {
  const { language } = useInterfaceLanguage();
  const text = copy[language];
  const sidebar = variant === "sidebar";
  const titleId = useId();
  const listId = useId();
  const [updates, setUpdates] = useState(initialNewsUpdatesState);
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
  const [savedOnly, setSavedOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [savedIds, setSavedIds] = useState(() => readStoredNewsIds(SAVED_NEWS_STORAGE_KEY));
  const [readIds, setReadIds] = useState(() => readStoredNewsIds(READ_NEWS_STORAGE_KEY));
  const [persistentSaved, setPersistentSaved] = useState(true);
  const [persistentRead, setPersistentRead] = useState(true);
  const [openStoryIds, setOpenStoryIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now);

  function displayDate(value: string, locale: InterfaceLanguage, withTime = false) {
    return formatNewsDate(value, locale, timeZone, withTime);
  }

  function showPendingNews() {
    setUpdates(applyPendingNews);
    document.getElementById(listId)?.focus({ preventScroll: true });
  }

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
    setSavedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [id, ...current].slice(0, 500));
  }

  function markRead(id: string) {
    setReadIds((current) => current.includes(id) ? current : [id, ...current].slice(0, 500));
  }

  function focusStoryFilter(id: string, filter: "saved" | "unread" = "unread") {
    const item = document.getElementById(`${listId}-item-${encodeURIComponent(id)}`);
    if (!item?.contains(document.activeElement)) return;
    window.requestAnimationFrame(() => document.getElementById(`${listId}-${filter}`)?.focus({ preventScroll: true }));
  }

  function toggleRead(id: string) {
    const wasRead = readIds.includes(id);
    setReadIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [id, ...current].slice(0, 500));
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
    setSavedOnly(false);
    setUnreadOnly(false);
    setExpanded(false);
    setOpenStoryIds([]);
    window.requestAnimationFrame(() => document.getElementById(listId)?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    setUpdates(initialNewsUpdatesState());
    setFailed(false);
  }, [endpoint]);

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
        const url = new URL(endpoint, window.location.href);
        url.searchParams.set("timeZone", timeZone);
        const response = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: activeController.signal,
        });
        if (!response.ok) throw new Error(`News feed returned ${response.status}`);
        const nextFeed = parseNewsFeed(await response.json());
        if (!disposed) {
          setUpdates((current) => receiveNewsFeed(current, nextFeed));
          setOpenStoryIds((current) => current.filter((id) => nextFeed.items.some((item) => item.id === id)));
          setFailed(false);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) setFailed(true);
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
  }, [endpoint, refreshVersion, timeZone]);

  const today = calendarDay(now, timeZone);
  const filteredItems = useMemo(() => {
    const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
    return (feed?.items ?? []).filter((item) =>
      (filter !== "today" || item.eventDate === today)
      && (filter !== "upcoming" || item.eventDate > today)
      && (topic === "all" || item.category === topic)
      && (region === "all" || (item.region ?? "global") === region)
      && (!terms.length || terms.every((term) => searchable(`${item.title.ru} ${item.title.en} ${item.summary.ru} ${item.summary.en} ${item.source.name}`).includes(term)))
      && (!savedOnly || savedIds.includes(item.id))
      && (!unreadOnly || !readIds.includes(item.id) || openStoryIds.includes(item.id))
    );
  }, [feed, filter, today, topic, region, query, savedOnly, savedIds, unreadOnly, readIds, openStoryIds]);
  const visibleItems = expanded ? filteredItems : filteredItems.slice(0, 3);
  const sourceErrors = feed?.sources.some((source) => source.status === "error") ?? false;
  const stale = Boolean(feed?.lastCheckedAt && now - Date.parse(feed.lastCheckedAt) > feed.refreshIntervalSeconds * 2_000);
  const warning = failed && feed ? text.failed : sourceErrors ? text.partial : stale ? text.stale : null;
  const loading = !feed && refreshing && !failed;
  const unavailable = !feed && failed;
  const emptyTitle = unavailable ? text.unavailableTitle : savedOnly && !savedIds.length ? text.savedEmptyTitle : query.trim() || region !== "all" ? text.noMatches : unreadOnly ? savedOnly || topic !== "all" || filter !== "all" ? text.unreadFilteredEmptyTitle : text.unreadEmptyTitle : savedOnly ? text.savedFilteredEmptyTitle : topic !== "all" ? text.topicEmptyTitle : filter === "today" ? text.todayEmptyTitle : filter === "upcoming" ? text.upcomingEmptyTitle : text.emptyTitle;
  const emptyDescription = unavailable ? text.unavailableDescription : savedOnly && !savedIds.length ? text.savedEmptyDescription : query.trim() || region !== "all" ? text.filteredEmptyDescription : unreadOnly ? text.unreadEmptyDescription : savedOnly || topic !== "all" ? text.filteredEmptyDescription : filter === "today" ? text.todayEmptyDescription : filter === "upcoming" ? text.upcomingEmptyDescription : text.emptyDescription;
  const hasActiveFilters = savedOnly || unreadOnly || topic !== "all" || region !== "all" || query.trim().length > 0 || filter !== "all";
  const regionCount = new Set((feed?.items ?? []).map((item) => item.region).filter((value) => value && value !== "global")).size;
  const expandButton = expanded || filteredItems.length > 3 ? (
    <button type="button" className="literary-news__expand" aria-expanded={expanded} aria-controls={listId} onClick={() => { if (expanded) setOpenStoryIds([]); setExpanded((value) => !value); }}>
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
      <summary>{text.sources} <span>{feed.sources.length}</span><small>{text.coverage}</small></summary>
      <ul>
        {feed.sources.map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}<BrandExternalLinkIcon /></a>
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
    <section id="literary-news" className={`literary-news${sidebar ? " literary-news--sidebar" : ""}${expanded ? " is-expanded" : ""}`} aria-labelledby={titleId} data-news-mode="local-prototype" data-time-zone={timeZone}>
      <header className="literary-news__header">
        <div>
          <p className="literary-news__eyebrow"><span aria-hidden="true" />{text.eyebrow}</p>
          <h2 id={titleId}>{text.title}</h2>
          <p className="literary-news__description">{text.description}</p>
        </div>
        <div className="literary-news__header-meta">
          <span className="literary-news__prototype">{text.prototype}</span>
          {!sidebar && <span className="literary-news__today">{displayDate(today, language)}</span>}
        </div>
      </header>

      <div className="literary-news__toolbar">
        <div className="literary-news__filters" role="group" aria-label={text.filters}>
          {(["all", "today", "upcoming"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              aria-controls={listId}
              onClick={() => { setFilter(value); setExpanded(false); setOpenStoryIds([]); }}
            >
              {text[value]}
            </button>
          ))}
        </div>
        <button type="button" className="literary-news__search-toggle" aria-label={text.search} title={text.search} aria-expanded={searchOpen} aria-controls={`${listId}-search`} onClick={() => { setSearchOpen((value) => !value); if (searchOpen) setQuery(""); else window.requestAnimationFrame(() => document.getElementById(`${listId}-search`)?.focus()); }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
        </button>
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

      {searchOpen && <div className="literary-news__search"><input id={`${listId}-search`} type="search" value={query} aria-label={text.search} placeholder={text.searchPlaceholder} maxLength={160} onChange={(event) => { setQuery(event.target.value); setExpanded(false); setOpenStoryIds([]); }} />{query && <button type="button" aria-label={text.clearSearch} onClick={() => { setQuery(""); document.getElementById(`${listId}-search`)?.focus(); }}>×</button>}</div>}

      <div className="literary-news__discovery">
        <label className="literary-news__topic">
          <span>{text.topic}</span>
          <select value={topic} onChange={(event) => { setTopic(event.target.value as NewsTopic); setExpanded(false); setOpenStoryIds([]); }}>
            <option value="all">{text.allTopics}</option>
            {NEWS_CATEGORIES.map((category) => <option key={category} value={category}>{categoryCopy[category][language]}</option>)}
          </select>
        </label>
        <label className="literary-news__topic literary-news__region">
          <span>{text.region}</span>
          <select value={region} onChange={(event) => { setRegion(event.target.value as NewsRegion | "all"); setExpanded(false); setOpenStoryIds([]); }}>
            <option value="all">{text.allRegions}</option>
            {NEWS_REGIONS.map((value) => <option key={value} value={value}>{regionCopy[value][language]}</option>)}
          </select>
        </label>
        <button id={`${listId}-saved`} type="button" className="literary-news__saved-filter" aria-pressed={savedOnly} title={persistentSaved ? text.savedInBrowser : text.savedForSession} onClick={() => { setSavedOnly((value) => !value); setExpanded(false); setOpenStoryIds([]); }}>
          <BookmarkIcon />{text.saved}{savedIds.length > 0 && <span>{savedIds.length}</span>}
        </button>
        <button id={`${listId}-unread`} type="button" className="literary-news__unread-filter" aria-pressed={unreadOnly} title={persistentRead ? text.readInBrowser : text.readForSession} onClick={() => { setUnreadOnly((value) => !value); setExpanded(false); setOpenStoryIds([]); }}>
          <span className="literary-news__unread-dot" aria-hidden="true" />{text.unread}
        </button>
      </div>
      {savedOnly && <p className="literary-news__saved-note" role="status">{persistentSaved ? text.savedInBrowser : text.savedForSession}</p>}
      {unreadOnly && !persistentRead && <p className="literary-news__saved-note" role="status">{text.readForSession}</p>}

      <div className={`literary-news__update-bar${pendingItems.length ? " has-arrivals" : ""}`}>
        <span className="literary-news__update-status" role="status" aria-atomic="true">
          {feed && <>{pendingItems.length ? text.newArrivals : hasActiveFilters ? text.matched : text.selection}: <strong>{pendingItems.length || (hasActiveFilters ? filteredItems.length : feed.items.length)}</strong></>}
        </span>
        {pendingItems.length > 0 && <button type="button" className="literary-news__apply-updates" onClick={showPendingNews} title={text.keepFilters} aria-controls={listId}>{text.applyUpdates}<span aria-hidden="true">↑</span></button>}
        {!pendingItems.length && regionCount > 0 && <span className="literary-news__coverage-note" title={text.regions}>{text.regions}: {regionCount}</span>}
      </div>

      <div className="literary-news__content" id={listId} tabIndex={-1} aria-busy={loading}>
        {loading ? (
          <p className="literary-news__loading" role="status">{text.loading}</p>
        ) : visibleItems.length ? (
          <ol className="literary-news__items">
            {visibleItems.map((item) => (
              <li id={`${listId}-item-${encodeURIComponent(item.id)}`} className="literary-news__item" key={item.id} data-news-read={readIds.includes(item.id)}>
                <article data-news-id={item.id} data-read={readIds.includes(item.id)} data-news-region={item.region ?? "global"}>
                  <div className="literary-news__item-meta">
                    <span className="literary-news__category">{categoryCopy[item.category][language]}{sidebar && item.kind === "announcement" && <span className="literary-news__inline-kind"> · {text.announcement}</span>}</span>
                    <time className="literary-news__event-date" dateTime={item.eventDate}>{displayDate(item.eventDate, language)}{eventDateHint(item.eventDate, today, language) && <span className="literary-news__date-hint">{eventDateHint(item.eventDate, today, language)}</span>}</time>
                    <div className="literary-news__item-actions">
                      <button type="button" className="literary-news__read-toggle" aria-pressed={readIds.includes(item.id)} aria-label={`${readIds.includes(item.id) ? text.markUnread : text.markRead}: ${item.title[language]}`} title={readIds.includes(item.id) ? text.markUnread : text.markRead} onClick={() => toggleRead(item.id)}><ReadIcon /></button>
                      <button type="button" className="literary-news__bookmark" aria-pressed={savedIds.includes(item.id)} aria-label={`${savedIds.includes(item.id) ? text.removeSaved : text.saveStory}: ${item.title[language]}`} title={savedIds.includes(item.id) ? text.removeSaved : text.saveStory} onClick={() => toggleSaved(item.id)}><BookmarkIcon /></button>
                    </div>
                  </div>
                  {!sidebar && item.kind !== "news" && (
                    <span className="literary-news__kind">{item.kind === "calendar" ? text.calendar : text.announcement}</span>
                  )}
                  {item.region && <span className="literary-news__item-region">{regionCopy[item.region][language]}</span>}
                  <h3>{sidebar ? <button type="button" className="literary-news__headline" aria-expanded={openStoryIds.includes(item.id)} aria-controls={`${listId}-story-${encodeURIComponent(item.id)}`} onClick={() => setStoryOpen(item.id, !openStoryIds.includes(item.id))}>{item.title[language]}</button> : item.title[language]}</h3>
                  {sidebar ? (
                    <details id={`${listId}-story-${encodeURIComponent(item.id)}`} className="literary-news__story-details" open={openStoryIds.includes(item.id)} onToggle={(event) => setStoryOpen(item.id, event.currentTarget.open)}>
                      <summary aria-label={`${text.details}: ${item.title[language]}`}>{text.details}</summary>
                      <p className="literary-news__summary">{item.summary[language]}</p>
                      <div className="literary-news__story-dates">
                        <span>{item.publishedAt ? <>{text.publication}: <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time></> : text.publicationUnknown}</span>
                        <span>{text.reviewed}: <time dateTime={item.verifiedAt}>{displayDate(item.verifiedAt, language)}</time></span>
                      </div>
                    </details>
                  ) : <p className="literary-news__summary">{item.summary[language]}</p>}
                  <footer className="literary-news__item-footer">
                    <a href={item.source.url} target="_blank" rel="noopener noreferrer" aria-label={`${text.source}: ${item.source.name}`} onClick={() => readFromSource(item.id)} onAuxClick={(event) => { if (event.button === 1) readFromSource(item.id); }}>
                      {item.source.name}<BrandExternalLinkIcon />
                    </a>
                    {!sidebar && item.publishedAt && (
                      <span>{text.publication}: <time dateTime={item.publishedAt}>{displayDate(item.publishedAt, language)}</time></span>
                    )}
                    {!sidebar && <span>{text.reviewed}: <time dateTime={item.verifiedAt}>{displayDate(item.verifiedAt, language)}</time></span>}
                  </footer>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="literary-news__empty" role="status">
            <p>{emptyTitle}</p>
            <span>{emptyDescription}</span>
            {!unavailable && hasActiveFilters && <button type="button" className="literary-news__clear-filters" onClick={clearFilters}>{text.clearFilters}</button>}
          </div>
        )}
      </div>

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
