import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FontUploadValidationError,
  MAX_FONT_UPLOAD_BYTES,
  isDatabaseUniqueConflict,
  isStorageObjectAlreadyPresent,
  parseFontUploadMetadata,
  validateFontFile,
} from "./font-upload";

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
    expect(() =>
      validateFontFile({
        bytes: fontBytes("wOF2"),
        mimeType: "font/woff2",
        originalName: "archive.ttf",
      })
    ).toThrow("Допустимы только файлы WOFF2");
    expect(() =>
      validateFontFile({
        bytes: fontBytes("wOF2"),
        mimeType: "application/octet-stream",
        originalName: "archive.woff2",
      })
    ).toThrow("Тип файла не соответствует");
    expect(() =>
      validateFontFile({
        bytes: fontBytes("wOFF"),
        mimeType: "font/woff2",
        originalName: "archive.woff2",
      })
    ).toThrow("проверку сигнатуры");
  });

  it("enforces the two MiB limit", () => {
    const bytes = fontBytes("wOF2", MAX_FONT_UPLOAD_BYTES + 1);
    expect(() =>
      validateFontFile({
        bytes,
        mimeType: "font/woff2",
        originalName: "archive.woff2",
      })
    ).toThrowError(FontUploadValidationError);
    try {
      validateFontFile({
        bytes,
        mimeType: "font/woff2",
        originalName: "archive.woff2",
      });
    } catch (error) {
      expect(error).toMatchObject({ status: 413 });
    }
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
    [{ displayName: "@import url(https://evil.example/font.woff2)" }, "CSS-конструкцию"],
    [{ familyName: "https://evil.example/font.woff2" }, "недопустимую ссылку"],
    [{ weightMin: "700", weightMax: "300" }, "не может быть больше"],
    [{ weightMin: "300", weightMax: "700", isVariable: "false" }, "обычного файла"],
    [{ weightMax: "1001" }, "от 1 до 1000"],
    [{ weightMin: "regular" }, "должна быть целым числом"],
    [{ style: "upright" }, "допустимое начертание"],
    [{ licenseName: "" }, "название лицензии"],
    [{ licenseUrl: "data:text/plain,font" }, "http или https"],
  ])("rejects unsafe or invalid metadata: %o", (override, message) => {
    expect(() =>
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
      })
    ).toThrow(message);
  });

  it("never removes a pre-existing or conflict-shared hash", () => {
    expect(isStorageObjectAlreadyPresent({ statusCode: "409" })).toBe(true);
    expect(isStorageObjectAlreadyPresent({ message: "The resource already exists" })).toBe(
      true
    );
    expect(isDatabaseUniqueConflict({ code: "23505" })).toBe(true);
  });
});
