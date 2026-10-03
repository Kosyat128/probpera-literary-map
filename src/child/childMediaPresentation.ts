import { decodeChildDataScope, sameChildDataScope } from "./childDataNamespace";
import { CHILD_DECODE_MAX_AUDIO_BYTES, CHILD_DECODE_MAX_AUDIO_SECONDS, CHILD_DECODE_MAX_DIMENSION, CHILD_DECODE_MAX_PIXELS,
  type ChildDecodedMediaDelivery, type createChildMediaDecoder } from "./childMediaDecode";
import { childRecord, copyChildPackageChallenge } from "./childPackage";
import type { ChildRouteChallenge } from "./childStartup";

export interface ChildOwnedImageSurface { clear(): void; draw(bitmap: ImageBitmap): void; dispose(): void }
export interface ChildOwnedAudioPlayback { close(): void }
export interface ChildAudioPlaybackPort {
  /** Called only by play(), never by media admission. This is a trusted local
   * resource seam, not a profile/rights/user-action proof supplied by content. */
  start(buffer: AudioBuffer, signal: AbortSignal, isCurrent: () => boolean, ended: () => void): Promise<ChildOwnedAudioPlayback>;
}
export interface ChildMediaPresentationOptions {
  /** Exclusive ownership: the host routes all decoder/lifecycle work through
   * this presenter so canvas pixels are cleared before decoder retirement. */
  readonly decoder: Pick<ReturnType<typeof createChildMediaDecoder>, "visitDecoded" | "retire" | "background" | "foreground" | "dispose">;
  readonly surface: ChildOwnedImageSurface;
  readonly audio?: ChildAudioPlaybackPort;
  context(): ChildRouteChallenge | null;
  isCurrent(context: ChildRouteChallenge): boolean;
  readonly clock: { nowEpochMs(): number };
  readonly initialVisibility: "active" | "background";
}
const epoch = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= 8_640_000_000_000_000;
function copyContext(input: unknown, at: number): ChildRouteChallenge | null {
  const r = childRecord(input, ["generation", "request", "selection", "profile", "scope", "validUntilEpochMs"]);
  const c = r && copyChildPackageChallenge({ generation: r.generation, request: r.request, selection: r.selection, profile: r.profile }, at);
  const s = r && decodeChildDataScope(r.scope);
  if (!r || !c || !s || !epoch(r.validUntilEpochMs) || r.validUntilEpochMs <= at || s.profileId !== c.profile.id
    || s.profileRevision !== c.selection.profileRevision || s.exactAge !== c.profile.exactAge || s.locale !== c.request.locale
    || s.policyVersion !== c.selection.policyVersion || s.policyChecksum !== c.selection.policyChecksum) return null;
  return Object.freeze({ ...c, scope: s, validUntilEpochMs: r.validUntilEpochMs });
}
type Operation = { generation: number; context: ChildRouteChallenge; abort: AbortController; external: AbortSignal;
  cancel: () => void; timer: ReturnType<typeof setTimeout> | null; deadline: number; delivery: ChildDecodedMediaDelivery | null;
  playback: ChildOwnedAudioPlayback | null; settlePlay: ((value: boolean) => void) | null;
  phase: "loading" | "image" | "audio" | "starting-audio" | "playing" };

/** Unintegrated presentation foundation. The host calls beforeContextChange()
 * before publishing profile/route/account/native changes; no existing App flow
 * is claimed here. Pixel erasure precedes decoder/resource callbacks. */
