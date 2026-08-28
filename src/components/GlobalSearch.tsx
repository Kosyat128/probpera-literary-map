import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  isCoverArtworkDisplayAllowed,
  type BookArchiveEntry,
} from "../data/bookArchive";
import { presentBookArchiveEntry } from "../data/bookArchiveQueue";
import { isPublicBook } from "../data/bookQuality";
import { selectBookWriterName } from "../data/bookLocalization";
import type { Country, Writer } from "../data/countries";
import {
  selectInterfacePlural,
  useInterfaceLanguage,
} from "../i18n/InterfaceLanguage";
import {
  literarySearchMatches,
  type LiterarySearchValue,
} from "../utils/literarySearch";
import {
  HEADER_GLOBAL_SEARCH_PROFILE,
  searchGlobalSearchIndex,
} from "../search/globalSearchIndex";
import {
  emptyGlobalSearchIndex,
  ensureSharedGlobalSearchIndex,
  globalSearchArchiveVersion,
  globalSearchRequestCacheKey,
  peekSharedGlobalSearchIndex,
} from "../search/globalSearchRuntime";
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

export { writerSearchLabel } from "../utils/writerSearchLabel";

export function matches(query: string, values: LiterarySearchValue[]) {
  return literarySearchMatches(query, values);
}

function resolvePublicAsset(url?: string) {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/iu.test(url)) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\/+/, "")}`;
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
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [searchLoadError, setSearchLoadError] = useState(false);
  const [searchRetryAttempt, setSearchRetryAttempt] = useState(0);
  const { language, t, countryName, number } = useInterfaceLanguage();
  const deferredQuery = useDeferredValue(query);
  const archiveVersion = useMemo(
    () => globalSearchArchiveVersion(countries, books),
    [books, countries]
  );
  const searchRuntimeRequest = useMemo(
    () => ({
      countries,
      books,
      language,
      translate: t,
      countryName,
      archiveVersion,
    }),
    [archiveVersion, books, countries, countryName, language, t]
  );
  const searchRequestKey = globalSearchRequestCacheKey(searchRuntimeRequest);
  const [searchIndexState, setSearchIndexState] = useState(() => {
    const index = peekSharedGlobalSearchIndex(searchRuntimeRequest);
    return index ? { requestKey: searchRequestKey, index } : null;
  });
  const searchIndex =
    searchIndexState?.requestKey === searchRequestKey
      ? searchIndexState.index
      : null;
  const fallbackSearchIndex = useMemo(
    () => emptyGlobalSearchIndex(language),
    [language]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSearchLoadError(false);
    const cachedIndex = peekSharedGlobalSearchIndex(searchRuntimeRequest);
    setSearchIndexState(
      cachedIndex ? { requestKey: searchRequestKey, index: cachedIndex } : null
    );
    if (cachedIndex) {
      setArticlesLoading(false);
      return;
    }
    setArticlesLoading(true);
    ensureSharedGlobalSearchIndex(searchRuntimeRequest)
      .then((index) => {
        if (!active) return;
        setSearchIndexState({ requestKey: searchRequestKey, index });
        setArticlesLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSearchIndexState(null);
        setSearchLoadError(true);
        setArticlesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, searchRequestKey, searchRetryAttempt, searchRuntimeRequest]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
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
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const searchResponse = useMemo(
    () =>
      searchGlobalSearchIndex(
        searchIndex || fallbackSearchIndex,
        deferredQuery,
        HEADER_GLOBAL_SEARCH_PROFILE
      ),
    [deferredQuery, fallbackSearchIndex, searchIndex]
  );
  const normalizedQuery = searchResponse.normalizedQuery;
  const results = useMemo(
    () => ({
      countries: searchResponse.groups.countries.map(
        ({ country }) => country
      ),
      writers: searchResponse.groups.writers.map(
        ({ country, writer }) => ({ country, writer })
      ),
      books: searchResponse.groups.books.map(
        ({ book }) => book
      ),
      articles: searchResponse.groups.articles.map(
        ({ article }) => article
      ),
    }),
    [searchResponse]
  );

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

        {searchLoadError ? (
          <div className="global-search-empty global-search-intro" role="alert">
            <strong>{t("Поиск временно недоступен")}</strong>
            <p>{t("Не удалось подключить редакционный архив. Попробуйте ещё раз.")}</p>
            <div>
              <button
                type="button"
                onClick={() => setSearchRetryAttempt((attempt) => attempt + 1)}
              >
                {t("Повторить поиск")}
              </button>
            </div>
          </div>
        ) : normalizedQuery.length < 2 ? (
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
              : searchLoadError
                ? t("Редакционный архив временно недоступен")
              : `${number(countries.length)} ${t(selectInterfacePlural(countries.length, language, ["страна", "страны", "стран"]))} · ${number(books.length)} ${t(selectInterfacePlural(books.length, language, ["произведение", "произведения", "произведений"]))} · ${number(language === "en" ? (searchIndex?.articleCount || 0) : articleCount)} ${t(selectInterfacePlural(language === "en" ? (searchIndex?.articleCount || 0) : articleCount, language, ["статья", "статьи", "статей"]))}`}
          </span>
          <small>{t("Поиск выполняется внутри сайта")}</small>
        </footer>
      </div>
    </div>
  );
}
