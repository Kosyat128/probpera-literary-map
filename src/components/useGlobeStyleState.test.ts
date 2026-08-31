import { describe, expect, it, vi } from "vitest";

import type { GlobeEditionId } from "./globeEditions";
import {
  createInitialGlobeStyleState,
  describeGlobeStyleStatus,
  executeGlobeStyleRequest,
  globeStyleStateReducer,
  isGlobeStyleRendered,
  resolveInitialGlobeStyle,
  type GlobeStyleRequestToken,
} from "./useGlobeStyleState";

function request(
  state: ReturnType<typeof createInitialGlobeStyleState>,
  style: GlobeEditionId,
  requestId: number
) {
  return globeStyleStateReducer(state, { type: "request", style, requestId });
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("globe style state", () => {
  it("defaults invalid storage to 1887 and migrates legacy surface values", () => {
    expect(resolveInitialGlobeStyle(undefined)).toBe("rand-mcnally-1887");
    expect(resolveInitialGlobeStyle("satellite")).toBe("rand-mcnally-1887");
    expect(resolveInitialGlobeStyle("earth")).toBe("nasa-blue-marble");
    expect(resolveInitialGlobeStyle("modern")).toBe("natural-earth-2026");
    expect(resolveInitialGlobeStyle("constructor")).toBe("rand-mcnally-1887");
    expect(resolveInitialGlobeStyle("toString")).toBe("rand-mcnally-1887");
  });

  it("keeps the old rendered texture and aria state until success", () => {
    const initial = createInitialGlobeStyleState("rand-mcnally-1887");
    const pending = request(initial, "nasa-blue-marble", 1);

    expect(pending).toMatchObject({
      requestedStyle: "nasa-blue-marble",
      pendingStyle: "nasa-blue-marble",
      renderedStyle: "rand-mcnally-1887",
    });
    expect(isGlobeStyleRendered(pending, "rand-mcnally-1887")).toBe(true);
    expect(isGlobeStyleRendered(pending, "nasa-blue-marble")).toBe(false);
    expect(describeGlobeStyleStatus(pending)).toEqual({
      kind: "loading",
      style: "nasa-blue-marble",
      role: "status",
      live: "polite",
      retryable: false,
    });

    const resolved = globeStyleStateReducer(pending, {
      type: "resolve",
      style: "nasa-blue-marble",
      requestId: 1,
    });
    expect(resolved).toMatchObject({
      requestedStyle: "nasa-blue-marble",
      pendingStyle: null,
      renderedStyle: "nasa-blue-marble",
      error: null,
    });
  });

  it("preserves the rendered style on failure and exposes a safe retry status", () => {
    const pending = request(
      createInitialGlobeStyleState("rand-mcnally-1887"),
      "natural-earth-2026",
      4
    );
    const failed = globeStyleStateReducer(pending, {
      type: "reject",
      style: "natural-earth-2026",
      requestId: 4,
    });

    expect(failed.renderedStyle).toBe("rand-mcnally-1887");
    expect(failed.pendingStyle).toBeNull();
    expect(failed.error).toEqual({
      code: "texture-load-failed",
      style: "natural-earth-2026",
      requestId: 4,
      retryable: true,
    });
    expect(describeGlobeStyleStatus(failed)).toEqual({
      kind: "error",
      style: "natural-earth-2026",
      role: "alert",
      live: "assertive",
      retryable: true,
    });
  });

  it("records an initial Rand fallback without losing the failed stored choice", () => {
    const stored = createInitialGlobeStyleState("cassini-1790");
    const fallback = globeStyleStateReducer(stored, {
      type: "fallback",
      failedStyle: "cassini-1790",
      fallbackStyle: "rand-mcnally-1887",
      requestId: 1,
    });

    expect(fallback).toMatchObject({
      requestedStyle: "cassini-1790",
      pendingStyle: null,
      renderedStyle: "rand-mcnally-1887",
      requestId: 1,
    });
    expect(fallback.error).toEqual({
      code: "texture-load-failed",
      style: "cassini-1790",
      requestId: 1,
      retryable: true,
    });
    expect(isGlobeStyleRendered(fallback, "rand-mcnally-1887")).toBe(true);
    expect(isGlobeStyleRendered(fallback, "cassini-1790")).toBe(false);

    const retrying = request(fallback, "cassini-1790", 2);
    const recovered = globeStyleStateReducer(retrying, {
      type: "resolve",
      style: "cassini-1790",
      requestId: 2,
    });
    expect(recovered).toMatchObject({
      requestedStyle: "cassini-1790",
      pendingStyle: null,
      renderedStyle: "cassini-1790",
      error: null,
    });
  });

  it("ignores stale and mismatched settlements", () => {
    const first = request(createInitialGlobeStyleState(), "nasa-blue-marble", 1);
    const latest = request(first, "natural-earth-2026", 2);

    expect(
      globeStyleStateReducer(latest, {
        type: "resolve",
        style: "nasa-blue-marble",
        requestId: 1,
      })
    ).toBe(latest);
    expect(
      globeStyleStateReducer(latest, {
        type: "reject",
        style: "nasa-blue-marble",
        requestId: 1,
      })
    ).toBe(latest);
    expect(
      globeStyleStateReducer(latest, {
        type: "resolve",
        style: "nasa-blue-marble",
        requestId: 2,
      })
    ).toBe(latest);
  });
});

describe("globe style async coordinator", () => {
  it("lets only the latest competing request render and persist", async () => {
    const earth = deferred();
    const modern = deferred();
    let latestRequestId = 1;
    const resolved: GlobeEditionId[] = [];
    const rejected: GlobeEditionId[] = [];
    const committed: GlobeEditionId[] = [];
    const makeRun = (
      token: GlobeStyleRequestToken,
      pending: ReturnType<typeof deferred>
    ) =>
      executeGlobeStyleRequest({
        token,
        applyStyle: () => pending.promise,
        isLatest: (candidate) => candidate.requestId === latestRequestId,
        onResolve: (candidate) => resolved.push(candidate.style),
        onReject: (candidate) => rejected.push(candidate.style),
        onCommit: (style) => committed.push(style),
      });

    const first = makeRun({ requestId: 1, style: "nasa-blue-marble" }, earth);
    latestRequestId = 2;
    const second = makeRun(
      { requestId: 2, style: "natural-earth-2026" },
      modern
    );

    earth.resolve();
    await expect(first).resolves.toBe("stale");
    expect(resolved).toEqual([]);
    expect(committed).toEqual([]);

    modern.resolve();
    await expect(second).resolves.toBe("committed");
    expect(resolved).toEqual(["natural-earth-2026"]);
    expect(rejected).toEqual([]);
    expect(committed).toEqual(["natural-earth-2026"]);
  });

  it("reports only the current failure and never persists it", async () => {
    const token = { requestId: 7, style: "nasa-blue-marble" } as const;
    const onResolve = vi.fn();
    const onReject = vi.fn();
    const onCommit = vi.fn();

    await expect(
      executeGlobeStyleRequest({
        token,
        applyStyle: async () => {
          throw new Error("raw network details must stay internal");
        },
        isLatest: () => true,
        onResolve,
        onReject,
        onCommit,
      })
    ).resolves.toBe("failed");
    expect(onResolve).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith(token);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keeps a successful render committed when storage is unavailable", async () => {
    const onResolve = vi.fn();
    await expect(
      executeGlobeStyleRequest({
        token: { requestId: 3, style: "natural-earth-2026" },
        applyStyle: async () => undefined,
        isLatest: () => true,
        onResolve,
        onReject: vi.fn(),
        onCommit: () => {
          throw new Error("storage blocked");
        },
      })
    ).resolves.toBe("committed");
    expect(onResolve).toHaveBeenCalledOnce();
  });
});
