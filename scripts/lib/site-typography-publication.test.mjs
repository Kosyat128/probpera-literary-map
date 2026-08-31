import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  assertPublishedFontBytes,
  normalizePublishedTypography,
  publicFontMetadata,
} from "./site-typography-publication.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const bytes = Buffer.from("wOF2verified-font-payload");
const sha256Hex = createHash("sha256").update(bytes).digest("hex");

const override = {
  layer: "site",
  target_key: "global",
  semantic_scope: "article",
  breakpoint: "base",
  published_settings: { familyId: id, fontSize: 20, lineHeight: 1.6 },
};
const font = {
  id,
  family_name: "Archive Serif",
  source_type: "uploaded",
  format: "woff2",
  font_style: "normal",
  is_variable: true,
  weight_min: 300,
  weight_max: 800,
  sha256_hex: sha256Hex,
  storage_bucket: "site-fonts",
  object_path: `sha256/${sha256Hex.slice(0, 2)}/${sha256Hex}.woff2`,
  byte_size: bytes.byteLength,
};

describe("typography publication", () => {
  it("publishes only referenced content-addressed fonts", () => {
    const result = normalizePublishedTypography([override], [font, { ...font, id: crypto.randomUUID() }]);
    expect(result.overrides).toHaveLength(1);
    expect(result.fonts).toHaveLength(1);
    expect(publicFontMetadata(result.fonts[0])).toMatchObject({
      id,
      publicPath: `cms/fonts/${sha256Hex}.woff2`,
      isVariable: true,
    });
    expect(assertPublishedFontBytes(result.fonts[0], bytes)).toBe(bytes);
  });

  it("fails closed on arbitrary CSS and non-content-addressed objects", () => {
    expect(() => normalizePublishedTypography([
      { ...override, published_settings: { ...override.published_settings, color: "red" } },
    ], [font])).toThrow(/unknown setting color/u);
    expect(() => normalizePublishedTypography([override], [
      { ...font, object_path: "mutable/latest.woff2" },
    ])).toThrow(/content-addressed/u);
  });

  it("fails closed if the stored bytes no longer match metadata", () => {
    const result = normalizePublishedTypography([override], [font]);
    expect(() => assertPublishedFontBytes(result.fonts[0], Buffer.from("wOFFchanged"))).toThrow();
  });

  it("sorts published rules by the documented layer cascade", () => {
    const result = normalizePublishedTypography(
      [
        { ...override, layer: "instance", target_key: "sample" },
        { ...override, layer: "component", target_key: "sample" },
        { ...override, layer: "site", target_key: "site" },
      ],
      [font]
    );
    expect(result.overrides.map(({ layer }) => layer)).toEqual([
      "site",
      "component",
      "instance",
    ]);
  });

  it("keeps non-stable exports on the public RPC and fails closed for private bytes", () => {
    const exporter = readFileSync(
      new URL("../export-published-content.mjs", import.meta.url),
      "utf8"
    );
    expect(exporter).toContain("fetchPublishedTypographyInputs");
    expect(exporter).toContain("/rest/v1/rpc/get_published_site_typography");
    expect(exporter).toContain("Published self-hosted fonts require SUPABASE_SERVICE_ROLE_KEY");
  });
});
