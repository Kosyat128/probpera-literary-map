import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cmsSiteContent } from "../data/cms/site.generated";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { initializeEditorialSliders } from "../utils/initializeEditorialSliders";
import {
  editorialImageElementAllowsLightbox,
  editorialImageElementMediaItem,
  editorialLightboxMediaItems,
} from "../utils/editorialLightbox";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";
import { CmsNavigationLinks, CmsPageBanners } from "./CmsSiteChrome";
import { cmsPageFieldMarker } from "../cms/directEditBridge";
import BrandArrowIcon from "./BrandArrowIcon";
import BrandCloseIcon from "./BrandCloseIcon";

export type CmsPage = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  allowIndexing?: boolean;
  updatedAt?: string;
};

function publicPath(value: string) {
  return `${import.meta.env.BASE_URL}${value.replace(/^\/+/u, "")}`;
}

export function cmsPageSlugFromPath(pathname: string, baseUrl = "/") {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const configuredBase = baseUrl.replace(/\/+$/u, "");
  if (
    configuredBase &&
    (decodedPathname === configuredBase ||
      decodedPathname.startsWith(`${configuredBase}/`))
  ) {
    decodedPathname = decodedPathname.slice(configuredBase.length) || "/";
  }

  const match = decodedPathname.match(
    /^\/stranitsy\/([a-z0-9][a-z0-9-]+)\/?$/iu
  );
  return match?.[1].toLocaleLowerCase("en-US") || null;
}

export function formatCmsUpdatedAt(
  value: string | undefined,
  language: "ru" | "en"
) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function currentCmsPage() {
  if (typeof window === "undefined") return null;
  const slug = cmsPageSlugFromPath(
    window.location.pathname,
    import.meta.env.BASE_URL
  );
  if (!slug) return null;
  const pages = cmsSiteContent.pages as readonly CmsPage[];
  return pages.find((page) => page.slug === slug) || null;
}

