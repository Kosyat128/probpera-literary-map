import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePwaShellFiles } from "../../scripts/mobile/pwa-shell.mjs";

const edition = vi.hoisted(() => ({ controlled: true }));
vi.mock("../platform/distribution", () => ({
  get isControlledWebEdition() { return edition.controlled; },
  canonicalJournalOrigin: "https://probpera.ru",
}));

import { InterfaceLanguageProvider } from "../planet/localization";
import PwaLocaleMetadata, { syncPwaLocaleMetadata } from "./PwaLocaleMetadata";

const files = generatePwaShellFiles({
  builtHtml: '<!doctype html><html><head><script type="module" src="/planet/assets/main.js"></script></head><body><div id="root"></div></body></html>',
  icon512: "/planet/icons/canonical-derived-512.png",
});

// A small DOM contract adapter over the real generated HTML. Browser/Canvas
// identity is verified separately in the stage's real browser acceptance.
function documentFixture(html) {
  const $ = load(html);
  function wrap(node) {
    return {
      node,
      getAttribute: name => $(node).attr(name) ?? null,
      setAttribute: (name, value) => { $(node).attr(name, value); },
      removeAttribute: name => { $(node).removeAttr(name); },
      querySelectorAll: selector => $(node).find(selector).get().map(wrap),
      appendChild: child => { $(node).append(child.node); return child; },
      remove: () => { $(node).remove(); },
    };
  }
  const document = {
    head: wrap($("head")[0]), documentElement: wrap($("html")[0]),
    createElement: tag => wrap($(`<${tag}>`)[0]),
    get title() { return $("title").text(); },
    set title(value) { $("title").text(value); },
  };
  return { $, document, html: () => $.html() };
}

function browserFixture({ pathname = "/planet/ru/", html = files["ru/index.html"] } = {}) {
  const fixture = documentFixture(html);
  const address = new URL(`https://local-review.invalid${pathname}`);
  const state = Object.freeze({
    probperaAtlasImmersive: true,
    selection: Object.freeze({ country: "RU", writer: "canonical-writer", work: "canonical-work" }),
    existingNavigationMarker: "preserve",
  });
  const history = {
    state,
    replaceState: vi.fn((nextState, _, nextPath) => {
      history.state = nextState;
      address.href = new URL(nextPath, address).href;
    }),
    pushState: vi.fn(),
  };
  const target = {
    document: fixture.document, location: address, history,
    dispatchEvent: vi.fn(), addEventListener: vi.fn(),
    localStorage: { getItem: vi.fn(), setItem: vi.fn() },
    navigator: { languages: ["fr-FR"] },
  };
  vi.stubGlobal("window", target);
  vi.stubGlobal("document", fixture.document);
  return { ...fixture, target, state, address };
}

function headMetadata($) {
  return Object.fromEntries($("head meta").get().map(node => {
    const element = $(node);
    return [element.attr("name") ?? element.attr("property") ?? "charset", element.attr("content") ?? element.attr("charset")];
  }));

}

afterEach(() => { vi.unstubAllGlobals(); edition.controlled = true; });

