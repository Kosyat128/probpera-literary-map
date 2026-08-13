import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entityActions = readFileSync(
  new URL("../app/(dashboard)/visual-entity-actions.ts", import.meta.url),
  "utf8"
);
const contentActions = readFileSync(
  new URL("../app/(dashboard)/visual-content-actions.ts", import.meta.url),
  "utf8"
);
const preview = readFileSync(
  new URL("../components/HomepageVisualPreview.tsx", import.meta.url),
  "utf8"
);

describe("strict CAS for direct visual edits", () => {
  it("loads a version when the editor selects an entity", () => {
    expect(preview).toContain("getVisualEntityVersionAction");
    expect(preview).toContain("getVisualContentVersionAction");
    expect(preview).toContain("inlineVersionReady");
  });

  it("passes the selected version into both mutation families", () => {
    expect(preview.match(/expectedUpdatedAt: inlineExpectedUpdatedAt/gu)).toHaveLength(2);
    expect(entityActions).toContain('.eq("updated_at", expectedUpdatedAt)');
    expect(contentActions).toContain('updateQuery = updateQuery.eq("updated_at", expectedUpdatedAt)');
  });

  it("returns the new database version for the next quick edit", () => {
    expect(entityActions).toContain('select("id,updated_at")');
    expect(contentActions).toContain('.select("id,updated_at")');
    expect(preview).toContain("setInlineExpectedUpdatedAt(result.updatedAt)");
  });
});
