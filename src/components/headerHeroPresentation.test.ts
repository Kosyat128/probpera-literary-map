import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n"
);
const articleMenuSource = readFileSync(
  new URL("./HeaderArticlesMenu.tsx", import.meta.url),
  "utf8"
).replace(/\r\n/gu, "\n");
const languageControlSource = readFileSync(
  new URL("./InterfaceLanguageControl.tsx", import.meta.url),
  "utf8"
).replace(/\r\n/gu, "\n");
const publicStyles = readFileSync(new URL("../index.css", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n"
);

describe("Header + Hero presentation contract", () => {
  it("keeps the protected brand artwork and exact Russian headline", () => {
    expect(appSource).toContain('"Литература – это целый мир!"');
    expect(appSource).toContain("brand/probpera-logo.png");
    expect(appSource).toContain("brand/magazine-hero-wide.avif?v=20260813-literary-nature-final");
    expect(appSource).toContain("brand/magazine-hero-mobile.avif?v=20260813-literary-nature-portrait");
    expect(appSource).toContain('media="(max-width: 680px)"');
    expect(appSource).toContain('className="primary-action"');
    expect(appSource).toContain('className="secondary-action"');
  });

  it("preserves the established two-row header and title structure exactly", () => {
    expect(appSource).toContain('className="topline"');
    expect(appSource).toContain('<header className="site-header">');
    expect(appSource).toContain('<nav className="mobile-nav"');
    expect(appSource).not.toContain("mobile-nav-shell");
    expect(appSource).toContain("hero-title-accent-line");
    expect(publicStyles).toContain(".hero-editorial h1 .hero-title-accent-line");
    expect(appSource).toContain('{t("Разделы")} <span aria-hidden="true">⌄</span>');
    expect(articleMenuSource).toContain('{t("Статьи")} <span aria-hidden="true">⌄</span>');
    expect(appSource).toContain('<span aria-hidden="true">⌕</span>');
    expect(appSource).toContain('<button\n            className="reader-button"');
    expect(languageControlSource).not.toContain('../ui/Button');
    expect(languageControlSource).toContain('<button\n          type="button"');
    expect(publicStyles).toMatch(/\.interface-language-control\s*\{[\s\S]*?height:\s*32px;[\s\S]*?padding:\s*3px;/u);
    expect(publicStyles).toMatch(/@media \(max-width:\s*1520px\)\s*\{[\s\S]*?\.header-actions \.header-socials/u);
    expect(publicStyles).not.toMatch(/\/\* Header refinement:/u);
  });

  it("preserves CMS edit markers while hardening menu and reader accessibility", () => {
    expect(appSource).toContain('cmsCoreFieldMarker(\n            "hero",\n            "backgroundMediaId"');
    expect(appSource).toContain('cmsCoreFieldMarker(\n                "hero",\n                "title"');
    expect(appSource).toContain('cmsCoreFieldMarker(\n                  "hero",\n                  "buttonText"');
    expect(appSource).toContain('aria-label={readerName || t("Войти")}');
    expect(appSource).toContain('event.key !== "Escape" || !event.currentTarget.open');
    expect(articleMenuSource).toContain('event.key !== "Escape" || !event.currentTarget.open');
    expect(appSource).toContain('document.addEventListener("pointerdown", closeFromOutside, true)');
    expect(articleMenuSource).toContain('document.addEventListener("pointerdown", closeFromOutside, true)');
  });

  it("uses the owner-approved tighter footer menu rhythm", () => {
    expect(publicStyles).toMatch(/\.footer-map section\s*\{\s*gap:\s*5px;/u);
  });
});
