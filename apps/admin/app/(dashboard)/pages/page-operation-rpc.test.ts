import { describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { PageOperationRpcError, lookupPageOperationRpc, savePageOperationRpc } from "./page-operation-rpc";
import { clone, context, envelope, foreignId, payload, previous } from "../../../lib/page-operation.test-fixture";

const privateMessage = "PRIVATE_PROVIDER_SECRET=do_not_render";
function client(data: unknown, error: unknown = null) { return { rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data, error })) }; }
async function failure(run: Promise<unknown>) {
  try { await run; } catch (error) {
    expect(error).toBeInstanceOf(PageOperationRpcError); expect(error).not.toHaveProperty("cause");
    expect(JSON.stringify({ ...error as object, message: (error as Error).message, stack: (error as Error).stack })).not.toContain(privateMessage);
    return error as PageOperationRpcError;
  }
  throw Error("Expected safe RPC failure");
}
function nativeSignal(kind: "redirect" | "notFound") {
  try { kind === "redirect" ? redirect("/pages") : notFound(); } catch (error) { return error; }
  throw Error("Expected real Next signal");
}
describe("Page operation transactional RPC adapter", () => {
  it("uses exactly one guarded write and four original args without payload/form mutation", async () => {
    const ctx = context(), prepared = payload(), before = clone(prepared), supabase = client(envelope());
    Object.freeze(prepared);
    expect(await savePageOperationRpc(supabase, { payload: prepared, expectedUpdatedAt: previous }, ctx)).toEqual(envelope());
    expect(supabase.rpc).toHaveBeenCalledTimes(1); expect(supabase.rpc).toHaveBeenCalledWith("save_page_operation", {
      p_payload: prepared, p_expected_updated_at: previous, p_operation_id: ctx.operationId, p_submitted_intent: ctx.submittedIntent,
    });
    expect(supabase.rpc.mock.calls[0][1].p_payload).toBe(prepared); expect(supabase.rpc.mock.calls[0][1].p_submitted_intent).toBe(ctx.submittedIntent);
    expect(prepared).toEqual(before);
  });
  it("lookup uses only the generic read RPC with original intent and requires replay evidence", async () => {
    const ctx = context(), supabase = client(envelope(ctx, true));
    expect(await lookupPageOperationRpc(supabase, ctx)).toEqual({ outcome: "found", result: envelope(ctx, true) });
    expect(supabase.rpc).toHaveBeenCalledTimes(1); expect(supabase.rpc).toHaveBeenCalledWith("get_editor_operation_result", {
      p_operation_id: ctx.operationId, p_submitted_intent: ctx.submittedIntent,
    });
  });
  it("exact successful SQL null is not-found only on lookup and never a failed-write proof", async () => {
    const supabase = client(null); expect(await lookupPageOperationRpc(supabase, context())).toEqual({ outcome: "not-found" });
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, context()))).category).toBe("unknown");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
  it.each([
    { id: foreignId }, { updated_by: "not-a-uuid" }, { allow_indexing: "on" }, { status: "hidden" },
    { content_json: null }, { title: "x" }, { canonical_url: "relative" },
  ])("refuses malformed prepared command before any write %j", async patch => {
    const supabase = client(envelope());
    expect((await failure(savePageOperationRpc(supabase, { payload: { ...payload(), ...patch }, expectedUpdatedAt: previous }, context()))).category).toBe("intent-conflict");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it("requires original precise CAS and valid nonce before write/lookup", async () => {
    const supabase = client(envelope()), invalid = { ...context(), operationId: "not-a-uuid" };
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: "2026-10-07T10:00:00.123457Z" }, context()))).category).toBe("intent-conflict");
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, invalid))).category).toBe("intent-conflict");
    expect((await failure(lookupPageOperationRpc(supabase, invalid))).category).toBe("intent-conflict"); expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["PGRST202", privateMessage, "capability-unavailable"], ["42883", privateMessage, "capability-unavailable"],
    ["42501", privateMessage, "permission"], ["22023", "EDITOR_OPERATION_CONFLICT", "intent-conflict"],
    ["22023", "EDITOR_OPERATION_INTENT_INVALID", "intent-conflict"], ["40001", "PAGE_CONFLICT", "conflict"],
  ])("classifies only confirmed structured RPC refusal %s/%s", async (code, message, category) => {
    const supabase = client(null, { code, message, detail: privateMessage });
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, context()))).category).toBe(category);
    expect((await failure(lookupPageOperationRpc(supabase, context()))).category).toBe(category);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
  it.each([
    { code: "22023", message: "PAGE_OPERATION_RECEIPT_INVALID" }, { code: "40001", message: "other" },
    { code: "502", message: privateMessage }, null, undefined,
  ])("generic response error is unknown write / unavailable read %j", async error => {
    const supabase = client(null, error === null ? {} : error);
    if (error === undefined) supabase.rpc.mockImplementation(async () => ({ data: null, error: undefined }));
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, context()))).category).toBe("unknown");
    expect((await failure(lookupPageOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
  });
  it.each(["42501", "40001", "22023"])("transport throw with SQL-looking code %s is not proven refusal", async code => {
    const supabase = { rpc: vi.fn(async () => { throw { code, message: "PAGE_CONFLICT", detail: privateMessage }; }) };
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, context()))).category).toBe("unknown");
    expect((await failure(lookupPageOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
  });
  it.each([null, undefined, {}, [], { data: null }, { error: null }, { data: envelope(), error: { code: "42501", message: privateMessage } }])("does not trust malformed/contradictory RPC response %j", async response => {
    const supabase = { rpc: vi.fn(async () => response as { data: unknown; error: unknown }) };
    expect((await failure(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, context()))).category).toBe("unknown");
    expect((await failure(lookupPageOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
  });
  it.each([envelope(), false, [], {}, { ...envelope(context(), true), operationId: foreignId }])("refuses invalid lookup receipt without a second RPC %j", async data => {
    const supabase = client(data);
    expect((await failure(lookupPageOperationRpc(supabase, context()))).category).toBe("dependency-unavailable");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["redirect", "notFound"] as const)("preserves actual Next %s through write and read", async kind => {
    const signal = nativeSignal(kind), supabase = { rpc: vi.fn(async () => { throw signal; }) };
    await expect(savePageOperationRpc(supabase, { payload: payload(), expectedUpdatedAt: previous }, context())).rejects.toBe(signal);
    await expect(lookupPageOperationRpc(supabase, context())).rejects.toBe(signal);
  });
});
