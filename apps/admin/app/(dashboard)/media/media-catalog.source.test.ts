import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("complete media catalog wiring", () => {
  it("uses counted range pagination instead of a fixed latest-files limit", () => {
    expect(pageSource).toContain('supabase.rpc("list_media_studio_assets"');
    expect(pageSource).toContain("p_offset: catalog.from");
    expect(pageSource).toContain("p_limit: MEDIA_CATALOG_PAGE_SIZE");
    expect(pageSource).toContain("assets[0]?.total_count");
    expect(pageSource).not.toContain(".limit(80)");
    expect(pageSource).toContain("mediaCatalogPageHref(catalog, totalPages)");
  });

  it("searches only through the parsed allowlisted catalog column", () => {
    expect(pageSource).toContain("parseMediaCatalogQuery(query)");
    expect(pageSource).toContain("p_search_column: catalog.column");
    expect(pageSource).toContain("p_search_pattern: catalog.pattern || null");
    expect(pageSource).toContain("Object.entries(mediaCatalogSearchFields)");
  });

  it("returns metadata saves and errors to the active filter and page", () => {
    expect(pageSource).toContain('name="catalog_q"');
    expect(pageSource).toContain('name="catalog_search_field"');
    expect(pageSource).toContain('name="catalog_state"');
    expect(pageSource).toContain('name="catalog_view"');
    expect(pageSource).toContain('name="catalog_page"');
    expect(actionsSource).toContain("parseMediaCatalogQuery({");
    expect(actionsSource).toContain("mediaCatalogPageHref(catalog, catalog.page, notice)");
    expect(actionsSource).toContain(
      'catalogTarget({ saved: "1", published: publication.state })'
    );
  });

  it("offers list/grid display and a server-previewed atomic replacement", () => {
    expect(pageSource).toContain("mediaCatalogViews");
    expect(pageSource).toContain('catalog.view === "list"');
    expect(pageSource).toContain('supabase.rpc("preview_media_asset_replacement"');
    expect(pageSource).toContain("replaceMediaCurrentUsagesAction");
    expect(pageSource).toContain("Заменить во всех текущих местах");
    expect(actionsSource).toContain('"replace_media_asset_current_usages"');
    expect(actionsSource).toContain("p_expected_usage_refs: expectedUsageRefs");
    expect(actionsSource).toContain("p_selected_usage_refs: uniqueSelectedUsageRefs");
  });

  it("supports bounded, version-checked bulk metadata updates with an audit trail", () => {
    expect(pageSource).toContain('id="media-bulk-metadata"');
    expect(pageSource).toContain('name="media_selection"');
    expect(pageSource).toContain("bulkUpdateMediaMetadataAction");
    expect(actionsSource).toContain("parseMediaVersionSnapshots");
    expect(actionsSource).toContain("parseBulkMediaMetadataPatch");
    expect(actionsSource).toContain('.eq("updated_at", item.updatedAt)');
    expect(actionsSource).toContain('action: "media.bulk_metadata_updated"');
  });

  it("requires preview, explicit confirmation and a fresh orphan snapshot", () => {
    expect(pageSource).toContain('query.orphan_cleanup === "preview"');
    expect(pageSource).toContain('name="orphan_preview_snapshot"');
    expect(pageSource).toContain('name="confirm_orphan_cleanup"');
    expect(pageSource).toContain("ORPHAN_CLEANUP_CONFIRMATION");
    expect(actionsSource).toContain("mediaSnapshotSetsMatch(expectedPreview.data, currentPreview)");
    expect(actionsSource).toContain('supabase.rpc("trash_media_asset"');
    expect(actionsSource).toContain('physicalPurge: false');
  });

  it("exposes only the owner-only staged and retryable permanent purge", () => {
    expect(pageSource).toContain('staff.role === "owner"');
    expect(pageSource).toContain("MEDIA_PURGE_CONFIRMATION");
    expect(pageSource).toContain("30 дней");
    expect(actionsSource).toContain('requireStaff(["owner"])');
    expect(actionsSource).toContain('"prepare_media_asset_purge"');
    expect(actionsSource).toContain(".remove([prepared.data.object_path])");
    expect(actionsSource).toContain('"cancel_media_asset_purge"');
    expect(actionsSource).toContain('"finalize_media_asset_purge"');
    expect(actionsSource).toContain("p_expected_updated_at: prepared.data.prepared_updated_at");
  });
});
