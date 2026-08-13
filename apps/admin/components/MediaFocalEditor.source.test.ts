import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(new URL("./MediaFocalEditor.tsx", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../app/(dashboard)/media/page.tsx", import.meta.url),
  "utf8"
);

describe("visual media focal-point editor", () => {
  it("offers pointer, keyboard and range control over the persisted focus", () => {
    expect(editor).toContain("onClick={choosePoint}");
    expect(editor).toContain("onKeyDown={nudgePoint}");
    expect(editor).toContain("[data-media-focal-plane]");
    expect(editor).toContain("mediaFocusFromPoint");
    expect(editor).toContain('name="focus_x"');
    expect(editor).toContain('name="focus_y"');
    expect(editor).toContain('type="range"');
  });

  it("previews all important responsive crops with object-position", () => {
    for (const label of ["Карточка 4:3", "Обложка 2:3", "Баннер 16:9", "Мобильный 9:16"]) {
      expect(editor).toContain(label);
    }
    expect(editor).toContain("style={{ objectPosition }}");
  });

  it("reads actual usage rows for only the visible catalog page", () => {
    expect(page).toContain('.from("media_usages")');
    expect(page).toContain('.in("media_id", assets.map((asset) => asset.id))');
    expect(page).toContain("usagesByMedia");
    expect(page).toContain('.in("cover_media_id", assetIds)');
    expect(page).toContain('.in("background_media_id", assetIds)');
    expect(page).toContain('.in("mobile_media_id", assetIds)');
    expect(page).toContain("<MediaFocalEditor");
  });
});
