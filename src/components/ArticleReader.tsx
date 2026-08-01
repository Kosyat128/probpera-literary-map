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

type ArticleSource =
  | string
  | { text?: string; title?: string; label?: string; url?: string };

type ArticleMediaItem = {
  src: string;
  alt: string;
  caption: string;
};

type ArticleDocument = ArticleCatalogEntry & {
  headings: ArticleHeading[];
  contentHtml: string;
  plainText: string;
  sources?: ArticleSource[];
  bibliography?: ArticleSource[];
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

function sourceLines(value?: ArticleSource[]) {
  return (value || [])
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        const urlMatch = text.match(/https?:\/\/[^\s)\]]+/i);
        return { text, url: urlMatch?.[0] || "" };
      }
      return {
        text: (item.text || item.title || item.label || item.url || "").trim(),
        url: (item.url || "").trim(),
      };
    })
    .filter((item) => item.text);
}

function contentMediaItems(html: string, baseUrl: string): ArticleMediaItem[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  return [...documentNode.querySelectorAll<HTMLImageElement>("img")]
    .map((image) => {
      const rawSource =
        image.getAttribute("data-original") ||
        image.getAttribute("data-src") ||
        image.getAttribute("src") ||
        image.currentSrc ||
        image.src ||
        "";
      if (!rawSource) return null;
      let src = rawSource;
      try {
        src = new URL(rawSource, baseUrl).href;
      } catch {
        // The browser will still attempt to resolve the original source.
      }
      const figure = image.closest("figure");
      const caption = figure?.querySelector("figcaption")?.textContent?.trim() || "";
      return {
        src,
        alt: image.alt.trim(),
        caption,
      };
    })
    .filter((item): item is ArticleMediaItem => Boolean(item));
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
  const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [articleDocument, setArticleDocument] = useState<ArticleDocument | null>(null);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
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
      if (event.key === "Escape" && activeMediaIndex === null) onClose();
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
  }, [activeMediaIndex, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setProgress(0);
    setActiveHeadingId("");
    setActiveMediaIndex(null);
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
  const mediaItems = useMemo(() => {
    const inlineItems = contentMediaItems(safeContentHtml, article.url);
    if (!article.imageUrl) return inlineItems;
    return [
      {
        src: article.imageUrl,
        alt: article.imageAlt || `Иллюстрация к статье «${article.title}»`,
        caption: "",
      },
      ...inlineItems,
    ];
  }, [article.imageAlt, article.imageUrl, article.title, article.url, safeContentHtml]);
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
    const root = contentRef.current;
    if (!root || !safeContentHtml) return;
    const heroOffset = article.imageUrl ? 1 : 0;
    root.querySelectorAll<HTMLImageElement>("img").forEach((image, index) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute(
        "aria-label",
        image.alt
          ? `Открыть изображение: ${image.alt}`
          : `Открыть иллюстрацию ${index + 1}`
      );
      image.dataset.articleMediaIndex = String(index + heroOffset);
    });
  }, [article.imageUrl, safeContentHtml]);

  useEffect(() => {
    if (activeMediaIndex === null) return;
    lightboxCloseButtonRef.current?.focus();
    const handleLightboxKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveMediaIndex(null);
      } else if (event.key === "ArrowRight" && mediaItems.length > 1) {
        event.preventDefault();
        setActiveMediaIndex((value) =>
          value === null ? 0 : (value + 1) % mediaItems.length
        );
      } else if (event.key === "ArrowLeft" && mediaItems.length > 1) {
        event.preventDefault();
        setActiveMediaIndex((value) =>
          value === null
            ? 0
            : (value - 1 + mediaItems.length) % mediaItems.length
        );
      }
    };
    window.addEventListener("keydown", handleLightboxKeys);
    return () => window.removeEventListener("keydown", handleLightboxKeys);
  }, [activeMediaIndex, mediaItems.length]);

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

  const openContentImage = (target: EventTarget | null) => {
    const image = target instanceof Element ? target.closest<HTMLImageElement>("img") : null;
    if (!image || !contentRef.current?.contains(image)) return;
    const index = Number(image.dataset.articleMediaIndex);
    if (Number.isInteger(index) && mediaItems[index]) setActiveMediaIndex(index);
  };

  const activeMedia =
    activeMediaIndex === null ? undefined : mediaItems[activeMediaIndex];

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
                <span>
                  <strong>{number(mediaItems.length)}</strong>
                  {t("иллюстраций")}
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
                <button
                  className="article-reader-cover-button"
                  type="button"
                  onClick={() => setActiveMediaIndex(0)}
                  aria-label={t("Открыть главное изображение")}
                >
                  <img
                    src={article.imageUrl}
                    alt={
                      article.imageAlt ||
                      `Иллюстрация к статье «${article.title}»`
                    }
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                  />
                  <span aria-hidden="true">{t("Рассмотреть")}</span>
                </button>
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
                ref={contentRef}
                className="article-reader-content"
                onClick={(event) => openContentImage(event.target)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  const image =
                    event.target instanceof Element
                      ? event.target.closest<HTMLImageElement>("img")
                      : null;
                  if (!image) return;
                  event.preventDefault();
                  openContentImage(image);
                }}
                dangerouslySetInnerHTML={{ __html: safeContentHtml }}
              />
            )}

            {sourceItems.length > 0 && (
              <section className="article-reader-sources">
                <span>{t("Источники и библиография")}</span>
                <ol>
                  {sourceItems.map((item, index) => (
                    <li key={`${item.text}-${index}`}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.text}
                        </a>
                      ) : (
                        item.text
                      )}
                    </li>
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

      {activeMedia && activeMediaIndex !== null && (
        <div
          className="article-media-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t("Просмотр иллюстрации")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveMediaIndex(null);
          }}
        >
          <div className="article-media-viewer-frame">
            <header>
              <span>
                {number(activeMediaIndex + 1)} / {number(mediaItems.length)}
              </span>
              <button
                ref={lightboxCloseButtonRef}
                type="button"
                onClick={() => setActiveMediaIndex(null)}
                aria-label={t("Закрыть изображение")}
              >
                <BrandCloseIcon />
              </button>
            </header>
            <img
              src={activeMedia.src}
              alt={
                activeMedia.alt ||
                `Иллюстрация ${activeMediaIndex + 1} к статье «${article.title}»`
              }
            />
            {(activeMedia.caption || activeMedia.alt) && (
              <p>{activeMedia.caption || activeMedia.alt}</p>
            )}
            {mediaItems.length > 1 && (
              <nav aria-label={t("Переключение иллюстраций")}> 
                <button
                  type="button"
                  onClick={() =>
                    setActiveMediaIndex(
                      (activeMediaIndex - 1 + mediaItems.length) % mediaItems.length
                    )
                  }
                  aria-label={t("Предыдущее изображение")}
                >
                  <BrandArrowIcon />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveMediaIndex((activeMediaIndex + 1) % mediaItems.length)
                  }
                  aria-label={t("Следующее изображение")}
                >
                  <BrandArrowIcon />
                </button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
