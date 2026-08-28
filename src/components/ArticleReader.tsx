import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import ArticleEngagement from "../community/ArticleEngagement";
import ArticleViewCount from "../community/ArticleViewCount";
import DisplayModeControl from "./DisplayModeControl";
import InterfaceLanguageControl from "./InterfaceLanguageControl";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { mediaFocusPosition, mediaFocusStyle } from "../utils/mediaFocus";
import {
  getArticleBookMentions,
  type ArticleBookMention,
} from "../data/articles/bookMentions";
import {
  articleCatalogEntryForLanguage,
  articleDocumentForLanguage,
  type ArticleContentSource,
  type LocalizableArticleDocument,
} from "../data/articles/localization";
import ShareLinks from "../editorial/ShareLinks";
import { useDisplayMode } from "../hooks/useDisplayMode";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { useReadingProgress } from "../hooks/useReadingProgress";
import {
  BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY,
  BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY,
  normalizeBookArchiveBookKey,
  readBookArchiveNavigationContext,
  serializeBookArchiveLocation,
  type BookArchiveNavigationContext,
} from "../books/bookArchiveLocation";
import {
  articlePath,
  journalPath,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";
import BrandHeartIcon from "./BrandHeartIcon";
import BrandCloseIcon from "./BrandCloseIcon";
import BrandArrowIcon from "./BrandArrowIcon";
import { cmsEntityMarker } from "../cms/directEditBridge";
import { CmsPageBanners } from "./CmsSiteChrome";

type ArticleMediaItem = {
  src: string;
  alt: string;
  caption: string;
};

type ArticleDocument = LocalizableArticleDocument;

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

export type ArticleReaderSourceItem = {
  text: string;
  fullText: string;
  url: string;
  kind: "reference" | "image-credit";
};

function embeddedSourceUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s<>"']+/iu)?.[0] || "";
  return match.replace(/[\]),.;:!?]+$/u, "");
}

function isImageCredit(text: string, url: string) {
  let hostname = "";
  let pathname = "";
  try {
    const parsedUrl = new URL(url);
    hostname = parsedUrl.hostname;
    pathname = parsedUrl.pathname;
  } catch {
    // A malformed legacy URL is still rendered, but never used for classification.
  }

  return (
    (/\bcommons\.wikimedia\.org$/iu.test(hostname) &&
      /\/(?:wiki\/)?(?:File|Category):|\/wiki\/Special:Redirect\/file\//iu.test(
        pathname
      )) ||
    /(?:wikimedia\s+commons|источник\s+(?:изображения|иллюстрации|фотографии)|фото(?:графия)?\s*:|image\s+(?:credit|source)|photo\s+(?:credit|source)|иллюстраци[яи]\s*:)/iu.test(
      `${text} ${url}`
    )
  );
}

function compactSourceText(
  text: string,
  url: string,
  kind: ArticleReaderSourceItem["kind"]
) {
  const withoutUrl = url ? text.replace(url, " ") : text;
  const prose = withoutUrl
    .replace(/\s*(?:[-]\s*)?(?:url|ссылка)?\s*[:-]?\s*[\]),.;:!?]*$/iu, "")
    .replace(/\s{2,}/gu, " ")
    .trim();
  if (prose && !/^https?:\/\//iu.test(prose)) return prose;
  if (!url) return text;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./iu, "");
    if (kind === "image-credit") {
      const rawFileName = parsedUrl.pathname.split("/").pop() || "";
      const fileName = decodeURIComponent(rawFileName)
        .replace(/^File:/iu, "")
        .replace(/_/gu, " ");
      return fileName ? `Wikimedia Commons - ${fileName}` : "Wikimedia Commons";
    }
    return hostname;
  } catch {
    return url;
  }
}

