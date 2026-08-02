import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import {
  articleCatalog,
  type ArticleCatalogEntry,
} from "../data/articles/catalog";
import {
  articleIdFromPath,
  articlePath,
  journalPath,
  navigateToArticle,
  navigateToJournal,
} from "../utils/articleRoutes";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  articleSeriesId,
  articleSeriesLabel,
} from "../utils/articleSeries";

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

function publicationWord(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "публикаций";
  if (last === 1) return "публикация";
  if (last >= 2 && last <= 4) return "публикации";
  return "публикаций";
}

function recommendationTerms(article: ArticleCatalogEntry) {
  return new Set(
    normalize(`${article.title} ${article.description}`)
      .split(/\s+/u)
      .filter((word) => word.length >= 5 && !recommendationStopWords.has(word))
  );
}

function recommendedArticles(article: ArticleCatalogEntry) {
  const sourceTerms = recommendationTerms(article);
  const affinity = relatedSections[article.sectionId] || [];
  const ranked = articleCatalog
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
      const identity = `${candidate.id}:${normalize(candidate.title)}`;
      if (used.has(identity)) return false;
      used.add(identity);
      return true;
    })
    .slice(0, 8);
}

function sectionFromAddress() {
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

export default function ArticleLibrarySection() {
  const { language, t, number } = useInterfaceLanguage();
  const [sectionId, setSectionId] = useState(sectionFromAddress);
  const [seriesId, setSeriesId] = useState(seriesFromAddress);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selected, setSelected] = useState<ArticleCatalogEntry | null>(() => {
    const articleId = articleIdFromPath(articleCatalog);
    return articleCatalog.find((article) => article.id === articleId) || null;
  });

  useEffect(() => {
    const syncWithAddress = () => {
      const articleId = articleIdFromPath(articleCatalog);
      const addressedArticle =
        articleCatalog.find((article) => article.id === articleId) || null;
      setSelected(addressedArticle);
      if (!addressedArticle) {
        setSectionId(sectionFromAddress());
        setSeriesId(seriesFromAddress());
        setVisibleCount(12);
      }
    };
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
    articleCatalog.forEach((article) => {
      const current = grouped.get(article.sectionId);
      grouped.set(article.sectionId, {
        id: article.sectionId,
        label: article.sectionLabel,
        count: (current?.count || 0) + 1,
      });
    });
    return [...grouped.values()].sort(
      (first, second) =>
        sectionOrder.indexOf(first.id) - sectionOrder.indexOf(second.id)
    );
  }, []);

  const filtered = useMemo(() => {
    const query = normalize(search);
    return articleCatalog.filter((article) => {
      if (sectionId !== "all" && article.sectionId !== sectionId) return false;
      if (seriesId !== "all" && articleSeriesId(article) !== seriesId) return false;
      if (!query) return true;
      return matchesSearch(
        `${article.title} ${article.description} ${article.sectionLabel}`,
        query
      );
    });
  }, [search, sectionId, seriesId]);

  const series = useMemo(() => {
    if (sectionId === "all") return [];
    const records = articleCatalog.filter(
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
              label: articleSeriesLabel(id, article.sectionLabel),
              count: records.filter(
                (candidate) => articleSeriesId(candidate) === id
              ).length,
            },
          ];
        })
      ).values(),
    ];
  }, [sectionId]);

  const selectedIndex = selected
    ? articleCatalog.findIndex((article) => article.id === selected.id)
    : -1;
  const related = selected ? recommendedArticles(selected) : [];

  const changeSection = (value: string) => {
    setSectionId(value);
    setSeriesId("all");
    setVisibleCount(12);
    if (!selected) {
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
    setSelected(article);
  };

  const closeArticle = () => {
    if (window.history.state?.probperaArticle) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, "", journalPath(sectionId));
    window.dispatchEvent(new Event("probpera:navigation"));
    setSelected(null);
  };

  return (
    <>
      <section className="article-library" id="journal">
        <header className="article-library-heading">
          <div>
            <span className="section-kicker">
              {language === "en"
                ? `Author archive · ${number(articleCatalog.length)} publications`
                : `Авторский архив · ${number(articleCatalog.length)} ${publicationWord(
                    articleCatalog.length
                  )}`}
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
            {t("Все материалы")} <span>{number(articleCatalog.length)}</span>
          </button>
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={sectionId === section.id ? "is-active" : ""}
              aria-pressed={sectionId === section.id}
              onClick={() => changeSection(section.id)}
            >
              {t(section.label)} <span>{number(section.count)}</span>
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
                {t(item.label)} <small>{number(item.count)}</small>
              </button>
            ))}
          </nav>
        )}

        <div className="article-library-summary">
          <p>
            {language === "en" ? (
              <>
                Found <strong>{number(filtered.length)}</strong>{" "}
                {filtered.length === 1 ? "publication" : "publications"}
              </>
            ) : (
              <>
                Найдено <strong>{number(filtered.length)}</strong>{" "}
                {publicationWord(filtered.length)}
              </>
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
              >
                <a
                  href={articlePath(
                    article.id,
                    article.title,
                    article.sectionId,
                    article.slug
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    openArticle(article);
                  }}
                >
                  <div className="library-card-image">
                    {article.imageUrl ? (
                      <img
                        src={article.imageUrl}
                        alt={article.imageAlt || ""}
                        loading="lazy"
                      />
                    ) : (
                      <span aria-hidden="true">
                        <img
                          className="brand-fallback-logo"
                          src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
                          alt=""
                        />
                      </span>
                    )}
                    <small>{article.sectionLabel}</small>
                  </div>
                  <div className="library-card-copy">
                    <div>
                      <span>{article.publishedLabel.replace("Опубликовано :", "")}</span>
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
            <h3>{t("Материалов по этому запросу пока нет")}</h3>
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

      {selected && (
        <Suspense
          fallback={
            <div className="article-reader-suspense" role="status">
              {t("Открываем режим чтения…")}
            </div>
          }
        >
          <ArticleReader
            article={selected}
            related={related}
            previous={selectedIndex > 0 ? articleCatalog[selectedIndex - 1] : undefined}
            next={
              selectedIndex >= 0 && selectedIndex < articleCatalog.length - 1
                ? articleCatalog[selectedIndex + 1]
                : undefined
            }
            onClose={closeArticle}
            onOpen={openArticle}
          />
        </Suspense>
      )}
    </>
  );
}
