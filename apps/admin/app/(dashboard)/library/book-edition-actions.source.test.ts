import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL(
    "../../../../../supabase/migrations/20260901_zz_data_studio_integrity.sql",
    import.meta.url
  ),
  "utf8"
);

describe("existing book-edition editor wiring", () => {
  it("validates a fixed patch and updates only the selected edition", () => {
    expect(actionsSource).toContain("parseBookEditionEdit(editionEditInput(formData))");
    expect(actionsSource).toContain('"update_book_edition_atomic"');
    expect(actionsSource).toContain("p_payload: edit.patch");
    expect(actionsSource).toContain("p_edition_id: edit.editionId");
    expect(actionsSource).toContain("p_expected_updated_at: edit.expectedUpdatedAt");
    expect(pageSource).toContain('name="expected_updated_at"');
  });

  it("records audit and immediately requests a public build", () => {
    expect(migrationSource).toContain("'book_edition.updated'");
    expect(actionsSource).toContain('reason: "book_edition.updated"');
    expect(actionsSource).toContain('revalidatePath("/history")');
  });

  it("hands primary status over inside one database transaction", () => {
    expect(actionsSource).toContain('"create_book_edition_atomic"');
    expect(actionsSource).toContain('"update_book_edition_atomic"');
    expect(actionsSource).not.toContain("persistWithPrimaryEditionCompensation");
    expect(migrationSource).toContain("for update;");
    expect(migrationSource).toContain("set is_primary = false");
    expect(migrationSource).toContain("'atomicPrimaryHandoff', true");
  });

  it("does not publish a stale full-form update", () => {
    expect(migrationSource).toContain(
      "existing.updated_at is distinct from p_expected_updated_at"
    );
    expect(migrationSource).toContain("message = 'edition-version-conflict'");
    expect(actionsSource).toContain('error?.code === "40001"');
  });

  it("exposes the complete provenance form for an existing row", () => {
    expect(pageSource).toContain("action={updateBookEditionAction}");
    expect(pageSource).toContain('name="cover_rights_status"');
    expect(pageSource).toContain('name="rights_checked_at"');
    expect(pageSource).toContain("Сохранить, записать версию и опубликовать");
  });
});
