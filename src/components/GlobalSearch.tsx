import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getWriterWorkTitles,
  type BookArchiveEntry,
} from "../data/bookArchive";
import type { Country, Writer } from "../data/countries";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { articlePath } from "../utils/articleRoutes";
import CountryFlagIcon from "./CountryFlagIcon";

type Props = {
  open: boolean;
  countries: Country[];
  books: BookArchiveEntry[];
  onClose: () => void;
  onCountrySelect: (country: Country, writer?: Writer) => void;
  onBookSelect: (book: BookArchiveEntry) => void;
};

type WriterMatch = {
  country: Country;
  writer: Writer;
};

function writerName(writer: Writer) {
  return writer.name || writer.fullName || "Автор";
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length < 5) return token;
  return token.replace(
    /(иями|ями|ами|его|ого|ему|ому|иях|ах|ях|ию|ью|ия|ья|ие|ье|ий|ый|ой|ая|яя|ое|ее|ов|ев|ам|ям|ом|ем|у|ю|а|я|ы|и|е|о)$/u,
    ""
  );
}

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function matches(query: string, values: Array<string | undefined>) {
  const queryTokens = normalize(query).split(" ").filter(Boolean).map(stem);
  const valueTokens = normalize(values.filter(Boolean).join(" "))
    .split(" ")
    .filter(Boolean)
    .map(stem);

  return queryTokens.every((queryToken) =>
    valueTokens.some(
      (valueToken) =>
        valueToken.includes(queryToken) || queryToken.includes(valueToken)
    )
  );
}

