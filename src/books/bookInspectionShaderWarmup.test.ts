import { afterEach, describe, expect, it, vi } from "vitest";
import { Camera, Group, Scene, type WebGLRenderer } from "three";
import { warmBookInspectionShaders } from "./bookInspectionShaderWarmup";

function fixture() {
  let completed = false;
  let lost = false;
  const context = {
    getExtension: vi.fn(() => ({ COMPLETION_STATUS_KHR: 0x91b1 })),
    getProgramParameter: vi.fn((_program: unknown, _status: number) => completed),
    isContextLost: () => lost,
    isShader: vi.fn(() => true),
    getShaderParameter: vi.fn(() => false),
    deleteShader: vi.fn(),
    DELETE_STATUS: 0x8b80,
  };
  const programs = [{ program: {} as unknown, getUniforms: vi.fn(), vertexShader: {}, fragmentShader: {} }];
  const renderer = {
    getContext: () => context,
    compile: vi.fn(),
    info: { programs },
  } as unknown as WebGLRenderer;
  const rig = new Group();
  rig.visible = false;
  const ready = vi.fn();
  const failure = vi.fn();
  const start = () => warmBookInspectionShaders(renderer, rig, new Camera(), new Scene(), ready, failure);
  return { context, renderer, programs, ready, failure, start, complete: () => { completed = true; }, lose: () => { lost = true; } };
}

afterEach(() => vi.useRealTimers());

describe("inspection shader preparation", () => {
  it("keeps a hidden rig pending until native compilation finishes, then stops scheduling", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.start();
    vi.advanceTimersByTime(32);
    expect(f.ready).not.toHaveBeenCalled();
    expect(f.context.getProgramParameter.mock.calls.every(call => call[1] === 0x91b1)).toBe(true);
    f.complete();
    vi.advanceTimersByTime(16);
    expect(f.ready).toHaveBeenCalledOnce();
    expect(f.failure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels pending work before a replaced rig can be disposed", () => {
    vi.useFakeTimers();
    const f = fixture();
    const cancel = f.start();
    vi.advanceTimersByTime(16);
    const calls = f.context.getProgramParameter.mock.calls.length;
    cancel();
    f.complete();
    vi.advanceTimersByTime(1000);
    expect(f.context.getProgramParameter).toHaveBeenCalledTimes(calls);
    expect(f.ready).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(f.context.deleteShader).toHaveBeenCalledTimes(2);
  });

  it("does not wait on disposed program handles and releases unused compiled shaders", () => {
    vi.useFakeTimers();
    const f = fixture();
    const disposed = { program: undefined, getUniforms: vi.fn(), vertexShader: {}, fragmentShader: {} };
    f.programs.push(disposed);
    f.start();
    f.complete();
    vi.runAllTimers();
    expect(f.ready).toHaveBeenCalledOnce();
    expect(f.programs[0].getUniforms).toHaveBeenCalledOnce();
    expect(disposed.getUniforms).not.toHaveBeenCalled();
  });

  it("terminates on context loss and retains an explicit failure", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.start();
    f.lose();
    vi.runAllTimers();
    expect(f.failure).toHaveBeenCalledWith(expect.any(Error));
    expect(f.ready).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a driver that never completes without creating a perpetual loop", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.start();
    vi.advanceTimersByTime(20_032);
    expect(f.failure).toHaveBeenCalledWith(expect.any(Error));
    expect(f.ready).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
