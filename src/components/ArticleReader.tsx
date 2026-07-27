import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import type { ArticleCatalogEntry } from "../data/articles/catalog.generated";
import ShareLinks from "../editorial/ShareLinks";

type ArticleHeading = {
  id: string;
  level: number;
  text: string;
};

type ArticleDocument = ArticleCatalogEntry & {
  headings: ArticleHeading[];
  contentHtml: string;
  plainText: string;
};

type Props = {
  article: ArticleCatalogEntry;
  related: ArticleCatalogEntry[];
  previous?: ArticleCatalogEntry;
  next?: ArticleCatalogEntry;
  onClose: () => void;
  onOpen: (article: ArticleCatalogEntry) => void;
};

type ReadingTheme = "night" | "paper";

function publicArticleUrl(articleId: string) {
  return `${import.meta.env.BASE_URL}articles/${articleId}.json`;
}

export default function ArticleReader({
  article,
  related,
  previous,
  next,
  onClose,
  onOpen,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [articleDocument, setArticleDocument] = useState<ArticleDocument | null>(null);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [theme, setTheme] = useState<ReadingTheme>("night");

  useEffect(() => {
    let active = true;
    setArticleDocument(null);
    setError(false);

    fetch(publicArticleUrl(article.id))
      .then((response) => {
        if (!response.ok) throw new Error(`Article ${article.id} not found`);
        return response.json() as Promise<ArticleDocument>;
      })
      .then((payload) => {
        if (active) setArticleDocument(payload);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [article.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setProgress(0);
  }, [article.id]);

  const headingItems = useMemo(
    () => (articleDocument?.headings || []).filter((heading) => heading.text.trim()),
    [articleDocument]
  );

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const available = element.scrollHeight - element.clientHeight;
    setProgress(available > 0 ? Math.min(100, (element.scrollTop / available) * 100) : 0);
  };

  const jumpToHeading = (headingId: string) => {
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openAnother = (target: ArticleCatalogEntry) => {
    onOpen(target);
  };

  return (
    <div
      className={`article-reader is-${theme}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Чтение статьи «${article.title}»`}
    >
      <div className="article-reader-progress" style={{ width: `${progress}%` }} />

      <header className="article-reader-bar">
        <button className="reader-back" type="button" onClick={onClose}>
          <span aria-hidden="true">←</span> К журналу
        </button>
        <div>
          <span>{article.sectionLabel}</span>
          <strong>Проба Пера</strong>
        </div>
        <nav aria-label="Настройки чтения">
          <button
            type="button"
            aria-label="Уменьшить шрифт"
            disabled={fontScale <= 0.9}
            onClick={() => setFontScale((value) => Math.max(0.9, value - 0.1))}
          >
            А−
          </button>
          <button
            type="button"
            aria-label="Увеличить шрифт"
            disabled={fontScale >= 1.3}
            onClick={() => setFontScale((value) => Math.min(1.3, value + 0.1))}
          >
            А+
          </button>
          <button
            type="button"
            aria-label={theme === "night" ? "Светлая тема" : "Тёмная тема"}
            onClick={() => setTheme((value) => (value === "night" ? "paper" : "night"))}
          >
            {theme === "night" ? "☼" : "☾"}
          </button>
          <button className="reader-close" type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </nav>
      </header>

      <div className="article-reader-scroll" ref={scrollRef} onScroll={handleScroll}>
        <main className="article-reader-layout">
          <aside className="article-reader-toc">
            <span>В этом материале</span>
            {headingItems.length > 0 ? (
              <ol>
                {headingItems.map((heading) => (
                  <li key={heading.id} className={`level-${heading.level}`}>
                    <button type="button" onClick={() => jumpToHeading(heading.id)}>
                      {heading.text}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Материал читается как единое эссе.</p>
            )}
            <small>
              {article.readingMinutes} мин. чтения · {article.wordCount.toLocaleString("ru-RU")} слов
            </small>
          </aside>

          <article
            className="article-reader-paper"
            style={{ "--reader-scale": fontScale } as CSSProperties}
          >
            <header className="article-reader-lead">
              <div>
                <span>{article.sectionLabel}</span>
                <small>{article.publishedLabel}</small>
              </div>
              <h1>{article.title}</h1>
              {article.description && <p>{article.description}</p>}
              <div className="article-byline">
                <span>Авторская публикация журнала «Проба Пера»</span>
                <a href={article.url} target="_blank" rel="noreferrer">
                  Оригинал публикации ↗
                </a>
              </div>
            </header>

            {article.imageUrl && (
              <figure className="article-reader-cover">
                <img src={article.imageUrl} alt="" />
              </figure>
            )}

            {error && (
              <div className="article-reader-error">
                <strong>Материал временно не открылся.</strong>
                <a href={article.url} target="_blank" rel="noreferrer">
                  Прочитать оригинал на probpera.ru
                </a>
              </div>
            )}

            {!articleDocument && !error && (
              <div className="article-reader-loading" role="status">
                <span aria-hidden="true">✦</span>
                <p>Готовим материал к чтению…</p>
              </div>
            )}

            {articleDocument && (
              <div
                className="article-reader-content"
                dangerouslySetInnerHTML={{ __html: articleDocument.contentHtml }}
              />
            )}

            {articleDocument && (
              <footer className="article-reader-finish">
                <span>Конец материала</span>
                <h2>Спасибо за внимательное чтение</h2>
                <p>
                  Авторский текст сохранён в исходном виде. Замечания по фактам и языку
                  проходят отдельную редакционную проверку.
                </p>
                <ShareLinks url={article.url} title={article.title} />
                <ArticleEngagement articleSlug={article.id} />
              </footer>
            )}
          </article>

          <aside className="article-reader-related">
            <span>Продолжить чтение</span>
            {related.slice(0, 3).map((item) => (
              <button type="button" key={item.id} onClick={() => openAnother(item)}>
                <small>{item.sectionLabel}</small>
                <strong>{item.title}</strong>
                <em>{item.readingMinutes} мин.</em>
              </button>
            ))}
          </aside>
        </main>

        <nav className="article-reader-sequence" aria-label="Соседние публикации">
          {previous ? (
            <button type="button" onClick={() => openAnother(previous)}>
              <small>Предыдущий материал</small>
              <strong>← {previous.title}</strong>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" onClick={() => openAnother(next)}>
              <small>Следующий материал</small>
              <strong>{next.title} →</strong>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
