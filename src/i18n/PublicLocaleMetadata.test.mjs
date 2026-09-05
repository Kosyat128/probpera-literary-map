import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePublicLocalePages } from "../../scripts/mobile/public-locale-pages.mjs";

const edition = vi.hoisted(() => ({ controlled: false }));
vi.mock("../platform/distribution", () => ({
  get isControlledWebEdition() { return edition.controlled; },
  canonicalJournalOrigin: "https://probpera.ru",
}));

import { InterfaceLanguageProvider } from "./InterfaceLanguage";
import PublicLocaleMetadata, { syncPublicLocaleMetadata } from "./PublicLocaleMetadata";

const { files } = generatePublicLocalePages({ builtHtml: `<!doctype html><html><head>
<script type="module" src="/assets/main.js"></script><link rel="manifest" href="/site.webmanifest">
<link rel="icon" href="/brand/probpera-logo.png"><meta property="og:image" content="/og-v3.webp">
<meta name="theme-color" content="#4b087c"></head><body><div id="root"></div></body></html>` });

// DOM contract tests over generated HTML; no simulated WebGL/Canvas claims.
function fixture(pathname = "/ru/", html = files["ru/index.html"]) {
  const $ = load(html);
  function wrap(node) {
    return {
      node,
      get parentNode() { return node.parent ? wrap(node.parent) : null; },
      get textContent() { return $(node).text(); },
      set textContent(value) { $(node).text(value); },
      getAttribute: name => $(node).attr(name) ?? null,
      setAttribute: (name, value) => { $(node).attr(name, value); },
      querySelector: selector => { const child = $(node).find(selector)[0]; return child ? wrap(child) : null; },
      querySelectorAll: selector => $(node).find(selector).get().map(wrap),
      appendChild: child => { $(node).append(child.node); return child; },
      remove: () => { $(node).remove(); },
    };
  }
  const document = {
    head: wrap($("head")[0]), body: wrap($("body")[0]), documentElement: wrap($("html")[0]),
    createElement: tag => wrap($(`<${tag}>`)[0]),
    get title() { return $("title").text(); },
    set title(value) { $("title").text(value); },
  };
  const location = new URL(`https://local-review.invalid${pathname}`);
  const state = Object.freeze({ atlas: Object.freeze({ country: "RU", writer: "Q123", work: "book-1" }), immersive: true });
  const history = {
    state,
    pushState: vi.fn(),
    replaceState: vi.fn((nextState, _, nextPath) => {
      history.state = nextState;
      location.href = new URL(nextPath, location).href;
    }),
  };
  const target = { document, location, history, dispatchEvent: vi.fn(), localStorage: { getItem: vi.fn(), setItem: vi.fn() } };
  vi.stubGlobal("window", target);
  return { $, html: () => $.html(), target, state };
}

function metadata($) {
  return Object.fromEntries($("head meta").get().map(node => [
    $(node).attr("name") ?? $(node).attr("property"), $(node).attr("content"),
  ]));
}

afterEach(() => { vi.unstubAllGlobals(); edition.controlled = false; });

