import type { CSSProperties } from "react";

import {
  articleCatalog,
  type ArticleCatalogEntry,
} from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import { cmsSiteContent } from "../data/cms/site.generated";
import { articlePath, journalPath } from "../utils/articleRoutes";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";

type HomepageBlock = {
  id: string;
  type: string;
  title: string;
  settings: Record<string, unknown>;
  displayOrder: number;
  backgroundStyle: string;
  backgroundImageUrl?: string;
};

function safeHref(value: unknown, fallback = "#journal") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^(https:\/\/|mailto:|\/|#)/iu.test(trimmed) ? trimmed : fallback;
}

function settingText(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return typeof value === "string" ? value.trim() : "";
}

function settingList(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function articleLink(article: ArticleCatalogEntry) {
  return articlePath(
    article.id,
    article.title,
    article.sectionId,
    article.slug
  );
}

function selectBlockArticles(block: HomepageBlock) {
  const requestedIds = new Set(settingList(block.settings, "articleIds"));
  const requested = requestedIds.size
    ? articleCatalog.filter(
        (article) =>
          requestedIds.has(article.id) ||
          Boolean(article.legacyId && requestedIds.has(article.legacyId))
      )
    : [];
  if (requested.length) return requested.slice(0, 8);

  const cmsHomepageArticles = articleCatalog.filter(
    (article) => article.source === "cms" && article.showOnHomepage
  );
  const candidates = cmsHomepageArticles.length
    ? cmsHomepageArticles
    : articleCatalog;
  return candidates.slice(0, block.type === "carousel" ? 8 : 6);
}

function ArticleBlock({ block }: { block: HomepageBlock }) {
  const { language, t } = useInterfaceLanguage();
  const articles = selectBlockArticles(block).flatMap((article) => {
    const localized = articleCatalogEntryForLanguage(article, language);
    return localized ? [localized] : [];
  });
  if (!articles.length) return null;
  return (
    <section
      className={`cms-home-block cms-home-articles is-${block.backgroundStyle}`}
      style={
        block.backgroundImageUrl
          ? ({
              "--cms-background-image": `url(${block.backgroundImageUrl})`,
            } as CSSProperties)
          : undefined
      }
    >
      <header>
        <div>
          <span className="section-kicker">{t("Выбор редакции")}</span>
          <h2>
            {language === "ru" && block.title
              ? block.title
              : t("Новые публикации")}
          </h2>
        </div>
        <a href={journalPath()}>{t("Весь журнал")} →</a>
      </header>
      <div className={block.type === "carousel" ? "is-carousel" : ""}>
        {articles.map((article) => (
          <article key={article.id}>
            <a href={articleLink(article)}>
              {article.imageUrl && (
                <img
                  src={article.imageUrl}
                  alt={article.imageAlt || ""}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span>{article.sectionLabel}</span>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <small>{article.readingMinutes} {t("мин. чтения")}</small>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ block }: { block: HomepageBlock }) {
  const { language, t } = useInterfaceLanguage();
  const html = settingText(block.settings, "html");
  const copy =
    settingText(block.settings, "copy") ||
    settingText(block.settings, "description");
  if (language === "en") return null;
  return (
    <section
      className={`cms-home-block cms-home-text is-${block.backgroundStyle}`}
      style={
        block.backgroundImageUrl
          ? ({
              "--cms-background-image": `url(${block.backgroundImageUrl})`,
            } as CSSProperties)
          : undefined
      }
    >
      <span className="section-kicker">
        {settingText(block.settings, "eyebrow") || t("Проба Пера")}
      </span>
      <h2>{block.title}</h2>
      {html ? (
        <div
          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(html) }}
        />
      ) : (
        copy && <p>{copy}</p>
      )}
      {settingText(block.settings, "buttonText") && (
        <a href={safeHref(block.settings.buttonUrl)}>
          {settingText(block.settings, "buttonText")} →
        </a>
      )}
    </section>
  );
}

function CategoryBlock({ block }: { block: HomepageBlock }) {
  const { language, t, number } = useInterfaceLanguage();
  const sections = new Map<string, { label: string; count: number }>();
  articleCatalog.forEach((article) => {
    const localized = articleCatalogEntryForLanguage(article, language);
    if (!localized) return;
    const current = sections.get(localized.sectionId);
    sections.set(localized.sectionId, {
      label: localized.sectionLabel,
      count: (current?.count || 0) + 1,
    });
  });
  return (
    <section
      className={`cms-home-block cms-home-categories is-${block.backgroundStyle}`}
    >
      <header>
        <span className="section-kicker">{t("Навигация по журналу")}</span>
        <h2>
          {language === "ru" && block.title
            ? block.title
            : t("Темы и разделы")}
        </h2>
      </header>
      <div>
        {[...sections.entries()].map(([id, section]) => (
          <a href={journalPath(id)} key={id}>
            <strong>{section.label}</strong>
            <span>{number(section.count)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function CalloutBlock({ block }: { block: HomepageBlock }) {
  const { language, t } = useInterfaceLanguage();
  const copy =
    settingText(block.settings, "copy") ||
    settingText(block.settings, "description");
  const defaultTarget =
    block.type === "literary-map"
      ? "#atlas"
      : block.type === "awards"
        ? journalPath("awards")
        : "#journal";
  if (language === "en") return null;
  return (
    <section
      className={`cms-home-block cms-home-callout is-${block.backgroundStyle}`}
    >
      <span className="section-kicker">{t("Специальный проект")}</span>
      <h2>{block.title}</h2>
      {copy && <p>{copy}</p>}
      <a href={safeHref(block.settings.buttonUrl, defaultTarget)}>
        {settingText(block.settings, "buttonText") || t("Открыть")} →
      </a>
    </section>
  );
}

export function CmsHomepageBlocks() {
  const { t } = useInterfaceLanguage();
  const blocks = [
    ...(cmsSiteContent.homepageBlocks as readonly HomepageBlock[]),
  ]
    .filter(
      (block) => !settingText(block.settings, "coreSectionKey")
    )
    .sort((first, second) => first.displayOrder - second.displayOrder);
  if (!blocks.length) return null;

  return (
    <div className="cms-homepage-region" aria-label={t("Редакционные блоки")}>
      {blocks.map((block) => {
        if (
          [
            "article-grid",
            "carousel",
            "editors-choice",
            "popular",
            "latest",
          ].includes(block.type)
        ) {
          return <ArticleBlock block={block} key={block.id} />;
        }
        if (block.type === "categories") {
          return <CategoryBlock block={block} key={block.id} />;
        }
        if (["text", "hero", "subscription"].includes(block.type)) {
          return <TextBlock block={block} key={block.id} />;
        }
        return <CalloutBlock block={block} key={block.id} />;
      })}
    </div>
  );
}
