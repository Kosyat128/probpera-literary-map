import { describe, expect, it } from "vitest";
import { GLOBE_EDITION_IDS } from "../components/globeEditions";
import { installPlanetAppearance, planetAppearanceVariables } from "./planetAppearance";

function luminance(hex: string) {
  const linear = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

describe("globe-derived application palette", () => {
  it.each(GLOBE_EDITION_IDS)("keeps normal text and control contrast in %s", (edition) => {
    const p = planetAppearanceVariables(edition);
    for (const background of [p["--planet-surface"], p["--planet-card"]]) {
      for (const text of [p["--planet-ink"], p["--planet-muted"], p["--planet-accent-strong"]]) {
        expect(contrast(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const background of [p["--planet-chrome"], p["--planet-chrome-raised"], p["--planet-space"]]) {
      for (const text of [p["--planet-on-dark"], p["--planet-muted-dark"], p["--planet-accent"]]) {
        expect(contrast(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(p["--planet-on-dark"], p["--planet-accent-strong"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p["--planet-ink"], p["--planet-accent"])).toBeGreaterThanOrEqual(4.5);
  });
});

// Only the DOM attributes/style ownership seam is simulated here. Real CSS,
// computed backgrounds and the unchanged Canvas are covered by browser tests.
function element() {
  const attributes = new Map<string, string>();
  const styles = new Map<string, { value: string; priority: string }>();
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    removeAttribute: (name: string) => { attributes.delete(name); },
    style: {
      getPropertyValue: (name: string) => styles.get(name)?.value ?? "",
      getPropertyPriority: (name: string) => styles.get(name)?.priority ?? "",
      setProperty: (name: string, value: string, priority = "") => { styles.set(name, { value, priority }); },
      removeProperty: (name: string) => { styles.delete(name); },
    },
  };
}
function fixture(application = true) {
  const app = element(), body = element();
  const globe = {
    closest: () => application ? app : null,
    ownerDocument: { body },
  } as unknown as HTMLElement;
  return { app, body, globe };
}
describe("appearance projection ownership", () => {
  it("leaves the public website and body untouched", () => {
    const f = fixture(false);
    expect(installPlanetAppearance(f.globe, "nasa-blue-marble")).toBeUndefined();
    expect(f.body.getAttribute("data-planet-portal-edition")).toBeNull();
    expect(f.body.style.getPropertyValue("--planet-chrome")).toBe("");
  });
  it("survives effect replay and restores the previous inline value/priority at unmount", () => {
    const f = fixture();
    f.app.style.setProperty("--planet-space", "#123456", "important");
    const first = installPlanetAppearance(f.globe, "rand-mcnally-1887");
    first?.();
    const second = installPlanetAppearance(f.globe, "nasa-blue-marble");
    expect(f.app.getAttribute("data-planet-edition")).toBe("nasa-blue-marble");
    expect(f.body.style.getPropertyValue("--planet-chrome")).toBe(f.app.style.getPropertyValue("--planet-chrome"));
    second?.();
    expect(f.app.style.getPropertyValue("--planet-space")).toBe("#123456");
    expect(f.app.style.getPropertyPriority("--planet-space")).toBe("important");
    expect(f.app.getAttribute("data-planet-edition")).toBeNull();
    expect(f.body.getAttribute("data-planet-portal-edition")).toBeNull();
    expect(f.body.style.getPropertyValue("--planet-chrome")).toBe("");
  });
  it("does not overwrite a newer host property or portal marker during cleanup", () => {
    const f = fixture();
    const cleanup = installPlanetAppearance(f.globe, "natural-earth-2026");
    f.app.style.setProperty("--planet-space", "#987654");
    f.body.setAttribute("data-planet-portal-edition", "new-owner");
    cleanup?.();
    expect(f.app.style.getPropertyValue("--planet-space")).toBe("#987654");
    expect(f.body.getAttribute("data-planet-portal-edition")).toBe("new-owner");
    expect(f.app.style.getPropertyValue("--planet-chrome")).toBe("");
  });
});
