import { cmsSiteContent } from "../data/cms/site.generated";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";
import { CmsNavigationLinks } from "./CmsSiteChrome";

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

export function currentCmsPage() {
  const configuredBase = import.meta.env.BASE_URL.replace(/\/+$/u, "");
  let pathname = decodeURIComponent(window.location.pathname);
  if (configuredBase && pathname.startsWith(configuredBase)) {
    pathname = pathname.slice(configuredBase.length) || "/";
  }
  const match = pathname.match(/^\/stranitsy\/([a-z0-9][a-z0-9-]+)\/?$/iu);
  if (!match) return null;
  const pages = cmsSiteContent.pages as readonly CmsPage[];
  return pages.find((page) => page.slug === match[1]) || null;
}

export default function CmsPageReader({ page }: { page: CmsPage }) {
  const { language, t } = useInterfaceLanguage();
  const updatedAt = page.updatedAt
    ? new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(page.updatedAt))
    : "";

  return (
    <div className="cms-page-shell">
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
            <small>{t("Литературный журнал и энциклопедия")}</small>
          </span>
        </a>
        <nav aria-label={t("Основная навигация")}>
          <a href={publicPath("#atlas")}>{t("Карта")}</a>
          <a href={publicPath("#journal")}>{t("Статьи")}</a>
          <a href={publicPath("#books")}>{t("Книги")}</a>
          <CmsNavigationLinks location="header" />
        </nav>
      </header>
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
              <h1>{page.title}</h1>
              {page.excerpt && <p>{page.excerpt}</p>}
              {updatedAt && <small>{t("Обновлено")} {updatedAt}</small>}
            </header>
            <div
              className="cms-page-prose"
              dangerouslySetInnerHTML={{
                __html: sanitizeArticleHtml(page.contentHtml),
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
    </div>
  );
}
