import { cmsSiteContent } from "../data/cms/site.generated";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { sanitizeArticleHtml } from "../utils/sanitizeArticleHtml";
import { CmsNavigationLinks, CmsPageBanners } from "./CmsSiteChrome";
import { cmsPageFieldMarker } from "../cms/directEditBridge";

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
  const { language, t } = useInterfaceLanguage();
  const updatedAt = formatCmsUpdatedAt(page.updatedAt, language);

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
              className="cms-page-prose"
              {...cmsPageFieldMarker(
                page.id,
                "contentHtml",
                page.contentHtml,
                { kind: "richtext", label: "Содержимое страницы" }
              )}
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
