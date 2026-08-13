import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("existing book-edition editor wiring", () => {
  it("validates a fixed patch and updates only the selected edition", () => {
    expect(actionsSource).toContain("parseBookEditionEdit(editionEditInput(formData))");
    expect(actionsSource).toContain('.from("book_editions")');
    expect(actionsSource).toContain(".update(edit.patch)");
    expect(actionsSource).toContain('.eq("id", edit.editionId)');
    expect(actionsSource).toContain('.eq("updated_at", edit.expectedUpdatedAt)');
    expect(pageSource).toContain('name="expected_updated_at"');
  });

  it("records audit and immediately requests a public build", () => {
    expect(actionsSource).toContain('action: "book_edition.updated"');
    expect(actionsSource).toContain('reason: "book_edition.updated"');
    expect(actionsSource).toContain('revalidatePath("/history")');
  });

  it("restores the previous primary when either create or update persistence fails", () => {
    expect(
      actionsSource.split("await persistWithPrimaryEditionCompensation({").length - 1
    ).toBe(2);
    expect(actionsSource).toContain("restorePreviousPrimaries: async (ids)");
    expect(actionsSource).toContain("Не удалось вернуть прежнее основное издание.");
  });

  it("does not publish a stale full-form update", () => {
    const staleGuard = actionsSource.indexOf('.eq("updated_at", edit.expectedUpdatedAt)');
    const publication = actionsSource.indexOf("const publication = await requestPublicBuild", staleGuard);
    expect(staleGuard).toBeGreaterThan(-1);
    expect(actionsSource.slice(staleGuard, publication)).toContain("redirect(target({");
  });

  it("exposes the complete provenance form for an existing row", () => {
    expect(pageSource).toContain("action={updateBookEditionAction}");
    expect(pageSource).toContain('name="cover_rights_status"');
    expect(pageSource).toContain('name="rights_checked_at"');
    expect(pageSource).toContain("Сохранить, записать версию и опубликовать");
  });
});
