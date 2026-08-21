import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import {
  articleCatalog,
  type ArticleCatalogEntry,
} from "../data/articles/catalog";
import { mediaFocusStyle } from "../utils/mediaFocus";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import {
  articleIdFromPath,
  articlePath,
  journalPath,
  journalSectionFromPath,
  navigateToArticle,
  navigateToJournal,
  resolveArticleRoute,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import {
  selectInterfacePlural,
  useInterfaceLanguage,
} from "../i18n/InterfaceLanguage";
import {
  articleSeriesId,
  articleSeriesLabel,
} from "../utils/articleSeries";
import { cmsEntityMarker } from "../cms/directEditBridge";

const ArticleReader = lazy(() => import("./ArticleReader"));

const sectionOrder = [
  "book-opinions",
  "literary-essays",
  "writers-world",
  "screen-adaptations",
  "book-guides",
  "language",
  "awards",
  "folklore",
  "author-stories",
];

const relatedSections: Record<string, readonly string[]> = {
  "book-opinions": ["book-guides", "screen-adaptations"],
  "screen-adaptations": ["book-opinions", "book-guides"],
  "book-guides": ["book-opinions", "literary-essays"],
  "writers-world": ["awards", "literary-essays"],
  awards: ["writers-world", "literary-essays"],
  folklore: ["literary-essays", "language"],
  language: ["literary-essays", "folklore"],
  "literary-essays": ["language", "folklore", "writers-world"],
  "author-stories": ["writers-world", "literary-essays"],
};

const recommendationStopWords = new Set([
  "автор",
  "была",
  "были",
  "книга",
  "книги",
  "который",
  "литература",
  "литературы",
  "материал",
  "роман",
  "статья",
  "сегодня",
  "этого",
  "этой",
  "это",
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function searchStem(value: string) {
  if (value.length <= 4) return value;
  return value.slice(0, Math.min(7, Math.max(4, value.length - 2)));
}

function matchesSearch(source: string, query: string) {
  const normalizedSource = normalize(source);
  const sourceWords = normalizedSource.split(/\s+/u);
  const queryWords = normalize(query).split(/\s+/u).filter(Boolean);
  return queryWords.every((queryWord) => {
    if (normalizedSource.includes(queryWord)) return true;
    const stem = searchStem(queryWord);
    return sourceWords.some((sourceWord) => sourceWord.startsWith(stem));
  });
}

const publishedLabelMonths: Record<string, number> = {
  января: 0,
  февраля: 1,
  марта: 2,
  апреля: 3,
  мая: 4,
  июня: 5,
  июля: 6,
  августа: 7,
  сентября: 8,
  октября: 9,
  ноября: 10,
  декабря: 11,
};

function formatPublishedLabel(
  publishedLabel: string,
  language: "ru" | "en"
) {
  const cleanLabel = publishedLabel
    .replace(/^Опубликовано\s*:\s*/iu, "")
    .replace(/^Published\s*:\s*/iu, "");
  if (language === "ru") return cleanLabel;
  const match = cleanLabel
    .toLocaleLowerCase("ru")
    .match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})$/u);
  if (!match) return cleanLabel;
  const month = publishedLabelMonths[match[2]];
  if (month === undefined) return cleanLabel;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[3]), month, Number(match[1]))));
}

function applyBrandImageFallback(
  image: HTMLImageElement,
  title: string,
  altPrefix: string
) {
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.classList.add("is-fallback");
  image.alt = `${altPrefix} “${title}”`;
  image.src = `${import.meta.env.BASE_URL}brand/probpera-logo.png`;
}

function recommendationTerms(article: ArticleCatalogEntry) {
  return new Set(
    normalize(`${article.title} ${article.description}`)
      .split(/\s+/u)
      .filter((word) => word.length >= 5 && !recommendationStopWords.has(word))
  );
}

