import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
);
const worldMapSource = readFileSync(
  new URL("./LiteraryWorldMap.tsx", import.meta.url),
  "utf8"
);

describe("globe filter stability wiring", () => {
  it("builds the atlas from the stable full archive", () => {
    expect(appSource).toContain("atlasCountries={countryArchive}");
    expect(worldMapSource).toContain("atlasCountries={atlasCountries}");
    expect(globeSource).toContain("const atlasSourceCountries = atlasCountries ?? countries");
    expect(globeSource).toContain("createGlobeAtlas(\n      atlasSourceCountries");
    expect(globeSource).toContain(
      "[atlasLoadRequest, atlasRequested, atlasSourceCountries]"
    );
  });

  it("keeps filtered countries as the selectable marker collection", () => {
    expect(globeSource).toContain("const selectableCountryIds = useMemo(");
    expect(globeSource).toContain("selectableCountryIds.has(country.id)");
    expect(globeSource).toContain("countries={countries}");
    expect(appSource).toContain('role="group"');
    expect(appSource).toContain("atlas-filter-status");
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
