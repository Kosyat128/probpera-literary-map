import type { CompleteShelfBookPose } from "./completeShelfModel";
import type { BookShelfPhase } from "./bookShelfState";

export type BookShelfExtractionClock = {
  bookKey: string | null;
  requestId: number;
  phase: BookShelfPhase | null;
  progress: number;
  ready: boolean;
};

export function createBookShelfExtractionClock(): BookShelfExtractionClock {
  return { bookKey: null, requestId: -1, phase: null, progress: 0, ready: false };
}

export function canRetainBookShelfRow({ anchorKey, phase, rowKeys, sourceKeys, previousSourceKeys, requestedCount }: {
  anchorKey: string | null;
  phase: BookShelfPhase;
  rowKeys: readonly string[];
  sourceKeys: readonly string[];
  previousSourceKeys: readonly string[];
  requestedCount: number;
}) {
  return Boolean(anchorKey && phase !== "SHELF_MOVING" && phase !== "SHELF_SETTLING" &&
    rowKeys.includes(anchorKey) && rowKeys.length === requestedCount &&
    sourceKeys.length === previousSourceKeys.length &&
    sourceKeys.every((key, index) => key === previousSourceKeys[index]) &&
    rowKeys.every(key => sourceKeys.includes(key)));
}

const smooth = (value: number) => {
  const p = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return p * p * (3 - 2 * p);
};

/** The entire binding clears the row before it turns or grows. */
export function bookShelfExtractionStages(progress: number, returning = false) {
  return returning
    ? { presentation: smooth(progress / .55), pull: smooth((progress - .55) / .45) }
    : { pull: smooth(progress / .45), presentation: smooth((progress - .45) / .55) };
}

export function bookShelfExtractionClearance(coverWidth: number, scale: number) {
  return Math.max(.1, coverWidth) * Math.max(1, scale) + .12;
}

function interpolatePose(from: CompleteShelfBookPose, to: CompleteShelfBookPose, progress: number): CompleteShelfBookPose {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  const mix = (a: number, b: number) => a + (b - a) * progress;
  const vector = (a: readonly number[], b: readonly number[]) =>
    a.map((value, index) => mix(value, b[index])) as [number, number, number];
  return {
    position: vector(from.position, to.position),
    rotation: vector(from.rotation, to.rotation),
    scale: mix(from.scale, to.scale),
    coverAngle: mix(from.coverAngle, to.coverAngle),
    firstLeafAngle: mix(from.firstLeafAngle, to.firstLeafAngle),
    secondLeafAngle: mix(from.secondLeafAngle, to.secondLeafAngle),
  };
}

export function sampleBookShelfExtractionPose({ from, to, coverWidth, progress, returning = false }: {
  from: CompleteShelfBookPose;
  to: CompleteShelfBookPose;
  coverWidth: number;
  progress: number;
  returning?: boolean;
}): CompleteShelfBookPose {
  // A cancellation during straight withdrawal simply reverses that withdrawal.
  if (returning && from.position.slice(0, 2).every((value, index) => Math.abs(value - to.position[index]) < .001) &&
    from.rotation.every((value, index) => Math.abs(value - to.rotation[index]) < .001) && Math.abs(from.scale - to.scale) < .001) {
    return interpolatePose(from, to, smooth(progress));
  }
  const stages = bookShelfExtractionStages(progress, returning);
  const row = returning ? to : from;
  const clearance = Math.max(from.position[2], to.position[2],
    bookShelfExtractionClearance(coverWidth, Math.max(from.scale, to.scale)));
  const outsideRow = { ...row, position: [row.position[0], row.position[1], clearance] as const };
  if (returning) {
    return stages.presentation < 1
      ? interpolatePose(from, outsideRow, stages.presentation)
      : interpolatePose(outsideRow, to, stages.pull);
  }
  return stages.pull < 1
    ? interpolatePose(from, outsideRow, stages.pull)
    : interpolatePose(outsideRow, to, stages.presentation);
}
