import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const articleSource = readFileSync(
  new URL("./ArticleEditor.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("./PageEditor.tsx", import.meta.url),
  "utf8"
);
const imageExtensionSource = readFileSync(
  new URL("./EditorialImage.ts", import.meta.url),
  "utf8"
);
const uploadRouteSource = readFileSync(
  new URL("../app/api/media/upload/route.ts", import.meta.url),
  "utf8"
);

describe("shared editor media parity", () => {
  it("uses one typed upload helper and carries the stable media id", () => {
    expect(articleSource).toContain("uploadEditorImage(file");
    expect(pageSource).toContain("uploadEditorImage(file");
    expect(articleSource).toContain("mediaId: result.mediaId");
    expect(pageSource).toContain("mediaId: result.mediaId");
    expect(uploadRouteSource).toContain("mediaId: data.id");
    expect(uploadRouteSource).toContain("id: data.id");
  });

  it("renders a nullable media id in editorial image HTML", () => {
    expect(imageExtensionSource).toContain("mediaId: {");
    expect(imageExtensionSource).toContain('element.getAttribute("data-media-id")');
    expect(imageExtensionSource).toContain('"data-media-id": mediaId.trim()');
  });

  it("gives pages direct upload and exact image replacement without prompts", () => {
    expect(pageSource).toContain("EDITOR_IMAGE_REPLACE_EVENT");
    expect(pageSource).toContain("updateEditorialImageAt(");
    expect(pageSource).toContain("selection.expectedSrc");
    expect(pageSource).toContain("Изображение с компьютера");
    expect(pageSource).not.toContain("window.prompt");
    expect(pageSource).toContain("imageUploadInFlightRef.current");
    expect(pageSource).toContain("disabled={imageUploadPending}");
  });

  it("clears a stale media-library identity for manual URL replacement", () => {
    expect(articleSource).toContain("mediaId: null");
  });

  it("uses the controlled safe-link dialog in both editors", () => {
    expect(articleSource).toContain("<EditorLinkDialog");
    expect(pageSource).toContain("<EditorLinkDialog");
    expect(articleSource).not.toContain('window.prompt("Адрес ссылки"');
    expect(pageSource).not.toContain('window.prompt("Адрес ссылки"');
  });
});
