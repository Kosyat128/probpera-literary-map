import { afterEach, describe, expect, it, vi } from "vitest";
import { createChildMediaPresentation, createWebChildAudioPlayback, type ChildMediaPresentationOptions,
  type ChildOwnedAudioPlayback } from "./childMediaPresentation";
import type { ChildDecodedMediaDelivery } from "./childMediaDecode";
import type { ChildRouteChallenge } from "./childStartup";

// Explicit synthetic decoder/host/surface/audio/native-constructor fixtures.
// These tests do not supply actual admission, browser sound, OS or human rights.
const at = 1_790_942_400_000, hash = "a".repeat(64), instances: Array<{ dispose(): void }> = [];
function deferred<T>() { let resolve!: (v: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function settle() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
function fixture(audio = false, locale: "ru" | "en" = "ru") {
  const context: ChildRouteChallenge = { generation: 1, request: { locale, route: { kind: "home", entityId: null } },
    selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: "synthetic-child", profileRevision: 1,
      profileChecksum: hash, policyVersion: "synthetic-v1", policyChecksum: hash },
    profile: { id: "synthetic-child", label: "Private synthetic nickname", exactAge: 9, ageBand: "9-11", locale,
      ageConfirmedAt: "2026-10-01T00:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: [],
      soundEnabled: true, motion: "calm", narrationEnabled: true },
    scope: { schemaVersion: 1, namespace: "child", profileId: "synthetic-child", profileRevision: 1, exactAge: 9, locale,
      policyVersion: "synthetic-v1", policyChecksum: hash, packageId: "synthetic-package", packageVersion: 1, packageChecksum: hash },
    validUntilEpochMs: at + 60_000 };
  const state = { context, time: at, host: true, pixels: false }, events: string[] = [], deliveries: ChildDecodedMediaDelivery[] = [];
  const surface = { clear: vi.fn(() => { events.push("clear"); state.pixels = false; }),
    draw: vi.fn((_bitmap: ImageBitmap) => { events.push("draw"); state.pixels = true; }), dispose: vi.fn(() => { state.pixels = false; events.push("surface-dispose"); }) };
  function delivery() {
    const captured = JSON.stringify(state.context), samples = new Float32Array(480).fill(0.5); let closed = false;
    const bitmap = { width: 3, height: 2, close: vi.fn(() => { closed = true; }) } as unknown as ImageBitmap;
    const buffer = { sampleRate: 48000, numberOfChannels: 1, length: 480, duration: 0.01, getChannelData: () => samples } as unknown as AudioBuffer;
    const value: ChildDecodedMediaDelivery = { scope: state.context.scope, bytes: new Uint8Array([1]), validUntilEpochMs: state.time + 100,
      asset: { assetId: "synthetic-media", inventoryKey: audio ? "synthetic.wav" : "synthetic.png", mime: audio ? "audio/wav" : "image/png", bytes: 1,
        sha256: hash, owner: { kind: "work", id: "synthetic-work", contentChecksum: hash },
        entity: { kind: audio ? "narration" : "image", id: "synthetic-media", contentChecksum: hash } },
      resource: audio ? { kind: "audio", buffer, close: () => { samples.fill(0); closed = true; } } : { kind: "image", bitmap, close: () => bitmap.close() },
      isCurrent: () => !closed && state.host && JSON.stringify(state.context) === captured,
      release: vi.fn(() => { events.push("release"); closed = true; samples.fill(0); if (!audio) bitmap.close(); }) };
    deliveries.push(value); return value;
  }
  const decoder = { retire: vi.fn(() => { events.push("decoder-retire"); }), background: vi.fn(() => { events.push("decoder-background"); }),
    foreground: vi.fn(() => { events.push("decoder-foreground"); }), dispose: vi.fn(() => { events.push("decoder-dispose"); }),
    visitDecoded: vi.fn(async (_input: unknown, signal: AbortSignal, cb: (v: ChildDecodedMediaDelivery) => void) => {
      events.push("decode"); if (signal.aborted) return false; cb(delivery()); return !signal.aborted;
    }) };
  const playback = { close: vi.fn(() => { events.push("audio-close"); }) };
  const audioPort = { start: vi.fn(async (_b: AudioBuffer, _s: AbortSignal, _current: () => boolean, _ended: () => void): Promise<ChildOwnedAudioPlayback> => {
    events.push("audio-start"); return playback;
  }) };
  const options: ChildMediaPresentationOptions = { decoder, surface, audio: audioPort, context: () => state.context,
    isCurrent: c => state.host && JSON.stringify(c) === JSON.stringify(state.context), clock: { nowEpochMs: () => state.time }, initialVisibility: "active" };
  const presenter = createChildMediaPresentation(options); instances.push(presenter);
  const request = () => presenter.request({ syntheticInput: true }, new AbortController().signal);
  return { state, context, events, surface, decoder, deliveries, delivery, audioPort, playback, options, presenter, request };
}
afterEach(() => { instances.splice(0).forEach(x => x.dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("clear-before-render child presentation", () => {
  it.each(["ru", "en"] as const)("presents %s image only through a current decoder lease without autoplay", async locale => {
    const f = fixture(false, locale); expect(await f.request()).toBe(true); expect(f.state.pixels).toBe(true);
    expect(f.presenter.getSnapshot().phase).toBe("image"); expect(f.audioPort.start).not.toHaveBeenCalled();
    expect(JSON.stringify(f.presenter.getSnapshot())).not.toContain("synthetic-child");
  });
  it("erases old pixels and references before a new decoder request or a host context publication", async () => {
    const f = fixture(); expect(await f.request()).toBe(true); f.events.length = 0;
    expect(await f.request()).toBe(true); expect(f.events.slice(0, 4)).toEqual(["clear", "release", "decoder-retire", "decode"]);
    const old = f.deliveries[1]; let changed = false;
    expect(f.presenter.beforeContextChange(() => {
      expect(f.state.pixels).toBe(false); expect(old.isCurrent()).toBe(false); expect(old.bytes.every(x => x === 0)).toBe(true); changed = true;
      f.state.context = { ...f.context, generation: 2, scope: { ...f.context.scope, profileRevision: 2 } };
    })).toBe(true); expect(changed).toBe(true); expect(f.presenter.getSnapshot().phase).toBe("sealed");
  });
  it("back/background/dispose clear before resource, audio or decoder callbacks", async () => {
    for (const action of ["back", "background", "dispose"] as const) {
      const f = fixture(true); expect(await f.request()).toBe(true); expect(await f.presenter.play()).toBe(true);
      f.events.length = 0; f.presenter[action]();
      expect(f.events[0]).toBe("clear"); expect(f.events.indexOf("audio-close")).toBeGreaterThan(0);
      expect(f.events.indexOf("release")).toBeGreaterThan(0); expect(f.state.pixels).toBe(false);
    }
  });
  it("expiry clears copied image pixels and retires the decoded resource", async () => {
    vi.useFakeTimers(); const f = fixture(); expect(await f.request()).toBe(true); f.events.length = 0;
    f.state.time += 100; await vi.advanceTimersByTimeAsync(100);
    expect(f.state.pixels).toBe(false); expect(f.events[0]).toBe("clear"); expect(f.deliveries[0].isCurrent()).toBe(false);
  });
  it("trusted expiry without timer delivery clears before returning a snapshot", async () => {
    const f = fixture(); expect(await f.request()).toBe(true); f.state.time += 100;
    expect(f.presenter.getSnapshot().phase).toBe("sealed"); expect(f.state.pixels).toBe(false);
  });
  it("clears synchronously if draw itself changes the exact child context", async () => {
    const f = fixture(); f.surface.draw.mockImplementationOnce(() => { f.state.pixels = true; f.state.context = { ...f.context, generation: 2 }; });
    expect(await f.request()).toBe(false); expect(f.state.pixels).toBe(false); expect(f.deliveries[0].isCurrent()).toBe(false);
  });
  it("partial draw failure and failed surface clearing never leave a usable presentation", async () => {
    const f = fixture(); f.surface.draw.mockImplementationOnce(() => { f.state.pixels = true; throw new Error("synthetic-draw-failure"); });
    expect(await f.request()).toBe(false); expect(f.state.pixels).toBe(false);
    f.surface.clear.mockImplementationOnce(() => { throw new Error("synthetic-clear-failure"); });
    expect(await f.request()).toBe(false); expect(f.surface.dispose).toHaveBeenCalledTimes(1); expect(f.presenter.getSnapshot().phase).toBe("unavailable");
  });
  it("late delivery after background/foreground cannot draw or retain references", async () => {
    const f = fixture(), pending = deferred<void>();
    f.decoder.visitDecoded.mockImplementationOnce(async (_i, _s, cb) => { await pending.promise; cb(f.delivery()); return true; });
    const result = f.request(); await settle(); f.presenter.background(); f.presenter.foreground(); pending.resolve();
    expect(await result).toBe(false); expect(f.surface.draw).not.toHaveBeenCalled(); expect(f.deliveries[0].isCurrent()).toBe(false);
    expect(await f.request()).toBe(true);
  });
  it("a reentrant background notification from decoder foreground cannot reopen visibility", async () => {
    const f = fixture(); f.presenter.background(); f.decoder.foreground.mockImplementationOnce(() => f.presenter.background());
    f.presenter.foreground(); expect(await f.request()).toBe(false); expect(f.surface.draw).not.toHaveBeenCalled();
    expect(f.presenter.getSnapshot().phase).toBe("sealed");
  });
  it("host context publication is denied when both pixel erasure and surface removal fail", async () => {
    const f = fixture(); expect(await f.request()).toBe(true); const changed = vi.fn();
    f.surface.clear.mockImplementationOnce(() => { throw new Error("synthetic"); });
    f.surface.dispose.mockImplementationOnce(() => { throw new Error("synthetic"); });
    expect(f.presenter.beforeContextChange(changed)).toBe(false); expect(changed).not.toHaveBeenCalled();
    expect(f.presenter.getSnapshot().phase).toBe("unavailable");
  });
  it("A→B→A context equality cannot restore an old pending presentation", async () => {
    const f = fixture(), pending = deferred<void>(); f.decoder.visitDecoded.mockImplementationOnce(async (_i, _s, cb) => { await pending.promise; cb(f.delivery()); return true; });
    const result = f.request(); await settle();
    f.presenter.beforeContextChange(() => { f.state.context = { ...f.context, generation: 2 }; });
    f.presenter.beforeContextChange(() => { f.state.context = f.context; }); pending.resolve();
    expect(await result).toBe(false); expect(f.surface.draw).not.toHaveBeenCalled();
  });
  it("external abort clears before decoded release and leaves no old ready state", async () => {
    const f = fixture(), signal = new AbortController(); expect(await f.presenter.request({}, signal.signal)).toBe(true);
    f.events.length = 0; signal.abort(); expect(f.events.slice(0, 2)).toEqual(["clear", "release"]);
    expect(f.state.pixels).toBe(false); expect(f.presenter.getSnapshot().phase).toBe("sealed");
  });
  it("reentrant clearing can establish a newer request without the old cleanup retiring it", async () => {
    const f = fixture(); expect(await f.request()).toBe(true); let latest: Promise<boolean> | null = null;
    f.surface.clear.mockImplementationOnce(() => { f.state.pixels = false; latest = f.request(); });
    const old = f.request(); expect(await old).toBe(false); expect(await latest).toBe(true);
    expect(f.state.pixels).toBe(true); expect(f.presenter.getSnapshot().phase).toBe("image");
  });
  it("final clock revocation or rollback erases a ready image without trusting context equality", async () => {
    const f = fixture(); let enabled = false, calls = 0;
    const presenter = createChildMediaPresentation({ ...f.options, clock: { nowEpochMs: () => {
      if (enabled && ++calls === 2) f.state.host = false; return f.state.time;
    } } }); instances.push(presenter); expect(await presenter.request({}, new AbortController().signal)).toBe(true);
    enabled = true; expect(presenter.getSnapshot().phase).toBe("sealed"); expect(f.state.pixels).toBe(false);
    f.state.host = true; f.state.time--; expect(await presenter.request({}, new AbortController().signal)).toBe(false);
    f.state.time = at + 1; expect(await presenter.request({}, new AbortController().signal)).toBe(false);
  });
  it("consumes an async transition callback without retaining a media reference", async () => {
    const f = fixture(); expect(await f.request()).toBe(true);
    expect(f.presenter.beforeContextChange((() => Promise.reject(new Error("synthetic"))) as never)).toBe(false);
    await settle(); expect(f.state.pixels).toBe(false); expect(f.deliveries[0].isCurrent()).toBe(false);
  });
  it("expiry consumed by the final host callback erases the presentation before observation", async () => {
    const f = fixture(); let enabled = false, calls = 0;
    const presenter = createChildMediaPresentation({ ...f.options, isCurrent: c => {
      if (enabled && ++calls === 2) f.state.time += 100;
      return f.options.isCurrent(c);
    } }); instances.push(presenter);
    expect(await presenter.request({}, new AbortController().signal)).toBe(true); enabled = true;
    expect(presenter.getSnapshot().phase).toBe("sealed"); expect(f.state.pixels).toBe(false);
    expect(f.deliveries[0].isCurrent()).toBe(false);
  });
});

describe("explicit scoped child narration", () => {
  it("loaded narration stays silent until an explicit play call, with one playback at a time", async () => {
    const f = fixture(true); expect(await f.request()).toBe(true); expect(f.audioPort.start).not.toHaveBeenCalled();
    expect(await f.presenter.play()).toBe(true); expect(await f.presenter.play()).toBe(false); expect(f.audioPort.start).toHaveBeenCalledTimes(1);
    f.presenter.back(); expect(f.playback.close).toHaveBeenCalledTimes(1);
    expect((f.deliveries[0].resource as { buffer: AudioBuffer }).buffer.getChannelData(0).every(x => x === 0)).toBe(true);
  });
  it("both exact captured profile flags and narration entity kind are required", async () => {
    for (const flag of ["soundEnabled", "narrationEnabled"] as const) {
      const f = fixture(true); f.state.context = { ...f.context, profile: { ...f.context.profile, [flag]: false } };
      expect(await f.request()).toBe(true); expect(await f.presenter.play()).toBe(false); expect(f.audioPort.start).not.toHaveBeenCalled();
    }
    const f = fixture(true); f.decoder.visitDecoded.mockImplementationOnce(async (_i, _s, cb) => {
      const value = f.delivery(); cb({ ...value, asset: { ...value.asset, entity: { ...value.asset.entity, kind: "work" } } }); return true;
    }); expect(await f.request()).toBe(false); expect(await f.presenter.play()).toBe(false); expect(f.audioPort.start).not.toHaveBeenCalled();
  });
  it("hung playback start settles on retirement before a late port answer, with only one pending job", async () => {
    vi.useFakeTimers();
    for (const boundary of ["transition", "deadline"] as const) {
      const f = fixture(true), pending = deferred<ChildOwnedAudioPlayback>(); f.audioPort.start.mockReturnValueOnce(pending.promise);
      expect(await f.request()).toBe(true); const playing = f.presenter.play(); await settle();
      if (boundary === "transition") f.presenter.beforeContextChange(() => { f.state.context = { ...f.context, generation: 2 }; });
      else { f.state.time += 100; await vi.advanceTimersByTimeAsync(100); }
      expect(await playing).toBe(false);
      expect(await f.request()).toBe(true); expect(await f.presenter.play()).toBe(false); expect(f.audioPort.start).toHaveBeenCalledTimes(1);
      pending.resolve(f.playback); await settle(); expect(f.playback.close).toHaveBeenCalledTimes(1);
      expect(f.presenter.getSnapshot().phase).toBe("audio");
    }
  });
  it("natural completion clears before releasing the source/decoded narration", async () => {
    const f = fixture(true); expect(await f.request()).toBe(true); expect(await f.presenter.play()).toBe(true);
    f.events.length = 0; f.audioPort.start.mock.calls[0][3](); expect(f.events[0]).toBe("clear"); expect(f.presenter.getSnapshot().phase).toBe("sealed");
  });
});

class SyntheticAudioBuffer {
  sampleRate = 48000; numberOfChannels = 1; length = 480; duration = 0.01; samples = new Float32Array(480).fill(0.5);
  getChannelData(_channel: number) { return this.samples; }
}
function webAudioFixture() {
  const buffer = new SyntheticAudioBuffer(), resume = deferred<void>(), close = vi.fn(async () => {});
  const source = { buffer: null as AudioBuffer | null, onended: null as (() => void) | null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
  const constructor = vi.fn(function (_options: AudioContextOptions) { return { sampleRate: 48000, resume: () => resume.promise, createBufferSource: () => source, destination: {}, close }; });
  vi.stubGlobal("AudioBuffer", SyntheticAudioBuffer); vi.stubGlobal("AudioContext", constructor); vi.stubGlobal("navigator", { userActivation: { isActive: true } });
  return { buffer: buffer as unknown as AudioBuffer, samples: buffer.samples, resume, close, source, constructor, port: createWebChildAudioPlayback() };
}
describe("actual-Web audio factory with explicit synthetic API constructors", () => {
  it("requires transient browser activation before creating any context or source", async () => {
    const f = webAudioFixture(); vi.stubGlobal("navigator", { userActivation: { isActive: false } });
    await expect(f.port.start(f.buffer, new AbortController().signal, () => true, () => {})).rejects.toThrow("child-audio-unavailable");
    expect(f.constructor).not.toHaveBeenCalled(); expect(f.source.start).not.toHaveBeenCalled();
  });
  it("a reentrant initial current callback cannot create two owned audio contexts", async () => {
    const f = webAudioFixture(), nested = deferred<ChildOwnedAudioPlayback>();
    const outer = f.port.start(f.buffer, new AbortController().signal, () => {
      void f.port.start(f.buffer, new AbortController().signal, () => true, () => {}).then(nested.resolve, nested.reject); return true;
    }, () => {});
    await expect(outer).rejects.toThrow("child-audio-unavailable"); expect(f.constructor).toHaveBeenCalledTimes(1);
    f.resume.resolve(); const playback = await nested.promise; playback.close();
  });
  it("revocation during resume closes/wipes before connect or start", async () => {
    const f = webAudioFixture(); let current = true;
    const started = f.port.start(f.buffer, new AbortController().signal, () => current, () => {}), observed = expect(started).rejects.toThrow();
    current = false; f.resume.resolve(); await observed; expect(f.source.start).not.toHaveBeenCalled(); expect(f.source.connect).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledTimes(1); expect(f.samples.every(x => x === 0)).toBe(true);
  });
  it("abort closes a pending resume and denies a second owned context until it settles", async () => {
    const f = webAudioFixture(), abort = new AbortController();
    const started = f.port.start(f.buffer, abort.signal, () => true, () => {}), observed = expect(started).rejects.toThrow();
    abort.abort(); await expect(f.port.start(f.buffer, new AbortController().signal, () => true, () => {})).rejects.toThrow();
    expect(f.constructor).toHaveBeenCalledTimes(1); expect(f.close).toHaveBeenCalledTimes(1); f.resume.resolve(); await observed;
    expect(f.source.start).not.toHaveBeenCalled();
  });
  it("starts explicitly, then disconnects/stops/closes and wipes on one-use release", async () => {
    const f = webAudioFixture(), abort = new AbortController();
    const started = f.port.start(f.buffer, abort.signal, () => true, () => {}); f.resume.resolve(); const playback = await started;
    expect(f.source.start).toHaveBeenCalledTimes(1); expect(f.source.connect).toHaveBeenCalledTimes(1);
    playback.close(); playback.close(); expect(f.source.stop).toHaveBeenCalledTimes(1); expect(f.source.disconnect).toHaveBeenCalledTimes(1);
    expect(f.source.buffer).toBeNull(); expect(f.close).toHaveBeenCalledTimes(1); expect(f.samples.every(x => x === 0)).toBe(true);
  });
  it("holds native capacity until actual context close acknowledgement and seals a rejected close", async () => {
    for (const outcome of ["released", "rejected"] as const) {
      const f = webAudioFixture(), closing = deferred<void>(); f.close.mockReturnValueOnce(closing.promise);
      const started = f.port.start(f.buffer, new AbortController().signal, () => true, () => {}); f.resume.resolve(); const playback = await started;
      playback.close(); await expect(f.port.start(f.buffer, new AbortController().signal, () => true, () => {})).rejects.toThrow();
      expect(f.constructor).toHaveBeenCalledTimes(1);
      if (outcome === "released") { closing.resolve(); await settle();
        const next = await f.port.start(f.buffer, new AbortController().signal, () => true, () => {}); expect(f.constructor).toHaveBeenCalledTimes(2); next.close();
      } else { closing.reject(new Error("synthetic")); await settle();
        await expect(f.port.start(f.buffer, new AbortController().signal, () => true, () => {})).rejects.toThrow(); expect(f.constructor).toHaveBeenCalledTimes(1);
      }
    }
  });
});
