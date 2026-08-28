import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const homepagePage = readFileSync(
  new URL("../app/(dashboard)/homepage/page.tsx", import.meta.url),
  "utf8"
);
const homepageActions = readFileSync(
  new URL("../app/(dashboard)/homepage/actions.ts", import.meta.url),
  "utf8"
);
const homepageMediaField = readFileSync(
  new URL("../components/HomepageMediaField.tsx", import.meta.url),
  "utf8"
);
const publicHomepageCms = readFileSync(
  new URL("../../../src/data/cms/homepage.ts", import.meta.url),
  "utf8"
);
const publicBookArchive = readFileSync(
  new URL("../../../src/components/BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const directEditBridge = readFileSync(
  new URL("../../../src/cms/directEditBridge.tsx", import.meta.url),
  "utf8"
);
const cmsFoundation = readFileSync(
  new URL(
    "../../../supabase/migrations/20260728_cms_foundation.sql",
    import.meta.url
  ),
  "utf8"
);

describe("book archive homepage CMS wiring", () => {
  it("registers book-archive in both public and admin core allowlists", () => {
    expect(homepagePage).toContain('key: "book-archive"');
    expect(homepageActions).toContain('"book-archive": "carousel"');
    expect(publicHomepageCms).toContain('| "book-archive"');
  });

  it("renders only closed scene and image controls with a complete reset", () => {
    for (const key of [
      "bookScenePreset",
      "bookSceneDarkness",
      "bookSceneDynamicThemes",
      "bookSceneIntensity",
      "bookSceneAmbientTint",
      "bookSceneShelfMaterial",
      "imageFit",
      "imagePosition",
      "imageZoom",
      "imageBrightness",
      "imageContrast",
      "imageSaturation",
      "imageBlur",
      "imageOverlay",
    ]) {
      expect(homepagePage).toContain(`name="${key}"`);
    }
    expect(homepagePage).toContain('name="reset_book_scene_settings"');
    expect(homepageActions).toContain("mergeBookArchiveSceneSettings(");
    expect(homepageActions).toContain("mergeHomepageVisualSettings(");
  });

  it("fails closed on media rights and disables unreviewed inline uploads", () => {
    expect(homepagePage).toContain("isBookArchiveBackgroundMediaSafe(asset)");
    expect(homepagePage).toContain(
      'allowUpload={section.key !== "book-archive"}'
    );
    expect(homepageMediaField).toContain("allowUpload = true");
    expect(homepageActions).toContain(
      '.select("mime_type,alt_text,creator,source_url,license_name,license_url")'
    );
    expect(homepageActions).toContain(
      "bookArchiveBackgroundMediaIssue(sceneMedia)"
    );
  });

  it("stores the allowlisted values in the existing homepage JSONB", () => {
    expect(cmsFoundation).toContain("settings jsonb not null default '{}'::jsonb");
    expect(homepageActions).toContain("...nextSettings");
    expect(homepageActions).toContain("coreSectionKey,");
  });

  it("keeps the scene background live-preview layer present and away from covers", () => {
    expect(publicBookArchive).toContain(
      'className="book-shelf-frame__cms-background"'
    );
    expect(publicBookArchive).not.toContain(
      "coreBookArchive?.backgroundImageUrl ? ("
    );
    const previewHandler = directEditBridge.slice(
      directEditBridge.indexOf("function updatePreviewMarker")
    );
    const coreBackgroundBranch = previewHandler.indexOf(
      'marker.dataset.cmsEntity === "homepage-core"'
    );
    const genericDescendantImage = previewHandler.indexOf(
      'marker.querySelector<HTMLImageElement>("img")'
    );
    expect(coreBackgroundBranch).toBeGreaterThan(-1);
    expect(coreBackgroundBranch).toBeLessThan(genericDescendantImage);
  });

  it("resets only scene/image keys and preserves title/body typography", () => {
    expect(homepageActions).toContain("resetHomepageImageVisualSettings(");
    expect(homepageActions).toContain(
      'formData.get("reset_visual_settings") === "1"'
    );
    expect(homepageActions).not.toContain(
      'formData.get("reset_visual_settings") === "1" ||'
    );
  });
});
