import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("../../../components/LiteraryWorkWorkspace.tsx", import.meta.url),
  "utf8"
);

describe("complete literary-work workspace", () => {
  it("loads all four editorial collections for the selected work", () => {
    for (const table of [
      "literary_work_translations",
      "literary_work_sources",
      "literary_work_external_ids",
      "book_import_candidates",
    ]) {
      expect(page).toContain(`.from("${table}")`);
    }
    expect(page).toContain("<LiteraryWorkWorkspace");
  });

  it("CAS-protects every mutable row and exact-matches immutable external IDs", () => {
    expect(actions.match(/\.eq\("updated_at",/gu)?.length).toBeGreaterThanOrEqual(6);
    expect(actions).toContain('.eq("scheme", edit.scheme)');
    expect(actions).toContain('.eq("external_id", edit.externalId)');
    expect(actions).toContain('.eq("source_url", edit.sourceUrl)');
    expect(actions).not.toContain('.upsert(');
  });

  it("publishes and audits every workspace mutation", () => {
    expect(actions).toContain("finishWorkspaceMutation({");
    expect(actions).toContain("requestPublicBuild({");
    expect(actions).toContain('.from("admin_audit_log").insert({');
    expect(actions).toContain('saved: "workspace"');
  });

  it("uses structured controls rather than a raw JSON or SQL editor", () => {
    expect(workspace).toContain('name="source_urls"');
    expect(workspace).toContain('name="field_names"');
    expect(workspace).toContain('name="external_id"');
    expect(workspace).toContain('name="rejection_reasons"');
    expect(workspace).not.toContain('name="payload"');
    expect(workspace).not.toMatch(/sql|query editor/iu);
  });
});
