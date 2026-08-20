import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sanitizerSource = readFileSync(
  new URL("./sanitizeArticleHtml.ts", import.meta.url),
  "utf8"
);
const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
);

const tones = {
  garnet: "#852744",
  forest: "#235f42",
  ocean: "#145d75",
  indigo: "#55437e",
  amber: "#754b0a",
  slate: "#485466",
} as const;

describe("public article text-tone policy", () => {
  it("keeps the editor contract on a strict six-tone allowlist", () => {
    expect(sanitizerSource).toContain('"data-text-tone"');
    expect(sanitizerSource).toContain('element.tagName === "SPAN"');
    expect(sanitizerSource).toContain(
      'element.classList.contains("article-text-tone")'
    );

    for (const tone of Object.keys(tones)) {
      expect(sanitizerSource).toContain(`"${tone}"`);
      expect(sanitizerSource).toContain("allowedTextTones.has(textTone)");
      expect(sanitizerSource).toContain('`is-tone-${textTone}`');
    }
  });

  it("renders every allowed tone in the reader and adapts it for dark mode", () => {
    for (const [tone, color] of Object.entries(tones)) {
      expect(publicStyles).toContain(
        `.article-text-tone.is-tone-${tone}[data-text-tone="${tone}"]`
      );
      expect(publicStyles).toContain(`--article-text-tone: ${color};`);
      expect(publicStyles).toContain(
        `.article-reader.is-dark .article-text-tone.is-tone-${tone}`
      );
    }
  });
});
