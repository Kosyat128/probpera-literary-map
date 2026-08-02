import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getWriterWorkTitles,
  isCoverDisplayAllowed,
  type BookArchiveEntry,
} from "../data/bookArchive";
import type { Country, Writer } from "../data/countries";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  articlePath,
  navigateToArticle,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import CountryFlagIcon from "./CountryFlagIcon";
import BrandCloseIcon from "./BrandCloseIcon";
import WriterPortrait from "./WriterPortrait";

type Props = {
  open: boolean;
  countries: Country[];
  books: BookArchiveEntry[];
  articleCount: number;
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
    .replace(/°/g, " градус ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length < 5) return token;
  return token.replace(
    /(ателями|ителей|ателей|ениями|иями|ями|ами|его|ого|ему|ому|иях|ах|ях|ию|ью|ия|ья|ие|ье|ий|ый|ой|ая|яя|ое|ее|ей|ов|ев|ам|ям|ом|ем|у|ю|а|я|ы|и|е|о)$/u,
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

type SearchValue = string | null | undefined;

export function matches(query: string, values: SearchValue[]) {
  const queryTokens = searchTokens(query);
  const valueTokens = searchTokens(values.filter(Boolean).join(" "));
  if (!queryTokens.length || !valueTokens.length) return false;

  return queryTokens.every((queryToken) =>
    valueTokens.some(
      (valueToken) =>
        valueToken === queryToken ||
        valueToken.startsWith(queryToken) ||
        queryToken.startsWith(valueToken) ||
        (queryToken.length >= 5 && valueToken.includes(queryToken))
    )
  );
}

function resolvePublicAsset(url?: string) {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/iu.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\/+/, "")}`;
}

const searchStopWords = new Set([
  "а",
  "без",
  "в",
  "для",
  "и",
  "из",
  "к",
  "на",
  "о",
  "об",
  "от",
  "по",
  "с",
  "со",
]);

function searchTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !searchStopWords.has(token))
    .map(stem)
    .filter((token) => token.length >= 2);
}

function matchScore(
  query: string,
  primaryValues: SearchValue[],
  secondaryValues: SearchValue[]
) {
  const normalizedQuery = normalize(query);
  const primary = primaryValues.filter(Boolean).map((value) => normalize(value!));
  const secondary = secondaryValues
    .filter(Boolean)
    .map((value) => normalize(value!));
  if (!matches(normalizedQuery, [...primaryValues, ...secondaryValues])) {
    return null;
  }
  if (primary.some((value) => value === normalizedQuery)) return 0;
  if (primary.some((value) => value.startsWith(normalizedQuery))) return 1;
  if (primary.some((value) => value.includes(normalizedQuery))) return 2;
  if (secondary.some((value) => value.startsWith(normalizedQuery))) return 3;
  if (secondary.some((value) => value.includes(normalizedQuery))) return 4;
  return 5;
}

function rankMatches<T>(
  items: T[],
  query: string,
  primaryValues: (item: T) => SearchValue[],
  secondaryValues: (item: T) => SearchValue[],
  label: (item: T) => string
) {
  return items
    .map((item) => ({
      item,
      score: matchScore(query, primaryValues(item), secondaryValues(item)),
    }))
    .filter(
      (entry): entry is { item: T; score: number } => entry.score !== null
    )
    .sort(
      (first, second) =>
        first.score - second.score ||
        label(first.item).localeCompare(label(second.item), "ru")
    )
    .map((entry) => entry.item);
}

export default function GlobalSearch({
  open,
  countries,
  books,
  articleCount,
  onClose,
  onCountrySelect,
  onBookSelect,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<ArticleCatalogEntry[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const { language, t, countryName, number } = useInterfaceLanguage();
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

    const countryMatches = rankMatches(
      countries,
      normalizedQuery,
      (country) => [
          country.name,
          countryName(country.code, country.name),
          country.code,
          country.capital,
      ],
      (country) => [
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
      ],
      (country) => countryName(country.code, country.name)
    ).slice(0, 5);

    const writerMatches = rankMatches(
      countries.flatMap((country) =>
        country.writers.map((writer) => ({ country, writer }))
      ),
      normalizedQuery,
      ({ writer }) => [
          writerName(writer),
          writer.name,
          writer.fullName,
          ...getWriterWorkTitles(writer),
      ],
      ({ writer }) => [
          writer.years,
          writer.literaryEra,
          writer.movement,
          writer.biography,
          writer.bio,
          writer.description,
          ...(writer.genres || []),
          ...(writer.tags || []),
          ...(writer.awards || []),
          ...(writer.languages || []),
          ...(writer.places || []),
      ],
      ({ writer }) => writerName(writer)
    ).slice(0, 7);

    const bookMatches = rankMatches(
      books,
      normalizedQuery,
      (book) => [
          book.title,
          book.originalTitle,
          ...(book.alternateTitles || []),
          book.writerName,
      ],
      (book) => [
          book.countryName,
          countryName(book.country.code, book.countryName),
          book.description,
          book.originalLanguage,
          ...(book.genres || []),
          ...(book.tags || []),
      ],
      (book) => book.title
    ).slice(0, 6);

    const articleMatches = rankMatches(
      articles,
      normalizedQuery,
      (article) => [article.title],
      (article) => [
          article.title,
          article.description,
          article.sectionLabel,
          article.seoTitle,
          article.seoDescription,
          ...(article.seoKeywords || []),
      ],
      (article) => article.title
    ).slice(0, 7);

    return {
      countries: countryMatches,
      writers: writerMatches,
      books: bookMatches,
      articles: articleMatches,
    };
  }, [articles, books, countries, countryName, normalizedQuery]);

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
            <span className="section-kicker">{t("Единый каталог")}</span>
            <h2 id="global-search-title">{t("Найти в «Пробе Пера»")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Закрыть поиск")}>
            <BrandCloseIcon />
          </button>
        </header>

        <label className="global-search-field">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Страна, писатель, книга, статья, эпоха…")}
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </label>

        {normalizedQuery.length < 2 ? (
          <div className="global-search-intro">
            <p>
              {t(
                "Поиск одновременно проверяет страны, писателей, произведения и редакционные публикации."
              )}
            </p>
            <div>
              <button
                type="button"
                onClick={() => setQuery("Достоевский")}
              >
                {language === "en" ? "Dostoevsky" : "Достоевский"}
              </button>
              <button
                type="button"
                onClick={() => setQuery(language === "en" ? "Japan" : "Япония")}
              >
                {language === "en" ? "Japan" : "Япония"}
              </button>
              <button type="button" onClick={() => setQuery("экранизация")}>
                Экранизации
              </button>
              <button type="button" onClick={() => setQuery("фольклор")}>
                Фольклор
              </button>
            </div>
          </div>
        ) : totalResults === 0 && articlesLoading ? (
          <div className="global-search-empty is-loading" role="status">
            <span className="global-search-loader" aria-hidden="true" />
            <strong>{t("Ищем во всём архиве…")}</strong>
            <p>{t("Подключаем статьи, книги, писателей и страны.")}</p>
          </div>
        ) : totalResults === 0 ? (
          <div className="global-search-empty">
            <strong>{t("Совпадений не найдено")}</strong>
            <p>
              {t(
                "Попробуйте фамилию, название произведения или другую форму слова."
              )}
            </p>
          </div>
        ) : (
          <div className="global-search-results" aria-live="polite">
            {results.countries.length > 0 && (
              <section>
                <h3>{t("Страны")}</h3>
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
                    <strong>{countryName(country.code, country.name)}</strong>
                    <small>
                      {number(country.writers.length)}{" "}
                      {language === "en"
                        ? country.writers.length === 1
                          ? "writer"
                          : "writers"
                        : pluralRu(country.writers.length, [
                            "автор",
                            "автора",
                            "авторов",
                          ])}
                    </small>
                  </button>
                ))}
              </section>
            )}

            {results.writers.length > 0 && (
              <section>
                <h3>{t("Писатели")}</h3>
                {results.writers.map(({ country, writer }) => (
                  <button
                    type="button"
                    key={`${country.id}:${writer.id}`}
                    onClick={() => {
                      onCountrySelect(country, writer);
                      onClose();
                    }}
                  >
                    <WriterPortrait
                      writer={writer}
                      className="global-search-writer-portrait"
                      decorative
                    />
                    <strong>{writerName(writer)}</strong>
                    <small>
                      {countryName(country.code, country.name)} ·{" "}
                      {writer.years || t("карточка автора")}
                    </small>
                  </button>
                ))}
              </section>
            )}

            {results.books.length > 0 && (
              <section>
                <h3>{t("Книги")}</h3>
                {results.books.map((book) => (
                  <button
                    type="button"
                    key={`${book.countryId}:${book.writerId}:${book.id}`}
                    onClick={() => {
                      onBookSelect(book);
                      onClose();
                    }}
                  >
                    <span className="global-search-book-cover" aria-hidden="true">
                      {isCoverDisplayAllowed(book) ? (
                        <img
                          src={resolvePublicAsset(
                            book.coverThumbnailUrl || book.coverUrl
                          )}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span>▤</span>
                      )}
                    </span>
                    <strong>{book.title}</strong>
                    <small>
                      {book.writerName} ·{" "}
                      {countryName(book.country.code, book.countryName)}
                    </small>
                  </button>
                ))}
              </section>
            )}

            {results.articles.length > 0 && (
              <section>
                <h3>{t("Статьи")}</h3>
                {results.articles.map((article) => (
                  <a
                    key={article.id}
                    href={articlePath(
                      article.id,
                      article.title,
                      article.sectionId,
                      article.slug
                    )}
                    onClick={(event) => {
                      onClose();
                      if (!shouldUseClientNavigation(event)) return;
                      event.preventDefault();
                      navigateToArticle(article);
                    }}
                  >
                    <span aria-hidden="true">¶</span>
                    <strong>{article.title}</strong>
                    <small>
                      {article.sectionLabel} · {article.readingMinutes} {t("мин.")}
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
              ? t("Подключаем редакционный архив…")
              : language === "en"
                ? `${number(countries.length)} countries · ${number(books.length)} works · ${number(articleCount)} articles`
                : `${number(countries.length)} стран · ${number(books.length)} ${pluralRu(books.length, ["произведение", "произведения", "произведений"])} · ${number(articleCount)} ${pluralRu(articleCount, ["статья", "статьи", "статей"])}`}
          </span>
          <small>{t("Поиск выполняется внутри сайта")}</small>
        </footer>
      </div>
    </div>
  );
}
