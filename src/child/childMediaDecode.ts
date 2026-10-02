import { decodeChildDataScope, sameChildDataScope } from "./childDataNamespace";
import { CHILD_MEDIA_MAX_ASSET_BYTES, childMediaContainerMatches, type ChildMediaDelivery, type ChildMediaMime,
  type createChildMediaLoader } from "./childMedia";
import { childRecord, copyChildPackageChallenge, decodeChildEntityReference } from "./childPackage";
import type { ChildRouteChallenge } from "./childStartup";

// Technical capacity limits, not editorial approval or required narration length.
export const CHILD_DECODE_MAX_DIMENSION = 2048;
export const CHILD_DECODE_MAX_PIXELS = 4 * 1024 * 1024;
export const CHILD_DECODE_MAX_AUDIO_SECONDS = 60;
export const CHILD_DECODE_MAX_AUDIO_BYTES = 24 * 1024 * 1024;
export type ChildImageHeader = Readonly<{ kind: "image"; width: number; height: number }>;
export type ChildAudioHeader = Readonly<{ kind: "audio"; channels: number; sampleRate: number; frames: number; duration: number; bits: 8 | 16 }>;
export type ChildMediaHeader = ChildImageHeader | ChildAudioHeader;
const epoch = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0 && x <= 8_640_000_000_000_000;
const dimension = (x: number) => Number.isSafeInteger(x) && x > 0 && x <= CHILD_DECODE_MAX_DIMENSION;
const image = (width: number, height: number): ChildImageHeader | null => dimension(width) && dimension(height)
  && width * height <= CHILD_DECODE_MAX_PIXELS ? Object.freeze({ kind: "image", width, height }) : null;
function copyBytes(input: unknown): Uint8Array | null {
  if (!(input instanceof Uint8Array) || Object.getPrototypeOf(input) !== Uint8Array.prototype) return null;
  const p = Object.getPrototypeOf(Uint8Array.prototype);
  const length: number = Object.getOwnPropertyDescriptor(p, "byteLength")!.get!.call(input);
  const offset: number = Object.getOwnPropertyDescriptor(p, "byteOffset")!.get!.call(input);
  const buffer: ArrayBuffer = Object.getOwnPropertyDescriptor(p, "buffer")!.get!.call(input);
  if (length < 1 || length > CHILD_MEDIA_MAX_ASSET_BYTES || !(buffer instanceof ArrayBuffer)) return null;
  const result = new Uint8Array(length); result.set(new Uint8Array(buffer, offset, length)); return result;
}

/** Resource preflight only. The browser codec must still decode the exact
 * reviewed bytes. Animation is deliberately unavailable in this static port:
 * createImageBitmap returns an animation's default/first frame, not its timeline. */
