import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260808_book_translations_and_import_staging.sql"
  ),
  "utf8"
);

describe("database book publication gate", () => {
  it("keeps the SQL RLS predicate aligned with the runtime quality gate", () => {
    expect(migration).toContain("public.is_publishable_literary_work");
    expect(migration).toContain(
      "char_length(btrim(translation.description)) between 140 and 900"
    );
    expect(migration).toContain("regexp_matches(");
    expect(migration).toContain("translation.locale = 'en'");
    expect(migration).toContain("ascii(glyph.value) between 1024 and 1327");
    expect(migration).toContain("btrim(declared.source_url) !~* '^https://'");
    expect(migration).toContain(
      "source.source_url = btrim(declared.source_url)"
    );
    expect(migration).toContain("source.usage = 'licensed-copy'");
    expect(migration).toContain(
      "btrim(coalesce(source.license_name, '')) <> ''"
    );
  });
});
