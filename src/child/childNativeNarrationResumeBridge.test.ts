import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppPlugin, type ChildNativeContext } from "./childNativeAppBridge";
import type { ChildNativeMediaAsset, ChildNativeMediaLayout } from "./childNativeMedia";
import type { PlatformSnapshot } from "../platform/ports";

// AUTHORED_NOT_RUN: synthetic correlated replies exercise client dispatch and
// retirement only, never native admission, decoded PCM, Play touch or audible audio.
const HASH = "a".repeat(64), TOKEN = "b".repeat(32), SURFACE = "e".repeat(32);
const narration: ChildNativeMediaAsset = { assetId: "Narration.ONE",
  owner: { kind: "work", id: "Work.ONE", contentChecksum: HASH },
  entity: { kind: "narration", id: "Narration.ONE", contentChecksum: "c".repeat(64) },
  role: "narration", mime: "audio/wav", altText: "Synthetic narration", transcript: "Reviewed text." };
const layout: ChildNativeMediaLayout = { x: 0, y: 0, width: 120, height: 80, viewportWidth: 320, viewportHeight: 640 };
const owners: ChildNativeAppController[] = [];
function context(generation = 1): ChildNativeContext {
  return { token: generation === 1 ? TOKEN : generation.toString(16).padStart(32, "0"), generation,
    revision: generation + 1, selectionRevision: generation + 1, profileRevision: generation + 1,
    policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
    mode: "child", profileId: "Reader.ONE", locale: "en", package: { id: "Package.ONE", version: 1, checksum: HASH },
    home: { kind: "activity", id: "Home.ONE", contentChecksum: HASH }, remainingLifetimeMs: 50000 };
}
function prepared() {
  return { status: "prepared", presentationToken: SURFACE, assetId: narration.assetId, remainingLifetimeMs: 10000,
    readingRevision: 3, anchorVersion: 1, anchorId: "Passage.B", sampleRate: 8000, frameCount: 16000, startFrame: 8000 };
}
function unavailable() {
  return { status: "unavailable", presentationToken: null, assetId: narration.assetId, remainingLifetimeMs: 0,
    readingRevision: null, anchorVersion: null, anchorId: null, sampleRate: 0, frameCount: 0, startFrame: 0 };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let i = 0; i < 48; ++i) await Promise.resolve(); }