export function preflightChildMedia(input: unknown, mime: ChildMediaMime): ChildMediaHeader | null {
  try {
    const b = copyBytes(input); if (!b || !childMediaContainerMatches(b, mime)) return null;
    const v = new DataView(b.buffer), ascii = (at: number, s: string) => [...s].every((c, i) => b[at + i] === c.charCodeAt(0));
    if (mime === "image/png") {
      let at = 8, dimensions: ChildImageHeader | null = null, data = false, end = false, chunks = 0;
      while (at < b.length) {
        if (++chunks > 4096 || at + 12 > b.length) return null;
        const length = v.getUint32(at), next = at + 12 + length; if (next > b.length) return null;
        if (ascii(at + 4, "acTL") || ascii(at + 4, "fcTL") || ascii(at + 4, "fdAT")) return null;
        if (ascii(at + 4, "IHDR")) {
          if (at !== 8 || length !== 13 || dimensions) return null;
          dimensions = image(v.getUint32(at + 8), v.getUint32(at + 12));
          const depth = b[at + 16], color = b[at + 17];
          const depths: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
          if (!dimensions || !depths[color]?.includes(depth) || b[at + 18] !== 0 || b[at + 19] !== 0 || b[at + 20] > 1) return null;
        } else if (!dimensions) return null;
        if (ascii(at + 4, "IDAT")) { if (end) return null; data = true; }
        if (ascii(at + 4, "IEND")) { if (length !== 0 || next !== b.length || !data) return null; end = true; }
        at = next;
      }
      return end ? dimensions : null;
    }
    if (mime === "image/jpeg") {
      let at = 2, dimensions: ChildImageHeader | null = null, segments = 0, inScan = false, scanned = false, frameComponents = 0;
      while (at < b.length) {
        let marker = -1;
        if (inScan) {
          // Walk the entire bounded entropy payload. Stuffed FF00 and restart
          // markers are data, while later frame/table/scan markers are parsed.
          while (at < b.length) {
            if (b[at++] !== 255) continue;
            while (b[at] === 255) at++;
            if (at >= b.length) return null;
            const nextMarker = b[at++];
            if (nextMarker === 0 || nextMarker >= 0xd0 && nextMarker <= 0xd7) continue;
            marker = nextMarker; inScan = false; break;
          }
        } else {
          if (b[at++] !== 255) return null;
          while (b[at] === 255) at++;
          if (at >= b.length) return null; marker = b[at++];
        }
        if (++segments > 4096 || marker < 0) return null;
        if (marker === 0xd9) return dimensions && scanned && at === b.length ? dimensions : null;
        if (marker === 0 || marker === 1 || marker === 0xd8 || marker >= 0xd0 && marker <= 0xd7
          || marker === 0xdc || marker === 0xde || marker === 0xdf || marker === 0xcc) return null;
        if (![0xc0, 0xc2, 0xc4, 0xda, 0xdb, 0xdd, 0xfe].includes(marker) && !(marker >= 0xe0 && marker <= 0xef)) return null;
        if (at + 2 > b.length) return null;
        const length = v.getUint16(at), next = at + length; if (length < 2 || next > b.length - 2) return null;
        // Baseline/progressive Huffman JPEG only. Multiple SOFs and unsupported
        // differential/arithmetic/lossless variants cannot hide larger frames.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          if (marker !== 0xc0 && marker !== 0xc2 || dimensions || length < 8 || b[at + 2] !== 8) return null;
          const components = b[at + 7]; if (![1, 3, 4].includes(components) || length !== 8 + 3 * components) return null;
          frameComponents = components;
          dimensions = image(v.getUint16(at + 5), v.getUint16(at + 3)); if (!dimensions) return null;
        }
        if (marker === 0xda) {
          const components = b[at + 2];
          if (!dimensions || components < 1 || components > frameComponents || length !== 6 + 2 * components) return null;
          inScan = true; scanned = true;
        }
        at = next;
      }
      return null;
    }
    if (mime === "image/webp") {
      let at = 12, canvas: ChildImageHeader | null = null, coded: ChildImageHeader | null = null, chunks = 0;
      const u24 = (p: number) => b[p] + b[p + 1] * 256 + b[p + 2] * 65536;
      while (at < b.length) {
        if (++chunks > 4096 || at + 8 > b.length) return null;
        const length = v.getUint32(at + 4, true), p = at + 8, next = p + length + (length & 1);
        if (next > b.length || (length & 1) && b[p + length] !== 0) return null;
        if (ascii(at, "ANIM") || ascii(at, "ANMF")) return null;
        if (ascii(at, "VP8X")) {
          if (at !== 12 || canvas || length !== 10 || (b[p] & 0xc3) !== 0 || b[p + 1] || b[p + 2] || b[p + 3]) return null;
          canvas = image(u24(p + 4) + 1, u24(p + 7) + 1); if (!canvas) return null;
        } else if (ascii(at, "VP8 ")) {
          if (coded || length < 10 || b[p] & 1 || ![0x9d, 0x01, 0x2a].every((x, i) => b[p + 3 + i] === x)) return null;
          coded = image(v.getUint16(p + 6, true) & 0x3fff, v.getUint16(p + 8, true) & 0x3fff); if (!coded) return null;
        } else if (ascii(at, "VP8L")) {
          if (coded || length < 5 || b[p] !== 0x2f || b[p + 4] & 0xe0) return null;
          const packed = v.getUint32(p + 1, true);
          coded = image((packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1); if (!coded) return null;
        }
        at = next;
      }
      if (!coded || canvas && (canvas.width !== coded.width || canvas.height !== coded.height)) return null;
      return coded;
    }
    if (mime === "audio/wav") {
      let at = 12, format: { channels: number; sampleRate: number; bits: 8 | 16; block: number } | null = null;
      let dataBytes: number | null = null, chunks = 0;
      while (at < b.length) {
        if (++chunks > 4096 || at + 8 > b.length) return null;
        const length = v.getUint32(at + 4, true), p = at + 8, next = p + length + (length & 1); if (next > b.length) return null;
        if (ascii(at, "fmt ")) {
          if (format || at !== 12 || length !== 16 || v.getUint16(p, true) !== 1) return null;
          const channels = v.getUint16(p + 2, true), sampleRate = v.getUint32(p + 4, true), bits = v.getUint16(p + 14, true);
          const block = channels * bits / 8;
          if (channels < 1 || channels > 2 || sampleRate < 8000 || sampleRate > 48000 || bits !== 8 && bits !== 16
            || v.getUint16(p + 12, true) !== block || v.getUint32(p + 8, true) !== block * sampleRate) return null;
          format = { channels, sampleRate, bits, block };
        } else if (ascii(at, "data")) { if (!format || dataBytes !== null || !length) return null; dataBytes = length; }
        at = next;
      }
      if (!format || dataBytes === null || dataBytes % format.block !== 0) return null;
      const frames = dataBytes / format.block, duration = frames / format.sampleRate;
      if (duration > CHILD_DECODE_MAX_AUDIO_SECONDS || frames * format.channels * 4 > CHILD_DECODE_MAX_AUDIO_BYTES) return null;
      return Object.freeze({ kind: "audio", channels: format.channels, sampleRate: format.sampleRate, bits: format.bits, frames, duration });
    }
    return null;
  } catch { return null; }
}

