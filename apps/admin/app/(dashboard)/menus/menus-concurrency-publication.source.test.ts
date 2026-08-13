import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("navigation concurrency and publication feedback", () => {
  it("CAS-protects update and delete using the rendered version", () => {
    expect(pageSource.match(/name="expected_updated_at"/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(actionsSource).toContain('.eq("updated_at", parsed.data.expectedUpdatedAt)');
    expect(actionsSource).toContain('.eq("updated_at", expectedUpdatedAt.data)');
    expect(actionsSource.match(/\.select\("id"\)\s*\.maybeSingle\(\)/gu)?.length).toBe(2);
  });

  it("does not audit or publish a stale navigation mutation", () => {
    const updateCas = actionsSource.indexOf('.eq("updated_at", parsed.data.expectedUpdatedAt)');
    const finish = actionsSource.indexOf("const publication = await finishNavigationAction", updateCas);
    expect(actionsSource.slice(updateCas, finish)).toContain("if (!updated)");
    expect(actionsSource.slice(updateCas, finish)).toContain("redirect(menuTarget");
  });

  it("returns the real publication state and renders all three states", () => {
    expect(actionsSource).toContain("return publication.state");
    expect(actionsSource).toContain('published: publication');
    expect(pageSource).toContain('query.published === "started"');
    expect(pageSource).toContain('query.published === "queued"');
    expect(pageSource).toContain('query.published === "queue-error"');
  });

  it("uses stable menu/item ordering and preserves location context", () => {
    expect(pageSource).toContain('.order("location").order("id")');
    expect(pageSource).toContain('.order("display_order")');
    expect(pageSource).toContain('name="context_location"');
    expect(actionsSource).toContain('params.set("location", location)');
  });
});
