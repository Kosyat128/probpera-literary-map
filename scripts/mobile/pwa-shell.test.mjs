import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { generatePwaShellFiles } from "./pwa-shell.mjs";

const builtHtml = `<!doctype html><html lang="ru" data-react-shell><head>
<title>Old journal title</title><meta name="description" content="Old journal description">
<link rel="canonical" href="https://probpera.ru/"><meta name="robots" content="index,follow">
<meta property="og:locale" content="ru_RU"><meta property="og:image" content="/planet/og-v3.webp">
<link rel="alternate" type="application/rss+xml" href="/planet/rss.xml">
<link rel="manifest" href="/planet/site.webmanifest">
<link rel="preconnect" href="https://old-cdn.invalid"><base href="https://old-cdn.invalid/">
<style data-home-prepaint>#root{visibility:hidden}</style>
<script type="application/ld+json">{"@context":"https://schema.org","name":"Old SEO"}</script>
<script type="module" crossorigin src="/planet/assets/main-a1.js"></script>
<link rel="modulepreload" crossorigin href="/planet/assets/vendor-b2.js">
<link rel="preload" href="/planet/fonts/canonical.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" crossorigin href="/planet/assets/main-c3.css">
</head><body onload="oldHandler()"><div id="root"><article data-static-seo>Old article fallback</article></div></body></html>`;

const copy = {
  ru: { brand: "Литературная планета", journal: "Читать журнал", og: "ru_RU" },
  en: { brand: "Literary Planet", journal: "Read the journal", og: "en_US" },
};