export type ChildDecodedResource = Readonly<{ kind: "image"; bitmap: ImageBitmap; close(): void }>
  | Readonly<{ kind: "audio"; buffer: AudioBuffer; close(): void }>;
function decodedMatches(resource: ChildDecodedResource, h: ChildMediaHeader): boolean {
  if (typeof resource?.close !== "function" || resource.kind !== h.kind) return false;
  if (resource.kind === "image" && h.kind === "image") {
    const { width, height } = resource.bitmap;
    // Default EXIF orientation may swap the two dimensions, never pixel count.
    return dimension(width) && dimension(height) && width * height === h.width * h.height
      && (width === h.width && height === h.height || width === h.height && height === h.width);
  }
  if (resource.kind === "audio" && h.kind === "audio") {
    const b = resource.buffer;
    return b.numberOfChannels === h.channels && b.sampleRate === h.sampleRate && b.length === h.frames
      && Number.isFinite(b.duration) && b.duration === h.duration && b.duration <= CHILD_DECODE_MAX_AUDIO_SECONDS;
  }
  return false;
}
export interface ChildMediaCodecPort {
  /** Trusted local codec/ownership seam only; fixtures never establish rights. */
  decode(bytes: Uint8Array, mime: ChildMediaMime, header: ChildMediaHeader, signal: AbortSignal): Promise<ChildDecodedResource>;
}
export interface ChildDecodedMediaDelivery extends ChildMediaDelivery {
  readonly resource: ChildDecodedResource;
  /** Host must retire on every startup/index/profile/locale/lifecycle change. */
  isCurrent(): boolean;
  release(): void;
}
export interface ChildMediaDecoderOptions {
  readonly loader: Pick<ReturnType<typeof createChildMediaLoader>, "visitMedia">;
  readonly codec: ChildMediaCodecPort;
  context(): ChildRouteChallenge | null;
  isCurrent(context: ChildRouteChallenge): boolean;
  readonly clock: { nowEpochMs(): number };
  readonly timeoutMs: number;
  readonly initialVisibility: "active" | "background";
}
function contextCopy(input: unknown, at: number): ChildRouteChallenge | null {
  const r = childRecord(input, ["generation", "request", "selection", "profile", "scope", "validUntilEpochMs"]);
  const c = r && copyChildPackageChallenge({ generation: r.generation, request: r.request, selection: r.selection, profile: r.profile }, at);
  const s = r && decodeChildDataScope(r.scope);
  if (!r || !c || !s || !epoch(r.validUntilEpochMs) || r.validUntilEpochMs <= at || s.profileId !== c.profile.id
    || s.profileRevision !== c.selection.profileRevision || s.exactAge !== c.profile.exactAge || s.locale !== c.request.locale
    || s.policyVersion !== c.selection.policyVersion || s.policyChecksum !== c.selection.policyChecksum) return null;
  return Object.freeze({ ...c, scope: s, validUntilEpochMs: r.validUntilEpochMs });
}
function deliveryCopy(input: ChildMediaDelivery, context: ChildRouteChallenge): ChildMediaDelivery | null {
  const row = childRecord(input, ["scope", "asset", "bytes", "validUntilEpochMs"]), s = row && decodeChildDataScope(row.scope);
  const a = row && childRecord(row.asset, ["assetId", "owner", "entity", "inventoryKey", "sha256", "bytes", "mime"]);
  const owner = a && decodeChildEntityReference(a.owner), entity = a && decodeChildEntityReference(a.entity), bytes = row && copyBytes(row.bytes);
  if (!row || !s || !sameChildDataScope(s, context.scope) || !a || !owner || !entity || !bytes || !epoch(row.validUntilEpochMs)
    || typeof a.assetId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(a.assetId)
    || typeof a.inventoryKey !== "string" || typeof a.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(a.sha256)
    || a.bytes !== bytes.length || !["image/png", "image/jpeg", "image/webp", "audio/wav"].includes(a.mime as string)) return null;
  return Object.freeze({ scope: s, asset: Object.freeze({ ...a, owner, entity }) as unknown as ChildMediaDelivery["asset"], bytes,
    validUntilEpochMs: Math.min(row.validUntilEpochMs, context.validUntilEpochMs) });
}
const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => b[i] === x);
type Operation = { generation: number; context: ChildRouteChallenge; input: Readonly<{ assetId: string; owner: ChildMediaDelivery["asset"]["owner"] }>;
  abort: AbortController; external: AbortSignal; cancel: () => void; timer: ReturnType<typeof setTimeout> | null;
  deadline: number; finish(value: boolean): void; resource: ChildDecodedResource | null; bytes: Uint8Array | null; ready: boolean };