describe("public localized entry metadata follows the existing provider", () => {
  it.each(["ru", "en"])("matches the %s generated metadata and changes no rendered content", language => {
    const current = fixture(language === "ru" ? "/en/?country=RU&writer=Q123&book=x%2Fy#atlas" : "/ru/?country=RU&writer=Q123&book=x%2Fy#atlas", files[language === "ru" ? "en/index.html" : "ru/index.html"]);
    const beforeBody = current.$("body").html();
    syncPublicLocaleMetadata(language);
    const expected = load(files[`${language}/index.html`]);
    expect(metadata(current.$)).toEqual(metadata(expected));
    expect(current.$("title").text()).toBe(expected("title").text());
    expect(current.$("html").attr("lang")).toBe(language);
    expect(current.$("html").attr("data-route-language")).toBe(language);
    expect(current.$("body").attr("lang")).toBe(language);
    expect(current.$("body").html()).toBe(beforeBody);
    expect(JSON.parse(current.$('script[data-public-locale-structured-data]').text()))
      .toEqual(JSON.parse(expected('script[data-public-locale-structured-data]').text()));
    for (const selector of ['link[rel="canonical"]', 'link[hreflang="ru"]', 'link[hreflang="en"]', 'link[hreflang="x-default"]']) {
      expect(current.$(selector)).toHaveLength(1);
      expect(current.$(selector).attr("href")).toBe(expected(selector).attr("href"));
    }
    expect(current.target.history.replaceState).toHaveBeenCalledExactlyOnceWith(current.state, "", `/${language}/?country=RU&writer=Q123&book=x%2Fy#atlas`);
    expect(current.target.history.state).toBe(current.state);
    expect(current.target.history.pushState).not.toHaveBeenCalled();
    expect(current.target.dispatchEvent).not.toHaveBeenCalled();
    expect(current.target.localStorage.getItem).not.toHaveBeenCalled();
    expect(current.target.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("preserves original public install identity and shared icon/image URLs", () => {
    const current = fixture();
    syncPublicLocaleMetadata("en");
    expect(current.$('link[rel="manifest"]').attr("href")).toBe("/site.webmanifest");
    expect(current.$('link[rel="icon"]').attr("href")).toBe("/brand/probpera-logo.png");
    expect(current.$('meta[property="og:image"]').attr("content")).toBe("https://probpera.ru/og-v3.webp");
    expect(current.$('meta[name="theme-color"]').attr("content")).toBe("#4b087c");
    expect(current.html()).not.toContain("/planet/");
  });

  it("retains exact selection encoding and history state during a RU/EN round trip", () => {
    const current = fixture("/ru/?book=a%2fb&book=b&q=a+b#writer%2Fcard");
    syncPublicLocaleMetadata("en");
    syncPublicLocaleMetadata("ru");
    expect(current.target.location.pathname).toBe("/ru/");
    expect(current.target.location.search).toBe("?book=a%2fb&book=b&q=a+b");
    expect(current.target.location.hash).toBe("#writer%2Fcard");
    expect(current.target.history.state).toBe(current.state);
    expect(current.target.dispatchEvent).not.toHaveBeenCalled();
  });

  it("does not create duplicate history entries when effects repeat", () => {
    const current = fixture();
    syncPublicLocaleMetadata("en");
    const resolved = current.html();
    syncPublicLocaleMetadata("en");
    expect(current.html()).toBe(resolved);
    expect(current.target.history.replaceState).toHaveBeenCalledTimes(1);
  });

  it("repairs missing or duplicated owned head fields", () => {
    const current = fixture();
    current.$('link[hreflang="en"]').remove();
    current.$('meta[property="og:locale"]').remove();
    current.$("head").append('<link rel="canonical" href="/stale/"><meta name="twitter:title" content="stale">');
    current.$("head").append('<script data-public-locale-structured-data type="application/ld+json">{"stale":true}</script>');
    syncPublicLocaleMetadata("en");
    expect(current.$('link[hreflang="en"]').attr("rel")).toBe("alternate");
    expect(current.$('meta[property="og:locale"]').attr("content")).toBe("en_US");
    expect(current.$('link[rel="canonical"]')).toHaveLength(1);
    expect(current.$('meta[name="twitter:title"]')).toHaveLength(1);
    expect(current.$('script[data-public-locale-structured-data]')).toHaveLength(1);
    expect(JSON.parse(current.$('script[data-public-locale-structured-data]').text())["@graph"][1].inLanguage).toBe("en");
  });

  it.each(["/", "/stati/", "/stati/o-literature/title/", "/stranitsy/about/", "/planet/ru/", "/en/stati/title/", "/english/", "/ru/404.html"])("preserves the existing route owner for %s", pathname => {
    const current = fixture(pathname);
    const html = current.html();
    syncPublicLocaleMetadata("en");
    expect(current.html()).toBe(html);
    expect(current.target.history.replaceState).not.toHaveBeenCalled();
  });

  it.each(["/ru", "/en", "/ru/index.html", "/en/index.html"])("canonicalizes the new entry alias %s", pathname => {
    const current = fixture(pathname);
    syncPublicLocaleMetadata("en");
    expect(current.target.location.pathname).toBe("/en/");
  });

  it("does not act in the controlled edition or resolve unsupported locales", () => {
    const current = fixture();
    const html = current.html();
    edition.controlled = true;
    syncPublicLocaleMetadata("en");
    edition.controlled = false;
    syncPublicLocaleMetadata("fr");
    expect(current.html()).toBe(html);
    expect(current.target.history.replaceState).not.toHaveBeenCalled();
  });

  it("renders no markup, requires the existing provider and is safe on the server", () => {
    expect(() => renderToStaticMarkup(createElement(PublicLocaleMetadata))).toThrow("InterfaceLanguageProvider");
    expect(renderToStaticMarkup(createElement(InterfaceLanguageProvider, null, createElement(PublicLocaleMetadata)))).toBe("");
    expect(() => syncPublicLocaleMetadata("en")).not.toThrow();
  });
});
