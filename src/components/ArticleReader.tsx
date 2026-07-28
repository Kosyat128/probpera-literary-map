import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import DisplayModeControl from "./DisplayModeControl";
import type { ArticleCatalogEntry } from "../data/articles/catalog.generated";
import ShareLinks from "../editorial/ShareLinks";
import { useDisplayMode } from "../hooks/useDisplayMode";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { articlePath } from "../utils/articleRoutes";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [articleDocument, setArticleDocument] = useState<ArticleDocument | null>(null);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const { mode } = useDisplayMode();
  const { items: savedReadings, toggle: toggleSavedReading } =
    useReadingLibrary();
  const isSaved = savedReadings.some((item) => item.id === article.id);

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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
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
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
      previouslyFocused?.focus();
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
  const safeContentHtml = useMemo(
    () =>
      articleDocument
        ? sanitizeArticleHtml(articleDocument.contentHtml)
        : "",
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
      ref={dialogRef}
      className={`article-reader is-${mode}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-reader-title"
    >
      <div className="article-reader-progress" style={{ width: `${progress}%` }} />

      <header className="article-reader-bar">
          <button
            ref={closeButtonRef}
            className="reader-back"
            type="button"
            onClick={onClose}
          >
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
          <DisplayModeControl compact />
          <button
            type="button"
            className={isSaved ? "reader-save is-active" : "reader-save"}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Удалить статью из библиотеки" : "Сохранить статью"}
            title={isSaved ? "Сохранено в библиотеке" : "Сохранить на потом"}
            onClick={() =>
              toggleSavedReading({
                id: article.id,
                title: article.title,
                sectionId: article.sectionId,
                sectionLabel: article.sectionLabel,
              })
            }
          >
            {isSaved ? "◆" : "◇"}
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
            {mode === "book" && (
              <div className="book-mode-plaque" aria-hidden="true">
                <span>Проба Пера</span>
                <i>Режим печатной книги</i>
                <span>MMXXVI</span>
              </div>
            )}
            <header className="article-reader-lead">
              <div>
                <span>{article.sectionLabel}</span>
                <small>{article.publishedLabel}</small>
              </div>
              <h1 id="article-reader-title">{article.title}</h1>
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
                <img
                  src={article.imageUrl}
                  alt={`Иллюстрация к статье «${article.title}»`}
                />
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
                dangerouslySetInnerHTML={{ __html: safeContentHtml }}
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
                <ShareLinks
                  url={`${window.location.origin}${articlePath(article.id, article.title, article.sectionId)}`}
                  title={article.title}
                />
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
