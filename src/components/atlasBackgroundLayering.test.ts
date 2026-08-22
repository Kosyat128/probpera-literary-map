import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("literary planet background layering", () => {
  it("keeps the branded brush behind the isolated WebGL experience", () => {
    expect(css).toMatch(
      /\.atlas-section::after\s*\{[\s\S]*?z-index:\s*1;/u
    );
    expect(css).toMatch(
      /\.atlas-experience-slot\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?isolation:\s*isolate;/u
    );
    expect(css).toMatch(
      /\.atlas-experience-surface\s*\{[\s\S]*?isolation:\s*isolate;/u
    );
  });

  it("confines the orange brush to the bottom decorative band", () => {
    const brushRule = css.match(/\.atlas-section::after\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    expect(brushRule).toContain("bottom: 0");
    expect(brushRule).toContain("height: clamp(220px, 24vw, 390px)");
    expect(brushRule).toContain("center bottom");
    expect(brushRule).not.toContain("inset: 0");
  });
});
