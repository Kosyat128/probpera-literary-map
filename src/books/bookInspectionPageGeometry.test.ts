import { describe, expect, it } from "vitest";

import {
  buildBookInspectionPageGeometrySamples,
  normalizeBookInspectionPageTurnProgress,
  resolveBookInspectionPageGeometryPlan,
  resolveBookInspectionPageTurnOutcome,
  sampleBookInspectionPageTurn,
} from "./bookInspectionPageGeometry";

describe("book inspection page geometry", () => {
  it("keeps HIGH tessellation in the pinned range and lowers both cheaper tiers", () => {
    const high = resolveBookInspectionPageGeometryPlan("HIGH");
    const balanced = resolveBookInspectionPageGeometryPlan("BALANCED");
    const economy = resolveBookInspectionPageGeometryPlan("ECONOMY");

    expect(high.widthSegments).toBeGreaterThanOrEqual(24);
    expect(high.widthSegments).toBeLessThanOrEqual(36);
    expect(high.heightSegments).toBeGreaterThanOrEqual(3);
    expect(high.heightSegments).toBeLessThanOrEqual(6);
    expect(high).toMatchObject({
      widthSegments: 32,
      heightSegments: 5,
      vertexCount: 198,
      triangleCount: 320,
    });
    expect(balanced.widthSegments).toBeLessThan(high.widthSegments);
    expect(balanced.heightSegments).toBeLessThan(high.heightSegments);
    expect(economy.widthSegments).toBeLessThan(balanced.widthSegments);
    expect(economy.heightSegments).toBeLessThan(balanced.heightSegments);
  });

  it("clamps progress and preserves exact flat endpoints", () => {
    expect(normalizeBookInspectionPageTurnProgress(Number.NaN)).toBe(0);
    expect(normalizeBookInspectionPageTurnProgress(-2)).toBe(0);
    expect(normalizeBookInspectionPageTurnProgress(4)).toBe(1);

    expect(
      sampleBookInspectionPageTurn({
        direction: "forward",
        progress: 0,
        u: 1,
        v: 0.5,
      }).position
    ).toEqual([1, 0, 0]);
    const committed = sampleBookInspectionPageTurn({
      direction: "forward",
      progress: 1,
      u: 1,
      v: 0.5,
    });
    expect(committed.position[0]).toBeCloseTo(-1, 12);
    expect(committed.position[1]).toBe(0);
    expect(committed.position[2]).toBeCloseTo(0, 12);
  });

  it("is deterministic, bounded and anchored at the binding", () => {
    const input = {
      quality: "HIGH" as const,
      direction: "forward" as const,
      progress: 0.46,
      pageWidth: 1.2,
      pageHeight: 1.7,
    };
    const first = buildBookInspectionPageGeometrySamples(input);
    const repeated = buildBookInspectionPageGeometrySamples(input);

    expect(repeated).toEqual(first);
    expect(first.samples).toHaveLength(first.plan.vertexCount);
    for (const sample of first.samples) {
      const [x, y, z] = sample.position;
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(
        true
      );
      expect(Math.abs(x)).toBeLessThanOrEqual(1.2 * 1.1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1.7 * 0.52);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThanOrEqual(1.2 * 1.1);
      expect(Math.abs(sample.curl)).toBeLessThanOrEqual(1.2 * 0.08);
      if (sample.u === 0) {
        expect(x).toBe(0);
        expect(z).toBe(0);
      }
    }
  });

  it("mirrors forward and backward turns without changing lift", () => {
    const forward = sampleBookInspectionPageTurn({
      direction: "forward",
      progress: 0.38,
      u: 0.72,
      v: 0.3,
    });
    const backward = sampleBookInspectionPageTurn({
      direction: "backward",
      progress: 0.38,
      u: 0.72,
      v: 0.3,
    });

    expect(backward.position[0]).toBeCloseTo(-forward.position[0], 12);
    expect(backward.position[1]).toBeCloseTo(forward.position[1], 12);
    expect(backward.position[2]).toBeCloseTo(forward.position[2], 12);
  });

  it("settles forward/back gestures with consistent signed velocity", () => {
    expect(
      resolveBookInspectionPageTurnOutcome({
        direction: "forward",
        progress: 0.7,
        velocity: 0.05,
      })
    ).toEqual({ committed: true, settleProgress: 1 });
    expect(
      resolveBookInspectionPageTurnOutcome({
        direction: "forward",
        progress: 0.8,
        velocity: -0.7,
      })
    ).toEqual({ committed: false, settleProgress: 0 });
    expect(
      resolveBookInspectionPageTurnOutcome({
        direction: "backward",
        progress: 0.1,
        velocity: -0.8,
      })
    ).toEqual({ committed: true, settleProgress: 1 });
    expect(
      resolveBookInspectionPageTurnOutcome({
        direction: "backward",
        progress: 0.1,
        velocity: 0.8,
      })
    ).toEqual({ committed: false, settleProgress: 0 });
  });
});
