import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  FONT_UPLOAD_ERROR_MESSAGES,
} from "../../../(dashboard)/site-studio/fonts/font-upload-error-messages";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const validationSource = readFileSync(
  new URL("../../../../lib/font-upload.ts", import.meta.url),
  "utf8"
);

describe("site font upload route source contract", () => {
  it("uses staff authentication and the immutable site-fonts storage contract", () => {
    expect(source).toContain('requireStaff(["owner", "admin"])');
    expect(source).toContain("hasForbiddenRemoteFontInput(formData)");
    expect(source.indexOf("file.size > MAX_FONT_UPLOAD_BYTES")).toBeLessThan(
      source.indexOf("file.arrayBuffer()")
    );
    expect(source).toContain("validateFontFile({");
    expect(source).toContain("supabase.storage.from(SITE_FONT_BUCKET)");
    expect(source).toContain("upsert: false");
    expect(source).toContain('.from("font_assets")');
    expect(source).toContain('source_type: "uploaded"');
    expect(source).toContain("storage_bucket: SITE_FONT_BUCKET");
    expect(source).toContain("font_style: metadata.style");
    expect(source).toContain("uploaded_by: session.user.id");
  });

  it("does not delete a pre-existing content hash after a database conflict", () => {
    const insertFailure = source.indexOf("if (insertError)");
    const conflict = source.indexOf("isDatabaseUniqueConflict(insertError)", insertFailure);

    expect(insertFailure).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(insertFailure);
    expect(source).not.toContain("storage.remove(");
    expect(source).not.toMatch(/fetch\s*\(\s*(?:font|remote|import)/u);
  });

  it("returns compact stable codes and a minimal success payload", () => {
    expect(source).not.toMatch(/[А-Яа-яЁё]/u);
    expect(source).toContain("{ errorCode }");
    expect(source).toContain("return errorResponse(error.code, error.status)");
    expect(source).toContain("ok: true");
    expect(source).toContain("id: data.id");
    expect(source).toContain("displayName: metadata.displayName");
    expect(source).not.toContain("sourceType:");
    expect(source).not.toContain("objectPath:");
    expect(source).not.toContain("sha256:");
    expect(source).not.toContain("byteSize:");
  });

  it("keeps every server error code covered by the client-only Russian map", () => {
    const explicitRouteCodes = Array.from(
      source.matchAll(/errorResponse\(\s*"([a-z_]+)"/gu),
      (match) => match[1]
    );
    const validationCodes = [
      "display_name_required",
      "display_name_too_long",
      "display_name_unsafe",
      "family_name_required",
      "family_name_too_long",
      "family_name_unsafe",
      "file_empty",
      "file_extension_invalid",
      "file_mime_invalid",
      "file_name_invalid",
      "file_signature_invalid",
      "file_too_large",
      "fixed_weight_range_invalid",
      "license_name_required",
      "license_name_too_long",
      "license_url_invalid",
      "license_url_too_long",
      "metadata_invalid",
      "metadata_weight_integer",
      "style_invalid",
      "variable_flag_invalid",
      "weight_max_integer",
      "weight_max_range",
      "weight_min_integer",
      "weight_min_range",
      "weight_order_invalid",
    ] as const;

    expect(validationSource).not.toMatch(/[А-Яа-яЁё]/u);
    for (const code of [...explicitRouteCodes, ...validationCodes]) {
      expect(FONT_UPLOAD_ERROR_MESSAGES).toHaveProperty(code);
    }
  });
});
