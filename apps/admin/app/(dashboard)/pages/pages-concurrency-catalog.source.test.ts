import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const editPageSource = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");
const editorSource = readFileSync(
  new URL("../../../components/PageEditor.tsx", import.meta.url),
  "utf8"
);

describe("scalable and concurrency-safe pages admin", () => {
  it("uses count/range pagination, parsed filters and stable ordering", () => {
    expect(pageSource).toContain('{ count: "exact" }');
    expect(pageSource).toContain("pagesRequest.range(");
    expect(pageSource).toContain('pagesRequest.ilike("title", catalog.pattern)');
    expect(pageSource).toContain('pagesRequest.eq("status", catalog.status)');
    expect(pageSource).toContain('.order("updated_at", { ascending: false })');
    expect(pageSource).toContain('.order("id", { ascending: false })');
    expect(editPageSource).toContain('{ count: "exact" }');
    expect(editPageSource).toContain(".range((revisionPage - 1) * REVISION_PAGE_SIZE");
    expect(editPageSource).not.toContain(".limit(12)");
  });

  it("CAS-protects full form, status, delete and revision restore", () => {
    expect(editorSource).toContain('name="expected_updated_at"');
    expect(pageSource.match(/name="expected_updated_at"/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(editPageSource.match(/name="expected_updated_at"/gu)?.length).toBeGreaterThanOrEqual(2);
    // Publishing first CAS-reads the exact content version it validates, then
    // CAS-writes that same version. The other three guards cover save/delete/restore.
    expect(actionsSource.match(/\.eq\("updated_at",/gu)?.length).toBe(5);
    expect(actionsSource.match(/\.select\("id"\)\s*\.maybeSingle\(\)/gu)?.length).toBeGreaterThanOrEqual(4);
  });

  it("does not audit or publish stale mutations", () => {
    const firstCas = actionsSource.indexOf('.eq("updated_at", parsed.data.expectedUpdatedAt)');
    const firstPublication = actionsSource.indexOf("const publication = await auditPage", firstCas);
    expect(actionsSource.slice(firstCas, firstPublication)).toContain("if (!updated)");
    expect(actionsSource.slice(firstCas, firstPublication)).toContain("redirect(editorTarget");
  });

  it("propagates publication state and preserves catalog context", () => {
    expect(actionsSource.match(/published: publication\.state/gu)?.length).toBe(5);
    expect(pageSource).toContain('query.published === "started"');
    expect(pageSource).toContain('query.published === "queued"');
    expect(pageSource).toContain('query.published === "queue-error"');
    expect(editorSource).toContain('name="catalog_q"');
    expect(editorSource).toContain('name="catalog_status"');
    expect(editorSource).toContain('name="catalog_page"');
    expect(editorSource).toContain('name="editor_revision_page"');
  });
});
