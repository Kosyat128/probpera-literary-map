import { describe, expect, it, vi } from "vitest";

import type { GlobeVisualStyle } from "./globeAtlas";
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
  style: GlobeVisualStyle,
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
  it("defaults invalid storage to Antique and accepts each public stored style", () => {
    expect(resolveInitialGlobeStyle(undefined)).toBe("antique");
    expect(resolveInitialGlobeStyle("satellite")).toBe("antique");
    expect(resolveInitialGlobeStyle("earth")).toBe("earth");
    expect(resolveInitialGlobeStyle("modern")).toBe("modern");
  });

  it("keeps the old rendered texture and aria state until success", () => {
    const initial = createInitialGlobeStyleState("antique");
    const pending = request(initial, "earth", 1);

    expect(pending).toMatchObject({
      requestedStyle: "earth",
      pendingStyle: "earth",
      renderedStyle: "antique",
    });
    expect(isGlobeStyleRendered(pending, "antique")).toBe(true);
    expect(isGlobeStyleRendered(pending, "earth")).toBe(false);
    expect(describeGlobeStyleStatus(pending)).toEqual({
      kind: "loading",
      style: "earth",
      role: "status",
      live: "polite",
      retryable: false,
    });

    const resolved = globeStyleStateReducer(pending, {
      type: "resolve",
      style: "earth",
      requestId: 1,
    });
    expect(resolved).toMatchObject({
      requestedStyle: "earth",
      pendingStyle: null,
      renderedStyle: "earth",
      error: null,
    });
  });

  it("preserves the rendered style on failure and exposes a safe retry status", () => {
    const pending = request(createInitialGlobeStyleState("antique"), "modern", 4);
    const failed = globeStyleStateReducer(pending, {
      type: "reject",
      style: "modern",
      requestId: 4,
    });

    expect(failed.renderedStyle).toBe("antique");
    expect(failed.pendingStyle).toBeNull();
    expect(failed.error).toEqual({
      code: "texture-load-failed",
      style: "modern",
      requestId: 4,
      retryable: true,
    });
    expect(describeGlobeStyleStatus(failed)).toEqual({
      kind: "error",
      style: "modern",
      role: "alert",
      live: "assertive",
      retryable: true,
    });
  });

  it("ignores stale and mismatched settlements", () => {
    const first = request(createInitialGlobeStyleState(), "earth", 1);
    const latest = request(first, "modern", 2);

    expect(
      globeStyleStateReducer(latest, {
        type: "resolve",
        style: "earth",
        requestId: 1,
      })
    ).toBe(latest);
    expect(
      globeStyleStateReducer(latest, {
        type: "reject",
        style: "earth",
        requestId: 1,
      })
    ).toBe(latest);
    expect(
      globeStyleStateReducer(latest, {
        type: "resolve",
        style: "earth",
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
    const resolved: GlobeVisualStyle[] = [];
    const rejected: GlobeVisualStyle[] = [];
    const committed: GlobeVisualStyle[] = [];
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

    const first = makeRun({ requestId: 1, style: "earth" }, earth);
    latestRequestId = 2;
    const second = makeRun({ requestId: 2, style: "modern" }, modern);

    earth.resolve();
    await expect(first).resolves.toBe("stale");
    expect(resolved).toEqual([]);
    expect(committed).toEqual([]);

    modern.resolve();
    await expect(second).resolves.toBe("committed");
    expect(resolved).toEqual(["modern"]);
    expect(rejected).toEqual([]);
    expect(committed).toEqual(["modern"]);
  });

  it("reports only the current failure and never persists it", async () => {
    const token = { requestId: 7, style: "earth" } as const;
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
        token: { requestId: 3, style: "modern" },
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
