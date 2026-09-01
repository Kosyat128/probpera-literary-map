import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
).replace(/\r\n/gu, "\n");
const worldMapSource = readFileSync(
  new URL("./LiteraryWorldMap.tsx", import.meta.url),
  "utf8"
);
const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("globe filter stability wiring", () => {
  it("builds the atlas from the stable full archive", () => {
    expect(appSource).toContain("atlasCountries={countryArchive}");
    expect(worldMapSource).toContain("atlasCountries={atlasCountries}");
    expect(globeSource).toContain("const atlasSourceCountries = atlasCountries ?? countries");
    expect(globeSource).toMatch(/createGlobeAtlas\(\s*atlasSourceCountries,/u);
    expect(globeSource).toMatch(
      /\[\s*atlasLoadRequest,\s*atlasRequested,\s*atlasSourceCountries,/u
    );
  });

  it("keeps filtered countries as the selectable marker collection", () => {
    expect(globeSource).toContain("const selectableCountryIds = useMemo(");
    expect(globeSource).toContain("selectableCountryIds.has(country.id)");
    expect(globeSource).toContain("countries={countries}");
    expect(appSource).toContain('role="group"');
    expect(appSource).toContain('rich: "10+ авторов"');
    expect(appSource).toContain("data-atlas-archives-toggle");
    expect(appSource).toContain("largestArchiveCountries.map");
    expect(appSource).not.toContain('className="atlas-ranking"');
  });

  it("keeps filters and the archive disclosure in one overflow-safe row", () => {
    const filtersRule =
      cssSource.match(/\.atlas-filters\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    const buttonRule =
      cssSource.match(/\.atlas-filters button\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    const toolbarRule =
      cssSource.match(/\.atlas-toolbar\s*\{([\s\S]*?)\}/u)?.[1] ?? "";

    expect(toolbarRule).not.toContain("z-index: 40");
    expect(cssSource).toMatch(
      /\.atlas-toolbar\.has-open-archives\s*\{[\s\S]*?z-index:\s*40;/u
    );
    expect(filtersRule).toContain("flex-wrap: nowrap");
    expect(filtersRule).toContain("overflow-x: auto");
    expect(filtersRule).toContain("scrollbar-width: none");
    expect(buttonRule).toContain("flex: 0 0 auto");
    expect(buttonRule).toContain("scroll-snap-align: start");
  });

  it("keeps the premium globe controls balanced and touch-safe", () => {
    const premiumCss = cssSource.slice(
      cssSource.indexOf("/* Literary Planet: lightweight, centered premium controls")
    );

    expect(premiumCss).toContain("width: min(820px, calc(100% - 32px))");
    expect(premiumCss).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr)) 92px 48px"
    );
    expect(premiumCss).toContain(
      "grid-template-columns: repeat(3, 48px) 92px 48px"
    );
    expect(premiumCss).toMatch(
      /atlas-immersive-search-toggle,[\s\S]*?height:\s*48px;[\s\S]*?min-height:\s*48px;/u
    );
    expect(premiumCss).toMatch(
      /interface-language-control button\s*\{[\s\S]*?height:\s*44px;/u
    );
    expect(premiumCss).toMatch(
      /data-atlas-panel-state="open"\] \.globe-style-switch\s*\{[\s\S]*?visibility:\s*hidden;[\s\S]*?pointer-events:\s*none;/u
    );
    expect(cssSource).toMatch(
      /\.literary-globe \.globe-style-switch\s*\{[\s\S]*?grid-auto-flow:\s*column;[\s\S]*?overflow-x:\s*auto;/u
    );
    expect(cssSource).toMatch(
      /\.literary-globe \.globe-controls\s*\{[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translateX\(-50%\);/u
    );
    expect(premiumCss).toContain("grid-auto-columns: calc((100% - 16px) / 9)");
    expect(premiumCss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("mounts the 200-country fallback only after visitors open it", () => {
    expect(appSource).toContain("const [countryIndexOpen, setCountryIndexOpen]");
    expect(appSource).toContain(
      "onToggle={(event) => setCountryIndexOpen(event.currentTarget.open)}"
    );
    expect(appSource).toContain("{countryIndexOpen && (");
  });

  it("keeps filters and selections shareable through browser history", () => {
    expect(appSource).toContain("readAtlasUrlState");
    expect(appSource).toContain("commitAtlasUrlState");
    expect(appSource).toContain(
      'window.addEventListener("popstate", applyAtlasUrlSelection)'
    );
  });
});
