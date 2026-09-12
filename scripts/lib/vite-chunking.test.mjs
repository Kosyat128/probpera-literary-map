import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import viteConfiguration from "../../vite.config.ts";

const viteConfig = readFileSync(
  new URL("../../vite.config.ts", import.meta.url),
  "utf8"
);

describe("Vite data chunking", () => {
  it("keeps the portrait manifest outside the country archive chunk", () => {
    expect(viteConfig).toContain('/writerPortraits.generated.json');
    expect(viteConfig).toContain('return "writer-portraits-data"');
  });
  it("isolates only the three retained synopsis partitions without moving the archive facade or other catalogs", async () => {
    const config = typeof viteConfiguration === "function"
      ? await viteConfiguration({ command: "build", mode: "test" }) : viteConfiguration;
    const chunk = config.build.rollupOptions.output.manualChunks;
    for (const part of ["01", "02", "03"]) {
      expect(chunk(`/repo/src/data/countries/bookR49nRetainedDrafts20260912Data${part}.ts`))
        .toBe(`book-retained-drafts-${part}`);
    }
    expect(chunk("/repo/src/data/countries/bookR49nRetainedDrafts20260912.ts")).toBeUndefined();
    expect(chunk("/repo/src/data/countries/bookR49nRetainedDrafts20260912Data04.ts")).toBeUndefined();
    expect(chunk("/repo/src/data/countries/usa.ts")).toBe("country-data-n-z");
    expect(chunk("/repo/src/data/books.generated.json")).toBe("book-catalog");
    expect(chunk("vite/preload-helper")).toBe("vite-preload-helper");
  });
});
