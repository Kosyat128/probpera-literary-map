import { load } from "cheerio";
import { artifactPath, PWA_SCOPE } from "./pwa-artifact.mjs";

const JOURNAL_ORIGIN = "https://probpera.ru";
// Exact existing interface copy in src/i18n/InterfaceLanguage.tsx.
const COPY = Object.freeze({
  ru: { brand: "Литературная планета", journal: "Читать журнал", ogLocale: "ru_RU" },
  en: { brand: "Literary Planet", journal: "Read the journal", ogLocale: "en_US" },
});
const NEUTRAL_NAME = `${COPY.ru.brand} / ${COPY.en.brand}`;

function scopedAsset(value) {
  if (typeof value !== "string" || !value.startsWith(PWA_SCOPE)) {
    throw new Error("PWA shell resource must be inside /planet/");
  }
  artifactPath(value.slice(PWA_SCOPE.length));
  return value;
}

function builtResources(builtHtml) {
  if (typeof builtHtml !== "string" || !builtHtml.trim() || builtHtml.length > 2_000_000) {
    throw new Error("Expected a bounded Vite-built canonical HTML document");
  }
  const $ = load(builtHtml);
  if ($("#root").length !== 1) throw new Error("Canonical HTML must have one #root");
  const resources = [];
  let entryCount = 0;
  $("script").each((_, node) => {
    const script = $(node);
    // Site structured data has no place in this unpublished app shell.
    if (script.attr("type") === "application/ld+json") return;
    if (script.attr("type") !== "module" || !script.attr("src") || script.text().trim()) {
      throw new Error("PWA shell requires external Vite modules without inline JavaScript");
    }
    const src = scopedAsset(script.attr("src"));
    if (!src.endsWith(".js")) throw new Error("Expected a built JavaScript entry");
    entryCount += 1;
    resources.push({ tag: "script", attrs: { type: "module", src, crossorigin: "" } });
  });
  if (entryCount !== 1) throw new Error("Canonical HTML must have one Vite module entry");
  $("link").each((_, node) => {
    const link = $(node);
    const rel = (link.attr("rel") ?? "").toLowerCase();
    if (!["stylesheet", "modulepreload", "preload"].includes(rel)) return;
    const href = scopedAsset(link.attr("href"));
    const attrs = { rel, href };
    for (const name of ["as", "type", "media", "integrity", "crossorigin", "fetchpriority"]) {
      if (link.attr(name) !== undefined) attrs[name] = link.attr(name);
    }
    resources.push({ tag: "link", attrs });
  });
  return resources;
}

const SHELL_CSS = `/* Temporary markup inside the canonical React root. */
.pwa-startup{box-sizing:border-box;min-height:100svh;padding:max(1rem,env(safe-area-inset-top)) max(1rem,env(safe-area-inset-right)) max(1rem,env(safe-area-inset-bottom)) max(1rem,env(safe-area-inset-left));color:#262029;background:#fff;font:1rem/1.5 system-ui,sans-serif}
.pwa-startup *{box-sizing:border-box}
.pwa-startup-brand{display:flex;align-items:center;gap:.75rem;max-width:42rem}
.pwa-startup-logo{display:block;width:48px;height:48px;flex:none;object-fit:contain}
.pwa-startup h1{margin:0;font-size:clamp(1.25rem,4vw,1.75rem);line-height:1.25}
.pwa-startup-links{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem;padding:0;list-style:none}
.pwa-startup a{display:inline-flex;align-items:center;min-height:44px;padding:.5rem .75rem;border:2px solid #f67518;border-radius:.5rem;color:#262029;background:#fff;text-decoration:underline;text-underline-offset:.2em}
.pwa-startup a:focus-visible{outline:3px solid #4b087c;outline-offset:3px}
.pwa-startup-status{margin:1.5rem 0 0;font-size:1.25rem}
@media(forced-colors:active){.pwa-startup a{border-color:ButtonText}}
`;

