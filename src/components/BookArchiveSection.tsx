import { useDeferredValue, useEffect, useMemo, useState } from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import {
  isEditorialCover,
  isCoverArtworkDisplayAllowed,
  type BookArchiveEntry,
} from "../data/bookArchive";
import {
  getBookArticleMentions,
  type BookArticleMention,
} from "../data/articles/bookMentions";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { articlePath } from "../utils/articleRoutes";
import BrandHeartIcon from "./BrandHeartIcon";
import BrandCloseIcon from "./BrandCloseIcon";

type ArchiveFilter = "all" | "verified" | "covers" | "classic" | "modern";

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
    id: "covers",
    label: "С обложками",
    description: "Изображения с указанным источником",
  },
  {
    id: "classic",
    label: "Опубликовано до 1945",
    description: "Ранние издания и классика",
  },
  {
    id: "modern",
    label: "Опубликовано после 1945",
    description: "Литература второй половины XX–XXI века",
  },
];

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/°/g, " градус ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editorialRank(book: BookArchiveEntry) {
  if (book.editorial?.status === "verified") return 0;
  if (book.editorial?.status === "reviewed") return 1;
  return 2;
}

function bookKey(book: BookArchiveEntry) {
  return `${book.countryId}:${book.writerId}:${book.id}`;
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
  const { items: savedReadings, toggle: toggleSavedReading } =
    useReadingLibrary();
  const { language, t, countryName, number } = useInterfaceLanguage();
  const deferredQuery = useDeferredValue(query);

  const counts = useMemo(
    () => ({
      all: books.length,
      verified: books.filter(
        (book) =>
          book.editorial?.status === "verified" ||
          book.editorial?.status === "reviewed"
      ).length,
      covers: books.filter(hasArchiveCover).length,
      classic: books.filter(
        (book) =>
          typeof book.firstPublished === "number" &&
          book.firstPublished <= 1945
      ).length,
      modern: books.filter(
        (book) =>
          typeof book.firstPublished === "number" &&
          book.firstPublished > 1945
      ).length,
    }),
    [books]
  );

  const filteredBooks = useMemo(() => {
    const normalizedQuery = normalize(deferredQuery);
    return books
      .filter((book) => {
        if (
          filter === "verified" &&
          !["verified", "reviewed"].includes(book.editorial?.status || "")
        ) {
          return false;
        }
        if (filter === "covers" && !hasArchiveCover(book)) {
          return false;
        }
        if (
          filter === "classic" &&
          (!book.firstPublished || book.firstPublished > 1945)
        ) {
          return false;
        }
        if (
          filter === "modern" &&
          (!book.firstPublished || book.firstPublished <= 1945)
        ) {
          return false;
        }
        if (!normalizedQuery) return true;

        const searchValues = [
          book.title,
          book.originalTitle,
          ...(book.alternateTitles || []),
          book.writerName,
          book.countryName,
          ...(book.genres || []),
          ...(book.tags || []),
        ];
        return searchValues.some((value) =>
          normalize(value || "").includes(normalizedQuery)
        );
      })
      .sort((first, second) => {
        const rankDifference = editorialRank(first) - editorialRank(second);
        if (rankDifference) return rankDifference;
        if (
          hasArchiveCover(first) !== hasArchiveCover(second)
        ) {
          return hasArchiveCover(first) ? -1 : 1;
        }
        return first.title.localeCompare(second.title, "ru");
      });
  }, [books, deferredQuery, filter]);

  useEffect(() => {
    setVisibleCount(12);
  }, [deferredQuery, filter]);

  useEffect(() => {
    if (!requestedBook) return;
    setSelectedBook(requestedBook);
    onRequestedBookHandled?.();
    window.requestAnimationFrame(() => {
      document.getElementById("books")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [onRequestedBookHandled, requestedBook]);

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
        if (active) setRelatedArticles(articles);
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
  }, [selectedBook]);

  const visibleBooks = filteredBooks.slice(0, visibleCount);
  const selectedCoverUrl = selectedBook
    ? isCoverArtworkDisplayAllowed(selectedBook)
      ? selectedBook.coverUrl
      : undefined
    : undefined;
  const isBookSaved = (book: BookArchiveEntry) =>
    savedReadings.some(
      (item) => item.kind === "book" && item.id === bookKey(book)
    );
  const toggleBook = (book: BookArchiveEntry) =>
    toggleSavedReading({
      id: bookKey(book),
      kind: "book",
      title: book.title,
      sectionId: book.countryId,
      sectionLabel: `${book.writerName} · ${book.countryName}`,
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
          <strong>{number(books.length)}</strong>
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
              {number(filteredBooks.length)} {t("результатов")}
            </small>
          </div>
          <div
            className="book-archive-filters"
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
        <article className="book-detail-card" aria-live="polite">
          <button
            className="book-detail-close"
            type="button"
            onClick={() => setSelectedBook(null)}
            aria-label={t("Закрыть карточку книги")}
          >
            <BrandCloseIcon />
          </button>
          <div
            className={`book-detail-cover${selectedCoverUrl ? " has-image" : ""}`}
          >
            {selectedCoverUrl ? (
              <img
                src={resolveCoverUrl(selectedCoverUrl)}
                srcSet={
                  isCoverArtworkDisplayAllowed(selectedBook) &&
                  selectedBook.coverThumbnailUrl
                    ? `${resolveCoverUrl(selectedBook.coverThumbnailUrl)} 400w, ${resolveCoverUrl(selectedBook.coverUrl)} 800w`
                    : undefined
                }
                sizes="(max-width: 680px) 44vw, 360px"
                alt={
                  isEditorialCover(selectedBook)
                    ? `${t("Редакционная обложка")} «${selectedBook.title}»`
                    : `${t("Обложка конкретного издания")} «${selectedBook.title}»`
                }
              />
            ) : (
              <>
                <small>{selectedBook.writerName}</small>
                <strong>{selectedBook.title}</strong>
                <span aria-hidden="true">✦</span>
              </>
            )}
          </div>
          <div className="book-detail-copy">
            <span className="section-kicker">
              {selectedBook.editorial?.status === "verified"
                ? t("Проверено редакцией")
                : selectedBook.editorial?.status === "reviewed"
                  ? t("Редакционная карточка")
                  : t("Архивная запись")}
            </span>
            <h3>{selectedBook.title}</h3>
            {selectedBook.originalTitle && (
              <p className="book-original-title">
                {selectedBook.originalTitle}
              </p>
            )}
            <dl>
              <div>
                <dt>{t("Автор")}</dt>
                <dd>{selectedBook.writerName}</dd>
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
              {selectedBook.firstPublished && (
                <div>
                  <dt>{t("Первая публикация")}</dt>
                  <dd>{selectedBook.firstPublished}</dd>
                </div>
              )}
              {selectedBook.originalLanguage && (
                <div>
                  <dt>{t("Язык оригинала")}</dt>
                  <dd>{selectedBook.originalLanguage}</dd>
                </div>
              )}
            </dl>
            <p>
              {selectedBook.description ||
                t(
                  "Произведение уже связано с автором и страной. Расширенная аннотация, история публикации и библиография находятся в редакционной очереди — неподтверждённые сведения здесь не публикуются."
                )}
            </p>
            <div className="book-tags" aria-label={t("Темы и жанры книги")}>
              {[...(selectedBook.genres || []), ...(selectedBook.tags || [])]
                .slice(0, 6)
                .map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
            </div>
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
                  {t("Источник сведений")}
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
              {selectedBook.edition?.publisher && (
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
              {(selectedBook.edition?.isbn13 || selectedBook.edition?.isbn10) && (
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
        {visibleBooks.map((book) => {
          const coverUrl = isCoverArtworkDisplayAllowed(book)
            ? book.coverThumbnailUrl || book.coverUrl
            : undefined;
          return (
          <article className="archive-book-card" key={bookKey(book)}>
            <div
              className={`archive-book-cover${coverUrl ? " has-image" : ""}`}
            >
              {coverUrl ? (
                <img
                  src={resolveCoverUrl(coverUrl)}
                  srcSet={
                    isCoverArtworkDisplayAllowed(book) && book.coverThumbnailUrl
                      ? `${resolveCoverUrl(book.coverThumbnailUrl)} 400w, ${resolveCoverUrl(book.coverUrl)} 800w`
                      : undefined
                  }
                  sizes="(max-width: 680px) 42vw, 190px"
                  alt={
                    isEditorialCover(book)
                      ? `${t("Редакционная обложка")} «${book.title}»`
                      : `${t("Обложка конкретного издания")} «${book.title}»`
                  }
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <>
                  <small>{book.writerName}</small>
                  <strong>{book.title}</strong>
                  <span aria-hidden="true">✦</span>
                </>
              )}
            </div>
            <div className="archive-book-copy">
              <small>
                {countryName(book.country.code, book.countryName)}
                {book.firstPublished ? ` · ${book.firstPublished}` : ""}
              </small>
              <h3>{book.title}</h3>
              <p>{book.writerName}</p>
              <div>
                <span
                  className={`editorial-state is-${book.editorial?.status || "draft"}`}
                >
                  {book.editorial?.status === "verified"
                    ? t("проверено")
                    : book.editorial?.status === "reviewed"
                      ? t("редакционная карточка")
                      : t("в очереди")}
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
                      ? `Удалить «${book.title}» из библиотеки`
                      : `Добавить «${book.title}» в библиотеку`
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
                <button type="button" onClick={() => setSelectedBook(book)}>
                  {t("О книге")}
                </button>
              </div>
            </div>
          </article>
          );
        })}
      </div>

      {filteredBooks.length === 0 && (
        <div className="book-archive-empty">
          <strong>{t("Ничего не найдено")}</strong>
          <p>{t("Попробуйте другое название, автора, страну или фильтр.")}</p>
        </div>
      )}

      {visibleCount < filteredBooks.length && (
        <button
          className="book-archive-more"
          type="button"
          onClick={() => setVisibleCount((current) => current + 12)}
        >
          {t("Показать ещё 12")}
          <span>
            {language === "en"
              ? `${number(visibleBooks.length)} of ${number(filteredBooks.length)}`
              : `${number(visibleBooks.length)} из ${number(filteredBooks.length)}`}
          </span>
        </button>
      )}
    </section>
  );
}