export function createChildMediaPresentation(options: ChildMediaPresentationOptions) {
  const surface = options.surface, decoder = options.decoder, getContext = options.context, hostCurrent = options.isCurrent;
  const nowPort = options.clock.nowEpochMs.bind(options.clock), startAudio = options.audio?.start.bind(options.audio);
  let active: Operation | null = null, generation = 0, visible = options.initialVisibility === "active", disposed = false;
  let brokenSurface = false, brokenClock = false, lastTime: number | null = null;
  let pendingAudio = false;
  function now() { try { const at = nowPort(); if (!epoch(at) || lastTime !== null && at < lastTime) brokenClock = true;
    if (brokenClock) return null; lastTime = at; return at; } catch { brokenClock = true; return null; } }
  function clear() { try { surface.clear(); } catch { brokenSurface = true; try { surface.dispose(); } catch { /* unavailable */ } } }
  function wipe(delivery: ChildDecodedMediaDelivery | null) { try { delivery?.bytes.fill(0); } catch { /* owned copy unavailable */ } }
  function release(op: Operation) {
    if (op.timer !== null) clearTimeout(op.timer); op.timer = null; op.external.removeEventListener("abort", op.cancel);
    const playback = op.playback, delivery = op.delivery, settle = op.settlePlay;
    op.playback = null; op.delivery = null; op.settlePlay = null;
    wipe(delivery);
    settle?.(false);
    op.abort.abort(); try { playback?.close(); } catch { /* revoke */ }
    try { delivery?.release(); } catch { /* never fallback */ }
  }
  function retire() {
    const ticket = ++generation, old = active; active = null;
    clear(); if (old) release(old);
    // A synchronous clear/abort/release callback may already own a newer
    // request. Never retire that latest decoder on behalf of this old ticket.
    if (generation === ticket) decoder.retire(); return ticket;
  }
  function cancel(op: Operation) {
    if (active === op) { active = null; ++generation; clear(); }
    release(op);
  }
  function current(op: Operation): boolean {
    try {
      const at = now();
      if (active !== op || generation !== op.generation || disposed || !visible || brokenSurface || at === null
        || op.abort.signal.aborted || op.external.aborted || at >= op.deadline) return false;
      const c = copyContext(getContext(), at);
      if (!c || JSON.stringify(c) !== JSON.stringify(op.context) || hostCurrent(op.context) !== true
        || op.delivery && op.delivery.isCurrent() !== true) return false;
      const finalAt = now(), finalContext = finalAt === null ? null : copyContext(getContext(), finalAt);
      if (finalAt === null || finalAt >= op.deadline || !finalContext || JSON.stringify(finalContext) !== JSON.stringify(op.context)
        || hostCurrent(op.context) !== true || op.delivery && op.delivery.isCurrent() !== true) return false;
      // Final host/lease callbacks can retire the operation or consume the
      // remaining validity. Check time after their synchronous work completes.
      const observedAt = now();
      return observedAt !== null && observedAt < op.deadline && active === op && generation === op.generation && !disposed && visible && !brokenSurface
        && !op.abort.signal.aborted && !op.external.aborted;
    } catch { return false; }
  }
  function schedule(op: Operation) {
    if (op.timer !== null) clearTimeout(op.timer); const at = now();
    if (at === null || at >= op.deadline) return false;
    op.timer = setTimeout(() => cancel(op), op.deadline - at); return true;
  }
  function accept(op: Operation, value: ChildDecodedMediaDelivery) {
    // The constructor owns the actual decoder. Content cannot construct this
    // delivery/lease or substitute UI booleans for its independent authority.
    if (!current(op)) { cancel(op); wipe(value); try { value.release(); } catch { /* revoke late */ } return false; }
    const scope = decodeChildDataScope(value.scope);
    if (!scope || !sameChildDataScope(scope, op.context.scope) || !epoch(value.validUntilEpochMs)
      || typeof value.isCurrent !== "function" || typeof value.release !== "function") {
      cancel(op); wipe(value); try { value.release(); } catch { /* unavailable */ } return false;
    }
    const deny = () => { cancel(op); return false; };
    op.delivery = value; op.deadline = Math.min(op.deadline, value.validUntilEpochMs);
    if (!schedule(op) || !current(op)) return deny();
    if (value.resource.kind === "image") {
      if (value.asset.entity.kind === "narration" || value.asset.entity.kind === "animation") return deny();
      const { width, height } = value.resource.bitmap;
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
        || width > CHILD_DECODE_MAX_DIMENSION || height > CHILD_DECODE_MAX_DIMENSION || width * height > CHILD_DECODE_MAX_PIXELS) return deny();
      if (!current(op)) return deny();
      try { surface.draw(value.resource.bitmap); } catch { return deny(); }
      if (!current(op)) return deny(); op.phase = "image"; return true;
    }
    if (value.resource.kind !== "audio" || value.asset.entity.kind !== "narration") return deny();
    op.phase = "audio"; return current(op) || deny();
  }
  return Object.freeze({
    getSnapshot() { const observed = active; if (observed && !current(observed)) cancel(observed);
      return Object.freeze({ phase: disposed ? "disposed" as const : brokenSurface || brokenClock ? "unavailable" as const : active?.phase ?? "sealed" as const }); },
    retire() { retire(); }, back() { retire(); },
    beforeContextChange(change: () => void) {
      const ticket = retire(); if (disposed || brokenSurface || generation !== ticket || typeof change !== "function") return false;
      try { const result: unknown = change(); if (result !== undefined) { void Promise.resolve(result).catch(() => {}); return false; }
        return generation === ticket; } catch { return false; }
    },
    background() { visible = false; const ticket = retire(); if (generation === ticket) decoder.background(); },
    foreground() { if (!disposed) { visible = false; const ticket = retire(); if (generation === ticket) {
      decoder.foreground(); if (generation === ticket && !disposed && !brokenSurface) visible = true;
    } } },
    dispose() { if (!disposed) { disposed = true; const ticket = retire(); if (generation === ticket) decoder.dispose();
      try { surface.dispose(); } catch { brokenSurface = true; } } },
    async request(input: unknown, external: AbortSignal): Promise<boolean> {
      const ticket = retire(), at = now();
      try {
        const context = at === null ? null : copyContext(getContext(), at);
        if (!context || at === null || !(external instanceof AbortSignal) || external.aborted || disposed || !visible
          || brokenSurface || brokenClock || generation !== ticket) return false;
        const op: Operation = { generation: ticket, context, abort: new AbortController(), external, cancel: () => cancel(op), timer: null,
          deadline: Math.min(context.validUntilEpochMs, at + 60_000), delivery: null, playback: null, settlePlay: null, phase: "loading" };
        active = op; external.addEventListener("abort", op.cancel, { once: true });
        if (!schedule(op) || !current(op)) { cancel(op); return false; }
        let displayed = false;
        const admitted = await decoder.visitDecoded(input, op.abort.signal, value => { if (accept(op, value)) displayed = true; });
        if (admitted === true && displayed && current(op)) return true;
        cancel(op); return false;
      } catch { const failed = active; if (generation === ticket && failed) cancel(failed); return false; }
    },
    async play(): Promise<boolean> {
      const op = active;
      if (op && !current(op)) { cancel(op); return false; }
      if (!op || op.phase !== "audio" || pendingAudio || !startAudio || !op.delivery || op.delivery.resource.kind !== "audio"
        || op.delivery.asset.entity.kind !== "narration" || op.context.profile.soundEnabled !== true || op.context.profile.narrationEnabled !== true) return false;
      op.phase = "starting-audio"; pendingAudio = true;
      const buffer = op.delivery.resource.buffer;
      return await new Promise<boolean>(resolve => {
        let settled = false;
        const done = (value: boolean) => { if (!settled) { settled = true; op.settlePlay = null; resolve(value); } };
        op.settlePlay = done;
        try {
          const started = startAudio(buffer, op.abort.signal, () => current(op), () => cancel(op));
          void Promise.resolve(started).then(playback => {
            pendingAudio = false;
            if (!current(op)) { try { playback.close(); } finally { cancel(op); done(false); } return; }
            op.playback = playback; op.phase = "playing"; done(true);
          }, () => { pendingAudio = false; cancel(op); done(false); }).catch(() => { cancel(op); done(false); });
        } catch { pendingAudio = false; cancel(op); done(false); }
      });
    },
  });
}

