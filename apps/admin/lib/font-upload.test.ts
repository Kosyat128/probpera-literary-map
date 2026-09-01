import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FontUploadValidationError,
  type FontUploadValidationErrorCode,
  MAX_FONT_UPLOAD_BYTES,
  isDatabaseUniqueConflict,
  isStorageObjectAlreadyPresent,
  parseFontUploadMetadata,
  validateFontFile,
} from "./font-upload";

function expectValidationCode(
  operation: () => unknown,
  code: FontUploadValidationErrorCode,
  status: 400 | 413 | 415 = 400
) {
  try {
    operation();
    throw new Error(`Expected font upload validation error: ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(FontUploadValidationError);
    expect(error).toMatchObject({ code, status });
  }
}

function fontBytes(magic: "wOFF" | "wOF2", size = 16) {
  const bytes = new Uint8Array(size);
  bytes.set([...magic].map((character) => character.charCodeAt(0)));
  return bytes;
}

describe("font upload validation", () => {
  it.each([
    ["Archive.woff2", "font/woff2", "wOF2", "woff2"],
    ["Archive.woff", "application/font-woff", "wOFF", "woff"],
  ] as const)(
    "accepts a signed %s file and derives an immutable content path",
    (originalName, mimeType, magic, format) => {
      const bytes = fontBytes(magic);
      const sha256Hex = createHash("sha256").update(bytes).digest("hex");

      expect(validateFontFile({ bytes, mimeType, originalName })).toMatchObject({
        byteSize: bytes.byteLength,
        format,
        objectPath: `sha256/${sha256Hex.slice(0, 2)}/${sha256Hex}.${format}`,
        sha256Hex,
      });
    }
  );

  it("checks extension, MIME and magic independently", () => {
    expectValidationCode(
      () =>
        validateFontFile({
          bytes: fontBytes("wOF2"),
          mimeType: "font/woff2",
          originalName: "archive.ttf",
        }),
      "file_extension_invalid",
      415
    );
    expectValidationCode(
      () =>
        validateFontFile({
          bytes: fontBytes("wOF2"),
          mimeType: "application/octet-stream",
          originalName: "archive.woff2",
        }),
      "file_mime_invalid",
      415
    );
    expectValidationCode(
      () =>
        validateFontFile({
          bytes: fontBytes("wOFF"),
          mimeType: "font/woff2",
          originalName: "archive.woff2",
        }),
      "file_signature_invalid",
      415
    );
  });

  it("enforces the two MiB limit", () => {
    const bytes = fontBytes("wOF2", MAX_FONT_UPLOAD_BYTES + 1);
    expectValidationCode(
      () =>
        validateFontFile({
          bytes,
          mimeType: "font/woff2",
          originalName: "archive.woff2",
        }),
      "file_too_large",
      413
    );
  });

  it("normalizes Russian-facing metadata without coercing false to true", () => {
    expect(
      parseFontUploadMetadata({
        displayName: "  Литературный антиква  ",
        familyName: "  Проба Пера Serif  ",
        weightMin: "400",
        weightMax: "400",
        style: "italic",
        isVariable: "false",
        licenseName: "  OFL 1.1  ",
        licenseUrl: "https://scripts.sil.org/OFL",
      })
    ).toEqual({
      displayName: "Литературный антиква",
      familyName: "Проба Пера Serif",
      weightMin: 400,
      weightMax: 400,
      style: "italic",
      isVariable: false,
      licenseName: "OFL 1.1",
      licenseUrl: "https://scripts.sil.org/OFL",
    });
  });

  it.each([
    [
      { displayName: "@import url(https://evil.example/font.woff2)" },
      "display_name_unsafe",
    ],
    [{ familyName: "https://evil.example/font.woff2" }, "family_name_unsafe"],
    [{ weightMin: "700", weightMax: "300" }, "weight_order_invalid"],
    [
      { weightMin: "300", weightMax: "700", isVariable: "false" },
      "fixed_weight_range_invalid",
    ],
    [{ weightMax: "1001" }, "weight_max_range"],
    [{ weightMin: "regular" }, "metadata_weight_integer"],
    [{ style: "upright" }, "style_invalid"],
    [{ licenseName: "" }, "license_name_required"],
    [{ licenseUrl: "data:text/plain,font" }, "license_url_invalid"],
  ] as const)("rejects unsafe or invalid metadata: %o", (override, code) => {
    expectValidationCode(
      () =>
        parseFontUploadMetadata({
          displayName: "Литературный антиква",
          familyName: "Проба Пера Serif",
          weightMin: "400",
          weightMax: "400",
          style: "normal",
          isVariable: "false",
          licenseName: "OFL 1.1",
          licenseUrl: "",
          ...override,
        }),
      code
    );
  });

  it("never removes a pre-existing or conflict-shared hash", () => {
    expect(isStorageObjectAlreadyPresent({ statusCode: "409" })).toBe(true);
    expect(isStorageObjectAlreadyPresent({ message: "The resource already exists" })).toBe(
      true
    );
    expect(isDatabaseUniqueConflict({ code: "23505" })).toBe(true);
  });
});
