import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260830_zz_site_typography_engine.sql"
  ),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("site typography engine migration", () => {
  it("defines immutable content-addressed font metadata", () => {
    expect(migration).toContain(
      "create table if not exists public.font_assets"
    );
    for (const column of [
      "source_type",
      "storage_bucket",
      "object_path",
      "display_name",
      "family_name",
      "format",
      "mime_type",
      "sha256_hex",
      "byte_size",
      "is_variable",
      "weight_min",
      "weight_max",
      "font_style",
      "license_name",
      "license_url",
      "cas_version",
      "deleted_at",
    ]) {
      expect(migration).toMatch(new RegExp(`\\b${column}\\b`, "u"));
    }
    expect(migration).toContain(
      "source_type in ('system', 'bundled', 'uploaded')"
    );
    expect(migration).toContain("storage_bucket = 'site-fonts'");
    expect(migration).toContain(
      "'sha256/' || substr(sha256_hex, 1, 2) || '/'"
    );
    expect(migration).toContain("sha256_hex || '.' || format");
    expect(migration).toContain("byte_size between 1 and 2097152");
    expect(migration).toContain("is_variable or weight_min = weight_max");
    expect(migration).toContain("font binary identity is immutable");
    expect(migration).toContain("new.cas_version <> old.cas_version + 1");
    expect(migration).toContain("and license_name is not null");
    expect(migration).toContain("license_url ~* '^https?://'");
    expect(migration).toMatch(
      /create unique index if not exists font_assets_storage_object_idx[\s\S]*where storage_bucket is not null\s+and object_path is not null\s+and deleted_at is null;/u
    );
  });

  it("keeps scopes, layers, breakpoints, drafts and published snapshots strict", () => {
    expect(migration).toContain(
      "create table if not exists public.site_typography_overrides"
    );
    expect(migration).toContain(
      "create table if not exists public.site_typography_revisions"
    );
    expect(migration).toContain(
      "layer in ('site', 'component', 'template', 'page', 'instance')"
    );
    expect(migration).toContain(
      "breakpoint in ('base', 'mobile', 'tablet', 'desktop')"
    );
    for (const scope of [
      "body",
      "navigation",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "article",
      "page",
      "lead",
      "quote",
      "caption",
      "button",
      "card",
      "footer",
    ]) {
      expect(migration).toContain(`'${scope}'`);
    }
    expect(migration).toContain("draft_settings jsonb not null");
    expect(migration).toContain("published_settings jsonb");
    expect(migration).toContain(
      "create or replace function public.is_valid_site_typography_settings"
    );
    expect(migration).toContain("'familyId'");
    expect(migration).not.toContain("'fontAssetId'");
    expect(migration).toContain("'systemFamily'");
    expect(migration).toContain("'{\"unknownToken\": true}'::jsonb");
    expect(migration).toContain(
      "public.is_valid_site_typography_settings('{}'::jsonb)"
    );
  });

  it("uses owner/admin RPCs with CAS, revision, audit and outbox boundaries", () => {
    for (const signature of [
      "save_site_typography_override(\n  p_override_id uuid",
      "publish_site_typography_override(\n  p_override_id uuid",
      "restore_site_typography_revision(\n  p_revision_id bigint",
    ]) {
      expect(migration).toContain(signature);
    }
    expect(migration).toMatch(
      /public\.is_staff\(array\[\s*'owner'::public\.staff_role,\s*'admin'::public\.staff_role\s*\]\)/u
    );
    expect(migration).toContain(
      "current_override.cas_version <> p_expected_cas_version"
    );
    expect(migration).toContain("'typography.override_saved'");
    expect(migration).toContain("'typography.override_published'");
    expect(migration).toContain("'typography.revision_restored'");
    expect(migration.match(/public\.append_public_build_outbox\(/gu)).toHaveLength(
      2
    );
    expect(migration).toContain("restored_from_revision_id");
    expect(migration).toContain("'publishedSettings'");
    expect(migration).toContain(
      "restored_layer := source_revision.snapshot ->> 'layer'"
    );
    expect(migration).toContain(
      "restored_target_key := source_revision.snapshot ->> 'targetKey'"
    );
    expect(migration).toContain(
      "restored_semantic_scope := source_revision.snapshot ->> 'semanticScope'"
    );
    expect(migration).toContain(
      "restored_breakpoint := source_revision.snapshot ->> 'breakpoint'"
    );
    expect(migration).toMatch(
      /set layer = restored_layer,\s+target_key = restored_target_key,\s+semantic_scope = restored_semantic_scope,\s+breakpoint = restored_breakpoint,\s+draft_settings = restored_settings,\s+published_settings = restored_settings/u
    );
    expect(migration).toContain(
      "typography revision identity is already in use"
    );
    expect(migration).toContain(
      "create or replace function public.archive_font_asset"
    );
    expect(migration).toContain("font asset is referenced by typography");
    expect(migration).toMatch(
      /from public\.site_typography_revisions revision\s+where revision\.snapshot -> 'publishedSettings' ->> 'familyId' =\s+p_font_id::text/u
    );
    expect(migration).toContain("'typography.font_archived'");
    expect(migration).toContain("'typography.font_registered'");
    expect(migration).toContain("font_assets_audit_insert");
    expect(migration).not.toMatch(
      /grant update[\s\S]*on public\.font_assets to authenticated/iu
    );
    expect(migration).not.toContain(
      'create policy "Owners and admins archive font assets"'
    );
  });

  it("keeps drafts private and exposes only a bounded published read RPC", () => {
    expect(migration).toContain(
      "create or replace function public.get_published_site_typography()"
    );
    expect(migration).toContain(
      "where override_row.published_settings is not null"
    );
    expect(migration).not.toMatch(
      /grant select on public\.site_typography_overrides to anon/iu
    );
    expect(migration).not.toMatch(/grant select on public\.font_assets to anon/iu);
    expect(migration).toMatch(
      /grant execute on function public\.get_published_site_typography\(\)\s+to anon, authenticated;/u
    );
    const publicReader = migration.slice(
      migration.indexOf(
        "create or replace function public.get_published_site_typography()"
      ),
      migration.indexOf(
        "revoke all on function public.is_valid_site_typography_settings"
      )
    );
    expect(publicReader).not.toContain("draft_settings");
    expect(publicReader).not.toContain("uploaded_by");
    expect(publicReader).not.toContain("deleted_by");
    expect(publicReader).not.toContain("storageBucket");
    expect(publicReader).not.toContain("objectPath");
    expect(publicReader).not.toContain("sha256Hex");
    expect(publicReader).not.toContain("byteSize");
    expect(publicReader).toContain("'isVariable', asset.is_variable");
  });

  it("creates a bounded private font bucket and immutable upload policy", () => {
    expect(migration).toContain("insert into storage.buckets");
    expect(migration).toContain("'site-fonts'");
    expect(migration).toContain("array['font/woff', 'font/woff2']");
    expect(migration).toMatch(
      /'site-fonts',\s*'site-fonts',\s*false,\s*2097152/u
    );
    expect(migration).toContain(
      'drop policy if exists "Public read site fonts" on storage.objects;'
    );
    expect(migration).not.toContain('create policy "Public read site fonts"');
    expect(migration).toMatch(
      /drop policy if exists "Owners and admins upload site fonts"[\s\S]*name ~ '\^sha256\/\[0-9a-f\]\{2\}\/\[0-9a-f\]\{64\}\\\.\(woff\|woff2\)\$'/u
    );
    expect(migration).not.toMatch(
      /create policy "[^"]*site fonts"[\s\S]*for (?:update|delete)/iu
    );
  });

  it("extends the complete fail-closed schema health contract", () => {
    expect(migration).toContain(
      "rename to get_editorial_schema_health_pre_typography"
    );
    expect(migration).toContain(
      "'version', '20260830_zz_site_typography_engine'"
    );
    expect(migration).toContain("'siteTypographyEngine'");
    expect(migration).toContain("Staff read typography overrides");
    expect(migration).toContain(
      "policy.policyname = 'Public read site fonts'"
    );
    expect(migration).toContain("Owners and admins upload site fonts");
    expect(migration).toContain(
      "not has_table_privilege(\n          'anon', 'public.site_typography_overrides', 'SELECT'"
    );
  });
});