/** Static Web media foundation, intentionally unintegrated. At most one codec
 * job can remain unresolved; an unabortable browser job denies further decode
 * until settled. No URL, fetch, playback node, ambient time or adult fallback. */
export function createChildMediaDecoder(options: ChildMediaDecoderOptions) {
  const timeout = options.timeoutMs, validOptions = Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 60_000;
  const load = options.loader.visitMedia.bind(options.loader), decode = options.codec.decode.bind(options.codec);
  const getContext = options.context, hostCurrent = options.isCurrent, clock = options.clock.nowEpochMs.bind(options.clock);
  let active: Operation | null = null, generation = 0, visible = options.initialVisibility === "active", disposed = false;
  let lastTime: number | null = null, brokenClock = false, pendingCodec = false;
  function now() { try { const at = clock(); if (!epoch(at) || lastTime !== null && at < lastTime) brokenClock = true;
    if (brokenClock) return null; lastTime = at; return at; } catch { brokenClock = true; return null; } }
  function close(resource: ChildDecodedResource | null) { try { resource?.close(); } catch { /* Deny delivery; never retry authority. */ } }
  function cleanup(op: Operation) {
    if (op.timer !== null) clearTimeout(op.timer); op.timer = null; op.external.removeEventListener("abort", op.cancel);
    const resource = op.resource; op.resource = null; op.bytes?.fill(0); op.bytes = null;
    op.abort.abort(); close(resource); op.finish(false);
  }
  function cancel(op: Operation) { if (active === op) { active = null; generation++; } cleanup(op); }
  function retire() { const ticket = ++generation, old = active; active = null; if (old) cleanup(old); return ticket; }
  function current(op: Operation): boolean {
    try {
      const at = now(); if (active !== op || generation !== op.generation || disposed || !visible || op.abort.signal.aborted
        || op.external.aborted || at === null || at >= op.deadline) return false;
      const fresh = contextCopy(getContext(), at); if (!fresh || JSON.stringify(fresh) !== JSON.stringify(op.context)
        || hostCurrent(op.context) !== true) return false;
      const finalAt = now(), finalContext = finalAt === null ? null : contextCopy(getContext(), finalAt);
      return finalAt !== null && finalAt < op.deadline && !!finalContext && JSON.stringify(finalContext) === JSON.stringify(op.context)
        && hostCurrent(op.context) === true
        && active === op && generation === op.generation && !disposed && visible && !op.abort.signal.aborted && !op.external.aborted;
    } catch { return false; }
  }
  function leaseCurrent(op: Operation) { if (current(op)) return true; cancel(op); return false; }
  function schedule(op: Operation) {
    if (op.timer !== null) clearTimeout(op.timer);
    const at = now(); if (at === null || at >= op.deadline) return false;
    op.timer = setTimeout(() => cancel(op), op.deadline - at); return true;
  }
  async function work(op: Operation, visitor: (value: ChildDecodedMediaDelivery) => void): Promise<boolean> {
    let first: ChildMediaDelivery | null = null;
    const loaded = await load(op.input, op.abort.signal, value => { if (current(op)) first = deliveryCopy(value, op.context); });
    const admitted = first as ChildMediaDelivery | null;
    op.bytes = admitted?.bytes ?? null;
    if (loaded !== true || !admitted || !current(op) || admitted.asset.assetId !== op.input.assetId
      || JSON.stringify(admitted.asset.owner) !== JSON.stringify(op.input.owner) || admitted.asset.entity.kind === "animation") return false;
    op.deadline = Math.min(op.deadline, admitted.validUntilEpochMs);
    if (!current(op) || !schedule(op) || !op.bytes) return false;
    const header = preflightChildMedia(op.bytes, admitted.asset.mime); if (!header || pendingCodec) return false;
    pendingCodec = true;
    let resource: ChildDecodedResource;
    try { resource = await decode(op.bytes.slice(), admitted.asset.mime, header, op.abort.signal); }
    finally { pendingCodec = false; }
    if (!current(op)) { close(resource); return false; }
    op.resource = resource;
    if (!decodedMatches(resource, header)) return false;
    // A codec cannot cache review/route/profile authority. Re-read exact media
    // through the active loader, then intersect both review bounds and the
    // original operation deadline; a refreshed review never extends this lease.
    let matched = false;
    const renewed = await load(op.input, op.abort.signal, value => {
      if (!current(op)) return;
      const fresh = deliveryCopy(value, op.context);
      if (!fresh) return;
      try {
        if (!sameChildDataScope(fresh.scope, admitted.scope) || JSON.stringify(fresh.asset) !== JSON.stringify(admitted.asset)
          || !op.bytes || !equalBytes(fresh.bytes, op.bytes)) return;
        op.deadline = Math.min(op.deadline, fresh.validUntilEpochMs);
        matched = current(op);
      } finally { fresh.bytes.fill(0); }
    });
    if (renewed !== true || !matched || !current(op) || !op.resource || !op.bytes) return false;
    if (!schedule(op) || !current(op)) return false;
    const value: ChildDecodedMediaDelivery = Object.freeze({ ...admitted, bytes: op.bytes.slice(), validUntilEpochMs: op.deadline,
      resource: op.resource, isCurrent: () => leaseCurrent(op), release: () => cancel(op) });
    if (!current(op)) return false;
    const result: unknown = visitor(value);
    if (result !== undefined) { void Promise.resolve(result).catch(() => {}); return false; }
    if (!current(op)) return false;
    op.ready = true; return true;
  }
  return Object.freeze({
    getSnapshot() { const observed = active; if (observed && !current(observed)) cancel(observed); return Object.freeze({ phase: disposed ? "disposed" as const
      : active?.ready ? "ready" as const : active ? "decoding" as const : "sealed" as const }); },
    retire() { retire(); }, background() { visible = false; retire(); }, foreground() { if (!disposed) { visible = true; retire(); } },
    dispose() { if (!disposed) { disposed = true; retire(); } },
    async visitDecoded(input: unknown, external: AbortSignal, visitor: (value: ChildDecodedMediaDelivery) => void): Promise<boolean> {
      const ticket = retire();
      try {
        const r = childRecord(input, ["assetId", "owner"]), owner = r && decodeChildEntityReference(r.owner), at = now();
        const context = at === null ? null : contextCopy(getContext(), at);
        if (!validOptions || !r || typeof r.assetId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(r.assetId)
          || !owner || !context || at === null || !(external instanceof AbortSignal) || external.aborted || typeof visitor !== "function"
          || disposed || !visible || generation !== ticket || pendingCodec) return false;
        const deadline = Math.min(at + timeout, context.validUntilEpochMs); if (!epoch(deadline) || deadline <= at) return false;
        return await new Promise<boolean>(resolve => {
          let settled = false;
          const op: Operation = { generation: ticket, context, input: Object.freeze({ assetId: r.assetId as string, owner }),
            abort: new AbortController(), external, cancel: () => cancel(op), timer: null, deadline,
            finish: value => { if (!settled) { settled = true; resolve(value); } }, resource: null, bytes: null, ready: false };
          active = op; external.addEventListener("abort", op.cancel, { once: true });
          op.timer = setTimeout(() => cancel(op), deadline - at);
          if (!current(op)) { cancel(op); return; }
          void work(op, visitor).then(result => { if (result && current(op)) op.finish(true); else cancel(op); }, () => cancel(op));
        });
      } catch { return false; }
    },
  });
}

