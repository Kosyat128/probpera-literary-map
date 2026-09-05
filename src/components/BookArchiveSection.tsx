import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
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
import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  deriveSystemBookCollections,
  parseBookCollection,
  type BookCollectionSnapshot,
} from "../books/bookCollections";
import {
  BOOK_COLLECTION_ALL_SHELF_ID,
  selectBookCollectionShelf,
} from "../books/bookCollectionShelfSelector";
import type { BookCollectionMembershipShelf } from "../books/bookCollectionMembershipDialog";
import {
  chooseRandomBookArchiveItem,
  rememberRandomBookArchiveItem,
} from "../books/bookArchiveDiscovery";
import {
  BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY,
  BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY,
  BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION,
  bookArchiveArticleFocusOrigin,
  parseBookArchiveLocation,
  parseBookArchiveNavigationContext,
  readBookArchiveNavigationContext,
  serializeBookArchiveLocation,
  serializeBookArchiveNavigationContext,
  writeBookArchiveNavigationContext,
  type BookArchiveNavigationContext,
  type BookArchiveNavigationFocusOrigin,
} from "../books/bookArchiveLocation";
import { COMPLETE_SHELF_CATALOG_BATCH_SIZE } from "../books/completeShelfModel";
import {
  accumulateBookShelfWheelIntent,
  clampBookShelfFocusIndex,
  getBookShelfNavigationState,
  resolveBookShelfKeyboardNavigation,
  resolveBookShelfSwipeIntent,
} from "../books/bookShelfNavigation";
import {
  bookShelfStateReducer,
  createInitialBookShelfState,
} from "../books/bookShelfState";
import {
  bookShelfMobileDetailReducer,
  createInitialBookShelfMobileDetailState,
  getBookShelfMobileDetailMotion,
  type BookShelfMobileDetailPosition,
} from "../books/bookShelfMobileDetail";
import {
  BOOK_SHELF_QUALITY_PROFILES,
  bookShelfQualityControllerSettings,
  createBookShelfQualityController,
  reduceBookShelfQualityController,
  type BookShelfQualityPreference,
  type BookShelfQualitySignals,
} from "../books/bookShelfQualityController";
import { resolveBookShelfPresentationProfile } from "../books/bookShelfPresentationProfiles";
import { buildBookEditorialDocument } from "../books/bookEditorialPages";
import { buildBookDossierFromEditorial, toBookEditorialDocument } from "../books/bookDossierLegacyAdapter";
import { BOOK_DOSSIER_LIMITS, type BookDossierSemanticAnchor } from "../books/bookDossierDocument";
import { paginateBookInspectionDocument, type BookInspectionPaginationResult } from "../books/bookInspectionPageLayout";
import BookDossierReader from "./BookDossierReader";
import { useBookShelfViewportInsets } from "../books/useBookShelfViewportInsets";
import { ownerPaletteSlotForBookKey } from "../books/bookOwnerSpineIdentity";
import { usePublishedBookDossier } from "../books/usePublishedBookDossier";
import type { BookShelfSpineHit } from "../books/bookShelfPointer";
import BookShelfSpineTooltip from "./BookShelfSpineTooltip";
import {
  beginBookInspectionDrag,
  createBookInspectionSession,
  remapBookInspectionSessionPages,
  endBookInspectionDrag,
  getBookInspectionKeyboardTarget,
  getNextBookInspectionPageTarget,
  getPreviousBookInspectionPageTarget,
  settleBookInspectionSession,
  updateBookInspectionDrag,
  type BookInspectionPageDirection,
  type BookInspectionSession,
} from "../books/bookInspectionSession";
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
import {
  articlePath,
  navigateToArticle,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import {
  cmsCoreFieldMarker,
  cmsEntityFieldMarker,
  cmsEntityMarker,
} from "../cms/directEditBridge";
import { normalizeLiterarySearch } from "../utils/literarySearch";
import {
  commitAtlasUrlState,
  readAtlasUrlState,
} from "../utils/atlasUrlState";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";
import {
  BOOKS_GLOBAL_SEARCH_PROFILE,
  BOOKS_LIBRARY_SEARCH_PROFILE,
  loadGlobalSearchArticleCatalog,
  searchGlobalSearchIndex,
  type GlobalSearchActivateAction,
  type GlobalSearchExtensionDocument,
  type GlobalSearchIndex,
  type GlobalSearchResponse,
  type GlobalSearchResult,
} from "../search/globalSearchIndex";
import {
  emptyGlobalSearchIndex,
  ensureSharedGlobalSearchIndex,
  extendSharedGlobalSearchIndex,
  globalSearchArchiveVersion,
  globalSearchRequestCacheKey,
  peekSharedGlobalSearchIndex,
} from "../search/globalSearchRuntime";
import BrandHeartIcon from "./BrandHeartIcon";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandArrowIcon from "./BrandArrowIcon";
import BrandBookIcon from "./BrandBookIcon";
import BookCollectionMembershipDialog from "./BookCollectionMembershipDialog";
import BookCollectionManagerSheet, {
  type ManagedBookCollection,
} from "./BookCollectionManagerSheet";
import BookCollectionShelfSwitcher from "./BookCollectionShelfSwitcher";
import type {
  BookCollectionManagerBookItem,
  BookCollectionManagerUpdate,
} from "../books/bookCollectionManager";
import BookShelfControls, {
  type BookShelfQuickFilterOption,
  type BookShelfSearchScope,
  type BookShelfViewMode,
} from "./BookShelfControls";
import BookShelfFrame from "./BookShelfFrame";
import BookShelfProgressRail from "./BookShelfProgressRail";
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
  requestedBookReturnFocus?: HTMLElement | null;
  onRequestedBookHandled?: () => void;
};

const shelfKeyboardInstructions = {
  ru: "Книжная полка. Стрелки выбирают книгу, Enter открывает её.",
  en: "Bookshelf. Use arrow keys to select a book and Enter to open it.",
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
    description: "Первое издание - не позднее 1945 года",
  },
  {
    id: "modern",
    label: "Послевоенная и современная литература",
    description: "Первое издание - с 1946 года по настоящее время",
  },
  {
    id: "with-cover",
    label: "С обложкой",
    description: "Только обложки с разрешёнными правами",
  },
  {
    id: "saved",
    label: "В моей библиотеке",
    description: "Сохранённые книги независимо от статуса чтения",
  },
];

const periodLabels: Record<BookArchivePeriod, string> = {
  "pre-1800": "До 1800 года",
  xix: "XIX век",
  "1900-1945": "1900-1945",
  "1946-1999": "1946-1999",
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
  return parseBookArchiveLocation(search).bookKey;
}

const bookDetailShelfChangedStateKey = "probperaBookDetailShelfChanged";
const bookShelfQualityStorageKey = "probpera-book-shelf-quality";

function readBookShelfQualityPreference(): BookShelfQualityPreference {
  if (typeof window === "undefined") return "auto";
  const stored = readWebStorage("local", bookShelfQualityStorageKey);
  return stored === "auto" ||
    BOOK_SHELF_QUALITY_PROFILES.includes(
      stored as (typeof BOOK_SHELF_QUALITY_PROFILES)[number]
    )
    ? (stored as BookShelfQualityPreference)
    : "auto";
}

function collectBookShelfQualitySignals(
  preference: BookShelfQualityPreference,
  reducedMotion: boolean
): BookShelfQualitySignals {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { viewportWidth: 1280, preference, reducedMotion };
  }
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    deviceMemoryGb: device.deviceMemory,
    hardwareConcurrency: device.hardwareConcurrency,
    saveData: device.connection?.saveData === true,
    reducedMotion,
    preference,
  };
}

function readInitialBookArchiveNavigationContext(): BookArchiveNavigationContext | null {
  if (typeof window === "undefined") return null;
  const historyContext = parseBookArchiveNavigationContext(
    typeof window.history.state?.[BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY] === "string"
      ? window.history.state[BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY]
      : null
  );
  if (historyContext) return historyContext;
  try {
    const sessionContext = readBookArchiveNavigationContext(
      window.sessionStorage
    );
    if (!sessionContext) return null;
    const location = parseBookArchiveLocation(window.location.search);
    if (
      (location.shelfId && location.shelfId === sessionContext.shelfId) ||
      (location.bookKey &&
        (location.bookKey === sessionContext.selectedBookKey ||
          location.bookKey === sessionContext.focusedBookKey))
    ) {
      return sessionContext;
    }
  } catch {
    return null;
  }
  return null;
}

function replaceBookLocation(
  key: string | null,
  mode: "push" | "replace" = "replace"
) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (key) url.hash = "books";
  const target = serializeBookArchiveLocation(
    { pathname: url.pathname, search: url.search, hash: url.hash },
    { bookKey: key }
  );
  const nextState: Record<string, unknown> = {
    ...(window.history.state || {}),
  };
  const isAppOpenedDetail = Boolean(
    nextState[BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY]
  );
  if (key && (mode === "push" || isAppOpenedDetail)) {
    nextState[BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY] = key;
    if (mode === "push") delete nextState[bookDetailShelfChangedStateKey];
  } else {
    delete nextState[BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY];
    delete nextState[bookDetailShelfChangedStateKey];
  }
  window.history[mode === "push" ? "pushState" : "replaceState"](
    nextState,
    "",
    target
  );
}

function replaceBookShelfLocation(
  shelfId: string,
  mode: "push" | "replace" = "push"
) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const target = serializeBookArchiveLocation(
    { pathname: url.pathname, search: url.search, hash: url.hash },
    {
      shelfId:
        shelfId === BOOK_COLLECTION_ALL_SHELF_ID ? null : shelfId,
    }
  );
  const nextState: Record<string, unknown> = {
    ...(window.history.state || {}),
    probperaBookArchiveShelf: shelfId,
  };
  if (nextState[BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY]) {
    nextState[bookDetailShelfChangedStateKey] = true;
  }
  window.history[mode === "push" ? "pushState" : "replaceState"](
    nextState,
    "",
    target
  );
}