function shellHtml({ locale, notFound, resources, logo, icon192, icon512 }) {
  const $ = load("<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>");
  const copy = locale ? COPY[locale] : null;
  const name = copy?.brand ?? NEUTRAL_NAME;
  const title = notFound ? `404 | ${name}` : name;
  const suffix = notFound ? "404.html" : "";
  const pagePath = `${PWA_SCOPE}${locale ? `${locale}/` : ""}${suffix}`;
  const manifestPath = `${PWA_SCOPE}${locale ? `${locale}/` : ""}manifest.webmanifest`;
  $("html").attr({ lang: locale ?? "ru", "data-react-shell": "" });
  if (locale) $("html").attr("data-route-language", locale);
  else $("html").attr("data-pwa-neutral-entry", "");

  const add = (tag, attrs, content) => {
    const node = $(`<${tag}>`).attr(attrs);
    if (content !== undefined) node.text(content);
    $("head").append(node);
  };
  add("meta", { charset: "UTF-8" });
  add("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0, viewport-fit=cover" });
  add("meta", { name: "robots", content: "noindex,nofollow" });
  add("meta", { name: "referrer", content: "strict-origin-when-cross-origin" });
  add("meta", { name: "theme-color", content: "#f67518" });
  add("meta", { name: "description", content: name });
  add("title", {}, title);
  add("link", { rel: "canonical", href: `${JOURNAL_ORIGIN}${pagePath}` });
  for (const language of ["ru", "en"]) {
    add("link", {
      rel: "alternate", hreflang: language,
      href: `${JOURNAL_ORIGIN}${PWA_SCOPE}${language}/${suffix}`,
    });
  }
  add("link", { rel: "alternate", hreflang: "x-default", href: `${JOURNAL_ORIGIN}${PWA_SCOPE}${suffix}` });
  add("link", { rel: "manifest", href: manifestPath });
  add("link", { rel: "icon", type: "image/png", href: icon192 });
  add("link", { rel: "apple-touch-icon", href: icon192 });
  for (const [property, content] of Object.entries({
    "og:type": "website", "og:title": title, "og:site_name": name,
    "og:description": name, "og:url": `${JOURNAL_ORIGIN}${pagePath}`,
    "og:image": `${JOURNAL_ORIGIN}${icon512}`, "og:image:alt": name,
  })) add("meta", { property, content });
  if (locale) {
    add("meta", { property: "og:locale", content: copy.ogLocale });
    add("meta", { property: "og:locale:alternate", content: COPY[locale === "ru" ? "en" : "ru"].ogLocale });
  }
  for (const [key, content] of Object.entries({
    "twitter:card": "summary", "twitter:title": title,
    "twitter:description": name, "twitter:image": `${JOURNAL_ORIGIN}${icon512}`,
    "twitter:image:alt": name,
  })) add("meta", { name: key, content });
  // Static 404 recovery does not launch the app at an unknown URL.
  if (!notFound) for (const resource of resources) add(resource.tag, resource.attrs);
  add("link", { rel: "stylesheet", href: `${PWA_SCOPE}pwa-shell.css` });

  const main = $("<main>").attr({ class: "pwa-startup", "data-pwa-startup-shell": "" });
  const brand = $("<header>").attr("class", "pwa-startup-brand");
  brand.append($("<img>").attr({ class: "pwa-startup-logo", src: logo, width: "48", height: "48", alt: "" }));
  const heading = $("<h1>");
  if (locale) heading.text(name);
  else {
    heading.append($("<span>").attr("lang", "ru").text(COPY.ru.brand));
    heading.append(" / ");
    heading.append($("<span>").attr("lang", "en").text(COPY.en.brand));
  }
  brand.append(heading);
  main.append(brand);
  if (notFound) main.append($("<p>").attr("class", "pwa-startup-status").text("404"));
  const links = $("<ul>").attr("class", "pwa-startup-links");
  for (const language of locale ? [locale] : ["ru", "en"]) {
    if (!locale || notFound) links.append($("<li>").append(
      $("<a>").attr({ href: `${PWA_SCOPE}${language}/`, lang: language, hreflang: language }).text(COPY[language].brand)
    ));
    links.append($("<li>").append($("<a>").attr({
      href: `${JOURNAL_ORIGIN}/stati/`, lang: language, target: "_blank", rel: "noopener noreferrer",
    }).text(COPY[language].journal)));
  }
  main.append(links);
  $("#root").append(main);
  return `${$.html()}\n`;
}

function manifest(locale, icon192, icon512) {
  const name = locale ? COPY[locale].brand : NEUTRAL_NAME;
  return `${JSON.stringify({
    id: PWA_SCOPE,
    scope: PWA_SCOPE,
    start_url: `${PWA_SCOPE}${locale ? `${locale}/` : ""}`,
    name, short_name: name,
    ...(locale ? { lang: locale } : {}),
    dir: "ltr", display: "standalone",
    background_color: "#ffffff", theme_color: "#f67518",
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }, null, 2)}\n`;
}

/** Pure transformation. The caller verifies/copies assets and writes these files. */
export function generatePwaShellFiles({
  builtHtml,
  icon192 = "/planet/icons/icon-192.png",
  icon512 = "/planet/icons/icon-512.png",
  logo = "/planet/brand/probpera-logo.png",
}) {
  for (const asset of [icon192, icon512, logo]) {
    scopedAsset(asset);
    if (!asset.endsWith(".png")) throw new Error("PWA shell icons and logo must be canonical PNG assets");
  }
  const resources = builtResources(builtHtml);
  const files = { "pwa-shell.css": SHELL_CSS };
  for (const locale of [null, "ru", "en"]) {
    const prefix = locale ? `${locale}/` : "";
    files[`${prefix}index.html`] = shellHtml({ locale, notFound: false, resources, logo, icon192, icon512 });
    files[`${prefix}404.html`] = shellHtml({ locale, notFound: true, resources, logo, icon192, icon512 });
    files[`${prefix}manifest.webmanifest`] = manifest(locale, icon192, icon512);
  }
  return files;
}
