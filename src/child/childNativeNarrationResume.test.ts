import { describe, expect, it, vi } from "vitest";
import { childNativeNarrationRevision, decodeChildNativeNarrationResume, prepareChildNativeNarrationResume,
  type ChildNativeMediaAsset, type ChildNativeMediaLayout, type ChildNativeNarrationResumePresentation } from "./childNativeMedia";
import { CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppSnapshot, type ChildNativeContext, type ChildNativeEntity } from "./childNativeAppBridge";
import type { ChildNativeReadingPosition } from "./childReadingPosition";
import type { ChildEntityReference, ChildEntityPayload } from "./childPackage";

// AUTHORED_NOT_RUN. Synthetic DTO/controller mechanics confer no native admission,
// signatures, PCM playback, real Play touch, storage/OS or human approval.
const HASH = "a".repeat(64), MEDIA_HASH = "c".repeat(64), TOKEN = "b".repeat(32), SURFACE = "e".repeat(32);
const owner: ChildEntityReference = { kind: "work", id: "Work.ONE", contentChecksum: HASH };
const asset: ChildNativeMediaAsset = { assetId: "Narration.ONE", owner,
  entity: { kind: "narration", id: "Narration.ONE", contentChecksum: MEDIA_HASH }, role: "narration", mime: "audio/wav",
  altText: "Reviewed narration fixture", transcript: "First. Second." };
const layout: ChildNativeMediaLayout = { x: 0, y: 0, width: 120, height: 80, viewportWidth: 320, viewportHeight: 640 };
function context(locale: "ru" | "en" = "en"): ChildNativeContext {
  return { token: TOKEN, generation: 1, revision: 2, selectionRevision: 2, profileRevision: 2,
    policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
    mode: "child", profileId: "Reader.ONE", locale, package: { id: "Package.ONE", version: 1, checksum: HASH },
    home: { kind: "activity", id: "Home.ONE", contentChecksum: HASH }, remainingLifetimeMs: 30000 };
}
function saved(): ChildNativeReadingPosition {
  return { profileId: "Reader.ONE", revision: 3,
    position: { schemaVersion: 1, entity: { kind: "work", id: "Work.ONE" }, anchorVersion: 1, anchorId: "Passage.B" } };
}
function payload(): ChildEntityPayload {
  return { title: "Reviewed text fixture", text: "First. Second.", terms: [], references: [],
    readingAnchors: { schemaVersion: 1, anchorVersion: 1,
      segments: [{ anchorId: "Passage.A", text: "First. " }, { anchorId: "Passage.B", text: "Second." }],
      narration: { assetId: asset.assetId, sha256: MEDIA_HASH, sampleRate: 8000, frameCount: 16000,
        cues: [{ anchorId: "Passage.A", startFrame: 0, endFrame: 8000 }, { anchorId: "Passage.B", startFrame: 8000, endFrame: 16000 }] } } };
}
function prepared(): ChildNativeNarrationResumePresentation {
  return { status: "prepared", presentationToken: SURFACE, assetId: asset.assetId, remainingLifetimeMs: 10000,
    readingRevision: 3, anchorVersion: 1, anchorId: "Passage.B", sampleRate: 8000, frameCount: 16000, startFrame: 8000 };
}
function unavailable(): ChildNativeNarrationResumePresentation {
  return { status: "unavailable", presentationToken: null, assetId: asset.assetId, remainingLifetimeMs: 0,
    readingRevision: null, anchorVersion: null, anchorId: null, sampleRate: 0, frameCount: 0, startFrame: 0 };
}
function fixture(locale: "ru" | "en" = "en") {
  const original = context(locale);
  let state: ChildNativeAppSnapshot = { phase: "ready", status: "child", reason: null, context: original, profiles: [] };
  const reading = {
    readReadingPosition: vi.fn(async (_ref: ChildEntityReference): Promise<ChildNativeReadingPosition | null> => saved()),
    rememberReadingPosition: vi.fn(async (): Promise<ChildNativeReadingPosition | null> => null),
  };
  const media = {
    list: vi.fn(async (): Promise<readonly ChildNativeMediaAsset[] | null> => [asset]),
    present: vi.fn(async () => null),
    resumeNarration: vi.fn(async (_asset: ChildNativeMediaAsset, _layout: ChildNativeMediaLayout, _revision: number):
      Promise<ChildNativeNarrationResumePresentation | null> => prepared()),
    release: vi.fn(async (_token: string | null) => true), releaseAll: vi.fn(async () => true),
  };
  const controller = { getSnapshot: () => state, reading, media,
    readEntity: vi.fn(async (_ref: ChildEntityReference): Promise<ChildNativeEntity | null> => ({ reference: owner, payload: payload() })),
  } satisfies Pick<ChildNativeAppController, "getSnapshot" | "reading" | "media" | "readEntity">;
  return { controller, original, reading, media, replace(next: ChildNativeContext | null) { state = { ...state, context: next, phase: next ? "ready" : "sealed" }; } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let i = 0; i < 32; ++i) await Promise.resolve(); }