/** Actual browser codec; local Blob only. Audio creates no source/playback node,
 * connects nothing, and closes its owned context at completion or cancellation.
 * Browser jobs themselves are not abortable; late bitmaps/buffers are destroyed. */
export function createWebChildMediaCodec(): ChildMediaCodecPort {
  let occupied = false;
  const perform = async (bytes: Uint8Array, mime: ChildMediaMime, header: ChildMediaHeader, signal: AbortSignal): Promise<ChildDecodedResource> => {
    if (signal.aborted) throw new Error("child-codec-unavailable");
    if (header.kind === "image") {
      if (typeof globalThis.createImageBitmap !== "function") throw new Error("child-codec-unavailable");
      const bitmap = await globalThis.createImageBitmap(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }));
      let closed = false;
      const close = () => { if (!closed) { closed = true; signal.removeEventListener("abort", close); bitmap.close(); } };
      signal.addEventListener("abort", close, { once: true });
      if (signal.aborted) { close(); throw new Error("child-codec-unavailable"); }
      return Object.freeze({ kind: "image" as const, bitmap, close });
    }
    if (typeof globalThis.AudioContext !== "function") throw new Error("child-codec-unavailable");
    const context = new globalThis.AudioContext({ sampleRate: header.sampleRate });
    let buffer: AudioBuffer | null = null, closed = false, contextClosed = false;
    const closeContext = () => { if (!contextClosed) { contextClosed = true; void context.close().catch(() => {}); } };
    const close = () => {
      if (closed) return; closed = true; signal.removeEventListener("abort", close); closeContext();
      if (buffer) for (let channel = 0; channel < buffer.numberOfChannels; channel++) buffer.getChannelData(channel).fill(0);
      buffer = null;
    };
    signal.addEventListener("abort", close, { once: true });
    try {
      if (signal.aborted || context.sampleRate !== header.sampleRate) throw new Error("child-codec-unavailable");
      const decoded = await context.decodeAudioData(bytes.slice().buffer as ArrayBuffer); buffer = decoded;
      closeContext();
      if (signal.aborted || closed) {
        // Abort may precede decode completion; wipe the late buffer as well.
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) decoded.getChannelData(channel).fill(0);
        buffer = null; throw new Error("child-codec-unavailable");
      }
      return Object.freeze({ kind: "audio" as const, buffer: decoded, close });
    } catch (error) { close(); throw error; }
  };
  return Object.freeze({ async decode(input: Uint8Array, mime: ChildMediaMime, header: ChildMediaHeader, signal: AbortSignal) {
    if (occupied || !(signal instanceof AbortSignal) || signal.aborted) throw new Error("child-codec-unavailable");
    const bytes = copyBytes(input), parsed = bytes && preflightChildMedia(bytes, mime);
    const fields = parsed?.kind === "image" ? ["kind", "width", "height"] : ["kind", "channels", "sampleRate", "bits", "frames", "duration"];
    const declared = childRecord(header, fields);
    if (!bytes || !parsed || !declared || Object.entries(parsed).some(([key, value]) => declared[key] !== value) || signal.aborted) {
      bytes?.fill(0); throw new Error("child-codec-unavailable");
    }
    // One unresolved job OR live resource per factory; callers cannot multiply
    // unabortable decoders by sharing this factory across controllers.
    occupied = true;
    let resource: ChildDecodedResource | null = null;
    try {
      resource = await perform(bytes, mime, parsed, signal);
      if (!decodedMatches(resource, parsed)) throw new Error("child-codec-unavailable");
      const owned = resource; let closed = false;
      const close = () => { if (!closed) { closed = true; signal.removeEventListener("abort", close);
        try { owned.close(); } finally { occupied = false; } } };
      signal.addEventListener("abort", close, { once: true });
      if (signal.aborted) { close(); throw new Error("child-codec-unavailable"); }
      return Object.freeze({ ...owned, close });
    } catch (error) { try { resource?.close(); } finally { occupied = false; } throw error; }
    finally { bytes.fill(0); }
  } });
}
