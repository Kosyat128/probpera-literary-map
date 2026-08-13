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
});