describe("PWA metadata follows the existing interface locale", () => {
  it.each(["ru", "en"])("matches the generated %s metadata without touching the app body", language => {
    const fixture = browserFixture({ html: files["index.html"], pathname: "/planet/?country=RU&writer=Q123&work=a%2Fb&view=immersive#atlas" });
    const body = fixture.$("body").html();
    syncPwaLocaleMetadata(language);
    const expected = load(files[`${language}/index.html`]);
    expect(headMetadata(fixture.$)).toEqual(headMetadata(expected));
    expect(fixture.$("title").text()).toBe(expected("title").text());
    for (const selector of ['link[rel="canonical"]', 'link[rel="manifest"]', 'link[hreflang="ru"]', 'link[hreflang="en"]', 'link[hreflang="x-default"]']) {
      expect(fixture.$(selector)).toHaveLength(1);
      expect(fixture.$(selector).attr("href")).toBe(expected(selector).attr("href"));
    }
    expect(fixture.$("html").attr("lang")).toBe(language);
    expect(fixture.$("html").attr("data-route-language")).toBe(language);
    expect(fixture.$("html").attr("data-pwa-neutral-entry")).toBeUndefined();
    expect(fixture.$("body").html()).toBe(body);
    expect(fixture.target.history.state).toBe(fixture.state);
    expect(fixture.target.history.replaceState).toHaveBeenCalledExactlyOnceWith(
      fixture.state, "", `/planet/${language}/?country=RU&writer=Q123&work=a%2Fb&view=immersive#atlas`
    );
    expect(fixture.target.dispatchEvent).not.toHaveBeenCalled();
    expect(fixture.target.history.pushState).not.toHaveBeenCalled();
    expect(fixture.target.localStorage.getItem).not.toHaveBeenCalled();
    expect(fixture.target.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("round-trips locale while preserving exact query encoding, duplicate parameters and fragment", () => {
    const fixture = browserFixture({ pathname: "/planet/ru/?writer=x%2fy&book=one&book=two&q=a+b#writer%2Fselected" });
    syncPwaLocaleMetadata("en");
    syncPwaLocaleMetadata("ru");
    expect(fixture.address.pathname).toBe("/planet/ru/");
    expect(fixture.address.search).toBe("?writer=x%2fy&book=one&book=two&q=a+b");
    expect(fixture.address.hash).toBe("#writer%2Fselected");
    expect(fixture.target.history.state).toBe(fixture.state);
    expect(fixture.state.selection).toEqual({ country: "RU", writer: "canonical-writer", work: "canonical-work" });
    expect(fixture.target.history.replaceState).toHaveBeenCalledTimes(2);
    expect(fixture.target.dispatchEvent).not.toHaveBeenCalled();
    expect(fixture.target.addEventListener).not.toHaveBeenCalled();
  });

  it("is idempotent when strict effects repeat for an already resolved route", () => {
    const fixture = browserFixture();
    syncPwaLocaleMetadata("en");
    const resolved = fixture.html();
    syncPwaLocaleMetadata("en");
    expect(fixture.html()).toBe(resolved);
    expect(fixture.target.history.replaceState).toHaveBeenCalledTimes(1);
  });

  it("deduplicates owned metadata and repairs missing fields while preserving build image URLs", () => {
    const fixture = browserFixture();
    fixture.$('meta[property="og:locale"]').remove();
    fixture.$('link[hreflang="en"]').remove();
    fixture.$("head").append('<link rel="canonical" href="https://stale.invalid/"><meta name="twitter:title" content="stale">');
    syncPwaLocaleMetadata("en");
    expect(fixture.$('link[rel="canonical"]')).toHaveLength(1);
    expect(fixture.$('meta[name="twitter:title"]')).toHaveLength(1);
    expect(fixture.$('meta[property="og:locale"]').attr("content")).toBe("en_US");
    expect(fixture.$('link[hreflang="en"]').attr("rel")).toBe("alternate");
    expect(fixture.$('meta[property="og:image"]').attr("content")).toBe("https://probpera.ru/planet/icons/canonical-derived-512.png");
    expect(fixture.$('meta[name="twitter:image"]').attr("content")).toBe("https://probpera.ru/planet/icons/canonical-derived-512.png");
  });

  it.each(["/planet", "/planet/", "/planet/index.html", "/planet/en", "/planet/en/index.html"])("normalizes the recognized entry %s", pathname => {
    const fixture = browserFixture({ pathname });
    syncPwaLocaleMetadata("ru");
    expect(fixture.address.pathname).toBe("/planet/ru/");
  });

  it.each(["/", "/en/", "/planetary/", "/planet/stati/example/", "/planet/fr/", "/planet/en/404.html", "/planet/en/writer/id"])("does not rewrite the unrelated or unknown path %s", pathname => {
    const fixture = browserFixture({ pathname });
    const html = fixture.html();
    syncPwaLocaleMetadata("en");
    expect(fixture.html()).toBe(html);
    expect(fixture.target.history.replaceState).not.toHaveBeenCalled();
  });

  it("leaves public-site behavior unchanged even at a planet-shaped URL", () => {
    edition.controlled = false;
    const fixture = browserFixture();
    const html = fixture.html();
    syncPwaLocaleMetadata("en");
    expect(fixture.html()).toBe(html);
    expect(fixture.target.history.replaceState).not.toHaveBeenCalled();
  });

  it("does not choose a new language itself for invalid input", () => {
    const fixture = browserFixture();
    const html = fixture.html();
    syncPwaLocaleMetadata("fr");
    expect(fixture.html()).toBe(html);
    expect(fixture.target.history.replaceState).not.toHaveBeenCalled();
  });

  it("preserves null history state and performs no fallback navigation on a history failure", () => {
    const fixture = browserFixture();
    fixture.target.history.state = null;
    syncPwaLocaleMetadata("en");
    expect(fixture.target.history.replaceState.mock.calls[0][0]).toBeNull();
    const html = fixture.html();
    fixture.target.history.replaceState.mockImplementation(() => { throw new Error("History unavailable"); });
    expect(() => syncPwaLocaleMetadata("ru")).toThrow("History unavailable");
    expect(fixture.html()).toBe(html);
    expect(fixture.target.history.pushState).not.toHaveBeenCalled();
    expect(fixture.target.dispatchEvent).not.toHaveBeenCalled();
  });

  it("renders no markup and consumes the existing provider instead of owning language state", () => {
    expect(() => renderToStaticMarkup(createElement(PwaLocaleMetadata))).toThrow("InterfaceLanguageProvider");
    expect(renderToStaticMarkup(createElement(InterfaceLanguageProvider, null, createElement(PwaLocaleMetadata)))).toBe("");
    expect(() => syncPwaLocaleMetadata("en")).not.toThrow();
  });
});
