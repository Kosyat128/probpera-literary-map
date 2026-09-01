import { describe, expect, it, vi } from "vitest";

import { recordTranslationSyncRun } from "./translation-run-record";

describe("durable synchronous translation run record", () => {
  it("normalizes outcomes and persists the resume cursor without source prose", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "11111111-1111-4111-8111-111111111111",
      error: null,
    });
    const id = await recordTranslationSyncRun({
      supabase: { rpc } as never,
      kind: "literary_work",
      items: [
        { entityId: "work-1", state: "translated", model: "model" },
        { entityId: "work-2", state: "conflict" },
        { entityId: "work-3", state: "failed", error: "schema mismatch" },
      ],
      resumeCursor: { libraryCursor: 42 },
    });

    expect(id).toBe("11111111-1111-4111-8111-111111111111");
    const [, payload] = rpc.mock.calls[0];
    expect(payload.p_resume_cursor).toEqual({ libraryCursor: 42 });
    expect(payload.p_items).toEqual([
      { entityType: "literary_work", entityId: "work-1" },
      { entityType: "literary_work", entityId: "work-2" },
      { entityType: "literary_work", entityId: "work-3" },
    ]);
    expect(payload.p_outcomes).toEqual([
      { status: "succeeded", model: "model" },
      { status: "conflict", errorCode: "write_conflict" },
      { status: "dead_letter", errorCode: "provider_invalid_response" },
    ]);
    expect(JSON.stringify(payload)).not.toContain("schema mismatch");
  });

  it("fails closed if the durable record cannot be written", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST" } });
    await expect(
      recordTranslationSyncRun({
        supabase: { rpc } as never,
        kind: "article",
        items: [{ entityId: "article-1", state: "skipped" }],
      })
    ).rejects.toThrow("translation run record failed");
  });
});
