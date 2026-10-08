import { describe, expect, it, vi } from "vitest";
import { contentPackageHash } from "../planet/contentPackageProtocol.mjs";
import { analyzeChildNarrationSignal } from "./childNarrationSignal";

// Synthetic signals are mathematical fixtures, not human narration or approval.
function wav(frames: readonly (readonly number[])[], bits: 8 | 16 = 16, rate = 8000) {
  const channels = frames[0].length, size = frames.length * channels * bits / 8;
  const bytes = new Uint8Array(44 + size + (size & 1)), view = new DataView(bytes.buffer);
  const tag = (at: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
  tag(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); tag(8, "WAVE"); tag(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels * bits / 8, true);
  view.setUint16(32, channels * bits / 8, true); view.setUint16(34, bits, true); tag(36, "data"); view.setUint32(40, size, true);
  frames.forEach((frame, i) => frame.forEach((sample, channel) => {
    const at = 44 + (i * channels + channel) * bits / 8;
    if (bits === 8) view.setUint8(at, sample + 128); else view.setInt16(at, sample, true);
  }));
  return bytes;
}

describe("byte-bound objective narration PCM diagnostics", () => {
  it("measures exact mono16 metrics while preserving the entire original byte sequence", () => {
    const bytes = wav([[0], [16384], [-16384], [0]]), before = bytes.slice(), report = analyzeChildNarrationSignal(bytes);
    expect(report).toMatchObject({ sourceSha256: contentPackageHash(before), sourceBytes: before.length,
      peakAbsolute: 0.5, dcMean: 0, zeroSamples: 2, zeroFrames: 2, leadingZeroFrames: 1, trailingZeroFrames: 1,
      negativeRailSamples: 0, positiveRailSamples: 0, narrationStatus: "requires-human-review", refusalReason: null });
    expect(report?.rmsAmplitude).toBeCloseTo(Math.sqrt(0.125), 12);
    expect(bytes).toEqual(before); expect(Object.isFrozen(report?.channels[0])).toBe(true);
  });
  it("supports only the existing decoder mono/stereo8/16 formats with identical normalized measurements", () => {
    for (const bits of [8, 16] as const) for (const channels of [1, 2]) {
      const amplitude = bits === 8 ? 64 : 16384;
      const bytes = wav([0, amplitude, -amplitude, 0].map(value => Array(channels).fill(value)), bits);
      const report = analyzeChildNarrationSignal(bytes);
      expect(report?.format).toMatchObject({ bits, channels, sampleRate: 8000, frameCount: 4, durationMs: 0.5 });
      expect(report?.peakAbsolute).toBe(0.5); expect(report?.rmsAmplitude).toBeCloseTo(Math.sqrt(0.125), 12);
      expect(report?.narrationStatus).toBe("requires-human-review");
    }
  });
  it("accepts original zero-padded mono8 data and refuses a nonzero pad required closed by both native decoders", () => {
    const bytes = wav([[0], [64], [-64]], 8), before = bytes.slice();
    expect(analyzeChildNarrationSignal(bytes)).toMatchObject({
      sourceSha256: contentPackageHash(before), sourceBytes: before.length,
      format: { channels: 1, bits: 8, frameCount: 3 }, narrationStatus: "requires-human-review",
    });
    expect(bytes).toEqual(before);
    const changed = bytes.slice(); changed[changed.length - 1] = 1; const refusedBefore = changed.slice();
    expect(analyzeChildNarrationSignal(changed)).toBeNull(); expect(changed).toEqual(refusedBefore);
  });
  it("binds an original odd ancillary chunk and refuses its nonzero pad without rewriting PCM", () => {
    const source = wav([[0], [1000], [-1000], [0]]), bytes = new Uint8Array(source.length + 10);
    bytes.set(source.subarray(0, 36)); bytes.set([74, 85, 78, 75, 1, 0, 0, 0, 23, 0], 36);
    bytes.set(source.subarray(36), 46); new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
    const before = bytes.slice(), report = analyzeChildNarrationSignal(bytes), original = analyzeChildNarrationSignal(source);
    expect(report).toMatchObject({ sourceSha256: contentPackageHash(before), sourceBytes: before.length,
      narrationStatus: "requires-human-review" });
    expect(report?.sourceSha256).not.toBe(original?.sourceSha256);
    expect(report?.peakAbsolute).toBe(original?.peakAbsolute); expect(report?.rmsAmplitude).toBe(original?.rmsAmplitude);
    expect(bytes).toEqual(before);
    const changed = bytes.slice(); changed[45] = 255; const refusedBefore = changed.slice();
    expect(analyzeChildNarrationSignal(changed)).toBeNull(); expect(changed).toEqual(refusedBefore);
  });
  it("interprets unsigned8 midpoint as zero and refuses completely silent input", () => {
    for (const bits of [8, 16] as const) {
      const report = analyzeChildNarrationSignal(wav([[0, 0], [0, 0], [0, 0]], bits));
      expect(report).toMatchObject({ refusalReason: "silent", narrationStatus: "refused-degenerate", peakAbsolute: 0,
        rmsAmplitude: 0, dcMean: 0, zeroSamples: 6, zeroFrames: 3, leadingZeroFrames: 3, trailingZeroFrames: 3 });
    }
  });
  it("refuses channel-constant DC even when opposite stereo values cancel the aggregate mean", () => {
    const report = analyzeChildNarrationSignal(wav([[1000, -1000], [1000, -1000], [1000, -1000]]));
    expect(report).toMatchObject({ refusalReason: "constant", dcMean: 0, zeroFrames: 0, narrationStatus: "refused-degenerate" });
    expect(report?.channels.map(row => row.constant)).toEqual([true, true]);
    expect(report?.channels[0].dcMean).toBe(1000 / 32768); expect(report?.channels[1].dcMean).toBe(-1000 / 32768);
  });
  it("refuses exclusively rail-valued waveforms while counting both signed endpoints", () => {
    for (const bits of [8, 16] as const) {
      const scale = bits === 8 ? 128 : 32768;
      const report = analyzeChildNarrationSignal(wav([[-scale], [scale - 1], [-scale], [scale - 1]], bits));
      expect(report).toMatchObject({ refusalReason: "full-rail", negativeRailSamples: 2, positiveRailSamples: 2,
        peakAbsolute: 1, narrationStatus: "refused-degenerate" });
      expect(report?.channels[0].constant).toBe(false);
    }
  });
  it("retains a single fullscale hit as a diagnostic without declaring clipping or approval", () => {
    const report = analyzeChildNarrationSignal(wav([[-32768], [1000], [0], [-1000]]));
    expect(report).toMatchObject({ negativeRailSamples: 1, positiveRailSamples: 0, peakAbsolute: 1,
      narrationStatus: "requires-human-review", refusalReason: null, voiceApproved: false, humanReview: "PENDING" });
  });
  it("retains low level and partial silence for human review without imposing guessed loudness thresholds", () => {
    const report = analyzeChildNarrationSignal(wav([[0], [1], [-1], [0], [0]]));
    expect(report).toMatchObject({ leadingZeroFrames: 1, trailingZeroFrames: 2, zeroFrames: 3,
      peakAbsolute: 1 / 32768, narrationStatus: "requires-human-review", refusalReason: null, loudnessStandard: "NOT_LUFS" });
  });
  it("measures channel zeros separately and keeps one nonconstant channel eligible for human review", () => {
    const report = analyzeChildNarrationSignal(wav([[0, 1000], [0, -1000], [0, 0]]));
    expect(report).toMatchObject({ zeroSamples: 4, zeroFrames: 1, leadingZeroFrames: 0, trailingZeroFrames: 1,
      narrationStatus: "requires-human-review", refusalReason: null });
    expect(report?.channels[0]).toMatchObject({ constant: true, zeroSamples: 3 });
    expect(report?.channels[1]).toMatchObject({ constant: false, zeroSamples: 1 });
  });
  it("refuses unsupported headers rate/width/channel bounds and malformed frame alignment", () => {
    const base = wav([[0], [1000], [-1000], [0]]);
    for (const [offset, value, width] of [[20, 3, 16], [22, 3, 16], [24, 0, 32], [24, 48001, 32],
      [34, 24, 16], [32, 0, 16], [28, 1, 32], [40, 7, 32]]) {
      const changed = base.slice(), view = new DataView(changed.buffer);
      if (width === 16) view.setUint16(offset, value, true); else view.setUint32(offset, value, true);
      expect(analyzeChildNarrationSignal(changed)).toBeNull();
    }
  });
  it("refuses nonfinite or foreign input truncated containers and the actual source capacity overflow", () => {
    for (const input of [NaN, Infinity, null, [0, 1], new Float32Array(44), new Uint8Array(24 * 1024 * 1024 + 1)])
      expect(analyzeChildNarrationSignal(input)).toBeNull();
    const bytes = wav([[0], [1], [-1]]);
    expect(analyzeChildNarrationSignal(bytes.subarray(0, bytes.length - 1))).toBeNull();
    const altered = bytes.slice(); new DataView(altered.buffer).setUint32(4, 0, true);
    expect(analyzeChildNarrationSignal(altered)).toBeNull();
  });
  it("refuses hostile reflection and ignores shadow accessors instead of invoking them", () => {
    const bytes = wav([[0], [1000], [-1000], [0]]), getter = vi.fn(() => { throw new Error("no getter authority"); });
    for (const key of ["byteLength", "byteOffset", "buffer"])
      Object.defineProperty(bytes, key, { get: getter, configurable: true });
    expect(analyzeChildNarrationSignal(bytes)?.narrationStatus).toBe("requires-human-review"); expect(getter).not.toHaveBeenCalled();
    const hostile = new Proxy(wav([[0], [1], [-1]]), { getPrototypeOf: () => { throw new Error("reflection refusal"); } });
    expect(analyzeChildNarrationSignal(hostile)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("binds the original full file hash and handles an owned offset view without hashing surrounding bytes", () => {
    const bytes = wav([[0], [1000], [-1000], [0]]), surround = new Uint8Array(bytes.length + 10);
    surround.set(bytes, 5); const view = surround.subarray(5, 5 + bytes.length);
    expect(analyzeChildNarrationSignal(view)?.sourceSha256).toBe(contentPackageHash(bytes));
    expect(surround.subarray(5, 5 + bytes.length)).toEqual(bytes);
    const changed = wav([[0], [1000], [-1000], [0]], 16, 16000);
    expect(analyzeChildNarrationSignal(changed)?.sourceSha256).not.toBe(analyzeChildNarrationSignal(bytes)?.sourceSha256);
    expect(analyzeChildNarrationSignal(changed)?.rmsAmplitude).toBe(analyzeChildNarrationSignal(bytes)?.rmsAmplitude);
  });
  it("refuses shared or detached buffers without measuring mutable external storage", () => {
    expect(analyzeChildNarrationSignal(new Uint8Array(new SharedArrayBuffer(44)))).toBeNull();
    const buffer = new ArrayBuffer(44), input = new Uint8Array(buffer); structuredClone(buffer, { transfer: [buffer] });
    expect(analyzeChildNarrationSignal(input)).toBeNull();
  });
  it("always labels finite linear metrics as diagnostics with all human rights and release approvals pending", () => {
    const report = analyzeChildNarrationSignal(wav([[0], [2000], [-1000], [0]]))!;
    for (const metric of [report.peakAbsolute, report.rmsAmplitude, report.dcMean, ...report.channels.flatMap(row => [row.peakAbsolute, row.rmsAmplitude, row.dcMean])])
      expect(Number.isFinite(metric)).toBe(true);
    expect(report).toMatchObject({ measurementScale: "linear-full-scale", loudnessStandard: "NOT_LUFS", humanReview: "PENDING",
      voiceApproved: false, rightsApproved: false, releaseReady: false });
    expect(report).not.toHaveProperty("approved"); expect(report).not.toHaveProperty("lufs");
  });
});