/** Real Web playback with a transient actual browser user activation. Silent
 * admission cannot reach resume(), connect() or start(). One owned context and
 * source; no URL, microphone, MediaElement, network or additional renderer. */
export function createWebChildAudioPlayback(): ChildAudioPlaybackPort {
  let occupied = false;
  return Object.freeze({ async start(buffer: AudioBuffer, signal: AbortSignal, current: () => boolean, ended: () => void) {
    if (occupied || !(signal instanceof AbortSignal) || signal.aborted || current() !== true || signal.aborted
      || globalThis.navigator?.userActivation?.isActive !== true || typeof globalThis.AudioContext !== "function"
      || typeof globalThis.AudioBuffer !== "function" || !(buffer instanceof globalThis.AudioBuffer)
      || !Number.isSafeInteger(buffer.length) || buffer.length < 1 || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2
      || buffer.sampleRate < 8000 || buffer.sampleRate > 48000 || buffer.duration !== buffer.length / buffer.sampleRate
      || buffer.duration > CHILD_DECODE_MAX_AUDIO_SECONDS || buffer.length * buffer.numberOfChannels * 4 > CHILD_DECODE_MAX_AUDIO_BYTES
      || occupied)
      throw new Error("child-audio-unavailable");
    occupied = true; let context: AudioContext | null = null, source: AudioBufferSourceNode | null = null, closed = false, settled = false;
    let contextReleased = true;
    const releaseCapacity = () => { if (closed && settled && contextReleased) occupied = false; };
    const close = () => {
      if (closed) return; closed = true; signal.removeEventListener("abort", close);
      const ownedSource = source, ownedContext = context; source = null; context = null;
      if (ownedSource) { ownedSource.onended = null; try { ownedSource.stop(); } catch { /* not started/already ended */ }
        try { ownedSource.disconnect(); } catch { /* disconnected */ } ownedSource.buffer = null; }
      if (ownedContext) {
        try { void ownedContext.close().then(() => { contextReleased = true; releaseCapacity(); }, () => { /* remain occupied */ }); }
        catch { /* No actual release acknowledgement: remain occupied. */ }
      }
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        try { buffer.getChannelData(channel).fill(0); } catch { /* unavailable native channel */ }
      }
      releaseCapacity();
    };
    signal.addEventListener("abort", close, { once: true });
    try {
      if (signal.aborted || closed || current() !== true || signal.aborted || closed) throw new Error("child-audio-unavailable");
      context = new globalThis.AudioContext({ sampleRate: buffer.sampleRate });
      contextReleased = false;
      if (context.sampleRate !== buffer.sampleRate) throw new Error("child-audio-unavailable");
      await context.resume();
      if (signal.aborted || closed || current() !== true || signal.aborted || closed || !context) throw new Error("child-audio-unavailable");
      source = context.createBufferSource(); source.buffer = buffer;
      source.onended = () => { close(); ended(); };
      if (current() !== true || signal.aborted || closed || !source || !context) throw new Error("child-audio-unavailable");
      source.connect(context.destination);
      if (current() !== true || signal.aborted || closed || !source) throw new Error("child-audio-unavailable");
      source.start();
      if (current() !== true || signal.aborted || closed) throw new Error("child-audio-unavailable");
      settled = true; releaseCapacity(); return Object.freeze({ close });
    } catch (error) { settled = true; close(); releaseCapacity(); throw error; }
  } });
}

