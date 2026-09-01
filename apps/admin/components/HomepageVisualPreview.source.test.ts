import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const previewSource = readFileSync(
  new URL("./HomepageVisualPreview.tsx", import.meta.url),
  "utf8"
);

describe("homepage visual editor save and preview wiring", () => {
  it("keeps the saving state active for the complete server-action promise", () => {
    expect(previewSource).not.toContain("useTransition");
    expect(previewSource).toContain("const result = await operation();");
    expect(previewSource).toContain("savingInlineRef.current = true;");
    expect(previewSource).toContain("finally {");
    expect(previewSource).toContain("setIsSavingInline(false)");
  });

  it("sends only the structured visual-settings payload to the preview", () => {
    expect(previewSource).toContain('type: "preview-style-update"');
    expect(previewSource).toContain("styles: next");
    expect(previewSource).toContain("reset,");
    expect(previewSource).toContain("Сбросить оформление");
    expect(previewSource).not.toContain("cssText:");
  });

  it("keeps strict bridge validation while accepting the rolling v1 preview", () => {
    expect(previewSource).toContain("const BRIDGE_VERSION = 2");
    expect(previewSource).toContain("const BRIDGE_LEGACY_VERSION = 1");
    expect(previewSource).toContain("event.origin !== previewOrigin");
    expect(previewSource).toContain(
      "event.source !== iframeRef.current?.contentWindow"
    );
    expect(previewSource).toContain("isReadyCapabilities(event.data.capabilities)");
    expect(previewSource).toContain("readPreviewSelection(event.data, version)");
    expect(previewSource).toContain("ownerLocked:");
    expect(previewSource).toContain("ancestry:");
    expect(previewSource).toContain("componentId:");
    expect(previewSource).toContain("instanceId:");
    expect(previewSource).toContain("breakpoint:");
    expect(previewSource).toContain("state:");
  });
});
