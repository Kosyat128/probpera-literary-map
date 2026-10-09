import { describe, expect, it } from "vitest";
import { capturePageOperationIntent, parsePageOperationIntent } from "./page-operation-intent";
import { clone, context, form, operationId, pageId, previous, snapshot } from "./page-operation.test-fixture";

describe("Page frozen original operation intent", () => {
  it("preserves authored bytes, media rights and catalog context before preparation", () => {
    const source = form(); source.append("$ACTION_REF_0", "framework");
    source.append("operation_id", "ordinary semantic field"); source.append("article_operation_id", operationId);
    const before = Array.from(source.entries()); const result = capturePageOperationIntent(source)!;
    expect(Array.from(source.entries())).toEqual(before);
    expect(result).toMatchObject({ version: 1, entityType: "page", entityId: pageId, expectedUpdatedAt: previous, intent: "save" });
    const fields = new Map(result.fields);
    expect(fields.get("title")).toBe(snapshot().title); expect(fields.get("content_json")).toBe(snapshot().contentJson);
    expect(fields.get("catalog_q")).toBe("  Ручной поиск  "); expect(fields.get("operation_id")).toBe("ordinary semantic field");
    expect(fields.get("article_operation_id")).toBe(operationId);
    expect(result.fields.map(([name]) => name)).toEqual([...fields.keys()].sort());
    expect([...fields.keys()].filter(name => name.startsWith("$ACTION_") || name === "page_operation_id" || name === "page_result_mode")).toEqual([]);
  });
  it("trims derived context only and keeps raw context field strings", () => {
    const result = capturePageOperationIntent(form(snapshot(), { id: ` \t${pageId}\n`, expected_updated_at: ` ${previous} `, intent: "" }))!;
    expect(result.entityId).toBe(pageId); expect(result.expectedUpdatedAt).toBe(previous); expect(result.intent).toBe("save");
    expect(new Map(result.fields).get("id")).toBe(` \t${pageId}\n`);
  });
  it("accepts publish without changing submitted status or body", () => {
    const result = capturePageOperationIntent(form(snapshot(), { intent: "publish", status: "hidden" }))!;
    expect(result.intent).toBe("publish"); expect(new Map(result.fields).get("status")).toBe("hidden");
    expect(new Map(result.fields).get("content_html")).toBe(snapshot().contentHtml);
  });
  it.each(["id", "expected_updated_at"])("requires existing Page context: %s", name => {
    const source = form(); source.delete(name); expect(capturePageOperationIntent(source)).toBeNull();
  });
  it.each(["id", "title", "catalog_q"])("refuses duplicate semantic %s", name => {
    const source = form(); source.append(name, "duplicate"); expect(capturePageOperationIntent(source)).toBeNull();
  });
  it("refuses File content instead of dropping it", () => {
    const source = form(); source.set("upload", new Blob(["author bytes"]), "manual.txt");
    expect(capturePageOperationIntent(source)).toBeNull();
  });
  it.each([null, false, [], "{}", {}, { version: 1 }])("refuses incomplete/scalar input %j", value => {
    expect(parsePageOperationIntent(value)).toBeNull();
  });
  it.each([
    ["version", 2], ["entityType", "article"], ["entityId", null], ["entityId", "not-uuid"],
    ["expectedUpdatedAt", "2026-10-07"], ["expectedUpdatedAt", null], ["intent", "preview"], ["extra", true],
  ])("rejects malformed descriptor %s=%j without mutation", (key, value) => {
    const input: Record<string, unknown> = clone(context().submittedIntent); input[key] = value;
    const before = clone(input); expect(parsePageOperationIntent(input)).toBeNull(); expect(input).toEqual(before);
  });
  it.each(["version", "entityType", "entityId", "expectedUpdatedAt", "intent", "fields"])("requires descriptor key %s", key => {
    const input: Record<string, unknown> = clone(context().submittedIntent); delete input[key]; expect(parsePageOperationIntent(input)).toBeNull();
  });
  it.each([
    ["intent", " save"], ["id", "44444444-4444-4444-8444-444444444444"], ["expected_updated_at", "2026-10-07T10:00:00.123457+00:00"],
  ])("binds raw context %s", (name, value) => {
    const input = clone(context().submittedIntent); input.fields = input.fields.map(pair => pair[0] === name ? [name, value] : pair);
    expect(parsePageOperationIntent(input)).toBeNull();
  });
  it("refuses unsorted pairs and repeated names", () => {
    const input = clone(context().submittedIntent); input.fields.reverse(); expect(parsePageOperationIntent(input)).toBeNull();
    input.fields.reverse(); input.fields.splice(1, 0, input.fields[0]); expect(parsePageOperationIntent(input)).toBeNull();
  });
  it.each(["page_operation_id", "page_result_mode", "$ACTION_REF_0", "BadName", "a-b", "a".repeat(101)])("rejects field name %s", name => {
    const input = clone(context().submittedIntent); input.fields.push([name, "x"]); input.fields.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    expect(parsePageOperationIntent(input)).toBeNull();
  });
  it("bounds individual values, pair count and actual UTF8 descriptor bytes", () => {
    expect(capturePageOperationIntent(form(snapshot(), { extra: "x".repeat(2_000_001) }))).toBeNull();
    const crowded = form(); for (let index = 0; index < 129; index += 1) crowded.set(`extra_${index}`, "x");
    expect(capturePageOperationIntent(crowded)).toBeNull();
    expect(capturePageOperationIntent(form(snapshot(), { extra: "€".repeat(1_900_000) }))).toBeNull();
  });
});
