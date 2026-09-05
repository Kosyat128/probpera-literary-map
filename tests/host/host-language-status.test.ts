import { describe, expect, it, vi } from "vitest";
import { createHostLanguageStatus, hostRuntimeCopy } from "../../src/host/HostRuntimeStatus";
import type { PreferenceStore } from "../../src/platform/ports";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(readAvailable = true) {
  const set = vi.fn<PreferenceStore["set"]>();
  const preferences: PreferenceStore = { persistence: "best-effort", get: async () => null, remove: async () => false, set };
  const controller = createHostLanguageStatus(preferences, "ru", readAvailable);
  return { controller, set };
}
// Mirrors the existing provider's completion callback; the provider is exercised
// directly in the Chrome component fixture, not replaced in that test.
async function persist(f: ReturnType<typeof fixture>, language: "ru" | "en") {
  const saved = await f.controller.persistence.persist(language);
  if (!saved) f.controller.persistence.onFailure?.();
  return saved;
}

describe("host language persistence outcome tracking", () => {
  it("does not write on construction and exposes a distinct failed initial read", () => {
    const f = fixture(false);
    expect(f.controller.persistence.initialLanguage).toBe("ru");
    expect(f.controller.getSnapshot()).toBe("read-unavailable");
    expect(f.controller.getServerSnapshot()).toBe("read-unavailable");
    expect(f.set).not.toHaveBeenCalled();
  });
  it("retains the selected language while reporting false or rejected persistence", async () => {
    const f = fixture();
    f.set.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("native write failed"));
    const initial = f.controller.persistence;
    expect(await persist(f, "en")).toBe(false);
    expect(f.controller.getSnapshot()).toBe("failed");
    expect(await persist(f, "ru")).toBe(false);
    expect(f.controller.getSnapshot()).toBe("failed");
    expect(f.controller.persistence).toBe(initial);
    expect(f.controller.persistence.initialLanguage).toBe("ru");
    expect(f.set.mock.calls).toEqual([["probpera-interface-language", "en"], ["probpera-interface-language", "ru"]]);
  });
  it.each([true, false])("ignores late older %s when the latest write failed", async older => {
    const f = fixture();
    const first = deferred<boolean>();
    const latest = deferred<boolean>();
    f.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    const before = persist(f, "en");
    const after = persist(f, "ru");
    latest.resolve(false);
    await after;
    expect(f.controller.getSnapshot()).toBe("failed");
    first.resolve(older);
    await before;
    expect(f.controller.getSnapshot()).toBe("failed");
  });
  it("ignores an old failure while a newer write is pending and after it succeeds", async () => {
    const f = fixture();
    const first = deferred<boolean>();
    const latest = deferred<boolean>();
    f.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    const before = persist(f, "en");
    const after = persist(f, "ru");
    first.resolve(false);
    await before;
    expect(f.controller.getSnapshot()).toBe("saving");
    latest.resolve(true);
    await after;
    f.controller.persistence.onFailure?.();
    expect(f.controller.getSnapshot()).toBe("idle");
  });
  it("does not let an old success hide a newer pending choice", async () => {
    const f = fixture();
    const first = deferred<boolean>();
    const latest = deferred<boolean>();
    f.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    const before = persist(f, "en");
    const after = persist(f, "ru");
    first.resolve(true);
    await before;
    expect(f.controller.getSnapshot()).toBe("saving");
    latest.resolve(false);
    await after;
    expect(f.controller.getSnapshot()).toBe("failed");
  });
  it("clears a previous failure only after the current successful write", async () => {
    const f = fixture(false);
    f.set.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await persist(f, "en");
    expect(f.controller.getSnapshot()).toBe("failed");
    await persist(f, "ru");
    expect(f.controller.getSnapshot()).toBe("idle");
  });
  it("stops notifications on disposal and ignores pending completion without cancelling native work", async () => {
    const f = fixture();
    const pending = deferred<boolean>();
    f.set.mockReturnValue(pending.promise);
    const listener = vi.fn();
    const unsubscribe = f.controller.subscribe(listener);
    const operation = persist(f, "en");
    await Promise.resolve();
    expect(f.set).toHaveBeenCalledTimes(1);
    listener.mockClear();
    f.controller.dispose(); f.controller.dispose(); unsubscribe(); unsubscribe();
    pending.resolve(false);
    await operation;
    expect(listener).not.toHaveBeenCalled();
    expect(await persist(f, "ru")).toBe(false);
    expect(f.set).toHaveBeenCalledTimes(1);
  });
  it("contains a synchronous preference exception and a notification callback exception", async () => {
    const f = fixture();
    f.set.mockImplementation(() => { throw new Error("sync native failure"); });
    f.controller.subscribe(() => { throw new Error("subscriber failure"); });
    expect(await persist(f, "en")).toBe(false);
    expect(f.controller.getSnapshot()).toBe("failed");
  });
  it("keeps both locale dictionaries synchronized and explicitly unapproved", () => {
    expect(hostRuntimeCopy).toMatchObject({ source: "ai-draft", reviewStatus: "draft", releaseReady: false });
    expect(Object.keys(hostRuntimeCopy.locales.ru)).toEqual(Object.keys(hostRuntimeCopy.locales.en));
    expect(Object.values(hostRuntimeCopy.locales.en).every(value => !/[\u0400-\u052f]/u.test(value))).toBe(true);
  });
});
