import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(
  fileURLToPath(new URL("../index.css", import.meta.url)),
  "utf8"
);
const appSource = fs.readFileSync(
  fileURLToPath(new URL("../App.tsx", import.meta.url)),
  "utf8"
);
const globalSearchSource = fs.readFileSync(
  fileURLToPath(new URL("./GlobalSearch.tsx", import.meta.url)),
  "utf8"
);
const globeSource = fs.readFileSync(
  fileURLToPath(new URL("./LiteraryGlobe.tsx", import.meta.url)),
  "utf8"
);

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u"));
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[1];
}

describe("country flag presentation in globe and search results", () => {
  it("uses the same explicit circular treatment in every country-result surface", () => {
    expect(
      appSource.match(/country-result-flag country-flag-icon--round/gu)
    ).toHaveLength(2);
    expect(globalSearchSource).toContain(
      'className="global-search-country-flag country-flag-icon--round"'
    );
    expect(globeSource).toContain(
      'className="globe-country-label-flag country-flag-icon--round"'
    );
    expect(globeSource).toContain("size={30}");
  });

  it("clips square flag artwork cleanly to a centered one-to-one circle", () => {
    const roundRule = cssRule(".country-flag-icon--round");

    expect(roundRule).toMatch(/box-sizing:\s*border-box/iu);
    expect(roundRule).toMatch(/aspect-ratio:\s*1(?:\s*\/\s*1)?/iu);
    expect(roundRule).toMatch(/overflow:\s*hidden/iu);
    expect(roundRule).toMatch(/object-fit:\s*cover/iu);
    expect(roundRule).toMatch(/object-position:\s*center/iu);
    expect(roundRule).toMatch(/border-radius:\s*50%/iu);
    expect(roundRule).not.toMatch(/padding\s*:/iu);
  });

  it.each([320, 360, 1280])(
    "keeps fixed flag boxes and existing row geometry at %ipx",
    (viewportWidth) => {
      const compactRule = cssRule(".country-result-flag");
      const globalRule = cssRule(".global-search-country-flag");
      const globeRule = cssRule(".globe-country-label-flag");

      expect(viewportWidth).toBeGreaterThanOrEqual(320);
      expect(compactRule).toMatch(/width:\s*24px/iu);
      expect(compactRule).toMatch(/height:\s*24px/iu);
      expect(globalRule).toMatch(/width:\s*28px/iu);
      expect(globalRule).toMatch(/height:\s*28px/iu);
      expect(globeRule).toMatch(/width:\s*30px/iu);
      expect(globeRule).toMatch(/height:\s*30px/iu);
      expect(css).toMatch(
        /\.global-search-results section > button,\s*\.global-search-results section > a\s*\{[^}]*grid-template-columns:\s*30px\s+minmax\(0,\s*1fr\)/isu
      );
    }
  );
});
