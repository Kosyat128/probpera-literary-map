export type GlobeAutoPauseReason =
  | "reduced-motion"
  | "document-hidden"
  | "offscreen"
  | "selection"
  | "hover"
  | "interaction"
  | "camera-flight";

export type GlobeAutoRotationPolicyInput = Readonly<{
  requested: boolean;
  reducedMotion: boolean;
  documentVisible: boolean;
  globeVisible: boolean;
  hasSelection: boolean;
  hasHover: boolean;
  interacting: boolean;
  cameraFlightActive?: boolean;
}>;

export type GlobeAutoRotationPolicy = Readonly<{
  requested: boolean;
  active: boolean;
  pauseReason: GlobeAutoPauseReason | null;
  status: "off" | "active" | GlobeAutoPauseReason;
}>;

/** Keeps the user's preference independent from temporary pause conditions. */
export function resolveGlobeAutoRotationPolicy(
  input: GlobeAutoRotationPolicyInput
): GlobeAutoRotationPolicy {
  if (!input.requested) {
    return { requested: false, active: false, pauseReason: null, status: "off" };
  }

  const pauseReason: GlobeAutoPauseReason | null = input.reducedMotion
    ? "reduced-motion"
    : !input.documentVisible
      ? "document-hidden"
      : !input.globeVisible
        ? "offscreen"
        : input.hasSelection
          ? "selection"
          : input.hasHover
            ? "hover"
            : input.interacting
              ? "interaction"
              : input.cameraFlightActive
                ? "camera-flight"
                : null;

  return {
    requested: true,
    active: pauseReason === null,
    pauseReason,
    status: pauseReason ?? "active",
  };
}

export type GlobeFrameMode = "never" | "demand" | "always";

export type GlobeFramePolicyInput = Readonly<{
  globeVisible: boolean;
  documentVisible: boolean;
  autoRotateActive: boolean;
  cameraFlightActive?: boolean;
  controlsDampingActive?: boolean;
  transientAnimationActive?: boolean;
}>;

/**
 * Static sky, stars, markers, and Nobel layers deliberately do not appear in
 * this policy: they must not keep WebGL alive while the globe is idle.
 */
export function resolveGlobeFrameMode({
  globeVisible,
  documentVisible,
  autoRotateActive,
  cameraFlightActive = false,
  controlsDampingActive = false,
  transientAnimationActive = false,
}: GlobeFramePolicyInput): GlobeFrameMode {
  if (!globeVisible || !documentVisible) return "never";
  return autoRotateActive ||
    cameraFlightActive ||
    controlsDampingActive ||
    transientAnimationActive
    ? "always"
    : "demand";
}

export type GlobeRenderSize = Readonly<{
  width: number;
  height: number;
}>;

export type GlobeIdleDeadline = Readonly<{
  didTimeout: boolean;
  timeRemaining: () => number;
}>;

export type GlobeIdleWorkScheduler = Readonly<{
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
  requestIdle?: (
    callback: (deadline: GlobeIdleDeadline) => void,
    options: Readonly<{ timeout: number }>
  ) => number;
  cancelIdle?: (handle: number) => void;
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (handle: number) => void;
  isInputPending?: () => boolean;
}>;

export type ScheduleGlobeIdlePrewarmOptions<T> = Readonly<{
  items: readonly T[];
  work: (item: T) => void;
  shouldPause?: () => boolean;
  scheduler?: GlobeIdleWorkScheduler;
}>;

const GLOBE_PREWARM_IDLE_TIMEOUT_MS = 700;
const GLOBE_PREWARM_FALLBACK_DELAY_MS = 72;
const GLOBE_PREWARM_PAUSED_RETRY_MS = 120;
const GLOBE_PREWARM_MIN_IDLE_BUDGET_MS = 4;
const GLOBE_PREWARM_MAX_IDLE_ITEMS = 2;

type SchedulingNavigator = Navigator & {
  scheduling?: {
    isInputPending?: (options?: { includeContinuous?: boolean }) => boolean;
  };
};

function browserGlobeIdleWorkScheduler(): GlobeIdleWorkScheduler {
  const requestIdle =
    typeof window.requestIdleCallback === "function"
      ? (callback: (deadline: GlobeIdleDeadline) => void, options: { timeout: number }) =>
          window.requestIdleCallback(callback, options)
      : undefined;
  const cancelIdle =
    typeof window.cancelIdleCallback === "function"
      ? (handle: number) => window.cancelIdleCallback(handle)
      : undefined;
  const scheduling = (navigator as SchedulingNavigator).scheduling;

  return {
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    requestIdle,
    cancelIdle,
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (handle) => window.clearTimeout(handle),
    isInputPending: scheduling?.isInputPending
      ? () => {
          try {
            return Boolean(
              scheduling.isInputPending?.({ includeContinuous: true })
            );
          } catch {
            return Boolean(scheduling.isInputPending?.());
          }
        }
      : undefined,
  };
}

