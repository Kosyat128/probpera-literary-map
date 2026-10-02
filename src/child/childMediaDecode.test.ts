import { afterEach, describe, expect, it, vi } from "vitest";
import { createChildMediaDecoder, createWebChildMediaCodec, preflightChildMedia,
  type ChildDecodedMediaDelivery, type ChildDecodedResource, type ChildMediaDecoderOptions } from "./childMediaDecode";
import { childMediaContainerMatches, type ChildMediaDelivery } from "./childMedia";
import type { ChildRouteChallenge } from "./childStartup";

// All host, rights-loader and codec results here are explicit synthetic ports.
// These are lifecycle/resource regressions, not browser codec or human approval.
const at = 1_790_942_400_000, hash = "a".repeat(64);
// Owned 1×1 grayscale+alpha fixture: zlib([0,255,255]), CRC32 per chunk; 68 bytes.
const png = () => new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=", "base64"));
const ascii = (b: Uint8Array, p: number, s: string) => [...s].forEach((c, i) => { b[p + i] = c.charCodeAt(0); });
function wav(channels = 1, rate = 8000, frames = 8, bits: 8 | 16 = 16) {
  const block = channels * bits / 8, data = frames * block, b = new Uint8Array(44 + data + (data & 1)), v = new DataView(b.buffer);
  ascii(b, 0, "RIFF"); v.setUint32(4, b.length - 8, true); ascii(b, 8, "WAVE"); ascii(b, 12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, channels, true); v.setUint32(24, rate, true); v.setUint32(28, rate * block, true);
  v.setUint16(32, block, true); v.setUint16(34, bits, true); ascii(b, 36, "data"); v.setUint32(40, data, true); return b;
}
// Minimal structural JPEG/WebP fixtures are not represented as codec-valid.
function jpeg(width = 2, height = 3) {
  const b = new Uint8Array([255,216,255,192,0,11,8,0,0,0,0,1,1,17,0,255,218,0,8,1,1,0,0,63,0,255,217]);
  const v = new DataView(b.buffer); v.setUint16(7, height); v.setUint16(9, width); return b;
}
function webp(width = 2, height = 3, extended = false) {
  const b = new Uint8Array(extended ? 48 : 30), v = new DataView(b.buffer);
  ascii(b, 0, "RIFF"); v.setUint32(4, b.length - 8, true); ascii(b, 8, "WEBP");
  let p = 12;
  if (extended) { ascii(b, p, "VP8X"); v.setUint32(p + 4, 10, true); b[p + 12] = width - 1; b[p + 15] = height - 1; p += 18; }
  ascii(b, p, "VP8 "); v.setUint32(p + 4, 10, true); b.set([0x9d, 1, 0x2a], p + 11);
  v.setUint16(p + 14, width, true); v.setUint16(p + 16, height, true); return b;
}
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
const instances: Array<{ dispose(): void }> = [];
function fixture(locale: "ru" | "en" = "ru", audio = false) {
  const context: ChildRouteChallenge = { generation: 1, request: { locale, route: { kind: "home", entityId: null } },
    selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: "synthetic-child", profileRevision: 1,
      profileChecksum: hash, policyVersion: "synthetic-v1", policyChecksum: hash },
    profile: { id: "synthetic-child", label: "Private synthetic nickname", exactAge: 9, ageBand: "9-11", locale,
      ageConfirmedAt: "2026-10-01T00:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: [],
      soundEnabled: false, motion: "calm", narrationEnabled: false },
    scope: { schemaVersion: 1, namespace: "child", profileId: "synthetic-child", profileRevision: 1, exactAge: 9, locale,
      policyVersion: "synthetic-v1", policyChecksum: hash, packageId: "synthetic-package", packageVersion: 1, packageChecksum: hash },
    validUntilEpochMs: at + 60_000 };
  const bytes = audio ? wav() : png(), owner = { kind: "work" as const, id: "synthetic-work", contentChecksum: hash };
  const delivery = { scope: context.scope, asset: { owner, entity: { kind: audio ? "narration" as const : "image" as const,
    id: "synthetic-media", contentChecksum: hash }, assetId: "synthetic-asset", inventoryKey: audio ? "synthetic.wav" : "synthetic.png",
    sha256: hash, bytes: bytes.length, mime: audio ? "audio/wav" as const : "image/png" as const }, bytes, validUntilEpochMs: at + 60_000 } satisfies ChildMediaDelivery;
  const state = { time: at, context, host: true }, close = vi.fn();
  const samples = new Float32Array(8).fill(0.5);
  const resource: ChildDecodedResource = audio ? { kind: "audio", buffer: { sampleRate: 8000, numberOfChannels: 1,
    length: 8, duration: 0.001, getChannelData: () => samples } as unknown as AudioBuffer, close }
    : { kind: "image", bitmap: { width: 1, height: 1 } as ImageBitmap, close };
  const loader = { visitMedia: vi.fn(async (_input: unknown, signal: AbortSignal, visitor: (v: ChildMediaDelivery) => void) => {
    if (signal.aborted) return false; visitor(delivery); return true;
  }) };
  const codec = { decode: vi.fn(async (): Promise<ChildDecodedResource> => resource) };
  const options: ChildMediaDecoderOptions = { loader, codec, context: () => state.context,
    isCurrent: captured => state.host && JSON.stringify(captured) === JSON.stringify(state.context),
    clock: { nowEpochMs: () => state.time }, timeoutMs: 100, initialVisibility: "active" };
  const decoder = createChildMediaDecoder(options); instances.push(decoder);
  const input = { assetId: delivery.asset.assetId, owner }, visit = (visitor: (v: ChildDecodedMediaDelivery) => void = () => {}, signal = new AbortController().signal) => decoder.visitDecoded(input, signal, visitor);
  return { context, state, bytes, delivery, input, resource, close, samples, loader, codec, options, decoder, visit };
}
afterEach(() => { instances.splice(0).forEach(v => v.dispose()); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("child static codec preflight", () => {
  it("rejects the legacy misaligned IDAT fixture despite matching PNG signature and IEND", () => {
    const malformed = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==", "base64"));
    expect(malformed.length).toBe(67); expect(childMediaContainerMatches(malformed, "image/png")).toBe(true);
    expect(preflightChildMedia(malformed, "image/png")).toBeNull();
  });

  it.each(["png", "jpeg", "webp"] as const)("admits bounded %s structural dimensions", format => {
    const bytes = format === "png" ? png() : format === "jpeg" ? jpeg() : webp();
    expect(preflightChildMedia(bytes, `image/${format}`)).toEqual({ kind: "image", width: format === "png" ? 1 : 2, height: format === "png" ? 1 : 3 });
  });
  it("rejects oversized PNG before codec allocation and malformed chunk lengths", () => {
    const b = png(), v = new DataView(b.buffer); v.setUint32(16, 2049); expect(preflightChildMedia(b, "image/png")).toBeNull();
    v.setUint32(16, 1); v.setUint32(33, 0xffffffff); expect(preflightChildMedia(b, "image/png")).toBeNull();
  });
  it("rejects APNG timeline chunks on the static port", () => {
    const b = png(); ascii(b, 37, "acTL"); expect(preflightChildMedia(b, "image/png")).toBeNull();
  });
  it("rejects conflicting WebP canvas and coded frame dimensions, and animation flag", () => {
    const b = webp(2, 3, true); b[24] = 4; expect(preflightChildMedia(b, "image/webp")).toBeNull();
    b[24] = 1; b[20] = 2; expect(preflightChildMedia(b, "image/webp")).toBeNull();
  });
  it("rejects unsupported/malformed JPEG frame precision and oversized dimensions", () => {
    const b = jpeg(); b[6] = 12; expect(preflightChildMedia(b, "image/jpeg")).toBeNull();
    expect(preflightChildMedia(jpeg(4096, 1), "image/jpeg")).toBeNull();
  });
  it("scans entropy to deny a later larger SOF/DNL while allowing stuffed/restart bytes and progressive scans", () => {
    const first = jpeg(), frame = jpeg(2048, 2048).slice(2, 15);
    const twice = new Uint8Array(first.length - 2 + frame.length + 2); twice.set(first.slice(0, -2)); twice.set(frame, first.length - 2); twice.set([255, 217], twice.length - 2);
    expect(preflightChildMedia(twice, "image/jpeg")).toBeNull();
    const dnl = new Uint8Array(first.length + 6); dnl.set(first.slice(0, -2)); dnl.set([255, 220, 0, 4, 8, 0, 255, 217], first.length - 2);
    expect(preflightChildMedia(dnl, "image/jpeg")).toBeNull();
    const progressive = new Uint8Array(first.length + 16); progressive.set(first.slice(0, -2)); progressive[3] = 0xc2;
    progressive.set([255,0,1,255,208,255,218,0,8,1,1,0,0,63,0,1,255,217], first.length - 2);
    expect(preflightChildMedia(progressive, "image/jpeg")).toEqual({ kind: "image", width: 2, height: 3 });
  });
  it.each([8, 16] as const)("admits bounded %i-bit mono/stereo PCM WAV", bits => {
    expect(preflightChildMedia(wav(2, 48000, 480, bits), "audio/wav")).toEqual({ kind: "audio", channels: 2, sampleRate: 48000, frames: 480, duration: 0.01, bits });
  });
  it("rejects float/24-bit/multichannel WAV, inconsistent block/byte rates and long narration", () => {
    for (const [offset, value] of [[20, 3], [34, 24], [22, 3], [32, 4], [28, 1]] as const) {
      const b = wav(); new DataView(b.buffer).setUint16(offset, value, true); expect(preflightChildMedia(b, "audio/wav")).toBeNull();
    }
    expect(preflightChildMedia(wav(1, 8000, 8000 * 60 + 1), "audio/wav")).toBeNull();
  });
  it("denies byte getters, shared buffers, unsupported MIME and truncated containers", () => {
    const b = png(), get = vi.fn(() => b.buffer); Object.defineProperty(b, "buffer", { get });
    expect(preflightChildMedia(b, "image/png")).not.toBeNull(); expect(get).not.toHaveBeenCalled();
    expect(preflightChildMedia(new Uint8Array(new SharedArrayBuffer(60)), "image/png")).toBeNull();
    expect(preflightChildMedia(png(), "image/svg+xml" as never)).toBeNull(); expect(preflightChildMedia(png().slice(0, 50), "image/png")).toBeNull();
  });
});

describe("reviewed child decoder lifecycle", () => {
  it.each(["ru", "en"] as const)("re-reads exact %s loader bytes after decode and exposes a revocable resource", async locale => {
    const f = fixture(locale), visitor = vi.fn(); expect(await f.visit(visitor)).toBe(true);
    const value: ChildDecodedMediaDelivery = visitor.mock.calls[0][0]; expect(f.loader.visitMedia).toHaveBeenCalledTimes(2);
    expect(value.scope.locale).toBe(locale); expect(value.validUntilEpochMs).toBe(at + 100); expect(value.isCurrent()).toBe(true);
    expect(value.resource).toBe(f.resource); expect(f.codec.decode).toHaveBeenCalledTimes(1); value.release();
    expect(value.isCurrent()).toBe(false); expect(f.close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.decoder.getSnapshot())).toBe('{"phase":"sealed"}');
  });
  it("checks decoded WAV sample rate/channel/frame/duration against exact PCM declaration", async () => {
    const f = fixture("en", true); expect(await f.visit()).toBe(true); expect(f.loader.visitMedia).toHaveBeenCalledTimes(2);
    f.decoder.retire(); f.codec.decode.mockResolvedValueOnce({ ...f.resource, buffer: { ...(f.resource as {buffer: AudioBuffer}).buffer, sampleRate: 48000 } } as ChildDecodedResource);
    expect(await f.visit()).toBe(false); expect(f.loader.visitMedia).toHaveBeenCalledTimes(3);
  });
  it("rejects mismatched decoded dimensions before second rights read", async () => {
    const f = fixture(); f.codec.decode.mockResolvedValueOnce({ kind: "image", bitmap: { width: 2048, height: 2048 } as ImageBitmap, close: f.close });
    expect(await f.visit()).toBe(false); expect(f.close).toHaveBeenCalledTimes(1); expect(f.loader.visitMedia).toHaveBeenCalledTimes(1);
  });
  it("never converts animation entities into a still-image completion", async () => {
    const f = fixture(); f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => {
      cb({ ...f.delivery, asset: { ...f.delivery.asset, entity: { ...f.delivery.asset.entity, kind: "animation" } } }); return true;
    });
    expect(await f.visit()).toBe(false); expect(f.codec.decode).not.toHaveBeenCalled();
  });
  it("fresh loader deny or changed exact bytes cannot publish an already decoded bitmap", async () => {
    for (const changed of [false, true]) {
      const f = fixture(), visitor = vi.fn(); f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { cb(f.delivery); return true; });
      f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { if (changed) { const bytes = f.bytes.slice(); bytes[42] ^= 1; cb({ ...f.delivery, bytes }); return true; } return false; });
      expect(await f.visit(visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledTimes(1);
    }
  });
  it("does not extend an earlier review expiry when the fresh rights read grants a longer lease", async () => {
    vi.useFakeTimers(); const f = fixture(), visitor = vi.fn(); f.delivery.validUntilEpochMs = at + 20;
    f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { cb(f.delivery); return true; });
    f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { cb({ ...f.delivery, validUntilEpochMs: at + 1000 }); return true; });
    expect(await f.visit(visitor)).toBe(true); expect(visitor.mock.calls[0][0].validUntilEpochMs).toBe(at + 20);
    f.state.time += 20; await vi.advanceTimersByTimeAsync(20); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("denies elapsed trusted deadline before timer delivery and closes the late codec result", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = deferred<ChildDecodedResource>(), visitor = vi.fn(); f.codec.decode.mockReturnValueOnce(pending.promise);
    const result = f.visit(visitor); await settle(); f.state.time += 100; pending.resolve(f.resource);
    expect(await result).toBe(false); expect(visitor).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("original deadline includes loader and codec time rather than restarting before fresh review", async () => {
    const f = fixture(), visitor = vi.fn(); f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { f.state.time += 60; cb(f.delivery); return true; });
    f.codec.decode.mockImplementationOnce(async () => { f.state.time += 41; return f.resource; });
    expect(await f.visit(visitor)).toBe(false); expect(visitor).not.toHaveBeenCalled(); expect(f.loader.visitMedia).toHaveBeenCalledTimes(1);
  });
  it("latches rollback uncertainty even if a later trusted sample returns to the old epoch", async () => {
    const f = fixture(); expect(await f.visit()).toBe(true); f.state.time--;
    expect(f.decoder.getSnapshot().phase).toBe("sealed"); f.state.time = at + 1;
    expect(await f.visit()).toBe(false); expect(f.codec.decode).toHaveBeenCalledTimes(1);
  });
  it("background seals pending decode, foreground needs a new request, late result stays closed", async () => {
    const f = fixture(), pending = deferred<ChildDecodedResource>(), visitor = vi.fn(); f.codec.decode.mockReturnValueOnce(pending.promise);
    const result = f.visit(visitor); await settle(); f.decoder.background(); expect(await result).toBe(false);
    f.decoder.foreground(); expect(await f.visit()).toBe(false); expect(f.codec.decode).toHaveBeenCalledTimes(1);
    pending.resolve(f.resource); await settle(); expect(f.close).toHaveBeenCalledTimes(1); expect(visitor).not.toHaveBeenCalled();
    expect(await f.visit()).toBe(true);
  });
  it("A→B→A host generation and exact scope changes cannot resurrect original decode", async () => {
    const f = fixture(), pending = deferred<ChildDecodedResource>(), visitor = vi.fn(); f.codec.decode.mockReturnValueOnce(pending.promise);
    const result = f.visit(visitor); await settle(); f.state.context = { ...f.context, generation: 2 };
    f.decoder.retire(); f.state.context = f.context; pending.resolve(f.resource);
    expect(await result).toBe(false); await settle(); expect(visitor).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("current lease detects profile/locale/index changes and closes already published resources", async () => {
    const f = fixture(), visitor = vi.fn(); expect(await f.visit(visitor)).toBe(true);
    f.state.context = { ...f.context, scope: { ...f.context.scope, packageVersion: 2 } };
    expect(visitor.mock.calls[0][0].isCurrent()).toBe(false); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("timeout, external abort and dispose settle before an unabortable codec, with one pending job maximum", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = deferred<ChildDecodedResource>(), signal = new AbortController(); f.codec.decode.mockReturnValueOnce(pending.promise);
    const result = f.visit(() => {}, signal.signal); await settle(); signal.abort(); expect(await result).toBe(false);
    for (let i = 0; i < 4; i++) expect(await f.visit()).toBe(false);
    expect(f.codec.decode).toHaveBeenCalledTimes(1); f.decoder.dispose(); pending.resolve(f.resource); await settle();
    expect(f.close).toHaveBeenCalledTimes(1); expect(f.decoder.getSnapshot().phase).toBe("disposed");
  });
  it("short review timer cancels pending codec independently from the longer operational timeout", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = deferred<ChildDecodedResource>(); f.delivery.validUntilEpochMs = at + 5;
    f.codec.decode.mockReturnValueOnce(pending.promise); const result = f.visit(); await settle();
    await vi.advanceTimersByTimeAsync(5); expect(await result).toBe(false); pending.resolve(f.resource); await settle(); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("consumes rejected async visitors and closes a resource instead of treating them as completion", async () => {
    const f = fixture(); expect(await f.visit((() => Promise.reject(new Error("synthetic"))) as never)).toBe(false);
    await settle(); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("reentrant visitor/background cannot leave an old ready state", async () => {
    const f = fixture(); expect(await f.visit(() => f.decoder.background())).toBe(false);
    expect(f.close).toHaveBeenCalledTimes(1); expect(f.decoder.getSnapshot().phase).toBe("sealed");
  });
  it("snapshot inspection cannot cancel a newer request started reentrantly by the trusted host port", async () => {
    const f = fixture(); let reenter = false, latest: Promise<boolean> | null = null;
    const original = f.options.isCurrent;
    const options: ChildMediaDecoderOptions = { ...f.options, isCurrent: (context: ChildRouteChallenge) => {
      if (reenter) { reenter = false; latest = decoder.visitDecoded(f.input, new AbortController().signal, () => {}); }
      return original(context);
    } };
    const decoder: ReturnType<typeof createChildMediaDecoder> = createChildMediaDecoder(options); instances.push(decoder);
    expect(await decoder.visitDecoded(f.input, new AbortController().signal, () => {})).toBe(true);
    reenter = true; decoder.getSnapshot(); await settle(); expect(await latest).toBe(true);
    expect(decoder.getSnapshot().phase).toBe("ready");
  });
  it("a clock callback changing scope at the final lease reschedule prevents any visitor handoff", async () => {
    const f = fixture(), visitor = vi.fn(); let freshReadDone = false, changeOnClock = false;
    const originalClear = globalThis.clearTimeout;
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(handle => {
      if (freshReadDone) { freshReadDone = false; changeOnClock = true; } originalClear(handle);
    });
    f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { cb(f.delivery); return true; });
    f.loader.visitMedia.mockImplementationOnce(async (_i, _s, cb) => { cb(f.delivery); freshReadDone = true; return true; });
    const decoder: ReturnType<typeof createChildMediaDecoder> = createChildMediaDecoder({ ...f.options, clock: { nowEpochMs: () => {
      if (changeOnClock) { changeOnClock = false; f.state.context = { ...f.context, scope: { ...f.context.scope, packageVersion: 2 } }; }
      return f.state.time;
    } } }); instances.push(decoder);
    expect(await decoder.visitDecoded(f.input, new AbortController().signal, visitor)).toBe(false);
    expect(visitor).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("a final clock callback retiring the ready resource or revoking host admission makes isCurrent false", async () => {
    for (const mode of ["background", "revoked-host"] as const) {
      const f = fixture(), visitor = vi.fn(); let enabled = false, samples = 0;
      const decoder: ReturnType<typeof createChildMediaDecoder> = createChildMediaDecoder({ ...f.options, clock: { nowEpochMs: () => {
        if (enabled && ++samples === 2) { if (mode === "background") decoder.background(); else f.state.host = false; }
        return f.state.time;
      } } }); instances.push(decoder);
      expect(await decoder.visitDecoded(f.input, new AbortController().signal, visitor)).toBe(true);
      enabled = true; expect(visitor.mock.calls[0][0].isCurrent()).toBe(false);
      expect(f.close).toHaveBeenCalledTimes(1); expect(decoder.getSnapshot().phase).toBe("sealed");
    }
  });
});

describe("Web codec ownership using explicit synthetic browser API constructors", () => {
  it("uses a local MIME Blob, closes an abort-late bitmap, and rejects a second unresolved job", async () => {
    const pending = deferred<ImageBitmap>(), close = vi.fn(), create = vi.fn((_source: Blob) => pending.promise); vi.stubGlobal("createImageBitmap", create);
    const codec = createWebChildMediaCodec(), signal = new AbortController(), bytes = png(), header = preflightChildMedia(bytes, "image/png")!;
    const result = codec.decode(bytes, "image/png", header, signal.signal); const observed = expect(result).rejects.toThrow("child-codec-unavailable");
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob); expect((create.mock.calls[0][0] as Blob).type).toBe("image/png");
    await expect(codec.decode(bytes, "image/png", header, new AbortController().signal)).rejects.toThrow("child-codec-unavailable");
    signal.abort(); pending.resolve({ width: 1, height: 1, close } as unknown as ImageBitmap); await observed; expect(close).toHaveBeenCalledTimes(1);
  });
  it("owns exactly one live bitmap until release, without URLs/network or codec authority", async () => {
    const close = vi.fn(); vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1, height: 1, close })));
    const codec = createWebChildMediaCodec(), bytes = png(), header = preflightChildMedia(bytes, "image/png")!;
    const resource = await codec.decode(bytes, "image/png", header, new AbortController().signal);
    await expect(codec.decode(bytes, "image/png", header, new AbortController().signal)).rejects.toThrow(); resource.close(); resource.close();
    expect(close).toHaveBeenCalledTimes(1); const next = await codec.decode(bytes, "image/png", header, new AbortController().signal); next.close();
  });
  it("checks preflight independently before invoking the browser API", async () => {
    const create = vi.fn(); vi.stubGlobal("createImageBitmap", create); const codec = createWebChildMediaCodec();
    await expect(codec.decode(png(), "image/png", { kind: "image", width: 2048, height: 2048 }, new AbortController().signal)).rejects.toThrow();
    const getter = vi.fn(() => 1);
    await expect(codec.decode(png(), "image/png", { kind: "image", get width() { return getter(); }, height: 1 }, new AbortController().signal)).rejects.toThrow();
    expect(getter).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
    const close = vi.fn(); create.mockResolvedValueOnce({ width: 2048, height: 2048, close });
    await expect(codec.decode(png(), "image/png", { kind: "image", width: 1, height: 1 }, new AbortController().signal)).rejects.toThrow();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("closes an owned AudioContext without playback and wipes a buffer resolved after abort", async () => {
    const pending = deferred<AudioBuffer>(), close = vi.fn(async () => {}), samples = new Float32Array(8).fill(0.5), decode = vi.fn(() => pending.promise);
    const ctor = vi.fn(function (_options: AudioContextOptions) { return { sampleRate: 8000, decodeAudioData: decode, close }; }); vi.stubGlobal("AudioContext", ctor);
    const codec = createWebChildMediaCodec(), signal = new AbortController(), b = wav(), header = preflightChildMedia(b, "audio/wav")!;
    const result = codec.decode(b, "audio/wav", header, signal.signal), observed = expect(result).rejects.toThrow("child-codec-unavailable");
    signal.abort(); expect(close).toHaveBeenCalledTimes(1); pending.resolve({ numberOfChannels: 1, getChannelData: () => samples } as unknown as AudioBuffer);
    await observed; expect(samples.every(x => x === 0)).toBe(true); expect(ctor.mock.calls[0][0]).toEqual({ sampleRate: 8000 });
  });
  it("refuses implicit AudioContext resampling and closes the incompatible context", async () => {
    const close = vi.fn(async () => {}), decode = vi.fn(); vi.stubGlobal("AudioContext", function () { return { sampleRate: 48000, close, decodeAudioData: decode }; });
    const codec = createWebChildMediaCodec(), b = wav(); await expect(codec.decode(b, "audio/wav", preflightChildMedia(b, "audio/wav")!, new AbortController().signal)).rejects.toThrow();
    expect(decode).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  });
});