/** Owns one ordinary 2D canvas in the explicitly supplied host container. It
 * never discovers/reuses a globe canvas. Host styling/accessibility/route wiring
 * remains separate and is not activated by adding this factory. */
export function createWebChildMediaPresentation(options: Omit<ChildMediaPresentationOptions, "surface" | "audio"> & { readonly container: HTMLElement }) {
  const canvas = options.container.ownerDocument.createElement("canvas"), context = canvas.getContext("2d");
  if (!context) throw new Error("child-surface-unavailable");
  canvas.width = 0; canvas.height = 0; options.container.appendChild(canvas);
  let removed = false;
  const surface: ChildOwnedImageSurface = Object.freeze({
    clear() { context.clearRect(0, 0, canvas.width, canvas.height); canvas.width = 0; canvas.height = 0; },
    draw(bitmap: ImageBitmap) {
      if (removed || !canvas.isConnected) throw new Error("child-surface-unavailable");
      canvas.width = bitmap.width; canvas.height = bitmap.height; context.drawImage(bitmap, 0, 0);
    },
    dispose() { canvas.width = 0; canvas.height = 0; canvas.remove(); removed = true; },
  });
  const controller = createChildMediaPresentation({ ...options, surface, audio: createWebChildAudioPlayback() });
  return Object.freeze({ ...controller, element: canvas });
}
