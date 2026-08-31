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
    const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");
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
