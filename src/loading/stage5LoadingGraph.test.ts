import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { calculateLightweightArchiveOverview } from "./archiveOverview";
import {
  hashTargetsSection,
  normalizedHashTarget,
  shouldActivateDeferredSection,
} from "./nearViewportActivation";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8").replace(
    /\r\n/gu,
    "\n"
  );
}

describe("Stage 5F demand-owned loading graph", () => {
  it("activates only for explicit intent or a matching direct hash", () => {
    expect(normalizedHashTarget("#%62ooks")).toBe("books");
    expect(hashTargetsSection("#journal", ["books", "journal"])).toBe(true);
    expect(hashTargetsSection("#authors", ["books", "journal"])).toBe(false);
    expect(
      shouldActivateDeferredSection({ hash: "", hashTargets: ["books"] })
    ).toBe(false);
    expect(
      shouldActivateDeferredSection({
        hash: "#books",
        hashTargets: ["books"],
      })
    ).toBe(true);
    expect(
      shouldActivateDeferredSection({
        force: true,
        hash: "",
        hashTargets: ["books"],
      })
    ).toBe(true);
  });

  it("keeps above-the-fold statistics independent from the book graph", () => {
    const overview = calculateLightweightArchiveOverview([
      {
        id: "first",
        code: "AA",
        name: "First",
        writers: [
          { id: "one", name: "Ada Author", wikidataId: "Q10" },
          { id: "fallback", name: "No Id", years: "1900–1980" },
        ],
      },
      {
        id: "second",
        code: "BB",
        name: "Second",
        writers: [
          { id: "duplicate", name: "Ada Author", wikidataId: "Q10" },
          { id: "fallback-copy", name: "No Id", birth: "1900" },
        ],
      },
    ] as never);

    expect(overview).toEqual({ countries: 2, uniqueWriters: 2 });
    expect(source("src/loading/archiveOverview.ts")).not.toContain(
      "bookArchive"
    );
  });

  it("does not put Globe, Shelf, full books, or article catalog on initial App evaluation", () => {
    const app = source("src/App.tsx");
    const worldMap = source("src/components/LiteraryWorldMap.tsx");
    const archives = source("src/loading/DeferredHomepageArchives.tsx");
    const runtime = source("src/loading/bookArchiveRuntime.ts");

    expect(app).toContain('import type { BookArchiveEntry } from "./data/bookArchive"');
    expect(app).not.toMatch(/import\s*\{[^}]*buildBookArchive[^}]*\}\s*from\s*"\.\/data\/bookArchive"/su);
    expect(app).not.toContain('import("./data/articles/catalog")');
    expect(app).not.toContain('lazy(() => import("./components/LiteraryWorldMap"))');
    expect(app).not.toContain('lazy(\n  () => import("./components/BookArchiveSection")');
    expect(app).toContain("<DeferredBookArchive");
    expect(app).toContain("<DeferredArticleLibrary");
    expect(app).toContain('new URLSearchParams(window.location.search).has("book")');
    expect(app).toContain('window.addEventListener("popstate", requestBookFromAddress)');
    expect(app).toContain('document.getElementById("books")?.scrollIntoView');

    expect(worldMap).toContain('import("./LiteraryGlobe")');
    expect(worldMap).not.toMatch(/import\s+LiteraryGlobe\s+from/su);
    expect(runtime).toContain('import("../data/bookArchive")');
    expect(archives).toContain('import("../components/BookArchiveSection")');
    expect(archives).not.toContain("loadBookArchiveRuntime");
    expect(app).toContain("loadBookArchiveRuntime()");
    expect(app).toContain("archiveStatus={bookRuntimeStatus}");
    expect(app).not.toMatch(
      /forceLoad=\{[\s\S]{0,180}globalSearchOpen[\s\S]{0,180}\}/u
    );
    expect(archives).toContain('import("../components/ArticleLibrarySection")');
    expect(archives).toContain('import("../data/articles/catalog")');
  });

  it("loads book data near the monthly feature without mounting Shelf UI", () => {
    const app = source("src/App.tsx");

    expect(app).toContain("ref={setBookDayActivationNode}");
    expect(app).toContain("onActivate: requestBookRuntime");
    expect(app).toMatch(
      /if \(!globalSearchOpen\) return;[\s\S]*requestBookRuntime\(\);/u
    );
  });

  it("keeps stable semantic shells, loading truth, and a recovery action", () => {
    const app = source("src/App.tsx");
    const worldMap = source("src/components/LiteraryWorldMap.tsx");
    const archives = source("src/loading/DeferredHomepageArchives.tsx");
    const globalSearch = source("src/components/GlobalSearch.tsx");
    const css = source("src/styles/stage5-loading-shells.css");

    expect(archives).toMatch(/id="books"[\s\S]*aria-busy=/u);
    expect(archives).toMatch(/id="journal"[\s\S]*aria-busy=/u);
    expect(archives.match(/role="status"/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(archives).toContain("Повторить загрузку");
    expect(archives).toContain("document.body.style.overflow = \"hidden\"");
    expect(archives).toContain('event.key !== "Tab"');
    expect(app).toContain("globalSearchReturnFocusRef");
    expect(app).toContain("onClose={closeGlobalSearch}");
    expect(globalSearch).not.toContain("previouslyFocused");
    expect(worldMap).toContain("aria-busy=");
    expect(worldMap).toContain("Повторить загрузку");
    expect(app).toContain(
      'archiveDataStatus === "ready" && filteredCountries.length === 0'
    );
    expect(css).toContain("--stage5-shell-block-size");
    expect(css).toContain("contain: style");
    expect(css).not.toContain("contain: layout");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("min-block-size: 2.75rem");
  });
});
