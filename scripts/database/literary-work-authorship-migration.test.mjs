import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (file) =>
  readFileSync(path.join(root, file), "utf8").replace(/\r\n?/gu, "\n");
const migration = read(
  "supabase/migrations/20260902_literary_work_authorship.sql"
);
const syncSource = read("scripts/sync-literary-archive.mjs");
const exportSource = read("scripts/export-published-content.mjs");
const cmsSource = read("src/data/cms/editorialOverrides.ts");

describe("additive literary-work authorship persistence", () => {
  it("keeps the legacy key while replacing only the unsafe global uniqueness", () => {
    expect(migration).toContain(
      "add column if not exists authorship_kind text;"
    );
    expect(migration).toContain(
      "add column if not exists is_routing_only boolean not null default false;"
    );
    const countryScoped = migration.indexOf(
      "unique (country_id, writer_id, slug)"
    );
    const oldConstraintDrop = migration.indexOf(
      "drop constraint if exists literary_works_writer_id_slug_key"
    );
    expect(countryScoped).toBeGreaterThan(-1);
    expect(oldConstraintDrop).toBeGreaterThan(countryScoped);
    expect(migration).not.toMatch(/drop\s+column\s+(?:legacy_id|writer_id)/iu);
  });

  it("normalizes author rows with parent-gated reads and RPC-only writes", () => {
    expect(migration).toContain(
      "create table if not exists public.literary_work_authors"
    );
    expect(migration).toContain(
      "foreign key (writer_country_id, writer_id)"
    );
    expect(migration).toContain(
      "references public.editorial_writers(country_id, id)"
    );
    expect(migration).toContain(
      "using (public.is_publishable_literary_work(work_id));"
    );
    expect(migration).toContain(
      'create policy "Staff read literary work authors"'
    );
    expect(migration).not.toContain(
      "grant insert, update, delete on table public.literary_work_authors"
    );
    expect(migration).toContain(
      "alter table public.literary_work_authors force row level security;"
    );
  });

  it("replaces a full ordered set atomically with optimistic locking", () => {
    expect(migration).toContain(
      "create or replace function public.replace_literary_work_authorship("
    );
    expect(migration).toMatch(/where work\.id = p_work_id\s+for update;/u);
    expect(migration).toContain(
      "target.updated_at is distinct from p_expected_updated_at"
    );
    expect(migration).toContain("using errcode = '40001'");
    expect(migration).toContain(
      "request_role = 'service_role' and target.is_cms_locked"
    );
    expect(migration).toContain(
      "insert into public.literary_work_authorship_revisions"
    );
    expect(migration).toContain(
      "create constraint trigger literary_work_authors_consistency"
    );
    expect(migration).toContain(
      "public.enforce_literary_work_authorship_consistency()"
    );
    expect(migration).toContain(
      "A work may occur only once per authorship batch"
    );
    expect(migration).toContain(
      "delete from public.literary_work_authors author"
    );
    expect(migration).toContain(
      "create or replace function public.sync_literary_work_authorship_batch("
    );
    expect(migration).toContain(
      "replacement_result := public.replace_literary_work_authorship("
    );
    expect(migration).toContain(
      "grant execute on function public.sync_literary_work_authorship_batch(jsonb)\n  to service_role;"
    );
  });

  it("adds publication signaling and extends schema health without masking predecessors", () => {
    expect(migration).toContain(
      "public.capture_literary_work_authorship_outbox()"
    );
    expect(migration).toContain(
      "perform public.append_public_build_outbox("
    );
    expect(migration).toContain(
      "get_editorial_schema_health_pre_literary_work_authorship()"
    );
    expect(migration).not.toContain(
      "'version', '20260901_zzzzzz_admin_completion_health'"
    );
    expect(migration).toContain("'literaryWorkAuthorship',");
  });

  it("syncs only unlocked compositions and exports the complete optional payload", () => {
    expect(syncSource).toContain("authorshipRowsFromArchive");
    expect(syncSource).toContain(
      "!lockedLegacyIds.has(`${book.countryId}:${book.writerId}:${book.id}`)"
    );
    expect(syncSource).toContain(
      "authors: authorRowsForWork.map(withoutWorkId)"
    );
    expect(syncSource).toContain("publishLiteraryArchiveAtomicRelease({");
    expect(syncSource).not.toContain('"sync_literary_work_authorship_batch"');
    expect(syncSource).toContain("market: source.market");

    expect(exportSource).toContain('"literary_work_authors"');
    expect(exportSource).toContain("fetchOptionalColumnRows(");
    expect(exportSource).toContain('["authorship_kind"]');
    expect(exportSource).toContain("using the legacy snapshot shape");
    expect(exportSource).toContain("publishedWorkAuthorship(");
    expect(exportSource).toContain("publishedWorkTranslations(");
    expect(exportSource).toContain("publishedWorkSources(");
    expect(cmsSource).toContain('authorship?: WorkProfile["authorship"]');
    expect(cmsSource).toContain(
      "authorship: copiedJsonMetadata(work.authorship)"
    );
  });

  it("remains additive and transaction-wrapper neutral", () => {
    expect(migration).not.toMatch(/\bdrop\s+(?:table|schema|column)\b/iu);
    expect(migration).not.toMatch(/^\s*(?:begin|commit|rollback)\s*;/gimu);
  });
});
