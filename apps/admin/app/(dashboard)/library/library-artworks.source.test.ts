import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL(
    "../../../../../supabase/migrations/20260820_literary_work_cover_artworks.sql",
    import.meta.url
  ),
  "utf8"
);

describe("library editorial artwork surface", () => {
  it("keeps edition-cover verification separate from work artwork counts", () => {
    expect(pageSource).toContain('from("book_editions")');
    expect(pageSource).toContain('in("cover_rights_status"');
    expect(pageSource).toContain('from("literary_work_cover_artworks")');
    expect(pageSource).toContain('eq("is_primary", true)');
    expect(pageSource).toContain("Обложки точных изданий");
    expect(pageSource).toContain("Редакционные иллюстрации");
    expect(pageSource).toContain("не обложки");
  });

  it("shows per-work counts and immutable provenance without an artwork mutation path", () => {
    expect(pageSource).toContain("literary_work_cover_artworks(count)");
    expect(pageSource).toContain("source_archive_sha256");
    expect(pageSource).toContain("source_image_sha256");
    expect(pageSource).toContain("source_relative_path");
    expect(pageSource).toContain("происхождение неизменяемо");
    expect(pageSource).not.toMatch(
      /from\("literary_work_cover_artworks"\)[\s\S]{0,300}\.(?:insert|upsert|update|delete)\(/u
    );
  });

  it("relies on the existing staff RLS policy for unpublished artwork reads", () => {
    expect(migrationSource).toMatch(
      /create policy "Staff manage literary work artwork"[\s\S]*to authenticated[\s\S]*using \(public\.is_staff\(\)\)/u
    );
    expect(migrationSource).toMatch(
      /Public read publishable literary work artwork[\s\S]*public\.is_publishable_literary_work\(work_id\)/u
    );
  });
});