function recommendedArticles(
  article: ArticleCatalogEntry,
  catalog: readonly ArticleCatalogEntry[]
) {
  const sourceTerms = recommendationTerms(article);
  const affinity = relatedSections[article.sectionId] || [];
  const ranked = catalog
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate, index) => {
      const sharedTerms = [...recommendationTerms(candidate)].filter((term) =>
        sourceTerms.has(term)
      ).length;
      const score =
        (candidate.sectionId === article.sectionId ? 100 : 0) +
        (affinity.includes(candidate.sectionId) ? 28 : 0) +
        Math.min(sharedTerms, 8) * 7 +
        (candidate.featured ? 5 : 0);
      return { candidate, index, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map(({ candidate }) => candidate);
  const used = new Set<string>();
  return ranked
    .filter((candidate) => {
      // The legacy archive occasionally contains the same publication under
      // different source ids. Readers should never see duplicate titles in a
      // recommendation route.
      const identity = normalize(candidate.title);
      if (used.has(identity)) return false;
      used.add(identity);
      return true;
    })
    .slice(0, 8);
}

function sectionFromAddress() {
  const routeSection = journalSectionFromPath();
  if (routeSection) return routeSection;
  const requested = new URLSearchParams(window.location.search).get("section");
  return requested &&
    articleCatalog.some((article) => article.sectionId === requested)
    ? requested
    : "all";
}

function seriesFromAddress() {
  const requested = new URLSearchParams(window.location.search).get("series");
  return requested || "all";
}

type ArticleLibrarySectionProps = {
  readerOnly?: boolean;
};

export default function ArticleLibrarySection({
  readerOnly = false,
}: ArticleLibrarySectionProps) {
  const { language, t, number } = useInterfaceLanguage();
  const localizedArticleCatalog = useMemo(
    () =>
      articleCatalog.flatMap((article) => {
        const localized = articleCatalogEntryForLanguage(article, language);
        return localized ? [localized] : [];
      }),
    [language]
  );
  const [sectionId, setSectionId] = useState(sectionFromAddress);
  const [seriesId, setSeriesId] = useState(seriesFromAddress);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    articleIdFromPath(articleCatalog)
  );
  const selectedBase = selectedId
    ? articleCatalog.find((article) => article.id === selectedId) || null
    : null;
  const selected = selectedBase
    ? articleCatalogEntryForLanguage(selectedBase, language)
    : null;

  useEffect(() => {
    const syncWithAddress = () => {
      const route = resolveArticleRoute(articleCatalog);
      const articleId = route?.articleId || null;
      if (route && !route.isCanonical) {
        window.history.replaceState(
          window.history.state,
          "",
          `${route.canonicalPath}${window.location.search}${window.location.hash}`
        );
      }
      setSelectedId(articleId);
      if (!articleId) {
        setSectionId(sectionFromAddress());
        setSeriesId(seriesFromAddress());
        setVisibleCount(12);
      }
    };
    syncWithAddress();
    window.addEventListener("popstate", syncWithAddress);
    window.addEventListener("hashchange", syncWithAddress);
    window.addEventListener("probpera:navigation", syncWithAddress);
    return () => {
      window.removeEventListener("popstate", syncWithAddress);
      window.removeEventListener("hashchange", syncWithAddress);
      window.removeEventListener("probpera:navigation", syncWithAddress);
    };
  }, []);

  const sections = useMemo(() => {
    const grouped = new Map<string, { id: string; label: string; count: number }>();
    localizedArticleCatalog.forEach((article) => {
      const current = grouped.get(article.sectionId);
      grouped.set(article.sectionId, {
        id: article.sectionId,
        label: article.sectionLabel,
        count: (current?.count || 0) + 1,
      });
    });
    return [...grouped.values()].sort(
      (first, second) => {
        const firstIndex = sectionOrder.indexOf(first.id);
        const secondIndex = sectionOrder.indexOf(second.id);
        return (
          (firstIndex < 0 ? sectionOrder.length : firstIndex) -
            (secondIndex < 0 ? sectionOrder.length : secondIndex) ||
          first.label.localeCompare(second.label, language)
        );
      }
    );
  }, [language, localizedArticleCatalog]);

  const filtered = useMemo(() => {
    const query = normalize(search);
    return localizedArticleCatalog.filter((article) => {
      if (sectionId !== "all" && article.sectionId !== sectionId) return false;
      if (seriesId !== "all" && articleSeriesId(article) !== seriesId) return false;
      if (!query) return true;
      return matchesSearch(
        `${article.title} ${article.description} ${article.sectionLabel}`,
        query
      );
    });
  }, [localizedArticleCatalog, search, sectionId, seriesId]);

  const series = useMemo(() => {
    if (sectionId === "all") return [];
    const records = localizedArticleCatalog.filter(
      (article) => article.sectionId === sectionId
    );
    return [
      ...new Map(
        records.map((article) => {
          const id = articleSeriesId(article);
          return [
            id,
            {
              id,
              label: articleSeriesLabel(id, article.sectionLabel, language),
              count: records.filter(
                (candidate) => articleSeriesId(candidate) === id
              ).length,
            },
          ];
        })
      ).values(),
    ];
  }, [language, localizedArticleCatalog, sectionId]);

  const selectedIndex = selected
    ? localizedArticleCatalog.findIndex((article) => article.id === selected.id)
    : -1;
  const related = selected
    ? recommendedArticles(selected, localizedArticleCatalog)
    : [];

  const changeSection = (value: string) => {
    setSectionId(value);
    setSeriesId("all");
    setVisibleCount(12);
    if (!selectedId) {
      navigateToJournal(value, true);
    }
  };

  const changeSeries = (value: string) => {
    setSeriesId(value);
    setVisibleCount(12);
    navigateToJournal(sectionId, true, value === "all" ? undefined : value);
  };

  const openArticle = (article: ArticleCatalogEntry) => {
    navigateToArticle(article);
    setSelectedId(article.id);
  };

  const closeArticle = () => {
    if (window.history.state?.probperaArticle) {
      window.history.back();
      return;
    }
    navigateToJournal(selectedBase?.sectionId || sectionId, true);
  };

  const previousBase =
    selectedIndex > 0
      ? articleCatalog.find(
          (article) => article.id === localizedArticleCatalog[selectedIndex - 1]?.id
        )
      : undefined;
  const nextBase =
    selectedIndex >= 0 && selectedIndex < localizedArticleCatalog.length - 1
      ? articleCatalog.find(
          (article) => article.id === localizedArticleCatalog[selectedIndex + 1]?.id
        )
      : undefined;

  if (readerOnly && !selectedBase) {
    return (
      <main className="article-route-not-found">
        <span aria-hidden="true">404</span>
        <h1>{t("Материалов по этому запросу пока нет")}</h1>
        <a href={journalPath()}>{t("Показать весь журнал")}</a>
      </main>
    );
  }

  if (readerOnly && selectedBase) {
    return (
      <Suspense
        fallback={
          <div className="article-reader-suspense" role="status">
            {t("Открываем режим чтения…")}
          </div>
        }
      >
        <ArticleReader
          article={selectedBase}
          related={related}
          previous={previousBase}
          next={nextBase}
          onClose={closeArticle}
          onOpen={openArticle}
        />
      </Suspense>
    );
  }

  return (
    <>
      <section className="article-library" id="journal">
        <header className="article-library-heading">
          <div>
            <span className="section-kicker">
              {t("Авторский архив")} · {number(localizedArticleCatalog.length)}{" "}
              {t(
                selectInterfacePlural(localizedArticleCatalog.length, language, [
                  "публикация",
                  "публикации",
                  "публикаций",
                ])
              )}
            </span>
            <h2>{t("Журнал, выстроенный для чтения")}</h2>
            <p>
              {t(
                "Мнения о книгах, литературные эссе, биографии, экранизации и языковые наблюдения собраны в единую редакционную библиотеку."
              )}
            </p>
          </div>
          <label>
            <span>{t("Поиск по публикациям")}</span>
            <input
              type="search"
              value={search}
              placeholder={t("Название, тема или рубрика…")}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(12);
              }}
            />
          </label>
        </header>

        <nav className="article-library-tabs" aria-label={t("Рубрики журнала")}>
          <button
            type="button"
            className={sectionId === "all" ? "is-active" : ""}
            aria-pressed={sectionId === "all"}
            onClick={() => changeSection("all")}
          >
            {t("Все материалы")} <span>{number(localizedArticleCatalog.length)}</span>
          </button>
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={sectionId === section.id ? "is-active" : ""}
              aria-pressed={sectionId === section.id}
              onClick={() => changeSection(section.id)}
            >
              {section.label} <span>{number(section.count)}</span>
            </button>
          ))}
        </nav>

        {series.length > 1 && (
          <nav
            className="article-library-series"
            aria-label={t("Тематические серии выбранного раздела")}
          >
            <span>{t("Серии")}</span>
            <button
              type="button"
              className={seriesId === "all" ? "is-active" : ""}
              aria-pressed={seriesId === "all"}
              onClick={() => changeSeries("all")}
            >
              {t("Все")}
            </button>
            {series.map((item) => (
              <button
                key={item.id}
                type="button"
                className={seriesId === item.id ? "is-active" : ""}
                aria-pressed={seriesId === item.id}
                onClick={() => changeSeries(item.id)}
              >
                {item.label} <small>{number(item.count)}</small>
              </button>
            ))}
          </nav>
        )}

        <div className="article-library-summary">
          <p>
            {t("Найдено")} <strong>{number(filtered.length)}</strong>{" "}
            {t(
              selectInterfacePlural(filtered.length, language, [
                "публикация",
                "публикации",
                "публикаций",
              ])
            )}
          </p>
          <span>{t("Текст и заголовки сохранены из оригинальных материалов")}</span>
        </div>

        {filtered.length > 0 ? (
          <div className="article-library-grid">
            {filtered.slice(0, visibleCount).map((article, index) => (
              <article
                className={index === 0 && !search ? "is-lead" : ""}
                key={article.id}
                {...cmsEntityMarker(
                  "article",
                  article.id,
                  article.title,
                  article.id.startsWith("cms-")
                    ? `/articles/${encodeURIComponent(article.id.slice(4))}`
                    : `/articles?search=${encodeURIComponent(article.title)}`
                )}
              >
                <a
                  href={articlePath(
                    article.id,
                    article.title,
                    article.sectionId,
                    article.slug
                  )}
                  onClick={(event) => {
                    if (!shouldUseClientNavigation(event)) return;
                    event.preventDefault();
                    openArticle(article);
                  }}
                >
                  <div className="library-card-image">
                    {article.imageUrl ? (
                      <>
                        <img
                          className="library-card-image-backdrop"
                          src={article.imageUrl}
                          style={mediaFocusStyle(article.imageFocusX, article.imageFocusY)}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                        <img
                          src={article.imageUrl}
                          style={mediaFocusStyle(article.imageFocusX, article.imageFocusY)}
                          alt={
                            article.imageAlt ||
                            `${t("Иллюстрация к материалу")} “${article.title}”`
                          }
                          loading="lazy"
                          decoding="async"
                          onError={(event) =>
                            applyBrandImageFallback(
                              event.currentTarget,
                              article.title,
                              t("Фирменная обложка материала")
                            )
                          }
                        />
                      </>
                    ) : (
                      <span aria-hidden="true">
                        <img
                          className="brand-fallback-logo"
                          src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                    )}
                    <small>{article.sectionLabel}</small>
                  </div>
                  <div className="library-card-copy">
                    <div>
                      <span>{formatPublishedLabel(article.publishedLabel, language)}</span>
                      <span>
                        {article.readingMinutes} {t("мин.")}
                      </span>
                    </div>
                    <h3>{article.title}</h3>
                    <p>{article.description}</p>
                    <strong>
                      {t("Читать в новом режиме")} <i>→</i>
                    </strong>
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="article-library-empty">
            <span aria-hidden="true">⌕</span>
            <h3>
              {language === "en" && localizedArticleCatalog.length === 0
                ? t("Пока нет опубликованных переводов на английский язык")
                : t("Материалов по этому запросу пока нет")}
            </h3>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSeriesId("all");
                changeSection("all");
              }}
            >
              {t("Показать весь журнал")}
            </button>
          </div>
        )}

        {visibleCount < filtered.length && (
          <button
            className="article-library-more"
            type="button"
            onClick={() => setVisibleCount((value) => value + 12)}
          >
            {t("Показать ещё 12 материалов")}
            <span>
              {Math.min(visibleCount, filtered.length)} / {filtered.length}
            </span>
          </button>
        )}
      </section>

      {selectedBase && (
        <Suspense
          fallback={
            <div className="article-reader-suspense" role="status">
              {t("Открываем режим чтения…")}
            </div>
          }
        >
          <ArticleReader
            article={selectedBase}
            related={related}
            previous={previousBase}
            next={nextBase}
            onClose={closeArticle}
            onOpen={openArticle}
          />
        </Suspense>
      )}
    </>
  );
}
