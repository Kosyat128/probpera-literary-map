import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("complete library catalogs", () => {
  it("uses independent counted range queries without fixed truncation", () => {
    expect(pageSource).toContain("worksCatalogQuery.range(catalog.worksFrom, catalog.worksTo)");
    expect(pageSource).toContain("editionsCatalogQuery.range(catalog.editionsFrom, catalog.editionsTo)");
    expect(pageSource).not.toContain(".limit(5_000)");
    expect(pageSource).not.toContain(".limit(100)");
    expect(pageSource).toContain("Все произведения");
    expect(pageSource).toContain("Все издания");
  });

  it("applies only parsed server filters and stable ordering", () => {
    expect(pageSource).toContain('worksCatalogQuery.ilike("title", catalog.pattern)');
    expect(pageSource).toContain('worksCatalogQuery.eq("country_id", catalog.country)');
    expect(pageSource).toContain('worksCatalogQuery.eq("writer_id", catalog.writer)');
    expect(pageSource).toContain('worksCatalogQuery.eq("editorial_status", catalog.status)');
    expect(pageSource).toContain('.order("id")');
    expect(pageSource).toContain('.order("id", { ascending: false })');
  });

  it("preserves canonical catalog context across ISBN and edition actions", () => {
    expect(pageSource).toContain("<LibraryActionContextFields {...formContext} />");
    expect(pageSource).toContain("libraryCatalogHref(catalog");
    expect(actionsSource).toContain("libraryCatalogFormHref(formData, options)");
    expect(pageSource).toContain("<CatalogPagination");
  });

  it("never overwrites an existing manual edition during ISBN import", () => {
    expect(actionsSource).toContain('.eq("legacy_id", legacyId)');
    expect(actionsSource).toContain('.insert(payload)');
    expect(actionsSource).not.toContain('.upsert(payload, { onConflict: "legacy_id" })');
    expect(actionsSource).toContain('error?.code === "23505"');
    expect(actionsSource).toContain("throw new ExistingBookEditionError(collidedEdition.id)");
    expect(actionsSource).toContain('notice: "edition-exists"');
    expect(actionsSource).toContain("#edition-editor");
    expect(pageSource).toContain('query.notice === "edition-exists"');
    expect(pageSource).toContain('id="edition-editor"');

    const preflightGuard = actionsSource.indexOf("if (existingByLegacyId?.id)");
    const primaryHandoff = actionsSource.indexOf(
      "await persistWithPrimaryEditionCompensation({",
      actionsSource.indexOf("export async function saveBookEditionAction")
    );
    const collisionGuard = actionsSource.indexOf(
      "if (error instanceof ExistingBookEditionError)"
    );
    const audit = actionsSource.indexOf(
      'action: "book_edition.created"',
      collisionGuard
    );
    const build = actionsSource.indexOf(
      "const publication = await requestPublicBuild",
      collisionGuard
    );
    expect(preflightGuard).toBeGreaterThan(-1);
    expect(preflightGuard).toBeLessThan(primaryHandoff);
    expect(collisionGuard).toBeGreaterThan(primaryHandoff);
    expect(collisionGuard).toBeLessThan(audit);
    expect(collisionGuard).toBeLessThan(build);
  });
});
