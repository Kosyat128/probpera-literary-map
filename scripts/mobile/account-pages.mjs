import { load } from "cheerio";
import { planetAccountCopy } from "../../src/pwa/accountCopy.ts";
import { generatePublicLocalePages } from "./public-locale-pages.mjs";

const origin = "https://probpera.ru";

/** Public account entry HTML shares the canonical site's built module and auth.
 * It never embeds a token, account, legal disclosure or configured server claim. */
export function generatePlanetAccountPages({ builtHtml }) {
  const homes = generatePublicLocalePages({ builtHtml });
  const files = {}, routes = [], excluded = [];
  for (const locale of ["ru", "en"]) for (const mode of ["access", "deletion"]) {
    const name = mode === "access" ? "planet-account" : "delete-account";
    const pathname = `/${locale}/${name}/`; const canonical = origin + pathname;
    const copy = planetAccountCopy.locales[locale]; const title = mode === "access" ? copy.access : copy.deletion;
    const description = mode === "access" ? copy.intro : copy.deletionIntro;
    const $ = load(homes.files[`${locale}/index.html`]);
    $("html").attr({ "data-planet-account-entry": mode, "data-copy-review": planetAccountCopy.reviewStatus });
    $("title").text(title);
    $('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]').attr("content", description);
    $('meta[property="og:title"],meta[name="twitter:title"]').attr("content", title);
    $('meta[name="robots"]').attr("content", "noindex,nofollow");
    $('link[rel="canonical"]').attr("href", canonical); $('meta[property="og:url"]').attr("content", canonical);
    for (const language of ["ru", "en"]) $(`link[hreflang="${language}"]`).attr("href", `${origin}/${language}/${name}/`);
    $('script[type="application/ld+json"]').remove();
    const schema = { "@context": "https://schema.org", "@type": "WebPage", "@id": canonical + "#webpage",
      url: canonical, name: title, description, inLanguage: locale, isPartOf: { "@id": origin + "/#website" } };
    $("head").append($("<script>").attr({ type: "application/ld+json", "data-planet-account-structured-data": "" })
      .text(JSON.stringify(schema).replace(/</gu, "\\u003c")));
    const main = $("<main>").attr({ class: "pwa-access static-article-fallback", "data-planet-account-fallback": mode });
    const article = $("<article>"); article.append($("<h1>").text(title), $("<p>").text(description));
    if (mode === "deletion") article.append($("<p>").text(copy.disclosureUnavailable));
    const nav = $("<nav>").attr("aria-label", locale === "ru" ? "Основная навигация" : "Main navigation");
    nav.append($("<a>").attr("href", `/${locale}/${mode === "access" ? "delete-account" : "planet-account"}/`).text(mode === "access" ? copy.deleteLink : copy.accessLink));
    nav.append($("<a>").attr("href", "/stati/").text(copy.journal), $("<a>").attr("href", "mailto:probperasite@yandex.ru").text(copy.support));
    article.append(nav); main.append(article); $("#root").empty().append(main);
    const file = `${locale}/${name}/index.html`; files[file] = $.html() + "\n";
    routes.push({ locale, mode, pathname, file, canonical, indexable: false });
    excluded.push({ url: canonical, locale, kind: "account", reason: "private-account-page-never-indexable" });
  }
  return { files, routes, excluded, releaseReady: false };
}
