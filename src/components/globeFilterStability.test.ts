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
const writerPanelSource = readFileSync(
  new URL("./WriterPanel.tsx", import.meta.url),
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
    expect(appSource).toContain(
      'selectWriterBiography(writer, "ru")?.status === "verified"'
    );
    expect(appSource).not.toContain(
      'writer.editorial?.status === "verified"'
    );
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
      cssSource.indexOf("/* Literary Planet: lightweight, aligned premium controls")
    );

    expect(premiumCss).toContain("width: auto;");
    expect(premiumCss).toContain("max-width: none;");
    expect(premiumCss).toContain("width: min(820px, 100%);");
    expect(premiumCss).toContain("pointer-events: none;");
    expect(premiumCss).toContain("pointer-events: auto;");
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
    expect(premiumCss).toContain("width: min(1080px, calc(100% - 96px))");
    expect(premiumCss).toContain("grid-auto-columns: 136px;");
    expect(premiumCss).toContain("width: min(760px, calc(100% - 24px))");
    expect(premiumCss).toContain("width: min(360px, calc(100% - 24px))");
    expect(premiumCss).toContain("--atlas-mobile-dock-gutter: 12px;");
    expect(premiumCss).toContain("--atlas-left-ornament-edge:");
    expect(premiumCss).toContain("--atlas-coordinate-bottom:");
    expect(premiumCss).toContain(
      "grid-template-columns: 48px 48px repeat(3, minmax(0, 1fr))"
    );
    expect(premiumCss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses one geometry contract and keeps edition navigation discoverable", () => {
    const polishCss = cssSource.slice(
      cssSource.indexOf(
        "/* Literary Planet: canonical geometry and post-merge interaction polish. */"
      )
    );

    for (const token of [
      "--atlas-globe-chrome-top",
      "--atlas-globe-rail-top",
      "--atlas-globe-panel-reserve",
      "--atlas-globe-coordinate-bottom",
      "--atlas-globe-controls-offset",
    ]) {
      expect(polishCss).toContain(token);
    }
    expect(globeSource).toContain('data-can-scroll-left={editionRailScroll.canScrollLeft}');
    expect(globeSource).toContain('className="globe-edition-compact-select"');
    expect(globeSource).toContain('className="globe-edition-scroll-cue is-previous"');
    expect(globeSource).toContain('className="globe-edition-scroll-cue is-next"');
    expect(polishCss).toContain('.globe-style-switch[data-can-scroll-left="true"]');
    expect(polishCss).toContain('.globe-style-switch[data-can-scroll-right="true"]');
    expect(polishCss).toMatch(
      /\.globe-edition-scroll-cue\[data-visible="true"\]\s*\{[\s\S]*?display:\s*flex;[\s\S]*?visibility:\s*visible;/u
    );
    expect(polishCss).toMatch(
      /@media \(min-width: 981px\) and \(max-width: 1325px\)[\s\S]*?\.globe-edition-compact-select\s*\{[\s\S]*?display:\s*block;/u
    );
  });

  it("keeps loading feedback optical and reduced-motion safe", () => {
    const polishCss = cssSource.slice(
      cssSource.indexOf(
        "/* Literary Planet: canonical geometry and post-merge interaction polish. */"
      )
    );
    const transitionRule =
      polishCss.match(/\.literary-globe \.globe-edition-transition\s*\{([\s\S]*?)\}/u)?.[1] ?? "";

    expect(globeSource).toContain('data-globe-edition-transition={editionTransitionState}');
    expect(globeSource).toContain('className="globe-webgl-recovery"');
    expect(globeSource).toContain('className="globe-scale-feedback"');
    expect(transitionRule).toContain("pointer-events: none");
    expect(transitionRule).not.toContain("backdrop-filter");
    expect(polishCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.globe-edition-transition > span/u
    );
  });

  it("keeps country archive cards readable, aligned, and overflow-safe", () => {
    const archiveCss = cssSource.slice(
      cssSource.indexOf(
        "/* Literary Planet: premium, overflow-safe country archive composition. */"
      ),
      cssSource.indexOf("/* Public editorial-image contract")
    );

    expect(archiveCss).toContain("overscroll-behavior: contain;");
    expect(archiveCss).toContain("touch-action: pan-y;");
    expect(archiveCss).toContain(
      "grid-template-rows: 30px minmax(34px, auto);"
    );
    expect(archiveCss).toMatch(
      /\.archive-subscribe\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?min-height:\s*48px;/u
    );
    expect(archiveCss).toMatch(
      /\.country-metrics span\s*\{[\s\S]*?font-size:\s*12px;[\s\S]*?text-transform:\s*none;/u
    );
    expect(archiveCss).toMatch(
      /\.source-block a\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?min-height:\s*44px;/u
    );
    expect(archiveCss).toContain(
      ".writer-detail .writer-record-meta :is(a, .writer-record-open-book)"
    );
    expect(archiveCss).toContain("@media (max-width: 360px)");
  });

  it("keeps compact country actions complete and card affordances explicit", () => {
    const polishCss = cssSource.slice(
      cssSource.indexOf(
        "/* Literary Planet: canonical geometry and post-merge interaction polish. */"
      )
    );

    expect(appSource).toContain('className="atlas-country-sheet-action-full"');
    expect(appSource).toContain('className="atlas-country-sheet-action-compact"');
    expect(appSource).toContain('aria-hidden="true"');
    expect(writerPanelSource).toContain("country-metric--static");
    expect(writerPanelSource).toContain("country-metric--action");
    expect(polishCss).toMatch(
      /\.country-panel \.panel-topline\s*\{[\s\S]*?top:\s*0;[\s\S]*?backdrop-filter:\s*none;/u
    );
    expect(polishCss).toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.atlas-country-sheet-action-full\s*\{[\s\S]*?display:\s*none;/u
    );
    expect(polishCss).toMatch(
      /@media \(max-width: 340px\)[\s\S]*?\.writer-detail-tabs\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?scroll-snap-type:\s*x proximity;/u
    );
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
