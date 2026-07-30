import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import DisplayModeControl from "./DisplayModeControl";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import ShareLinks from "../editorial/ShareLinks";
import { useDisplayMode } from "../hooks/useDisplayMode";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { articlePath } from "../utils/articleRoutes";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";
import BrandHeartIcon from "./BrandHeartIcon";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandArrowIcon from "./BrandArrowIcon";

type ArticleHeading = {
  id: string;
  level: number;
  text: string;
};

type ArticleDocument = ArticleCatalogEntry & {
  headings: ArticleHeading[];
  contentHtml: string;
  plainText: string;
  sources?: Array<string | { text?: string }>;
  bibliography?: Array<string | { text?: string }>;
};

type Props = {
  article: ArticleCatalogEntry;
  related: ArticleCatalogEntry[];
  previous?: ArticleCatalogEntry;
  next?: ArticleCatalogEntry;
  onClose: () => void;
  onOpen: (article: ArticleCatalogEntry) => void;
};

function publicArticleUrl(article: ArticleCatalogEntry) {
  const documentPath =
    article.documentPath || `articles/${encodeURIComponent(article.id)}.json`;
  return `${import.meta.env.BASE_URL}${documentPath.replace(/^\/+/, "")}`;
}

function sourceLines(
  value?: Array<string | { text?: string }>
) {
  return (value || [])
    .map((item) => (typeof item === "string" ? item : item.text || ""))
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const { mode } = useDisplayMode();
  const { language, t, number } = useInterfaceLanguage();
  const { items: savedReadings, toggle: toggleSavedReading } =
    useReadingLibrary();
  const isSaved = savedReadings.some(
    (item) => item.kind === "article" && item.id === article.id
  );

  useEffect(() => {
    let active = true;
    setArticleDocument(null);
    setError(false);

    fetch(publicArticleUrl(article))
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
    setActiveHeadingId("");
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
  const sourceItems = useMemo(
    () => [
      ...sourceLines(articleDocument?.sources),
      ...sourceLines(articleDocument?.bibliography),
    ],
    [articleDocument]
  );
  const activeHeading = headingItems.find(
    (heading) => heading.id === activeHeadingId
  );

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !safeContentHtml || !headingItems.length) return;

    let observer: IntersectionObserver | undefined;
    const frame = window.requestAnimationFrame(() => {
      const targets = headingItems
        .map((heading) =>
          root.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`)
        )
        .filter((target): target is HTMLElement => Boolean(target));

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort(
              (first, second) =>
                first.boundingClientRect.top - second.boundingClientRect.top
            );
          const current = visible[0]?.target as HTMLElement | undefined;
          if (current?.id) setActiveHeadingId(current.id);
        },
        {
          root,
          rootMargin: "-14% 0px -70% 0px",
          threshold: [0, 1],
        }
      );

      targets.forEach((target) => observer?.observe(target));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [headingItems, safeContentHtml]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const available = element.scrollHeight - element.clientHeight;
    setProgress(available > 0 ? Math.min(100, (element.scrollTop / available) * 100) : 0);
  };

  const jumpToHeading = (headingId: string) => {
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`);
    setActiveHeadingId(headingId);
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
      <div
        className="article-reader-progress"
        role="progressbar"
        aria-label={t("Прогресс чтения")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        style={{ width: `${progress}%` }}
      />

      <header className="article-reader-bar">
          <button
            ref={closeButtonRef}
            className="reader-back"
            type="button"
            onClick={onClose}
          >
          <span aria-hidden="true">
            <BrandArrowIcon />
          </span>{" "}
          {t("К журналу")}
        </button>
        <div>
          <span>{article.sectionLabel}</span>
          <strong>{activeHeading?.text || t("Проба Пера")}</strong>
        </div>
        <nav aria-label={t("Настройки чтения")}>
          <button
            type="button"
            aria-label={t("Уменьшить шрифт")}
            disabled={fontScale <= 0.9}
            onClick={() => setFontScale((value) => Math.max(0.9, value - 0.1))}
          >
            А−
          </button>
          <button
            type="button"
            aria-label={t("Увеличить шрифт")}
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
            aria-label={
              isSaved
                ? t("Удалить статью из библиотеки")
                : t("Сохранить статью")
            }
            title={
              isSaved ? t("Сохранено в библиотеке") : t("Сохранить на потом")
            }
            onClick={() =>
              toggleSavedReading({
                id: article.id,
                kind: "article",
                title: article.title,
                sectionId: article.sectionId,
                sectionLabel: article.sectionLabel,
                href: articlePath(
                  article.id,
                  article.title,
                  article.sectionId,
                  article.slug
                ),
              })
            }
          >
            <BrandHeartIcon filled={isSaved} />
          </button>
          <button
            className="reader-close"
            type="button"
            onClick={onClose}
            aria-label={t("Закрыть")}
          >
            <BrandCloseIcon />
          </button>
        </nav>
      </header>

      <div className="article-reader-scroll" ref={scrollRef} onScroll={handleScroll}>
        <main className="article-reader-layout">
          <aside className="article-reader-toc">
            <span>{t("В этом материале")}</span>
            {headingItems.length > 0 ? (
              <ol>
                {headingItems.map((heading) => (
                  <li key={heading.id} className={`level-${heading.level}`}>
                    <button
                      type="button"
                      className={
                        activeHeadingId === heading.id ? "is-active" : undefined
                      }
                      aria-current={
                        activeHeadingId === heading.id ? "location" : undefined
                      }
                      onClick={() => jumpToHeading(heading.id)}
                    >
                      {heading.text}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{t("Материал читается как единое эссе.")}</p>
            )}
            <small>
              {article.readingMinutes} {t("мин. чтения")} ·{" "}
              {number(article.wordCount)} {t("слов")}
            </small>
          </aside>

          <article
            className="article-reader-paper"
            style={{ "--reader-scale": fontScale } as CSSProperties}
          >
            {mode === "book" && (
              <div className="book-mode-plaque" aria-hidden="true">
                <span>Проба Пера</span>
                <i>{t("Режим печатной книги")}</i>
                <span>MMXXVI</span>
              </div>
            )}
            <header className="article-reader-lead">
              <div>
                <span>{article.sectionLabel}</span>
                <small>{article.publishedLabel}</small>
              </div>
              <h1 id="article-reader-title">{article.title}</h1>
              {language === "en" && (
                <span className="article-original-language">
                  {t("Оригинал на русском языке")}
                </span>
              )}
              {article.description && <p>{article.description}</p>}
              <div className="article-reader-metrics">
                <span>
                  <strong>{number(article.readingMinutes)}</strong>
                  {t("минут чтения")}
                </span>
                <span>
                  <strong>{number(article.wordCount)}</strong>
                  {t("слов")}
                </span>
                <span>
                  <strong>{number(headingItems.length)}</strong>
                  {t("смысловых разделов")}
                </span>
              </div>
              <div className="article-byline">
                <span>{t("Авторская публикация журнала «Проба Пера»")}</span>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {t("Оригинал публикации ↗")}
                </a>
              </div>
            </header>

            {article.imageUrl && (
              <figure className="article-reader-cover">
                <img
                  src={article.imageUrl}
                  alt={
                    article.imageAlt ||
                    `Иллюстрация к статье «${article.title}»`
                  }
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </figure>
            )}

            {error && (
              <div className="article-reader-error">
                <strong>{t("Материал временно не открылся.")}</strong>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {t("Прочитать оригинал на probpera.ru")}
                </a>
              </div>
            )}

            {!articleDocument && !error && (
              <div className="article-reader-loading" role="status">
                <span aria-hidden="true">✦</span>
                <p>{t("Готовим материал к чтению…")}</p>
              </div>
            )}

            {articleDocument && (
              <div
                className="article-reader-content"
                dangerouslySetInnerHTML={{ __html: safeContentHtml }}
              />
            )}

            {sourceItems.length > 0 && (
              <section className="article-reader-sources">
                <span>{t("Источники и библиография")}</span>
                <ol>
                  {sourceItems.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              </section>
            )}

            {articleDocument && (
              <footer className="article-reader-finish">
                <span>{t("Конец материала")}</span>
                <h2>{t("Спасибо за внимательное прочтение статьи")}</h2>
                <p>
                  {t(
                    "Авторский текст сохранён в исходном виде. Замечания по фактам и языку проходят отдельную редакционную проверку."
                  )}
                </p>
                <ShareLinks
                  url={`${window.location.origin}${articlePath(
                    article.id,
                    article.title,
                    article.sectionId,
                    article.slug
                  )}`}
                  title={article.title}
                />
                <ArticleEngagement articleSlug={article.id} />
              </footer>
            )}
          </article>

          <aside className="article-reader-related">
            <span>{t("Продолжить чтение")}</span>
            {related.slice(0, 3).map((item) => (
              <button type="button" key={item.id} onClick={() => openAnother(item)}>
                {item.imageUrl && (
                  <span className="article-related-image" aria-hidden="true">
                    <img src={item.imageUrl} alt="" loading="lazy" />
                  </span>
                )}
                <span className="article-related-copy">
                  <small>{item.sectionLabel}</small>
                  <strong>{item.title}</strong>
                  <em>
                    {item.readingMinutes} {t("мин.")}
                  </em>
                </span>
              </button>
            ))}
          </aside>
        </main>

        <nav
          className="article-reader-sequence"
          aria-label={t("Соседние публикации")}
        >
          {previous ? (
            <button type="button" onClick={() => openAnother(previous)}>
              <small>{t("Предыдущий материал")}</small>
              <strong>← {previous.title}</strong>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" onClick={() => openAnother(next)}>
              <small>{t("Следующий материал")}</small>
              <strong>{next.title} →</strong>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
