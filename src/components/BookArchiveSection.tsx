import { useDeferredValue, useEffect, useMemo, useState } from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import type { BookArchiveEntry } from "../data/bookArchive";

type ArchiveFilter = "all" | "verified" | "covers" | "classic" | "modern";

type Props = {
  books: BookArchiveEntry[];
  onBookSelect: (book: BookArchiveEntry) => void;
};

const archiveFilters: Array<{
  id: ArchiveFilter;
  label: string;
}> = [
  { id: "all", label: "Весь архив" },
  { id: "verified", label: "Проверено" },
  { id: "covers", label: "С обложками" },
  { id: "classic", label: "До 1945 года" },
  { id: "modern", label: "После 1945 года" },
];

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ru");
}

function editorialRank(book: BookArchiveEntry) {
  if (book.editorial?.status === "verified") return 0;
  if (book.editorial?.status === "reviewed") return 1;
  return 2;
}

function bookKey(book: BookArchiveEntry) {
  return `${book.countryId}:${book.writerId}:${book.id}`;
}

export default function BookArchiveSection({
  books,
  onBookSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedBook, setSelectedBook] = useState<BookArchiveEntry | null>(
    null
  );
  const deferredQuery = useDeferredValue(query);

  const counts = useMemo(
    () => ({
      all: books.length,
      verified: books.filter(
        (book) =>
          book.editorial?.status === "verified" ||
          book.editorial?.status === "reviewed"
      ).length,
      covers: books.filter((book) => Boolean(book.coverUrl)).length,
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
        if (filter === "covers" && !book.coverUrl) return false;
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
        if (Boolean(first.coverUrl) !== Boolean(second.coverUrl)) {
          return first.coverUrl ? -1 : 1;
        }
        return first.title.localeCompare(second.title, "ru");
      });
  }, [books, deferredQuery, filter]);

  useEffect(() => {
    setVisibleCount(12);
  }, [deferredQuery, filter]);

  const visibleBooks = filteredBooks.slice(0, visibleCount);

  return (
    <section className="book-archive-section" id="books">
      <header className="book-archive-heading">
        <div>
          <span className="section-kicker">Книги, авторы, страны</span>
          <h2>Книжный архив</h2>
          <p>
            Произведения связаны с карточками писателей и литературными
            традициями стран. Расширенные сведения публикуются только после
            редакционной проверки.
          </p>
        </div>
        <div className="book-archive-total">
          <strong>{books.length.toLocaleString("ru-RU")}</strong>
          <span>произведений из единой базы стран</span>
        </div>
      </header>

      <div className="book-archive-toolbar">
        <label>
          <span>Поиск по книге, автору или стране</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например, Достоевский или Япония"
          />
        </label>
        <div className="book-archive-filters" aria-label="Фильтры книжного архива">
          {archiveFilters.map((item) => (
            <button
              className={filter === item.id ? "is-active" : ""}
              type="button"
              key={item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedBook && (
        <article className="book-detail-card" aria-live="polite">
          <button
            className="book-detail-close"
            type="button"
            onClick={() => setSelectedBook(null)}
            aria-label="Закрыть карточку книги"
          >
            ×
          </button>
          <div
            className={`book-detail-cover${selectedBook.coverUrl ? " has-image" : ""}`}
          >
            {selectedBook.coverUrl ? (
              <img
                src={selectedBook.coverUrl}
                alt={`Обложка книги «${selectedBook.title}»`}
              />
            ) : (
              <>
                <small>Проба Пера</small>
                <strong>{selectedBook.title}</strong>
                <span>✦</span>
              </>
            )}
          </div>
          <div className="book-detail-copy">
            <span className="section-kicker">
              {selectedBook.editorial?.status === "verified"
                ? "Проверено редакцией"
                : selectedBook.editorial?.status === "reviewed"
                  ? "Редакционная карточка"
                  : "Архивная запись"}
            </span>
            <h3>{selectedBook.title}</h3>
            {selectedBook.originalTitle && (
              <p className="book-original-title">
                {selectedBook.originalTitle}
              </p>
            )}
            <dl>
              <div>
                <dt>Автор</dt>
                <dd>{selectedBook.writerName}</dd>
              </div>
              <div>
                <dt>Страна</dt>
                <dd>{selectedBook.countryName}</dd>
              </div>
              {selectedBook.firstPublished && (
                <div>
                  <dt>Первая публикация</dt>
                  <dd>{selectedBook.firstPublished}</dd>
                </div>
              )}
              {selectedBook.originalLanguage && (
                <div>
                  <dt>Язык оригинала</dt>
                  <dd>{selectedBook.originalLanguage}</dd>
                </div>
              )}
            </dl>
            <p>
              {selectedBook.description ||
                "Произведение уже связано с автором и страной. Расширенная аннотация, история публикации и библиография находятся в редакционной очереди — неподтверждённые сведения здесь не публикуются."}
            </p>
            <div className="book-tags" aria-label="Темы и жанры книги">
              {[...(selectedBook.genres || []), ...(selectedBook.tags || [])]
                .slice(0, 6)
                .map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
            </div>
            <div className="book-detail-actions">
              <button
                type="button"
                onClick={() => onBookSelect(selectedBook)}
              >
                Открыть автора и страну <span>→</span>
              </button>
              {selectedBook.sourceUrl && (
                <a
                  href={selectedBook.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Источник сведений
                </a>
              )}
              {selectedBook.coverSourceUrl && (
                <a
                  href={selectedBook.coverSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Источник обложки
                </a>
              )}
            </div>
          </div>
          <ArticleEngagement
            articleSlug={`book:${bookKey(selectedBook)}`}
            subjectType="book"
            compact
          />
        </article>
      )}

      <div className="book-archive-grid">
        {visibleBooks.map((book) => (
          <article className="archive-book-card" key={bookKey(book)}>
            <div className={`archive-book-cover${book.coverUrl ? " has-image" : ""}`}>
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={`Обложка книги «${book.title}»`}
                  loading="lazy"
                />
              ) : (
                <>
                  <small>Проба Пера</small>
                  <strong>{book.title}</strong>
                  <span>✦</span>
                </>
              )}
            </div>
            <div className="archive-book-copy">
              <small>
                {book.countryName}
                {book.firstPublished ? ` · ${book.firstPublished}` : ""}
              </small>
              <h3>{book.title}</h3>
              <p>{book.writerName}</p>
              <div>
                <span
                  className={`editorial-state is-${book.editorial?.status || "draft"}`}
                >
                  {book.editorial?.status === "verified"
                    ? "проверено"
                    : book.editorial?.status === "reviewed"
                      ? "редакционная карточка"
                      : "в очереди"}
                </span>
                <button type="button" onClick={() => setSelectedBook(book)}>
                  О книге
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredBooks.length === 0 && (
        <div className="book-archive-empty">
          <strong>Ничего не найдено</strong>
          <p>Попробуйте другое название, автора, страну или фильтр.</p>
        </div>
      )}

      {visibleCount < filteredBooks.length && (
        <button
          className="book-archive-more"
          type="button"
          onClick={() => setVisibleCount((current) => current + 12)}
        >
          Показать ещё 12
          <span>
            {visibleBooks.length} из {filteredBooks.length}
          </span>
        </button>
      )}
    </section>
  );
}
