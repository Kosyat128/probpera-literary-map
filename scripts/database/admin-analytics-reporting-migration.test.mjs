import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve("supabase/migrations/20260901_zz_admin_analytics_reporting.sql"),
  "utf8"
).replace(/\r\n/gu, "\n");

describe("admin analytics reporting migration", () => {
  it("aggregates in PostgreSQL behind staff authorization and bounded dates", () => {
    expect(source).toContain("get_admin_analytics_report");
    expect(source).toContain("not public.is_staff()");
    expect(source).toContain("interval '366 days'");
    expect(source).toContain("with scoped_views as materialized");
    expect(source).toContain("count(distinct session_id)");
    expect(source).toContain("grant execute on function public.get_admin_analytics_report");
  });

  it("does not grant anonymous reporting access", () => {
    expect(source).toContain("from public, anon, authenticated");
    expect(source).not.toMatch(/grant execute[\s\S]{0,180}to anon/iu);
  });
});
