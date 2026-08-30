import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");

const migration = read(
  "supabase/migrations/20260830_media_studio_lifecycle.sql"
);
const actions = read("apps/admin/app/(dashboard)/media/actions.ts");
const page = read("apps/admin/app/(dashboard)/media/page.tsx");
const upload = read("apps/admin/app/api/media/upload/route.ts");

describe("Phase 4 Media Studio lifecycle", () => {
  it("adds typed rights, content identity and recoverable replacement lineage", () => {
    expect(migration).toMatch(
      /create type public\.media_rights_status as enum \([\s\S]*'verified'[\s\S]*'editorial'[\s\S]*'public-domain'[\s\S]*'licensed'[\s\S]*'unknown'/u
    );
    expect(migration).toContain(
      "sha256_hex ~ '^[0-9a-f]{64}$'"
    );
    expect(migration).toContain("replacement_of_media_id uuid");
    expect(migration).toContain("replaced_by_media_id uuid");
    expect(migration).toContain("media_assets_replacement_not_self");
    expect(migration).toContain("media_assets_replacement_of_unique_idx");
    expect(migration).toContain("media_assets_replaced_by_unique_idx");
    expect(upload).toContain('createHash("sha256").update(bytes).digest("hex")');
    expect(upload).toContain("sha256_hex: sha256Hex");
  });

  it("uses one authoritative graph for live, rich-text, recovery and revision dependencies", () => {
    expect(migration).toContain(
      "create or replace function public.media_asset_usage_refs_internal"
    );
    for (const table of [
      "public.media_usages",
      "public.articles",
      "public.article_translations",
      "public.pages",
      "public.homepage_blocks",
      "public.banners",
      "public.article_revisions",
      "public.article_translation_revisions",
      "public.page_revisions",
      "public.homepage_block_revisions",
      "public.site_chrome_revisions",
      "public.editor_autosaves",
    ]) {
      expect(migration, table).toContain(table);
    }
    expect(migration).toContain(
      "create or replace function public.list_media_asset_usages"
    );
    expect(migration).toContain("cardinality(p_media_ids) > 100");
    expect(migration).toContain(
      "from public.media_asset_usage_refs_internal(array[p_media_id])"
    );
  });

  it("atomically synchronizes Article/Page media IDs and rejects missing or trashed assets", () => {
    expect(migration).toContain(
      "create or replace function public.editor_media_ids_from_json"
    );
    expect(migration).toContain("editor mediaId must be a UUID");
    expect(migration).toContain(
      "create or replace function public.editor_media_ids_from_html"
    );
    expect(migration).toContain(
      "create or replace function public.editor_media_refs_from_json"
    );
    expect(migration).toContain(
      "create or replace function public.editor_media_refs_from_html"
    );
    expect(migration).toContain(
      "create or replace function public.normalize_editor_media_source_url"
    );
    expect(migration).toContain("'&(amp|#0*38|#x0*26);'");
    expect(migration).toContain(
      "returns table (occurrence_index integer, media_id uuid, source_url text)"
    );
    expect(migration).toContain("group by media_id, source_url");
    const identityBody = migration.split(
      "create or replace function public.editor_media_identity_sets_match"
    )[1].split(
      "revoke all on function public.editor_media_identity_sets_match"
    )[0];
    expect(identityBody).toContain("public.editor_media_refs_from_html(p_html)");
    expect(identityBody).not.toContain("public.editor_media_ids_from_html(p_html)");
    expect(migration).toContain("char_length(p_html) > 2000000");
    expect(migration).toContain("editor HTML data-media-id must be a UUID");
    expect(migration).toContain(
      "create or replace function public.editor_media_identity_sets_match"
    );
    expect(migration).toContain(
      "editor JSON and HTML media identity sets do not match"
    );
    expect(migration).toContain(
      "existing editor JSON and HTML media identity sets do not match"
    );
    expect(migration).toContain(
      "existing editor content references missing or trashed media"
    );
    expect(migration).toContain(
      "existing direct reference targets missing or trashed media"
    );
    expect(migration).toContain("'{__probperaMediaReferences}'");
    expect(migration).toContain(
      "translation.content_json ? '__probperaPremiumTranslation'"
    );
    expect(migration).toContain("order by media_ref.occurrence_index");
    expect(migration).toContain("articles_sync_editor_media_usage");
    expect(migration).toContain("article_translations_sync_editor_media_usage");
    expect(migration).toContain("pages_sync_editor_media_usage");
    expect(migration).toContain(
      "update of content_json, content_html on public.articles"
    );
    expect(migration).toContain(
      "update of content_json, content_html on public.pages"
    );
    expect(migration).toContain("target_scope := 'content:ru'");
    expect(migration).toContain("'content:' || case");
    expect(migration).toMatch(
      /left join public\.media_assets asset[\s\S]*asset\.deleted_at is null[\s\S]*editor content references missing or trashed media/u
    );
    expect(migration).toContain(
      "create or replace function public.sync_media_usages("
    );
    expect(migration).toMatch(
      /revoke all on function public\.sync_media_usages\(text, uuid, jsonb\)\s+from public, anon, authenticated/u
    );
    expect(migration).toContain("for share;");
    expect(migration).toContain(
      "create or replace function public.guard_active_direct_media_refs_trigger"
    );
    for (const trigger of [
      "articles_guard_active_direct_media_refs",
      "homepage_blocks_guard_active_direct_media_refs",
      "banners_guard_active_direct_media_refs",
    ]) {
      expect(migration).toContain(trigger);
    }
    expect(migration).toMatch(
      /revoke insert, update, delete on table public\.media_usages\s+from authenticated/u
    );
    expect(migration).toMatch(
      /grant select on table public\.media_usages to authenticated;[\s\S]*create policy "Staff read media usage"[\s\S]*on public\.media_usages for select[\s\S]*to authenticated[\s\S]*using \(public\.is_staff\(\)\)/u
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.sync_media_usages[\s\S]*to authenticated/u
    );
  });

  it("keeps trash and replacement guarded, audited and non-destructive", () => {
    for (const rpc of [
      "trash_media_asset",
      "restore_media_asset",
      "register_media_replacement",
    ]) {
      expect(migration).toContain(`create or replace function public.${rpc}`);
      expect(migration).toMatch(
        new RegExp(
          `create or replace function public\\.${rpc}[\\s\\S]*security definer[\\s\\S]*set search_path = ''`,
          "u"
        )
      );
    }
    expect(migration).toMatch(
      /trash_media_asset[\s\S]*'owner'::public\.staff_role[\s\S]*'admin'::public\.staff_role/u
    );
    expect(migration).toContain(
      "current_asset.updated_at is distinct from p_expected_updated_at"
    );
    expect(migration).toContain("media asset is still in use");
    expect(migration).toContain("'media.trashed'");
    expect(migration).toContain("'media.restored'");
    expect(migration).toContain("'media.replacement_registered'");
    expect(migration).toContain("'physicalObjectDeleted', false");
    expect(migration).toContain(
      'drop policy if exists "Staff update editorial media" on storage.objects'
    );
    expect(migration).toContain(
      'drop policy if exists "Owners and admins delete editorial media"'
    );
    expect(migration).toContain(
      "revoke delete on table public.media_assets from authenticated"
    );
    expect(migration).toContain("create or replace function public.prepare_media_asset_purge");
    expect(migration).toContain("create or replace function public.finalize_media_asset_purge");
    expect(migration).toContain("create or replace function public.cancel_media_asset_purge");
    expect(migration).toContain("'owner'::public.staff_role");
    expect(migration).toContain("now() - interval '30 days'");
    expect(migration).toContain("current_asset.bucket <> 'editorial-media'");
    expect(migration).toContain("current_asset.replacement_of_media_id is not null");
    expect(migration).toContain("current_asset.replaced_by_media_id is not null");
    expect(migration).toContain("current_asset.purge_requested_by = actor_id");
    expect(migration).toMatch(
      /prepare_media_asset_purge[\s\S]*media storage identity is not canonical[\s\S]*purge_requested_by = actor_id[\s\S]*return query select asset\.id, asset\.purge_token/u
    );
    expect(migration).toContain("for update;");
    expect(migration).toContain("media_asset_usage_refs_internal(array[p_media_id])");
    expect(migration).toContain("media storage object still exists; purge not finalized");
    expect(migration).toContain("storage object was removed; finalize purge instead");
    expect(migration).toContain("public.editor_autosaves in share mode");
    expect(migration).toContain("create or replace function public.guard_pending_purge_snapshot_refs_trigger");
    for (const trigger of [
      "article_revisions_guard_pending_media_purge",
      "article_translation_revisions_guard_pending_media_purge",
      "page_revisions_guard_pending_media_purge",
      "homepage_block_revisions_guard_pending_media_purge",
      "site_chrome_revisions_guard_pending_media_purge",
      "editor_autosaves_guard_pending_media_purge",
    ]) expect(migration).toContain(trigger);
    expect(migration).toMatch(
      /create trigger editor_autosaves_guard_pending_media_purge\s+before insert or update of snapshot, expires_at/u
    );
    expect(migration).toContain("'media.purged'");
    expect(migration).toContain("'physicalObjectDeleted', true");
    expect(migration).not.toMatch(/delete from storage\.objects/u);
    expect(migration).toContain('create policy "Owner delete prepared editorial media"');
    expect(migration).toContain("asset.purge_requested_by = (select auth.uid())");
    expect(migration).toContain('create policy "Uploader delete fresh orphan editorial media"');
    expect(migration).toContain("owner_id = (select auth.uid())::text");
    expect(migration).toContain("created_at >= now() - interval '10 minutes'");
    expect(migration).toContain("and not exists (");
    expect(migration).toContain("asset.object_path = storage.objects.name");
    expect(migration).toMatch(
      /restore_media_asset[\s\S]*from storage\.objects object[\s\S]*media storage object is missing; restore aborted/u
    );
    expect(migration).toMatch(
      /revoke all on function public\.register_media_replacement\([\s\S]*\) from public, anon, authenticated/u
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.register_media_replacement/u
    );
    expect(migration).toMatch(
      /revoke insert on table public\.media_assets from authenticated;[\s\S]*grant insert \([\s\S]*sha256_hex[\s\S]*\) on table public\.media_assets to authenticated/u
    );
    for (const protectedColumn of [
      "deleted_by",
      "replacement_of_media_id",
      "replaced_by_media_id",
      "replacement_registered_at",
      "replacement_registered_by",
    ]) {
      const insertGrant = migration.match(
        /grant insert \(([\s\S]*?)\) on table public\.media_assets to authenticated/u
      )?.[1] || "";
      expect(insertGrant).not.toContain(protectedColumn);
    }
    expect(migration).toContain(
      "'authenticated', 'public.media_assets', 'sha256_hex', 'INSERT'"
    );
    expect(migration).toContain(
      "'public.register_media_replacement(uuid,uuid,timestamptz,timestamptz)'"
    );
    expect(migration).toContain(
      "'authenticated', 'public.media_usages', 'DELETE'"
    );
    expect(migration).toContain(
      "'authenticated', 'public.media_usages', 'SELECT'"
    );
    expect(migration).toContain(
      "usage_policy.policyname = 'Staff read media usage'"
    );
    expect(migration).toContain("select count(*) = 6");
  });

  it("previews and atomically replaces selected current usages without mutating history", () => {
    expect(migration).toContain(
      "create or replace function public.media_asset_current_replacement_refs_internal"
    );
    expect(migration).toContain(
      "create or replace function public.preview_media_asset_replacement"
    );
    expect(migration).toContain(
      "create or replace function public.replace_media_asset_current_usages"
    );
    expect(migration).toContain("p_expected_usage_refs jsonb");
    expect(migration).toContain("p_selected_usage_refs jsonb");
    expect(migration).toContain("p_replace_all_current boolean");
    expect(migration).toContain("media usages changed after preview");
    expect(migration).toContain("selected media usage is no longer current");
    expect(migration).toContain(
      "lock table public.articles, public.article_translations, public.pages"
    );
    expect(migration).toContain("public.replace_editor_media_node_json(");
    expect(migration).toContain(
      "create or replace function public.replace_editor_media_html"
    );
    expect(
      migration.match(/public\.replace_editor_media_html\(/gu)?.length || 0
    ).toBeGreaterThanOrEqual(5);
    expect(migration).toContain("media HTML replacement postcondition failed");
    expect(migration).toContain("media HTML replacement was incomplete");
    expect(migration).toContain(
      "current media fallback URL does not match immutable object"
    );
    expect(migration).toContain(
      "expected_old_public_url := public_url_origin"
    );
    expect(migration).toContain(
      "p_new_public_url is distinct from expected_new_public_url"
    );
    expect(migration).not.toMatch(
      /strpos\(\s*p_new_public_url,[\s\S]*?'\/object\/public\/'/u
    );
    expect(migration).toContain(
      "$media_id_regex$(^|[[:space:]])data-media-id"
    );
    expect(migration).not.toMatch(
      /content_html\s*=\s*replace\([\s\S]*?p_old_public_url[\s\S]*?p_new_public_url/u
    );
    expect(migration).not.toContain("replace_media_settings_json");
    expect(migration).not.toMatch(/position\([^\n]*media_id::text in block\.settings::text\)/u);
    expect(migration).not.toContain("field_name = 'settings'");
    expect(migration).toContain("persisted_old_public_url");
    expect(migration).toContain("persisted media fallback URLs are inconsistent");
    expect(migration).toMatch(/select count\(\*\) into target_count[\s\S]*if target_count = 0 then/u);
    expect(migration).toContain("'media.current_usages_replaced'");
    expect(migration).toContain("'historicalRevisionsMutated', false");
    expect(migration).toContain("'oldObjectRetained', true");
    expect(migration).toMatch(
      /replace_media_asset_current_usages[\s\S]*from storage\.objects object[\s\S]*replacement storage object is missing/u
    );
    const replacementBody = migration.split(
      "create or replace function public.replace_media_asset_current_usages"
    )[1].split("revoke all on function public.replace_media_asset_current_usages")[0];
    for (const historicalTable of [
      "article_revisions",
      "article_translation_revisions",
      "page_revisions",
      "homepage_block_revisions",
      "site_chrome_revisions",
      "editor_autosaves",
    ]) {
      expect(replacementBody).not.toMatch(
        new RegExp(`(?:update|delete\\s+from)\\s+public\\.${historicalTable}`, "iu")
      );
    }
  });

  it("exposes Russian lifecycle filters and server-guarded actions in Media Studio", () => {
    expect(page).toContain('supabase.rpc("list_media_studio_assets"');
    expect(page).toContain('supabase.rpc("list_media_asset_usages"');
    expect(page).toContain("mediaCatalogStates");
    expect(page).toContain("Статус прав");
    expect(page).toContain("asset.width");
    expect(page).toContain("formatFileSize(asset.byte_size)");
    expect(page).toContain("asset.duplicate_count");
    expect(page).toContain("trashMediaAction");
    expect(page).toContain("restoreMediaAction");
    expect(actions).toContain('requireStaff(["owner", "admin"])');
    expect(actions).toContain('"trash_media_asset"');
    expect(actions).toContain('"restore_media_asset"');
    expect(actions).toContain('"replace_media_asset_current_usages"');
    expect(page).toContain('supabase.rpc("preview_media_asset_replacement"');
    expect(page).toContain("Заменить во всех текущих местах");
    expect(page).toContain("mediaCatalogViews");
    expect(actions).toContain("rights_status: parsed.data.rightsStatus");
  });
});
