import { load } from "cheerio";
import { artifactPath, PWA_SCOPE } from "./pwa-artifact.mjs";

const JOURNAL_ORIGIN = "https://probpera.ru";
// Brand and opening pairs retain the existing interface copy.
// Additional recovery text remains a draft; generation never supplies approval.
export const PWA_SHELL_COPY = Object.freeze({
  source: "authored-interface-and-ai-draft", reviewStatus: "draft", productionReady: false,
  locales: Object.freeze({
    ru: Object.freeze({
      brand: "Литературная планета", opening: "Открываем «Литературную планету»…", ogLocale: "ru_RU",
      language: "Русский",
      recovery: "Если приложение не открывается",
      recoveryHelp: "Попробуйте открыть приложение снова. Если не помогло, проверьте подключение к интернету и настройки браузера.",
      noScript: "Для работы приложения нужен JavaScript. Включите его в настройках браузера, затем откройте приложение снова.",
      notFound: "Страница не найдена. Вернитесь к «Литературной планете».",
      open: "Открыть «Литературную планету»",
    }),
    en: Object.freeze({
      brand: "Literary Planet", opening: "Opening Literary Planet…", ogLocale: "en_US",
      language: "English",
      recovery: "If the app does not open",
      recoveryHelp: "Try opening the app again. If that does not help, check your internet connection and browser settings.",
      noScript: "The app needs JavaScript. Enable it in your browser settings, then open the app again.",
      notFound: "Page not found. Return to Literary Planet.",
      open: "Open Literary Planet",
    }),
  }),
});
const COPY = PWA_SHELL_COPY.locales;
const LAUNCH_ORANGE = "#f67518";
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

const SHELL_CSS = `/* Temporary markup inside the canonical React root; no scene or animation. */
html[data-react-shell]{background:${LAUNCH_ORANGE}}
html[data-react-shell]>body{margin:0}
html[data-react-shell]>body:has(>#root>[data-pwa-startup-shell]){background:${LAUNCH_ORANGE}}
.pwa-startup{box-sizing:border-box;position:relative;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:calc(env(safe-area-inset-top,0px) + 96px) calc(env(safe-area-inset-right,0px) + 28px) calc(env(safe-area-inset-bottom,0px) + 48px) calc(env(safe-area-inset-left,0px) + 28px);color:#1a062b;background:${LAUNCH_ORANGE};background-image:radial-gradient(ellipse at 38% 30%,rgb(255 209 140 / 30%),transparent 65%);font:1rem/1.5 system-ui,sans-serif}
.pwa-startup *{box-sizing:border-box}
.pwa-startup-logo{position:absolute;top:calc(env(safe-area-inset-top,0px) + 20px);left:calc(env(safe-area-inset-left,0px) + 24px);display:block;width:56px;height:56px;object-fit:contain}
.pwa-startup-copy{width:min(100%,32rem);min-width:0;text-align:center;overflow-wrap:anywhere}
.pwa-startup h1{margin:0;color:inherit;font-family:var(--font-editorial,Georgia,serif);font-size:clamp(2.25rem,8vw,4.5rem);font-weight:500;line-height:1.08;letter-spacing:-.035em;text-wrap:balance}
.pwa-startup [data-pwa-language-fragment]{display:block}
.pwa-startup [data-pwa-language-fragment]+[data-pwa-language-fragment]{margin-top:.75rem}
.pwa-startup-status{margin:1.5rem 0 0;font-size:.875rem}
.pwa-startup-recovery{margin-top:2rem;text-align:start;font-size:.875rem}
.pwa-startup-recovery summary{min-width:44px;min-height:44px;padding:.625rem .75rem;cursor:pointer;text-decoration:underline;text-underline-offset:.2em}
.pwa-startup-recovery p{margin:.75rem 0}
.pwa-startup-links{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem;margin:1rem 0 0;padding:0;list-style:none}
.pwa-startup a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:.5rem .75rem;border:2px solid currentColor;border-radius:.5rem;color:inherit;background:transparent;text-decoration:underline;text-underline-offset:.2em}
.pwa-startup a:focus-visible,.pwa-startup summary:focus-visible{outline:3px solid #4b087c;outline-offset:3px}
.pwa-startup-noscript{margin-top:1.5rem;text-align:start}
.pwa-startup-copy:has(>noscript>.pwa-startup-noscript)>.pwa-startup-status{display:none}
@media(prefers-reduced-motion:reduce){.pwa-startup,.pwa-startup *{animation:none;transition:none;scroll-behavior:auto}}
@media(forced-colors:active){html[data-react-shell],html[data-react-shell]>body:has(>#root>[data-pwa-startup-shell]),.pwa-startup{color:CanvasText;background:Canvas}.pwa-startup a{color:LinkText;border-color:LinkText}.pwa-startup a:focus-visible,.pwa-startup summary:focus-visible{outline-color:Highlight}}
`;

