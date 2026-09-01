import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260901_zz_visual_direct_edit_v2.sql", import.meta.url),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("atomic Direct Edit v2 migration", () => {
  it("keeps validation, mutation and audit in one security-definer RPC", () => {
    expect(sql).toContain("create or replace function public.save_visual_content_field_v2(");
    expect(sql).toContain("create or replace function public.save_homepage_visual_settings_v2(");
    expect(sql).toContain("insert into public.admin_audit_log");
    expect(sql).toContain("updated_at = p_expected_updated_at");
    expect(sql).toContain("raise exception 'visual_edit_conflict'");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
  });

  it("has a closed entity/field/media boundary and no dynamic SQL", () => {
    for (const value of ["page", "navigation-item", "banner", "homepage-block"]) {
      expect(sql).toContain(`p_entity_type = '${value}'`);
    }
    expect(sql).toContain("from public.media_assets where id = media_id and deleted_at is null");
    expect(sql).toContain("public.is_valid_homepage_visual_settings(p_settings)");
    expect(sql).not.toMatch(/\bexecute\s+format\s*\(/iu);
  });

  it("revokes default execution and grants only authenticated staff entry", () => {
    expect(sql).toMatch(/revoke all on function public\.save_visual_content_field_v2\([\s\S]*?from public, anon, authenticated, service_role;/u);
    expect(sql).toMatch(/grant execute on function public\.save_visual_content_field_v2\([\s\S]*?to authenticated;/u);
  });
});
