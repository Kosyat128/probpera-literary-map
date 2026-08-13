import {
  articleCatalog,
  type ArticleCatalogEntry,
} from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import { cmsSiteContent } from "../data/cms/site.generated";
import { cmsHomepageBlockStyle } from "../data/cms/homepageVisualSettings";
import { articlePath, journalPath } from "../utils/articleRoutes";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";
import { safePublicHref } from "../utils/publicHref";
import {
  cmsEntityMarker,
  cmsHomepageBlockFieldMarker,
} from "../cms/directEditBridge";

type HomepageBlock = {
  id: string;
  type: string;
  title: string;
  settings: Record<string, unknown>;
  displayOrder: number;
  backgroundStyle: string;
  backgroundImageUrl?: string;
  backgroundMediaId?: string | null;
};

function safeHref(value: unknown, fallback = "#journal") {
  return safePublicHref(value, fallback);
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

function articleAdminHref(article: ArticleCatalogEntry) {
  if (article.source === "cms" && article.id.startsWith("cms-")) {
    return `/articles/edit?id=${encodeURIComponent(article.id.slice(4))}`;
  }
  return `/articles?query=${encodeURIComponent(article.title)}`;
}

function blockAdminHref(block: HomepageBlock) {
  return `/homepage#block-${encodeURIComponent(block.id)}`;
}

function blockStyle(block: HomepageBlock) {
  return cmsHomepageBlockStyle(block.settings, block.backgroundImageUrl);
}

function blockBackgroundMarker(block: HomepageBlock) {
  return cmsHomepageBlockFieldMarker(
    block.id,
    "backgroundMediaId",
    block.backgroundImageUrl || "",
    {
      kind: "image",
      label: "Фоновое изображение блока",
      adminHref: blockAdminHref(block),
      mediaId: block.backgroundMediaId,
    }
  );
}

function BlockVisualTools({ block }: { block: HomepageBlock }) {
  const { t } = useInterfaceLanguage();
  return (
    <div className="cms-edit-block-tools" aria-label={t("Оформление блока")}>
      <button
        type="button"
        {...cmsHomepageBlockFieldMarker(
          block.id,
          "backgroundStyle",
          block.backgroundStyle,
          { label: "Стиль фона", adminHref: blockAdminHref(block) }
        )}
      >
        {t("Стиль")}
      </button>
      <button type="button" {...blockBackgroundMarker(block)}>
        {t("Фон")}
      </button>
    </div>
  );
}

function blockTextMarker(
  block: HomepageBlock,
  field: "title" | "eyebrow" | "description" | "copy" | "buttonText" | "buttonUrl",
  value: string,
  label: string,
  kind: "text" | "textarea" = "text"
) {
  return cmsHomepageBlockFieldMarker(block.id, field, value, {
    kind,
    label,
    adminHref: blockAdminHref(block),
  });
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
      {...blockBackgroundMarker(block)}
      style={blockStyle(block)}
    >
      <BlockVisualTools block={block} />
      <header>
        <div>
          <span
            className="section-kicker"
            {...blockTextMarker(
              block,
              "eyebrow",
              settingText(block.settings, "eyebrow"),
              "Надзаголовок блока"
            )}
          >
            {settingText(block.settings, "eyebrow") || t("Выбор редакции")}
          </span>
          <h2 {...blockTextMarker(block, "title", block.title, "Заголовок блока")}>
            {language === "ru" && block.title
              ? block.title
              : t("Новые публикации")}
          </h2>
          <p
            className={!settingText(block.settings, "description") ? "cms-edit-empty-field" : undefined}
            {...blockTextMarker(
              block,
              "description",
              settingText(block.settings, "description"),
              "Описание блока",
              "textarea"
            )}
          >
            {settingText(block.settings, "description")}
          </p>
        </div>
        <a
          href={safeHref(block.settings.buttonUrl, journalPath())}
          {...blockTextMarker(
            block,
            "buttonUrl",
            settingText(block.settings, "buttonUrl"),
            "Ссылка кнопки"
          )}
        >
          <span
            {...blockTextMarker(
              block,
              "buttonText",
              settingText(block.settings, "buttonText"),
              "Текст кнопки"
            )}
          >
            {settingText(block.settings, "buttonText") || t("Весь журнал")}
          </span>{" "}
          →
          <span className="cms-edit-href-handle" aria-hidden="true">{t("ссылка")}</span>
        </a>
      </header>
      <div className={block.type === "carousel" ? "is-carousel" : ""}>
        {articles.map((article) => (
          <article
            key={article.id}
            {...cmsEntityMarker(
              "article",
              article.id,
              article.title,
              articleAdminHref(article)
            )}
          >
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
  const copyField = settingText(block.settings, "copy") ? "copy" : "description";
  if (language === "en") return null;
  return (
    <section
      className={`cms-home-block cms-home-text is-${block.backgroundStyle}`}
      {...blockBackgroundMarker(block)}
      style={blockStyle(block)}
    >
      <BlockVisualTools block={block} />
      <span
        className="section-kicker"
        {...blockTextMarker(
          block,
          "eyebrow",
          settingText(block.settings, "eyebrow"),
          "Надзаголовок блока"
        )}
      >
        {settingText(block.settings, "eyebrow") || t("Проба Пера")}
      </span>
      <h2 {...blockTextMarker(block, "title", block.title, "Заголовок блока")}>
        {block.title}
      </h2>
      {html ? (
        <div
          {...cmsEntityMarker(
            "homepage-block",
            block.id,
            "Расширенный текст блока",
            blockAdminHref(block)
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(html) }}
        />
      ) : (
        <p
          className={!copy ? "cms-edit-empty-field" : undefined}
          {...blockTextMarker(
            block,
            copyField,
            copy,
            "Текст блока",
            "textarea"
          )}
        >
          {copy}
        </p>
      )}
      <a
        className={!settingText(block.settings, "buttonText") ? "cms-edit-empty-field" : undefined}
        href={safeHref(block.settings.buttonUrl)}
        {...blockTextMarker(
          block,
          "buttonUrl",
          settingText(block.settings, "buttonUrl"),
          "Ссылка кнопки"
        )}
      >
        <span
          {...blockTextMarker(
            block,
            "buttonText",
            settingText(block.settings, "buttonText"),
            "Текст кнопки"
          )}
        >
          {settingText(block.settings, "buttonText") || t("Открыть")}
        </span>{" "}
        →
        <span className="cms-edit-href-handle" aria-hidden="true">{t("ссылка")}</span>
      </a>
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
      {...blockBackgroundMarker(block)}
      style={blockStyle(block)}
    >
      <BlockVisualTools block={block} />
      <header>
        <span
          className="section-kicker"
          {...blockTextMarker(
            block,
            "eyebrow",
            settingText(block.settings, "eyebrow"),
            "Надзаголовок блока"
          )}
        >
          {settingText(block.settings, "eyebrow") || t("Навигация по журналу")}
        </span>
        <h2 {...blockTextMarker(block, "title", block.title, "Заголовок блока")}>
          {language === "ru" && block.title
            ? block.title
            : t("Темы и разделы")}
        </h2>
        <p
          className={!settingText(block.settings, "description") ? "cms-edit-empty-field" : undefined}
          {...blockTextMarker(
            block,
            "description",
            settingText(block.settings, "description"),
            "Описание блока",
            "textarea"
          )}
        >
          {settingText(block.settings, "description")}
        </p>
      </header>
      <div>
        {[...sections.entries()].map(([id, section]) => (
          <a href={journalPath(id)} key={id}>
            <strong>{section.label}</strong>
            <span>{number(section.count)}</span>
          </a>
        ))}
      </div>
      <a
        className={!settingText(block.settings, "buttonText") ? "cms-edit-empty-field" : undefined}
        href={safeHref(block.settings.buttonUrl, journalPath())}
        {...blockTextMarker(
          block,
          "buttonUrl",
          settingText(block.settings, "buttonUrl"),
          "Ссылка кнопки"
        )}
      >
        <span
          {...blockTextMarker(
            block,
            "buttonText",
            settingText(block.settings, "buttonText"),
            "Текст кнопки"
          )}
        >
          {settingText(block.settings, "buttonText") || t("Весь журнал")}
        </span>{" "}
        →
        <span className="cms-edit-href-handle" aria-hidden="true">{t("ссылка")}</span>
      </a>
    </section>
  );
}

function CalloutBlock({ block }: { block: HomepageBlock }) {
  const { language, t } = useInterfaceLanguage();
  const copy =
    settingText(block.settings, "copy") ||
    settingText(block.settings, "description");
  const copyField = settingText(block.settings, "copy") ? "copy" : "description";
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
      {...blockBackgroundMarker(block)}
      style={blockStyle(block)}
    >
      <BlockVisualTools block={block} />
      <span
        className="section-kicker"
        {...blockTextMarker(
          block,
          "eyebrow",
          settingText(block.settings, "eyebrow"),
          "Надзаголовок блока"
        )}
      >
        {settingText(block.settings, "eyebrow") || t("Специальный проект")}
      </span>
      <h2 {...blockTextMarker(block, "title", block.title, "Заголовок блока")}>
        {block.title}
      </h2>
      <p
        className={!copy ? "cms-edit-empty-field" : undefined}
        {...blockTextMarker(block, copyField, copy, "Описание блока", "textarea")}
      >
        {copy}
      </p>
      <a
        href={safeHref(block.settings.buttonUrl, defaultTarget)}
        {...blockTextMarker(
          block,
          "buttonUrl",
          settingText(block.settings, "buttonUrl"),
          "Ссылка кнопки"
        )}
      >
        <span
          {...blockTextMarker(
            block,
            "buttonText",
            settingText(block.settings, "buttonText"),
            "Текст кнопки"
          )}
        >
          {settingText(block.settings, "buttonText") || t("Открыть")}
        </span>{" "}
        →
        <span className="cms-edit-href-handle" aria-hidden="true">{t("ссылка")}</span>
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
      (block) =>
        !settingText(block.settings, "coreSectionKey") &&
        settingText(block.settings, "systemKey") !== "site-copy-overrides"
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
