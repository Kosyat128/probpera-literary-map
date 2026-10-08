import { decodeReadingAnchors, decodeReadingPosition, sameReadingPosition,
  decodeNativeReadingPosition, resolveReadingPosition } from "./childReadingPositionProtocol.mjs";
import type { ChildEntityReference } from "./childPackage";

/** Explicit alignment in the signed localized text, never inferred paragraph
 * numbers, translated character offsets, audio time, or a content grant. */
export interface ChildReadingSegment { readonly anchorId: string; readonly text: string }
export interface ChildReadingAnchors {
  readonly schemaVersion: 1; readonly anchorVersion: number; readonly segments: readonly ChildReadingSegment[];
  readonly narration: Readonly<{ assetId: string; sha256: string; sampleRate: number; frameCount: number;
    cues: readonly Readonly<{ anchorId: string; startFrame: number; endFrame: number }>[] }> | null;
}
/** One bookmark per native-selected profile/canonical entity for text and
 * narration. Native resolves localized frames; this record has no completion. */
export interface ChildReadingPosition {
  readonly schemaVersion: 1; readonly entity: Readonly<Pick<ChildEntityReference, "kind" | "id">>;
  readonly anchorVersion: number; readonly anchorId: string;
}
export interface ChildNativeReadingPosition {
  readonly profileId: string; readonly revision: number; readonly position: ChildReadingPosition | null;
}
export interface ChildNativeReadingPositionController {
  readReadingPosition(reference: ChildEntityReference): Promise<ChildNativeReadingPosition | null>;
  rememberReadingPosition(reference: ChildEntityReference, expectedRevision: number,
    record: ChildReadingPosition): Promise<ChildNativeReadingPosition | null>;
}
export const decodeChildReadingAnchors = (raw: unknown, expectedText: unknown): ChildReadingAnchors | null =>
  decodeReadingAnchors(raw, expectedText) as ChildReadingAnchors | null;
export const decodeChildReadingPosition = (raw: unknown): ChildReadingPosition | null =>
  decodeReadingPosition(raw) as ChildReadingPosition | null;
export const sameChildReadingPosition = sameReadingPosition;
export const decodeChildNativeReadingPosition = (raw: unknown, profileId: string, reference: ChildEntityReference,
  expectedRevision?: number, expectedPosition?: ChildReadingPosition): ChildNativeReadingPosition | null =>
  decodeNativeReadingPosition(raw, profileId, reference, expectedRevision, expectedPosition) as ChildNativeReadingPosition | null;
export const resolveChildReadingPosition = (record: unknown, anchors: unknown, reference: ChildEntityReference): ChildReadingSegment | null =>
  resolveReadingPosition(record, anchors, reference) as ChildReadingSegment | null;
