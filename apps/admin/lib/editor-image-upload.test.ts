import { describe, expect, it } from "vitest";

import { normalizeEditorImageUploadResult } from "./editor-image-upload";

describe("normalizeEditorImageUploadResult", () => {
  it("prefers the additive mediaId contract", () => {
    expect(
      normalizeEditorImageUploadResult({
        ok: true,
        id: "legacy-id",
        mediaId: "media-id",
        url: "https://cdn.example/image.webp",
        width: 1200,
        height: 800,
      })
    ).toEqual({
      url: "https://cdn.example/image.webp",
      mediaId: "media-id",
      width: 1200,
      height: 800,
    });
  });

  it("accepts the legacy id response during rolling deployment", () => {
    expect(
      normalizeEditorImageUploadResult({
        ok: true,
        id: "legacy-id",
        url: "https://cdn.example/image.webp",
      })
    ).toEqual({
      url: "https://cdn.example/image.webp",
      mediaId: "legacy-id",
      width: 0,
      height: 0,
    });
  });

  it("rejects incomplete upload responses", () => {
    expect(normalizeEditorImageUploadResult({ ok: true, id: "media-id" })).toBeNull();
    expect(
      normalizeEditorImageUploadResult({
        ok: false,
        url: "https://cdn.example/image.webp",
      })
    ).toBeNull();
  });
});
