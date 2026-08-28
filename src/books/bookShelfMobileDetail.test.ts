import { describe, expect, it } from "vitest";

import {
  bookShelfMobileDetailReducer,
  createInitialBookShelfMobileDetailState,
  getBookShelfMobileDetailMotion,
  resolveBookShelfMobileDetailAxis,
  resolveBookShelfMobileDetailSettle,
} from "./bookShelfMobileDetail";

describe("mobile book detail sheet", () => {
  it("moves deterministically through collapsed, half and expanded", () => {
    let state = createInitialBookShelfMobileDetailState();
    expect(state.position).toBe("collapsed");

    state = bookShelfMobileDetailReducer(state, {
      type: "request-position",
      position: "half",
    });
    expect(state).toMatchObject({
      position: "collapsed",
      targetPosition: "half",
      phase: "settling",
    });
    expect(
      bookShelfMobileDetailReducer(state, {
        type: "settled",
        transitionId: state.transitionId - 1,
      }),
    ).toBe(state);

    state = bookShelfMobileDetailReducer(state, {
      type: "settled",
      transitionId: state.transitionId,
    });
    expect(state).toMatchObject({ position: "half", phase: "idle" });

    state = bookShelfMobileDetailReducer(state, {
      type: "request-position",
      position: "expanded",
    });
    state = bookShelfMobileDetailReducer(state, {
      type: "settled",
      transitionId: state.transitionId,
    });
    expect(state.position).toBe("expanded");
  });

  it("locks an axis only after a finite activation distance", () => {
    expect(resolveBookShelfMobileDetailAxis(2, 3)).toBe("pending");
    expect(resolveBookShelfMobileDetailAxis(4, 18)).toBe("vertical");
    expect(resolveBookShelfMobileDetailAxis(20, 5)).toBe("horizontal");
    expect(resolveBookShelfMobileDetailAxis(12, 12)).toBe("pending");
    expect(resolveBookShelfMobileDetailAxis(Number.NaN, 20)).toBe("vertical");
  });

  it("settles one adjacent state by distance or release velocity", () => {
    expect(
      resolveBookShelfMobileDetailSettle({
        position: "half",
        axis: "vertical",
        deltaY: -60,
      }),
    ).toBe("expanded");
    expect(
      resolveBookShelfMobileDetailSettle({
        position: "half",
        axis: "vertical",
        deltaY: 60,
      }),
    ).toBe("collapsed");
    expect(
      resolveBookShelfMobileDetailSettle({
        position: "half",
        axis: "vertical",
        deltaY: -20,
      }),
    ).toBe("half");
    expect(
      resolveBookShelfMobileDetailSettle({
        position: "half",
        axis: "vertical",
        deltaY: 12,
        velocityY: -0.6,
      }),
    ).toBe("expanded");
    expect(
      resolveBookShelfMobileDetailSettle({
        position: "expanded",
        axis: "vertical",
        deltaY: -100,
      }),
    ).toBe("expanded");
    expect(
      resolveBookShelfMobileDetailSettle({
        position: "half",
        axis: "horizontal",
        deltaY: -100,
      }),
    ).toBe("half");
  });

  it("keeps horizontal shelf gestures out of the vertical detail sheet", () => {
    let state = createInitialBookShelfMobileDetailState("half");
    state = bookShelfMobileDetailReducer(state, {
      type: "drag-start",
      x: 100,
      y: 300,
    });
    state = bookShelfMobileDetailReducer(state, {
      type: "drag-move",
      x: 180,
      y: 310,
    });
    expect(state).toMatchObject({ axis: "horizontal", dragOffsetPx: 0 });
    state = bookShelfMobileDetailReducer(state, { type: "drag-end" });
    expect(state).toMatchObject({ position: "half", phase: "idle" });
  });

  it("settles a vertical drag and ignores stale animation completion", () => {
    let state = createInitialBookShelfMobileDetailState("half");
    state = bookShelfMobileDetailReducer(state, {
      type: "drag-start",
      x: 100,
      y: 300,
    });
    state = bookShelfMobileDetailReducer(state, {
      type: "drag-move",
      x: 104,
      y: 225,
    });
    expect(state).toMatchObject({ axis: "vertical", dragOffsetPx: -75 });
    state = bookShelfMobileDetailReducer(state, { type: "drag-end" });
    expect(state).toMatchObject({
      position: "half",
      targetPosition: "expanded",
      phase: "settling",
    });

    const stale = bookShelfMobileDetailReducer(state, {
      type: "settled",
      transitionId: state.transitionId + 1,
    });
    expect(stale).toBe(state);
    state = bookShelfMobileDetailReducer(state, {
      type: "settled",
      transitionId: state.transitionId,
    });
    expect(state).toMatchObject({ position: "expanded", phase: "idle" });
  });

  it("preserves every state while making reduced-motion transitions instant", () => {
    expect(getBookShelfMobileDetailMotion(false)).toMatchObject({
      mode: "panel",
      durationMs: 260,
    });
    expect(getBookShelfMobileDetailMotion(true)).toEqual({
      mode: "instant",
      durationMs: 0,
      easing: "linear",
    });

    let state = createInitialBookShelfMobileDetailState("collapsed", true);
    state = bookShelfMobileDetailReducer(state, {
      type: "request-position",
      position: "half",
    });
    expect(state).toMatchObject({ position: "half", phase: "idle" });
    state = bookShelfMobileDetailReducer(state, {
      type: "request-position",
      position: "expanded",
    });
    expect(state).toMatchObject({ position: "expanded", phase: "idle" });

    state = bookShelfMobileDetailReducer(state, {
      type: "drag-start",
      x: 100,
      y: 200,
    });
    state = bookShelfMobileDetailReducer(state, {
      type: "drag-move",
      x: 102,
      y: 270,
    });
    state = bookShelfMobileDetailReducer(state, { type: "drag-end" });
    expect(state).toMatchObject({ position: "half", phase: "idle" });
  });
});