function resolveCoverUrl(url?: string) {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\/+/, "")}`;
}

function createInitialBookShelfControllerState(
  forcedColors: boolean,
  initialViewMode: BookShelfViewMode = "shelf"
) {
  const shelfState = createInitialBookShelfState(initialViewMode);
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
  requestedBookReturnFocus,
  onRequestedBookHandled,
}: Props) {
  const [initialNavigationContext] = useState(
    readInitialBookArchiveNavigationContext
  );
  const [query, setQuery] = useState(
    initialNavigationContext?.search.query || ""
  );
  const [filterState, setFilterState] = useState<BookArchiveFilterState>(() =>
    normalizeBookArchiveFilterState(
      initialNavigationContext
        ? { ...initialNavigationContext.filters, query: "" }
        : undefined
    )
  );
  const [smartShelfStatus, setSmartShelfStatus] = useState("");
  const [activeShelfId, setActiveShelfId] = useState(() => {
    if (typeof window === "undefined") return BOOK_COLLECTION_ALL_SHELF_ID;
    return (
      parseBookArchiveLocation(window.location.search).shelfId ||
      initialNavigationContext?.shelfId ||
      BOOK_COLLECTION_ALL_SHELF_ID
    );
  });
  const [visibleCount, setVisibleCount] = useState(
    COMPLETE_SHELF_CATALOG_BATCH_SIZE
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
    () =>
      createInitialBookShelfControllerState(
        forcedColors,
        initialNavigationContext?.viewMode || "shelf"
      )
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
    useState<BookShelfSearchScope>(
      initialNavigationContext?.search.scope || "library"
    );
  const [focusedBookKey, setFocusedBookKey] = useState<string | null>(
    initialNavigationContext?.focusedBookKey || null
  );
  const [settledThemeBookKey, setSettledThemeBookKey] = useState<string | null>(
    null
  );
  const [randomAnnouncement, setRandomAnnouncement] = useState("");
  const randomBookHistoryRef = useRef<string[]>([]);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [shelfFailure, setShelfFailure] =
    useState<BookShelfSceneFailure | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [qualityPreference, setQualityPreference] =
    useState<BookShelfQualityPreference>(readBookShelfQualityPreference);
  const [qualityController, qualityDispatch] = useReducer(
    reduceBookShelfQualityController,
    { qualityPreference, reducedMotion },
    ({ qualityPreference: preference, reducedMotion: reduced }) =>
      createBookShelfQualityController(
        collectBookShelfQualitySignals(preference, reduced)
      )
  );
  const qualitySettings = useMemo(
    () => bookShelfQualityControllerSettings(qualityController),
    [qualityController]
  );
  const [mobileDetailState, mobileDetailDispatch] = useReducer(
    bookShelfMobileDetailReducer,
    reducedMotion,
    (reduced) => createInitialBookShelfMobileDetailState("collapsed", reduced)
  );
  const mobileDetailGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    y: number;
    timestamp: number;
    velocityY: number;
  } | null>(null);
  const mobileDetailSuppressClickRef = useRef(false);
  const archiveSectionRef = useRef<HTMLElement>(null);
  const shelfWheelRemainderRef = useRef(0);
  const shelfPointerStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const [sceneNearViewport, setSceneNearViewport] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  const [selectedBook, setSelectedBook] = useState<BookArchiveEntry | null>(
    null
  );
  const [collectionDialogBook, setCollectionDialogBook] =
    useState<BookArchiveEntry | null>(null);
  const [managerCollectionId, setManagerCollectionId] = useState<string | null>(
    null
  );
  const [relatedArticles, setRelatedArticles] = useState<BookArticleMention[]>(
    []
  );
  const [relatedArticlesLoading, setRelatedArticlesLoading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState<BookMentionIndex | null>(null);
  const [globalSearchBaseIndexState, setGlobalSearchBaseIndexState] =
    useState<{ requestKey: string; index: GlobalSearchIndex } | null>(null);
  const [globalSearchError, setGlobalSearchError] = useState(false);
  const [globalSearchRetryAttempt, setGlobalSearchRetryAttempt] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  const detailOverlayRef = useRef<HTMLElement>(null);
  const shelfSceneRef = useRef<HTMLDivElement>(null);
  const [hoveredSpine, setHoveredSpine] = useState<BookShelfSpineHit | null>(null);
  const [shelfHasKeyboardFocus, setShelfHasKeyboardFocus] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shelfStateRef = useRef(shelfState);
  shelfStateRef.current = shelfState;
  const focusedBookKeyRef = useRef<string | null>(focusedBookKey);
  focusedBookKeyRef.current = focusedBookKey;
  const selectedBookRef = useRef<BookArchiveEntry | null>(selectedBook);
  selectedBookRef.current = selectedBook;
  const actualViewModeRef = useRef<BookShelfViewMode>(viewMode);
  actualViewModeRef.current = viewMode;
  const skipNextBookPopstateRef = useRef(false);
  const pendingBookCloseRef = useRef<{
    requestId: number;
    returnFocus: HTMLElement | null;
  } | null>(null);
  const pendingInspectionBookRef = useRef<BookArchiveEntry | null>(null);
  const pendingBookSwitchRef = useRef<BookArchiveEntry | null>(null);
  const pendingEmptySceneResetRef = useRef(false);
  const pageTurnFrameRef = useRef<number | null>(null);
  const inspectionRequestSequenceRef = useRef(0);
  const [inspectionSession, setInspectionSession] =
    useState<BookInspectionSession | null>(null);
  const inspectionSessionRef = useRef<BookInspectionSession | null>(null);
  inspectionSessionRef.current = inspectionSession;
  const restoredNavigationContextRef = useRef(initialNavigationContext);
  const navigationFocusOriginRef = useRef<BookArchiveNavigationFocusOrigin | null>(
    initialNavigationContext?.focusOrigin || null
  );
  const [pendingNavigationFocusOrigin, setPendingNavigationFocusOrigin] =
    useState<BookArchiveNavigationFocusOrigin | null>(
      initialNavigationContext?.focusOrigin || null
    );
  const restoreInspectionOpenRef = useRef(
    initialNavigationContext?.inspectionOpen === true
  );
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
  const {
    items: savedReadings,
    save: saveReading,
    remove: removeReading,
    setDossierProgress,
  } = useReadingLibrary();
  const savedReadingsRef = useRef(savedReadings);
  savedReadingsRef.current = savedReadings;
  const {
    snapshot: bookCollectionSnapshot,
    collections: bookCollections,
    favorites: bookFavorites,
    favoriteKeys,
    status: bookCollectionSyncStatus,
    error: bookCollectionError,
    conflicts: bookCollectionConflicts,
    upsertCollection,
    removeCollection,
    addBook: addBookToCollection,
    removeBook: removeBookFromCollection,
    reorderBooks: reorderBooksInCollection,
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
    const nextBookKey = bookKey(book);
    const restoresExactBookContext =
      requestedBookKey(window.location.search) === nextBookKey &&
      restoredNavigationContextRef.current?.selectedBookKey === nextBookKey;
    if (!restoresExactBookContext) {
      restoredNavigationContextRef.current = null;
      navigationFocusOriginRef.current = null;
      setPendingNavigationFocusOrigin(null);
      restoreInspectionOpenRef.current = false;
    }
    setFocusedBookKey(nextBookKey);
    setSettledThemeBookKey(nextBookKey);
    returnFocusRef.current = returnFocus || null;
    selectedBookRef.current = book;
    setSelectedBook(book);
    replaceBookLocation(
      bookKey(book),
      requestedBookKey(window.location.search) ? "replace" : "push"
    );
  }, []);
  const centerShelfScene = useCallback(() => {
    const scene = document
      .getElementById("books")
      ?.querySelector<HTMLElement>(".book-shelf-scene");
    if (!scene) return;
    scene.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
      inline: "nearest",
    });
    scene.focus({ preventScroll: true });
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
        const exactReturnFocus =
          returnFocus && canReceiveFocus(returnFocus) ? returnFocus : null;
        const target = exactReturnFocus || reconnectedTrigger || fallback;
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
      const centerAfterClose = pendingEmptySceneResetRef.current;
      pendingEmptySceneResetRef.current = false;
      pendingBookCloseRef.current = null;
      returnFocusRef.current = null;
      navigationFocusOriginRef.current = null;
      setPendingNavigationFocusOrigin(null);
      restoreInspectionOpenRef.current = false;
      setSelectedBook(null);
      setFocusedBookKey((current) =>
        current && filteredItemsRef.current.some((item) => item.key === current)
          ? current
          : filteredItemsRef.current[0]?.key || null
      );
      const restoreCloseDestination = () => {
        if (centerAfterClose) {
          // Removing the detail column reconnects the scene. Focus the current
          // node after that commit, just like the catalogue trigger restoration.
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(centerShelfScene);
          });
          return;
        }
        restoreBookTriggerFocus(returnFocus);
      };
      if (
        window.history.state?.[BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY] &&
        !window.history.state?.[bookDetailShelfChangedStateKey]
      ) {
        skipNextBookPopstateRef.current = true;
        window.addEventListener(
          "popstate",
          restoreCloseDestination,
          { once: true }
        );
        window.history.back();
      } else {
        replaceBookLocation(null);
        restoreCloseDestination();
      }
    },
    [centerShelfScene, restoreBookTriggerFocus]
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

  const archiveFacetIndex = useMemo(
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
  const systemBookCollectionSnapshot = useMemo(
    () =>
      deriveSystemBookCollections(savedReadings, {
        titles: {
          library: t("Моя библиотека"),
          "want-to-read": t("Хочу прочитать"),
          reading: t("Читаю сейчас"),
          finished: t("Прочитано"),
        },
      }),
    [savedReadings, t]
  );
  const smartShelfCandidateKeys = useMemo(() => {
    const candidates = new Map<string, readonly string[]>();
    for (const shelf of smartShelves) {
      const state = applyBookSmartShelf(shelf);
      if (!state) continue;
      candidates.set(
        shelf.id,
        filterBookArchiveFacetIndex(archiveFacetIndex, state, {
          savedBookKeys,
        }).items.map((item) => item.key)
      );
    }
    return candidates;
  }, [archiveFacetIndex, savedBookKeys, smartShelves]);
  const editorialBookCollectionSnapshot = useMemo<BookCollectionSnapshot>(() => {
    const timestamp = "2026-08-28T00:00:00.000Z";
    const definitions = [
      {
        id: "editorial:choice",
        title: t("Выбор редакции"),
        description: t(
          "Куратор: редакция «Пробы пера» · проверенные произведения"
        ),
        icon: "quill" as const,
        backgroundPreset: "amber-reading-room" as const,
        state: applyBookArchiveQuickPreset(
          normalizeBookArchiveFilterState(),
          "verified"
        ),
      },
      {
        id: "editorial:classics",
        title: t("Классика архива"),
        description: t(
          "Куратор: редакция «Пробы пера» · проверенная классика архива"
        ),
        icon: "star" as const,
        backgroundPreset: "midnight-archive" as const,
        state: applyBookArchiveQuickPreset(
          normalizeBookArchiveFilterState(),
          "classic"
        ),
      },
    ];
    const collections = definitions.map((definition) => ({
      id: definition.id,
      kind: "editorial" as const,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      visibility: "public" as const,
      backgroundPreset: definition.backgroundPreset,
      dynamicBookThemes: true,
      themeIntensity: 72,
      sortMode: definition.state.sort,
      schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const items = definitions.flatMap((definition) =>
      filterBookArchiveFacetIndex(archiveFacetIndex, definition.state, {
        savedBookKeys,
      }).items.map((item, position) => ({
        collectionId: definition.id,
        bookKey: item.key,
        position,
        addedAt: timestamp,
        updatedAt: timestamp,
      }))
    );
    return {
      schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
      collections,
      items,
      favorites: [],
    };
  }, [archiveFacetIndex, savedBookKeys, t]);
  const collectionShelfSelection = useMemo(
    () =>
      selectBookCollectionShelf({
        archiveBookKeys: queue.all.map((item) => item.key),
        systemSnapshot: systemBookCollectionSnapshot,
        personalSnapshot: bookCollectionSnapshot,
        editorialSnapshot: editorialBookCollectionSnapshot,
        smartCandidateKeys: smartShelfCandidateKeys,
        activeShelfId,
        labels: {
          allArchive: t("Весь архив"),
          favorites: t("Избранное"),
          archiveSection: t("Архив"),
          editorialSection: t("Редакционные полки"),
          librarySection: t("Моя библиотека"),
          personalSection: t("Мои полки"),
        },
      }),
    [
      activeShelfId,
      bookCollectionSnapshot,
      editorialBookCollectionSnapshot,
      queue,
      smartShelfCandidateKeys,
      systemBookCollectionSnapshot,
      t,
    ]
  );
  useEffect(() => {
    if (!collectionShelfSelection.activeOption.private) return;
    const existing = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]'
    );
    const meta = existing || document.createElement("meta");
    const previousContent = existing?.content || "";
    if (!existing) {
      meta.name = "robots";
      meta.dataset.bookArchivePrivateShelf = "true";
      document.head.append(meta);
    }
    meta.content = "noindex,follow";
    return () => {
      if (meta.dataset.bookArchivePrivateShelf === "true") meta.remove();
      else meta.content = previousContent;
    };
  }, [collectionShelfSelection.activeOption.private]);
  const facetIndex = useMemo(() => {
    if (collectionShelfSelection.activeShelfId === BOOK_COLLECTION_ALL_SHELF_ID) {
      return archiveFacetIndex;
    }
    return buildBookArchiveFacetIndex({
      items: collectionShelfSelection.candidateKeys.flatMap((key) => {
        const item = queueByKey.get(key);
        return item ? [item] : [];
      }),
      locale: language,
      translate: t,
      countryName,
      mentionIndex,
    });
  }, [
    archiveFacetIndex,
    collectionShelfSelection,
    countryName,
    language,
    mentionIndex,
    queue,
    queueByKey,
    t,
  ]);
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
  const archiveSearchFilterState = useMemo(
    () =>
      normalizeBookArchiveFilterState({
        ...filterState,
        query: searchScope === "archive" ? deferredQuery : "",
      }),
    [deferredQuery, filterState, searchScope]
  );
  const archiveFacetResult = useMemo(
    () =>
      filterBookArchiveFacetIndex(
        archiveFacetIndex,
        archiveSearchFilterState,
        { savedBookKeys }
      ),
    [archiveFacetIndex, archiveSearchFilterState, savedBookKeys]
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
    },
    []
  );
  const resetArchiveFilters = useCallback(() => {
    setQuery("");
    setFilterState(normalizeBookArchiveFilterState());
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
    for (const shelf of collectionShelfSelection.options) {
      if (shelf.kind === "archive") continue;
      extensions.push({
        kind:
          shelf.kind === "editorial"
            ? "editorial-shelf"
            : "personal-shelf",
        id: shelf.id,
        label: shelf.title,
        aliases: [
          shelf.description,
          shelf.kind === "smart" ? t("Умная полка") : "",
        ].filter(Boolean),
      });
    }
    return extensions;
  }, [collectionShelfSelection.options, facetIndex, t]);

  const searchArchiveVersion = useMemo(
    () => globalSearchArchiveVersion(countries, books),
    [books, countries]
  );
  const globalSearchRuntimeRequest = useMemo(
    () => ({
      countries,
      books,
      language,
      translate: t,
      countryName,
      archiveVersion: searchArchiveVersion,
    }),
    [books, countries, countryName, language, searchArchiveVersion, t]
  );
  const globalSearchRequestKey = globalSearchRequestCacheKey(
    globalSearchRuntimeRequest
  );
  const cachedGlobalSearchBaseIndex = peekSharedGlobalSearchIndex(
    globalSearchRuntimeRequest
  );
  const globalSearchBaseIndex =
    globalSearchBaseIndexState?.requestKey === globalSearchRequestKey
      ? globalSearchBaseIndexState.index
      : cachedGlobalSearchBaseIndex;
  const globalSearchPending =
    searchScope === "global" &&
    !globalSearchBaseIndex &&
    !globalSearchError;

  useEffect(() => {
    if (searchScope !== "global") {
      setGlobalSearchError(false);
      return;
    }
    let active = true;
    setGlobalSearchError(false);
    const cachedIndex = peekSharedGlobalSearchIndex(
      globalSearchRuntimeRequest
    );
    setGlobalSearchBaseIndexState(
      cachedIndex
        ? { requestKey: globalSearchRequestKey, index: cachedIndex }
        : null
    );
    if (cachedIndex) {
      return;
    }
    ensureSharedGlobalSearchIndex(globalSearchRuntimeRequest)
      .then((index) => {
        if (!active) return;
        setGlobalSearchBaseIndexState({
          requestKey: globalSearchRequestKey,
          index,
        });
      })
      .catch(() => {
        if (!active) return;
        setGlobalSearchBaseIndexState(null);
        setGlobalSearchError(true);
      });
    return () => {
      active = false;
    };
  }, [
    globalSearchRequestKey,
    globalSearchRetryAttempt,
    globalSearchRuntimeRequest,
    searchScope,
  ]);

  const emptySearchIndex = useMemo(
    () => emptyGlobalSearchIndex(language),
    [language]
  );
  const globalSearchIndex = useMemo(
    () =>
      extendSharedGlobalSearchIndex(
        globalSearchBaseIndex || emptySearchIndex,
        globalSearchExtensions
      ),
    [
      emptySearchIndex,
      globalSearchExtensions,
      globalSearchBaseIndex,
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
  const localExtensionSearchIndex = useMemo(
    () =>
      extendSharedGlobalSearchIndex(
        emptySearchIndex,
        globalSearchExtensions
      ),
    [emptySearchIndex, globalSearchExtensions]
  );
  const localExtensionSearchResponse = useMemo(
    () =>
      searchGlobalSearchIndex(
        localExtensionSearchIndex,
        searchScope !== "global" ? deferredQuery : "",
        BOOKS_LIBRARY_SEARCH_PROFILE
      ),
    [deferredQuery, localExtensionSearchIndex, searchScope]
  );
  const librarySearchResponse = useMemo<GlobalSearchResponse>(() => {
    const normalizedQuery = localExtensionSearchResponse.normalizedQuery;
    if (
      normalizedQuery.length < BOOKS_LIBRARY_SEARCH_PROFILE.minQueryLength ||
      searchScope === "global"
    ) {
      return localExtensionSearchResponse;
    }

    // The facet index has already ranked the books for this explicit query.
    // Reuse that lightweight result instead of eagerly constructing the full
    // article/country/writer search index before global-search intent.
    const sourceItems =
      searchScope === "archive"
        ? archiveFacetResult.items
        : facetResult.items;
    const bookLimit =
      BOOKS_LIBRARY_SEARCH_PROFILE.groupLimits.books ||
      BOOKS_LIBRARY_SEARCH_PROFILE.suggestionLimit;
    const bookResults: Extract<GlobalSearchResult, { kind: "book" }>[] =
      sourceItems.slice(0, bookLimit).map((item) => ({
        kind: "book",
        group: "books",
        key: `book:${item.key}`,
        book: item.book,
        bookKey: item.key,
        label: presentBookArchiveQueueItem(item, language).title,
        focusAction: { type: "focus-book", bookKey: item.key },
        activateAction: { type: "open-book", bookKey: item.key },
      }));
    const suggestions = [
      ...bookResults,
      ...localExtensionSearchResponse.suggestions,
    ].slice(0, BOOKS_LIBRARY_SEARCH_PROFILE.suggestionLimit);

    return {
      normalizedQuery,
      groups: {
        ...localExtensionSearchResponse.groups,
        books: bookResults,
      },
      suggestions,
      allMatches: [
        ...bookResults,
        ...localExtensionSearchResponse.allMatches,
      ],
      totalMatches:
        sourceItems.length + localExtensionSearchResponse.totalMatches,
    };
  }, [
    archiveFacetResult.items,
    facetResult.items,
    language,
    localExtensionSearchResponse,
    searchScope,
  ]);
  const activeSearchResponse =
    searchScope === "global" ? globalSearchResponse : librarySearchResponse;
  const activeSearchProfile =
    searchScope === "global"
      ? BOOKS_GLOBAL_SEARCH_PROFILE
      : BOOKS_LIBRARY_SEARCH_PROFILE;

  const filteredItems = useMemo(() => {
    if (searchScope === "library") return facetResult.items;
    if (searchScope === "archive") return archiveFacetResult.items;
    if (globalSearchPending || globalSearchError) return facetResult.items;
    if (
      globalSearchResponse.normalizedQuery.length <
        BOOKS_GLOBAL_SEARCH_PROFILE.minQueryLength
    ) {
      return facetResult.items;
    }
    const acceptedBookKeys = new Set(
      archiveFacetResult.items.map((item) => item.key)
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
  }, [
    archiveFacetResult.items,
    facetResult.items,
    globalSearchError,
    globalSearchPending,
    globalSearchResponse,
    queueByKey,
    searchScope,
  ]);
  filteredItemsRef.current = filteredItems;

  useEffect(() => {
    setVisibleCount(COMPLETE_SHELF_CATALOG_BATCH_SIZE);
  }, [activeShelfId, deferredQuery, filterState]);

  useEffect(() => {
    if (shelfState.phase === "SHELF_IDLE") {
      setSettledThemeBookKey(focusedBookKey);
    }
  }, [focusedBookKey, shelfState.phase]);

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
      searchScope !== "global" &&
      normalizeLiterarySearch(deferredQuery).length > 0
    ) {
      setFocusedBookKey(
        searchScope === "archive"
          ? archiveFacetResult.bestMatchKey
          : facetResult.bestMatchKey
      );
      return;
    }
    setFocusedBookKey((current) =>
      current && filteredItems.some((item) => item.key === current)
        ? current
        : filteredItems[0]?.key || null
    );
  }, [
    archiveFacetResult.bestMatchKey,
    deferredQuery,
    facetResult.bestMatchKey,
    filteredItems,
    searchScope,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    mobileDetailDispatch({ type: "set-reduced-motion", value: reducedMotion });
  }, [reducedMotion]);

  useEffect(() => {
    if (!qualitySettings.mobile) return;
    mobileDetailDispatch({
      type: "request-position",
      position: selectedBook ? "half" : "collapsed",
    });
  }, [qualitySettings.mobile, selectedBook]);

  useEffect(() => {
    const update = () =>
      qualityDispatch({
        type: "signals",
        signals: collectBookShelfQualitySignals(
          qualityPreference,
          reducedMotion
        ),
      });
    const connection = (
      navigator as Navigator & { connection?: EventTarget }
    ).connection;
    update();
    window.addEventListener("resize", update, { passive: true });
    connection?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      connection?.removeEventListener?.("change", update);
    };
  }, [qualityPreference, reducedMotion]);

  const changeQualityPreference = useCallback(
    (preference: BookShelfQualityPreference) => {
      if (
        preference !== "auto" &&
        !BOOK_SHELF_QUALITY_PROFILES.includes(preference)
      ) {
        return;
      }
      if (preference === qualityPreference) return;
      setQualityPreference(preference);
      writeWebStorage("local", bookShelfQualityStorageKey, preference);
      setSceneLoadGeneration((generation) => generation + 1);
    },
    [qualityPreference]
  );

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
      const historyContext =
        event?.type === "popstate"
          ? parseBookArchiveNavigationContext(
              typeof (event as PopStateEvent).state?.[
                BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY
              ] === "string"
                ? (event as PopStateEvent).state[
                    BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY
                  ]
                : null
            )
          : null;
      if (historyContext) {
        restoredNavigationContextRef.current = historyContext;
        navigationFocusOriginRef.current = historyContext.focusOrigin;
        setPendingNavigationFocusOrigin(historyContext.focusOrigin);
        restoreInspectionOpenRef.current = historyContext.inspectionOpen;
        setQuery(historyContext.search.query);
        setSearchScope(historyContext.search.scope);
        setFilterState(
          normalizeBookArchiveFilterState({
            ...historyContext.filters,
            query: "",
          })
        );
        setFocusedBookKey(historyContext.focusedBookKey);
        setViewMode(historyContext.viewMode);
        const currentInspection = inspectionSessionRef.current;
        if (
          currentInspection?.bookKey &&
          currentInspection.bookKey === historyContext.selectedBookKey
        ) {
          const restoredInspection = createBookInspectionSession({
            bookKey: currentInspection.bookKey,
            pageCount: currentInspection.pageCount,
            pageIndex: historyContext.pageIndex,
            orbitSnapshot: currentInspection.orbitSnapshot,
            requestId: ++inspectionRequestSequenceRef.current,
          });
          inspectionSessionRef.current = restoredInspection;
          setInspectionSession(restoredInspection);
          restoredNavigationContextRef.current = null;
        }
        window.requestAnimationFrame(() => {
          window.scrollTo(
            historyContext.scroll.x,
            historyContext.scroll.y
          );
        });
      }
      if (
        event?.type === "popstate" &&
        skipNextBookPopstateRef.current
      ) {
        skipNextBookPopstateRef.current = false;
        return;
      }
      if (
        !event &&
        (pendingBookCloseRef.current ||
          pendingBookSwitchRef.current ||
          pendingInspectionBookRef.current)
      ) {
        return;
      }
      const location = parseBookArchiveLocation(window.location.search);
      setActiveShelfId(
        location.shelfId ||
          historyContext?.shelfId ||
          BOOK_COLLECTION_ALL_SHELF_ID
      );
      const key = location.bookKey;
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
  }, [books, closeBookDetail, openBookDetail, setViewMode]);

  useEffect(() => {
    if (!requestedBook) return;
    openBookDetail(requestedBook, requestedBookReturnFocus);
    onRequestedBookHandled?.();
    window.requestAnimationFrame(() => {
      document.getElementById("books")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [
    onRequestedBookHandled,
    openBookDetail,
    requestedBook,
    requestedBookReturnFocus,
  ]);

  useEffect(() => {
    if (!selectedBook) return;
    const frame = window.requestAnimationFrame(() => {
      if (viewMode === "shelf") {
        centerShelfScene();
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
  }, [centerShelfScene, selectedBook, viewMode]);

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
    Promise.all([
      getBookArticleMentions(bookKey(selectedBook)),
      loadGlobalSearchArticleCatalog(),
    ])
      .then(([articles, articleCatalog]) => {
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
  const collectionSceneSettings = useMemo(() => {
    const collection = collectionShelfSelection.activeOption.collection;
    if (!collection) return coreBookArchive?.visualSettings;
    return {
      ...(coreBookArchive?.visualSettings || {}),
      ...(collection.backgroundPreset
        ? { bookScenePreset: collection.backgroundPreset }
        : {}),
      bookSceneDynamicThemes: collection.dynamicBookThemes,
      bookSceneIntensity: collection.themeIntensity,
    };
  }, [collectionShelfSelection.activeOption.collection, coreBookArchive?.visualSettings]);
  const sceneSettings = useMemo(
    () =>
      resolveBookArchiveSceneSettings(collectionSceneSettings),
    [collectionSceneSettings]
  );
  const sceneOwnerOverride = useMemo(
    () =>
      bookSceneOwnerOverrideFromSettings(collectionSceneSettings) ||
      (sceneSettings.bookSceneDynamicThemes
        ? null
        : ({ archetype: "VIOLET LIBRARY" } as const)),
    [collectionSceneSettings, sceneSettings.bookSceneDynamicThemes]
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
        const audienceIds = facetIndex.byKey.get(item.key)?.audienceIds;
        const hasRealCover = isCoverArtworkDisplayAllowed(item.book);
        const theme = resolveBookSceneTheme(item.book, {
          audienceIds,
          ownerOverride: sceneOwnerOverride,
        });
        return {
          key: item.key,
          title: displayed.title,
          ownerPaletteSlot: ownerPaletteSlotForBookKey(item.key),
          writer: selectBookWriterName(
            item.book,
            language,
            t("\u0410\u0432\u0442\u043e\u0440")
          ),
          year:
            item.status === "verified" && item.book.firstPublished
              ? item.book.firstPublished
              : undefined,
          coverUrl: hasRealCover
            ? resolveCoverUrl(item.book.coverUrl)
            : undefined,
          presentationProfile: resolveBookShelfPresentationProfile({
            bookKey: item.key,
            firstPublished:
              item.status === "verified" ? item.book.firstPublished : null,
            audienceIds,
            hasRealCover,
          }),
          baseColor: theme.baseColor,
          accentColor: theme.accentColor,
          paperColor: theme.paperColor,
        };
      }),
    [facetIndex, language, sceneOwnerOverride, sceneQueueItems, t]
  );
  const focusedSceneTheme = useMemo(() => {
    const focusedItem =
      (settledThemeBookKey && queueByKey.get(settledThemeBookKey)) ||
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
    queueByKey,
    sceneOwnerOverride,
    settledThemeBookKey,
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
  const shelfNavigation = useMemo(
    () =>
      getBookShelfNavigationState(
        focusedIndex >= 0 ? focusedIndex : 0,
        filteredItems.length,
        COMPLETE_SHELF_CATALOG_BATCH_SIZE
      ),
    [filteredItems.length, focusedIndex]
  );
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
      const normalized = clampBookShelfFocusIndex(index, filteredItems.length);
      const key = normalized >= 0 ? filteredItems[normalized]?.key : null;
      if (key) requestFocusBook(key);
    },
    [filteredItems, requestFocusBook]
  );
  const handleSceneOpenBook = useCallback(
    (key: string) => {
      const item = queueByKey.get(key);
      if (!item) return;
      centerShelfScene();
      setRandomAnnouncement("");

      const currentSelected = selectedBookRef.current;
      if (currentSelected && bookKey(currentSelected) !== key) {
        pendingBookSwitchRef.current = item.book;
        closeBookDetail();
        return;
      }

      const phase = shelfStateRef.current.phase;
      if (["SHELF_IDLE", "SHELF_MOVING", "SHELF_SETTLING"].includes(phase) &&
          (focusedBookKeyRef.current !== key || phase !== "SHELF_IDLE")) {
        pendingInspectionBookRef.current = item.book;
        if (focusedBookKeyRef.current !== key) requestFocusBook(key);
        return;
      }

      openBookDetail(item.book);
    },
    [
      centerShelfScene,
      closeBookDetail,
      openBookDetail,
      queueByKey,
      requestFocusBook,
    ]
  );
  const resetShelfFromEmptyArea = useCallback(() => {
    pendingBookSwitchRef.current = null;
    pendingInspectionBookRef.current = null;
    if (selectedBookRef.current || pendingBookCloseRef.current) {
      pendingEmptySceneResetRef.current = true;
      closeBookDetail();
      return;
    }
    centerShelfScene();
  }, [centerShelfScene, closeBookDetail]);
  const handleShelfMotionSettled = useCallback(
    (requestId: number) => {
      shelfDispatch({ type: "motion-settled", requestId });
      if (requestId !== shelfStateRef.current.requestId) return;
      qualityDispatch({ type: "recover" });
      setSettledThemeBookKey(focusedBookKeyRef.current);
      const pendingBook = pendingInspectionBookRef.current;
      if (
        !pendingBook ||
        bookKey(pendingBook) !== focusedBookKeyRef.current
      ) {
        return;
      }
      window.requestAnimationFrame(() => {
        if (shelfStateRef.current.requestId !== requestId ||
            pendingInspectionBookRef.current !== pendingBook ||
            focusedBookKeyRef.current !== bookKey(pendingBook)) return;
        pendingInspectionBookRef.current = null;
        openBookDetail(pendingBook);
      });
    }, [openBookDetail]
  );
  const handleShelfKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (
        navigationLocked ||
        viewMode !== "shelf" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      const target = event.target as HTMLElement;
      if (
        target !== event.currentTarget &&
        /^(?:A|BUTTON|INPUT|SELECT|TEXTAREA)$/u.test(target.tagName)
      ) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const focusedKey =
          focusedBookKeyRef.current || filteredItems[0]?.key || null;
        if (!focusedKey) return;
        event.preventDefault();
        handleSceneOpenBook(focusedKey);
        return;
      }
      const nextIndex = resolveBookShelfKeyboardNavigation({
        key: event.key,
        focusIndex: shelfNavigation.focusIndex,
        total: shelfNavigation.total,
        pageSize: COMPLETE_SHELF_CATALOG_BATCH_SIZE,
      });
      if (nextIndex === null || nextIndex === shelfNavigation.focusIndex) return;
      event.preventDefault();
      focusBookAt(nextIndex);
    }, [
      filteredItems,
      focusBookAt,
      handleSceneOpenBook,
      navigationLocked,
      shelfNavigation,
      viewMode,
    ]
  );
  const handleShelfWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (navigationLocked || viewMode !== "shelf") return;
      const intent = accumulateBookShelfWheelIntent(
        shelfWheelRemainderRef.current,
        event,
        { threshold: 32 }
      );
      shelfWheelRemainderRef.current = intent.remainder;
      if (!intent.direction) return;
      const nextIndex =
        intent.direction > 0
          ? shelfNavigation.nextIndex
          : shelfNavigation.previousIndex;
      if (nextIndex === shelfNavigation.focusIndex) return;
      event.preventDefault();
      focusBookAt(nextIndex);
    }, [focusBookAt, navigationLocked, shelfNavigation, viewMode]
  );
  const handleShelfPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        navigationLocked ||
        viewMode !== "shelf" ||
        event.pointerType === "mouse" ||
        !event.isPrimary
      ) {
        return;
      }
      shelfPointerStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    }, [navigationLocked, viewMode]
  );
  const handleShelfPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = shelfPointerStartRef.current;
      shelfPointerStartRef.current = null;
      if (!start || start.pointerId !== event.pointerId || navigationLocked) return;
      const direction = resolveBookShelfSwipeIntent({
        startX: start.x,
        startY: start.y,
        endX: event.clientX,
        endY: event.clientY,
      });
      if (!direction) return;
      event.preventDefault();
      focusBookAt(shelfNavigation.focusIndex + direction);
    }, [focusBookAt, navigationLocked, shelfNavigation.focusIndex]
  );
  const requestMobileDetailPosition = useCallback(
    (position: BookShelfMobileDetailPosition) => {
      mobileDetailDispatch({ type: "request-position", position });
    },
    []
  );
  const handleMobileDetailPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!qualitySettings.mobile || !event.isPrimary) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      mobileDetailSuppressClickRef.current = false;
      mobileDetailGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        y: event.clientY,
        timestamp: event.timeStamp,
        velocityY: 0,
      };
      mobileDetailDispatch({
        type: "drag-start",
        x: event.clientX,
        y: event.clientY,
      });
    },
    [qualitySettings.mobile]
  );
  const handleMobileDetailPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const gesture = mobileDetailGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const elapsed = Math.max(1, event.timeStamp - gesture.timestamp);
      gesture.velocityY = (event.clientY - gesture.y) / elapsed;
      gesture.y = event.clientY;
      gesture.timestamp = event.timeStamp;
      if (
        Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY
        ) >= 8
      ) {
        mobileDetailSuppressClickRef.current = true;
      }
      mobileDetailDispatch({
        type: "drag-move",
        x: event.clientX,
        y: event.clientY,
      });
      if (event.cancelable && mobileDetailSuppressClickRef.current &&
          Math.abs(event.clientY - gesture.startY) > Math.abs(event.clientX - gesture.startX)) event.preventDefault();
    },
    []
  );
  const handleMobileDetailPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const gesture = mobileDetailGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      mobileDetailGestureRef.current = null;
      mobileDetailDispatch({
        type: "drag-move",
        x: event.clientX,
        y: event.clientY,
      });
      mobileDetailDispatch({
        type: "drag-end",
        velocityY: gesture.velocityY,
      });
      const horizontalDirection = resolveBookShelfSwipeIntent({
        startX: gesture.startX,
        startY: gesture.startY,
        endX: event.clientX,
        endY: event.clientY,
      });
      if (horizontalDirection) {
        const nextIndex = clampBookShelfFocusIndex(
          shelfNavigation.focusIndex + horizontalDirection,
          filteredItems.length
        );
        const nextKey = filteredItems[nextIndex]?.key;
        if (nextKey) handleSceneOpenBook(nextKey);
      }
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    },
    [filteredItems, handleSceneOpenBook, shelfNavigation.focusIndex]
  );
  const cancelMobileDetailPointer = useCallback(() => {
    if (!mobileDetailGestureRef.current) return;
    mobileDetailSuppressClickRef.current = true;
    mobileDetailGestureRef.current = null;
    mobileDetailDispatch({ type: "drag-cancel" });
  }, []);
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
  const requestSelectedPageAt = useCallback((pageIndex: number) => {
    const currentShelfState = shelfStateRef.current;
    const currentSession = inspectionSessionRef.current;
    if (
      actualViewModeRef.current !== "shelf" ||
      !selectedBookRef.current ||
      !currentSession ||
      currentSession.phase !== "idle" ||
      currentShelfState.phase !== "BOOK_OPEN" ||
      pageTurnFrameRef.current !== null
    ) {
      return;
    }
    const direction: BookInspectionPageDirection =
      pageIndex < currentSession.pageIndex ? "backward" : "forward";
    const sessionRequestId = ++inspectionRequestSequenceRef.current;
    const draggingSession = beginBookInspectionDrag(
      currentSession,
      sessionRequestId,
      direction
    );
    if (
      draggingSession === currentSession ||
      (direction === "forward"
        ? getNextBookInspectionPageTarget(currentSession)
        : getPreviousBookInspectionPageTarget(currentSession)) !== pageIndex
    ) {
      return;
    }
    inspectionSessionRef.current = draggingSession;
    setInspectionSession(draggingSession);
    shelfDispatch({
      type: "start-page-drag",
      requestId: currentShelfState.requestId + 1,
    });
    pageTurnFrameRef.current = window.requestAnimationFrame(() => {
      pageTurnFrameRef.current = null;
      const draggingState = shelfStateRef.current;
      const activeSession = inspectionSessionRef.current;
      if (
        draggingState.phase !== "PAGE_DRAGGING" ||
        !activeSession ||
        activeSession.phase !== "dragging"
      ) {
        return;
      }
      const progressed = updateBookInspectionDrag(
        activeSession,
        activeSession.requestId,
        1
      );
      const settling = endBookInspectionDrag(progressed, {
        requestId: progressed.requestId,
        velocity: direction === "forward" ? 1 : -1,
      });
      inspectionSessionRef.current = settling;
      setInspectionSession(settling);
      shelfDispatch({
        type: "request-page-settle",
        requestId: draggingState.requestId + 1,
      });
    });
  }, []);
  const requestSelectedPageTurn = useCallback(() => {
    const session = inspectionSessionRef.current;
    if (!session) return;
    requestSelectedPageAt(getNextBookInspectionPageTarget(session));
  }, [requestSelectedPageAt]);
  const requestSelectedPreviousPage = useCallback(() => {
    const session = inspectionSessionRef.current;
    if (!session) return;
    requestSelectedPageAt(getPreviousBookInspectionPageTarget(session));
  }, [requestSelectedPageAt]);
  const requestSelectedKeyboardPage = useCallback(
    (key: string, shiftKey = false) => {
      const session = inspectionSessionRef.current;
      if (!session) return false;
      const target = getBookInspectionKeyboardTarget(session, key, shiftKey);
      if (target === null || target === session.pageIndex) return false;
      requestSelectedPageAt(target);
      return true;
    },
    [requestSelectedPageAt]
  );
  const settleSelectedPage = useCallback((requestId: number) => {
    shelfDispatch({ type: "page-settled", requestId });
    const session = inspectionSessionRef.current;
    if (!session || session.phase !== "settling") return;
    const settled = settleBookInspectionSession(session, session.requestId);
    inspectionSessionRef.current = settled;
    setInspectionSession(settled);
  }, []);
  const startSelectedPageDrag = useCallback(
    (direction: BookInspectionPageDirection) => {
      const shelf = shelfStateRef.current;
      const session = inspectionSessionRef.current;
      if (!session || shelf.phase !== "BOOK_OPEN") return;
      const requestId = ++inspectionRequestSequenceRef.current;
      const dragging = beginBookInspectionDrag(session, requestId, direction);
      if (dragging === session) return;
      inspectionSessionRef.current = dragging;
      setInspectionSession(dragging);
      shelfDispatch({
        type: "start-page-drag",
        requestId: shelf.requestId + 1,
      });
    },
    []
  );
  const updateSelectedPageDrag = useCallback((progress: number) => {
    const session = inspectionSessionRef.current;
    if (!session || session.phase !== "dragging") return;
    const updated = updateBookInspectionDrag(
      session,
      session.requestId,
      progress
    );
    if (updated === session) return;
    inspectionSessionRef.current = updated;
    setInspectionSession(updated);
  }, []);
  const settleSelectedPageDrag = useCallback((velocity: number) => {
    const shelf = shelfStateRef.current;
    const session = inspectionSessionRef.current;
    if (
      !session ||
      session.phase !== "dragging" ||
      shelf.phase !== "PAGE_DRAGGING"
    ) {
      return;
    }
    const settling = endBookInspectionDrag(session, {
      requestId: session.requestId,
      velocity,
    });
    inspectionSessionRef.current = settling;
    setInspectionSession(settling);
    shelfDispatch({
      type: "request-page-settle",
      requestId: shelf.requestId + 1,
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
      qualityDispatch({ type: "degrade" });
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
  const handleShelfContextRestored = useCallback(() => {
    qualityDispatch({ type: "recover" });
    setShelfFailure(null);
  }, []);
  const handleInspectionEntered = useCallback((requestId: number) => {
    shelfDispatch({ type: "inspection-entered", requestId });
    if (!restoreInspectionOpenRef.current) return;
    restoreInspectionOpenRef.current = false;
    shelfDispatch({
      type: "request-cover-open",
      requestId: requestId + 1,
    });
  }, []);
  const handleShelfRestored = useCallback(
    (requestId: number) => {
      shelfDispatch({ type: "shelf-restored", requestId });
      qualityDispatch({ type: "recover" });
      const pendingClose = pendingBookCloseRef.current;
      if (pendingClose?.requestId === requestId) {
        const nextBook = pendingBookSwitchRef.current;
        if (nextBook) {
          pendingBookSwitchRef.current = null;
          pendingBookCloseRef.current = null;
          returnFocusRef.current = null;
          selectedBookRef.current = null;
          setSelectedBook(null);
          const nextKey = bookKey(nextBook);
          pendingInspectionBookRef.current = nextBook;
          window.requestAnimationFrame(() => {
            const currentShelfState = shelfStateRef.current;
            setFocusedBookKey(nextKey);
            shelfDispatch({
              type: "request-focus",
              requestId: currentShelfState.requestId + 1,
            });
          });
          return;
        }
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
  const pageNavigationActive =
    viewMode === "shelf" &&
    ["BOOK_OPEN", "PAGE_DRAGGING", "PAGE_SETTLING"].includes(
      shelfState.phase
    );
  const pageNavigationBusy = shelfState.phase !== "BOOK_OPEN";
  const selectedBookText = useMemo(() => selectedItem
    ? presentBookArchiveQueueItem(selectedItem, language)
    : null, [selectedItem, language]);
  const selectedWriterName = selectedBook
    ? selectBookWriterName(selectedBook, language, t("Автор"))
    : "";
  const selectedOriginalLanguage = selectedBook && selectedItem?.status === "verified"
    ? selectBookOriginalLanguage(selectedBook, language)
    : "";
  const selectedMetadataLabels = useMemo(() => selectedBook && selectedItem?.status === "verified"
    ? selectBookMetadataLabels(selectedBook, language, t)
    : [], [selectedBook, selectedItem?.status, language, t]);
  const selectedLegacyDocument = useMemo(() => {
    if (!selectedBook || !selectedBookText) return null;
    const verified = selectedItem?.status === "verified";
    const edition = verified ? selectedBook.edition : undefined;
    const editionMetadata = verified
      ? [
          edition?.publisher
            ? {
                kind: "publisher" as const,
                value: edition.publisher,
                verified: true as const,
              }
            : null,
          edition?.title
            ? {
                kind: "edition" as const,
                value: edition.title,
                verified: true as const,
              }
            : null,
          edition?.isbn13 || edition?.isbn10
            ? {
                kind: "isbn" as const,
                value: edition.isbn13 || edition.isbn10 || "",
                verified: true as const,
              }
            : null,
          selectedMetadataLabels[0]
            ? {
                kind: "genre" as const,
                value: selectedMetadataLabels[0],
                verified: true as const,
              }
            : null,
        ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];
    const sourceRights = verified
      ? (selectedBook.sources || []).map((source) => ({
          provider: source.provider,
          sourceUrl: source.url,
          usage: source.usage,
          license: source.license,
          verified: true as const,
        }))
      : [];
    if (verified && selectedBook.sourceUrl && sourceRights.length === 0) {
      sourceRights.push({
        provider: language === "en" ? "Editorial source" : "Редакционный источник",
        sourceUrl: selectedBook.sourceUrl,
        usage: "reference-only",
        license: undefined,
        verified: true,
      });
    }
    return buildBookEditorialDocument({
      bookKey: bookKey(selectedBook),
      locale: language,
      themeVersion: `${focusedSceneTheme.baseColor}:${focusedSceneTheme.paperColor}`,
      title: selectedBookText.title,
      writer: selectedWriterName,
      year:
        verified && selectedBook.firstPublished
          ? { value: selectedBook.firstPublished, verified: true }
          : undefined,
      language:
        verified && selectedOriginalLanguage
          ? { value: selectedOriginalLanguage, verified: true }
          : undefined,
      country: verified
        ? {
            value: countryName(
              selectedBook.country.code,
              selectedBook.countryName
            ),
            verified: true,
          }
        : undefined,
      metadata: editionMetadata,
      description:
        verified && selectedBookText.description
          ? { value: selectedBookText.description, verified: true }
          : undefined,
      sourceRights,
    });
  }, [
    countryName,
    focusedSceneTheme.baseColor,
    focusedSceneTheme.paperColor,
    language,
    selectedBook,
    selectedBookText,
    selectedItem?.status,
    selectedMetadataLabels,
    selectedOriginalLanguage,
    selectedWriterName,
  ]);

  const fallbackDossier = useMemo(() => selectedLegacyDocument ? buildBookDossierFromEditorial(selectedLegacyDocument, {
    descriptionProfile: selectedBook?.translations?.[language],
    relatedArticles: relatedArticles.map(article => ({
      id: article.id, title: article.title,
      href: articlePath(article.id, article.title, article.sectionId, article.slug),
    })),
  }) : null, [selectedLegacyDocument, selectedBook, language, relatedArticles]);
  const publishedDossier = usePublishedBookDossier(selectedBook ? bookKey(selectedBook) : null, language);
  const selectedDossier = publishedDossier.document || fallbackDossier;
  const dossierSourceDocument = useMemo(() => selectedDossier ? toBookEditorialDocument(selectedDossier) : null, [selectedDossier]);
  const [pagination, setPagination] = useState<{ sourceKey: string; result: BookInspectionPaginationResult } | null>(null);
  const [dossierAnchor, setDossierAnchor] = useState<BookDossierSemanticAnchor | null>(null);
  useEffect(() => {
    if (!dossierSourceDocument) return;
    let current = true;
    void paginateBookInspectionDocument(dossierSourceDocument, {
      maximumPages: selectedDossier?.tier ? BOOK_DOSSIER_LIMITS[selectedDossier.tier].maximum : 18,
    }).then(result => {
      if (current) setPagination({ sourceKey: dossierSourceDocument.cacheKey, result });
    }).catch(() => {
      if (current) setPagination({ sourceKey: dossierSourceDocument.cacheKey, result: {
        status: "needs-design-review", document: null, sourceDocument: dossierSourceDocument,
        issues: ["Page measurement unavailable"],
      } });
    });
    return () => { current = false; };
  }, [dossierSourceDocument, selectedDossier?.tier]);
  const selectedEditorialDocument = pagination?.sourceKey === dossierSourceDocument?.cacheKey
    ? pagination?.result.document || null : null;
  const activeDossierAnchor = inspectionSession?.bookKey === selectedDossier?.bookKey
    ? inspectionSession?.semanticPosition?.anchor || dossierAnchor : dossierAnchor;
  const navigateDossier = useCallback((anchor: BookDossierSemanticAnchor) => {
    setDossierAnchor(anchor);
    const current = inspectionSessionRef.current;
    if (!selectedEditorialDocument || !current || current.phase !== "idle") return;
    const pageIndex = selectedEditorialDocument.pages.findIndex(page =>
      page.anchor?.sectionId === anchor.sectionId && page.anchor?.blockId === anchor.blockId &&
      (!anchor.itemId || page.anchor.itemId === anchor.itemId));
    if (pageIndex < 0) return;
    const next = createBookInspectionSession({
      bookKey: selectedEditorialDocument.bookKey, pageCount: selectedEditorialDocument.pages.length,
      pages: selectedEditorialDocument.pages, pageIndex,
      requestId: ++inspectionRequestSequenceRef.current,
    });
    inspectionSessionRef.current = next;
    setInspectionSession(next);
  }, [selectedEditorialDocument]);

  useEffect(() => {
    if (!selectedBook) {
      inspectionSessionRef.current = null;
      setInspectionSession(null);
      return;
    }
    if (!selectedEditorialDocument) return;
    const selectedKey = bookKey(selectedBook);
    const current = inspectionSessionRef.current;
    const restoredContext =
      restoredNavigationContextRef.current?.selectedBookKey === selectedKey
        ? restoredNavigationContextRef.current
        : null;
    if (current?.bookKey === selectedKey) {
      const remapped = remapBookInspectionSessionPages(current, selectedKey, selectedEditorialDocument.pages);
      inspectionSessionRef.current = remapped;
      setInspectionSession(remapped);
      if (restoredContext) restoredNavigationContextRef.current = null;
      return;
    }
    const savedProgress = savedReadingsRef.current.find(item => item.kind === "book" && item.id === selectedKey)?.dossierProgress;
    const savedPageIndex = savedProgress ? selectedEditorialDocument.pages.findIndex(page =>
      page.id === savedProgress.pageId || (page.anchor?.sectionId === savedProgress.anchor.sectionId &&
        page.anchor?.blockId === savedProgress.anchor.blockId && page.anchor?.itemId === savedProgress.anchor.itemId)) : -1;
    const next = createBookInspectionSession({
      bookKey: selectedKey,
      pageCount: selectedEditorialDocument.pages.length,
      pages: selectedEditorialDocument.pages,
      pageIndex: restoredContext?.pageIndex ?? Math.max(0, savedPageIndex),
      requestId: ++inspectionRequestSequenceRef.current,
    });
    if (restoredContext) restoredNavigationContextRef.current = null;
    inspectionSessionRef.current = next;
    setInspectionSession(next);
  }, [selectedBook, selectedEditorialDocument]);
  useEffect(() => {
    const session = inspectionSession;
    const position = session?.semanticPosition;
    if (!session?.bookKey || session.phase !== "idle" || !position?.anchor) return;
    setDossierProgress(session.bookKey, { anchor: position.anchor, pageId: position.pageId, updatedAt: new Date().toISOString() });
  }, [inspectionSession, setDossierProgress]);
  const createNavigationContext = useCallback((
    focusOrigin: BookArchiveNavigationFocusOrigin | null =
      navigationFocusOriginRef.current
  ): BookArchiveNavigationContext => {
    const filters = {
      quickPreset: filterState.quickPreset,
      authorKey: filterState.authorKey,
      countryIds: filterState.countryIds,
      genreIds: filterState.genreIds,
      audienceIds: filterState.audienceIds,
      periods: filterState.periods,
      originalLanguageIds: filterState.originalLanguageIds,
      editorialStatuses: filterState.editorialStatuses,
      coverModes: filterState.coverModes,
      articleRelations: filterState.articleRelations,
      savedOnly: filterState.savedOnly,
      sort: filterState.sort,
    };
    return {
      version: BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION,
      shelfId: collectionShelfSelection.activeShelfId,
      search: { query, scope: searchScope },
      filters,
      viewMode,
      focusedBookKey,
      pageIndex: inspectionSessionRef.current?.pageIndex || 0,
      scroll: {
        x: Math.max(0, Math.round(window.scrollX)),
        y: Math.max(0, Math.round(window.scrollY)),
      },
      selectedBookKey: selectedBook ? bookKey(selectedBook) : null,
      inspectionOpen: [
        "COVER_OPENING",
        "BOOK_OPEN",
        "PAGE_DRAGGING",
        "PAGE_SETTLING",
      ].includes(shelfStateRef.current.phase),
      focusOrigin,
    };
  }, [
    collectionShelfSelection.activeShelfId,
    filterState,
    focusedBookKey,
    query,
    searchScope,
    selectedBook,
    viewMode,
  ]);
  const persistNavigationContext = useCallback((
    focusOrigin: BookArchiveNavigationFocusOrigin | null =
      navigationFocusOriginRef.current
  ) => {
    const context = createNavigationContext(focusOrigin);
    const serialized = serializeBookArchiveNavigationContext(context);
    if (!serialized) return;
    try {
      writeBookArchiveNavigationContext(window.sessionStorage, context);
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          [BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY]: serialized,
        },
        "",
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
    } catch {
      // Private browsing may deny storage/history writes; navigation still works.
    }
  }, [createNavigationContext]);
  useEffect(() => {
    persistNavigationContext();
  }, [persistNavigationContext]);
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(persistNavigationContext, 160);
    };
    const persistImmediately = () => persistNavigationContext();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pagehide", persistImmediately);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pagehide", persistImmediately);
    };
  }, [persistNavigationContext]);
  useEffect(() => {
    const context = initialNavigationContext;
    if (!context || (!context.scroll.x && !context.scroll.y)) return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(context.scroll.x, context.scroll.y);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialNavigationContext]);
  useEffect(() => {
    if (!pendingNavigationFocusOrigin || !selectedBook) return;
    const frame = window.requestAnimationFrame(() => {
      const target = [
        ...(detailRef.current?.querySelectorAll<HTMLElement>(
          "[data-book-navigation-origin]"
        ) || []),
      ].find(
        (element) =>
          element.dataset.bookNavigationOrigin === pendingNavigationFocusOrigin
      );
      if (!target) return;
      target.focus({ preventScroll: true });
      setPendingNavigationFocusOrigin(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingNavigationFocusOrigin, relatedArticles, selectedBook]);
  const isBookSaved = (book: BookArchiveEntry) =>
    savedReadings.some(
      (item) => item.kind === "book" && item.id === bookKey(book)
    );
  const readingLibraryPayload = useCallback(
    (book: BookArchiveEntry) => ({
      id: bookKey(book),
      kind: "book" as const,
      title: presentBookArchiveEntry(book, language).title,
      sectionId: book.countryId,
      sectionLabel: `${selectBookWriterName(book, language, t("Автор"))} · ${countryName(
        book.country.code,
        book.countryName
      )}`,
      href: "#books",
    }),
    [countryName, language, t]
  );
  const isBookFavorite = (book: BookArchiveEntry) =>
    favoriteKeys.has(bookKey(book));
  const toggleBookFavorite = (book: BookArchiveEntry) =>
    void toggleFavorite(bookKey(book));
  const collectionMembershipShelves = useMemo<
    readonly BookCollectionMembershipShelf[]
  >(() => {
    if (!collectionDialogBook) return [];
    const selectedKey = bookKey(collectionDialogBook);
    const saved = savedReadings.find(
      (item) => item.kind === "book" && item.id === selectedKey
    );
    const shelves: BookCollectionMembershipShelf[] = [];
    for (const option of collectionShelfSelection.options) {
      if (!option.collection) continue;
      if (option.kind === "system") {
        const systemType = option.collection.systemType;
        const checked =
          systemType === "library"
            ? Boolean(saved)
            : systemType === "want-to-read"
              ? saved?.status === "saved"
              : systemType === "reading"
                ? saved?.status === "reading"
                : saved?.status === "finished";
        shelves.push({
          id: option.id,
          title: option.title,
          description: option.description,
          kind: "system" as const,
          checked,
          count: option.count,
        });
        continue;
      }
      if (
        option.kind !== "manual" &&
        option.kind !== "smart" &&
        option.kind !== "editorial"
      ) {
        continue;
      }
      shelves.push({
        id: option.id,
        title: option.title,
        description: option.description,
        kind: option.kind,
        checked: option.candidateKeySet.has(selectedKey),
        disabled: option.kind !== "manual",
        count: option.count,
      });
    }
    return shelves;
  }, [collectionDialogBook, collectionShelfSelection, savedReadings]);
  const updateCollectionMembership = useCallback(
    async (shelfId: string, checked: boolean) => {
      const book = collectionDialogBook;
      if (!book) return;
      const selectedKey = bookKey(book);
      const option = collectionShelfSelection.options.find(
        (candidate) => candidate.id === shelfId
      );
      if (!option?.collection) throw new Error("book-collection-not-found");
      if (option.kind === "system") {
        const systemType = option.collection.systemType;
        const payload = readingLibraryPayload(book);
        const current = savedReadings.find(
          (item) => item.kind === "book" && item.id === selectedKey
        );
        if (systemType === "library") {
          const saved = checked
            ? await saveReading(payload, current?.status || "saved")
            : await removeReading(selectedKey, "book");
          if (!saved) throw new Error("reading-library-write-failed");
          return;
        }
        const desiredStatus =
          systemType === "reading"
            ? "reading"
            : systemType === "finished"
              ? "finished"
              : "saved";
        if (checked) {
          if (!(await saveReading(payload, desiredStatus))) {
            throw new Error("reading-library-write-failed");
          }
        } else if (current?.status === desiredStatus) {
          const saved =
            desiredStatus === "saved"
              ? await removeReading(selectedKey, "book")
              : await saveReading(payload, "saved");
          if (!saved) throw new Error("reading-library-write-failed");
        }
        return;
      }
      if (option.kind !== "manual") {
        throw new Error("book-collection-read-only");
      }
      const saved = checked
        ? await addBookToCollection(option.id, selectedKey)
        : await removeBookFromCollection(option.id, selectedKey);
      if (!saved) throw new Error("book-collection-write-failed");
    },
    [
      addBookToCollection,
      collectionDialogBook,
      collectionShelfSelection,
      readingLibraryPayload,
      removeBookFromCollection,
      removeReading,
      saveReading,
      savedReadings,
    ]
  );
  const createManualShelfAndAdd = useCallback(
    async (title: string) => {
      const book = collectionDialogBook;
      if (!book) return;
      const now = new Date().toISOString();
      const suffix =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const collection = parseBookCollection({
        id: `manual:${suffix}`,
        kind: "manual",
        title,
        icon: "book",
        visibility: "private",
        backgroundPreset: "dynamic",
        dynamicBookThemes: true,
        themeIntensity: 72,
        sortMode: "manual",
        schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      });
      if (!collection || !(await upsertCollection(collection))) {
        throw new Error("book-collection-create-failed");
      }
      if (!(await addBookToCollection(collection.id, bookKey(book)))) {
        await removeCollection(collection.id);
        throw new Error("book-collection-write-failed");
      }
      setActiveShelfId(collection.id);
      replaceBookShelfLocation(collection.id, "push");
    }, [
      addBookToCollection,
      collectionDialogBook,
      removeCollection,
      upsertCollection,
    ]
  );
  const createEmptyManualShelf = useCallback(async () => {
    const now = new Date().toISOString();
    const suffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const collection = parseBookCollection({
      id: `manual:${suffix}`,
      kind: "manual",
      title:
        t("Новая полка") +
        " " +
        number(
          bookCollections.filter((candidate) => candidate.kind === "manual")
            .length + 1
        ),
      icon: "book",
      visibility: "private",
      backgroundPreset: "dynamic",
      dynamicBookThemes: true,
      themeIntensity: 72,
      sortMode: "manual",
      schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    });
    if (!collection || !(await upsertCollection(collection))) {
      setSmartShelfStatus(t("Не удалось создать личную полку"));
      return;
    }
    setActiveShelfId(collection.id);
    setManagerCollectionId(collection.id);
    replaceBookShelfLocation(collection.id, "push");
  }, [bookCollections, number, t, upsertCollection]);
  const managedBookCollection = useMemo<ManagedBookCollection | null>(() => {
    const collection = bookCollections.find(
      (candidate) => candidate.id === managerCollectionId
    );
    return collection &&
      collection.visibility === "private" &&
      (collection.kind === "manual" || collection.kind === "smart")
      ? (collection as ManagedBookCollection)
      : null;
  }, [bookCollections, managerCollectionId]);
  const managedCollectionItems = useMemo<
    readonly BookCollectionManagerBookItem[]
  >(() => {
    if (!managedBookCollection || managedBookCollection.kind !== "manual") {
      return [];
    }
    return bookCollectionSnapshot.items
      .filter((item) => item.collectionId === managedBookCollection.id)
      .sort(
        (left, right) =>
          left.position - right.position ||
          left.bookKey.localeCompare(right.bookKey, "en")
      )
      .map((item) => {
        const archiveItem = queueByKey.get(item.bookKey);
        if (!archiveItem) {
          return {
            bookKey: item.bookKey,
            title: item.bookKey,
            missing: true,
          };
        }
        return {
          bookKey: item.bookKey,
          title: presentBookArchiveQueueItem(archiveItem, language).title,
          writer: selectBookWriterName(
            archiveItem.book,
            language,
            t("Автор")
          ),
        };
      });
  }, [
    bookCollectionSnapshot.items,
    language,
    managedBookCollection,
    queueByKey,
    t,
  ]);
  const saveManagedCollection = useCallback(
    async (collectionId: string, update: BookCollectionManagerUpdate) => {
      const current = bookCollections.find(
        (collection) => collection.id === collectionId
      );
      if (!current) throw new Error("book-collection-not-found");
      const next = parseBookCollection({
        ...current,
        ...update,
        updatedAt: new Date().toISOString(),
      });
      if (!next || !(await upsertCollection(next))) {
        throw new Error("book-collection-update-failed");
      }
    },
    [bookCollections, upsertCollection]
  );
  const reorderManagedCollection = useCallback(
    async (collectionId: string, orderedBookKeys: readonly string[]) => {
      if (!(await reorderBooksInCollection(collectionId, orderedBookKeys))) {
        throw new Error("book-collection-reorder-failed");
      }
    },
    [reorderBooksInCollection]
  );
  const removeManagedCollectionBook = useCallback(
    async (collectionId: string, managedBookKey: string) => {
      if (!(await removeBookFromCollection(collectionId, managedBookKey))) {
        throw new Error("book-collection-remove-failed");
      }
    },
    [removeBookFromCollection]
  );
  const deleteManagedCollection = useCallback(
    async (collectionId: string) => {
      if (!(await removeCollection(collectionId))) {
        throw new Error("book-collection-delete-failed");
      }
      setManagerCollectionId(null);
      if (activeShelfId === collectionId) {
        setActiveShelfId(BOOK_COLLECTION_ALL_SHELF_ID);
        setFocusedBookKey(queue.all[0]?.key || null);
        replaceBookShelfLocation(BOOK_COLLECTION_ALL_SHELF_ID, "replace");
      }
    },
    [activeShelfId, queue.all, removeCollection]
  );

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
          setSearchScope("library");
          return;
        case "select-country":
          updateFilterState({
            query: "",
            countryIds: [action.countryId],
          });
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
          const shelfOption = collectionShelfSelection.options.find(
            (option) => option.id === action.collectionId
          );
          if (shelfOption) {
            setActiveShelfId(shelfOption.id);
            setFocusedBookKey(shelfOption.candidateKeys[0] || null);
            replaceBookShelfLocation(shelfOption.id, "push");
            setSearchScope("library");
          }
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
            setActiveShelfId(smartShelf.id);
            replaceBookShelfLocation(smartShelf.id, "push");
            setSearchScope("library");
            return;
          }
          if (shelfOption) return;
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
          persistNavigationContext();
          navigateToArticle(action.article);
      }
    },
    [
      applyQuickFilter,
      collectionShelfSelection.options,
      openBookDetail,
      persistNavigationContext,
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
    const ruleParts = [
      ...(query.trim() ? [`${t("Поиск")}: «${query.trim()}»`] : []),
      ...(selectedAuthorOption
        ? [`${t("Автор")}: ${selectedAuthorOption.label}`]
        : []),
      ...(filterState.countryIds.length
        ? [`${t("Страны")}: ${number(filterState.countryIds.length)}`]
        : []),
      ...(filterState.genreIds.length
        ? [`${t("Жанры")}: ${number(filterState.genreIds.length)}`]
        : []),
      ...(filterState.audienceIds.length
        ? [`${t("Аудитория")}: ${number(filterState.audienceIds.length)}`]
        : []),
      ...(filterState.periods.length
        ? [`${t("Периоды")}: ${number(filterState.periods.length)}`]
        : []),
      ...(filterState.savedOnly ? [t("Только сохранённые книги")] : []),
      `${t("Сортировка")}: ${t(sortLabels[filterState.sort])}`,
    ];
    const collection = parseBookCollection({
      id: "smart-" + Date.now().toString(36),
      kind: "smart",
      title: t("Моя умная полка") + " " + number(smartShelves.length + 1),
      icon: "star",
      description:
        `${ruleParts.join(" · ")} · ` +
        (language === "en"
          ? `${number(facetResult.total)} works now`
          : `${number(facetResult.total)} произведений сейчас`),
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
    setActiveShelfId(collection.id);
    replaceBookShelfLocation(collection.id, "push");
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
    facetResult.total,
    language,
    number,
    query,
    searchScope,
    selectedAuthorOption,
    smartShelves.length,
    t,
    upsertCollection,
  ]);
  const personalCollectionStatus =
    smartShelfStatus ||
    (bookCollectionError
      ? language === "en"
        ? "Personal shelves could not be synced. The last change was rolled back."
        : "Не удалось синхронизировать личные полки. Последнее изменение отменено."
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

  const changeActiveShelf = useCallback(
    (shelfId: string) => {
      const option = collectionShelfSelection.options.find(
        (candidate) => candidate.id === shelfId
      );
      if (!option || option.id === collectionShelfSelection.activeShelfId) return;
      setRandomAnnouncement("");
      setActiveShelfId(option.id);
      setSearchScope("library");
      setVisibleCount(COMPLETE_SHELF_CATALOG_BATCH_SIZE);
      setFocusedBookKey(option.candidateKeys[0] || null);
      if (option.collection) {
        updateFilterState({ sort: option.collection.sortMode });
      }
      replaceBookShelfLocation(option.id, "push");
    },
    [collectionShelfSelection, updateFilterState]
  );
  const removeMissingCollectionReference = useCallback(
    async (shelfId: string, missingBookKey: string, source: string) => {
      if (source === "favorite") {
        await toggleFavorite(missingBookKey);
        return;
      }
      const option = collectionShelfSelection.options.find(
        (candidate) => candidate.id === shelfId
      );
      if (option?.kind === "system") {
        removeReading(missingBookKey, "book");
        return;
      }
      if (option?.kind === "manual") {
        await removeBookFromCollection(shelfId, missingBookKey);
      }
    },
    [
      collectionShelfSelection,
      removeBookFromCollection,
      removeReading,
      toggleFavorite,
    ]
  );
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
  if (filterState.sort !== "editorial-relevance" && filterState.sort !== "manual") {
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
    searchScope === "global" &&
    globalSearchPending &&
    activeSearchResponse.normalizedQuery.length >=
      activeSearchProfile.minQueryLength ? (
      <div
        className="book-shelf-search-results is-loading"
        role="status"
        aria-live="polite"
      >
        <div className="book-shelf-search-results__summary">
          <strong>{t("Ищем во всём архиве…")}</strong>
          <span>{t("Подключаем статьи, книги, писателей и страны.")}</span>
        </div>
      </div>
    ) : searchScope === "global" &&
      globalSearchError &&
      activeSearchResponse.normalizedQuery.length >=
        activeSearchProfile.minQueryLength ? (
      <div
        className="book-shelf-search-results is-error"
        role="alert"
      >
        <div className="book-shelf-search-results__summary">
          <strong>{t("Поиск временно недоступен")}</strong>
          <span>{t("Книги на полке сохранены без изменений.")}</span>
        </div>
        <ul>
          <li>
            <button
              type="button"
              onClick={() =>
                setGlobalSearchRetryAttempt((attempt) => attempt + 1)
              }
            >
              <span>{t("Повторить поиск")}</span>
            </button>
          </li>
        </ul>
      </div>
    ) :
    activeSearchResponse.normalizedQuery.length >=
    activeSearchProfile.minQueryLength ? (
      <div className="book-shelf-search-results">
        <div className="book-shelf-search-results__summary">
          <strong>
            {searchScope === "global"
              ? t("Подсказки единого каталога")
              : searchScope === "archive"
                ? t("Подсказки всего книжного архива")
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
                    : searchScope === "archive"
                      ? t("Результаты поиска по всему книжному архиву")
                      : t("Результаты поиска по текущей полке")
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
  const activeShelfHasNoBooks =
    collectionShelfSelection.activeOption.count === 0;
  const mobileDetailMotion = getBookShelfMobileDetailMotion(reducedMotion);
  const mobileDetailDisplayPosition =
    mobileDetailState.phase === "settling"
      ? mobileDetailState.targetPosition
      : mobileDetailState.position;
  const mobileDetailStyle = {
    "--book-detail-drag-offset": `${mobileDetailState.dragOffsetPx}px`,
    "--book-detail-motion-duration": `${mobileDetailMotion.durationMs}ms`,
    "--book-detail-motion-easing": mobileDetailMotion.easing,
  } as CSSProperties;
  const shelfViewportInsets = useBookShelfViewportInsets({
    sceneRef: shelfSceneRef,
    detailRef: detailOverlayRef,
    active: viewMode === "shelf" && Boolean(selectedBook),
    layoutKey: `${selectedBook ? bookKey(selectedBook) : ""}:${mobileDetailDisplayPosition}:${shelfState.phase}`,
  });
  const tooltipKey = !selectedBook && viewMode === "shelf"
    ? hoveredSpine?.key || (shelfHasKeyboardFocus ? focusedBookKey : null) : null;
  const tooltipBook = tooltipKey ? sceneItems.find((item) => item.key === tooltipKey) : null;
  const tooltipIndex = tooltipKey ? filteredItems.findIndex((item) => item.key === tooltipKey) : -1;
  const focusedAnnouncementItem = focusedBookKey
    ? queueByKey.get(focusedBookKey) || null
    : null;
  const focusedAnnouncement = focusedAnnouncementItem
    ? presentBookArchiveQueueItem(focusedAnnouncementItem, language)
    : null;
  const focusedAnnouncementWriter = focusedAnnouncementItem
    ? selectBookWriterName(focusedAnnouncementItem.book, language, t("Автор"))
    : "";
  const shelfLiveMessage = randomAnnouncement
    ? randomAnnouncement
    : shelfFailure
      ? t("Трёхмерная полка недоступна. Открыт безопасный каталог.")
      : selectedBook
        ? `${selectedBookText?.title || selectedBook.title}. ${selectedWriterName}. ${
            shelfState.phase === "BOOK_OPEN"
              ? language === "en"
                ? `Page ${(inspectionSession?.pageIndex || 0) + 1} of ${inspectionSession?.pageCount || 1}`
                : `Страница ${(inspectionSession?.pageIndex || 0) + 1} из ${inspectionSession?.pageCount || 1}`
              : t("Открыты сведения о книге")
          }`
        : focusedAnnouncement
          ? `${focusedAnnouncement.title}. ${focusedAnnouncementWriter}. ${number(
              navigationIndex + 1
            )} ${t("из")} ${number(navigationCount)}. ${
              collectionShelfSelection.activeOption.title
            }. ${number(filteredItems.length)} ${t("результатов")}.`
          : t("В архиве нет книг по выбранным условиям");

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
        liveMessage={shelfLiveMessage}
        liveRegion={{
          priority: shelfFailure ? "assertive" : "polite",
          busy: bookCollectionSyncStatus === "syncing",
          label: t("Состояние книжной полки"),
        }}
      >
        <div className="book-shelf-frame__search-rail">
          <BookShelfControls
            query={query}
            onQueryChange={(value) => {
              setRandomAnnouncement("");
              setQuery(value);
            }}
            searchLabel={t("Поиск по книге, автору или стране")}
            searchPlaceholder={language === "en" ? "Title, author, country" : "Название, автор, страна"}
            searchScope={searchScope}
            onSearchScopeChange={setSearchScope}
            libraryScopeLabel={t("Текущая полка")}
            archiveScopeLabel={t("Весь книжный архив")}
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
          <BookCollectionShelfSwitcher
            selection={collectionShelfSelection}
            onChange={changeActiveShelf}
            labels={{
              control: t("Текущая полка"),
              emptyGroup: t("Пока нет полок"),
              ready: (count) =>
                language === "en"
                  ? `${number(count)} works`
                  : `${number(count)} произведений`,
              unresolved: t("Подборка обновляется"),
              empty: t("Пока пусто"),
              missing: (count) =>
                language === "en"
                  ? `${number(count)} unavailable`
                  : `${number(count)} недоступно`,
              partial: (available, missing) =>
                language === "en"
                  ? `${number(available)} works, ${number(missing)} unavailable`
                  : `${number(available)} произведений, ${number(missing)} недоступно`,
            }}
          />
          <div className="book-shelf-frame__collection-actions">
            <button
              type="button"
              onClick={() => void createEmptyManualShelf()}
            >
              <span aria-hidden="true">＋</span>
              {t("Новая полка")}
            </button>
            {collectionShelfSelection.activeOption.manageable ? (
              <button
                type="button"
                onClick={() =>
                  setManagerCollectionId(
                    collectionShelfSelection.activeOption.id
                  )
                }
              >
                {t("Настроить полку")}
              </button>
            ) : null}
            <label className="book-shelf-quality-control">
              <span>{t("Качество")}</span>
              <select
                value={qualityPreference}
                onChange={(event) =>
                  changeQualityPreference(
                    event.currentTarget.value as BookShelfQualityPreference
                  )
                }
                aria-label={t("Качество трёхмерной полки")}
              >
                <option value="auto">
                  {t("Авто")} ·{" "}
                  {qualitySettings.profile === "HIGH"
                    ? language === "en"
                      ? "High"
                      : "Высокое"
                    : qualitySettings.profile === "BALANCED"
                      ? language === "en"
                        ? "Balanced"
                        : "Сбалансированное"
                      : language === "en"
                        ? "Economy"
                        : "Экономичное"}
                </option>
                <option value="HIGH">
                  {language === "en" ? "High" : "Высокое"}
                </option>
                <option value="BALANCED">
                  {language === "en" ? "Balanced" : "Сбалансированное"}
                </option>
                <option value="ECONOMY">
                  {language === "en" ? "Economy" : "Экономичное"}
                </option>
              </select>
            </label>
          </div>
          {collectionShelfSelection.missingReferences.length > 0 ? (
            <div className="book-shelf-frame__missing-references" role="status">
              <strong>{t("Некоторые книги больше недоступны в архиве")}</strong>
              <ul>
                {collectionShelfSelection.missingReferences.map((reference) => (
                  <li key={`${reference.shelfId}:${reference.bookKey}`}>
                    <code>{reference.bookKey}</code>
                    {reference.removable ? (
                      <button
                        type="button"
                        onClick={() =>
                          void removeMissingCollectionReference(
                            reference.shelfId,
                            reference.bookKey,
                            reference.source
                          )
                        }
                      >
                        {t("Удалить ссылку")}
                      </button>
                    ) : (
                      <span>{t("Редакционная ссылка недоступна")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="book-shelf-frame__workspace">

      {selectedBook && (
        <aside
          ref={detailOverlayRef}
          className="book-shelf-frame__detail"
          data-mobile-position={mobileDetailDisplayPosition}
          data-mobile-phase={mobileDetailState.phase}
          style={mobileDetailStyle}
          onTransitionEnd={(event) => {
            if (
              event.target !== event.currentTarget ||
              mobileDetailState.phase !== "settling"
            ) {
              return;
            }
            mobileDetailDispatch({
              type: "settled",
              transitionId: mobileDetailState.transitionId,
            });
          }}
        >
        <div className="book-detail-toolbar">
        <span className="book-detail-toolbar__label">{language === "en" ? "About the book" : "О книге"}</span>
        <button
          className="book-detail-mobile-handle"
          type="button"
          aria-controls="book-archive-detail"
          aria-expanded={mobileDetailDisplayPosition !== "collapsed"}
          aria-label={
            mobileDetailDisplayPosition === "expanded"
              ? t("Свернуть сведения о книге")
              : t("Развернуть сведения о книге")
          }
          onClick={() => {
            if (mobileDetailSuppressClickRef.current) {
              mobileDetailSuppressClickRef.current = false;
              return;
            }
            requestMobileDetailPosition(
              mobileDetailDisplayPosition === "collapsed"
                ? "half"
                : mobileDetailDisplayPosition === "half"
                  ? "expanded"
                  : "half"
            );
          }}
          onPointerDown={handleMobileDetailPointerDown}
          onPointerMove={handleMobileDetailPointerMove}
          onPointerUp={handleMobileDetailPointerUp}
          onPointerCancel={cancelMobileDetailPointer}
          onLostPointerCapture={cancelMobileDetailPointer}
        >
          <span aria-hidden="true" />
          <small>
            {mobileDetailDisplayPosition === "collapsed"
              ? t("Сведения о книге")
              : mobileDetailDisplayPosition === "half"
                ? t("Показать полностью")
                : t("Свернуть")}
          </small>
          <strong>{selectedBookText?.title || selectedBook.title}</strong>
          <span className="book-detail-mobile-author">{selectedWriterName}</span>
        </button>
        <button className="book-detail-close" type="button" onClick={closeBookDetail}
          disabled={shelfState.phase === "INSPECTION_CLOSING" || shelfState.phase === "SHELF_RESTORING"}
          aria-label={t("Закрыть карточку книги")}><BrandCloseIcon /></button>
        </div>
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
          <div
            className={`book-detail-cover${selectedCoverUrl ? " has-image" : ""}`}
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
              {selectedDossier ? <button type="button" className="book-detail-read-dossier" onClick={() => {
                requestMobileDetailPosition("expanded");
                const reader = detailRef.current?.querySelector<HTMLElement>(".book-dossier-reader");
                reader?.focus({ preventScroll: true });
                reader?.scrollIntoView({ block: "nearest", behavior: "instant" });
              }}>{language === "en" ? "Read dossier" : "Читать досье"}</button> : null}
              {viewMode === "shelf" &&
              (shelfState.phase === "INSPECTION_CLOSED" ||
                shelfState.phase === "COVER_CRACKED") ? (
                <button
                  type="button"
                  className="book-detail-open-cover"
                  disabled={!selectedEditorialDocument}
                  onClick={() =>
                    requestSelectedCoverOpen(bookKey(selectedBook))
                  }
                >
                  {t("Открыть книгу")}
                </button>
              ) : null}
              {pageNavigationActive ? (
                <div
                  className="book-detail-page-navigation"
                  aria-label={t("Навигация по редакционным страницам")}
                  aria-busy={pageNavigationBusy}
                >
                  <button
                    type="button"
                    className="book-detail-page-turn is-previous"
                    onClick={requestSelectedPreviousPage}
                    disabled={
                      pageNavigationBusy || !inspectionSession?.pageIndex
                    }
                    aria-label={t("Предыдущая страница")}
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <span role="status" aria-live="polite">
                    {language === "en"
                      ? `Page ${(inspectionSession?.pageIndex || 0) + 1} of ${inspectionSession?.pageCount || 1}`
                      : `Страница ${(inspectionSession?.pageIndex || 0) + 1} из ${inspectionSession?.pageCount || 1}`}
                  </span>
                  <button
                    type="button"
                    className="book-detail-page-turn is-next"
                    onClick={requestSelectedPageTurn}
                    disabled={
                      pageNavigationBusy ||
                      !inspectionSession ||
                      inspectionSession.pageIndex >=
                        inspectionSession.pageCount - 1
                    }
                    aria-label={t("Следующая страница")}
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={isBookSaved(selectedBook) ? "is-saved" : ""}
                aria-pressed={isBookSaved(selectedBook)}
                onClick={() => setCollectionDialogBook(selectedBook)}
              >
                <BrandHeartIcon filled={isBookSaved(selectedBook)} />
                {isBookSaved(selectedBook)
                  ? t("Управлять полками")
                  : t("Добавить на полку")}
              </button>
              <button
                type="button"
                className={isBookFavorite(selectedBook) ? "is-saved" : ""}
                aria-pressed={isBookFavorite(selectedBook)}
                onClick={() => toggleBookFavorite(selectedBook)}
              >
                <BrandHeartIcon filled={isBookFavorite(selectedBook)} />
                {isBookFavorite(selectedBook)
                  ? t("В избранном")
                  : t("В избранное")}
              </button>
              <button
                type="button"
                data-book-navigation-origin="book-author"
                onClick={() => {
                  navigationFocusOriginRef.current = "book-author";
                  persistNavigationContext("book-author");
                  const atlasState = readAtlasUrlState();
                  if (atlasState.countryId || atlasState.writerId) {
                    commitAtlasUrlState(
                      {
                        ...atlasState,
                        countryId: null,
                        writerId: null,
                      },
                      "replace",
                      window.history.state
                    );
                  }
                  onBookSelect(selectedBook);
                }}
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
              {isEditorialCover(selectedBook) ? selectedBook.coverRights?.status !== "editorial-original" ? (
                <span className="book-cover-credit">
                  {t("Редакционная обложка «Пробы Пера»")}
                </span>
              ) : null : selectedBook.coverSourceUrl ? (
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
                        data-book-navigation-origin={
                          bookArchiveArticleFocusOrigin(article.id) || undefined
                        }
                        onClick={(event) => {
                          if (!shouldUseClientNavigation(event)) return;
                          const focusOrigin = bookArchiveArticleFocusOrigin(
                            article.id
                          );
                          event.preventDefault();
                          navigationFocusOriginRef.current = focusOrigin;
                          persistNavigationContext(focusOrigin);
                          navigateToArticle(article);
                        }}
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
          {selectedDossier ? <BookDossierReader dossier={selectedDossier}
            activeAnchor={activeDossierAnchor} onNavigate={navigateDossier}
            onReadingModeChange={publishedDossier.changeMode}
            onProgressChange={publishedDossier.changeProgress}
            reachedCount={publishedDossier.reachedCount}
            onSpoilersChange={publishedDossier.changeSpoilers}
            showingSpoilers={publishedDossier.showingSpoilers}
            unavailable={publishedDossier.unavailable}
            busy={Boolean(selectedDossier.tier && publishedDossier.busy) ||
              (inspectionSession?.phase !== "idle" && Boolean(inspectionSession))} /> : null}
          <ArticleEngagement
            articleSlug={`book:${bookKey(selectedBook)}`}
            subjectType="book"
          />
        </article>
        </aside>
      )}

          <div className="book-shelf-frame__primary">
            <div
              ref={shelfSceneRef}
              className="book-shelf-frame__scene"
              hidden={viewMode !== "shelf"}
              tabIndex={viewMode === "shelf" ? 0 : -1}
              aria-keyshortcuts="ArrowLeft ArrowRight Home End PageUp PageDown Enter Space"
              role="group"
              aria-label={shelfKeyboardInstructions[language]}
              aria-describedby={tooltipBook ? "book-spine-tooltip" : undefined}
              onFocus={(event) => {
                if (event.target === event.currentTarget) setShelfHasKeyboardFocus(event.currentTarget.matches(":focus-visible"));
              }}
              onBlur={() => setShelfHasKeyboardFocus(false)}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && shelfState.phase === "BOOK_OPEN" &&
                    !event.altKey && !event.ctrlKey && !event.metaKey &&
                    requestSelectedKeyboardPage(event.key, event.shiftKey)) {
                  event.preventDefault();
                  return;
                }
                handleShelfKeyDown(event);
              }}
              onWheel={handleShelfWheel}
              onPointerDown={handleShelfPointerDown}
              onPointerUp={handleShelfPointerUp}
              onPointerCancel={() => {
                shelfPointerStartRef.current = null;
              }}
            >
              <div
                className="book-shelf-frame__cms-background"
                aria-hidden="true"
              />
              {viewMode === "shelf" && sceneItems.length > 0 && (
                <BookShelfScene
                  key={sceneLoadGeneration}
                  items={sceneItems}
                  appearance={sceneAppearance}
                  focusedBookKey={focusedBookKey}
                  selectedBookKey={selectedBook ? bookKey(selectedBook) : null}
                  viewportInsets={shelfViewportInsets}
                  onHoveredBookChange={setHoveredSpine}
                  phase={shelfState.phase}
                  requestId={shelfState.requestId}
                  active={
                    sceneNearViewport || Boolean(selectedBook || requestedBook)
                  }
                  qualitySettings={qualitySettings}
                  economical={qualitySettings.profile === "ECONOMY"}
                  reducedMotion={reducedMotion}
                  editorialDocument={selectedEditorialDocument}
                  inspectionSession={inspectionSession}
                  loadAttempt={sceneLoadGeneration === 0 ? "primary" : "retry"}
                  onFocusBook={requestFocusBook}
                  onOpenBook={handleSceneOpenBook}
                  onRequestCoverOpen={requestSelectedCoverOpen}
                  onRequestPageTurn={requestSelectedPageTurn}
                  onRequestPreviousPage={requestSelectedPreviousPage}
                  onRequestKeyboardPage={requestSelectedKeyboardPage}
                  onRequestInspectionClose={closeBookDetail}
                  onRequestSceneCenter={resetShelfFromEmptyArea}
                  onCrackCover={() =>
                    shelfDispatch({
                      type: "crack-cover",
                      requestId: shelfState.requestId + 1,
                    })
                  }
                  onStartPageDrag={startSelectedPageDrag}
                  onUpdatePageDrag={updateSelectedPageDrag}
                  onRequestPageSettle={settleSelectedPageDrag}
                  onMotionReached={(requestId) =>
                    shelfDispatch({ type: "motion-reached", requestId })
                  }
                  onMotionSettled={handleShelfMotionSettled}
                  onInspectionEntered={handleInspectionEntered}
                  onCoverOpened={(requestId) =>
                    shelfDispatch({ type: "cover-opened", requestId })
                  }
                  onPageSettled={settleSelectedPage}
                  onInspectionClosed={(requestId) =>
                    shelfDispatch({ type: "inspection-closed", requestId })
                  }
                  onShelfRestored={handleShelfRestored}
                  onContextRestored={handleShelfContextRestored}
                  onFailure={handleShelfFailure}
                  sceneLabel={t("Книжный архив")}
                  loadingLabel={t("Собираем виртуальную полку…")}
                  emptyLabel={t("На этой полке пока нет книг")}
                  openBookLabel={t("Открыть книгу")}
                  pageTurnLabel={t("Перелистнуть страницу")}
                  closeInspectionLabel={t("Закрыть карточку книги")}
                />
              )}
              {tooltipBook && tooltipIndex >= 0 ? (
                <BookShelfSpineTooltip book={tooltipBook} hit={hoveredSpine}
                  index={tooltipIndex} total={filteredItems.length} locale={language} />
              ) : null}
              {viewMode === "shelf" && sceneItems.length === 0 ? (
                <div className="book-shelf-empty-state" role="status">
                  <BrandBookIcon />
                  <span>
                    {activeShelfHasNoBooks
                      ? t("Эта полка ждёт первую книгу")
                      : t("Ничего не найдено")}
                  </span>
                  <strong>{collectionShelfSelection.activeOption.title}</strong>
                  <p>
                    {activeShelfHasNoBooks
                      ? t(
                          "Откройте весь архив, найдите произведение и добавьте его на эту полку."
                        )
                      : t(
                          "Попробуйте другое название, автора, страну или сбросьте фильтры."
                        )}
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeShelfHasNoBooks) {
                          resetArchiveFilters();
                          changeActiveShelf(BOOK_COLLECTION_ALL_SHELF_ID);
                          setSearchScope("archive");
                          setViewMode("catalog");
                          return;
                        }
                        resetArchiveFilters();
                      }}
                    >
                      {activeShelfHasNoBooks
                        ? t("Выбрать книгу из архива")
                        : t("Сбросить фильтры")}
                    </button>
                    {activeShelfHasNoBooks &&
                    collectionShelfSelection.activeShelfId !==
                    BOOK_COLLECTION_ALL_SHELF_ID ? (
                      <button
                        type="button"
                        onClick={() => changeActiveShelf(BOOK_COLLECTION_ALL_SHELF_ID)}
                      >
                        {t("Вернуться ко всему архиву")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
                    "Нажмите на корешок - книга выйдет вперёд, а справа откроются описание и сведения."
                  )}`}
                >
                  <BrandBookIcon />
                  <span>
                    <strong>{t("Выберите книгу")}</strong>
                    <small>
                      {t(
                        "Нажмите на корешок - книга выйдет вперёд, а справа откроются описание и сведения."
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
                      ? `${t("Управлять полками")}: «${localizedBook.title}»`
                      : `${t("Добавить на полку")}: «${localizedBook.title}»`
                  }
                  title={
                    isBookSaved(book)
                      ? t("Управлять полками")
                      : t("Добавить на полку")
                  }
                  onClick={() => setCollectionDialogBook(book)}
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
          <strong>
            {activeShelfHasNoBooks
              ? t("Эта полка ждёт первую книгу")
              : t("Ничего не найдено")}
          </strong>
          <p>
            {activeShelfHasNoBooks
              ? t(
                  "Откройте весь архив, найдите произведение и добавьте его на эту полку."
                )
              : t("Попробуйте другое название, автора, страну или фильтр.")}
          </p>
          <button
            type="button"
            onClick={() => {
              resetArchiveFilters();
              if (activeShelfHasNoBooks) {
                changeActiveShelf(BOOK_COLLECTION_ALL_SHELF_ID);
              }
            }}
          >
            {activeShelfHasNoBooks ? t("Открыть весь архив") : t("Сбросить фильтры")}
          </button>
        </div>
      )}

      {visibleCount < filteredItems.length && (
        <button
          className="book-archive-more"
          type="button"
          onClick={() =>
            setVisibleCount(
              (current) => current + COMPLETE_SHELF_CATALOG_BATCH_SIZE
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
            onClick={() => focusBookAt(shelfNavigation.previousIndex)}
            disabled={navigationLocked || !shelfNavigation.canMovePrevious}
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
              disabled={navigationLocked || !shelfNavigation.canMovePrevious}
              aria-label={t("Первая книга")}
            >
              <span aria-hidden="true">|</span>
              <BrandArrowIcon />
            </button>
            <button
              className="book-shelf-navigation__batch"
              type="button"
              onClick={() => focusBookAt(shelfNavigation.pagePreviousIndex)}
              disabled={navigationLocked || !shelfNavigation.canMovePagePrevious}
              aria-label={t("Предыдущие 13 произведений")}
              title={t("Предыдущие 13 произведений")}
            >
              <BrandArrowIcon />
              <span>13</span>
            </button>
            <button
              className="book-shelf-navigation__single"
              type="button"
              onClick={() => focusBookAt(shelfNavigation.previousIndex)}
              disabled={navigationLocked || !shelfNavigation.canMovePrevious}
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
            <BookShelfProgressRail
              focusIndex={shelfNavigation.focusIndex}
              total={shelfNavigation.total}
              label={t("Позиция на книжной полке")}
              valueText={(current, total) =>
                `${number(current)} ${t("из")} ${number(total)}`
              }
              onFocusIndexChange={focusBookAt}
            />
            <button
              className="book-shelf-navigation__single"
              type="button"
              onClick={() => focusBookAt(shelfNavigation.nextIndex)}
              disabled={navigationLocked || !shelfNavigation.canMoveNext}
              aria-label={t("Следующая книга")}
            >
              <BrandArrowIcon />
            </button>
            <button
              className="book-shelf-navigation__batch"
              type="button"
              onClick={() => focusBookAt(shelfNavigation.pageNextIndex)}
              disabled={navigationLocked || !shelfNavigation.canMovePageNext}
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
                navigationLocked ||
                !shelfNavigation.canMoveNext
              }
              aria-label={t("Последняя книга")}
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
              onClick={() =>
                navigationActionBook && setCollectionDialogBook(navigationActionBook)
              }
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
                        {option.label} - {option.countryLabel} (
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
        {collectionDialogBook ? (
          <BookCollectionMembershipDialog
            bookKey={bookKey(collectionDialogBook)}
            bookLabel={presentBookArchiveEntry(collectionDialogBook, language).title}
            shelves={collectionMembershipShelves}
            onToggle={updateCollectionMembership}
            onCreateShelf={createManualShelfAndAdd}
            onClose={() => setCollectionDialogBook(null)}
            copy={{
              eyebrow: t("Личная библиотека"),
              title: t("Добавить на полку"),
              description: t(
                "Отметьте полки, на которых должна находиться книга."
              ),
              shelfLegend: t("Доступные полки"),
              emptyShelves: t("Создайте первую личную полку для этой книги."),
              readOnlyHint: t(
                "Умные и редакционные полки обновляются автоматически."
              ),
              newShelfLabel: t("Новая личная полка"),
              newShelfPlaceholder: t("Например, Русская классика"),
              createAction: t("Создать и добавить"),
              closeLabel: t("Закрыть"),
              invalidTitle: t(
                "Введите корректное название длиной до 120 символов."
              ),
              actionError: t("Не удалось сохранить изменение. Попробуйте ещё раз."),
            }}
          />
        ) : null}
        {managedBookCollection ? (
          <BookCollectionManagerSheet
            collection={managedBookCollection}
            orderedItems={managedCollectionItems}
            onSave={saveManagedCollection}
            onReorder={reorderManagedCollection}
            onRemoveBook={removeManagedCollectionBook}
            onDelete={deleteManagedCollection}
            onClose={() => setManagerCollectionId(null)}
            translate={t}
            locale={language}
          />
        ) : null}
      </BookShelfFrame>
    </section>
  );
}
