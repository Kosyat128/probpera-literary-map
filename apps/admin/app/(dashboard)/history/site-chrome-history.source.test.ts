import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../../../../../supabase/migrations/20260813_unified_revision_history.sql", import.meta.url),
  "utf8"
);

describe("site chrome revision history wiring", () => {
  it("loads banner and navigation snapshots from the shared revision table", () => {
    expect(pageSource).toContain('.from("admin_revision_history")');
    expect(migrationSource).toContain("from public.site_chrome_revisions revision");
    expect(migrationSource).toContain("when 'banner' then 'banner' else 'navigation'");
  });

  it("checks the revision discriminator and strict restore columns", () => {
    expect(actionsSource).toContain('revisionEntityType: "banner"');
    expect(actionsSource).toContain('revisionEntityType: "navigation_item"');
    expect(actionsSource).toContain("revisionRecord.entity_type !== config.revisionEntityType");
    expect(actionsSource).toContain("allowedColumns: config.allowedColumns");
  });

  it("does not report success when the original entity was deleted", () => {
    expect(actionsSource).toContain(".select(config.snapshotIdColumn)");
    expect(actionsSource).toContain("error || !data");
    expect(actionsSource).toContain("Объект удалён или уже изменён в другой вкладке");
    expect(pageSource).toContain("revision.restorable && revision.entity_updated_at");
  });

  it("uses primary compensation when restoring a primary edition", () => {
    expect(actionsSource).toContain('kind === "edition" && patch.is_primary === true');
    expect(actionsSource).toContain("await persistWithPrimaryEditionCompensation({");
    expect(actionsSource).toContain("restorePreviousPrimaries: async (ids)");
  });
});