describe("S16 BIL009 narration prepared projection", () => {
  it("copies exact prepared-only current revision and canonical cue fields without a playing claim", () => {
    const raw = prepared(), decoded = decodeChildNativeNarrationResume(raw, asset.assetId, 3);
    expect(decoded).toEqual(raw); expect(decoded).not.toBe(raw); expect(Object.isFrozen(decoded)).toBe(true);
    expect(decoded!.status).toBe("prepared");
    expect(decodeChildNativeNarrationResume(unavailable(), asset.assetId, 0)).toEqual(unavailable());
  });
  it("rejects malformed revisions rates frames statuses and extra caller media authority", () => {
    const good = prepared();
    for (const raw of [{ ...good, readingRevision: 4 }, { ...good, anchorId: "wrong/anchor" }, { ...good, anchorVersion: 0 },
      { ...good, sampleRate: 7999 }, { ...good, frameCount: 480001 }, { ...good, startFrame: 16000 },
      { ...good, startFrame: -0 }, { ...good, status: "playing" }, { ...good, audible: true }, { ...good, url: "file:///audio" }])
      expect(decodeChildNativeNarrationResume(raw, asset.assetId, 3)).toBeNull();
    for (const revision of [-0, -1, Number.MAX_SAFE_INTEGER - 1, 1.5, "3", true]) {
      expect(childNativeNarrationRevision(revision)).toBe(false);
      expect(decodeChildNativeNarrationResume(good, asset.assetId, revision as number)).toBeNull();
    }
    expect(decodeChildNativeNarrationResume(good, "Other.Asset", 3)).toBeNull();
    expect(decodeChildNativeNarrationResume(good, asset.assetId, 0)).toBeNull();
  });
  it("keeps unavailable revision and cue fields unknown instead of converting them to a saved position", () => {
    for (const raw of [{ ...unavailable(), readingRevision: 0 }, { ...unavailable(), anchorVersion: 1 },
      { ...unavailable(), anchorId: "Passage.B" }, { ...unavailable(), sampleRate: 8000 },
      { ...unavailable(), startFrame: -0 }, { ...unavailable(), presentationToken: SURFACE }])
      expect(decodeChildNativeNarrationResume(raw, asset.assetId, 3)).toBeNull();
  });
  it("refuses accessors and hostile reflection without evaluating a supplied field getter", () => {
    const get = vi.fn(() => SURFACE), row = { ...prepared() };
    Object.defineProperty(row, "presentationToken", { enumerable: true, get });
    const hostile = new Proxy(prepared(), { ownKeys() { throw new Error("refuse"); } });
    expect(decodeChildNativeNarrationResume(row, asset.assetId, 3)).toBeNull();
    expect(decodeChildNativeNarrationResume(hostile, asset.assetId, 3)).toBeNull(); expect(get).not.toHaveBeenCalled();
  });
});

