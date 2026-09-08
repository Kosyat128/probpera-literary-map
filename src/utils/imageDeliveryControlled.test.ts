import { afterEach, describe, expect, it, vi } from "vitest";
import initialManifest from "../data/imageDelivery.initial.generated.json";
import nativeSelection from "../../scripts/mobile/native-base-assets.json";
import { createControlledImageDeliveryResolver } from "./imageDeliveryControlled";
import { expandImageDeliveryManifest, type CompactImageDeliveryManifest } from "./imageDeliveryModel";

const entries = expandImageDeliveryManifest(initialManifest as unknown as CompactImageDeliveryManifest);
const selectedPaths = new Set(nativeSelection.files.map(file => file.output));
const selectedEntries = Object.entries(entries).filter(([source]) => selectedPaths.has(source.replace(/^\//u, "")));

describe.each(["/", "/planet/"])("controlled image delivery under %s", base => {
  const resolver = createControlledImageDeliveryResolver(entries, base);

  it("keeps every already-selected original local at all requested sizes", () => {
    expect(selectedEntries.length).toBeGreaterThan(0);
    for (const [source] of selectedEntries) {
      const expected = base + source.replace(/^\//u, "");
      for (const width of [320, 640, 1920, Infinity]) {
        expect(resolver.attributes(source, width, "50vw"), source).toEqual({ src: expected });
      }
      expect(selectedPaths.has(expected.slice(base.length)), source).toBe(true);
    }
  });

  it("maps every rendition alias of selected artwork back to its bundled original", () => {
    for (const [source, entry] of selectedEntries) {
      const expected = base + source.replace(/^\//u, "");
      for (const rendition of [entry, ...entry.variants]) {
        for (const alias of [rendition.src, base + rendition.src, "https://probpera.ru" + base + rendition.src]) {
          expect(resolver.url(alias), alias).toBe(expected);
          expect(resolver.original(alias), alias).toBe(source);
        }
      }
    }
  });

  it("preserves canonical local cache keys and leaves unmapped media policy to the caller", () => {
    expect(resolver.url("brand/probpera-logo.png?v=approved")).toBe(base + "brand/probpera-logo.png?v=approved");
    expect(resolver.url(base + "brand/probpera-logo.png")).toBe(base + "brand/probpera-logo.png");
    for (const source of ["https://example.org/original.png", "data:image/png;base64,abcd", "blob:local-image", ""]) {
      expect(resolver.url(source)).toBe(source);
    }
  });

  it("keeps lazy registrations as reverse aliases without enabling unbundled renditions", () => {
    const lazy = createControlledImageDeliveryResolver({}, base);
    const source = "brand/sections/literary-calendar.webp";
    const rendition = entries[source];
    expect(lazy.url(source)).toBe(base + source);
    lazy.register({ [source]: rendition });
    expect(lazy.attributes(source, 640)).toEqual({ src: base + source });
    expect(lazy.url(base + rendition.src)).toBe(base + source);
  });
});

afterEach(() => {
  vi.doUnmock("../platform/distribution");
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("selects original delivery through the shared controlled entry point", async () => {
  vi.resetModules();
  vi.doMock("../platform/distribution", () => ({ isControlledWebEdition: true }));
  vi.stubEnv("BASE_URL", "/planet/");
  const delivery = await import("./imageDelivery");
  const source = "brand/sections/about-editorial.webp";
  expect(delivery.publicImageAttributes(source, 640)).toEqual({ src: "/planet/" + source });
  expect(delivery.publicImageUrl(entries[source].src)).toBe("/planet/" + source);
});
