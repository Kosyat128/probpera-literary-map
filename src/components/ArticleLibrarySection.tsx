import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import {
  articleCatalog,
  type ArticleCatalogEntry,
} from "../data/articles/catalog";
import {
  articleIdFromPath,
  articlePath,
  journalPath,
} from "../utils/articleRoutes";

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

export default function ArticleLibrarySection() {
  const initialSection = new URLSearchParams(window.location.search).get("section");
  const [sectionId, setSectionId] = useState(initialSection || "all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selected, setSelected] = useState<ArticleCatalogEntry | null>(() => {
    const articleId = articleIdFromPath(articleCatalog);
    return articleCatalog.find((article) => article.id === articleId) || null;
  });

  useEffect(() => {
    const syncWithAddress = () => {
      const articleId = articleIdFromPath(articleCatalog);
      setSelected(
        articleCatalog.find((article) => article.id === articleId) || null
      );
    };
    window.addEventListener("popstate", syncWithAddress);
    return () => window.removeEventListener("popstate", syncWithAddress);
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
      if (!query) return true;
      return matchesSearch(
        `${article.title} ${article.description} ${article.sectionLabel}`,
        query
      );
    });
  }, [search, sectionId]);

  const selectedIndex = selected
    ? articleCatalog.findIndex((article) => article.id === selected.id)
    : -1;
  const related = selected
    ? articleCatalog.filter(
        (article) =>
          article.sectionId === selected.sectionId && article.id !== selected.id
      )
    : [];

  const changeSection = (value: string) => {
    setSectionId(value);
    setVisibleCount(12);
    if (!selected) {
      window.history.replaceState({}, "", journalPath(value));
    }
  };

  const openArticle = (article: ArticleCatalogEntry) => {
    window.history.pushState(
      { probperaArticle: article.id },
      "",
      articlePath(article.id, article.title, article.sectionId, article.slug)
    );
    setSelected(article);
  };

  const closeArticle = () => {
    if (window.history.state?.probperaArticle) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, "", journalPath(sectionId));
    setSelected(null);
  };

  return (
    <>
      <section className="article-library" id="journal">
        <header className="article-library-heading">
          <div>
            <span className="section-kicker">Авторский архив · 157 материалов</span>
            <h2>Журнал, выстроенный для чтения</h2>
            <p>
              Мнения о книгах, литературные эссе, биографии, экранизации и
              языковые наблюдения собраны в единую редакционную библиотеку.
            </p>
          </div>
          <label>
            <span>Поиск по публикациям</span>
            <input
              type="search"
              value={search}
              placeholder="Название, тема или рубрика…"
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(12);
              }}
            />
          </label>
        </header>

        <nav className="article-library-tabs" aria-label="Рубрики журнала">
          <button
            type="button"
            className={sectionId === "all" ? "is-active" : ""}
            onClick={() => changeSection("all")}
          >
            Все материалы <span>{articleCatalog.length}</span>
          </button>
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={sectionId === section.id ? "is-active" : ""}
              onClick={() => changeSection(section.id)}
            >
              {section.label} <span>{section.count}</span>
            </button>
          ))}
        </nav>

        <div className="article-library-summary">
          <p>
            Найдено <strong>{filtered.length}</strong>{" "}
            {publicationWord(filtered.length)}
          </p>
          <span>Текст и заголовки сохранены из оригинальных материалов</span>
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
                      <span>{article.readingMinutes} мин.</span>
                    </div>
                    <h3>{article.title}</h3>
                    <p>{article.description}</p>
                    <strong>Читать в новом режиме <i>→</i></strong>
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="article-library-empty">
            <span aria-hidden="true">⌕</span>
            <h3>Материалов по этому запросу пока нет</h3>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                changeSection("all");
              }}
            >
              Показать весь журнал
            </button>
          </div>
        )}

        {visibleCount < filtered.length && (
          <button
            className="article-library-more"
            type="button"
            onClick={() => setVisibleCount((value) => value + 12)}
          >
            Показать ещё 12 материалов
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
              Открываем режим чтения…
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
