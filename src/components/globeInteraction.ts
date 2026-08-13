export const GLOBE_INTERACTION_RESUME_DELAY_MS = 1_800;

export const GLOBE_KEYBOARD_ROTATION_STEP = Math.PI / 18;

export type GlobePointerSample = {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  button?: number;
  isPrimary?: boolean;
};

export type GlobePointerGesture = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  maxDistance: number;
};

export type GlobeControlAction =
  | {
      type: "rotate";
      azimuthDelta: number;
      polarDelta: number;
    }
  | {
      type: "zoom";
      direction: "in" | "out";
    }
  | {
      type: "reset";
    }
  | {
      type: "select";
    };

function pointerTolerance(pointerType: string) {
  if (pointerType === "touch") return 14;
  if (pointerType === "pen") return 10;
  return 7;
}

export function beginGlobePointerGesture(
  sample: GlobePointerSample
): GlobePointerGesture | null {
  if (sample.isPrimary === false) return null;
  if (sample.pointerType === "mouse" && sample.button !== 0) return null;

  return {
    pointerId: sample.pointerId,
    pointerType: sample.pointerType,
    startX: sample.clientX,
    startY: sample.clientY,
    maxDistance: 0,
  };
}

export function updateGlobePointerGesture(
  gesture: GlobePointerGesture | null,
  sample: GlobePointerSample
): GlobePointerGesture | null {
  if (!gesture || sample.pointerId !== gesture.pointerId) return null;

  return {
    ...gesture,
    maxDistance: Math.max(
      gesture.maxDistance,
      Math.hypot(sample.clientX - gesture.startX, sample.clientY - gesture.startY)
    ),
  };
}

export function isGlobePointerTap(
  gesture: GlobePointerGesture | null,
  sample: GlobePointerSample
) {
  const completedGesture = updateGlobePointerGesture(gesture, sample);
  return Boolean(
    completedGesture &&
      sample.isPrimary !== false &&
      completedGesture.maxDistance <= pointerTolerance(completedGesture.pointerType)
  );
}

export function globeControlActionForKey(
  key: string,
  accelerated = false
): GlobeControlAction | null {
  const rotationStep = GLOBE_KEYBOARD_ROTATION_STEP * (accelerated ? 2 : 1);

  switch (key) {
    case "ArrowLeft":
      return { type: "rotate", azimuthDelta: -rotationStep, polarDelta: 0 };
    case "ArrowRight":
      return { type: "rotate", azimuthDelta: rotationStep, polarDelta: 0 };
    case "ArrowUp":
      return { type: "rotate", azimuthDelta: 0, polarDelta: -rotationStep };
    case "ArrowDown":
      return { type: "rotate", azimuthDelta: 0, polarDelta: rotationStep };
    case "+":
    case "=":
    case "Add":
      return { type: "zoom", direction: "in" };
    case "-":
    case "_":
    case "Subtract":
      return { type: "zoom", direction: "out" };
    case "Home":
    case "0":
      return { type: "reset" };
    case "Enter":
      return { type: "select" };
    default:
      return null;
  }
}

export function shouldGlobeAutoRotate({
  requested,
  reducedMotion,
  selectedCountryId,
  interactionPaused,
  visible,
}: {
  requested: boolean;
  reducedMotion: boolean;
  selectedCountryId?: string | null;
  interactionPaused: boolean;
  visible: boolean;
}) {
  return (
    requested &&
    !reducedMotion &&
    !selectedCountryId &&
    !interactionPaused &&
    visible
  );
}
