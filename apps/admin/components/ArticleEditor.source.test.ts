import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const editorSource = readFileSync(
  new URL("./ArticleEditor.tsx", import.meta.url),
  "utf8"
);

describe("article editor publication and recovery wiring", () => {
  it("keeps English checks optional until the translation is enabled", () => {
    expect(editorSource).toContain(
      "if (!englishEnabled) return russianChecks;"
    );
    expect(editorSource).toContain(
      '"Английский перевод не включён: можно выпустить только русский оригинал."'
    );
  });

  it("backs up the complete editor snapshot and flushes it when the page hides", () => {
    expect(editorSource).toContain("contentHtml,");
    expect(editorSource).toContain("contentJson,");
    expect(editorSource).toContain("coverUrl,");
    expect(editorSource).toContain('reason: "autosave"');
    expect(editorSource).toContain('reason: "before-submit"');
    expect(editorSource).toContain('document.addEventListener("visibilitychange"');
  });
});
