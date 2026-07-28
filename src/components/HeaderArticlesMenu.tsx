import { useCallback, useMemo, useState } from "react";

import type { ArticleCatalogEntry } from "../data/articles/catalog.generated";
import { articlePath, journalPath } from "../utils/articleRoutes";

const russianMonths: Record<string, number> = {
  ЯНВАРЯ: 0,
  ФЕВРАЛЯ: 1,
  МАРТА: 2,
  АПРЕЛЯ: 3,
  МАЯ: 4,
  ИЮНЯ: 5,
  ИЮЛЯ: 6,
  АВГУСТА: 7,
  СЕНТЯБРЯ: 8,
  ОКТЯБРЯ: 9,
  НОЯБРЯ: 10,
  ДЕКАБРЯ: 11,
};

function publishedTime(label: string) {
  const match = label.toUpperCase().match(/(\d{1,2})\s+([А-ЯЁ]+)\s+(\d{4})/u);
  if (!match) return 0;
  const month = russianMonths[match[2]];
  if (month === undefined) return 0;
  return new Date(Number(match[3]), month, Number(match[1])).getTime();
}

export default function HeaderArticlesMenu() {
  const [articles, setArticles] = useState<ArticleCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadArticles = useCallback(() => {
    if (articles.length || loading) return;
    setLoading(true);
    import("../data/articles/catalog.generated")
      .then(({ articleCatalog }) => setArticles(articleCatalog))
      .finally(() => setLoading(false));
  }, [articles.length, loading]);

  const featured = useMemo(() => {
    const sorted = [...articles].sort(
      (first, second) =>
        publishedTime(second.publishedLabel) - publishedTime(first.publishedLabel)
    );
    const lead = sorted[0];
    const usedSections = new Set(lead ? [lead.sectionId] : []);
    const varied = sorted.filter((article) => {
      if (article.id === lead?.id || usedSections.has(article.sectionId)) return false;
      usedSections.add(article.sectionId);
      return true;
    });
    const remaining = sorted.filter(
      (article) =>
        article.id !== lead?.id &&
        !varied.some((candidate) => candidate.id === article.id)
    );
    return { lead, more: [...varied, ...remaining].slice(0, 6) };
  }, [articles]);

  const closeMenu = (target: HTMLElement) => {
    target.closest("details")?.removeAttribute("open");
  };

  return (
    <details
      className="articles-menu"
      onPointerEnter={loadArticles}
      onFocusCapture={loadArticles}
      onToggle={(event) => {
        if (event.currentTarget.open) loadArticles();
      }}
    >
      <summary>
        Статьи <span aria-hidden="true">⌄</span>
      </summary>
      <div className="articles-mega-menu">
        <header>
          <div>
            <span>Редакционная витрина</span>
            <strong>Свежие публикации</strong>
          </div>
          <p>
            Авторские статьи, рецензии, литературные истории и материалы о языке.
          </p>
        </header>

        {featured.lead ? (
          <div className="articles-mega-content">
            <a
              className="articles-mega-lead"
              href={articlePath(
                featured.lead.id,
                featured.lead.title,
                featured.lead.sectionId
              )}
              onClick={(event) => closeMenu(event.currentTarget)}
            >
              <span
                style={
                  featured.lead.imageUrl
                    ? { backgroundImage: `url(${featured.lead.imageUrl})` }
                    : undefined
                }
              />
              <div>
                <small>{featured.lead.sectionLabel}</small>
                <strong>{featured.lead.title}</strong>
                <p>{featured.lead.description}</p>
                <em>{featured.lead.readingMinutes} мин. чтения</em>
              </div>
            </a>
            <section aria-label="Другие свежие статьи">
              {featured.more.map((article) => (
                <a
                  href={articlePath(article.id, article.title, article.sectionId)}
                  key={article.id}
                  onClick={(event) => closeMenu(event.currentTarget)}
                >
                  <small>{article.sectionLabel}</small>
                  <strong>{article.title}</strong>
                  <span>{article.readingMinutes} мин.</span>
                </a>
              ))}
            </section>
          </div>
        ) : (
          <div className="articles-mega-loading">
            {loading ? "Подключаем редакционный архив…" : "Наведите, чтобы открыть публикации"}
          </div>
        )}

        <footer>
          <span>{articles.length ? `${articles.length} материалов в архиве` : "Полный архив журнала"}</span>
          <a href={journalPath()} onClick={(event) => closeMenu(event.currentTarget)}>
            Все публикации <b aria-hidden="true">→</b>
          </a>
        </footer>
      </div>
    </details>
  );
}