export default function GlobalSearch({
  open,
  countries,
  books,
  onClose,
  onCountrySelect,
  onBookSelect,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<ArticleCatalogEntry[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalize(deferredQuery);

  useEffect(() => {
    if (!open || articles.length || articlesLoading) return;
    let active = true;
    setArticlesLoading(true);
    import("../data/articles/catalog")
      .then(({ articleCatalog }) => {
        if (active) setArticles(articleCatalog);
      })
      .finally(() => {
        if (active) setArticlesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articles.length, articlesLoading, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => inputRef.current?.focus());

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    if (normalizedQuery.length < 2) {
      return {
        countries: [] as Country[],
        writers: [] as WriterMatch[],
        books: [] as BookArchiveEntry[],
        articles: [] as ArticleCatalogEntry[],
      };
    }

    const countryMatches = countries
      .filter((country) =>
        matches(normalizedQuery, [
          country.name,
          country.code,
          country.capital,
          country.region,
          country.continent,
          country.officialLanguage,
          country.description,
          country.history,
          country.historicalNote,
          ...(country.facts || []),
          ...(country.literaryPlaces || []),
          ...(country.literaryPeriods || []),
          ...(country.periods || []),
          ...(country.literaryMovements || []),
        ])
      )
      .slice(0, 5);

    const writerMatches = countries
      .flatMap((country) =>
        country.writers.map((writer) => ({ country, writer }))
      )
      .filter(({ writer }) =>
        matches(normalizedQuery, [
          writerName(writer),
          writer.name,
          writer.fullName,
          writer.years,
          writer.literaryEra,
          writer.movement,
          writer.biography,
          writer.bio,
          writer.description,
          ...(writer.genres || []),
          ...(writer.tags || []),
          ...getWriterWorkTitles(writer),
          ...(writer.awards || []),
          ...(writer.languages || []),
          ...(writer.places || []),
        ])
      )
      .slice(0, 7);

    const bookMatches = books
      .filter((book) =>
        matches(normalizedQuery, [
          book.title,
          book.originalTitle,
          book.writerName,
          book.countryName,
          book.description,
          book.originalLanguage,
          ...(book.genres || []),
          ...(book.tags || []),
        ])
      )
      .slice(0, 6);

    const articleMatches = articles
      .filter((article) =>
        matches(normalizedQuery, [
          article.title,
          article.description,
          article.sectionLabel,
        ])
      )
      .slice(0, 7);

    return {
      countries: countryMatches,
      writers: writerMatches,
      books: bookMatches,
      articles: articleMatches,
    };
  }, [articles, books, countries, normalizedQuery]);

  if (!open) return null;

  const totalResults =
    results.countries.length +
    results.writers.length +
    results.books.length +
    results.articles.length;

  return (
    <div className="global-search-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="global-search"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="section-kicker">Единый каталог</span>
            <h2 id="global-search-title">Найти в «Пробе Пера»</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть поиск">
            ×
          </button>
        </header>

        <label className="global-search-field">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Страна, писатель, книга, статья, эпоха…"
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </label>

        {normalizedQuery.length < 2 ? (
          <div className="global-search-intro">
            <p>
              Поиск одновременно проверяет страны, писателей, произведения и
              редакционные публикации.
            </p>
            <div>
              <button type="button" onClick={() => setQuery("Достоевский")}>
                Достоевский
              </button>
              <button type="button" onClick={() => setQuery("Япония")}>
                Япония
              </button>
              <button type="button" onClick={() => setQuery("экранизация")}>
                Экранизации
              </button>
              <button type="button" onClick={() => setQuery("фольклор")}>
                Фольклор
              </button>
            </div>
          </div>
        ) : totalResults === 0 && !articlesLoading ? (
          <div className="global-search-empty">
            <strong>Совпадений не найдено</strong>
            <p>Попробуйте фамилию, название произведения или другую форму слова.</p>
          </div>
        ) : (
          <div className="global-search-results" aria-live="polite">
            {results.countries.length > 0 && (
              <section>
                <h3>Страны</h3>
                {results.countries.map((country) => (
                  <button
                    type="button"
                    key={country.id}
                    onClick={() => {
                      onCountrySelect(country);
                      onClose();
                    }}
                  >
                    <span>
                      <CountryFlagIcon
                        code={country.code}
                        countryName={country.name}
                        size={28}
                        decorative
                      />
                    </span>
                    <strong>{country.name}</strong>
                    <small>
                      {country.writers.length}{" "}
                      {pluralRu(country.writers.length, ["автор", "автора", "авторов"])}
                    </small>
                  </button>
                ))}
              </section>
            )}

            {results.writers.length > 0 && (
              <section>
                <h3>Писатели</h3>
                {results.writers.map(({ country, writer }) => (
                  <button
                    type="button"
                    key={`${country.id}:${writer.id}`}
                    onClick={() => {
                      onCountrySelect(country, writer);
                      onClose();
                    }}
                  >
                    <span aria-hidden="true">✦</span>
                    <strong>{writerName(writer)}</strong>
                    <small>{country.name} · {writer.years || "карточка автора"}</small>
                  </button>
                ))}
              </section>
            )}

            {results.books.length > 0 && (
              <section>
                <h3>Книги</h3>
                {results.books.map((book) => (
                  <button
                    type="button"
                    key={`${book.countryId}:${book.writerId}:${book.id}`}
                    onClick={() => {
                      onBookSelect(book);
                      onClose();
                    }}
                  >
                    <span aria-hidden="true">▤</span>
                    <strong>{book.title}</strong>
                    <small>{book.writerName} · {book.countryName}</small>
                  </button>
                ))}
              </section>
            )}

            {results.articles.length > 0 && (
              <section>
                <h3>Статьи</h3>
                {results.articles.map((article) => (
                  <a
                    key={article.id}
                    href={articlePath(
                      article.id,
                      article.title,
                      article.sectionId,
                      article.slug
                    )}
                    onClick={onClose}
                  >
                    <span aria-hidden="true">¶</span>
                    <strong>{article.title}</strong>
                    <small>
                      {article.sectionLabel} · {article.readingMinutes} мин.
                    </small>
                  </a>
                ))}
              </section>
            )}
          </div>
        )}

        <footer>
          <span>
            {articlesLoading
              ? "Подключаем редакционный архив…"
              : `${countries.length} стран · ${books.length.toLocaleString("ru-RU")} ${pluralRu(books.length, ["произведение", "произведения", "произведений"])} · ${articles.length || 157} ${pluralRu(articles.length || 157, ["статья", "статьи", "статей"])}`}
          </span>
          <small>Поиск выполняется внутри сайта</small>
        </footer>
      </div>
    </div>
  );
}