function fixture(absent?: "resumeNarration" | "readReadingPosition" | "releaseMedia") {
  let serial = 0, native = context(), platform: PlatformSnapshot = Object.freeze({ connectivity: "online", visibility: "active" });
  const listeners = new Set<() => void>(), order: string[] = [];
  const dataReply = (request: unknown, value: unknown) => {
    const q = request as { requestId: string; contextToken: string };
    return { version: 2, requestId: q.requestId, status: "ok", contextToken: q.contextToken, generation: native.generation, value };
  };
  const appReply = (request: unknown) => ({ version: 2, requestId: (request as { requestId: string }).requestId,
    status: "child", reason: null, context: native, profiles: [{ id: "Reader.ONE", label: "Synthetic reader", exactAge: 9, locale: "en" }] });
  const plugin = {
    bootstrap: vi.fn(async (q: unknown): Promise<unknown> => appReply(q)),
    readContext: vi.fn(async (q: unknown): Promise<unknown> => appReply(q)),
    perform: vi.fn(async (q: unknown): Promise<unknown> => { order.push("perform"); native = context(2); return appReply(q); }),
    retire: vi.fn(async (q: unknown): Promise<unknown> => { const r = q as { requestId: string; contextToken: string | null };
      return { version: 2, requestId: r.requestId, contextToken: r.contextToken, status: "retired" }; }),
    readEntity: vi.fn(async (_q: unknown): Promise<unknown> => null),
    search: vi.fn(async (_q: unknown): Promise<unknown> => null),
    readCollection: vi.fn(async (_q: unknown): Promise<unknown> => null),
    writeCollection: vi.fn(async (_q: unknown): Promise<unknown> => null),
    readReadingPosition: vi.fn(async (q: unknown): Promise<unknown> => dataReply(q, { profileId: "Reader.ONE", revision: 0, position: null })),
    listMedia: vi.fn(async (q: unknown): Promise<unknown> => dataReply(q, [narration])),
    presentMedia: vi.fn(async (q: unknown): Promise<unknown> => dataReply(q,
      { status: "presented", presentationToken: SURFACE, assetId: narration.assetId, remainingLifetimeMs: 10000 })),
    resumeNarration: vi.fn(async (q: unknown): Promise<unknown> => { order.push("prepare"); return dataReply(q, prepared()); }),
    releaseMedia: vi.fn(async (q: unknown): Promise<unknown> => { order.push("release");
      return dataReply(q, { status: "retired", presentationToken: (q as { presentationToken: string | null }).presentationToken }); }),
    addListener: vi.fn(async () => ({ remove: async () => undefined })),
  } satisfies ChildNativeAppPlugin;
  if (absent) Reflect.deleteProperty(plugin, absent);
  const controller = createChildNativeAppController({ plugin,
    lifecycle: { getSnapshot: () => platform, subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; } },
    requestId: () => (++serial).toString(16).padStart(32, "0"), nowMs: () => Date.now(), timeoutMs: 1000 });
  owners.push(controller); const clear = vi.fn(() => { order.push("clear"); }); controller.attachPresentationBarrier(clear);
  return { controller, plugin, dataReply, clear, order,
    hide() { platform = Object.freeze({ connectivity: "online", visibility: "background" }); for (const fn of listeners) fn(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(async () => { for (const c of owners.splice(0)) await c.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("S16 BIL009 narration native preparation wire", () => {
  it("sends only the actual current owner asset layout and expected revision without anchor or playback authority", async () => {
    const f = fixture(); await f.controller.start();
    expect(await f.controller.media!.resumeNarration!(narration, layout, 3)).toEqual(prepared());
    const q = f.plugin.resumeNarration.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(q).sort()).toEqual(["assetId", "contextToken", "expectedReadingRevision", "layout", "owner", "requestId", "version"]);
    expect(q).toMatchObject({ version: 2, contextToken: TOKEN, owner: narration.owner, assetId: narration.assetId, layout, expectedReadingRevision: 3 });
    expect(f.plugin.resumeNarration).toHaveBeenCalledTimes(1); expect(f.plugin.perform).not.toHaveBeenCalled();
    expect(f.plugin.presentMedia).not.toHaveBeenCalled(); expect(f.plugin.readEntity).not.toHaveBeenCalled();
  });
  it("accepts a correlated known refusal with unknown revision fields and retains the current child context", async () => {
    const f = fixture(); await f.controller.start();
    f.plugin.resumeNarration.mockImplementationOnce(async q => f.dataReply(q, unavailable()));
    expect(await f.controller.media!.resumeNarration!(narration, layout, 0)).toEqual(unavailable());
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "ready", status: "child", context: { token: TOKEN } });
    expect(f.plugin.retire).not.toHaveBeenCalled(); expect(f.plugin.presentMedia).not.toHaveBeenCalled();
  });
  it("keeps older native hosts on ordinary explicit presentation without offering a synthetic resume port", async () => {
    for (const absent of ["resumeNarration", "readReadingPosition", "releaseMedia"] as const) {
      const f = fixture(absent); await f.controller.start();
      expect(f.controller.media!.resumeNarration).toBeUndefined();
      expect(await f.controller.media!.present(narration, layout)).toMatchObject({ status: "presented" });
      expect(f.plugin.presentMedia).toHaveBeenCalledTimes(1); expect(f.plugin.retire).not.toHaveBeenCalled();
    }
  });
  it("refuses malformed revisions noncanonical narration and invalid layout before any native preparation", async () => {
    const f = fixture(); await f.controller.start();
    for (const revision of [-0, -1, 1.5, Number.MAX_SAFE_INTEGER - 1, "3", true])
      expect(await f.controller.media!.resumeNarration!(narration, layout, revision as number)).toBeNull();
    for (const bad of [{ ...narration, role: "image" as const }, { ...narration, owner: { ...narration.owner, kind: "recent" as const } }])
      expect(await f.controller.media!.resumeNarration!(bad, layout, 3)).toBeNull();
    expect(await f.controller.media!.resumeNarration!(narration, { ...layout, x: -0 }, 3)).toBeNull();
    expect(f.plugin.resumeNarration).not.toHaveBeenCalled(); expect(f.plugin.releaseMedia).not.toHaveBeenCalled();
  });
  it("seals uncorrelated or malformed prepared replies and retires the original context without replay", async () => {
    for (const failure of ["request", "context", "generation", "playing"] as const) {
      const f = fixture(); await f.controller.start();
      f.plugin.resumeNarration.mockImplementationOnce(async q => {
        const row = f.dataReply(q, prepared());
        return failure === "request" ? { ...row, requestId: "f".repeat(32) }
          : failure === "context" ? { ...row, contextToken: "f".repeat(32) }
          : failure === "generation" ? { ...row, generation: 2 } : { ...row, value: { ...prepared(), status: "playing" } };
      });
      expect(await f.controller.media!.resumeNarration!(narration, layout, 3)).toBeNull();
      expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.retire).toHaveBeenCalledTimes(1);
      expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN });
      expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1); expect(f.plugin.resumeNarration).toHaveBeenCalledTimes(1);
    }
  });
  it("conceals a held preparation immediately on background and ignores its late prepared reply", async () => {
    const f = fixture(); await f.controller.start(); const held = deferred<unknown>();
    f.plugin.resumeNarration.mockReturnValueOnce(held.promise);
    const pending = f.controller.media!.resumeNarration!(narration, layout, 3); await settle(); f.hide();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "sealed", context: null }); expect(f.clear).toHaveBeenCalled();
    await settle(); expect(f.plugin.releaseMedia.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN, presentationToken: null });
    held.resolve(f.dataReply(f.plugin.resumeNarration.mock.calls[0][0], prepared()));
    expect(await pending).toBeNull(); await settle();
    expect(f.plugin.resumeNarration).toHaveBeenCalledTimes(1); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
  });
  it("joins held preparation and the actual native revocation ACK before the existing parent route can advance", async () => {
    const f = fixture(); await f.controller.start(); const held = deferred<unknown>(), revoked = deferred<unknown>();
    f.plugin.resumeNarration.mockReturnValueOnce(held.promise); f.plugin.releaseMedia.mockReturnValueOnce(revoked.promise);
    const pending = f.controller.media!.resumeNarration!(narration, layout, 3); await settle();
    const action = f.controller.perform("exit-child-mode"); await settle();
    expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.perform).not.toHaveBeenCalled();
    expect(f.plugin.releaseMedia.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN, presentationToken: null });
    held.resolve(f.dataReply(f.plugin.resumeNarration.mock.calls[0][0], prepared())); expect(await pending).toBeNull();
    await settle(); expect(f.plugin.perform).not.toHaveBeenCalled();
    revoked.resolve(f.dataReply(f.plugin.releaseMedia.mock.calls[0][0], { status: "retired", presentationToken: null }));
    expect(await action).toBe(true); expect(f.plugin.perform).toHaveBeenCalledTimes(1);
    expect(f.order.lastIndexOf("clear")).toBeLessThan(f.order.lastIndexOf("release"));
    expect(f.order.lastIndexOf("release")).toBeLessThan(f.order.lastIndexOf("perform"));
  });
});
