import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260901_zz_data_studio_integrity.sql"
  ),
  "utf8"
).replace(/\r\n?/gu, "\n");
const libraryActions = readFileSync(
  path.join(root, "apps/admin/app/(dashboard)/library/actions.ts"),
  "utf8"
);
const profileActions = readFileSync(
  path.join(root, "apps/admin/app/(dashboard)/editorial-database/actions.ts"),
  "utf8"
);

describe("Phase 6 Data Studio integrity migration", () => {
  it("creates private canonical country and writer registries", () => {
    expect(migration).toContain("create table if not exists public.editorial_countries");
    expect(migration).toContain("create table if not exists public.editorial_writers");
    expect(migration).toContain("alter table public.editorial_countries enable row level security");
    expect(migration).toContain("alter table public.editorial_countries force row level security");
    expect(migration).toContain("revoke all on table public.editorial_countries from anon, authenticated");
    expect(migration).toContain("grant select on table public.editorial_countries to authenticated");
    expect(migration).not.toContain("grant select, insert, update on table public.editorial_countries");
    expect(migration).toContain('create policy "Staff read editorial countries"');
    expect(migration).toContain('create policy "Staff read editorial writers"');
    expect(migration).toContain("for select to authenticated using (public.is_staff())");
  });

  it("backfills and validates every editorial reference", () => {
    expect(migration).toContain("country_profile_overrides_country_reference_fk");
    expect(migration).toContain("writer_profile_overrides_writer_reference_fk");
    expect(migration).toContain("literary_works_writer_reference_fk");
    expect(migration).toContain("book_import_candidates_writer_reference_fk");
    expect(migration.match(/validate constraint/gu)).toHaveLength(4);
    expect(profileActions).toContain('"ensure_editorial_reference"');
    expect(profileActions).toContain("referenceCountry?.writers.find");
  });

  it("makes create and update primary-edition handoffs atomic", () => {
    expect(migration).toContain("create or replace function public.create_book_edition_atomic");
    expect(migration).toContain("create or replace function public.update_book_edition_atomic");
    expect(migration.match(/from public\.literary_works where id = target_work_id for update/gu)).toHaveLength(2);
    expect(migration.match(/set is_primary = false/gu)).toHaveLength(2);
    expect(migration.match(/'atomicPrimaryHandoff', true/gu)).toHaveLength(2);
    expect(libraryActions).toContain('"create_book_edition_atomic"');
    expect(libraryActions).toContain('"update_book_edition_atomic"');
    expect(libraryActions).not.toContain("persistWithPrimaryEditionCompensation");
  });

  it("keeps RPCs staff-only and errors stable at the form boundary", () => {
    expect(migration).toContain("message = 'staff-required'");
    expect(migration).toContain("message = 'edition-version-conflict'");
    expect(migration).toContain("message = 'edition-work-is-immutable'");
    expect(migration).toContain(
      "revoke all on function public.create_book_edition_atomic(jsonb)"
    );
    expect(migration).toContain(
      "revoke all on function public.update_book_edition_atomic(uuid, timestamptz, jsonb)"
    );
    expect(libraryActions).not.toContain("error: saveError.message");
  });

  it("keeps manual CMS references authoritative over catalog synchronization", () => {
    expect(migration).toContain("create or replace function public.save_manual_editorial_reference");
    expect(migration).toContain("'editorial_reference.manual_saved'");
    expect(migration).toContain("where editorial_countries.source <> 'manual'");
    expect(migration).toContain("where editorial_writers.source <> 'manual'");
    expect(migration).toContain("'directMutationClosed'");
    expect(migration).toContain("'manualReferenceRpc'");
    expect(migration).toContain("'manualReferencesValid'");
  });

  it("reports the complete fail-closed schema boundary", () => {
    expect(migration).toContain("'forceRls'");
    expect(migration).toContain("'authenticatedSelectOnly'");
    expect(migration).toContain("'staffSelectPolicies'");
    expect(migration).toContain("'validatedForeignKeys'");
    expect(migration).toContain("'ensureReferenceRpc'");
    expect(migration).toContain("'catalogSyncRpc'");
    expect(migration).toContain("relforcerowsecurity");
    expect(migration).toContain("convalidated");
    expect(migration).toContain("roles = array['authenticated']::name[]");
    expect(migration).toContain("has_function_privilege('authenticated'");
    expect(migration).toContain("not has_function_privilege('anon'");
    expect(migration.match(/security definer\nset search_path = ''/gu)).toHaveLength(6);
    expect(migration).not.toContain("security definer\nset search_path = public");
    expect(migration).toContain("to_regprocedure('public.ensure_editorial_reference");
    expect(migration).toContain("to_regprocedure('public.sync_editorial_reference_catalog");
    expect(migration).toContain("to_regprocedure('public.create_book_edition_atomic");
    expect(migration).toContain("to_regprocedure('public.update_book_edition_atomic");
    expect(migration).toContain("not exists (\n            select 1 from public.editorial_countries c");
  });
});