describe("S16 BIL009 explicit current-context narration resume", () => {
  it("reads the native bookmark and signed aligned owner in both locales before preparing without writes or autoplay", async () => {
    for (const locale of ["ru", "en"] as const) {
      const f = fixture(locale), result = await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout);
      expect(result).toEqual({ status: "prepared", presentation: prepared() });
      expect(f.reading.readReadingPosition).toHaveBeenCalledTimes(1); expect(f.reading.readReadingPosition).toHaveBeenCalledWith(owner);
      expect(f.controller.readEntity).toHaveBeenCalledTimes(1); expect(f.controller.readEntity).toHaveBeenCalledWith(owner);
      expect(f.media.resumeNarration).toHaveBeenCalledTimes(1); expect(f.media.resumeNarration).toHaveBeenCalledWith(asset, layout, 3);
      expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled(); expect(f.media.present).not.toHaveBeenCalled();
    }
  });
  it("refuses unknown malformed sibling or absent native ledger before reading private entity data or preparing", async () => {
    const refused: readonly (ChildNativeReadingPosition | null)[] = [null, { ...saved(), profileId: "Sibling" },
      { ...saved(), position: { ...saved().position!, entity: { kind: "work", id: "Sibling.Work" } } }];
    for (const value of refused) {
      const f = fixture(); f.reading.readReadingPosition.mockResolvedValueOnce(value);
      expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
      expect(f.controller.readEntity).not.toHaveBeenCalled(); expect(f.media.resumeNarration).not.toHaveBeenCalled();
    }
    const f = fixture(); f.reading.readReadingPosition.mockResolvedValueOnce({ profileId: "Reader.ONE", revision: 0, position: null });
    expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "absent" });
    expect(f.controller.readEntity).not.toHaveBeenCalled(); expect(f.media.resumeNarration).not.toHaveBeenCalled();
  });
  it("preserves unknown anchor versions IDs and absent signed mappings without dispatching resume or overwriting", async () => {
    for (const position of [{ ...saved().position!, anchorVersion: 99 }, { ...saved().position!, anchorId: "Unknown.Anchor" }]) {
      const before = { ...position, entity: { ...position.entity } }, f = fixture(); f.reading.readReadingPosition.mockResolvedValueOnce({ ...saved(), position });
      expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
      expect(f.media.resumeNarration).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
      expect(position).toEqual(before);
    }
    const f = fixture(), legacy: ChildEntityPayload = { title: "Original", text: "Original plain text", terms: [], references: [] };
    f.controller.readEntity.mockResolvedValueOnce({ reference: owner, payload: legacy });
    expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
    expect(f.media.resumeNarration).not.toHaveBeenCalled(); expect(legacy.text).toBe("Original plain text");
  });
  it("requires the actual owner checksum and narration cue relation before dispatch", async () => {
    for (const changed of ["owner", "cue", "transcript"] as const) {
      const f = fixture(), value = payload();
      f.controller.readEntity.mockResolvedValueOnce(changed === "owner" ? { reference: { ...owner, contentChecksum: "d".repeat(64) }, payload: value }
        : changed === "transcript" ? { reference: owner, payload: { ...value, text: "Other. Second.", readingAnchors: { ...value.readingAnchors!, segments: [{ anchorId: "Passage.A", text: "Other. " }, { anchorId: "Passage.B", text: "Second." }] } } } : { reference: owner, payload: { ...value, readingAnchors: { ...value.readingAnchors!,
          narration: { ...value.readingAnchors!.narration!, assetId: "Other.Narration" } } } });
      expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
      expect(f.media.resumeNarration).not.toHaveBeenCalled();
    }
  });
  it("retains read errors honestly and never retries or silently opens ordinary narration", async () => {
    const f = fixture(); f.reading.readReadingPosition.mockRejectedValueOnce(new Error("transport unavailable"));
    expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
    await settle(); expect(f.reading.readReadingPosition).toHaveBeenCalledOnce();
    expect(f.controller.readEntity).not.toHaveBeenCalled(); expect(f.media.resumeNarration).not.toHaveBeenCalled(); expect(f.media.present).not.toHaveBeenCalled();
  });
  it("keeps legacy missing reading or resume ports free of synthetic ledger and media calls", async () => {
    const f = fixture();
    for (const controller of [{ ...f.controller, reading: undefined }, { ...f.controller, media: { ...f.media, resumeNarration: undefined } }]) {
      expect(await prepareChildNativeNarrationResume(controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
    }
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(f.controller.readEntity).not.toHaveBeenCalled();
    expect(f.media.resumeNarration).not.toHaveBeenCalled(); expect(f.media.present).not.toHaveBeenCalled();
  });
  it("refuses copied original contexts and ignores same-token owner or package replacement after a held native read", async () => {
    const f = fixture();
    expect(await prepareChildNativeNarrationResume(f.controller, { ...f.original }, asset, layout)).toEqual({ status: "retired" });
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled();
    for (const context of [{ ...f.original, profileId: "Sibling" }, { ...f.original, package: { ...f.original.package!, checksum: "d".repeat(64) } }]) {
      f.replace(f.original); const held = deferred<ChildNativeReadingPosition | null>(); f.reading.readReadingPosition.mockReturnValueOnce(held.promise);
      const result = prepareChildNativeNarrationResume(f.controller, f.original, asset, layout); await settle(); f.replace(context); held.resolve(saved());
      expect(await result).toEqual({ status: "retired" }); expect(f.controller.readEntity).not.toHaveBeenCalled(); expect(f.media.resumeNarration).not.toHaveBeenCalled();
    }
  });
  it("retires cancelled late preparations with the original token and never publishes or writes a replacement", async () => {
    const f = fixture(), held = deferred<ChildNativeNarrationResumePresentation | null>(); let pending = true;
    f.media.resumeNarration.mockReturnValueOnce(held.promise);
    const result = prepareChildNativeNarrationResume(f.controller, f.original, asset, layout, () => pending);
    await settle(); expect(f.media.resumeNarration).toHaveBeenCalledOnce(); pending = false; held.resolve(prepared());
    expect(await result).toEqual({ status: "retired" }); expect(f.media.release).toHaveBeenCalledTimes(1); expect(f.media.release).toHaveBeenCalledWith(SURFACE);
    expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled(); expect(f.media.present).not.toHaveBeenCalled();
  });
  it("joins malformed or mismatched prepared ACK cleanup and keeps known native refusal truthful", async () => {
    for (const reply of [{ ...prepared(), anchorId: "Passage.A" }, { ...prepared(), startFrame: 0 }, { ...prepared(), readingRevision: 4 }]) {
      const f = fixture(); f.media.resumeNarration.mockResolvedValueOnce(reply);
      expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
      expect(f.media.releaseAll).toHaveBeenCalledOnce(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
    }
    const f = fixture(); f.media.resumeNarration.mockResolvedValueOnce(unavailable());
    expect(await prepareChildNativeNarrationResume(f.controller, f.original, asset, layout)).toEqual({ status: "unavailable" });
    expect(f.media.present).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
  });
});
