import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";

import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import type { BookArchiveEntry } from "../data/bookArchive";
import type { Country } from "../data/countries";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  useNearViewportActivation,
  type DeferredLoadStatus,
} from "./nearViewportActivation";

const BOOK_HASH_TARGETS = ["books"] as const;
const ARTICLE_HASH_TARGETS = ["journal"] as const;

type BookArchiveComponentProps = {
  books: BookArchiveEntry[];
  countries: Country[];
  onBookSelect: (book: BookArchiveEntry) => void;
  requestedBook?: BookArchiveEntry | null;
  requestedBookReturnFocus?: HTMLElement | null;
  onRequestedBookHandled?: () => void;
};

type BookArchiveComponent = ComponentType<BookArchiveComponentProps>;

let bookArchiveComponentPromise: Promise<BookArchiveComponent> | null = null;

function loadBookArchiveComponent() {
  if (bookArchiveComponentPromise) return bookArchiveComponentPromise;
  bookArchiveComponentPromise = import("../components/BookArchiveSection")
    .then((module) => module.default)
    .catch((error) => {
      bookArchiveComponentPromise = null;
      throw error;
    });
  return bookArchiveComponentPromise;
}

type DeferredBookArchiveProps = BookArchiveComponentProps & {
  archiveStatus: DeferredLoadStatus;
  forceLoad?: boolean;
  retryToken?: number;
  onLoadIntent: () => void;
  onRetryArchive: () => void;
  onStatusChange?: (status: DeferredLoadStatus) => void;
};

