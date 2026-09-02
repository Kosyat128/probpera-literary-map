import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("visitor book publication boundary", () => {
  it("passes only publication-gated books to every App search and archive surface", async () => {
    const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

    expect(app).toContain("bookArchive.filter(isPublicBook)");
    expect(app).toContain("for (const book of verifiedBookArchive)");
    expect(app).toContain("if (!isPublicBook(book)) return;");
    expect(app).toContain("books={verifiedBookArchive}");
    expect(app.match(/books=\{verifiedBookArchive\}/gu)).toHaveLength(2);
    expect(app).not.toContain("books={bookArchive}");
  });
});