describe("isolated canonical PWA shell generation", () => {
  it("returns deterministic relative files without writing or changing the input", () => {
    const input = Object.freeze({ builtHtml });
    const files = generatePwaShellFiles(input);
    expect(Object.keys(files).sort()).toEqual([
      "404.html", "en/404.html", "en/index.html", "en/manifest.webmanifest",
      "index.html", "manifest.webmanifest", "pwa-shell.css",
      "ru/404.html", "ru/index.html", "ru/manifest.webmanifest",
    ]);
    expect(generatePwaShellFiles(input)).toEqual(files);
    expect(input.builtHtml).toBe(builtHtml);
  });

  it.each(["ru", "en"])("keeps %s metadata, accessible startup and route language consistent", locale => {
    const files = generatePwaShellFiles({ builtHtml });
    const $ = load(files[`${locale}/index.html`]);
    const other = locale === "ru" ? "en" : "ru";
    expect($("html").attr("lang")).toBe(locale);
    expect($("html").attr("data-route-language")).toBe(locale);
    expect($("title").text()).toBe(copy[locale].brand);
    expect($("h1").text()).toBe(copy[locale].brand);
    expect($("body").text()).toContain(copy[locale].journal);
    expect($("body").text()).not.toContain(copy[other].brand);
    expect($("body").text()).not.toContain(copy[other].journal);
    expect($('meta[property="og:locale"]').attr("content")).toBe(copy[locale].og);
    expect($('meta[property="og:title"]').attr("content")).toBe(copy[locale].brand);
    expect($('meta[name="twitter:title"]').attr("content")).toBe(copy[locale].brand);
    expect($('link[rel="canonical"]').attr("href")).toBe(`https://probpera.ru/planet/${locale}/`);
    expect($('meta[property="og:url"]').attr("content")).toBe(`https://probpera.ru/planet/${locale}/`);
    expect($('link[rel="manifest"]').attr("href")).toBe(`/planet/${locale}/manifest.webmanifest`);
    expect($('meta[name="robots"]').attr("content")).toBe("noindex,nofollow");
    expect($("#root > main[data-pwa-startup-shell]")).toHaveLength(1);
    expect($("img")).toHaveLength(1);
    expect($("img").attr("src")).toBe("/planet/brand/probpera-logo.png");
    expect($("img").attr("width")).toBe("48");
    expect($("img").attr("alt")).toBe("");
    expect($('a[href="https://probpera.ru/stati/"]').attr("rel")).toBe("noopener noreferrer");
  });

  it("keeps reciprocal language routes and one neutral x-default on every entry", () => {
    const files = generatePwaShellFiles({ builtHtml });
    for (const prefix of ["", "ru/", "en/"]) {
      const $ = load(files[`${prefix}index.html`]);
      expect($('link[rel="alternate"]').map((_, node) => [$(node).attr("hreflang"), $(node).attr("href")].join(" ")).get()).toEqual([
        "ru https://probpera.ru/planet/ru/",
        "en https://probpera.ru/planet/en/",
        "x-default https://probpera.ru/planet/",
      ]);
    }
  });

  it("leaves neutral launch language unforced and exposes working native-language choices", () => {
    const files = generatePwaShellFiles({ builtHtml });
    const $ = load(files["index.html"]);
    expect($("html").attr("data-route-language")).toBeUndefined();
    expect($("html").attr("data-pwa-neutral-entry")).toBe("");
    for (const locale of ["ru", "en"]) {
      const link = $(`a[href="/planet/${locale}/"]`);
      expect(link.attr("lang")).toBe(locale);
      expect(link.attr("hreflang")).toBe(locale);
      expect(link.text()).toBe(copy[locale].brand);
      expect($("h1").find(`[lang="${locale}"]`).text()).toBe(copy[locale].brand);
    }
    expect($('meta[property="og:locale"]')).toHaveLength(0);
  });

  it("retains the exact built module and local dependency links while removing site-only content", () => {
    const files = generatePwaShellFiles({ builtHtml });
    for (const filename of ["index.html", "ru/index.html", "en/index.html"]) {
      const $ = load(files[filename]);
      expect($("script")).toHaveLength(1);
      expect($("script").attr("src")).toBe("/planet/assets/main-a1.js");
      expect($("script").attr("type")).toBe("module");
      expect($("script").text()).toBe("");
      expect($('link[rel="modulepreload"]').attr("href")).toBe("/planet/assets/vendor-b2.js");
      expect($('link[rel="preload"]').attr("href")).toBe("/planet/fonts/canonical.woff2");
      expect($('link[rel="preload"]').attr("as")).toBe("font");
      expect($('link[rel="stylesheet"]').map((_, node) => $(node).attr("href")).get()).toEqual([
        "/planet/assets/main-c3.css", "/planet/pwa-shell.css",
      ]);
      expect($("style, base, [onload], [data-static-seo], link[rel=preconnect]")).toHaveLength(0);
      expect(files[filename]).not.toMatch(/Old journal|Old SEO|Old article|rss\.xml|og-v3\.webp|site\.webmanifest|old-cdn/u);
    }
  });

  it("gives both installed languages and neutral entry exactly one application identity", () => {
    const files = generatePwaShellFiles({ builtHtml });
    for (const locale of [null, "ru", "en"]) {
      const prefix = locale ? `${locale}/` : "";
      const manifest = JSON.parse(files[`${prefix}manifest.webmanifest`]);
      expect(manifest.id).toBe("/planet/");
      expect(manifest.scope).toBe("/planet/");
      expect(manifest.start_url).toBe(`/planet/${prefix}`);
      expect(manifest.lang).toBe(locale ?? undefined);
      expect(manifest.name).toBe(locale ? copy[locale].brand : "Литературная планета / Literary Planet");
      expect(manifest.theme_color).toBe("#f67518");
      expect(manifest.icons).toEqual([
        { src: "/planet/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/planet/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ]);
      expect(manifest).not.toHaveProperty("screenshots");
      expect(manifest).not.toHaveProperty("related_applications");
    }
  });

  it.each(["ru", "en"])("creates a static %s 404 with recovery and self-canonical metadata", locale => {
    const files = generatePwaShellFiles({ builtHtml });
    const $ = load(files[`${locale}/404.html`]);
    expect($("title").text()).toBe(`404 | ${copy[locale].brand}`);
    expect($("body").text()).toContain("404");
    expect($("script, link[rel=modulepreload]")).toHaveLength(0);
    expect($(`a[href="/planet/${locale}/"]`).text()).toBe(copy[locale].brand);
    expect($('link[rel="canonical"]').attr("href")).toBe(`https://probpera.ru/planet/${locale}/404.html`);
    expect($('link[hreflang="x-default"]').attr("href")).toBe("https://probpera.ru/planet/404.html");
    expect($('meta[name="robots"]').attr("content")).toContain("noindex");
  });

  it("supplies compact safe-area styles without remote resources or hidden fallbacks", () => {
    const files = generatePwaShellFiles({ builtHtml });
    const css = files["pwa-shell.css"];
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("env(safe-area-inset-left)");
    expect(css).toContain("#f67518");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("min-height:44px");
    expect(css).not.toMatch(/url\(|@import|visibility:hidden|opacity:0/u);
  });

  it.each([
    ["remote module", builtHtml.replace("/planet/assets/main-a1.js", "https://remote.invalid/main.js")],
    ["remote CSS", builtHtml.replace("/planet/assets/main-c3.css", "//remote.invalid/main.css")],
    ["root CSS", builtHtml.replace("/planet/assets/main-c3.css", "/assets/main.css")],
    ["escaping preload", builtHtml.replace("/planet/assets/vendor-b2.js", "/planet/assets/../vendor.js")],
    ["encoded traversal", builtHtml.replace("/planet/assets/vendor-b2.js", "/planet/%2e%2e/vendor.js")],
    ["unbuilt source", builtHtml.replace("/planet/assets/main-a1.js", "/planet/src/main.tsx")],
    ["inline JavaScript", builtHtml.replace("</head>", "<script>window.foo=1</script></head>")],
    ["module inline content", builtHtml.replace("main-a1.js\"></script>", "main-a1.js\">window.foo=1</script>")],
    ["duplicate entry", builtHtml.replace("</head>", '<script type="module" src="/planet/assets/second.js"></script></head>')],
    ["missing root", builtHtml.replace('id="root"', 'id="other"')],
    ["duplicate root", builtHtml.replace("</body>", '<div id="root"></div></body>')],
  ])("rejects %s instead of changing the canonical runtime or loading outside scope", (_, html) => {
    expect(() => generatePwaShellFiles({ builtHtml: html })).toThrow();
  });

  it.each(["https://remote.invalid/icon.png", "/planet/icons/../icon.png", "/planet/icon.png?token=x", "/planet/icon.svg"])("rejects unsafe or mismatched icon %s", icon192 => {
    expect(() => generatePwaShellFiles({ builtHtml, icon192 })).toThrow();
  });

  it("uses caller-selected canonical PNG paths consistently", () => {
    const files = generatePwaShellFiles({ builtHtml, icon192: "/planet/brand/pwa-192.png", icon512: "/planet/brand/pwa-512.png" });
    const $ = load(files["en/index.html"]);
    expect($('link[rel="icon"]').attr("href")).toBe("/planet/brand/pwa-192.png");
    expect($('meta[property="og:image"]').attr("content")).toBe("https://probpera.ru/planet/brand/pwa-512.png");
    expect(JSON.parse(files["en/manifest.webmanifest"]).icons[1].src).toBe("/planet/brand/pwa-512.png");
  });
});
