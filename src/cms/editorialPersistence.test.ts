import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260812_writer_and_work_revisions.sql",
    import.meta.url
  ),
  "utf8"
);
const exporter = readFileSync(
  new URL("../../scripts/export-published-content.mjs", import.meta.url),
  "utf8"
);
const synchronizer = readFileSync(
  new URL("../../scripts/sync-literary-archive.mjs", import.meta.url),
  "utf8"
);
const visualEntityActions = readFileSync(
  new URL(
    "../../apps/admin/app/(dashboard)/visual-entity-actions.ts",
    import.meta.url
  ),
  "utf8"
);

describe("durable visual entity persistence", () => {
  it("keeps writer overrides and pre-change snapshots behind staff RLS", () => {
    expect(migration).toContain(
      "create table if not exists public.writer_profile_overrides"
    );
    expect(migration).toContain("unique (country_id, writer_id)");
    expect(migration).toContain("before update or delete on public.writer_profile_overrides");
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("using (public.is_staff())");
    expect(migration).toContain(
      "create table if not exists public.site_chrome_revisions"
    );
    expect(migration).toContain(
      "before update or delete on public.navigation_items"
    );
    expect(migration.match(/return new;/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("if tg_op = 'DELETE' then");
    expect(
      migration.match(
        /revision_actor := coalesce\(new\.updated_by, \(select auth\.uid\(\)\)\);/gu
      )?.length
    ).toBe(2);
    expect(
      migration.match(/revision_actor := \(select auth\.uid\(\)\);/gu)?.length
    ).toBe(2);
    expect(
      migration.match(/to_jsonb\(old\),\s+revision_actor/gu)?.length
    ).toBe(2);
    expect(migration).not.toMatch(/to_jsonb\(old\),\s+old\.updated_by/gu);
  });

  it("protects owner-edited works from later source synchronization", () => {
    expect(migration).toContain(
      "is_cms_locked boolean not null default false"
    );
    expect(migration).toContain(
      "create table if not exists public.literary_work_revisions"
    );
    expect(synchronizer).toContain('.eq("is_cms_locked", true)');
    expect(synchronizer).toContain("synchronizableWorks");
    expect(visualEntityActions).toContain("is_cms_locked: true");
  });

  it("exports writer and work fields into public generated overlays", () => {
    expect(exporter).toContain('fetchOptionalRows("writer_profile_overrides"');
    expect(exporter).toContain('"cmsWriterProfileOverrides"');
    expect(exporter).toContain('"cmsLiteraryWorksByLegacyId"');
    expect(exporter).toContain(
      "id,legacy_id,country_id,writer_id,title,original_title"
    );
    expect(exporter).toContain("const publicSnapshotKey");
    expect(exporter).toMatch(
      /fetchOptionalRows\("literary_works", \{[\s\S]*?\}, publicSnapshotKey\)/u
    );
  });
});