export function articleReaderSourceItems(value?: ArticleContentSource[]) {
  return (value || [])
    .map((item) => {
      if (typeof item === "string") {
        const fullText = item.trim();
        const url = embeddedSourceUrl(fullText);
        const kind = isImageCredit(fullText, url) ? "image-credit" : "reference";
        return {
          text: compactSourceText(fullText, url, kind),
          fullText,
          url,
          kind,
        } satisfies ArticleReaderSourceItem;
      }
      const fullText = (
        item.text ||
        item.title ||
        item.label ||
        item.url ||
        ""
      ).trim();
      const url = (item.url || embeddedSourceUrl(fullText)).trim();
      const kind = isImageCredit(fullText, url) ? "image-credit" : "reference";
      return {
        text: compactSourceText(fullText, url, kind),
        fullText,
        url,
        kind,
      } satisfies ArticleReaderSourceItem;
    })
    .filter((item) => item.text && item.fullText);
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

function articleIllustrationAlt(
  language: "ru" | "en",
  title: string,
  index?: number
) {
  if (language === "en") {
    return index
      ? `Illustration ${index} for the article "${title}"`
      : `Illustration for the article "${title}"`;
  }
  return index
    ? `Иллюстрация ${index} к статье «${title}»`
    : `Иллюстрация к статье «${title}»`;
}

function publicMediaUrl(value: string) {
  if (/^https?:\/\//iu.test(value)) return value;
  return `${import.meta.env.BASE_URL}${value.replace(/^\/+/, "")}`;
}

function readArticleBookNavigationContext() {
  if (typeof window === "undefined") return null;
  try {
    return readBookArchiveNavigationContext(window.sessionStorage);
  } catch {
    return null;
  }
}

function bookArchivePath(
  bookKey: string,
  context: BookArchiveNavigationContext | null
) {
  const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return serializeBookArchiveLocation(
    {
      pathname: `${basePath || ""}/`,
      hash: context ? "" : "#books",
    },
    { bookKey, shelfId: context?.shelfId }
  );
}

function readArticleBookFocusKey() {
  if (typeof window === "undefined") return null;
  return normalizeBookArchiveBookKey(
    window.history.state?.[BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY]
  );
}

function applyBrandImageFallback(
  image: HTMLImageElement,
  title: string,
  language: "ru" | "en"
) {
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.classList.add("is-fallback");
  image.alt =
    language === "en"
      ? `Probpera branded cover for "${title}"`
      : `Фирменная обложка материала «${title}»`;
  image.src = `${import.meta.env.BASE_URL}brand/probpera-logo.png`;
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
  const closeButtonRef = useRef<HTMLAnchorElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxCloseButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const restoredArticleRef = useRef("");
  const returnedBookFocusKey = readArticleBookFocusKey();
  const bookNavigationContext = useMemo(
    readArticleBookNavigationContext,
    [article.id]
  );
  const [articleDocument, setArticleDocument] = useState<ArticleDocument | null>(null);
  const [error, setError] = useState(false);
  const [documentTranslationUnavailable, setDocumentTranslationUnavailable] =
    useState(false);
  const [mentionedBooks, setMentionedBooks] = useState<ArticleBookMention[]>([]);
  const [progress, setProgress] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const mediaViewerOpen = activeMediaIndex !== null;
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const { mode } = useDisplayMode();
  const { language, t, number } = useInterfaceLanguage();
  const closeMediaViewer = useCallback(() => {
    const trigger = lightboxTriggerRef.current;
    setActiveMediaIndex(null);
    window.requestAnimationFrame(() => trigger?.focus());
  }, []);
  const localizedArticle = useMemo(
    () => articleCatalogEntryForLanguage(article, language),
    [article, language]
  );
  const translationUnavailable =
    language === "en" &&
    (!localizedArticle || documentTranslationUnavailable);
  const displayArticle = useMemo<ArticleCatalogEntry>(
    () =>
      localizedArticle || {
        ...article,
        title: "English translation is not available yet",
        description:
          "The editorial team has not published an approved English version of this article.",
        imageAlt: "",
        sectionLabel: "Article",
        publishedLabel: "",
        readingMinutes: 0,
        wordCount: 0,
        headingCount: 0,
      },
    [article, localizedArticle]
  );
  const {
    items: savedReadings,
    toggle: toggleSavedReading,
    setStatus: setReadingStatus,
  } = useReadingLibrary();
  const savedArticle = savedReadings.find(
    (item) => item.kind === "article" && item.id === article.id
  );
  const isSaved = Boolean(savedArticle);
  const { restoredProgress, saveProgress, markCompleted } = useReadingProgress(
    "article",
    article.id
  );

  useEffect(() => {
    let active = true;
    setArticleDocument(null);
    setError(false);
    setDocumentTranslationUnavailable(false);

    if (language === "en" && !localizedArticle) {
      return () => {
        active = false;
      };
    }

    fetch(publicArticleUrl(article))
      .then((response) => {
        if (!response.ok) throw new Error(`Article ${article.id} not found`);
        return response.json() as Promise<ArticleDocument>;
      })
      .then((payload) => {
        if (!active) return;
        const localizedDocument = articleDocumentForLanguage(payload, language);
        if (!localizedDocument) {
          setDocumentTranslationUnavailable(true);
          return;
        }
        setArticleDocument(localizedDocument);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [article, language, localizedArticle]);

  useEffect(() => {
    let active = true;
    setMentionedBooks([]);
    getArticleBookMentions(article.id)
      .then((books) => {
        if (active) setMentionedBooks(books.slice(0, 6));
      })
      .catch(() => {
        if (active) setMentionedBooks([]);
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
      if (lightboxRef.current) return;
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
    const focusFrame = returnedBookFocusKey
      ? 0
      : window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
      previouslyFocused?.focus();
    };
  }, [article.id, onClose, returnedBookFocusKey]);

  useEffect(() => {
    setProgress(0);
    setActiveHeadingId("");
    setActiveMediaIndex(null);
    setResumedFrom(null);
    restoredArticleRef.current = "";
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
    const contentBaseUrl = article.legacyPath
      ? new URL(article.legacyPath, "https://probpera.ru").href
      : article.url;
    const inlineItems = contentMediaItems(safeContentHtml, contentBaseUrl);
    if (!displayArticle.imageUrl) return inlineItems;
    return [
      {
        src: displayArticle.imageUrl,
        alt:
          displayArticle.imageAlt ||
          articleIllustrationAlt(language, displayArticle.title),
        caption: "",
      },
      ...inlineItems,
    ];
  }, [
    displayArticle.imageAlt,
    displayArticle.imageUrl,
    displayArticle.title,
    language,
    article.legacyPath,
    article.url,
    safeContentHtml,
  ]);
  const sourceItems = useMemo(
    () => [
      ...articleReaderSourceItems(articleDocument?.sources),
      ...articleReaderSourceItems(articleDocument?.bibliography),
    ],
    [articleDocument]
  );
  const bibliographyItems = sourceItems.filter(
    (item) => item.kind === "reference"
  );
  const imageCreditItems = sourceItems.filter(
    (item) => item.kind === "image-credit"
  );
  const activeHeading = headingItems.find(
    (heading) => heading.id === activeHeadingId
  );

  useEffect(() => {
    const root = contentRef.current;
    if (!root || !safeContentHtml) return;
    const heroOffset = displayArticle.imageUrl ? 1 : 0;
    root.querySelectorAll<HTMLImageElement>("img").forEach((image, index) => {
      const caption = image
        .closest("figure")
        ?.querySelector("figcaption")
        ?.textContent?.trim();
      if (!image.alt.trim()) {
        image.alt =
          caption ||
          articleIllustrationAlt(language, displayArticle.title, index + 1);
      }
      image.loading = "lazy";
      image.decoding = "async";
      image.setAttribute("fetchpriority", "low");
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute(
        "aria-label",
        image.alt
          ? `${t("Открыть изображение")}: ${image.alt}`
          : `${t("Открыть иллюстрацию")} ${number(index + 1)}`
      );
      image.dataset.articleMediaIndex = String(index + heroOffset);
    });
  }, [
    displayArticle.imageUrl,
    displayArticle.title,
    language,
    number,
    safeContentHtml,
    t,
  ]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || !safeContentHtml) return;

    const cleanups: Array<() => void> = [];
    root
      .querySelectorAll<HTMLElement>(".article-design-block.is-slider")
      .forEach((slider, sliderIndex) => {
        const images = Array.from(
          slider.querySelectorAll<HTMLImageElement>(":scope > img")
        );
        if (!images.length) return;

        slider.classList.add("is-interactive");
        slider.tabIndex = 0;
        slider.setAttribute("role", "region");
        slider.setAttribute(
          "aria-label",
          `${t("Галерея статьи")} ${number(sliderIndex + 1)}: ${number(
            images.length
          )} ${t("изображений")}`
        );

        let activeIndex = 0;
        let touchStartX: number | null = null;
        const controls = document.createElement("div");
        controls.className = "article-slider-controls";

        const previousButton = document.createElement("button");
        previousButton.type = "button";
        previousButton.className = "article-slider-arrow is-previous";
        previousButton.setAttribute("aria-label", t("Предыдущее изображение"));
        previousButton.textContent = "←";

        const dots = document.createElement("div");
        dots.className = "article-slider-dots";
        dots.setAttribute("role", "group");
        dots.setAttribute("aria-label", t("Выбор изображения"));

        const nextButton = document.createElement("button");
        nextButton.type = "button";
        nextButton.className = "article-slider-arrow is-next";
        nextButton.setAttribute("aria-label", t("Следующее изображение"));
        nextButton.textContent = "→";

        const dotButtons = images.map((_, imageIndex) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "article-slider-dot";
          button.setAttribute(
            "aria-label",
            `${t("Показать изображение")} ${number(
              imageIndex + 1
            )} ${t("из")} ${number(images.length)}`
          );
          dots.append(button);
          return button;
        });

        controls.append(previousButton, dots, nextButton);
        slider.append(controls);

        const update = (nextIndex: number) => {
          activeIndex = (nextIndex + images.length) % images.length;
          images.forEach((image, imageIndex) => {
            const isActive = imageIndex === activeIndex;
            image.classList.toggle("is-active", isActive);
            image.setAttribute("aria-hidden", String(!isActive));
            image.tabIndex = isActive ? 0 : -1;
          });
          dotButtons.forEach((button, imageIndex) => {
            const isActive = imageIndex === activeIndex;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-current", isActive ? "true" : "false");
          });
        };

        const showPrevious = (event?: Event) => {
          event?.preventDefault();
          event?.stopPropagation();
          update(activeIndex - 1);
        };
        const showNext = (event?: Event) => {
          event?.preventDefault();
          event?.stopPropagation();
          update(activeIndex + 1);
        };
        const handleKeydown = (event: KeyboardEvent) => {
          if (event.key === "ArrowLeft") showPrevious(event);
          if (event.key === "ArrowRight") showNext(event);
        };
        const handleTouchStart = (event: TouchEvent) => {
          touchStartX = event.changedTouches[0]?.clientX ?? null;
        };
        const handleTouchEnd = (event: TouchEvent) => {
          const touchEndX = event.changedTouches[0]?.clientX;
          if (touchStartX === null || touchEndX === undefined) return;
          const distance = touchEndX - touchStartX;
          touchStartX = null;
          if (Math.abs(distance) < 42) return;
          if (distance > 0) showPrevious(event);
          else showNext(event);
        };

        previousButton.addEventListener("click", showPrevious);
        nextButton.addEventListener("click", showNext);
        dotButtons.forEach((button, imageIndex) => {
          const handler = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            update(imageIndex);
          };
          button.addEventListener("click", handler);
          cleanups.push(() => button.removeEventListener("click", handler));
        });
        slider.addEventListener("keydown", handleKeydown);
        slider.addEventListener("touchstart", handleTouchStart, { passive: true });
        slider.addEventListener("touchend", handleTouchEnd, { passive: false });
        update(0);

        cleanups.push(() => {
          previousButton.removeEventListener("click", showPrevious);
          nextButton.removeEventListener("click", showNext);
          slider.removeEventListener("keydown", handleKeydown);
          slider.removeEventListener("touchstart", handleTouchStart);
          slider.removeEventListener("touchend", handleTouchEnd);
          controls.remove();
          slider.classList.remove("is-interactive");
          slider.removeAttribute("role");
          slider.removeAttribute("aria-label");
          slider.removeAttribute("tabindex");
          images.forEach((image) => {
            image.classList.remove("is-active");
            image.removeAttribute("aria-hidden");
          });
        });
      });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [language, number, safeContentHtml, t]);

  useEffect(() => {
    if (!mediaViewerOpen || !lightboxRef.current) return;
    const lightbox = lightboxRef.current;
    const hiddenSiblings = [...(dialogRef.current?.children || [])]
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
          (document.activeElement === last || !lightbox.contains(document.activeElement))
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

  useEffect(() => {
    const root = scrollRef.current;
    const content = contentRef.current;
    if (!root || !content || !safeContentHtml) return;
    const targets = [
      ...content.querySelectorAll<HTMLElement>(
        ".article-design-block[data-reveal]:not([data-reveal='none'])"
      ),
    ];
    if (!targets.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((target) => target.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { root, rootMargin: "0px 0px -10%", threshold: 0.12 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [safeContentHtml]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !articleDocument) return;
    const progressToRestore =
      restoredProgress !== null &&
      restoredProgress >= 3 &&
      restoredProgress < 96
        ? restoredProgress
        : 0;
    const resumable = progressToRestore > 0;
    const restoreMarker = `${resumable ? "resume" : "top"}:${article.id}`;
    if (
      restoredArticleRef.current === restoreMarker ||
      restoredArticleRef.current === `resume:${article.id}`
    ) return;
    restoredArticleRef.current = restoreMarker;
    const frame = window.requestAnimationFrame(() => {
      const available = element.scrollHeight - element.clientHeight;
      element.scrollTo({
        top:
          resumable && available > 0
            ? available * (progressToRestore / 100)
            : 0,
        behavior: "auto",
      });
      setProgress(progressToRestore);
      setResumedFrom(resumable ? progressToRestore : null);
      if (resumable && savedArticle?.status === "saved") {
        setReadingStatus(article.id, "article", "reading");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    article.id,
    articleDocument,
    restoredProgress,
    savedArticle?.status,
    setReadingStatus,
  ]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const available = element.scrollHeight - element.clientHeight;
    const next =
      available > 0
        ? Math.min(100, (element.scrollTop / available) * 100)
        : 0;
    setProgress(next);
    if (next >= 96) {
      markCompleted(activeHeadingId || undefined);
      if (savedArticle && savedArticle.status !== "finished") {
        setReadingStatus(article.id, "article", "finished");
      }
    } else {
      saveProgress(next, activeHeadingId || undefined);
      if (next >= 3 && savedArticle?.status === "saved") {
        setReadingStatus(article.id, "article", "reading");
      }
    }
  };

  const jumpToHeading = (headingId: string) => {
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`);
    setActiveHeadingId(headingId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openAnother = (target: ArticleCatalogEntry) => {
    const originalTarget = [previous, next, ...related].find(
      (candidate) => candidate?.id === target.id
    );
    onOpen(originalTarget || target);
  };

  const openMentionedBook = (bookKey: string, href: string) => {
    const safeBookKey = normalizeBookArchiveBookKey(bookKey);
    if (!safeBookKey) return;
    const articleState = {
      ...(window.history.state || {}),
      [BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY]: safeBookKey,
    };
    window.history.replaceState(
      articleState,
      "",
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    window.history.pushState(
      {
        ...articleState,
        [BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY]: safeBookKey,
      },
      "",
      href
    );
    window.dispatchEvent(new Event("probpera:navigation"));
  };

  const openContentImage = (target: EventTarget | null) => {
    const image = target instanceof Element ? target.closest<HTMLImageElement>("img") : null;
    if (!image || !contentRef.current?.contains(image)) return;
    const index = Number(image.dataset.articleMediaIndex);
    if (Number.isInteger(index) && mediaItems[index]) {
      lightboxTriggerRef.current = image;
      setActiveMediaIndex(index);
    }
  };

  const activeMedia =
    activeMediaIndex === null ? undefined : mediaItems[activeMediaIndex];
  const localizedRelated = related
    .map((item) => articleCatalogEntryForLanguage(item, language))
    .filter((item): item is ArticleCatalogEntry => Boolean(item));
  const sidebarRecommendations = localizedRelated.slice(0, 3);
  const continuingRecommendations = localizedRelated.slice(0, 9);
  const localizedPrevious = previous
    ? articleCatalogEntryForLanguage(previous, language)
    : null;
  const localizedNext = next
    ? articleCatalogEntryForLanguage(next, language)
    : null;
  const localizedMentionedBooks = useMemo(
    () =>
      mentionedBooks.flatMap((book) => {
        const copy = book.localizations?.[language];
        if (!copy?.title.trim()) return [];
        if (
          language === "en" &&
          /\p{Script=Cyrillic}/u.test(`${copy.title} ${copy.writerName}`)
        ) {
          return [];
        }
        return [{ ...book, ...copy }];
      }),
    [language, mentionedBooks]
  );

  useEffect(() => {
    if (!returnedBookFocusKey) return;
    const frame = window.requestAnimationFrame(() => {
      const target = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          "[data-article-book-origin]"
        ) || []),
      ].find(
        (element) =>
          element.dataset.articleBookOrigin === returnedBookFocusKey
      );
      (target || closeButtonRef.current)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [localizedMentionedBooks, returnedBookFocusKey]);

  return (
    <div
      ref={dialogRef}
      className={`article-reader is-${mode}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-reader-title"
      {...cmsEntityMarker(
        "article",
        article.id,
        article.title,
        article.id.startsWith("cms-")
          ? `/articles/${encodeURIComponent(article.id.slice(4))}`
          : `/articles?search=${encodeURIComponent(article.title)}`
      )}
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
          <a
            ref={closeButtonRef}
            className="reader-back"
            href={journalPath(displayArticle.sectionId)}
            onClick={(event) => {
              if (!shouldUseClientNavigation(event)) return;
              event.preventDefault();
              onClose();
            }}
          >
          <span aria-hidden="true">
            <BrandArrowIcon />
          </span>{" "}
          {t("К журналу")}
        </a>
        <div>
          <span>{displayArticle.sectionLabel}</span>
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
          <InterfaceLanguageControl />
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
                title: displayArticle.title,
                sectionId: displayArticle.sectionId,
                sectionLabel: displayArticle.sectionLabel,
                href: articlePath(
                  displayArticle.id,
                  displayArticle.title,
                  displayArticle.sectionId,
                  displayArticle.slug
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
        <CmsPageBanners />
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
              {displayArticle.readingMinutes} {t("мин. чтения")} ·{" "}
              {number(displayArticle.wordCount)} {t("слов")}
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
                <span>{displayArticle.sectionLabel}</span>
                <small>{displayArticle.publishedLabel}</small>
              </div>
              <h1
                id="article-reader-title"
                className={
                  displayArticle.title.length > 70
                    ? "is-long-title"
                    : displayArticle.title.length > 44
                      ? "is-medium-title"
                      : undefined
                }
              >
                {displayArticle.title}
              </h1>
              {displayArticle.description && <p>{displayArticle.description}</p>}
              <div className="article-reader-metrics">
                <ArticleViewCount
                  currentPath={articlePath(
                    displayArticle.id,
                    displayArticle.title,
                    displayArticle.sectionId,
                    displayArticle.slug
                  )}
                  legacyPath={article.legacyPath}
                />
                <span>
                  <strong>{number(displayArticle.readingMinutes)}</strong>
                  {t("минут чтения")}
                </span>
                <span>
                  <strong>{number(displayArticle.wordCount)}</strong>
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
                <a href={displayArticle.url} target="_blank" rel="noreferrer">
                  {t("Постоянная ссылка ↗")}
                </a>
              </div>
              {resumedFrom !== null && (
                <div className="article-resume-note" role="status">
                  <div className="article-resume-copy">
                    <span className="article-resume-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M7 4.8h10a1.2 1.2 0 0 1 1.2 1.2v13l-6.2-3.7L5.8 19V6A1.2 1.2 0 0 1 7 4.8Z" />
                        <path d="M9 9h6" />
                      </svg>
                    </span>
                    <span>
                      <strong>{t("Продолжено с места остановки")}</strong>
                      <small>
                        {Math.round(resumedFrom)}% {t("статьи прочитано")}
                      </small>
                    </span>
                  </div>
                  <div className="article-resume-actions">
                    <span
                      className="article-resume-progress"
                      aria-hidden="true"
                      style={
                        {
                          "--resume-progress": `${Math.round(resumedFrom)}%`,
                        } as CSSProperties
                      }
                    >
                      <i />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        setResumedFrom(null);
                        saveProgress(0);
                      }}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M7.2 8.1H3.8V4.7" />
                        <path d="M4.1 8.2A8.2 8.2 0 1 1 4.8 17" />
                      </svg>
                      {t("Начать сначала")}
                    </button>
                  </div>
                </div>
              )}
            </header>

            {displayArticle.imageUrl && !translationUnavailable && (
              <figure
                className="article-reader-cover"
                style={{
                  backgroundImage: `url("${displayArticle.imageUrl}")`,
                  backgroundPosition: mediaFocusPosition(
                    displayArticle.imageFocusX,
                    displayArticle.imageFocusY
                  ),
                }}
              >
                <button
                  className="article-reader-cover-button"
                  type="button"
                  onClick={(event) => {
                    lightboxTriggerRef.current = event.currentTarget;
                    setActiveMediaIndex(0);
                  }}
                  aria-label={t("Открыть главное изображение")}
                >
                  <img
                    src={displayArticle.imageUrl}
                    style={mediaFocusStyle(
                      displayArticle.imageFocusX,
                      displayArticle.imageFocusY
                    )}
                    alt={
                      displayArticle.imageAlt ||
                      articleIllustrationAlt(language, displayArticle.title)
                    }
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                    onError={(event) =>
                      applyBrandImageFallback(
                        event.currentTarget,
                        displayArticle.title,
                        language
                      )
                    }
                  />
                  <span aria-hidden="true">{t("Рассмотреть")}</span>
                </button>
              </figure>
            )}

            {error && (
              <div className="article-reader-error">
                <strong>{t("Материал временно не открылся.")}</strong>
                <a href={displayArticle.url} target="_blank" rel="noreferrer">
                  {t("Открыть постоянную ссылку")}
                </a>
              </div>
            )}

            {translationUnavailable && (
              <div className="article-reader-error" role="status">
                <strong>English translation is not available yet.</strong>
                <p>
                  The editorial team has not published an approved English version
                  of this article. Switch to Russian to read the original.
                </p>
              </div>
            )}

            {!articleDocument && !error && !translationUnavailable && (
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
              <section
                className="article-reader-sources"
                aria-labelledby="article-reader-sources-title"
              >
                <h2 id="article-reader-sources-title">
                  {t("Источники и библиография")}
                </h2>
                {bibliographyItems.length > 0 && (
                  <ol>
                    {bibliographyItems.map((item, index) => (
                      <li key={`${item.fullText}-${index}`}>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            title={
                              item.fullText !== item.text
                                ? item.fullText
                                : undefined
                            }
                          >
                            {item.text}
                          </a>
                        ) : (
                          item.text
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {imageCreditItems.length > 0 && (
                  <details className="article-reader-image-credits">
                    <summary>
                      {language === "en"
                        ? "Illustration sources"
                        : "Источники иллюстраций"}
                      <span>{number(imageCreditItems.length)}</span>
                    </summary>
                    <ul>
                      {imageCreditItems.map((item, index) => (
                        <li key={`${item.fullText}-${index}`}>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              title={
                                item.fullText !== item.text
                                  ? item.fullText
                                  : undefined
                              }
                            >
                              {item.text}
                            </a>
                          ) : (
                            item.text
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}

            {articleDocument && localizedMentionedBooks.length > 0 && (
              <section
                className="article-reader-related-books"
                aria-labelledby="article-reader-related-books-title"
              >
                <header>
                  <div>
                    <span>
                      {language === "en" ? "Books in this article" : "Книги в статье"}
                    </span>
                    <h2 id="article-reader-related-books-title">
                      {language === "en" ? "Continue with the books" : "Продолжить с книгами"}
                    </h2>
                  </div>
                  <p>
                    {language === "en"
                      ? "Verified works mentioned in the text and available in the literary archive."
                      : "Проверенные произведения, упомянутые в тексте и доступные в книжном архиве."}
                  </p>
                </header>
                <div>
                  {localizedMentionedBooks.map((book) => (
                    <a
                      className="article-reader-related-book"
                      href={bookArchivePath(book.key, bookNavigationContext)}
                      key={book.key}
                      data-article-book-origin={book.key}
                      onClick={(event) => {
                        if (!shouldUseClientNavigation(event)) return;
                        event.preventDefault();
                        openMentionedBook(
                          book.key,
                          bookArchivePath(book.key, bookNavigationContext)
                        );
                      }}
                    >
                      <span className="article-reader-related-book-cover" aria-hidden="true">
                        <i>ПП</i>
                        {book.coverUrl && (
                          <img
                            src={publicMediaUrl(book.coverUrl)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                      </span>
                      <span className="article-reader-related-book-copy">
                        <small>
                          {book.kind === "review"
                            ? language === "en"
                              ? "Book reviewed"
                              : "Книга в центре статьи"
                            : book.kind === "feature"
                              ? language === "en"
                                ? "Featured book"
                                : "О книге в материале"
                              : language === "en"
                                ? "Book mentioned"
                                : "Книга упоминается"}
                        </small>
                        <strong>{book.title}</strong>
                        <em>
                          {book.writerName}
                          {book.firstPublished ? ` · ${book.firstPublished}` : ""}
                        </em>
                      </span>
                    </a>
                  ))}
                </div>
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
                    displayArticle.id,
                    displayArticle.title,
                    displayArticle.sectionId,
                    displayArticle.slug
                  )}`}
                  title={displayArticle.title}
                />
                <ArticleEngagement articleSlug={article.id} />
              </footer>
            )}

            {articleDocument && continuingRecommendations.length > 0 && (
              <section
                className="article-reader-more"
                aria-labelledby="article-reader-more-title"
              >
                <header>
                  <div>
                    <span>{t("Редакционный маршрут")}</span>
                    <h2 id="article-reader-more-title">
                      {t("Что читать дальше")}
                    </h2>
                  </div>
                  <p>
                    {t(
                      "Материалы подобраны по рубрике, теме и смысловым связям этой публикации."
                    )}
                  </p>
                </header>
                <div>
                  {continuingRecommendations.map((item) => (
                    <a
                      key={item.id}
                      href={articlePath(
                        item.id,
                        item.title,
                        item.sectionId,
                        item.slug
                      )}
                      onClick={(event) => {
                        if (!shouldUseClientNavigation(event)) return;
                        event.preventDefault();
                        openAnother(item);
                      }}
                    >
                      <span
                        className="article-reader-more-image"
                        aria-hidden="true"
                        style={
                          item.imageUrl
                            ? {
                                backgroundImage: `url("${item.imageUrl}")`,
                                backgroundPosition: mediaFocusPosition(
                                  item.imageFocusX,
                                  item.imageFocusY
                                ),
                              }
                            : undefined
                        }
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            style={mediaFocusStyle(item.imageFocusX, item.imageFocusY)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={(event) =>
                              applyBrandImageFallback(
                                event.currentTarget,
                                item.title,
                                language
                              )
                            }
                          />
                        ) : (
                          <i>ПП</i>
                        )}
                      </span>
                      <span className="article-reader-more-copy">
                        <small>{item.sectionLabel}</small>
                        <strong>{item.title}</strong>
                        <em>
                          {item.readingMinutes} {t("мин. чтения")}
                        </em>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="article-reader-related">
            <span>{t("Продолжить чтение")}</span>
            {sidebarRecommendations.map((item) => (
              <a
                key={item.id}
                href={articlePath(
                  item.id,
                  item.title,
                  item.sectionId,
                  item.slug
                )}
                onClick={(event) => {
                  if (!shouldUseClientNavigation(event)) return;
                  event.preventDefault();
                  openAnother(item);
                }}
              >
                {item.imageUrl && (
                  <span
                    className="article-related-image"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url("${item.imageUrl}")`,
                      backgroundPosition: mediaFocusPosition(
                        item.imageFocusX,
                        item.imageFocusY
                      ),
                    }}
                  >
                    <img
                      src={item.imageUrl}
                      style={mediaFocusStyle(item.imageFocusX, item.imageFocusY)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(event) =>
                        applyBrandImageFallback(
                          event.currentTarget,
                          item.title,
                          language
                        )
                      }
                    />
                  </span>
                )}
                <span className="article-related-copy">
                  <small>{item.sectionLabel}</small>
                  <strong>{item.title}</strong>
                  <em>
                    {item.readingMinutes} {t("мин.")}
                  </em>
                </span>
              </a>
            ))}
          </aside>
        </main>

        <nav
          className="article-reader-sequence"
          aria-label={t("Соседние публикации")}
        >
          {localizedPrevious ? (
            <a
              href={articlePath(
                localizedPrevious.id,
                localizedPrevious.title,
                localizedPrevious.sectionId,
                localizedPrevious.slug
              )}
              onClick={(event) => {
                if (!shouldUseClientNavigation(event)) return;
                event.preventDefault();
                openAnother(localizedPrevious);
              }}
            >
              <small>{t("Предыдущий материал")}</small>
              <strong>← {localizedPrevious.title}</strong>
            </a>
          ) : (
            <span />
          )}
          {localizedNext && (
            <a
              href={articlePath(
                localizedNext.id,
                localizedNext.title,
                localizedNext.sectionId,
                localizedNext.slug
              )}
              onClick={(event) => {
                if (!shouldUseClientNavigation(event)) return;
                event.preventDefault();
                openAnother(localizedNext);
              }}
            >
              <small>{t("Следующий материал")}</small>
              <strong>{localizedNext.title} →</strong>
            </a>
          )}
        </nav>
      </div>

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
                articleIllustrationAlt(
                  language,
                  displayArticle.title,
                  activeMediaIndex + 1
                )
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
