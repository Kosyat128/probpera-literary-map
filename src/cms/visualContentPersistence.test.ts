import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync(
  new URL(
    "../../apps/admin/app/(dashboard)/visual-content-actions.ts",
    import.meta.url
  ),
  "utf8"
);
const bridgeSource = readFileSync(
  new URL("./directEditBridge.tsx", import.meta.url),
  "utf8"
);
const exporterSource = readFileSync(
  new URL("../../scripts/export-published-content.mjs", import.meta.url),
  "utf8"
);
const previewSource = readFileSync(
  new URL(
    "../../apps/admin/components/HomepageVisualPreview.tsx",
    import.meta.url
  ),
  "utf8"
);
const pageRevisionMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260730_page_revision_history.sql",
    import.meta.url
  ),
  "utf8"
);
const siteChromeRevisionMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260812_writer_and_work_revisions.sql",
    import.meta.url
  ),
  "utf8"
);

describe("visual page and site-chrome persistence", () => {
  it("requires staff, audits the exact field and requests a public build", () => {
    expect(actionSource).toContain("await requireStaff()");
    expect(actionSource).toContain('.from("admin_audit_log")');
    expect(actionSource).toContain("field: edit.field");
    expect(actionSource).toContain("await requestPublicBuild");
  });

  it("updates only currently published or visible records", () => {
    expect(actionSource).toContain('.eq("status", "published")');
    expect(actionSource).toContain('.eq("is_visible", true)');
    expect(actionSource).toContain('.eq("is_active", true)');
    expect(actionSource).toContain('.eq("is_enabled", true)');
  });

  it("preserves custom homepage settings and existing revision triggers", () => {
    expect(actionSource).toContain("...existingSettings");
    expect(actionSource).toContain("[edit.field]: edit.value");
    expect(pageRevisionMigration).toContain("before update on public.pages");
    expect(siteChromeRevisionMigration).toContain(
      "before update or delete on public.navigation_items"
    );
    expect(siteChromeRevisionMigration).toContain(
      "before update or delete on public.banners"
    );
  });

  it("exports stable media identities instead of relying on a partial URL lookup", () => {
    expect(exporterSource).toContain("backgroundMediaId: block.background_media_id");
    expect(exporterSource).toContain("desktopMediaId: banner.desktop_media_id");
    expect(exporterSource).toContain("tabletMediaId: banner.tablet_media_id");
    expect(exporterSource).toContain("mobileMediaId: banner.mobile_media_id");
    expect(previewSource).toContain("?.id || next.value");
    expect(previewSource).toContain(
      "isSavingInline || isLoadingInlineVersion || !inlineVersionReady || hasUnresolvedMedia"
    );
  });

  it("never converts managed CMS entity prose into generic interface copy", () => {
    expect(bridgeSource).toContain(
      'if (marker.closest("[data-cms-entity]")) return null;'
    );
    expect(bridgeSource).toContain(
      'entityType === "page" && field === "contentHtml"'
    );
    expect(bridgeSource).toContain('anchor.setAttribute("href", href)');
  });
});