/**
 * Runs non-essential globe precomputation only after the ready frame has had a
 * chance to paint. Idle-capable browsers receive short, bounded batches;
 * browsers without requestIdleCallback process exactly one item per delayed
 * task so Safari never turns prewarm into a tight main-thread loop.
 */
export function scheduleGlobeIdlePrewarm<T>({
  items,
  work,
  shouldPause = () => false,
  scheduler = browserGlobeIdleWorkScheduler(),
}: ScheduleGlobeIdlePrewarmOptions<T>) {
  let cursor = 0;
  let cancelled = false;
  let frameHandle: number | null = null;
  let idleHandle: number | null = null;
  let timerHandle: number | null = null;

  const hasWork = () => cursor < items.length;
  const inputPending = () => {
    try {
      return Boolean(scheduler.isInputPending?.());
    } catch {
      return false;
    }
  };
  const paused = () => shouldPause() || inputPending();

  const clearScheduledWork = () => {
    if (frameHandle !== null) scheduler.cancelFrame(frameHandle);
    if (idleHandle !== null) scheduler.cancelIdle?.(idleHandle);
    if (timerHandle !== null) scheduler.clearTimer(timerHandle);
    frameHandle = null;
    idleHandle = null;
    timerHandle = null;
  };

  const runOne = () => {
    if (cancelled || !hasWork() || paused()) return false;
    work(items[cursor]);
    cursor += 1;
    return true;
  };

  const scheduleTimer = (delayMs: number, callback: () => void) => {
    if (cancelled || !hasWork() || timerHandle !== null) return;
    timerHandle = scheduler.setTimer(() => {
      timerHandle = null;
      callback();
    }, delayMs);
  };

  const schedule = () => {
    if (cancelled || !hasWork()) return;
    if (paused()) {
      scheduleTimer(GLOBE_PREWARM_PAUSED_RETRY_MS, schedule);
      return;
    }

    if (scheduler.requestIdle) {
      idleHandle = scheduler.requestIdle(
        (deadline) => {
          idleHandle = null;
          if (cancelled || !hasWork()) return;
          if (paused()) {
            scheduleTimer(GLOBE_PREWARM_PAUSED_RETRY_MS, schedule);
            return;
          }

          let processed = 0;
          while (
            hasWork() &&
            processed < GLOBE_PREWARM_MAX_IDLE_ITEMS &&
            !paused()
          ) {
            const hasBudget =
              deadline.timeRemaining() >= GLOBE_PREWARM_MIN_IDLE_BUDGET_MS;
            if (!hasBudget && !(deadline.didTimeout && processed === 0)) break;
            if (!runOne()) break;
            processed += 1;
          }
          schedule();
        },
        { timeout: GLOBE_PREWARM_IDLE_TIMEOUT_MS }
      );
      return;
    }

    scheduleTimer(GLOBE_PREWARM_FALLBACK_DELAY_MS, () => {
      if (paused()) {
        scheduleTimer(GLOBE_PREWARM_PAUSED_RETRY_MS, schedule);
        return;
      }
      runOne();
      schedule();
    });
  };

  // The atlas is already usable when this function is called. Deferring its
  // queue until the following frame keeps first interactive/paint ahead of
  // every optional focus-metric calculation.
  if (hasWork()) {
    frameHandle = scheduler.requestFrame(() => {
      frameHandle = null;
      schedule();
    });
  }

  return () => {
    cancelled = true;
    clearScheduledWork();
  };
}

export type GlobeResizeDecision = Readonly<{
  changed: boolean;
  size: GlobeRenderSize;
}>;

export function normalizeGlobeRenderSize(width: number, height: number) {
  return {
    width: Math.max(1, Math.round(Number.isFinite(width) ? width : 1)),
    height: Math.max(1, Math.round(Number.isFinite(height) ? height : 1)),
  } satisfies GlobeRenderSize;
}

/** Produces a renderer update only when rounded content-box dimensions differ. */
export function resolveGlobeResize(
  previous: GlobeRenderSize | null | undefined,
  width: number,
  height: number
): GlobeResizeDecision {
  const size = normalizeGlobeRenderSize(width, height);
  return {
    changed:
      !previous || previous.width !== size.width || previous.height !== size.height,
    size,
  };
}