export function DeferredBookArchive({
  countries,
  archiveStatus,
  forceLoad = false,
  retryToken = 0,
  onLoadIntent,
  onRetryArchive,
  onStatusChange,
  ...componentProps
}: DeferredBookArchiveProps) {
  const { t } = useInterfaceLanguage();
  const [attempt, setAttempt] = useState(0);
  const [component, setComponent] =
    useState<BookArchiveComponent | null>(null);
  const [moduleStatus, setModuleStatus] =
    useState<DeferredLoadStatus>("idle");
  const { active, setActivationNode } = useNearViewportActivation({
    force: forceLoad,
    hashTargets: BOOK_HASH_TARGETS,
    rootMargin: "420px 0px",
    onActivate: onLoadIntent,
  });

  useEffect(() => {
    if (!active) return undefined;
    let current = true;
    setModuleStatus("loading");
    loadBookArchiveComponent().then(
      (loadedComponent) => {
        if (!current) return;
        setComponent(() => loadedComponent);
        setModuleStatus("ready");
      },
      () => {
        if (current) setModuleStatus("error");
      }
    );
    return () => {
      current = false;
    };
  }, [active, attempt, retryToken]);

  const effectiveStatus: DeferredLoadStatus = !active
    ? "idle"
    : moduleStatus === "error" || archiveStatus === "error"
      ? "error"
      : component && archiveStatus === "ready"
        ? "ready"
        : "loading";

  useEffect(() => {
    onStatusChange?.(effectiveStatus);
  }, [effectiveStatus, onStatusChange]);

  const retry = useCallback(() => {
    if (archiveStatus === "error") onRetryArchive();
    if (moduleStatus === "error") {
      setComponent(null);
      setAttempt((value) => value + 1);
    }
  }, [archiveStatus, moduleStatus, onRetryArchive]);

  const BookArchive = component;
  return (
    <div
      ref={setActivationNode}
      className="stage5-deferred-slot stage5-deferred-books"
      data-loading-status={effectiveStatus}
    >
      {BookArchive && archiveStatus === "ready" ? (
        <BookArchive
          {...componentProps}
          countries={countries}
        />
      ) : (
        <section
          className="book-archive-section stage5-loading-shell"
          id="books"
          aria-busy={effectiveStatus === "loading" || undefined}
          aria-labelledby="stage5-books-loading-title"
        >
          <div
            className="stage5-loading-shell__status book-archive-empty"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">✦</span>
            <strong id="stage5-books-loading-title">
              {effectiveStatus === "error"
                ? t("Книжный архив временно недоступен")
                : effectiveStatus === "idle"
                  ? t("Книжный архив загрузится при приближении")
                  : t("Собираем книжный архив…")}
            </strong>
            <p>
              {t(
                "Место полки уже зарезервировано, поэтому страница не сдвинется."
              )}
            </p>
            {effectiveStatus === "error" && (
              <button type="button" onClick={retry}>
                {t("Повторить загрузку")}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

type ArticleLibraryComponent = ComponentType<{ readerOnly?: boolean }>;

type LoadedArticleLibrary = {
  component: ArticleLibraryComponent;
  articleCatalog: typeof import("../data/articles/catalog")["articleCatalog"];
};

let articleLibraryPromise: Promise<LoadedArticleLibrary> | null = null;

function loadArticleLibrary() {
  if (articleLibraryPromise) return articleLibraryPromise;
  articleLibraryPromise = Promise.all([
    import("../components/ArticleLibrarySection"),
    import("../data/articles/catalog"),
  ])
    .then(([componentModule, catalogModule]) => ({
      component: componentModule.default,
      articleCatalog: catalogModule.articleCatalog,
    }))
    .catch((error) => {
      articleLibraryPromise = null;
      throw error;
    });
  return articleLibraryPromise;
}

type DeferredArticleLibraryProps = {
  forceLoad?: boolean;
  onArticleCountReady?: (count: number) => void;
  onStatusChange?: (status: DeferredLoadStatus) => void;
};

export function DeferredArticleLibrary({
  forceLoad = false,
  onArticleCountReady,
  onStatusChange,
}: DeferredArticleLibraryProps) {
  const { language, t } = useInterfaceLanguage();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedArticleLibrary | null>(null);
  const [status, setStatus] = useState<DeferredLoadStatus>("idle");
  const { active, setActivationNode } = useNearViewportActivation({
    force: forceLoad,
    hashTargets: ARTICLE_HASH_TARGETS,
    rootMargin: "360px 0px",
  });

  useEffect(() => {
    if (!active) return undefined;
    let current = true;
    setStatus("loading");
    loadArticleLibrary().then(
      (value) => {
        if (!current) return;
        setLoaded(value);
        setStatus("ready");
      },
      () => {
        if (current) setStatus("error");
      }
    );
    return () => {
      current = false;
    };
  }, [active, attempt]);

  useEffect(() => {
    onStatusChange?.(active ? status : "idle");
  }, [active, onStatusChange, status]);

  const localizedArticleCount = useMemo(
    () =>
      loaded?.articleCatalog.filter((article) =>
        articleCatalogEntryForLanguage(article, language)
      ).length ?? 0,
    [language, loaded]
  );

  useEffect(() => {
    if (loaded) onArticleCountReady?.(localizedArticleCount);
  }, [loaded, localizedArticleCount, onArticleCountReady]);

  const ArticleLibrary = loaded?.component;
  const effectiveStatus = active ? status : "idle";
  return (
    <div
      ref={setActivationNode}
      className="stage5-deferred-slot stage5-deferred-journal"
      data-loading-status={effectiveStatus}
    >
      {ArticleLibrary ? (
        <ArticleLibrary />
      ) : (
        <section
          className="article-library is-loading stage5-loading-shell"
          id="journal"
          aria-busy={status === "loading" || undefined}
          aria-labelledby="stage5-journal-loading-title"
        >
          <div
            className="stage5-loading-shell__status article-library-empty"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">✦</span>
            <strong id="stage5-journal-loading-title">
              {status === "error"
                ? t("Авторский архив временно недоступен")
                : effectiveStatus === "idle"
                  ? t("Журнал загрузится при приближении")
                  : t("Собираем авторский архив…")}
            </strong>
            <p>{t("Место журнала зарезервировано до его открытия.")}</p>
            {status === "error" && (
              <button
                type="button"
                onClick={() => {
                  setLoaded(null);
                  setAttempt((value) => value + 1);
                }}
              >
                {t("Повторить загрузку")}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

type GlobalSearchLoadingDialogProps = {
  error?: boolean;
  onClose: () => void;
  onRetry: () => void;
};

export function GlobalSearchLoadingDialog({
  error = false,
  onClose,
  onRetry,
}: GlobalSearchLoadingDialogProps) {
  const { t } = useInterfaceLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus({ preventScroll: true })
    );
    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
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
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose]);

  return (
    <div className="global-search-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="global-search stage5-global-search-shell"
        role="dialog"
        aria-modal="true"
        aria-busy={!error}
        aria-labelledby="stage5-global-search-loading-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="section-kicker">{t("Единый каталог")}</span>
            <h2 id="stage5-global-search-loading-title">
              {error
                ? t("Архив не удалось подключить")
                : t("Подключаем единый поиск…")}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="stage5-loading-shell__close"
            onClick={onClose}
            aria-label={t("Закрыть поиск")}
          >
            ×
          </button>
        </header>
        <div className="stage5-global-search-shell__status" role="status" aria-live="polite">
          <span aria-hidden="true">✦</span>
          <p>
            {error
              ? t("Проверьте соединение и повторите загрузку.")
              : t("Готовим страны, авторов, книги и публикации.")}
          </p>
          {error && (
            <button type="button" onClick={onRetry}>
              {t("Повторить загрузку")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
