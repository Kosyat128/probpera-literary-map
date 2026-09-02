import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const acquisitionSource = readFileSync(
  new URL("./acquire-historical-globe-sources.mjs", import.meta.url),
  "utf8"
);
const manifest = JSON.parse(
  readFileSync(
    new URL("./globe-editions/historical-runtime-sources.json", import.meta.url),
    "utf8"
  )
);

describe("historical source acquisition boundary", () => {
  it("pins every reviewed manifest request in executable code", () => {
    const sources = manifest.editions.flatMap((edition) => edition.sources);
    for (const source of sources) {
      expect(acquisitionSource).toContain(JSON.stringify(source.filename));
      expect(acquisitionSource).toContain(JSON.stringify(source.url));
      if (source.referer) {
        expect(acquisitionSource).toContain(JSON.stringify(source.referer));
      }
    }
  });

  it("never sends manifest-provided request metadata directly", () => {
    expect(acquisitionSource).toContain("pinnedSourceRequest(source)");
    expect(acquisitionSource).toContain("source.url !== url");
    expect(acquisitionSource).toContain("source.referer ?? null");
    expect(acquisitionSource).toContain("fetch(request.url");
    expect(acquisitionSource).toContain('redirect: "error"');
    expect(acquisitionSource).not.toContain("fetch(source.url");
    expect(acquisitionSource).not.toContain("referer: source.referer");
  });
});
