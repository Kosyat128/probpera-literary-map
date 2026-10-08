import { contentPackageHash } from "../planet/contentPackageProtocol.mjs";
import { preflightChildMedia, CHILD_DECODE_MAX_AUDIO_BYTES } from "./childMediaDecode";
export { preflightChildMedia } from "./childMediaDecode";

export type ChildNarrationChannelSignal = Readonly<{
  peakAbsolute: number; rmsAmplitude: number; dcMean: number;
  zeroSamples: number; negativeRailSamples: number; positiveRailSamples: number; constant: boolean;
}>;
export type ChildNarrationSignal = Readonly<{
  schemaVersion: 1; kind: "literary-planet-narration-signal-quality-v1";
  sourceSha256: string; sourceBytes: number;
  format: Readonly<{ channels: number; sampleRate: number; bits: 8 | 16; frameCount: number; durationMs: number }>;
  measurementScale: "linear-full-scale"; loudnessStandard: "NOT_LUFS";
  peakAbsolute: number; rmsAmplitude: number; dcMean: number;
  zeroSamples: number; zeroFrames: number; leadingZeroFrames: number; trailingZeroFrames: number;
  negativeRailSamples: number; positiveRailSamples: number;
  channels: readonly ChildNarrationChannelSignal[];
  narrationStatus: "requires-human-review" | "refused-degenerate";
  refusalReason: "silent" | "constant" | "full-rail" | null;
  humanReview: "PENDING"; voiceApproved: false; rightsApproved: false; releaseReady: false;
}>;

/** Deterministic diagnostics, no gain changes, playback, voice/rights approval or
 * inferred silence threshold. Uses the real decoder's supported PCM contract.
 * Only all-zero, per-channel constant or exclusively rail-valued data is refused;
 * individual rail hits, low level and partial silence still need human review. */
export function analyzeChildNarrationSignal(input: unknown): ChildNarrationSignal | null {
  let bytes: Uint8Array | null = null;
  try {
    if (!(input instanceof Uint8Array) || Object.getPrototypeOf(input) !== Uint8Array.prototype) return null;
    const prototype = Object.getPrototypeOf(Uint8Array.prototype);
    const length: number = Object.getOwnPropertyDescriptor(prototype, "byteLength")!.get!.call(input);
    const offset: number = Object.getOwnPropertyDescriptor(prototype, "byteOffset")!.get!.call(input);
    const buffer: ArrayBuffer = Object.getOwnPropertyDescriptor(prototype, "buffer")!.get!.call(input);
    if (!Number.isSafeInteger(length) || length < 44 || length > CHILD_DECODE_MAX_AUDIO_BYTES || !(buffer instanceof ArrayBuffer)) return null;
    bytes = new Uint8Array(length); bytes.set(new Uint8Array(buffer, offset, length));
    const header = preflightChildMedia(bytes, "audio/wav"); if (!header || header.kind !== "audio") return null;
    const view = new DataView(bytes.buffer), stride = header.channels * header.bits / 8;
    let dataOffset = -1;
    for (let at = 12; at < bytes.length;) {
      const size = view.getUint32(at + 4, true), start = at + 8;
      if (bytes[at] === 100 && bytes[at + 1] === 97 && bytes[at + 2] === 116 && bytes[at + 3] === 97) {
        if (dataOffset !== -1 || size !== header.frames * stride) return null;
        dataOffset = start;
      }
      at = start + size + (size & 1);
    }
    if (dataOffset < 0) return null;
    const scale = header.bits === 8 ? 128 : 32768, minimum = -scale, maximum = scale - 1;
    const measured = Array.from({ length: header.channels }, () => ({
      sum: 0, squares: 0, peak: 0, zeros: 0, negative: 0, positive: 0, first: 0, constant: true,
    }));
    let zeroFrames = 0, leadingZeroFrames = 0, trailingZeroFrames = 0, initialZeros = true;
    for (let frame = 0; frame < header.frames; frame++) {
      let allZero = true;
      for (let channel = 0; channel < header.channels; channel++) {
        const at = dataOffset + frame * stride + channel * header.bits / 8;
        const sample = header.bits === 8 ? view.getUint8(at) - 128 : view.getInt16(at, true), row = measured[channel];
        if (frame === 0) row.first = sample; else if (sample !== row.first) row.constant = false;
        row.sum += sample; row.squares += sample * sample; row.peak = Math.max(row.peak, Math.abs(sample));
        if (sample === 0) row.zeros++; else allZero = false;
        if (sample === minimum) row.negative++; if (sample === maximum) row.positive++;
      }
      if (allZero) { zeroFrames++; trailingZeroFrames++; if (initialZeros) leadingZeroFrames++; }
      else { initialZeros = false; trailingZeroFrames = 0; }
    }
    const channels = Object.freeze(measured.map(row => Object.freeze({
      peakAbsolute: row.peak / scale, rmsAmplitude: Math.sqrt(row.squares / header.frames) / scale,
      dcMean: row.sum / header.frames / scale, zeroSamples: row.zeros,
      negativeRailSamples: row.negative, positiveRailSamples: row.positive, constant: row.constant,
    })));
    const sum = measured.reduce((value, row) => value + row.sum, 0), squares = measured.reduce((value, row) => value + row.squares, 0);
    const negativeRailSamples = measured.reduce((value, row) => value + row.negative, 0);
    const positiveRailSamples = measured.reduce((value, row) => value + row.positive, 0), samples = header.frames * header.channels;
    const refusalReason = zeroFrames === header.frames ? "silent" : channels.every(row => row.constant) ? "constant"
      : negativeRailSamples + positiveRailSamples === samples ? "full-rail" : null;
    return Object.freeze({
      schemaVersion: 1, kind: "literary-planet-narration-signal-quality-v1", sourceSha256: contentPackageHash(bytes), sourceBytes: bytes.length,
      format: Object.freeze({ channels: header.channels, sampleRate: header.sampleRate, bits: header.bits,
        frameCount: header.frames, durationMs: header.frames / header.sampleRate * 1000 }),
      measurementScale: "linear-full-scale", loudnessStandard: "NOT_LUFS",
      peakAbsolute: Math.max(...channels.map(row => row.peakAbsolute)), rmsAmplitude: Math.sqrt(squares / samples) / scale,
      dcMean: sum / samples / scale, zeroSamples: measured.reduce((value, row) => value + row.zeros, 0),
      zeroFrames, leadingZeroFrames, trailingZeroFrames, negativeRailSamples, positiveRailSamples, channels,
      narrationStatus: refusalReason ? "refused-degenerate" : "requires-human-review", refusalReason,
      humanReview: "PENDING", voiceApproved: false, rightsApproved: false, releaseReady: false,
    });
  } catch { return null; } finally { bytes?.fill(0); }
}
