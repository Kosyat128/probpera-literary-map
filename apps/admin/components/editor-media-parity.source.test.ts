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
const articleCoreSource = readFileSync(
  new URL("./article-editor/EditorCore.tsx", import.meta.url),
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
const workflowSource = readFileSync(
  new URL("./useEditorMediaWorkflow.ts", import.meta.url),
  "utf8"
);
const dialogSource = readFileSync(
  new URL("./EditorMediaDialog.tsx", import.meta.url),
  "utf8"
);
const uploaderSource = readFileSync(
  new URL("./MediaUploader.tsx", import.meta.url),
  "utf8"
);
const assetsRouteSource = readFileSync(
  new URL("../app/api/media/assets/route.ts", import.meta.url),
  "utf8"
);

describe("shared editor media parity", () => {
  it("uses one typed upload helper and carries the stable media id", () => {
    expect(articleSource).toContain("useEditorMediaWorkflow");
    expect(pageSource).toContain("useEditorMediaWorkflow");
    expect(workflowSource).toContain("uploadEditorImage(file");
    expect(workflowSource).toContain("mediaId: result.mediaId");
    expect(uploaderSource).toContain("uploadEditorImage(sourceFile");
    expect(uploaderSource).not.toContain('fetch(withClientAdminPath("/api/media/upload")');
    expect(uploadRouteSource).toContain("mediaId: data.id");
    expect(uploadRouteSource).toContain("id: data.id");
  });

  it("renders a nullable media id in editorial image HTML", () => {
    expect(imageExtensionSource).toContain("mediaId: {");
    expect(imageExtensionSource).toContain('element.getAttribute("data-media-id")');
    expect(imageExtensionSource).toContain('"data-media-id": mediaId.trim()');
  });

  it("gives pages direct upload and exact image replacement without prompts", () => {
    expect(workflowSource).toContain("EDITOR_IMAGE_REPLACE_EVENT");
    expect(workflowSource).toContain("updateEditorialImageAt(");
    expect(workflowSource).toContain("target.expectedSrc");
    expect(pageSource).toContain("Изображение с компьютера");
    expect(pageSource).not.toContain("window.prompt");
    expect(pageSource).toContain("disabled={imageUploadPending}");
  });

  it("keeps ordered multi-file cursor insertion and single exact replacement", () => {
    expect(workflowSource).toContain("isAcceptedClientImageType(file.type)");
    expect(articleSource).toContain(
      "handleEditorPaste: editorMedia.handlePaste"
    );
    expect(articleCoreSource).toContain(
      "onPasteCapture={actions.handleEditorPaste}"
    );
    expect(pageSource).toContain("onPasteCapture={editorMedia.handlePaste}");
    expect(workflowSource).toContain(
      'target.kind === "insert" || target.kind === "collection"'
    );
    expect(workflowSource).toContain(
      'nextTarget.kind === "insert" || nextTarget.kind === "collection"'
    );
    expect(workflowSource).toContain("uploaded.map((item) => ({ type: \"image\"");
    expect(workflowSource).toContain("replaceMediaSlotAt(editor, target.position");
  });

  it("offers a cancellable retryable stage queue and read-only media library", () => {
    expect(dialogSource).toContain('prepare: "Подготовка"');
    expect(dialogSource).toContain('upload: "Загрузка"');
    expect(dialogSource).toContain('attach: "Вставка в материал"');
    expect(dialogSource).toContain("onCancelItem(item.id)");
    expect(dialogSource).toContain("onRetryItem(item.id)");
    expect(dialogSource).toContain("Автор:");
    expect(dialogSource).toContain("Источник:");
    expect(dialogSource).toContain("Лицензия:");
    expect(assetsRouteSource).toContain('export async function GET(request: Request)');
    expect(assetsRouteSource).not.toContain("export async function POST");
    expect(workflowSource).toContain("Изображение из медиатеки вставлено без повторной загрузки");
  });

  it("collects multiple secure media assets for article and page galleries", () => {
    expect(workflowSource).toContain('kind: "collection"');
    expect(workflowSource).toContain("target.onCollect(");
    expect(workflowSource).toContain("openCollectionLibrary");
    expect(workflowSource).toContain("openCollectionPicker");
    expect(workflowSource).toContain("source: asset.sourceUrl");
    expect(workflowSource).toContain("license: asset.licenseName");
    expect(workflowSource).toContain("licenseUrl: asset.licenseUrl");
    expect(workflowSource).not.toContain("link: asset.sourceUrl");
    expect(dialogSource).toContain("collectionMode");
    expect(dialogSource).toContain("Загрузить несколько изображений");
    expect(articleSource).toContain("openCollectionLibrary(appendMediaComposerItems)");
    expect(articleSource).toContain("openCollectionPicker(appendMediaComposerItems)");
    expect(pageSource).toContain("openCollectionLibrary(appendMediaComposerItems)");
    expect(pageSource).toContain("openCollectionPicker(appendMediaComposerItems)");
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
