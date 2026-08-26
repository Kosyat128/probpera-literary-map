import type { CanvasTexture } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCompleteShelfBookSpec } from "./completeShelfModel";
import {
  buildCompleteShelfArtworkPlan,
  createCompleteShelfArtworkTextures,
  disposeCompleteShelfTextures,
  loadCompleteShelfCoverTexture,
  resolveCompleteShelfCoverTextureSize,
  wrapCompleteShelfArtworkText,
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
    expect(plan.spineTitleLines.join(" ")).toBe("Великая книга пера");
    expect(plan.spineWriterLines.join(" ")).toBe("Автор Архива");
    expect(plan.spineTitle).toBe("Великая книга пера");
    expect(plan.writer).toBe("Автор Архива");
    expect(plan.yearLabel).toBe("1912");
    expect(plan.baseColor).toBe("#3f244d");
    expect(plan.paperColor).toBe("#e8dcc4");
    expect(plan.accentColor).toBe("#d8b568");
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
