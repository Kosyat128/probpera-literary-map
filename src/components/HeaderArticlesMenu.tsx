import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import {
  articlePath,
  journalPath,
  navigateToArticle,
  navigateToJournal,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import {
  translateInterfaceText,
  type InterfaceLanguage,
} from "../i18n/InterfaceLanguage";

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

function articlePublishedTime(article: ArticleCatalogEntry) {
  const machineTime = article.publishedAt
    ? new Date(article.publishedAt).getTime()
    : Number.NaN;
  return Number.isFinite(machineTime)
    ? machineTime
    : publishedTime(article.publishedLabel);
}

type Props = {
  language?: InterfaceLanguage;
};

export default function HeaderArticlesMenu({ language = "ru" }: Props) {
  const [articles, setArticles] = useState<ArticleCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const t = useCallback(
    (text: string) => translateInterfaceText(text, language),
    [language]
  );

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => cancelScheduledClose, [cancelScheduledClose]);

  const loadArticles = useCallback(() => {
    if (articles.length || loading) return;
    setLoading(true);
    import("../data/articles/catalog")
      .then(({ articleCatalog }) => setArticles(articleCatalog))
      .finally(() => setLoading(false));
  }, [articles.length, loading]);

  const localizedArticles = useMemo(
    () =>
      articles.flatMap((article) => {
        const localized = articleCatalogEntryForLanguage(article, language);
        return localized ? [localized] : [];
      }),
    [articles, language]
  );

  const featured = useMemo(() => {
    const sorted = [...localizedArticles].sort(
      (first, second) =>
        articlePublishedTime(second) - articlePublishedTime(first)
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
  }, [localizedArticles]);

  const closeMenu = (target: HTMLElement) => {
    target.closest("details")?.removeAttribute("open");
  };

  return (
    <details
      className="articles-menu"
      onPointerEnter={() => {
        cancelScheduledClose();
        loadArticles();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        const details = event.currentTarget;
        cancelScheduledClose();
        closeTimer.current = window.setTimeout(() => {
          if (!details.matches(":hover")) details.removeAttribute("open");
          closeTimer.current = null;
        }, 140);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.removeAttribute("open");
        }
      }}
      onFocusCapture={loadArticles}
      onToggle={(event) => {
        if (event.currentTarget.open) loadArticles();
      }}
    >
      <summary>
        {t("Статьи")} <span aria-hidden="true">⌄</span>
      </summary>
      <div className="articles-mega-menu">
        <header>
          <div>
            <span>{t("Редакционная витрина")}</span>
            <strong>{t("Свежие публикации")}</strong>
          </div>
          <p>
            {t(
              "Авторские статьи, рецензии, литературные истории и материалы о языке."
            )}
          </p>
        </header>

        {featured.lead ? (
          <div className="articles-mega-content">
            <a
              className="articles-mega-lead"
              href={articlePath(
                featured.lead.id,
                featured.lead.title,
                featured.lead.sectionId,
                featured.lead.slug
              )}
              onClick={(event) => {
                closeMenu(event.currentTarget);
                if (!shouldUseClientNavigation(event)) return;
                event.preventDefault();
                navigateToArticle(featured.lead);
              }}
            >
              {featured.lead.imageUrl && (
                <span className="articles-mega-lead-media" aria-hidden="true">
                  <span
                    style={{
                      backgroundImage: `url(${featured.lead.imageUrl})`,
                    }}
                  />
                  <img
                    src={featured.lead.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              )}
              <div>
                <small>{featured.lead.sectionLabel}</small>
                <strong>{featured.lead.title}</strong>
                <p>{featured.lead.description}</p>
                <em>
                  {featured.lead.readingMinutes} {t("мин. чтения")}
                </em>
              </div>
            </a>
            <section aria-label={t("Другие свежие статьи")}>
              {featured.more.map((article) => (
                <a
                  href={articlePath(
                    article.id,
                    article.title,
                    article.sectionId,
                    article.slug
                  )}
                  key={article.id}
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    if (!shouldUseClientNavigation(event)) return;
                    event.preventDefault();
                    navigateToArticle(article);
                  }}
                >
                  <small>{article.sectionLabel}</small>
                  <strong>{article.title}</strong>
                  <span>
                    {article.readingMinutes} {t("мин.")}
                  </span>
                </a>
              ))}
            </section>
          </div>
        ) : (
          <div className="articles-mega-loading">
            {loading
              ? t("Подключаем редакционный архив…")
              : language === "en" && articles.length > 0
                ? t("Пока нет опубликованных переводов на английский язык")
                : t("Наведите, чтобы открыть публикации")}
          </div>
        )}

        <footer>
          <span>
            {localizedArticles.length
              ? language === "en"
                ? `${localizedArticles.length} ${
                    localizedArticles.length === 1 ? "publication" : "publications"
                  } in the archive`
                : `${localizedArticles.length} материалов в архиве`
              : t("Полный архив журнала")}
          </span>
          <a
            href={journalPath()}
            onClick={(event) => {
              closeMenu(event.currentTarget);
              if (!shouldUseClientNavigation(event)) return;
              event.preventDefault();
              navigateToJournal();
            }}
          >
            {t("Все публикации")} <b aria-hidden="true">→</b>
          </a>
        </footer>
      </div>
    </details>
  );
}
