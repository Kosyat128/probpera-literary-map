import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8").replace(/\r\n?/gu, "\n");
export const draftStorageMigration = read("supabase/migrations/20260914_literary_translation_draft_storage.sql");
const literal = value => `'${String(value).replaceAll("'", "''")}'`;

/** The small fixture projection is bound to the actual sync serializer, without executing its CLI. */
export function draftStorageRowsFromArchive(archive) {
  const sync = read("scripts/sync-literary-archive.mjs");
  const serializer = sync.slice(sync.indexOf("function translationRows("), sync.indexOf("function sourceRows("));
  assert.equal(createHash("sha256").update(serializer).digest("hex"),
    "502d0cf0a60615a5c444d66c9e3c743265750f7584b41f2eb47957d673dc9bed",
    "Update the fixture projection if the real translation serializer changes");
  return archive.flatMap(book => {
    const workId = `${book.countryId}:${book.writerId}:${book.id}`;
    // This dated release preserves the repaired, CMS-owned Wells row separately.
    if (workId === "england:h_g_wells:when-the-sleeper-wakes") return [];
    return Object.values(book.translations || {}).map(translation => ({
      work_id: workId,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      source_language: translation.sourceLanguage,
      translation_method: translation.method,
      editorial_status: translation.status,
      source_urls: translation.sourceUrls,
      reviewed_at: translation.reviewedAt || null,
      metadata: Object.fromEntries(Object.entries({
        titleEvidence: translation.titleEvidence,
        descriptionProvenance: translation.descriptionProvenance,
      }).filter(([, value]) => value !== undefined)),
    }));
  });
}

export function buildLiteraryTranslationDraftStorageFixture(rows) {
  assert.ok(Array.isArray(rows) && rows.length > 0);
  const historical = read("supabase/migrations/20260808_book_translations_and_import_staging.sql");
  const start = historical.indexOf("create table if not exists public.literary_work_translations (");
  const end = historical.indexOf("create table if not exists public.literary_work_sources (");
  assert.ok(start >= 0 && end > start);
  const machine = read("supabase/migrations/20260823_premium_machine_translation.sql");
  const methodAlter = machine.slice(machine.indexOf("alter table public.literary_work_translations"),
    machine.indexOf("create or replace function public.premium_machine_translation_ready()"));
  const shortRows = rows.filter(row => [...row.description].length < 140);
  assert.equal(shortRows.length, 89, "The preserved R49 short-text regression set changed");
  assert.ok(shortRows.every(row => row.editorial_status === "draft" && row.reviewed_at === null));
  const sql = read("scripts/database/fixtures/literary-translation-draft-storage.sql")
    .replace("-- __EXACT_OLD_STORAGE__", () => historical.slice(start, end) + methodAlter)
    .replace("-- __ACTUAL_TRANSLATION_ROWS__", () => `insert into public.fixture_translation_input(value)
      select value from jsonb_array_elements(${literal(JSON.stringify(rows))}::jsonb);`)
    .replaceAll("-- __DRAFT_STORAGE_MIGRATION__", () => draftStorageMigration)
    .replace("-- __MIGRATION_LITERAL__", () => literal(draftStorageMigration));
  assert.ok(!/-- __[A-Z_]+__/u.test(sql));
  return { sql, counts: { translations: rows.length, shortDrafts: shortRows.length,
    shortDraftWorks: new Set(shortRows.map(row => row.work_id)).size } };
}
