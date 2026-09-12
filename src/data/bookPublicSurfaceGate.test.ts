import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("visitor catalog and editorial verification boundary", () => {
  it("shows the complete catalog while preserving verified recommendations and public writer resolution", async () => {
    const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

    expect(app).toContain("bookArchive.filter(isPublicBook)");
    expect(app).toContain("for (const book of bookArchive)");
    expect(app).not.toContain("if (!isPublicBook(book)) return;");
    expect(app.match(/books=\{bookArchive\}/gu)).toHaveLength(2);
    expect(app).toContain("const premiumBooks = verifiedBookArchive.filter(");
    expect(app).toContain("if (!country || !writer) return;");
  });
});