export default function CmsPageReader({ page }: { page: CmsPage }) {
  const { language, number, t } = useInterfaceLanguage();
  const updatedAt = formatCmsUpdatedAt(page.updatedAt, language);
  const shellRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const safeContentHtml = useMemo(
    () => sanitizeArticleHtml(page.contentHtml),
    [page.contentHtml]
  );
  const mediaBaseUrl =
    typeof window === "undefined" ? "https://probpera.ru/" : window.location.href;
  const mediaItems = useMemo(() => {
    if (language !== "ru") return [];
    return editorialLightboxMediaItems(safeContentHtml, mediaBaseUrl);
  }, [language, mediaBaseUrl, safeContentHtml]);
  const closeMediaViewer = useCallback(() => {
    const trigger = lightboxTriggerRef.current;
    setActiveMediaIndex(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }, []);

  useEffect(() => {
    setActiveMediaIndex(null);
    lightboxTriggerRef.current = null;
  }, [language, page.id, safeContentHtml]);

  useEffect(() => {
    const root = proseRef.current;
    if (!root || language !== "ru") return;
    let eligibleImageIndex = 0;
    root.querySelectorAll<HTMLImageElement>("img").forEach((image, index) => {
      const mediaItem = editorialImageElementMediaItem(image, mediaBaseUrl);
      if (editorialImageElementAllowsLightbox(image) && mediaItem) {
        const accessibleAlt =
          image.alt.trim() ||
          `${t("Иллюстрация")} ${number(index + 1)} - ${page.title}`;
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute(
          "aria-label",
          `${t("Открыть изображение")}: ${accessibleAlt}`
        );
        image.dataset.cmsMediaIndex = String(eligibleImageIndex);
        eligibleImageIndex += 1;
      } else {
        image.removeAttribute("data-cms-media-index");
        image.removeAttribute("tabindex");
        if (image.dataset.decorative !== "true") {
          image.removeAttribute("role");
          image.removeAttribute("aria-label");
        }
      }
    });

    return () => {
      root.querySelectorAll<HTMLImageElement>("[data-cms-media-index]").forEach(
        (image) => {
          image.removeAttribute("data-cms-media-index");
          image.removeAttribute("tabindex");
          image.removeAttribute("role");
          image.removeAttribute("aria-label");
        }
      );
    };
  }, [language, mediaBaseUrl, number, page.title, safeContentHtml, t]);

  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    return initializeEditorialSliders(root, {
      region: (sliderIndex, imageCount) =>
        `${t("Галерея статьи")} ${sliderIndex}: ${imageCount} ${t("изображений")}`,
      previous: t("Предыдущее изображение"),
      next: t("Следующее изображение"),
      pause: t("Остановить автоматическую прокрутку"),
      resume: t("Продолжить автоматическую прокрутку"),
      selection: t("Выбор изображения"),
      show: (imageIndex, imageCount) =>
        `${t("Показать изображение")} ${imageIndex} ${t("из")} ${imageCount}`,
      status: (imageIndex, imageCount) =>
        `${imageIndex} ${t("из")} ${imageCount}`,
    });
  }, [language, safeContentHtml, t]);

  const mediaViewerOpen = activeMediaIndex !== null;

  useEffect(() => {
    if (!mediaViewerOpen || !lightboxRef.current) return;
    const lightbox = lightboxRef.current;
    const hiddenSiblings = [...(shellRef.current?.children || [])]
      .filter((element) => element !== lightbox)
      .map((element) => ({
        element,
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: element.hasAttribute("inert"),
      }));

    hiddenSiblings.forEach(({ element }) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });
    lightboxCloseButtonRef.current?.focus();

    const handleLightboxKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMediaViewer();
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
      } else if (event.key === "Tab") {
        const focusable = [
          ...lightbox.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
          ),
        ];
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !lightbox.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleLightboxKeys);
    return () => {
      window.removeEventListener("keydown", handleLightboxKeys);
      hiddenSiblings.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        if (!inert) element.removeAttribute("inert");
      });
    };
  }, [closeMediaViewer, mediaItems.length, mediaViewerOpen]);

  const openContentImage = (target: EventTarget | null) => {
    const image =
      target instanceof Element
        ? target.closest<HTMLImageElement>("img")
        : null;
    if (
      !image ||
      !proseRef.current?.contains(image) ||
      !editorialImageElementAllowsLightbox(image)
    ) {
      return false;
    }
    const index = Number(image.dataset.cmsMediaIndex);
    if (!Number.isInteger(index) || !mediaItems[index]) return false;
    lightboxTriggerRef.current = image;
    setActiveMediaIndex(index);
    return true;
  };

  const activeMedia =
    activeMediaIndex === null ? undefined : mediaItems[activeMediaIndex];

  return (
    <div ref={shellRef} className="cms-page-shell">
      <header className="cms-page-header">
        <a className="cms-page-brand" href={publicPath("")}>
          <img
            src={publicPath("brand/probpera-logo.png")}
            alt=""
            width="58"
            height="58"
            loading="eager"
            decoding="async"
          />
          <span>
            <strong>{t("Проба Пера")}</strong>
            <small>{t("Литературный журнал")}</small>
          </span>
        </a>
        <nav aria-label={t("Основная навигация")}>
          <a href={publicPath("#atlas")}>{t("Литературная планета")}</a>
          <a href={publicPath("#journal")}>{t("Статьи")}</a>
          <a href={publicPath("#books")}>{t("Книги")}</a>
          <CmsNavigationLinks location="header" />
        </nav>
      </header>
      <CmsPageBanners />
      <main className="cms-page-main">
        <a className="cms-page-back" href={publicPath("")}>
          ← {t("На главную")}
        </a>
        {language === "en" ? (
          <article>
            <header>
              <span className="section-kicker">{t("Проба Пера")}</span>
              <h1>{t("Эта страница пока недоступна на английском языке")}</h1>
              <p>
                {t(
                  "Редакция готовит проверенный перевод. Русский оригинал не выдаётся за английскую версию."
                )}
              </p>
            </header>
          </article>
        ) : (
          <article>
            <header>
              <span className="section-kicker">{t("Проба Пера")}</span>
              <h1
                {...cmsPageFieldMarker(page.id, "title", page.title, {
                  label: "Заголовок страницы",
                })}
              >
                {page.title}
              </h1>
              {page.excerpt && (
                <p
                  {...cmsPageFieldMarker(page.id, "excerpt", page.excerpt, {
                    kind: "textarea",
                    label: "Описание страницы",
                  })}
                >
                  {page.excerpt}
                </p>
              )}
              {updatedAt && <small>{t("Обновлено")} {updatedAt}</small>}
            </header>
            <div
              ref={proseRef}
              className="cms-page-prose"
              onClick={(event) => openContentImage(event.target)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                const image =
                  event.target instanceof Element
                    ? event.target.closest<HTMLImageElement>("img")
                    : null;
                if (image && openContentImage(image)) event.preventDefault();
              }}
              {...cmsPageFieldMarker(
                page.id,
                "contentHtml",
                page.contentHtml,
                { kind: "richtext", label: "Содержимое страницы" }
              )}
              dangerouslySetInnerHTML={{
                __html: safeContentHtml,
              }}
            />
          </article>
        )}
      </main>
      <footer className="cms-page-footer">
        <div>
          <strong>{t("Проба Пера")}</strong>
          <p>{t("Литературная экосистема, где страна, автор, книга и статья связаны.")}</p>
        </div>
        <CmsNavigationLinks location="footer" withHeading />
        <a href={publicPath("")}>{t("Вернуться на главную")} →</a>
      </footer>
      {activeMedia && activeMediaIndex !== null && (
        <div
          ref={lightboxRef}
          className="article-media-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t("Просмотр иллюстрации")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeMediaViewer();
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
                onClick={closeMediaViewer}
                aria-label={t("Закрыть изображение")}
              >
                <BrandCloseIcon />
              </button>
            </header>
            <img
              src={activeMedia.src}
              alt={
                activeMedia.alt ||
                `${t("Иллюстрация")} ${number(activeMediaIndex + 1)} - ${
                  page.title
                }`
              }
              decoding="async"
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
                      (activeMediaIndex - 1 + mediaItems.length) %
                        mediaItems.length
                    )
                  }
                  aria-label={t("Предыдущее изображение")}
                >
                  <BrandArrowIcon />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveMediaIndex(
                      (activeMediaIndex + 1) % mediaItems.length
                    )
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
