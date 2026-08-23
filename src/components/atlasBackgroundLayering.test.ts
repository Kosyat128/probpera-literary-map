import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u"))?.[1] ?? "";
}

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

  it("hides duplicate globe labels beneath the open mobile country sheet", () => {
    const mobileSheetOcclusionRule = css.match(
      /\.atlas-experience-surface\[data-atlas-panel-state="open"\] \.literary-globe \.globe-country-label,\s*\.atlas-experience-surface\[data-atlas-panel-state="open"\] \.literary-globe \.globe-instruction\s*\{([^}]*)\}/u
    )?.[1] ?? "";

    expect(mobileSheetOcclusionRule).toContain("display: none");
  });

  it("keeps touch and zoom controls clear of every mobile country-sheet state", () => {
    const clearance = "max(24px, env(safe-area-inset-bottom))";

    for (const state of ["collapsed", "half", "expanded"]) {
      expect(
        cssRule(
          `.atlas-experience-surface[data-atlas-panel-state="open"][data-atlas-sheet-state="${state}"] .globe-touch-activation`
        )
      ).toContain(clearance);
    }

    expect(
      cssRule(
        '.atlas-experience-surface[data-atlas-panel-state="open"][data-atlas-sheet-state="collapsed"] .literary-globe .globe-controls'
      )
    ).toContain(clearance);
  });
});
