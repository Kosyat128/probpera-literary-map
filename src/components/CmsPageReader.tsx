import { cmsSiteContent } from "../data/cms/site.generated";
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
  const updatedAt = page.updatedAt
    ? new Intl.DateTimeFormat("ru-RU", {
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
          />
          <span>
            <strong>Проба Пера</strong>
            <small>Литературный журнал и энциклопедия</small>
          </span>
        </a>
        <nav aria-label="Основная навигация">
          <a href={publicPath("#atlas")}>Карта</a>
          <a href={publicPath("#journal")}>Статьи</a>
          <a href={publicPath("#books")}>Книги</a>
          <CmsNavigationLinks location="header" />
        </nav>
      </header>
      <main className="cms-page-main">
        <a className="cms-page-back" href={publicPath("")}>
          ← На главную
        </a>
        <article>
          <header>
            <span className="section-kicker">Проба Пера</span>
            <h1>{page.title}</h1>
            {page.excerpt && <p>{page.excerpt}</p>}
            {updatedAt && <small>Обновлено {updatedAt}</small>}
          </header>
          <div
            className="cms-page-prose"
            dangerouslySetInnerHTML={{
              __html: sanitizeArticleHtml(page.contentHtml),
            }}
          />
        </article>
      </main>
      <footer className="cms-page-footer">
        <div>
          <strong>Проба Пера</strong>
          <p>Литературная экосистема, где страна, автор, книга и статья связаны.</p>
        </div>
        <CmsNavigationLinks location="footer" withHeading />
        <a href={publicPath("")}>Вернуться на главную →</a>
      </footer>
    </div>
  );
}
