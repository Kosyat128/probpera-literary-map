import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), "utf8");
describe("private CMS dossier integration", () => {
  it("uses the shared compiler and trusted staff identity before the CAS RPC", () => {
    const actions = read("apps/admin/app/(dashboard)/library/dossiers/actions.ts");
    expect(actions).toContain('"use server"');
    expect(actions.indexOf("await requireStaff()")).toBeLessThan(actions.indexOf('supabase.rpc("save_book_dossier"'));
    expect(actions).toContain("actor: { id: session.user.id, role: session.role }");
    expect(actions).toContain("compileBookDossierVariantBank(result.record");
    expect(actions).toContain("compileBookDossierReviewVariantBank(previous!");
    expect(actions).toContain('supabase.from("literary_works")');
    expect(actions).not.toMatch(/service[_-]?role|requestPublicBuild\(/iu);
  });
  it("validates pasted structures and prohibits reviewing unsaved text", () => {
    const editor = read("apps/admin/app/(dashboard)/library/dossiers/BookDossierEditor.tsx");
    expect(editor).toContain("validateBookDossierDraft(JSON.parse(raw)");
    expect(editor).toContain("disabled={pending || dirty}");
    expect(editor).toContain("maxLength={500000}");
    expect(editor).toContain("measureBookDossierDesign(response.record, response.designVariants)");
    const measure = read("apps/admin/app/(dashboard)/library/dossiers/measureDesign.ts");
    expect(measure).toContain("document.fonts.load");
    expect(measure).toContain("canvas.measureText(text).width");
    expect(measure).toContain("layoutBookInspectionDocument(toBookEditorialDocument");
    const migration = read("supabase/migrations/20260905_book_dossiers_v2.sql");
    for (const [file, constant] of [["bookTypography.ts", "BOOK_TYPOGRAPHY_VERSION"], ["bookInspectionPageLayout.ts", "BOOK_INSPECTION_LAYOUT_VERSION"]]) {
      const version = read(`src/books/${file}`).match(new RegExp(`${constant} = "([^"]+)"`, "u"))?.[1];
      expect(version).toBeTruthy();
      expect(migration).toContain(`is distinct from '${version}'`);
    }
    const page = read("apps/admin/app/(dashboard)/library/dossiers/page.tsx");
    expect(page).toContain('.eq("book_key", query.book)');
    expect(page).not.toContain("result?.data?.find");
  });
  it("keeps private progress in POST and never serializes records to static published content", () => {
    const client = read("src/books/bookDossierPublicClient.ts");
    expect(client).toContain('method: "POST"');
    expect(client).toContain('cache: "no-store"');
    expect(client).toContain('credentials: "omit"');
    expect(client).toContain("JSON.stringify({ p_request: request })");
    expect(client).not.toMatch(/searchParams|localStorage|sessionStorage/u);
    expect(read("scripts/export-published-content.mjs")).not.toMatch(/book_dossiers|variant_bank/u);
    expect(JSON.parse(read("package.json")).scripts["build:from-snapshot"]).toContain("scripts/audit-book-dossier-delivery.mjs");
  });
});
