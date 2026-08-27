import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { createPortal } from "react-dom";

import ArticleEngagement from "../community/ArticleEngagement";
import {
  bookArchiveKey,
  coverArtworkSrcSet,
  isEditorialCover,
  isCoverArtworkDisplayAllowed,
  resolveBookArchivePublicTarget,
  type BookArchiveEntry,
} from "../data/bookArchive";
import {
  classifyBookArchiveQueue,
  presentBookArchiveEntry,
  presentBookArchiveQueueItem,
  type BookArchiveQueueItem,
} from "../data/bookArchiveQueue";
import {
  selectBookMetadataLabels,
  selectBookOriginalLanguage,
  selectBookWriterName,
} from "../data/bookLocalization";
import {
  getBookArticleMentions,
  getBookMentionIndex,
  type BookArticleMention,
  type BookMentionIndex,
} from "../data/articles/bookMentions";
import { articleCatalog } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import type { Country } from "../data/countries";
import {
  applyBookArchiveQuickPreset,
  BOOK_ARCHIVE_AUDIENCES,
  BOOK_ARCHIVE_ARTICLE_RELATIONS,
  BOOK_ARCHIVE_COVER_MODES,
  BOOK_ARCHIVE_GENRES,
  BOOK_ARCHIVE_LANGUAGES,
  BOOK_ARCHIVE_PERIODS,
  BOOK_ARCHIVE_SORTS,
  buildBookArchiveFacetIndex,
  filterBookArchiveFacetIndex,
  normalizeBookArchiveFilterState,
  type BookArchiveArticleRelation,
  type BookArchiveCoverMode,
  type BookArchiveFilterState,
  type BookArchiveGenreId,
  type BookArchivePeriod,
  type BookArchiveQuickPreset,
  type BookArchiveSort,
  type WorkAudienceCategory,
} from "../books/bookArchiveFacets";
import {
  applyBookSmartShelf,
  type BookSmartShelf,
} from "../books/bookSmartShelves";
import { parseBookCollection } from "../books/bookCollections";
import {
  chooseRandomBookArchiveItem,
  rememberRandomBookArchiveItem,
} from "../books/bookArchiveDiscovery";
import { COMPLETE_SHELF_MAX_WORKING_SET } from "../books/completeShelfModel";
import {
  bookShelfStateReducer,
  createInitialBookShelfState,
} from "../books/bookShelfState";
import {
  bookSceneThemeCssProperties,
  bookSceneThemeForArchetype,
  resolveBookSceneTheme,
} from "../books/bookSceneThemes";
import {
  bookArchiveSceneCssProperties,
  bookSceneOwnerOverrideFromSettings,
  resolveBookArchiveSceneSettings,
} from "../books/bookArchiveSceneSettings";
import {
  coreHomepageSectionClass,
  coreHomepageSectionStyle,
  getCoreHomepageSection,
} from "../data/cms/homepage";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { useBookCollections } from "../hooks/useBookCollections";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { articlePath } from "../utils/articleRoutes";
import {
  cmsCoreFieldMarker,
  cmsEntityFieldMarker,
  cmsEntityMarker,
} from "../cms/directEditBridge";
import { normalizeLiterarySearch } from "../utils/literarySearch";
import {
  BOOKS_GLOBAL_SEARCH_PROFILE,
  BOOKS_LIBRARY_SEARCH_PROFILE,
  createGlobalSearchIndex,
  loadGlobalSearchArticleCatalog,
  searchGlobalSearchIndex,
  type GlobalSearchActivateAction,
  type GlobalSearchExtensionDocument,
  type GlobalSearchResult,
} from "../search/globalSearchIndex";
import BrandHeartIcon from "./BrandHeartIcon";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandArrowIcon from "./BrandArrowIcon";
import BrandBookIcon from "./BrandBookIcon";
import BookShelfControls, {
  type BookShelfQuickFilterOption,
  type BookShelfSearchScope,
  type BookShelfViewMode,
} from "./BookShelfControls";
import BookShelfFrame from "./BookShelfFrame";
import BookShelfScene, {
  type BookShelfSceneAppearance,
  type BookShelfSceneFailure,
} from "./BookShelfScene";
import WriterPortrait from "./WriterPortrait";

type Props = {
  books: BookArchiveEntry[];
  countries: Country[];
  onBookSelect: (book: BookArchiveEntry) => void;
  requestedBook?: BookArchiveEntry | null;
  onRequestedBookHandled?: () => void;
};

const archiveFilters: Array<{
  id: Exclude<BookArchiveQuickPreset, "custom">;
  label: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Весь архив",
    description: "Все связанные произведения",
  },
  {
    id: "verified",
    label: "Проверено редакцией",
    description: "Карточки с подтверждёнными данными",
  },
  {
    id: "children",
    label: "Для детей",
    description: "Только подтверждённая аудитория",
  },
  {
    id: "classic",
    label: "Классика до середины XX века",
    description: "Первое издание — не позднее 1945 года",
  },
  {
    id: "modern",
    label: "Послевоенная и современная литература",
    description: "Первое издание — с 1946 года по настоящее время",
  },
  {
    id: "with-cover",
    label: "С обложкой",
    description: "Только обложки с разрешёнными правами",
  },
  {
    id: "saved",
    label: "Избранное",
    description: "Книги из личной полки",
  },
];

const periodLabels: Record<BookArchivePeriod, string> = {
  "pre-1800": "До 1800 года",
  xix: "XIX век",
  "1900-1945": "1900–1945",
  "1946-1999": "1946–1999",
  xxi: "XXI век",
  unknown: "Период не подтверждён",
};

const audienceLabels: Record<WorkAudienceCategory, string> = {
  children: "Дети",
  "young-adult": "Подростки",
  adult: "Взрослые",
  "all-ages": "Для всех возрастов",
};

const coverLabels: Record<BookArchiveCoverMode, string> = {
  uploaded: "Загруженная обложка",
  editorial: "Редакционная обложка",
  typographic: "Типографическая обложка",
};

type AuthorFilterOption = {
  key: string;
  label: string;
  countryLabel: string;
  count: number;
  writer: Country["writers"][number] | null;
};

const relationLabels: Record<BookArchiveArticleRelation, string> = {
  related: "Есть связь со статьёй",
  review: "Рецензия",
  feature: "Главный материал",
  mention: "Упоминание",
  unrelated: "Без связанной статьи",
};

const sortLabels: Record<BookArchiveSort, string> = {
  "editorial-relevance": "Редакционная релевантность",
  title: "По названию",
  writer: "По автору",
  oldest: "Сначала ранние",
  newest: "Сначала новые",
  "cover-first": "Сначала с обложкой",
  manual: "Редакционный порядок",
  recent: "Недавно проверенные",
};

const searchGroupLabels: Record<GlobalSearchResult["group"], string> = {
  books: "КНИГИ",
  writers: "АВТОРЫ",
  countries: "СТРАНЫ",
  genres: "ЖАНРЫ",
  audiences: "АУДИТОРИИ",
  periods: "ПЕРИОДЫ",
  editorialShelves: "РЕДАКЦИОННЫЕ ПОЛКИ",
  personalShelves: "МОИ ПОЛКИ",
  articles: "МАТЕРИАЛЫ ЖУРНАЛА",
};

function toggleFacetValue<T extends string>(
  values: readonly T[],
  value: T,
  checked: boolean
) {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((candidate) => candidate !== value);
}

export function isBookCmsEditable(
  item: Pick<BookArchiveQueueItem, "status"> | null | undefined
) {
  return item?.status === "verified";
}

function cmsBookEntityAttributes(
  item: Pick<BookArchiveQueueItem, "status"> | null | undefined,
  entityId: string,
  label: string,
  adminHref: string
) {
  return isBookCmsEditable(item)
    ? cmsEntityMarker("book", entityId, label, adminHref)
    : ({ "data-cms-ignore": "true" } as const);
}

function cmsBookFieldAttributes(
  item: Pick<BookArchiveQueueItem, "status"> | null | undefined,
  entityId: string,
  field: string,
  value: unknown,
  options: Parameters<typeof cmsEntityFieldMarker>[4]
) {
  return isBookCmsEditable(item)
    ? cmsEntityFieldMarker("book", entityId, field, value, options)
    : {};
}

function bookKey(book: BookArchiveEntry) {
  return bookArchiveKey(book.countryId, book.writerId, book.id);
}

export function resolveRequestedBook(
  books: BookArchiveEntry[],
  key: string | null
) {
  if (!key) return { status: "none" } as const;
  if (!books.length) return { status: "pending" } as const;
  const book = books.find((candidate) => bookKey(candidate) === key);
  return book
    ? ({ status: "found", book } as const)
    : ({ status: "missing" } as const);
}

export function requestedBookKey(search: string) {
  const key = new URLSearchParams(search).get("book")?.trim() || "";
  const parts = key.split(":");
  return parts.length === 3 && parts.every((part) => part.length > 0)
    ? key
    : null;
}

const bookDetailHistoryStateKey = "probperaBookDetail";

