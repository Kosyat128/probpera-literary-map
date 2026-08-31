import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { articleTextTones } from "../../apps/admin/lib/article-content-presentation";

const sanitizerSource = readFileSync(
  new URL("./sanitizeArticleHtml.ts", import.meta.url),
  "utf8"
);
const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
);
const adminStyles = ["editors.css", "responsive.css"]
  .map((file) =>
    readFileSync(
      new URL(`../../apps/admin/app/styles/${file}`, import.meta.url),
      "utf8"
    )
  )
  .join("\n");

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort(
    (left, right) => right - left
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

function cssEscaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

describe("public article text-tone policy", () => {
  it("keeps one strict 24-tone editorial allowlist across admin and reader", () => {
    const ids = articleTextTones.map((tone) => tone.id);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    expect(new Set(articleTextTones.map((tone) => tone.label)).size).toBe(24);
    expect(new Set(articleTextTones.map((tone) => tone.readerColor)).size).toBe(24);
    expect(new Set(articleTextTones.map((tone) => tone.editorColor)).size).toBe(24);
    expect(ids).toEqual(expect.arrayContaining([
      "garnet",
      "forest",
      "ocean",
      "indigo",
      "amber",
      "slate",
    ]));

    const sanitizerAllowlist = sanitizerSource
      .match(/const allowedTextTones = new Set\(\[([\s\S]*?)\]\);/u)?.[1]
      .match(/"([a-z]+)"/gu)
      ?.map((entry) => entry.slice(1, -1));
    expect(sanitizerAllowlist).toEqual(ids);

    expect(sanitizerSource).toContain('"data-text-tone"');
    expect(sanitizerSource).toContain('element.tagName === "SPAN"');
    expect(sanitizerSource).toContain(
      'element.classList.contains("article-text-tone")'
    );
    expect(sanitizerSource).toContain("allowedTextTones.has(textTone)");
    expect(sanitizerSource).toContain('`is-tone-${textTone}`');
    expect(sanitizerSource).toContain(
      'canonicalPresentationClasses.push("article-text-tone", expectedToneClass)'
    );
    expect(sanitizerSource).toContain('"data-typography-scope"');
    expect(sanitizerSource).toContain("allowedTypographyScopes.has(typographyScope)");
    expect(adminStyles).toContain("max-height: min(620px, 68vh)");
    expect(adminStyles).toContain("overflow-y: auto");
    expect(adminStyles).toContain("max-height: 56vh");
  });

  it("keeps every metadata color synchronized with admin and public CSS", () => {
    for (const tone of articleTextTones) {
      expect(publicStyles).toContain(
        `.article-text-tone.is-tone-${tone.id}[data-text-tone="${tone.id}"]`
      );
      expect(publicStyles).toMatch(
        new RegExp(
          `is-tone-${tone.id}\\[data-text-tone="${tone.id}"\\]\\s*\\{\\s*--article-text-tone: ${cssEscaped(tone.readerColor)};`,
          "u"
        )
      );
      expect(publicStyles).toMatch(
        new RegExp(
          `\\.article-reader\\.is-dark \\.article-text-tone\\.is-tone-${tone.id}\\[data-text-tone="${tone.id}"\\]\\s*\\{\\s*--article-text-tone: ${cssEscaped(tone.editorColor)};`,
          "u"
        )
      );
      expect(adminStyles).toContain(
        `[data-text-tone="${tone.id}"] { --tone-reader: ${tone.readerColor}; --tone-editor: ${tone.editorColor}; }`
      );
    }
  });

  it("guarantees WCAG AAA on both reader papers and the dark editor", () => {
    for (const tone of articleTextTones) {
      const lightContrast = contrastRatio(tone.readerColor, "#fffaf3");
      const warmContrast = contrastRatio(tone.readerColor, "#f3e3c7");
      const darkContrast = contrastRatio(tone.editorColor, "#1d0a2d");

      expect(lightContrast, `${tone.id} on #fffaf3`).toBeGreaterThanOrEqual(7);
      expect(warmContrast, `${tone.id} on #f3e3c7`).toBeGreaterThanOrEqual(7);
      expect(darkContrast, `${tone.id} on #1d0a2d`).toBeGreaterThanOrEqual(7);
      expect(tone.contrastRatio).toBeCloseTo(
        Math.min(lightContrast, warmContrast),
        2
      );
    }
  });
});
