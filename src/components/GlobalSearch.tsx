import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getPublicWriterWorkTitles,
  isCoverArtworkDisplayAllowed,
  type BookArchiveEntry,
} from "../data/bookArchive";
import { presentBookArchiveEntry } from "../data/bookArchiveQueue";
import { isPublicBook } from "../data/bookQuality";
import {
  selectBookMetadataLabels,
  selectBookOriginalLanguage,
  selectBookWriterName,
} from "../data/bookLocalization";
import type { Country, Writer } from "../data/countries";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import { writerBiographyText } from "../data/writerBiography";
import {
  selectInterfacePlural,
  useInterfaceLanguage,
} from "../i18n/InterfaceLanguage";
import {
  literarySearchMatches,
  literarySearchMatchScore,
  normalizeLiterarySearch,
  type LiterarySearchValue,
} from "../utils/literarySearch";
import {
  articlePath,
  navigateToArticle,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import { writerSearchLabel } from "../utils/writerSearchLabel";
import CountryFlagIcon from "./CountryFlagIcon";
import BrandBookIcon from "./BrandBookIcon";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandSearchIcon from "./BrandSearchIcon";
import WriterPortrait from "./WriterPortrait";
import IconButton from "../ui/IconButton";

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

export { writerSearchLabel } from "../utils/writerSearchLabel";

export function matches(query: string, values: LiterarySearchValue[]) {
  return literarySearchMatches(query, values);
}

function resolvePublicAsset(url?: string) {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/iu.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\/+/, "")}`;
}

function matchScore(
  query: string,
  primaryValues: LiterarySearchValue[],
  secondaryValues: LiterarySearchValue[]
) {
  return literarySearchMatchScore(query, primaryValues, secondaryValues);
}

function rankMatches<T>(
  items: T[],
  query: string,
  primaryValues: (item: T) => LiterarySearchValue[],
  secondaryValues: (item: T) => LiterarySearchValue[],
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
  const normalizedQuery = normalizeLiterarySearch(deferredQuery);
  const localizedArticles = useMemo(
    () =>
      articles.flatMap((article) => {
        const localized = articleCatalogEntryForLanguage(article, language);
        return localized ? [localized] : [];
      }),
    [articles, language]
  );
  const bookSearchDocuments = useMemo(
    () =>
      books.map((book) => {
        const displayedBook = presentBookArchiveEntry(book, language);
        const verified = isPublicBook(book);
        return {
          book,
          label: displayedBook.title,
          primaryValues: [
            displayedBook.title,
            book.originalTitle,
            selectBookWriterName(book, language, t("Автор")),
          ],
          secondaryValues: [
            countryName(book.country.code, book.countryName),
            ...(book.alternateTitles || []),
            ...(verified
              ? [
                  displayedBook.description,
                  selectBookOriginalLanguage(book, language),
                  ...selectBookMetadataLabels(book, language, t),
                ]
              : []),
          ],
        };
      }),
    [books, countryName, language, t]
  );

  useEffect(() => {
    if (!open || articles.length) return;
    let active = true;
    setArticlesLoading(true);
    import("../data/articles/catalog")
      .then(({ articleCatalog }) => {
        if (!active) return;
        setArticles(articleCatalog);
        setArticlesLoading(false);
      })
      .catch(() => {
        if (active) setArticlesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articles.length, open]);

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

    const writerCandidates = countries.flatMap((country) =>
      country.writers.flatMap((writer) =>
        writerSearchLabel(writer, language) ? [{ country, writer }] : []
      )
    );
    const writerMatches = rankMatches(
      writerCandidates,
      normalizedQuery,
      ({ writer }) => [
          writerSearchLabel(writer, language),
          writer.name,
          writer.fullName,
          ...getPublicWriterWorkTitles(writer, language),
      ],
      ({ country, writer }) => [
          writer.years,
          writer.literaryEra,
          writer.literaryEra ? t(writer.literaryEra) : "",
          writer.movement,
          writer.movement ? t(writer.movement) : "",
          writerBiographyText(writer, language),
          ...(writer.genres || []),
          ...(writer.genres || []).map((genre) => t(genre)),
          ...(writer.tags || []),
          ...(writer.tags || []).map((tag) => t(tag)),
          ...(writer.awards || []),
          ...(writer.languages || []),
          ...(writer.places || []),
          country.name,
          countryName(country.code, country.name),
          country.code,
      ],
      ({ writer }) => writerSearchLabel(writer, language) || ""
    ).slice(0, 7);

    const bookMatches = rankMatches(
      bookSearchDocuments,
      normalizedQuery,
      (document) => document.primaryValues,
      (document) => document.secondaryValues,
      (document) => document.label
    )
      .slice(0, 6)
      .map((document) => document.book);

    const articleMatches = rankMatches(
      localizedArticles,
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
  }, [
    bookSearchDocuments,
    countries,
    countryName,
    language,
    localizedArticles,
    normalizedQuery,
    t,
  ]);

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
          <IconButton
            icon={<BrandCloseIcon />}
            surface="dark"
            onClick={onClose}
            aria-label={t("Закрыть поиск")}
          />
        </header>

        <label className="global-search-field">
          <span aria-hidden="true"><BrandSearchIcon /></span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Страна, писатель, книга, статья, эпоха…")}
            aria-label={t("Страна, писатель, книга, статья, эпоха…")}
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
                onClick={() => setQuery(t("Достоевский"))}
              >
                {t("Достоевский")}
              </button>
              <button
                type="button"
                onClick={() => setQuery(t("Япония"))}
              >
                {t("Япония")}
              </button>
              <button
                type="button"
                onClick={() => setQuery(t("Экранизация"))}
              >
                {t("Экранизации")}
              </button>
              <button
                type="button"
                onClick={() => setQuery(t("Фольклор"))}
              >
                {t("Фольклор")}
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
                        className="global-search-country-flag country-flag-icon--round"
                        code={country.code}
                        countryName={country.name}
                        size={28}
                        decorative
                      />
                    </span>
                    <strong>{countryName(country.code, country.name)}</strong>
                    <small>
                      {number(country.writers.length)}{" "}
                      {t(
                        selectInterfacePlural(country.writers.length, language, [
                          "автор",
                          "автора",
                          "авторов",
                        ])
                      )}
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
                    <strong>{writerSearchLabel(writer, language)}</strong>
                    <small>
                      {countryName(country.code, country.name)} ·{" "}
                      {language === "en" &&
                      /\p{Script=Cyrillic}/u.test(writer.years || "")
                        ? t("карточка автора")
                        : writer.years || t("карточка автора")}
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
                      {isCoverArtworkDisplayAllowed(book) ? (
                        <img
                          src={resolvePublicAsset(
                            book.coverThumbnailUrl || book.coverUrl
                          )}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span><BrandBookIcon /></span>
                      )}
                    </span>
                    <strong>{presentBookArchiveEntry(book, language).title}</strong>
                    <small>
                      {selectBookWriterName(book, language, t("Автор"))} ·{" "}
                      {countryName(book.country.code, book.countryName)} ·{" "}
                      {isPublicBook(book)
                        ? t("проверено")
                        : t("Не проверено")}
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
              : `${number(countries.length)} ${t(selectInterfacePlural(countries.length, language, ["страна", "страны", "стран"]))} · ${number(books.length)} ${t(selectInterfacePlural(books.length, language, ["произведение", "произведения", "произведений"]))} · ${number(language === "en" ? localizedArticles.length : articleCount)} ${t(selectInterfacePlural(language === "en" ? localizedArticles.length : articleCount, language, ["статья", "статьи", "статей"]))}`}
          </span>
          <small>{t("Поиск выполняется внутри сайта")}</small>
        </footer>
      </div>
    </div>
  );
}