function replaceBookLocation(
  key: string | null,
  mode: "push" | "replace" = "replace"
) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (key) {
    url.searchParams.set("book", key);
    url.hash = "books";
  } else {
    url.searchParams.delete("book");
  }
  const nextState: Record<string, unknown> = {
    ...(window.history.state || {}),
  };
  const isAppOpenedDetail = Boolean(nextState[bookDetailHistoryStateKey]);
  if (key && (mode === "push" || isAppOpenedDetail)) {
    nextState[bookDetailHistoryStateKey] = key;
  } else {
    delete nextState[bookDetailHistoryStateKey];
  }
  window.history[mode === "push" ? "pushState" : "replaceState"](
    nextState,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function resolveCoverUrl(url?: string) {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\/+/, "")}`;
}

function createInitialBookShelfControllerState(forcedColors: boolean) {
  const shelfState = createInitialBookShelfState("shelf");
  const viewMode = shelfState.effectiveViewMode;
  return forcedColors && viewMode === "shelf"
    ? createInitialBookShelfState("catalog")
    : shelfState;
}


export default function BookArchiveSection({
  books,
  countries,
  onBookSelect,
  requestedBook,
  onRequestedBookHandled,
}: Props) {
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState<BookArchiveFilterState>(() =>
    normalizeBookArchiveFilterState()
  );
  const [smartShelfStatus, setSmartShelfStatus] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState("all");
  const [visibleCount, setVisibleCount] = useState(
    COMPLETE_SHELF_MAX_WORKING_SET
  );
  const [forcedColors, setForcedColors] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(forced-colors: active)").matches
  );
  const [shelfState, shelfDispatch] = useReducer(
    bookShelfStateReducer,
    undefined,
    () => createInitialBookShelfControllerState(forcedColors)
  );
  const [sceneLoadGeneration, setSceneLoadGeneration] = useState(0);
  const viewMode = forcedColors ? "catalog" : shelfState.effectiveViewMode;
  const setViewMode = useCallback(
    (nextViewMode: BookShelfViewMode) => {
      const resolvedViewMode = forcedColors ? "catalog" : nextViewMode;
      shelfDispatch({ type: "set-view-mode", viewMode: resolvedViewMode });
      if (resolvedViewMode === "shelf" && shelfState.error) {
        setSceneLoadGeneration((generation) => generation + 1);
        shelfDispatch({
          type: "recover",
          requestId: shelfState.requestId + 1,
        });
      }
    },
    [forcedColors, shelfState.error, shelfState.requestId]
  );
  const [searchScope, setSearchScope] =
    useState<BookShelfSearchScope>("library");
  const [focusedBookKey, setFocusedBookKey] = useState<string | null>(null);
  const [randomAnnouncement, setRandomAnnouncement] = useState("");
  const randomBookHistoryRef = useRef<string[]>([]);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [shelfFailure, setShelfFailure] =
    useState<BookShelfSceneFailure | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const archiveSectionRef = useRef<HTMLElement>(null);
  const [sceneNearViewport, setSceneNearViewport] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  const economicalRendering = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const device = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    return (
      device.connection?.saveData === true ||
      (typeof device.deviceMemory === "number" && device.deviceMemory <= 2) ||
      (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 2)
    );
  }, []);
  const [selectedBook, setSelectedBook] = useState<BookArchiveEntry | null>(
    null
  );
  const [relatedArticles, setRelatedArticles] = useState<BookArticleMention[]>(
    []
  );
  const [relatedArticlesLoading, setRelatedArticlesLoading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState<BookMentionIndex | null>(null);
  const [globalSearchArticles, setGlobalSearchArticles] = useState<
    readonly (typeof articleCatalog)[number][]
  >([]);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shelfStateRef = useRef(shelfState);
  shelfStateRef.current = shelfState;
  const selectedBookRef = useRef<BookArchiveEntry | null>(selectedBook);
  selectedBookRef.current = selectedBook;
  const actualViewModeRef = useRef<BookShelfViewMode>(viewMode);
  actualViewModeRef.current = viewMode;
  const skipNextBookPopstateRef = useRef(false);
  const pendingBookCloseRef = useRef<{
    requestId: number;
    returnFocus: HTMLElement | null;
  } | null>(null);
  const pageTurnFrameRef = useRef<number | null>(null);
  const filteredItemsRef = useRef<readonly BookArchiveQueueItem[]>([]);
  const filterDrawerRef = useRef<HTMLElement>(null);
  const filterReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = archiveSectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setSceneNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setSceneNearViewport(Boolean(entry?.isIntersecting)),
      { rootMargin: "720px 0px", threshold: 0.01 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  const openAdvancedFilters = useCallback(() => {
    filterReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setAdvancedFiltersOpen(true);
  }, []);
  const closeAdvancedFilters = useCallback(() => {
    setAdvancedFiltersOpen(false);
    window.requestAnimationFrame(() => {
      const trigger = filterReturnFocusRef.current;
      filterReturnFocusRef.current = null;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
  }, []);
  const { items: savedReadings, toggle: toggleSavedReading } =
    useReadingLibrary();
  const {
    collections: bookCollections,
    favorites: bookFavorites,
    favoriteKeys,
    status: bookCollectionSyncStatus,
    error: bookCollectionError,
    conflicts: bookCollectionConflicts,
    upsertCollection,
    toggleFavorite,
  } = useBookCollections();
  const { language, t, countryName, number } = useInterfaceLanguage();
  const smartShelves = useMemo<readonly BookSmartShelf[]>(
    () =>
      bookCollections.flatMap((collection) =>
        collection.kind === "smart" && collection.filterState
          ? [{
              id: collection.id,
              label: collection.title,
              filterState: collection.filterState,
            }]
          : []
      ),
    [bookCollections]
  );
  const deferredQuery = useDeferredValue(query);
  const queue = useMemo(() => classifyBookArchiveQueue(books), [books]);
  const queueByKey = useMemo(
    () => new Map(queue.all.map((item) => [item.key, item])),
    [queue]
  );
  const openBookDetail = useCallback((
    book: BookArchiveEntry,
    returnFocus?: HTMLElement | null
  ) => {
    const currentShelfState = shelfStateRef.current;
    if (
      actualViewModeRef.current === "shelf" &&
      currentShelfState.phase === "SHELF_IDLE"
    ) {
      shelfDispatch({
        type: "request-inspection",
        requestId: currentShelfState.requestId + 1,
      });
    }
    setFocusedBookKey(bookKey(book));
    returnFocusRef.current = returnFocus || null;
    selectedBookRef.current = book;
    setSelectedBook(book);
    replaceBookLocation(
      bookKey(book),
      requestedBookKey(window.location.search) ? "replace" : "push"
    );
  }, []);
  const restoreBookTriggerFocus = useCallback(
    (returnFocus: HTMLElement | null) => {
      const returnBookKey =
        returnFocus?.dataset.bookKey ||
        (selectedBookRef.current
          ? bookKey(selectedBookRef.current)
          : undefined);
      const focusTrigger = () => {
        const canReceiveFocus = (element: HTMLElement) =>
          element.isConnected &&
          !element.hasAttribute("disabled") &&
          !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
          element.getClientRects().length > 0;
        const reconnectedTrigger = returnBookKey
          ? [
              ...document.querySelectorAll<HTMLElement>(
                ".archive-book-detail[data-book-key]"
              ),
            ].find(
              (element) =>
                element.dataset.bookKey === returnBookKey &&
                canReceiveFocus(element)
            )
          : null;
        const fallback = [
          ...document.querySelectorAll<HTMLElement>(
            ".book-shelf-navigation__current button, .book-archive-toolbar input"
          ),
        ].find(canReceiveFocus);
        const target = reconnectedTrigger ||
          (returnFocus && canReceiveFocus(returnFocus) ? returnFocus : fallback);
        if (!target) return;
        target.focus({ preventScroll: true });
        const targetBounds = target.getBoundingClientRect();
        if (targetBounds.bottom < 0 || targetBounds.top > window.innerHeight) {
          target.scrollIntoView({
            behavior: window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches
              ? "auto"
              : "smooth",
            block: "nearest",
          });
        }
      };

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(focusTrigger);
      });
      // The detail column changes the workspace child order. React may reconnect
      // the catalog subtree after the first paint, so focus the keyed trigger once
      // more after that commit instead of leaving keyboard users in the search.
      window.setTimeout(focusTrigger, 120);
    },
    []
  );
  const finalizeBookDetailClose = useCallback(
    (returnFocus: HTMLElement | null) => {
      pendingBookCloseRef.current = null;
      returnFocusRef.current = null;
      setSelectedBook(null);
      setFocusedBookKey((current) =>
        current && filteredItemsRef.current.some((item) => item.key === current)
          ? current
          : filteredItemsRef.current[0]?.key || null
      );
      if (window.history.state?.[bookDetailHistoryStateKey]) {
        skipNextBookPopstateRef.current = true;
        window.addEventListener(
          "popstate",
          () => restoreBookTriggerFocus(returnFocus),
          { once: true }
        );
        window.history.back();
      } else {
        replaceBookLocation(null);
        restoreBookTriggerFocus(returnFocus);
      }
    },
    [restoreBookTriggerFocus]
  );
  const closeBookDetail = useCallback(() => {
    if (
      pendingBookCloseRef.current ||
      shelfState.phase === "INSPECTION_CLOSING" ||
      shelfState.phase === "SHELF_RESTORING"
    ) {
      return;
    }

    const returnFocus = returnFocusRef.current;
    const requestId = shelfState.requestId + 1;
    const inspectionActive = [
      "INSPECTION_ENTERING",
      "INSPECTION_CLOSED",
      "COVER_CRACKED",
      "COVER_OPENING",
      "BOOK_OPEN",
      "PAGE_DRAGGING",
      "PAGE_SETTLING",
      "INSPECTION_CLOSING",
    ].includes(shelfState.phase);

    if (
      inspectionActive &&
      viewMode === "shelf" &&
      !reducedMotion &&
      selectedBook
    ) {
      pendingBookCloseRef.current = { requestId, returnFocus };
      shelfDispatch({ type: "request-inspection-close", requestId });
      return;
    }

    if (inspectionActive) {
      shelfDispatch({ type: "request-inspection-close", requestId });
      shelfDispatch({ type: "inspection-closed", requestId });
      shelfDispatch({ type: "shelf-restored", requestId });
    }
    finalizeBookDetailClose(returnFocus);
  }, [
    finalizeBookDetailClose,
    reducedMotion,
    selectedBook,
    viewMode,
    shelfState.phase,
    shelfState.requestId,
  ]);
  useEffect(() => {
    if (viewMode === "shelf") return;
    const pendingClose = pendingBookCloseRef.current;
    if (!pendingClose) return;
    const currentPhase = shelfStateRef.current.phase;
    if (currentPhase === "INSPECTION_CLOSING") {
      shelfDispatch({
        type: "inspection-closed",
        requestId: pendingClose.requestId,
      });
      shelfDispatch({
        type: "shelf-restored",
        requestId: pendingClose.requestId,
      });
    } else if (currentPhase === "SHELF_RESTORING") {
      shelfDispatch({
        type: "shelf-restored",
        requestId: pendingClose.requestId,
      });
    }
    finalizeBookDetailClose(pendingClose.returnFocus);
  }, [finalizeBookDetailClose, viewMode]);


  const savedBookKeys = useMemo(
    () =>
      new Set(
        savedReadings
          .filter((item) => item.kind === "book")
          .map((item) => item.id)
      ),
    [savedReadings]
  );

  useEffect(() => {
    let active = true;
    getBookMentionIndex()
      .then((index) => {
        if (active) setMentionIndex(index);
      })
      .catch(() => {
        if (active) setMentionIndex(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const facetIndex = useMemo(
    () =>
      buildBookArchiveFacetIndex({
        items: queue.all,
        locale: language,
        translate: t,
        countryName,
        mentionIndex,
      }),
    [countryName, language, mentionIndex, queue, t]
  );
  const appliedFilterState = useMemo(
    () =>
      normalizeBookArchiveFilterState({
        ...filterState,
        query: searchScope === "library" ? deferredQuery : "",
      }),
    [deferredQuery, filterState, searchScope]
  );
  const facetResult = useMemo(
    () =>
      filterBookArchiveFacetIndex(facetIndex, appliedFilterState, {
        savedBookKeys,
      }),
    [appliedFilterState, facetIndex, savedBookKeys]
  );
  const quickCountBaseState = useMemo(
    () =>
      normalizeBookArchiveFilterState({
        ...filterState,
        query: "",
      }),
    [filterState]
  );

  const quickFilterCounts = useMemo(() => {
    const counts = new Map<BookArchiveQuickPreset, number | null>();
    archiveFilters.forEach((option) => {
      if (
        option.id === "children" &&
        facetIndex.diagnostics.audienceFacetStatus === "unavailable"
      ) {
        counts.set(option.id, null);
        return;
      }
      counts.set(
        option.id,
        filterBookArchiveFacetIndex(
          facetIndex,
          applyBookArchiveQuickPreset(quickCountBaseState, option.id),
          { savedBookKeys }
        ).total
      );
    });
    return counts;
  }, [facetIndex, quickCountBaseState, savedBookKeys]);

  const quickFilterOptions = useMemo<readonly BookShelfQuickFilterOption[]>(
    () =>
      archiveFilters.map((option) => ({
        ...option,
        label:
          option.id === "verified"
            ? t("Проверено")
            : option.id === "classic"
              ? t("Классика")
              : option.id === "children"
                ? t("Для детей")
                : t(option.label),
        description: t(option.description),
        count: quickFilterCounts.get(option.id) ?? null,
        unavailable:
          option.id === "children" &&
          facetIndex.diagnostics.audienceFacetStatus === "unavailable",
      })),
    [facetIndex.diagnostics.audienceFacetStatus, quickFilterCounts, t]
  );

  const applyQuickFilter = useCallback(
    (preset: BookArchiveQuickPreset) => {
      if (
        preset === "children" &&
        facetIndex.diagnostics.audienceFacetStatus === "unavailable"
      ) {
        return;
      }
      if (preset === "custom") return;
      setFilterState((current) =>
        applyBookArchiveQuickPreset(current, preset)
      );
      setActiveCollectionId(preset);
    },
    [facetIndex.diagnostics.audienceFacetStatus]
  );

  const updateFilterState = useCallback(
    (patch: Partial<BookArchiveFilterState>) => {
      const { query: nextQuery, ...structuralPatch } = patch;
      if (typeof nextQuery === "string") setQuery(nextQuery);
      setFilterState((current) =>
        normalizeBookArchiveFilterState({
          ...current,
          ...structuralPatch,
          query: "",
          quickPreset: "custom",
        })
      );
      setActiveCollectionId("custom");
    },
    []
  );
  const resetArchiveFilters = useCallback(() => {
    setQuery("");
    setFilterState(normalizeBookArchiveFilterState());
    setActiveCollectionId("all");
    setSmartShelfStatus("");
  }, []);

  const authorOptions = useMemo(
    () => {
      const options = new Map<string, AuthorFilterOption>();
      for (const document of facetIndex.documents) {
        const current = options.get(document.authorKey);
        if (current) {
          options.set(document.authorKey, {
            ...current,
            count: current.count + 1,
          });
          continue;
        }
        const publicTarget = resolveBookArchivePublicTarget(
          countries,
          document.item.book
        );
        options.set(document.authorKey, {
          key: document.authorKey,
          label: document.writerLabel,
          countryLabel: document.countryLabel,
          count: 1,
          writer: publicTarget?.writer || null,
        });
      }
      return [...options.values()].sort((first, second) =>
        first.label.localeCompare(second.label, language)
      );
    },
    [countries, facetIndex, language]
  );
  const selectedAuthorOption =
    authorOptions.find((option) => option.key === filterState.authorKey) || null;
  const countryOptions = useMemo(
    () =>
      [
        ...new Map(
          facetIndex.documents.map((document) => [
            document.countryId,
            document.countryLabel,
          ])
        ).entries(),
      ].sort((first, second) => first[1].localeCompare(second[1], language)),
    [facetIndex, language]
  );

  const globalSearchExtensions = useMemo<
    readonly GlobalSearchExtensionDocument[]
  >(() => {
    const extensions: GlobalSearchExtensionDocument[] = [];
    for (const genre of BOOK_ARCHIVE_GENRES) {
      if (!facetIndex.indexes.genre.has(genre.id)) continue;
      extensions.push({
        kind: "genre",
        id: genre.id,
        label: t(genre.aliases[0]),
        aliases: genre.aliases,
      });
    }
    if (facetIndex.diagnostics.audienceFacetStatus === "available") {
      for (const audience of BOOK_ARCHIVE_AUDIENCES) {
        extensions.push({
          kind: "audience",
          id: audience,
          label: t(audienceLabels[audience]),
        });
      }
    }
    for (const period of BOOK_ARCHIVE_PERIODS) {
      extensions.push({
        kind: "period",
        id: period,
        label: t(periodLabels[period]),
        aliases: [period],
      });
    }
    for (const option of archiveFilters) {
      extensions.push({
        kind: option.id === "saved" ? "personal-shelf" : "editorial-shelf",
        id: option.id,
        label: t(option.label),
        aliases: [t(option.description)],
      });
    }
    for (const shelf of smartShelves) {
      extensions.push({
        kind: "personal-shelf",
        id: shelf.id,
        label: shelf.label,
        aliases: [t("Умная полка")],
      });
    }
    return extensions;
  }, [facetIndex, smartShelves, t]);

  useEffect(() => {
    if (
      searchScope !== "global" ||
      normalizeLiterarySearch(deferredQuery).length < 2
    ) {
      return;
    }
    let active = true;
    loadGlobalSearchArticleCatalog()
      .then((articles) => {
        if (active) setGlobalSearchArticles(articles);
      })
      .catch(() => {
        if (active) setGlobalSearchArticles([]);
      });
    return () => {
      active = false;
    };
  }, [deferredQuery, searchScope]);

  const globalSearchIndex = useMemo(
    () =>
      createGlobalSearchIndex({
        countries,
        books,
        language,
        translate: t,
        countryName,
        articles: globalSearchArticles,
        extensions: globalSearchExtensions,
      }),
    [
      books,
      countries,
      countryName,
      globalSearchArticles,
      globalSearchExtensions,
      language,
      t,
    ]
  );
  const globalSearchResponse = useMemo(
    () =>
      searchGlobalSearchIndex(
        globalSearchIndex,
        searchScope === "global" ? deferredQuery : "",
        BOOKS_GLOBAL_SEARCH_PROFILE
      ),
    [deferredQuery, globalSearchIndex, searchScope]
  );
  const librarySearchResponse = useMemo(
    () =>
      searchGlobalSearchIndex(
        globalSearchIndex,
        searchScope === "library" ? deferredQuery : "",
        BOOKS_LIBRARY_SEARCH_PROFILE
      ),
    [deferredQuery, globalSearchIndex, searchScope]
  );
  const activeSearchResponse =
    searchScope === "global" ? globalSearchResponse : librarySearchResponse;
  const activeSearchProfile =
    searchScope === "global"
      ? BOOKS_GLOBAL_SEARCH_PROFILE
      : BOOKS_LIBRARY_SEARCH_PROFILE;

  const filteredItems = useMemo(() => {
    if (
      searchScope !== "global" ||
      globalSearchResponse.normalizedQuery.length <
        BOOKS_GLOBAL_SEARCH_PROFILE.minQueryLength
    ) {
      return facetResult.items;
    }
    const acceptedBookKeys = new Set(
      facetResult.items.map((item) => item.key)
    );
    return globalSearchResponse.allMatches.flatMap((result) => {
      if (
        result.kind !== "book" ||
        !acceptedBookKeys.has(result.focusAction.bookKey)
      ) {
        return [];
      }
      const item = queueByKey.get(result.focusAction.bookKey);
      return item ? [item] : [];
    });
  }, [facetResult.items, globalSearchResponse, queueByKey, searchScope]);
  filteredItemsRef.current = filteredItems;

  useEffect(() => {
    setVisibleCount(COMPLETE_SHELF_MAX_WORKING_SET);
  }, [deferredQuery, filterState]);

  useEffect(() => {
    if (searchScope !== "global") return;
    const firstBook =
      globalSearchResponse.suggestions.find(
        (result): result is Extract<GlobalSearchResult, { kind: "book" }> =>
          result.kind === "book"
      ) ||
      globalSearchResponse.allMatches.find(
        (result): result is Extract<GlobalSearchResult, { kind: "book" }> =>
          result.kind === "book"
      );
    if (firstBook) setFocusedBookKey(firstBook.focusAction.bookKey);
  }, [globalSearchResponse, searchScope]);

  useEffect(() => {
    if (
      searchScope === "library" &&
      normalizeLiterarySearch(deferredQuery).length > 0
    ) {
      setFocusedBookKey(facetResult.bestMatchKey);
      return;
    }
    setFocusedBookKey((current) =>
      current && filteredItems.some((item) => item.key === current)
        ? current
        : filteredItems[0]?.key || null
    );
  }, [deferredQuery, facetResult.bestMatchKey, filteredItems, searchScope]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(forced-colors: active)");
    const update = () => {
      setForcedColors(media.matches);
      if (media.matches) {
        shelfDispatch({ type: "set-view-mode", viewMode: "catalog" });
      }
    };
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (
      viewMode !== "shelf" ||
      !selectedBook ||
      shelfState.phase !== "SHELF_IDLE"
    ) return;
    shelfDispatch({
      type: "request-inspection",
      requestId: shelfState.requestId + 1,
    });
  }, [selectedBook, shelfState.phase, shelfState.requestId, viewMode]);

  useEffect(() => {
    if (!advancedFiltersOpen) return;
    const drawer = filterDrawerRef.current;
    const focusable = () =>
      drawer
        ? [...drawer.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
          )].filter((element) => !element.hidden)
        : [];
    focusable()[0]?.focus({ preventScroll: true });

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAdvancedFilters();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeyDown);
    return () =>
      document.removeEventListener("keydown", handleDialogKeyDown);
  }, [advancedFiltersOpen, closeAdvancedFilters]);

  useEffect(() => {
    if (!selectedBook) return;
    const handleDetailKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        advancedFiltersOpen ||
        pendingBookCloseRef.current
      ) {
        return;
      }
      event.preventDefault();
      closeBookDetail();
    };
    document.addEventListener("keydown", handleDetailKeyDown);
    return () => document.removeEventListener("keydown", handleDetailKeyDown);
  }, [advancedFiltersOpen, closeBookDetail, selectedBook]);

  useEffect(() => {
    const openFromLocation = (event?: Event) => {
      if (
        event?.type === "popstate" &&
        skipNextBookPopstateRef.current
      ) {
        skipNextBookPopstateRef.current = false;
        return;
      }
      const key = requestedBookKey(window.location.search);
      const resolution = resolveRequestedBook(books, key);
      if (resolution.status === "none") {
        if (pendingBookCloseRef.current) return;
        if (selectedBookRef.current) closeBookDetail();
        return;
      }
      if (resolution.status === "pending") return;
      if (resolution.status === "missing") {
        if (pendingBookCloseRef.current) return;
        if (selectedBookRef.current) {
          closeBookDetail();
        } else {
          replaceBookLocation(null);
        }
        return;
      }
      if (
        selectedBookRef.current &&
        bookKey(selectedBookRef.current) === key
      ) {
        return;
      }
      openBookDetail(resolution.book);
    };

    openFromLocation();
    window.addEventListener("popstate", openFromLocation);
    return () => window.removeEventListener("popstate", openFromLocation);
  }, [books, closeBookDetail, openBookDetail]);

  useEffect(() => {
    if (!requestedBook) return;
    openBookDetail(requestedBook);
    onRequestedBookHandled?.();
    window.requestAnimationFrame(() => {
      document.getElementById("books")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [onRequestedBookHandled, openBookDetail, requestedBook]);

  useEffect(() => {
    if (!selectedBook) return;
    const frame = window.requestAnimationFrame(() => {
      if (viewMode === "shelf") {
        document
          .getElementById("books")
          ?.querySelector<HTMLElement>(".book-shelf-scene")
          ?.focus({ preventScroll: true });
        return;
      }
      const detail = detailRef.current;
      if (!detail) return;
      detail.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      detail.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedBook, viewMode]);

  useEffect(() => {
    let active = true;
    if (!selectedBook) {
      setRelatedArticles([]);
      setRelatedArticlesLoading(false);
      return () => {
        active = false;
      };
    }

    setRelatedArticles([]);
    setRelatedArticlesLoading(true);
    getBookArticleMentions(bookKey(selectedBook))
      .then((articles) => {
        if (!active) return;
        setRelatedArticles(
          articles.flatMap((mention) => {
            const source = articleCatalog.find(
              (article) => article.id === mention.id
            );
            if (!source) return language === "ru" ? [mention] : [];
            const localized = articleCatalogEntryForLanguage(source, language);
            return localized
              ? [
                  {
                    ...mention,
                    title: localized.title,
                    sectionLabel: localized.sectionLabel,
                    slug: localized.slug || mention.slug,
                    readingMinutes: localized.readingMinutes,
                  },
                ]
              : [];
          })
        );
      })
      .catch(() => {
        if (active) setRelatedArticles([]);
      })
      .finally(() => {
        if (active) setRelatedArticlesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [language, selectedBook]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const coreBookArchive = getCoreHomepageSection("book-archive");
  const sceneSettings = useMemo(
    () =>
      resolveBookArchiveSceneSettings(coreBookArchive?.visualSettings),
    [coreBookArchive?.visualSettings]
  );
  const sceneOwnerOverride = useMemo(
    () =>
      bookSceneOwnerOverrideFromSettings(coreBookArchive?.visualSettings) ||
      (sceneSettings.bookSceneDynamicThemes
        ? null
        : ({ archetype: "VIOLET LIBRARY" } as const)),
    [coreBookArchive?.visualSettings, sceneSettings.bookSceneDynamicThemes]
  );
  const sceneQueueItems = useMemo(() => {
    if (!selectedBook) return filteredItems;
    const selectedKey = bookKey(selectedBook);
    if (filteredItems.some((item) => item.key === selectedKey)) {
      return filteredItems;
    }
    const selectedQueueItem = queueByKey.get(selectedKey);
    return selectedQueueItem
      ? [selectedQueueItem, ...filteredItems]
      : filteredItems;
  }, [filteredItems, queueByKey, selectedBook]);

  const sceneItems = useMemo(
    () =>
      sceneQueueItems.map((item) => {
        const displayed = presentBookArchiveQueueItem(item, language);
        const theme = resolveBookSceneTheme(item.book, {
          audienceIds: facetIndex.byKey.get(item.key)?.audienceIds,
          ownerOverride: sceneOwnerOverride,
        });
        return {
          key: item.key,
          title: displayed.title,
          writer: selectBookWriterName(
            item.book,
            language,
            t("\u0410\u0432\u0442\u043e\u0440")
          ),
          year:
            item.status === "verified" && item.book.firstPublished
              ? item.book.firstPublished
              : undefined,
          coverUrl: isCoverArtworkDisplayAllowed(item.book)
            ? resolveCoverUrl(item.book.coverUrl)
            : undefined,
          baseColor: theme.baseColor,
          accentColor: theme.accentColor,
          paperColor: theme.paperColor,
        };
      }),
    [facetIndex, language, sceneOwnerOverride, sceneQueueItems, t]
  );
  const focusedSceneTheme = useMemo(() => {
    const focusedItem =
      (focusedBookKey && queueByKey.get(focusedBookKey)) ||
      filteredItems[0] ||
      null;
    return focusedItem
      ? resolveBookSceneTheme(focusedItem.book, {
          audienceIds: facetIndex.byKey.get(focusedItem.key)?.audienceIds,
          ownerOverride: sceneOwnerOverride,
        })
      : bookSceneThemeForArchetype(
          sceneOwnerOverride?.archetype || "VIOLET LIBRARY"
        );
  }, [
    facetIndex,
    filteredItems,
    focusedBookKey,
    queueByKey,
    sceneOwnerOverride,
  ]);
  const sceneCssProperties = useMemo(
    () => bookArchiveSceneCssProperties(sceneSettings),
    [sceneSettings]
  );
  const frameThemeStyle = useMemo(
    () =>
      ({
        ...bookSceneThemeCssProperties(focusedSceneTheme),
        ...sceneCssProperties,
      }) as CSSProperties,
    [focusedSceneTheme, sceneCssProperties]
  );
  const sceneAppearance = useMemo<BookShelfSceneAppearance>(
    () => ({
      shelfColor: sceneCssProperties["--book-scene-material-color"],
      ambientColor:
        sceneCssProperties["--book-scene-ambient-tint"] === "currentColor"
          ? focusedSceneTheme.secondaryColor
          : sceneCssProperties["--book-scene-ambient-tint"],
      lightColor: focusedSceneTheme.lightColor,
      materialRoughness: Number(
        sceneCssProperties["--book-scene-material-roughness"]
      ),
      intensity: sceneSettings.bookSceneIntensity / 100,
    }),
    [focusedSceneTheme, sceneCssProperties, sceneSettings.bookSceneIntensity]
  );
  const focusedIndex = focusedBookKey
    ? filteredItems.findIndex((item) => item.key === focusedBookKey)
    : -1;
  const focusedSceneIndex = focusedBookKey
    ? sceneItems.findIndex((item) => item.key === focusedBookKey)
    : -1;
  const navigationIndex = focusedIndex >= 0 ? focusedIndex : focusedSceneIndex;
  const navigationCount =
    focusedIndex >= 0 ? filteredItems.length : sceneItems.length;
  const navigationLocked =
    Boolean(selectedBook) ||
    (viewMode === "shelf" && shelfState.phase !== "SHELF_IDLE");
  const requestFocusBook = useCallback(
    (key: string) => {
      if (!key || key === focusedBookKey) return;
      const motionOwned =
        viewMode === "shelf" &&
        ["SHELF_IDLE", "SHELF_MOVING", "SHELF_SETTLING"].includes(
          shelfState.phase
      );
      if (viewMode === "shelf" && !motionOwned) return;
      setRandomAnnouncement("");
      setFocusedBookKey(key);
      if (motionOwned) {
        shelfDispatch({
          type: "request-focus",
          requestId: shelfState.requestId + 1,
        });
      }
    },
    [
      focusedBookKey,
      viewMode,
      shelfState.phase,
      shelfState.requestId,
    ]
  );
  const focusBookAt = useCallback(
    (index: number) => {
      if (!filteredItems.length) return;
      const normalized =
        (index + filteredItems.length) % filteredItems.length;
      const key = filteredItems[normalized]?.key;
      if (key) requestFocusBook(key);
    },
    [filteredItems, requestFocusBook]
  );
  const openRandomWork = useCallback(
    (trigger: HTMLButtonElement) => {
      const item = chooseRandomBookArchiveItem({
        candidates: queue.all,
        randomValue: Math.random(),
        currentKey: selectedBook ? bookKey(selectedBook) : focusedBookKey,
        recentKeys: randomBookHistoryRef.current,
      });
      if (!item) return;

      randomBookHistoryRef.current = rememberRandomBookArchiveItem(
        randomBookHistoryRef.current,
        item.key
      );
      setQuery("");
      setFilterState(normalizeBookArchiveFilterState());
      setActiveCollectionId("all");
      setSmartShelfStatus("");
      setSearchScope("library");
      setAdvancedFiltersOpen(false);
      setShelfFailure(null);
      setViewMode("shelf");
      if (!forcedColors) actualViewModeRef.current = "shelf";
      const displayed = presentBookArchiveQueueItem(item, language);
      setRandomAnnouncement(`${t("Случайный выбор")}: ${displayed.title}`);
      openBookDetail(item.book, trigger);
    },
    [
      focusedBookKey,
      forcedColors,
      language,
      openBookDetail,
      queue.all,
      selectedBook,
      setViewMode,
      t,
    ]
  );
  const requestSelectedCoverOpen = useCallback((key: string) => {
    const currentBook = selectedBookRef.current;
    const currentShelfState = shelfStateRef.current;
    if (
      actualViewModeRef.current !== "shelf" ||
      !currentBook ||
      bookKey(currentBook) !== key
    ) {
      return;
    }
    shelfDispatch({
      type: "request-cover-open",
      requestId: currentShelfState.requestId + 1,
    });
  }, []);
  const requestSelectedPageTurn = useCallback(() => {
    const currentShelfState = shelfStateRef.current;
    if (
      actualViewModeRef.current !== "shelf" ||
      !selectedBookRef.current ||
      currentShelfState.phase !== "BOOK_OPEN" ||
      pageTurnFrameRef.current !== null
    ) {
      return;
    }
    shelfDispatch({
      type: "start-page-drag",
      requestId: currentShelfState.requestId + 1,
    });
    pageTurnFrameRef.current = window.requestAnimationFrame(() => {
      pageTurnFrameRef.current = null;
      const draggingState = shelfStateRef.current;
      if (draggingState.phase !== "PAGE_DRAGGING") return;
      shelfDispatch({
        type: "request-page-settle",
        requestId: draggingState.requestId + 1,
      });
    });
  }, []);

  useEffect(
    () => () => {
      if (pageTurnFrameRef.current !== null) {
        window.cancelAnimationFrame(pageTurnFrameRef.current);
      }
    },
    []
  );
  const handleShelfFailure = useCallback(
    (reason: BookShelfSceneFailure) => {
      const requestId = shelfState.requestId + 1;
      const pendingClose = pendingBookCloseRef.current;
      setShelfFailure(reason);
      shelfDispatch({
        type: "fail",
        requestId,
        code:
          reason === "unsupported"
            ? "webgl-unavailable"
            : "transition-failed",
      });
      shelfDispatch({ type: "set-view-mode", viewMode: "catalog" });
      if (pendingClose) {
        finalizeBookDetailClose(pendingClose.returnFocus);
      }
    },
    [finalizeBookDetailClose, shelfState.requestId]
  );
  const handleShelfRestored = useCallback(
    (requestId: number) => {
      shelfDispatch({ type: "shelf-restored", requestId });
      const pendingClose = pendingBookCloseRef.current;
      if (pendingClose?.requestId === requestId) {
        finalizeBookDetailClose(pendingClose.returnFocus);
      }
    },
    [finalizeBookDetailClose]
  );
  const selectedItem = selectedBook
    ? queueByKey.get(bookKey(selectedBook)) || null
    : null;
  const navigationActionBook =
    selectedBook ||
    (focusedBookKey ? queueByKey.get(focusedBookKey)?.book || null : null);
  const selectedCoverUrl = selectedBook
    ? isCoverArtworkDisplayAllowed(selectedBook)
      ? selectedBook.coverUrl
      : undefined
    : undefined;
  const selectedBookText = selectedItem
    ? presentBookArchiveQueueItem(selectedItem, language)
    : null;
  const selectedWriterName = selectedBook
    ? selectBookWriterName(selectedBook, language, t("Автор"))
    : "";
  const selectedOriginalLanguage = selectedBook && selectedItem?.status === "verified"
    ? selectBookOriginalLanguage(selectedBook, language)
    : "";
  const selectedMetadataLabels = selectedBook && selectedItem?.status === "verified"
    ? selectBookMetadataLabels(selectedBook, language, t)
    : [];
  const isBookSaved = (book: BookArchiveEntry) =>
    savedReadings.some(
      (item) => item.kind === "book" && item.id === bookKey(book)
    );
  const toggleBook = (book: BookArchiveEntry) =>
    toggleSavedReading({
      id: bookKey(book),
      kind: "book",
      title: presentBookArchiveEntry(book, language).title,
      sectionId: book.countryId,
      sectionLabel: `${selectBookWriterName(book, language, t("Автор"))} · ${countryName(
        book.country.code,
        book.countryName
      )}`,
      href: "#books",
    });
  const isBookFavorite = (book: BookArchiveEntry) =>
    favoriteKeys.has(bookKey(book));
  const toggleBookFavorite = (book: BookArchiveEntry) =>
    void toggleFavorite(bookKey(book));

  const activateGlobalSearchAction = useCallback(
    (action: GlobalSearchActivateAction) => {
      switch (action.type) {
        case "open-book": {
          const item = queueByKey.get(action.bookKey);
          if (!item) return;
          setFocusedBookKey(action.bookKey);
          openBookDetail(item.book);
          return;
        }
        case "select-writer":
          updateFilterState({
            query: "",
            authorKey: action.authorKey,
          });
          setActiveCollectionId("author:" + action.authorKey);
          setSearchScope("library");
          return;
        case "select-country":
          updateFilterState({
            query: "",
            countryIds: [action.countryId],
          });
          setActiveCollectionId("country:" + action.countryId);
          setSearchScope("library");
          return;
        case "apply-facet": {
          if (action.facet === "genre") {
            updateFilterState({
              query: "",
              genreIds: action.ids as readonly BookArchiveGenreId[],
            });
          } else if (action.facet === "audience") {
            updateFilterState({
              query: "",
              audienceIds: action.ids as readonly WorkAudienceCategory[],
            });
          } else {
            updateFilterState({
              query: "",
              periods: action.ids as readonly BookArchivePeriod[],
            });
          }
          setSearchScope("library");
          return;
        }
        case "switch-collection": {
          const smartShelf = smartShelves.find(
            (shelf) => shelf.id === action.collectionId
          );
          const smartState = smartShelf ? applyBookSmartShelf(smartShelf) : null;
          if (smartShelf && smartState) {
            setQuery(smartState.query);
            setFilterState(
              normalizeBookArchiveFilterState({
                ...smartState,
                query: "",
              })
            );
            setActiveCollectionId(smartShelf.id);
            setSearchScope("library");
            return;
          }
          const preset = action.collectionId as Exclude<
            BookArchiveQuickPreset,
            "custom"
          >;
          if (archiveFilters.some((option) => option.id === preset)) {
            setQuery("");
            applyQuickFilter(preset);
            setSearchScope("library");
          }
          return;
        }
        case "navigate-article":
          window.location.assign(
            articlePath(
              action.article.id,
              action.article.title,
              action.article.sectionId,
              action.article.slug
            )
          );
      }
    },
    [
      applyQuickFilter,
      openBookDetail,
      queueByKey,
      setQuery,
      smartShelves,
      updateFilterState,
    ]
  );

  const saveCurrentAsSmartShelf = useCallback(async () => {
    if (searchScope !== "library") return;
    setSmartShelfStatus("");
    const now = new Date().toISOString();
    const collection = parseBookCollection({
      id: "smart-" + Date.now().toString(36),
      kind: "smart",
      title: t("Моя умная полка") + " " + number(smartShelves.length + 1),
      visibility: "private",
      dynamicBookThemes: true,
      themeIntensity: 70,
      sortMode: filterState.sort,
      filterState: {
        ...filterState,
        query,
      },
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    if (!collection || !(await upsertCollection(collection))) {
      setSmartShelfStatus(t("Не удалось сохранить умную полку"));
      return;
    }
    setActiveCollectionId(collection.id);
    setSmartShelfStatus(
      bookCollectionSyncStatus === "local-only"
        ? language === "en"
          ? "Smart shelf saved on this device"
          : "Умная полка сохранена на этом устройстве"
        : t("Умная полка сохранена")
    );
  }, [
    bookCollectionSyncStatus,
    filterState,
    language,
    number,
    query,
    searchScope,
    smartShelves.length,
    t,
    upsertCollection,
  ]);
  const personalCollectionStatus =
    smartShelfStatus ||
    (bookCollectionError
      ? language === "en"
        ? "Personal shelves could not be synced. Changes remain on this device."
        : "Не удалось синхронизировать личные полки. Изменения сохранены на этом устройстве."
      : bookCollectionConflicts.length > 0
        ? language === "en"
          ? `Resolved ${number(bookCollectionConflicts.length)} shelf sync conflicts`
          : `Разрешено конфликтов синхронизации полок: ${number(bookCollectionConflicts.length)}`
        : bookCollectionSyncStatus === "syncing"
          ? language === "en"
            ? "Syncing personal shelves…"
            : "Синхронизация личных полок…"
          : bookCollectionSyncStatus === "local-only" &&
              (smartShelves.length > 0 || bookFavorites.length > 0)
            ? language === "en"
              ? "Personal shelves are stored on this device"
              : "Личные полки хранятся на этом устройстве"
            : "");

  const activeSmartShelf = smartShelves.find(
    (shelf) => shelf.id === activeCollectionId
  );
  const activeAuthorKey = activeCollectionId.startsWith("author:")
    ? activeCollectionId.slice("author:".length)
    : "";
  const activeCountryId = activeCollectionId.startsWith("country:")
    ? activeCollectionId.slice("country:".length)
    : "";
  const activeCollectionLabel =
    activeSmartShelf?.label ||
    (activeAuthorKey
      ? authorOptions.find((option) => option.key === activeAuthorKey)?.label
      : "") ||
    (activeCountryId
      ? countryOptions.find(([id]) => id === activeCountryId)?.[1]
      : "") ||
    (activeCollectionId === "custom"
      ? t("Свой точный отбор")
      : t(
          archiveFilters.find((option) => option.id === activeCollectionId)
            ?.label || "Весь книжный архив"
        ));
  const activeFilterChips: Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }> = [];
  const pushChip = (key: string, label: string, onRemove: () => void) => {
    activeFilterChips.push({ key, label, onRemove });
  };
  if (query.trim()) {
    pushChip("query", t("Поиск") + ": " + query.trim(), () => setQuery(""));
  }
  if (selectedAuthorOption) {
    pushChip(
      "author:" + selectedAuthorOption.key,
      t("Автор") + ": " + selectedAuthorOption.label,
      () => updateFilterState({ authorKey: null })
    );
  }
  for (const id of filterState.countryIds) {
    const label = countryOptions.find(([countryId]) => countryId === id)?.[1] || id;
    pushChip("country:" + id, t("Страна") + ": " + label, () =>
      updateFilterState({
        countryIds: filterState.countryIds.filter((value) => value !== id),
      })
    );
  }
  for (const id of filterState.genreIds) {
    const definition = BOOK_ARCHIVE_GENRES.find((genre) => genre.id === id);
    pushChip("genre:" + id, t("Жанр") + ": " + t(definition?.aliases[0] || id), () =>
      updateFilterState({
        genreIds: filterState.genreIds.filter((value) => value !== id),
      })
    );
  }
  for (const id of filterState.audienceIds) {
    pushChip("audience:" + id, t("Аудитория") + ": " + t(audienceLabels[id]), () =>
      updateFilterState({
        audienceIds: filterState.audienceIds.filter((value) => value !== id),
      })
    );
  }
  for (const id of filterState.periods) {
    pushChip("period:" + id, t("Период") + ": " + t(periodLabels[id]), () =>
      updateFilterState({
        periods: filterState.periods.filter((value) => value !== id),
      })
    );
  }
  for (const id of filterState.originalLanguageIds) {
    const definition = BOOK_ARCHIVE_LANGUAGES.find((language) => language.id === id);
    const label =
      definition?.aliases.find((alias) => /[а-яё]/iu.test(alias)) ||
      id.toUpperCase();
    pushChip("language:" + id, t("Язык") + ": " + t(label), () =>
      updateFilterState({
        originalLanguageIds: filterState.originalLanguageIds.filter(
          (value) => value !== id
        ),
      })
    );
  }
  for (const status of filterState.editorialStatuses) {
    const label =
      status === "verified" ? t("Проверено редакцией") : t("Не проверено");
    pushChip("status:" + status, label, () =>
      updateFilterState({
        editorialStatuses: filterState.editorialStatuses.filter(
          (value) => value !== status
        ),
      })
    );
  }
  for (const mode of filterState.coverModes) {
    pushChip("cover:" + mode, t(coverLabels[mode]), () =>
      updateFilterState({
        coverModes: filterState.coverModes.filter((value) => value !== mode),
      })
    );
  }
  for (const relation of filterState.articleRelations) {
    pushChip("relation:" + relation, t(relationLabels[relation]), () =>
      updateFilterState({
        articleRelations: filterState.articleRelations.filter(
          (value) => value !== relation
        ),
      })
    );
  }
  if (filterState.savedOnly) {
    pushChip("saved", t("Только книги из личной полки"), () =>
      updateFilterState({ savedOnly: false })
    );
  }
  if (filterState.sort !== "editorial-relevance") {
    pushChip("sort", t(sortLabels[filterState.sort]), () =>
      updateFilterState({ sort: "editorial-relevance" })
    );
  }
  const searchSuggestionGroups = (
    Object.keys(searchGroupLabels) as GlobalSearchResult["group"][]
  ).flatMap((group) => {
    const results = activeSearchResponse.suggestions.filter(
      (result) => result.group === group
    );
    return results.length
      ? [{ group, label: searchGroupLabels[group], results }]
      : [];
  });
  const searchSuggestions =
    activeSearchResponse.normalizedQuery.length >=
    activeSearchProfile.minQueryLength ? (
      <div className="book-shelf-search-results">
        <div className="book-shelf-search-results__summary">
          <strong>
            {searchScope === "global"
              ? t("Подсказки единого каталога")
              : t("Подсказки библиотеки")}
          </strong>
          <span>
            {number(activeSearchResponse.totalMatches)} {t("совпадений")}
          </span>
        </div>
        <div className="book-shelf-search-results__groups">
          {searchSuggestionGroups.map((suggestionGroup) => (
            <section key={suggestionGroup.group}>
              <h4>{t(suggestionGroup.label)}</h4>
              <ul
                aria-label={
                  searchScope === "global"
                    ? t("Результаты поиска по всему журналу")
                    : t("Результаты поиска по библиотеке")
                }
              >
                {suggestionGroup.results.map((result) => (
                  <li key={result.key}>
                    <button
                      type="button"
                      onClick={() =>
                        activateGlobalSearchAction(result.activateAction)
                      }
                    >
                      <span>{result.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    ) : null;
  const compactTabLabel = (value: string) =>
    value
      ? `${value.slice(0, 1)}${value
          .slice(1)
          .toLocaleLowerCase(language === "en" ? "en" : "ru")}`
      : value;
  const shelfTabLabel = compactTabLabel(t("ПОЛКА"));
  const catalogTabLabel = compactTabLabel(t("КАТАЛОГ"));

  return (
    <section
      ref={archiveSectionRef}
      className={`book-archive-section${coreHomepageSectionClass(
        coreBookArchive
      )}`}
      id="books"
      style={coreHomepageSectionStyle(coreBookArchive)}
      {...cmsCoreFieldMarker(
        "book-archive",
        "backgroundMediaId",
        coreBookArchive?.backgroundImageUrl || "",
        { kind: "image", label: "Фон книжного архива" }
      )}
    >
      <header className="book-archive-heading">
        <div>
          <span
            className="section-kicker"
            {...cmsCoreFieldMarker(
              "book-archive",
              "eyebrow",
              coreBookArchive?.eyebrow || "Книги, авторы, страны",
              { label: "Надзаголовок книжного архива" }
            )}
          >
            {language === "ru" && coreBookArchive?.eyebrow
              ? coreBookArchive.eyebrow
              : t("Книги, авторы, страны")}
          </span>
          <h2
            {...cmsCoreFieldMarker(
              "book-archive",
              "title",
              coreBookArchive?.title || "Книжный архив",
              { label: "Заголовок книжного архива" }
            )}
          >
            {language === "ru" && coreBookArchive?.title
              ? coreBookArchive.title
              : t("Книжный архив")}
          </h2>
          <p
            {...cmsCoreFieldMarker(
              "book-archive",
              "description",
              coreBookArchive?.description ||
                "Произведения связаны с карточками писателей и литературными традициями стран. Расширенные сведения публикуются только после редакционной проверки.",
              { kind: "textarea", label: "Описание книжного архива" }
            )}
          >
            {language === "ru" && coreBookArchive?.description
              ? coreBookArchive.description
              : t(
                  "Произведения связаны с карточками писателей и литературными традициями стран. Расширенные сведения публикуются только после редакционной проверки."
                )}
          </p>
        </div>
        <div className="book-archive-total">
          <strong>{number(queue.counts.total)}</strong>
          <span>{t("произведений из единой базы стран")}</span>
        </div>
      </header>

      <BookShelfFrame
        viewMode={viewMode}
        themeStyle={frameThemeStyle}
        liveMessage={
          randomAnnouncement
            ? randomAnnouncement
            : shelfFailure
            ? t("Трёхмерная полка недоступна. Открыт безопасный каталог.")
            : navigationIndex >= 0
              ? `${number(navigationIndex + 1)} ${t("из")} ${number(navigationCount)}`
              : t("В архиве нет книг по выбранным условиям")
        }
      >
        <div className="book-shelf-frame__search-rail">
          <BookShelfControls
            query={query}
            onQueryChange={(value) => {
              setRandomAnnouncement("");
              setQuery(value);
            }}
            searchLabel={t("Поиск по книге, автору или стране")}
            searchPlaceholder={t("Например, Достоевский или Япония")}
            searchScope={searchScope}
            onSearchScopeChange={setSearchScope}
            libraryScopeLabel={t("Весь архив")}
            globalScopeLabel={t("Во всём журнале")}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              setRandomAnnouncement("");
              if (mode === "shelf") setShelfFailure(null);
              setViewMode(mode);
            }}
            shelfLabel={shelfTabLabel}
            catalogLabel={catalogTabLabel}
            randomLabel={t("Случайное произведение")}
            randomDescription={t(
              "Выбрать случайное произведение из всего архива"
            )}
            randomDisabled={!queue.all.length || navigationLocked}
            onRandomWork={openRandomWork}
            filters={quickFilterOptions}
            activeFilterId={filterState.quickPreset}
            onFilterChange={(id) => {
              setRandomAnnouncement("");
              applyQuickFilter(id as BookArchiveQuickPreset);
            }}
            resultCountLabel={`${number(filteredItems.length)} ${t("результатов")}`}
            formatCount={number}
            onOpenAdvancedFilters={openAdvancedFilters}
            advancedFiltersLabel={t("Расширенные фильтры")}
            suggestions={searchSuggestions}
          />
        </div>

        <div
          className="book-shelf-frame__active-rail"
          aria-label={t("Активные фильтры")}
        >
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              className="book-shelf-frame__filter-chip"
              type="button"
              onClick={chip.onRemove}
              aria-label={t("Удалить фильтр") + ": " + chip.label}
            >
              <span>{chip.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          {activeFilterChips.length > 0 ? (
            <>
              <button
                className="book-shelf-frame__filter-action"
                type="button"
                onClick={resetArchiveFilters}
              >
                {t("Сбросить")}
              </button>
              {searchScope === "library" ? (
                <button
                  className="book-shelf-frame__filter-action is-primary"
                  type="button"
                  onClick={saveCurrentAsSmartShelf}
                >
                  {t("Сохранить как умную полку")}
                </button>
              ) : null}
            </>
          ) : null}
          {personalCollectionStatus ? (
            <span
              className="book-shelf-frame__filter-status"
              role="status"
              aria-live="polite"
            >
              {personalCollectionStatus}
            </span>
          ) : null}
        </div>

        <div className="book-shelf-frame__collection">
          <div>
            <small>{t("Текущая полка")}</small>
            <strong>{activeCollectionLabel}</strong>
          </div>
          <span>
            {number(filteredItems.length)} {t("произведений")}
          </span>
        </div>

        <div className="book-shelf-frame__workspace">

      {selectedBook && (
        <aside className="book-shelf-frame__detail">
        <article
          ref={detailRef}
          id="book-archive-detail"
          className="book-detail-card"
          role="region"
          tabIndex={-1}
          aria-label={selectedBookText?.title || selectedBook.title}
          {...cmsBookEntityAttributes(
            selectedItem,
            bookKey(selectedBook),
            selectedBookText?.title || selectedBook.title,
            `/library?country_id=${encodeURIComponent(selectedBook.countryId)}&writer_id=${encodeURIComponent(selectedBook.writerId)}&work_id=${encodeURIComponent(bookKey(selectedBook))}`
          )}
        >
          <button
            className="book-detail-close"
            type="button"
            onClick={closeBookDetail}
            disabled={
              shelfState.phase === "INSPECTION_CLOSING" ||
              shelfState.phase === "SHELF_RESTORING"
            }
            aria-label={t("Закрыть карточку книги")}
          >
            <BrandCloseIcon />
          </button>
          <div
            className={`book-detail-cover${selectedCoverUrl ? " has-image" : ""}`}
            style={
              selectedCoverUrl
                ? {
                    backgroundImage: `url("${resolveCoverUrl(
                      selectedBook.coverThumbnailUrl || selectedCoverUrl
                    )}")`,
                  }
                : undefined
            }
          >
            {selectedCoverUrl ? (
              <img
                src={resolveCoverUrl(selectedCoverUrl)}
                srcSet={coverArtworkSrcSet(selectedBook, resolveCoverUrl)}
                sizes="(max-width: 680px) 82px, 96px"
                alt={
                  isEditorialCover(selectedBook)
                    ? `${t("Редакционная обложка")} «${selectedBookText?.title}»`
                    : `${t("Обложка конкретного издания")} «${selectedBookText?.title}»`
                }
                decoding="async"
              />
            ) : (
              <>
                <small>{selectedWriterName}</small>
                <strong>{selectedBookText?.title}</strong>
                <span aria-hidden="true">✦</span>
              </>
            )}
          </div>
          <div className="book-detail-copy">
            <span className="section-kicker">
              {selectedItem?.status === "verified"
                ? t("Проверено редакцией")
                : t("Не проверено")}
            </span>
            <h3
              {...cmsBookFieldAttributes(
                selectedItem,
                bookKey(selectedBook),
                "title",
                selectedBook.title,
                {
                  label: "Название произведения",
                  adminHref: `/library?country_id=${encodeURIComponent(selectedBook.countryId)}&writer_id=${encodeURIComponent(selectedBook.writerId)}&work_id=${encodeURIComponent(bookKey(selectedBook))}`,
                }
              )}
            >
              {selectedBookText?.title}
            </h3>
            {selectedItem?.status === "verified" && selectedBook.originalTitle && (
              <p
                className="book-original-title"
                {...cmsBookFieldAttributes(
                  selectedItem,
                  bookKey(selectedBook),
                  "originalTitle",
                  selectedBook.originalTitle,
                  {
                    label: "Название на языке оригинала",
                    adminHref: `/library?country_id=${encodeURIComponent(selectedBook.countryId)}&writer_id=${encodeURIComponent(selectedBook.writerId)}&work_id=${encodeURIComponent(bookKey(selectedBook))}`,
                  }
                )}
              >
                {selectedBook.originalTitle}
              </p>
            )}
            <dl>
              <div>
                <dt>{t("Автор")}</dt>
                <dd>{selectedWriterName}</dd>
              </div>
              <div>
                <dt>{t("Страна")}</dt>
                <dd>
                  {countryName(
                    selectedBook.country.code,
                    selectedBook.countryName
                  )}
                </dd>
              </div>
              {selectedItem?.status === "verified" &&
                selectedBook.firstPublished && (
                <div>
                  <dt>{t("Первая публикация")}</dt>
                  <dd
                    {...cmsBookFieldAttributes(
                      selectedItem,
                      bookKey(selectedBook),
                      "firstPublished",
                      selectedBook.firstPublished,
                      {
                        label: "Год первой публикации",
                        adminHref: `/library?country_id=${encodeURIComponent(selectedBook.countryId)}&writer_id=${encodeURIComponent(selectedBook.writerId)}&work_id=${encodeURIComponent(bookKey(selectedBook))}`,
                      }
                    )}
                  >
                    {selectedBook.firstPublished}
                  </dd>
                </div>
              )}
              {selectedOriginalLanguage && (
                <div>
                  <dt>{t("Язык оригинала")}</dt>
                  <dd
                    {...cmsBookFieldAttributes(
                      selectedItem,
                      bookKey(selectedBook),
                      "originalLanguage",
                      selectedBook.originalLanguage || "",
                      {
                        label: "Язык оригинала",
                        adminHref: `/library?country_id=${encodeURIComponent(selectedBook.countryId)}&writer_id=${encodeURIComponent(selectedBook.writerId)}&work_id=${encodeURIComponent(bookKey(selectedBook))}`,
                      }
                    )}
                  >
                    {selectedOriginalLanguage}
                  </dd>
                </div>
              )}
            </dl>
            {selectedBookText?.description && (
              <p
                {...cmsBookFieldAttributes(
                  selectedItem,
                  bookKey(selectedBook),
                  "description",
                  selectedBook.description || selectedBookText.description,
                  {
                    kind: "textarea",
                    label: "Описание произведения",
                    adminHref: `/library?country_id=${encodeURIComponent(selectedBook.countryId)}&writer_id=${encodeURIComponent(selectedBook.writerId)}&work_id=${encodeURIComponent(bookKey(selectedBook))}`,
                  }
                )}
              >
                {selectedBookText.description}
              </p>
            )}
            {selectedMetadataLabels.length > 0 && (
              <div className="book-tags" aria-label={t("Темы и жанры книги")}>
                {selectedMetadataLabels.slice(0, 6).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
            <div className="book-detail-actions">
              {viewMode === "shelf" &&
              (shelfState.phase === "INSPECTION_CLOSED" ||
                shelfState.phase === "COVER_CRACKED") ? (
                <button
                  type="button"
                  className="book-detail-open-cover"
                  onClick={() =>
                    requestSelectedCoverOpen(bookKey(selectedBook))
                  }
                >
                  {t("Открыть книгу")}
                </button>
              ) : null}
              {viewMode === "shelf" && shelfState.phase === "BOOK_OPEN" ? (
                <button
                  type="button"
                  className="book-detail-page-turn"
                  onClick={requestSelectedPageTurn}
                >
                  {t("Перелистнуть страницу")}
                </button>
              ) : null}
              <button
                type="button"
                className={isBookSaved(selectedBook) ? "is-saved" : ""}
                aria-pressed={isBookSaved(selectedBook)}
                onClick={() => toggleBook(selectedBook)}
              >
                <BrandHeartIcon filled={isBookSaved(selectedBook)} />
                {isBookSaved(selectedBook)
                  ? t("Сохранено в библиотеке")
                  : t("Добавить в мою библиотеку")}
              </button>
              <button
                type="button"
                onClick={() => onBookSelect(selectedBook)}
              >
                {t("Открыть автора и страну")} <span>→</span>
              </button>
              {selectedBook.sourceUrl && (
                <a
                  href={selectedBook.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedItem?.status === "verified"
                    ? t("Источник сведений")
                    : t("Исходная запись кандидата")}
                </a>
              )}
              {isEditorialCover(selectedBook) ? (
                <span className="book-cover-credit">
                  {t("Редакционная обложка «Пробы Пера»")}
                </span>
              ) : selectedBook.coverSourceUrl ? (
                <a
                  href={resolveCoverUrl(selectedBook.coverSourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Источник обложки")}
                </a>
              ) : null}
              {selectedBook.coverRights && (
                <span className="cover-rights-note">
                  {selectedBook.coverRights.status === "external-preview"
                    ? t("Внешнее превью · файл не хранится на сайте")
                    : selectedBook.coverRights.status === "editorial-original"
                      ? t(
                          "Редакционная обложка «Пробы Пера» · не является обложкой конкретного издания"
                        )
                    : selectedBook.coverRights.licenseName ||
                      t("Права на изображение проверены")}
                </span>
              )}
              {selectedItem?.status === "verified" &&
                selectedBook.edition?.publisher && (
                <div className="book-edition-meta">
                  <span>{t("Издание на обложке")}</span>
                  <strong>
                    {selectedBook.edition.publisher}
                    {selectedBook.edition.publicationYear
                      ? ` · ${selectedBook.edition.publicationYear}`
                      : ""}
                  </strong>
                </div>
              )}
              {selectedItem?.status === "verified" &&
                (selectedBook.edition?.isbn13 || selectedBook.edition?.isbn10) && (
                <div className="book-edition-meta">
                  <span>ISBN</span>
                  <strong>
                    {selectedBook.edition.isbn13 || selectedBook.edition.isbn10}
                  </strong>
                </div>
              )}
            </div>
            {(relatedArticlesLoading || relatedArticles.length > 0) && (
              <section
                className="book-journal-mentions"
                aria-busy={relatedArticlesLoading}
              >
                <header>
                  <div>
                    <span>{t("Книга в журнале")}</span>
                    <h4>{t("Статьи и упоминания")}</h4>
                  </div>
                  {!relatedArticlesLoading && (
                    <strong>{number(relatedArticles.length)}</strong>
                  )}
                </header>
                {relatedArticlesLoading ? (
                  <p>{t("Ищем материалы о книге…")}</p>
                ) : (
                  <div>
                    {relatedArticles.map((article) => (
                      <a
                        href={articlePath(
                          article.id,
                          article.title,
                          article.sectionId,
                          article.slug
                        )}
                        key={article.id}
                      >
                        <span>
                          {article.kind === "review"
                            ? t("Статья о книге")
                            : article.kind === "feature"
                              ? t("Материал о книге")
                              : t("Книга упоминается")}
                        </span>
                        <strong>{article.title}</strong>
                        <small>
                          {article.sectionLabel} ·{" "}
                          {number(article.readingMinutes)} {t("мин.")}
                        </small>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
          <ArticleEngagement
            articleSlug={`book:${bookKey(selectedBook)}`}
            subjectType="book"
          />
        </article>
        </aside>
      )}

          <div className="book-shelf-frame__primary">
            <div
              className="book-shelf-frame__scene"
              hidden={viewMode !== "shelf"}
            >
              <div
                className="book-shelf-frame__cms-background"
                aria-hidden="true"
              />
              {viewMode === "shelf" && (
                <BookShelfScene
                  key={sceneLoadGeneration}
                  items={sceneItems}
                  appearance={sceneAppearance}
                  focusedBookKey={focusedBookKey}
                  selectedBookKey={selectedBook ? bookKey(selectedBook) : null}
                  phase={shelfState.phase}
                  requestId={shelfState.requestId}
                  active={
                    sceneNearViewport || Boolean(selectedBook || requestedBook)
                  }
                  economical={economicalRendering}
                  reducedMotion={reducedMotion}
                  loadAttempt={sceneLoadGeneration === 0 ? "primary" : "retry"}
                  onFocusBook={requestFocusBook}
                  onOpenBook={(key) => {
                    const item = queueByKey.get(key);
                    if (item) {
                      setRandomAnnouncement("");
                      openBookDetail(item.book);
                    }
                  }}
                  onRequestCoverOpen={requestSelectedCoverOpen}
                  onRequestPageTurn={requestSelectedPageTurn}
                  onRequestInspectionClose={closeBookDetail}
                  onCrackCover={() =>
                    shelfDispatch({
                      type: "crack-cover",
                      requestId: shelfState.requestId + 1,
                    })
                  }
                  onStartPageDrag={() =>
                    shelfDispatch({
                      type: "start-page-drag",
                      requestId: shelfState.requestId + 1,
                    })
                  }
                  onRequestPageSettle={() =>
                    shelfDispatch({
                      type: "request-page-settle",
                      requestId: shelfState.requestId + 1,
                    })
                  }
                  onMotionReached={(requestId) =>
                    shelfDispatch({ type: "motion-reached", requestId })
                  }
                  onMotionSettled={(requestId) =>
                    shelfDispatch({ type: "motion-settled", requestId })
                  }
                  onInspectionEntered={(requestId) =>
                    shelfDispatch({ type: "inspection-entered", requestId })
                  }
                  onCoverOpened={(requestId) =>
                    shelfDispatch({ type: "cover-opened", requestId })
                  }
                  onPageSettled={(requestId) =>
                    shelfDispatch({ type: "page-settled", requestId })
                  }
                  onInspectionClosed={(requestId) =>
                    shelfDispatch({ type: "inspection-closed", requestId })
                  }
                  onShelfRestored={handleShelfRestored}
                  onFailure={handleShelfFailure}
                  sceneLabel={t("Книжный архив")}
                  loadingLabel={t("Собираем виртуальную полку…")}
                  emptyLabel={t("На этой полке пока нет книг")}
                  openBookLabel={t("Открыть книгу")}
                  pageTurnLabel={t("Перелистнуть страницу")}
                  closeInspectionLabel={t("Закрыть карточку книги")}
                />
              )}
              {viewMode === "shelf" &&
              !selectedBook &&
              shelfState.phase === "SHELF_IDLE" &&
              sceneItems.length ? (
                <button
                  className="book-shelf-scene-hint"
                  type="button"
                  onClick={(event) => {
                    const item =
                      (focusedBookKey && queueByKey.get(focusedBookKey)) ||
                      sceneQueueItems[0];
                    if (!item) return;
                    setRandomAnnouncement("");
                    openBookDetail(item.book, event.currentTarget);
                  }}
                  aria-label={`${t("Выберите книгу")}. ${t(
                    "Нажмите на корешок — книга выйдет вперёд, а справа откроются описание и сведения."
                  )}`}
                >
                  <BrandBookIcon />
                  <span>
                    <strong>{t("Выберите книгу")}</strong>
                    <small>
                      {t(
                        "Нажмите на корешок — книга выйдет вперёд, а справа откроются описание и сведения."
                      )}
                    </small>
                  </span>
                </button>
              ) : null}
            </div>
            <div
              className="book-shelf-frame__catalog"
              hidden={viewMode !== "catalog"}
            >
      <div className="book-archive-grid">
        {visibleItems.map((item) => {
          const { book } = item;
          const localizedBook = presentBookArchiveQueueItem(item, language);
          const coverUrl = isCoverArtworkDisplayAllowed(book)
            ? book.coverThumbnailUrl || book.coverUrl
            : undefined;
          return (
          <article
            className="archive-book-card"
            key={bookKey(book)}
            {...cmsBookEntityAttributes(
              item,
              bookKey(book),
              localizedBook.title,
              `/library?country_id=${encodeURIComponent(book.countryId)}&writer_id=${encodeURIComponent(book.writerId)}&work_id=${encodeURIComponent(bookKey(book))}`
            )}
          >
            <div
              className={`archive-book-cover${coverUrl ? " has-image" : ""}`}
            >
              {coverUrl ? (
                <>
                  <img
                    className="archive-book-cover-backdrop"
                    src={resolveCoverUrl(coverUrl)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                  <img
                    src={resolveCoverUrl(coverUrl)}
                    srcSet={coverArtworkSrcSet(book, resolveCoverUrl)}
                    sizes="(max-width: 680px) 42vw, 190px"
                    alt={
                      isEditorialCover(book)
                        ? `${t("Редакционная обложка")} «${localizedBook.title}»`
                        : `${t("Обложка конкретного издания")} «${localizedBook.title}»`
                    }
                    loading="lazy"
                    decoding="async"
                  />
                </>
              ) : (
                <>
                  <small>
                    {selectBookWriterName(book, language, t("Автор"))}
                  </small>
                  <strong>{localizedBook.title}</strong>
                  <span aria-hidden="true">✦</span>
                </>
              )}
            </div>
            <div className="archive-book-copy">
              <small>
                {countryName(book.country.code, book.countryName)}
                {item.status === "verified" && book.firstPublished
                  ? ` · ${book.firstPublished}`
                  : ""}
              </small>
              <h3
                {...cmsBookFieldAttributes(
                  item,
                  bookKey(book),
                  "title",
                  book.title,
                  {
                    label: "Название произведения",
                    adminHref: `/library?country_id=${encodeURIComponent(book.countryId)}&writer_id=${encodeURIComponent(book.writerId)}&work_id=${encodeURIComponent(bookKey(book))}`,
                  }
                )}
              >
                {localizedBook.title}
              </h3>
              <p>{selectBookWriterName(book, language, t("Автор"))}</p>
              <div className="archive-book-actions">
                <span
                  className={`editorial-state is-${item.status === "verified" ? "verified" : "draft"}`}
                >
                  {item.status === "verified"
                    ? t("проверено")
                    : t("Не проверено")}
                </span>
                <button
                  className={
                    isBookSaved(book)
                      ? "archive-book-save is-saved"
                      : "archive-book-save"
                  }
                  type="button"
                  aria-pressed={isBookSaved(book)}
                  aria-label={
                    isBookSaved(book)
                      ? `${t("Удалить")} «${localizedBook.title}» ${t("из библиотеки")}`
                      : `${t("Добавить")} «${localizedBook.title}» ${t("в библиотеку")}`
                  }
                  title={
                    isBookSaved(book)
                      ? t("Сохранено в библиотеке")
                      : t("Сохранить книгу")
                  }
                  onClick={() => toggleBook(book)}
                >
                  <BrandHeartIcon filled={isBookSaved(book)} />
                </button>
                <button
                  className="archive-book-detail"
                  type="button"
                  data-book-key={bookKey(book)}
                  aria-expanded={
                    selectedBook ? bookKey(selectedBook) === bookKey(book) : false
                  }
                  aria-controls={
                    selectedBook && bookKey(selectedBook) === bookKey(book)
                      ? "book-archive-detail"
                      : undefined
                  }
                  onClick={(event) =>
                    openBookDetail(book, event.currentTarget)
                  }
                >
                  {t("О книге")}
                </button>
              </div>
            </div>
          </article>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="book-archive-empty" role="status" aria-live="polite">
          <strong>{t("Ничего не найдено")}</strong>
          <p>{t("Попробуйте другое название, автора, страну или фильтр.")}</p>
          <button
            type="button"
            onClick={resetArchiveFilters}
          >
            {t("Весь архив")}
          </button>
        </div>
      )}

      {visibleCount < filteredItems.length && (
        <button
          className="book-archive-more"
          type="button"
          onClick={() =>
            setVisibleCount(
              (current) => current + COMPLETE_SHELF_MAX_WORKING_SET
            )
          }
        >
          {t("Показать ещё 13")}
          <span>
            {language === "en"
              ? `${number(visibleItems.length)} of ${number(filteredItems.length)}`
              : `${number(visibleItems.length)} из ${number(filteredItems.length)}`}
          </span>
        </button>
      )}
            </div>
          </div>
        </div>

        <div className="book-shelf-frame__navigation">
          <button
            type="button"
            className="book-shelf-navigation__previous"
            onClick={() => focusBookAt(focusedIndex <= 0 ? filteredItems.length - 1 : focusedIndex - 1)}
            disabled={!filteredItems.length || navigationLocked}
            aria-label={t("Предыдущая книга")}
          >
            <BrandArrowIcon />
            <span>{t("Назад")}</span>
          </button>
          <div className="book-shelf-navigation__position">
            <button
              className="is-edge"
              type="button"
              onClick={() => focusBookAt(0)}
              disabled={!filteredItems.length || navigationLocked || focusedIndex <= 0}
              aria-label={t("Предыдущая книга")}
            >
              <span aria-hidden="true">|</span>
              <BrandArrowIcon />
            </button>
            <button
              className="book-shelf-navigation__batch"
              type="button"
              onClick={() =>
                focusBookAt(focusedIndex - COMPLETE_SHELF_MAX_WORKING_SET)
              }
              disabled={!filteredItems.length || navigationLocked}
              aria-label={t("Предыдущие 13 произведений")}
              title={t("Предыдущие 13 произведений")}
            >
              <BrandArrowIcon />
              <span>13</span>
            </button>
            <button
              className="book-shelf-navigation__single"
              type="button"
              onClick={() => focusBookAt(focusedIndex <= 0 ? filteredItems.length - 1 : focusedIndex - 1)}
              disabled={!filteredItems.length || navigationLocked}
              aria-label={t("Предыдущая книга")}
            >
              <BrandArrowIcon />
            </button>
            <span className="book-shelf-navigation__count">
              {navigationIndex >= 0 ? (
                <>
                  <strong>{number(navigationIndex + 1)}</strong>
                  <small>{t("из")} {number(navigationCount)}</small>
                </>
              ) : (
                <small>{t("Полка пуста")}</small>
              )}
            </span>
            <button
              className="book-shelf-navigation__single"
              type="button"
              onClick={() => focusBookAt(focusedIndex + 1)}
              disabled={!filteredItems.length || navigationLocked}
              aria-label={t("Следующая книга")}
            >
              <BrandArrowIcon />
            </button>
            <button
              className="book-shelf-navigation__batch"
              type="button"
              onClick={() =>
                focusBookAt(focusedIndex + COMPLETE_SHELF_MAX_WORKING_SET)
              }
              disabled={!filteredItems.length || navigationLocked}
              aria-label={t("Следующие 13 произведений")}
              title={t("Следующие 13 произведений")}
            >
              <span>13</span>
              <BrandArrowIcon />
            </button>
            <button
              className="is-edge"
              type="button"
              onClick={() => focusBookAt(filteredItems.length - 1)}
              disabled={
                !filteredItems.length ||
                navigationLocked ||
                focusedIndex >= filteredItems.length - 1
              }
              aria-label={t("Следующая книга")}
            >
              <BrandArrowIcon />
              <span aria-hidden="true">|</span>
            </button>
          </div>
          <div className="book-shelf-navigation__actions">
            <button
              type="button"
              className={
                navigationActionBook && isBookFavorite(navigationActionBook)
                  ? "is-saved"
                  : ""
              }
              onClick={() =>
                navigationActionBook && toggleBookFavorite(navigationActionBook)
              }
              disabled={!navigationActionBook}
              aria-pressed={
                navigationActionBook
                  ? isBookFavorite(navigationActionBook)
                  : false
              }
            >
              <BrandHeartIcon
                filled={
                  navigationActionBook
                    ? isBookFavorite(navigationActionBook)
                    : false
                }
              />
              <span>{t("Избранное")}</span>
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => navigationActionBook && toggleBook(navigationActionBook)}
              disabled={!navigationActionBook}
            >
              <span aria-hidden="true">＋</span>
              <span>{language === "en" ? "Add to shelf" : "Добавить на полку"}</span>
            </button>
          </div>
        </div>

        {advancedFiltersOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                className="book-shelf-frame__filter-backdrop is-open"
          aria-hidden={!advancedFiltersOpen}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAdvancedFilters();
          }}
        >
          <aside
            ref={filterDrawerRef}
            className="book-shelf-frame__filter-drawer"
            role="dialog"
            aria-modal={advancedFiltersOpen ? "true" : undefined}
            aria-label={t("Расширенные фильтры книжного архива")}
            hidden={!advancedFiltersOpen}
          >
            <header className="book-shelf-filter-drawer__header">
              <div>
                <span>{t("Точный отбор")}</span>
                <h3>{t("Расширенные фильтры")}</h3>
              </div>
              <button
                type="button"
                onClick={closeAdvancedFilters}
                aria-label={t("Закрыть фильтры")}
              >
                <BrandCloseIcon />
              </button>
            </header>
            <p>
              {t("Фильтры применяются по правилу И между категориями и ИЛИ внутри категории. Непроверенные метаданные не угадываются.")}
            </p>
            {advancedFiltersOpen && (
              <div className="book-shelf-filter-drawer__form">
                <label className="book-shelf-filter-drawer__select">
                  <span>{t("Автор")}</span>
                  <select
                    value={filterState.authorKey || ""}
                    onChange={(event) =>
                      updateFilterState({
                        authorKey: event.target.value || null,
                      })
                    }
                  >
                    <option value="">{t("Все авторы")}</option>
                    {authorOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} — {option.countryLabel} (
                        {number(option.count)})
                      </option>
                    ))}
                  </select>
                </label>
                {selectedAuthorOption && (
                  <div className="book-shelf-filter-drawer__author-context">
                    {selectedAuthorOption.writer && (
                      <WriterPortrait
                        writer={selectedAuthorOption.writer}
                        decorative
                        className="book-shelf-filter-drawer__author-portrait"
                      />
                    )}
                    <span>
                      <strong>{selectedAuthorOption.label}</strong>
                      <small>
                        {selectedAuthorOption.countryLabel} ·{" "}
                        {number(selectedAuthorOption.count)} {t("произведений")}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCollectionId(
                          "author:" + selectedAuthorOption.key
                        );
                        closeAdvancedFilters();
                      }}
                    >
                      {t("Открыть полку автора")}
                    </button>
                  </div>
                )}

                <label className="book-shelf-filter-drawer__select">
                  <span>{t("Сортировка")}</span>
                  <select
                    value={filterState.sort}
                    onChange={(event) =>
                      updateFilterState({
                        sort: event.target.value as BookArchiveSort,
                      })
                    }
                  >
                    {BOOK_ARCHIVE_SORTS.map((sort) => (
                      <option key={sort} value={sort}>
                        {t(sortLabels[sort])}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend>{t("Страны")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {countryOptions.map(([id, label]) => (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={filterState.countryIds.includes(id)}
                          onChange={(event) =>
                            updateFilterState({
                              countryIds: toggleFacetValue(
                                filterState.countryIds,
                                id,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>{t("Жанры")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {BOOK_ARCHIVE_GENRES.filter((genre) =>
                      facetIndex.indexes.genre.has(genre.id)
                    ).map((genre) => (
                      <label key={genre.id}>
                        <input
                          type="checkbox"
                          checked={filterState.genreIds.includes(genre.id)}
                          onChange={(event) =>
                            updateFilterState({
                              genreIds: toggleFacetValue(
                                filterState.genreIds,
                                genre.id,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>{t(genre.aliases[0])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset
                  disabled={
                    facetIndex.diagnostics.audienceFacetStatus === "unavailable"
                  }
                >
                  <legend>{t("Аудитория")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {BOOK_ARCHIVE_AUDIENCES.map((audience) => (
                      <label key={audience}>
                        <input
                          type="checkbox"
                          checked={filterState.audienceIds.includes(audience)}
                          onChange={(event) =>
                            updateFilterState({
                              audienceIds: toggleFacetValue(
                                filterState.audienceIds,
                                audience,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>{t(audienceLabels[audience])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>{t("Период")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {BOOK_ARCHIVE_PERIODS.map((period) => (
                      <label key={period}>
                        <input
                          type="checkbox"
                          checked={filterState.periods.includes(period)}
                          onChange={(event) =>
                            updateFilterState({
                              periods: toggleFacetValue(
                                filterState.periods,
                                period,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>{t(periodLabels[period])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>{t("Язык оригинала")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {BOOK_ARCHIVE_LANGUAGES.filter((definition) =>
                      facetIndex.indexes.language.has(definition.id)
                    ).map((definition) => (
                      <label key={definition.id}>
                        <input
                          type="checkbox"
                          checked={filterState.originalLanguageIds.includes(
                            definition.id
                          )}
                          onChange={(event) =>
                            updateFilterState({
                              originalLanguageIds: toggleFacetValue(
                                filterState.originalLanguageIds,
                                definition.id,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>
                          {t(
                            definition.aliases.find((alias) =>
                              /[а-яё]/iu.test(alias)
                            ) || definition.id.toUpperCase()
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>{t("Редакционный статус")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {(["verified", "pending"] as const).map((status) => (
                      <label key={status}>
                        <input
                          type="checkbox"
                          checked={filterState.editorialStatuses.includes(status)}
                          onChange={(event) =>
                            updateFilterState({
                              editorialStatuses: toggleFacetValue(
                                filterState.editorialStatuses,
                                status,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>
                          {status === "verified"
                            ? t("Проверено редакцией")
                            : t("Не проверено")}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>{t("Тип обложки")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {BOOK_ARCHIVE_COVER_MODES.map((mode) => (
                      <label key={mode}>
                        <input
                          type="checkbox"
                          checked={filterState.coverModes.includes(mode)}
                          onChange={(event) =>
                            updateFilterState({
                              coverModes: toggleFacetValue(
                                filterState.coverModes,
                                mode,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>{t(coverLabels[mode])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset
                  disabled={
                    facetIndex.diagnostics.relationFacetStatus === "unavailable"
                  }
                >
                  <legend>{t("Связь со статьями")}</legend>
                  <div className="book-shelf-filter-drawer__options">
                    {BOOK_ARCHIVE_ARTICLE_RELATIONS.map((relation) => (
                      <label key={relation}>
                        <input
                          type="checkbox"
                          checked={filterState.articleRelations.includes(
                            relation
                          )}
                          onChange={(event) =>
                            updateFilterState({
                              articleRelations: toggleFacetValue(
                                filterState.articleRelations,
                                relation,
                                event.target.checked
                              ),
                            })
                          }
                        />
                        <span>{t(relationLabels[relation])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="book-shelf-filter-drawer__saved">
                  <input
                    type="checkbox"
                    checked={filterState.savedOnly}
                    onChange={(event) =>
                      updateFilterState({ savedOnly: event.target.checked })
                    }
                  />
                  <span>{t("Только книги из личной полки")}</span>
                </label>
              </div>
            )}
            <dl className="book-shelf-filter-drawer__coverage">
              <div>
                <dt>{t("Аудитория")}</dt>
                <dd>
                  {facetIndex.diagnostics.audienceFacetStatus === "available"
                    ? t("Используются только проверенные профили аудитории")
                    : t("Недоступно: проверенные профили аудитории отсутствуют")}
                </dd>
              </div>
              <div>
                <dt>{t("Связь со статьями")}</dt>
                <dd>
                  {facetIndex.diagnostics.relationFacetStatus === "available"
                    ? t("Используется редакционный индекс связей")
                    : t("Индекс связей пока недоступен")}
                </dd>
              </div>
            </dl>
            <button
              className="book-shelf-filter-drawer__reset"
              type="button"
              onClick={resetArchiveFilters}
            >
              {t("Сбросить фильтры")}
            </button>
                </aside>
              </div>,
              document.body
            )
          : null}
      </BookShelfFrame>
    </section>
  );
}
