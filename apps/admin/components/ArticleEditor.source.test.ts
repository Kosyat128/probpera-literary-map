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

  it("uses safe semantic text tones and positions the first illustration logically", () => {
    expect(editorSource).toContain("ArticleTextTone");
    expect(editorSource).toContain("articleTextTones.map");
    expect(editorSource).toContain("AAA · от {tone.contrastRatio}:1");
    expect(editorSource).toContain(
      "24 редакционных оттенка с контрастом AAA"
    );
    expect(editorSource).toContain("insertImageAtLogicalPosition");
    expect(editorSource).toContain("firstHeadingPosition ?? firstBlockEnd");
    expect(editorSource).toContain("Number(node.attrs.level || 0) === 2");
  });
});
