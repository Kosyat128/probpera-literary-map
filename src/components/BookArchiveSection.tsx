import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import {
  bookArchiveKey,
  coverArtworkSrcSet,
  isEditorialCover,
  isCoverArtworkDisplayAllowed,
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
  type BookArticleMention,
} from "../data/articles/bookMentions";
import { articleCatalog } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { articlePath } from "../utils/articleRoutes";
import {
  cmsEntityFieldMarker,
  cmsEntityMarker,
} from "../cms/directEditBridge";
import {
  literarySearchMatches,
  normalizeLiterarySearch,
} from "../utils/literarySearch";
import BrandHeartIcon from "./BrandHeartIcon";
import BrandCloseIcon from "./BrandCloseIcon";

type ArchiveFilter = "all" | "verified" | "pending" | "classic" | "modern";

type Props = {
  books: BookArchiveEntry[];
  onBookSelect: (book: BookArchiveEntry) => void;
  requestedBook?: BookArchiveEntry | null;
  onRequestedBookHandled?: () => void;
};

const archiveFilters: Array<{
  id: ArchiveFilter;
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
    id: "pending",
    label: "Непроверенные",
    description: "Карточки в редакционной очереди",
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
];

function editorialRank(item: BookArchiveQueueItem) {
  return item.status === "verified" ? 0 : 1;
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

function hasArchiveCover(book: BookArchiveEntry) {
  return isCoverArtworkDisplayAllowed(book);
}

export default function BookArchiveSection({
  books,
  onBookSelect,
  requestedBook,
  onRequestedBookHandled,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedBook, setSelectedBook] = useState<BookArchiveEntry | null>(
    null
  );
  const [relatedArticles, setRelatedArticles] = useState<BookArticleMention[]>(
    []
  );
  const [relatedArticlesLoading, setRelatedArticlesLoading] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { items: savedReadings, toggle: toggleSavedReading } =
    useReadingLibrary();
  const { language, t, countryName, number } = useInterfaceLanguage();
  const deferredQuery = useDeferredValue(query);
  const queue = useMemo(() => classifyBookArchiveQueue(books), [books]);
  const openBookDetail = useCallback((
    book: BookArchiveEntry,
    returnFocus?: HTMLElement | null
  ) => {
    returnFocusRef.current = returnFocus || null;
    setSelectedBook(book);
    replaceBookLocation(
      bookKey(book),
      requestedBookKey(window.location.search) ? "replace" : "push"
    );
  }, []);
  const restoreBookTriggerFocus = useCallback(
    (returnFocus: HTMLElement | null) => {
      window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const fallback = document.querySelector<HTMLElement>(
              ".book-archive-toolbar input"
            );
            (returnFocus?.isConnected ? returnFocus : fallback)?.focus({
              preventScroll: true,
            });
          });
        });
      }, 0);
    },
    []
  );
  const closeBookDetail = useCallback(() => {
    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    setSelectedBook(null);
    if (window.history.state?.[bookDetailHistoryStateKey]) {
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
  }, [restoreBookTriggerFocus]);

  const counts = useMemo(
    () => ({
      all: queue.counts.total,
      verified: queue.counts.verified,
      pending: queue.counts.pending,
      classic: queue.verified.filter(
        ({ book }) =>
          typeof book.firstPublished === "number" && book.firstPublished <= 1945
      ).length,
      modern: queue.verified.filter(
        ({ book }) =>
          typeof book.firstPublished === "number" && book.firstPublished > 1945
      ).length,
    }),
    [queue]
  );

  const indexedItems = useMemo(
    () =>
      queue.all.map((item) => {
        const { book } = item;
        const displayedBook = presentBookArchiveQueueItem(item, language);
        return {
          item,
          displayedBook,
          searchValues: [
            displayedBook.title,
            book.originalTitle,
            ...(book.alternateTitles || []),
            selectBookWriterName(book, language, t("Автор")),
            countryName(book.country.code, book.countryName),
            ...(item.status === "verified"
              ? [
                  displayedBook.description,
                  selectBookOriginalLanguage(book, language),
                  ...selectBookMetadataLabels(book, language, t),
                ]
              : []),
          ],
        };
      }),
    [countryName, language, queue, t]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeLiterarySearch(deferredQuery);
    return indexedItems
      .filter(({ item, searchValues }) => {
        const { book } = item;
        if (filter === "verified" && item.status !== "verified") return false;
        if (filter === "pending" && item.status !== "pending") return false;
        if (
          filter === "classic" &&
          (item.status !== "verified" ||
            !book.firstPublished ||
            book.firstPublished > 1945)
        ) {
          return false;
        }
        if (
          filter === "modern" &&
          (item.status !== "verified" ||
            !book.firstPublished ||
            book.firstPublished <= 1945)
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        return literarySearchMatches(normalizedQuery, searchValues);
      })
      .sort((first, second) => {
        const rankDifference =
          editorialRank(first.item) - editorialRank(second.item);
        if (rankDifference) return rankDifference;
        if (
          hasArchiveCover(first.item.book) !== hasArchiveCover(second.item.book)
        ) {
          return hasArchiveCover(first.item.book) ? -1 : 1;
        }
        return first.displayedBook.title.localeCompare(
          second.displayedBook.title,
          language
        );
      })
      .map(({ item }) => item);
  }, [deferredQuery, filter, indexedItems, language]);

  useEffect(() => {
    setVisibleCount(12);
  }, [deferredQuery, filter]);

  useEffect(() => {
    const openFromLocation = () => {
      const key = requestedBookKey(window.location.search);
      const resolution = resolveRequestedBook(books, key);
      if (resolution.status === "none") {
        setSelectedBook(null);
        return;
      }
      if (resolution.status === "pending") return;
      if (resolution.status === "missing") {
        setSelectedBook(null);
        replaceBookLocation(null);
        return;
      }
      setSelectedBook(resolution.book);
      replaceBookLocation(key);
    };

    openFromLocation();
    window.addEventListener("popstate", openFromLocation);
    return () => window.removeEventListener("popstate", openFromLocation);
  }, [books]);

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
  }, [selectedBook]);

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
  const queueByKey = useMemo(
    () => new Map(queue.all.map((item) => [item.key, item])),
    [queue]
  );
  const selectedItem = selectedBook
    ? queueByKey.get(bookKey(selectedBook)) || null
    : null;
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

  return (
    <section className="book-archive-section" id="books">
      <header className="book-archive-heading">
        <div>
          <span className="section-kicker">{t("Книги, авторы, страны")}</span>
          <h2>{t("Книжный архив")}</h2>
          <p>
            {t(
              "Произведения связаны с карточками писателей и литературными традициями стран. Расширенные сведения публикуются только после редакционной проверки."
            )}
          </p>
        </div>
        <div className="book-archive-total">
          <strong>{number(queue.counts.total)}</strong>
          <span>{t("произведений из единой базы стран")}</span>
        </div>
      </header>

      <div className="book-archive-toolbar">
        <label>
          <span>{t("Поиск по книге, автору или стране")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Например, Достоевский или Япония")}
          />
        </label>
        <div className="book-filter-panel">
          <div className="book-filter-heading">
            <span>{t("Отбор архива")}</span>
            <small aria-live="polite">
              {number(filteredItems.length)} {t("результатов")}
            </small>
          </div>
          <div
            className="book-archive-filters"
            role="group"
            aria-label={t("Фильтры книжного архива")}
          >
            {archiveFilters.map((item) => (
              <button
                className={filter === item.id ? "is-active" : ""}
                type="button"
                key={item.id}
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
              >
                <span className="book-filter-copy">
                  <strong>{t(item.label)}</strong>
                  <small>{t(item.description)}</small>
                </span>
                <span className="book-filter-count">{number(counts[item.id])}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedBook && (
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
                sizes="(max-width: 680px) 44vw, 360px"
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
      )}

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
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            {t("Весь архив")}
          </button>
        </div>
      )}

      {visibleCount < filteredItems.length && (
        <button
          className="book-archive-more"
          type="button"
          onClick={() => setVisibleCount((current) => current + 12)}
        >
          {t("Показать ещё 12")}
          <span>
            {language === "en"
              ? `${number(visibleItems.length)} of ${number(filteredItems.length)}`
              : `${number(visibleItems.length)} из ${number(filteredItems.length)}`}
          </span>
        </button>
      )}
    </section>
  );
}
