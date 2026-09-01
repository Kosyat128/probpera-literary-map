import { describe, expect, it } from "vitest";

import {
  installGlobeWebGlContextLifecycle,
  readGlobeRendererResourceSnapshot,
  releaseGlobeCanvas,
  resolveGlobeAutoRotationPolicy,
  resolveGlobeFrameMode,
  resolveGlobeResize,
  scheduleGlobeIdlePrewarm,
  type GlobeIdleDeadline,
  type GlobeIdleWorkScheduler,
} from "./globePerformance";

class FakeWebGlCanvas {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: "webglcontextlost" | "webglcontextrestored") {
    const event = new Event(type, { cancelable: true });
    this.listeners.get(type)?.forEach((listener) => listener(event));
    return event;
  }

  listenerCount() {
    return [...this.listeners.values()].reduce(
      (count, listeners) => count + listeners.size,
      0
    );
  }
}

function createFakeIdleScheduler({
  idle = true,
  isInputPending = () => false,
}: {
  idle?: boolean;
  isInputPending?: () => boolean;
} = {}) {
  let nextHandle = 1;
  const frames = new Map<number, () => void>();
  const idles = new Map<number, (deadline: GlobeIdleDeadline) => void>();
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  const handle = () => nextHandle++;
  const scheduler: GlobeIdleWorkScheduler = {
    requestFrame: (callback) => {
      const id = handle();
      frames.set(id, callback);
      return id;
    },
    cancelFrame: (id) => frames.delete(id),
    ...(idle
      ? {
          requestIdle: (
            callback: (deadline: GlobeIdleDeadline) => void
          ) => {
            const id = handle();
            idles.set(id, callback);
            return id;
          },
          cancelIdle: (id: number) => idles.delete(id),
        }
      : {}),
    setTimer: (callback, delayMs) => {
      const id = handle();
      timers.set(id, { callback, delayMs });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    isInputPending,
  };

  const takeFirst = <T>(entries: Map<number, T>) => {
    const entry = entries.entries().next().value as [number, T] | undefined;
    if (!entry) throw new Error("Expected scheduled work");
    entries.delete(entry[0]);
    return entry[1];
  };

  return {
    scheduler,
    frames,
    idles,
    timers,
    runFrame: () => takeFirst(frames)(),
    runIdle: (
      deadline: GlobeIdleDeadline = {
        didTimeout: false,
        timeRemaining: () => 10,
      }
    ) => takeFirst(idles)(deadline),
    runTimer: () => takeFirst(timers).callback(),
  };
}

const autoDefaults = {
  requested: true,
  reducedMotion: false,
  documentVisible: true,
  globeVisible: true,
  hasSelection: false,
  hasHover: false,
  interacting: false,
};

describe("globe automatic rotation policy", () => {
  it("keeps requested state while a temporary reason pauses rotation", () => {
    expect(
      resolveGlobeAutoRotationPolicy({ ...autoDefaults, hasHover: true })
    ).toEqual({
      requested: true,
      active: false,
      pauseReason: "hover",
      status: "hover",
    });
    expect(resolveGlobeAutoRotationPolicy(autoDefaults).active).toBe(true);
  });

  it("reports stable pause precedence and distinguishes an explicit off state", () => {
    expect(
      resolveGlobeAutoRotationPolicy({
        ...autoDefaults,
        documentVisible: false,
        hasSelection: true,
      }).pauseReason
    ).toBe("document-hidden");
    expect(
      resolveGlobeAutoRotationPolicy({ ...autoDefaults, requested: false })
    ).toEqual({
      requested: false,
      active: false,
      pauseReason: null,
      status: "off",
    });
  });
});

describe("globe frame policy", () => {
  it("uses demand rendering for a visible idle globe", () => {
    expect(
      resolveGlobeFrameMode({
        globeVisible: true,
        documentVisible: true,
        autoRotateActive: false,
      })
    ).toBe("demand");
  });

  it("uses continuous frames only for an active runtime source", () => {
    expect(
      resolveGlobeFrameMode({
        globeVisible: true,
        documentVisible: true,
        autoRotateActive: false,
        cameraFlightActive: true,
      })
    ).toBe("always");
    expect(
      resolveGlobeFrameMode({
        globeVisible: false,
        documentVisible: true,
        autoRotateActive: true,
      })
    ).toBe("never");
  });
});

describe("globe resize deduplication", () => {
  it("deduplicates sub-pixel observer noise after content-box rounding", () => {
    expect(resolveGlobeResize({ width: 390, height: 520 }, 390.2, 519.8)).toEqual({
      changed: false,
      size: { width: 390, height: 520 },
    });
  });

  it("commits real size changes and guards invalid zero-sized observations", () => {
    expect(resolveGlobeResize({ width: 390, height: 520 }, 391, 520)).toEqual({
      changed: true,
      size: { width: 391, height: 520 },
    });
    expect(resolveGlobeResize(null, 0, Number.NaN).size).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe("globe focus-metric idle prewarm", () => {
  it("waits for the ready frame and bounds requestIdleCallback batches", () => {
    const fake = createFakeIdleScheduler();
    const processed: string[] = [];
    const cancel = scheduleGlobeIdlePrewarm({
      items: ["france", "japan", "argentina"],
      work: (countryId) => processed.push(countryId),
      scheduler: fake.scheduler,
    });

    expect(processed).toEqual([]);
    expect(fake.frames.size).toBe(1);
    expect(fake.idles.size).toBe(0);

    fake.runFrame();
    expect(processed).toEqual([]);
    expect(fake.idles.size).toBe(1);

    fake.runIdle();
    expect(processed).toEqual(["france", "japan"]);
    expect(fake.idles.size).toBe(1);

    fake.runIdle();
    expect(processed).toEqual(["france", "japan", "argentina"]);
    expect(fake.idles.size).toBe(0);

    cancel();
    expect(fake.frames.size + fake.idles.size + fake.timers.size).toBe(0);
  });

  it("yields to explicit activity and native pending input", () => {
    let paused = true;
    let inputPending = false;
    const fake = createFakeIdleScheduler({
      isInputPending: () => inputPending,
    });
    const processed: string[] = [];
    scheduleGlobeIdlePrewarm({
      items: ["japan"],
      work: (countryId) => processed.push(countryId),
      shouldPause: () => paused,
      scheduler: fake.scheduler,
    });

    fake.runFrame();
    expect(fake.idles.size).toBe(0);
    expect(fake.timers.size).toBe(1);
    fake.runTimer();
    expect(processed).toEqual([]);

    paused = false;
    fake.runTimer();
    expect(fake.idles.size).toBe(1);
    inputPending = true;
    fake.runIdle();
    expect(processed).toEqual([]);
    expect(fake.timers.size).toBe(1);

    inputPending = false;
    fake.runTimer();
    fake.runIdle();
    expect(processed).toEqual(["japan"]);
  });

  it("uses one delayed item per Safari fallback task and remains cancellable", () => {
    let paused = false;
    const fake = createFakeIdleScheduler({ idle: false });
    const processed: string[] = [];
    const cancel = scheduleGlobeIdlePrewarm({
      items: ["a", "b", "c"],
      work: (countryId) => processed.push(countryId),
      shouldPause: () => paused,
      scheduler: fake.scheduler,
    });

    fake.runFrame();
    expect(fake.timers.size).toBe(1);
    expect([...fake.timers.values()][0]?.delayMs).toBeGreaterThanOrEqual(64);
    fake.runTimer();
    expect(processed).toEqual(["a"]);
    expect(fake.timers.size).toBe(1);
    fake.runTimer();
    expect(processed).toEqual(["a", "b"]);

    paused = true;
    fake.runTimer();
    expect(processed).toEqual(["a", "b"]);
    expect(fake.timers.size).toBe(1);

    cancel();
    expect(fake.frames.size + fake.idles.size + fake.timers.size).toBe(0);
  });
});

describe("globe WebGL resource lifecycle", () => {
  it("permits context restoration, reports transitions and removes listeners", () => {
    const canvas = new FakeWebGlCanvas();
    const transitions: string[] = [];
    let clock = 100;
    let renderRequests = 0;
    const lifecycle = installGlobeWebGlContextLifecycle(
      canvas as unknown as Pick<
        HTMLCanvasElement,
        "addEventListener" | "removeEventListener"
      >,
      {
        now: () => clock,
        onContextLost: (snapshot) =>
          transitions.push(`lost:${snapshot.lossCount}`),
        onContextRestored: (snapshot) =>
          transitions.push(`restored:${snapshot.restorationCount}`),
        requestRender: () => {
          renderRequests += 1;
        },
      }
    );

    const lossEvent = canvas.dispatch("webglcontextlost");
    expect(lossEvent.defaultPrevented).toBe(true);
    expect(lifecycle.snapshot()).toEqual({
      contextLost: true,
      lossCount: 1,
      restorationCount: 0,
      lastLossAt: 100,
      lastRestorationAt: null,
    });

    clock = 140;
    canvas.dispatch("webglcontextrestored");
    expect(lifecycle.snapshot()).toEqual({
      contextLost: false,
      lossCount: 1,
      restorationCount: 1,
      lastLossAt: 100,
      lastRestorationAt: 140,
    });
    expect(transitions).toEqual(["lost:1", "restored:1"]);
    expect(renderRequests).toBe(1);

    lifecycle.dispose();
    expect(canvas.listenerCount()).toBe(0);
    canvas.dispatch("webglcontextlost");
    expect(lifecycle.snapshot().lossCount).toBe(1);
  });

  it("returns detached numeric renderer diagnostics", () => {
    const snapshot = readGlobeRendererResourceSnapshot({
      info: {
        memory: { geometries: 18, textures: 7 },
        render: { calls: 24, triangles: 1024, points: Number.NaN, lines: -3 },
        programs: [{}, {}, {}],
      },
    });

    expect(snapshot).toEqual({
      geometries: 18,
      textures: 7,
      programs: 3,
      calls: 24,
      triangles: 1024,
      points: 0,
      lines: 0,
    });
  });

  it("releases detached canvas backing stores", () => {
    const canvas = { width: 4096, height: 2048 };
    releaseGlobeCanvas(canvas);
    expect(canvas).toEqual({ width: 1, height: 1 });
  });
});
