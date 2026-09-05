import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeHostPlatform } from "./initializeHostPlatform";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const readers = () => ({ getAppLanguage: vi.fn(async () => ({ value: "ru-RU" })), readLanguagePreference: vi.fn(async () => ({ value: "en" })) });

describe("native host initialization", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("starts independent reads together and returns immutable canonical values", async () => {
    const language = deferred<unknown>(), preference = deferred<unknown>();
    const getAppLanguage = vi.fn(() => language.promise), readLanguagePreference = vi.fn(() => preference.promise);
    const operation = initializeHostPlatform({ getAppLanguage, readLanguagePreference });
    await Promise.resolve();
    expect(getAppLanguage).toHaveBeenCalledOnce();
    expect(readLanguagePreference).toHaveBeenCalledOnce();
    preference.resolve({ value: "ru" }); language.resolve({ value: "EN-us" });
    const result = await operation;
    expect(result).toEqual({ language: { status: "ready", value: "en-US" }, preference: { status: "ready", value: "ru" } });
    expect(Object.isFrozen(result) && Object.isFrozen(result.language) && Object.isFrozen(result.preference)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("distinguishes an absent stored choice from an unavailable preference store", async () => {
    const result = await initializeHostPlatform({ ...readers(), readLanguagePreference: async () => ({ value: null }) });
    expect(result.preference).toEqual({ status: "ready", value: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out after the default bound while retaining a successful independent read", async () => {
    const pending = deferred<unknown>();
    const operation = initializeHostPlatform({ ...readers(), getAppLanguage: () => pending.promise });
    let complete = false; void operation.then(() => { complete = true; });
    await vi.advanceTimersByTimeAsync(1499); expect(complete).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await operation;
    expect(result).toEqual({ language: { status: "timeout", value: null }, preference: { status: "ready", value: "en" } });
    pending.resolve({ value: "ru" }); await Promise.resolve();
    expect(result.language).toEqual({ status: "timeout", value: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("consumes a late rejection after both reads time out", async () => {
    const a = deferred<unknown>(), b = deferred<unknown>();
    const operation = initializeHostPlatform({ getAppLanguage: () => a.promise, readLanguagePreference: () => b.promise, timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    expect(await operation).toEqual({ language: { status: "timeout", value: null }, preference: { status: "timeout", value: null } });
    a.reject(new Error("private native error")); b.reject(new Error("private preference error"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("turns synchronous plugin throws and async rejections into explicit unavailable values", async () => {
    const result = await initializeHostPlatform({ getAppLanguage: () => { throw new Error("native unavailable"); }, readLanguagePreference: () => Promise.reject(new Error("storage unavailable")) });
    expect(result).toEqual({ language: { status: "unavailable", value: null }, preference: { status: "unavailable", value: null } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, undefined, [], {}, { value: 3 }, { value: "" }, { value: " ru" }, { value: "ru_RU" }, { value: "en\n" }, { value: "a".repeat(129) }])("rejects malformed native language result %j without a browser fallback", async value => {
    const result = await initializeHostPlatform({ ...readers(), getAppLanguage: async () => value });
    expect(result.language).toEqual({ status: "unavailable", value: null });
  });

  it.each([undefined, "RU", "fr", 42, {}, []])("rejects noncanonical persisted preference %j", async value => {
    const result = await initializeHostPlatform({ ...readers(), readLanguagePreference: async () => ({ value }) });
    expect(result.preference).toEqual({ status: "unavailable", value: null });
  });

  it("contains throwing native result getters", async () => {
    const result = await initializeHostPlatform({ ...readers(), getAppLanguage: async () => ({ get value() { throw new Error("bad bridge"); } }) });
    expect(result.language.status).toBe("unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, 1.5, 10_001, NaN, Infinity])("rejects invalid timeout %s before native calls", async timeoutMs => {
    const native = readers();
    await expect(initializeHostPlatform({ ...native, timeoutMs })).rejects.toThrow(RangeError);
    expect(native.getAppLanguage).not.toHaveBeenCalled();
    expect(native.readLanguagePreference).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