function localizedText($, target, key, locale) {
  if (locale) target.text(COPY[locale][key]);
  else for (const language of ["ru", "en"]) {
    target.append($("<span>").attr({ lang: language, "data-pwa-language-fragment": "" }).text(COPY[language][key]));
  }
  return target;
}

function recoveryLinks($, locale) {
  const links = $("<ul>").attr("class", "pwa-startup-links");
  for (const language of locale ? [locale] : ["ru", "en"]) {
    links.append($("<li>").append($("<a>").attr({
      href: `${PWA_SCOPE}${language}/`, lang: language, hreflang: language,
    }).text(locale ? COPY[language].open : COPY[language].language)));
  }
  return links;
}

function shellHtml({ locale, notFound, resources, logo, icon192, icon512 }) {
  const $ = load("<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>");
  const copy = locale ? COPY[locale] : null;
  const name = copy?.brand ?? NEUTRAL_NAME;
  const title = notFound ? `404 | ${name}` : name;
  const suffix = notFound ? "404.html" : "";
  const pagePath = `${PWA_SCOPE}${locale ? `${locale}/` : ""}${suffix}`;
  const manifestPath = `${PWA_SCOPE}${locale ? `${locale}/` : ""}manifest.webmanifest`;
  // An empty HTML language denotes unknown until the existing provider resolves
  // saved/system preferences. Every neutral-entry text fragment declares its own.
  $("html").attr({ lang: locale ?? "", "data-react-shell": "" });
  // Body inherits HTML language; a fixed body value would mask later RU/EN
  // switches made by the existing PwaLocaleMetadata consumer.
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
  add("meta", { name: "theme-color", content: LAUNCH_ORANGE });
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

  const main = $("<main>").attr({ class: "pwa-startup", "data-pwa-startup-shell": notFound ? "not-found" : "loading" });
  main.append($("<img>").attr({ class: "pwa-startup-logo", src: logo, width: "56", height: "56", alt: "", "aria-hidden": "true" }));
  const content = $("<div>").attr("class", "pwa-startup-copy");
  content.append(localizedText($, $("<h1>"), "brand", locale));
  if (notFound) {
    content.append($("<p>").text("404"));
    content.append(localizedText($, $("<p>"), "notFound", locale));
    content.append(recoveryLinks($, locale));
  } else {
    content.append(localizedText($, $("<p>").attr({ class: "pwa-startup-status", role: "status", "aria-live": "polite", "aria-atomic": "true" }), "opening", locale));
    // Native <details> works even if the canonical module never loads. It makes
    // no network diagnosis and adds neither a timer nor an executable fallback.
    const recovery = $("<details>").attr({ class: "pwa-startup-recovery", "data-pwa-startup-recovery": "" });
    recovery.append(localizedText($, $("<summary>"), "recovery", locale));
    recovery.append(localizedText($, $("<p>"), "recoveryHelp", locale));
    recovery.append(recoveryLinks($, locale));
    content.append(recovery);
    const noScript = $("<div>").attr({ class: "pwa-startup-noscript", "data-pwa-startup-noscript": "" });
    noScript.append(localizedText($, $("<p>"), "noScript", locale));
    content.append($("<noscript>").append(noScript));
  }
  main.append(content);
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
    background_color: LAUNCH_ORANGE, theme_color: LAUNCH_ORANGE,
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
