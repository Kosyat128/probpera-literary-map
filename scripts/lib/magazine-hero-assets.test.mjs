import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const asset = (name) => path.join(root, "public", "brand", name);

describe("main magazine hero", () => {
  it.each([
    ["magazine-hero-wide.webp", 1774, 887],
    ["magazine-hero-wide.avif", 1774, 887],
    ["magazine-hero-mobile.webp", 941, 1672],
    ["magazine-hero-mobile.avif", 941, 1672],
  ])("keeps the intended source composition in %s", async (name, width, height) => {
    const metadata = await sharp(asset(name)).metadata();
    expect(metadata.width).toBe(width);
    expect(metadata.height).toBe(height);
  });

  it("builds mobile output from a separate portrait source without pixel cropping", async () => {
    const source = await readFile(
      path.join(root, "scripts", "prepare-magazine-hero.mjs"),
      "utf8"
    );
    expect(source).toContain("mobileSourcePath");
    expect(source).not.toContain(".extract(");
  });

  it("keeps the independent desktop and mobile source compositions", async () => {
    const desktop = await sharp(
      path.join(root, "scripts", "assets", "magazine-hero-wide-source.png")
    ).metadata();
    const mobile = await sharp(
      path.join(root, "scripts", "assets", "magazine-hero-mobile-portrait-source.png")
    ).metadata();

    expect([desktop.width, desktop.height]).toEqual([1774, 887]);
    expect([mobile.width, mobile.height]).toEqual([941, 1672]);
  });
});
