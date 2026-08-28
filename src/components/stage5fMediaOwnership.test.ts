import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const articleLibrary = readFileSync(
  new URL("./ArticleLibrarySection.tsx", import.meta.url),
  "utf8"
);
const bookArchive = readFileSync(
  new URL("./BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const coverTextures = readFileSync(
  new URL("../books/completeShelfTextures.ts", import.meta.url),
  "utf8"
);

describe("Stage 5F media ownership", () => {
  it("renders one image element per editorial media wrapper", () => {
    expect(app).not.toContain("article-image-backdrop");
    expect(articleLibrary).not.toContain("library-card-image-backdrop");
  });

  it("renders each Catalog or detail cover from one raster owner", () => {
    expect(bookArchive).not.toContain("archive-book-cover-backdrop");
    expect(bookArchive).not.toMatch(
      /book-detail-cover[\s\S]{0,360}backgroundImage:\s*`url/u
    );
  });

  it("shares a bounded in-flight and decoded image cache for 3D covers", () => {
    expect(coverTextures).toContain(
      "const sharedCompleteShelfCoverImages = new SharedAsyncLru<HTMLImageElement>(32)"
    );
    expect(coverTextures).toContain(
      "sharedCompleteShelfCoverImages.getOrCreate"
    );
    expect(coverTextures).toContain("void image.decode().then(finish, finish)");
  });
});
