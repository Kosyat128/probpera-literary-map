import type { CanvasTexture } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCompleteShelfBookSpec } from "./completeShelfModel";
import {
  buildCompleteShelfArtworkPlan,
  createCompleteShelfArtworkTextures,
  disposeCompleteShelfTextures,
  loadCompleteShelfCoverTexture,
  resolveCompleteShelfSpineTextColor,
  resolveCompleteShelfSpineOrnamentLayout,
  resolveCompleteShelfCoverTextureSize,
  wrapCompleteShelfArtworkText,
  wrapCompleteShelfTitleText,
  wrapCompleteShelfWriterText,
} from "./completeShelfTextures";

afterEach(() => vi.unstubAllGlobals());

describe("Complete Shelf procedural artwork data", () => {
  it("sanitizes and carries local archive metadata into the cover plan", () => {
    const spec = buildCompleteShelfBookSpec(
      {
        key: "archive-book",
        title: "  Великая\u0000   книга пера  ",
        writer: "  Автор   Архива ",
        year: 1912,
        baseColor: "#3f244d",
        accentColor: "#d8b568",
        paperColor: "#e8dcc4",
        coverUrl: "brand/book-covers/archive-book.webp",
      },
      0
    );
    const plan = buildCompleteShelfArtworkPlan(spec);

    expect(plan.titleLines.join(" ")).toBe("Великая книга пера");
    expect(plan.frontWriterLines.join(" ")).toBe("Автор Архива");
    expect(plan.spineTitleLines.join(" ")).toBe("Великая книга пера");
    expect(plan.spineWriterLines.join(" ")).toBe("Автор Архива");
    expect(plan.spineTitle).toBe("Великая книга пера");
    expect(plan.writer).toBe("Автор Архива");
    expect(plan.yearLabel).toBe("1912");
    expect(plan.baseColor).toBe(spec.baseColor);
    expect(plan.paperColor).toBe(spec.paperColor);
    expect(plan.accentColor).toBe(spec.accentColor);
    expect(plan.foilColor).toMatch(/^#[0-9a-f]{6}$/iu);
    expect(plan.foilColor).not.toBe("#b87333");
    expect(plan.hasCoverArtwork).toBe(true);
  });

  it("bounds long artwork text and marks truncation", () => {
    const lines = wrapCompleteShelfArtworkText(
      "Очень длинное название книги которое не помещается на обложке целиком",
      12,
      3
    );

    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.every((line) => line.length <= 12)).toBe(true);
    expect(lines[lines.length - 1]).toMatch(/…$/u);
  });

  it("wraps unspaced CJK spine titles into larger readable glyph groups", () => {
    const title = "走ることについて語るときに僕の語ること";
    const spec = buildCompleteShelfBookSpec(
      {
        key: "cjk-spine-title",
        title,
        writer: "Харуки Мураками",
        baseColor: "#384f67",
        accentColor: "#d8b568",
        paperColor: "#e8dcc4",
      },
      1
    );
    const lines = buildCompleteShelfArtworkPlan(spec).spineTitleLines;

    expect(lines.length).toBeLessThanOrEqual(8);
    expect(lines.every((line) => line.length <= 6)).toBe(true);
    expect(lines.join("")).toBe(title);
  });

  it("never breaks words or parenthetical title parts across spine lines", () => {
    const fahrenheit = wrapCompleteShelfTitleText(
      "451° по Фаренгейту",
      8,
      8
    );
    const parenthetical = wrapCompleteShelfTitleText(
      "闘牛 (Tōgyū)",
      6,
      8
    );

    expect(fahrenheit).toEqual(["451° по", "Фаренгейту"]);
    expect(parenthetical).toEqual(["闘牛", "(Tōgyū)"]);
  });

  it("keeps a full writer FIO on the spine without an ellipsis", () => {
    const writer =
      "Александр Сергеевич Пушкин-Бутурлин Длинное Редакционное Имя";
    const lines = wrapCompleteShelfWriterText(writer, 13, 6);

    expect(lines.length).toBeLessThanOrEqual(6);
    expect(lines.join(" ")).not.toContain("…");
    expect(lines.join("").replace(/\s/gu, "")).toBe(
      writer.replace(/\s/gu, "")
    );
  });

  it("keeps a full long title on spine and front artwork", () => {
    const title =
      "Повесть о великом литературном путешествии через пространство и время";
    const front = wrapCompleteShelfTitleText(title, 18, 5);
    const spine = wrapCompleteShelfTitleText(title, 8, 8);

    expect(front).toHaveLength(5);
    expect(spine.length).toBeLessThanOrEqual(8);
    expect(front.join(" ")).not.toContain("…");
    expect(spine.join(" ")).not.toContain("…");
    expect(front.join("").replace(/\s/gu, "")).toBe(
      title.replace(/\s/gu, "")
    );
    expect(spine.join("").replace(/\s/gu, "")).toBe(
      title.replace(/\s/gu, "")
    );
  });

  it("keeps solid high-contrast antique-gold lettering legible across all palettes", () => {
    const luminance = (value: string) => {
      const channels = [1, 3, 5].map((offset) => {
        const channel =
          Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return (
        channels[0] * 0.2126 +
        channels[1] * 0.7152 +
        channels[2] * 0.0722
      );
    };
    const contrast = (first: string, second: string) => {
      const values = [luminance(first), luminance(second)].sort(
        (left, right) => right - left
      );
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const specs = Array.from({ length: 512 }, (_, index) =>
      buildCompleteShelfBookSpec(
        {
          key: `palette-${index}`,
          title: `Книга ${index}`,
          writer: `Автор ${index}`,
          year: 1900 + (index % 100),
          baseColor: "#000000",
          accentColor: "#000000",
          paperColor: "#ffffff",
        },
        index
      )
    );

    expect(new Set(specs.map((spec) => spec.baseColor)).size).toBeGreaterThan(
      12
    );
    for (const spec of specs) {
      const textColor = resolveCompleteShelfSpineTextColor(
        spec.baseColor,
        spec.foilColor
      );
      expect(textColor).toMatch(/^#[0-9a-f]{6}$/iu);
      expect(contrast(spec.baseColor, textColor)).toBeGreaterThanOrEqual(4.4);
    }
  });

  it("keeps identical line-dot-line spine ornaments pixel-aligned", () => {
    for (const [width, height] of [
      [112, 512],
      [337, 1536],
    ] as const) {
      for (const centerRatio of [0.09, 0.91]) {
        const layout = resolveCompleteShelfSpineOrnamentLayout(
          width,
          height,
          centerRatio
        );
        expect(layout.centerX).toBe(width / 2);
        expect(layout.leftEnd - layout.left).toBe(
          layout.right - layout.rightStart
        );
        expect(layout.centerX - layout.leftEnd).toBe(
          layout.rightStart - layout.centerX
        );
        expect(layout.left).toBeGreaterThan(width * 0.16);
        expect(layout.right).toBeLessThan(width * 0.84);
        expect(layout.centerY - layout.lineWidth / 2).toBeGreaterThan(0);
        expect(layout.centerY + layout.lineWidth / 2).toBeLessThan(height);
        expect(layout.dotRadius).toBeGreaterThanOrEqual(2);
        expect(layout.leftEnd).toBeLessThan(
          layout.centerX - layout.dotRadius
        );
        expect(layout.rightStart).toBeGreaterThan(
          layout.centerX + layout.dotRadius
        );
      }
      const top = resolveCompleteShelfSpineOrnamentLayout(width, height, 0.09);
      const bottom = resolveCompleteShelfSpineOrnamentLayout(
        width,
        height,
        0.91
      );
      expect(top.centerY).toBe(height - bottom.centerY);
      expect(top.lineWidth).toBe(bottom.lineWidth);
      expect(top.dotRadius).toBe(bottom.dotRadius);
    }
  });

  it("uses native cover pixels without blurry upscaling", () => {
    const small = resolveCompleteShelfCoverTextureSize({
      naturalWidth: 384,
      naturalHeight: 576,
      coverAspectRatio: 0.48,
      economical: false,
    });
    const large = resolveCompleteShelfCoverTextureSize({
      naturalWidth: 2048,
      naturalHeight: 3072,
      coverAspectRatio: 0.6,
      economical: false,
    });
    const economical = resolveCompleteShelfCoverTextureSize({
      naturalWidth: 2048,
      naturalHeight: 3072,
      coverAspectRatio: 0.6,
      economical: true,
    });

    expect(small.width).toBeLessThanOrEqual(384);
    expect(small.height).toBeLessThanOrEqual(576);
    expect(large).toMatchObject({ width: 1024, height: 1706 });
    expect(economical).toMatchObject({ width: 320, height: 533 });
  });
  it("exposes only split transparent foil maps and disposes both", () => {
    const spec = buildCompleteShelfBookSpec(
      {
        key: "foil-book",
        title: "Фольга",
        writer: "Автор",
        year: 1924,
        baseColor: "#3f244d",
        accentColor: "#d8b568",
        paperColor: "#e8dcc4",
      },
      0
    );
    expect(createCompleteShelfArtworkTextures(spec, false)).toEqual({
      frontFoil: null,
      frontFoilEmboss: null,
      spineFoil: null,
      spineFoilEmboss: null,
      spineSurface: null,
    });

    const frontDispose = vi.fn();
    const spineDispose = vi.fn();
    disposeCompleteShelfTextures([
      { dispose: frontDispose } as unknown as CanvasTexture,
      null,
      { dispose: spineDispose } as unknown as CanvasTexture,
    ]);
    expect(frontDispose).toHaveBeenCalledOnce();
    expect(spineDispose).toHaveBeenCalledOnce();
  });

  it("requests an already-authorized presentation cover and cancels safely", () => {
    const image = {
      complete: false,
      decoding: "auto",
      naturalHeight: 0,
      naturalWidth: 0,
      onerror: null,
      onload: null,
      src: "",
    };
    vi.stubGlobal("document", {
      createElement: vi.fn((tagName: string) => {
        expect(tagName).toBe("img");
        return image;
      }),
    });
    const onReady = vi.fn();
    const cancel = loadCompleteShelfCoverTexture(
      {
        coverUrl:
          "/probpera-literary-map/brand/book-covers/thumbs/nineteen-eighty-four-editorial.webp",
        baseColor: "#1f4057",
        coverAspectRatio: 0.48,
        economical: false,
      },
      onReady
    );

    expect(image.src).toContain("nineteen-eighty-four-editorial.webp");
    expect(typeof image.onload).toBe("function");
    cancel();
    expect(image.src).toBe("");
    expect(image.onload).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
  });
});
