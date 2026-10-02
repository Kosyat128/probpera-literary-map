import { describe, expect, it, vi } from "vitest";
import { createNativeSecureStorage, createNativeSessionStorage, NATIVE_SECRET_MAX_BYTES,
  NativeSecureStorageError, type NativeSecretStore, type NativeSecureStoreBridge } from "./nativeSecureStorage";

// All values are synthetic. These tests do not exercise Keychain/Keystore.
const ref = "syntheticprojectref1", sdkKey = `sb-${ref}-auth-token`, key = `auth-session-v1:${ref}`;
const sample = "synthetic-session-value";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const bytes = new Map<string, string>(), calls: string[] = [];
  const bridge: NativeSecureStoreBridge = {
    get: vi.fn(async input => { calls.push("get:" + input.key); return { value: bytes.get(input.key) ?? null }; }),
    set: vi.fn(async input => { calls.push("set:" + input.key); bytes.set(input.key, input.value); return { stored: true }; }),
    remove: vi.fn(async input => { calls.push("remove:" + input.key); bytes.delete(input.key); return { removed: true }; }),
  };
  return { bytes, calls, bridge, store: createNativeSecureStorage(bridge) };
}
function legacyFixture() {
  const bytes = new Map<string, string>([[sdkKey, sample]]);
  return { bytes, port: { getItem: vi.fn(async (name: string) => bytes.get(name) ?? null),
    compareAndRemove: vi.fn(async (name: string, expected: string) => {
      if (bytes.get(name) !== expected) return false; bytes.delete(name); return true;
    }) } };
}

describe("separate native OS secret bridge", () => {
  it("constructs without IO and requires exact read-back for write and removal", async () => {
    const f = fixture(); expect(f.calls).toEqual([]);
    expect(await f.store.get(key)).toBeNull();
    expect(await f.store.set(key, sample)).toBe(true);
    expect(await f.store.get(key)).toBe(sample);
    expect(await f.store.remove(key)).toBe(true);
    expect(await f.store.get(key)).toBeNull();
    expect(f.calls).toEqual([`get:${key}`, `set:${key}`, `get:${key}`, `get:${key}`, `remove:${key}`, `get:${key}`, `get:${key}`]);
  });
  it("has no Preferences/browser fallback when the plugin is absent", async () => {
    const store = createNativeSecureStorage(null);
    await expect(store.get(key)).rejects.toBeInstanceOf(NativeSecureStorageError);
    await expect(store.set(key, sample)).rejects.toBeInstanceOf(NativeSecureStorageError);
    await expect(store.remove(key)).rejects.toBeInstanceOf(NativeSecureStorageError);
  });
  it.each(["probpera-interface-language", "refresh_token", "auth-session-v1:../other", "auth-session-v1:short", "secure-runtime-v1:" + "a".repeat(32)])
    ("denies unsupported key %s before native IO", async bad => {
      const f = fixture();
      await expect(f.store.get(bad)).rejects.toThrow("native-secure-storage-unavailable");
      await expect(f.store.set(bad, sample)).rejects.toThrow("native-secure-storage-unavailable");
      await expect(f.store.remove(bad)).rejects.toThrow("native-secure-storage-unavailable");
      expect(f.calls).toEqual([]);
    });
  it("bounds encoded secret bytes without logging or coercion", async () => {
    const f = fixture();
    for (const value of ["", "x".repeat(NATIVE_SECRET_MAX_BYTES + 1), "я".repeat(NATIVE_SECRET_MAX_BYTES), true as unknown as string])
      await expect(f.store.set(key, value)).rejects.toThrow("native-secure-storage-unavailable");
    expect(f.calls).toEqual([]);
  });
  it("rejects malformed/accessor responses without invoking getters", async () => {
    for (const result of [true, {}, { value: 42 }, { value: null, approved: true }, Object.create({ value: null })]) {
      const f = fixture(); vi.mocked(f.bridge.get).mockResolvedValueOnce(result);
      await expect(f.store.get(key)).rejects.toThrow("native-secure-storage-unavailable");
    }
    const f = fixture(), getter = vi.fn(() => sample);
    vi.mocked(f.bridge.get).mockResolvedValueOnce(Object.defineProperty({}, "value", { enumerable: true, get: getter }));
    await expect(f.store.get(key)).rejects.toThrow("native-secure-storage-unavailable"); expect(getter).not.toHaveBeenCalled();
  });
  it("sanitizes native failures and refuses mismatched acknowledgements/read-back", async () => {
    const f = fixture(); vi.mocked(f.bridge.get).mockRejectedValueOnce(new Error("synthetic-private-detail"));
    await expect(f.store.get(key)).rejects.toThrow(/^native-secure-storage-unavailable$/u);
    vi.mocked(f.bridge.set).mockResolvedValueOnce({ stored: true });
    await expect(f.store.set(key, sample)).rejects.toThrow("native-secure-storage-unavailable");
    f.bytes.set(key, sample); vi.mocked(f.bridge.remove).mockResolvedValueOnce({ removed: true });
    await expect(f.store.remove(key)).rejects.toThrow("native-secure-storage-unavailable");
  });
  it("keeps same-key operations ordered across a timed-out write and observes late completion", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture(), delayed = deferred<unknown>();
      vi.mocked(f.bridge.set).mockImplementationOnce(async input => { await delayed.promise; f.bytes.set(input.key, input.value); return { stored: true }; });
      const store = createNativeSecureStorage(f.bridge, 50), write = store.set(key, sample);
      const failed = expect(write).rejects.toThrow("native-secure-storage-unavailable");
      await vi.advanceTimersByTimeAsync(50); await failed;
      const removal = store.remove(key); delayed.resolve(undefined);
      expect(await removal).toBe(true); expect(f.bytes.has(key)).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("captures native methods once rather than accepting a later fallback", async () => {
    const f = fixture(); f.bridge.get = vi.fn(async () => ({ value: "replacement" }));
    expect(await f.store.get(key)).toBeNull(); expect(f.bridge.get).not.toHaveBeenCalled();
  });
});

describe("native SDK session seam and explicit migration", () => {
  it("supports only this project's session/PKCE/private-user keys", async () => {
    const f = fixture(), session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey });
    for (const name of [sdkKey, `${sdkKey}-code-verifier`, `${sdkKey}-user`]) {
      await session.setItem(name, sample); expect(await session.getItem(name)).toBe(sample); await session.removeItem(name);
    }
    await expect(session.getItem("sb-anotherprojectref0000-auth-token")).rejects.toThrow("native-secure-storage-unavailable");
    await expect(session.setItem("probpera-interface-language", sample)).rejects.toThrow("native-secure-storage-unavailable");
    expect([...f.bytes]).toEqual([]);
  });
  it("does not enable Auth or invent a migration source", async () => {
    const f = fixture(), session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey });
    expect(f.calls).toEqual([]); expect(await session.migrateLegacy()).toBe("not-needed"); expect(f.calls).toEqual([]);
    expect(() => createNativeSessionStorage({ secureStorage: f.store, storageKey: "any-key" })).toThrow(NativeSecureStorageError);
  });
  it("migrates once with secure read-back before compare-removing exact old bytes", async () => {
    const f = fixture(), legacy = legacyFixture(), observed = vi.fn(async (name: string, expected: string) => {
      expect(f.bytes.get(key)).toBe(expected); expect(f.calls.slice(-1)).toEqual([`get:${key}`]);
      return legacy.port.compareAndRemove(name, expected);
    });
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: { ...legacy.port, compareAndRemove: observed } });
    expect(await session.migrateLegacy()).toBe("migrated"); expect(legacy.bytes.size).toBe(0);
    expect(await session.migrateLegacy()).toBe("not-needed"); expect(observed).toHaveBeenCalledTimes(1);
    expect(await session.getItem(sdkKey)).toBe(sample);
  });
  it("preserves the old copy on write/read-back failure", async () => {
    const f = fixture(), legacy = legacyFixture(); vi.mocked(f.bridge.set).mockRejectedValueOnce(new Error("synthetic-denied"));
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port });
    await expect(session.migrateLegacy()).rejects.toThrow(NativeSecureStorageError);
    expect(legacy.bytes.get(sdkKey)).toBe(sample); expect(legacy.port.compareAndRemove).not.toHaveBeenCalled();
  });
  it("resumes safely after an interruption following the secure commit", async () => {
    const f = fixture(), legacy = legacyFixture();
    legacy.port.compareAndRemove.mockRejectedValueOnce(new Error("synthetic-process-interruption"));
    const first = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port });
    await expect(first.migrateLegacy()).rejects.toThrow(NativeSecureStorageError);
    expect(f.bytes.get(key)).toBe(sample); expect(legacy.bytes.get(sdkKey)).toBe(sample);
    const writes = f.calls.filter(call => call.startsWith("set:")).length;
    const restarted = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port });
    expect(await restarted.migrateLegacy()).toBe("migrated"); expect(legacy.bytes.size).toBe(0);
    expect(f.calls.filter(call => call.startsWith("set:"))).toHaveLength(writes);
  });
  it("does not overwrite a conflicting secure session or remove a changed legacy value", async () => {
    const f = fixture(), legacy = legacyFixture(); f.bytes.set(key, "synthetic-other-session");
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port });
    await expect(session.migrateLegacy()).rejects.toThrow(NativeSecureStorageError);
    expect(f.bytes.get(key)).toBe("synthetic-other-session"); expect(legacy.bytes.get(sdkKey)).toBe(sample);
    f.bytes.delete(key); legacy.port.compareAndRemove.mockImplementationOnce(async () => { legacy.bytes.set(sdkKey, "synthetic-changed"); return false; });
    await expect(session.migrateLegacy()).rejects.toThrow(NativeSecureStorageError);
    expect(legacy.bytes.get(sdkKey)).toBe("synthetic-changed");
  });
  it("cancels migration after secure commit without deleting the old copy", async () => {
    const f = fixture(), legacy = legacyFixture(), abort = new AbortController();
    const store: NativeSecretStore = { ...f.store, async set(name, value) { const result = await f.store.set(name, value); abort.abort(); return result; } };
    const session = createNativeSessionStorage({ secureStorage: store, storageKey: sdkKey, legacy: legacy.port });
    await expect(session.migrateLegacy(abort.signal)).rejects.toThrow(NativeSecureStorageError);
    expect(f.bytes.get(key)).toBe(sample); expect(legacy.bytes.get(sdkKey)).toBe(sample);
    expect(legacy.port.compareAndRemove).not.toHaveBeenCalled();
  });
  it.each(["read", "compare-remove"])("bounds a hung legacy %s and retains the verified-copy rule", async phase => {
    vi.useFakeTimers();
    try {
      const f = fixture(), legacy = legacyFixture(), delayed = deferred<string | null>(), removal = deferred<boolean>();
      if (phase === "read") legacy.port.getItem.mockReturnValueOnce(delayed.promise);
      else legacy.port.compareAndRemove.mockReturnValueOnce(removal.promise);
      const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port, legacyTimeoutMs: 50 });
      const migration = session.migrateLegacy(), rejected = expect(migration).rejects.toThrow(NativeSecureStorageError);
      await vi.advanceTimersByTimeAsync(50); await rejected;
      expect(legacy.bytes.get(sdkKey)).toBe(sample);
      expect(f.bytes.get(key)).toBe(phase === "read" ? undefined : sample);
      delayed.resolve(sample); removal.resolve(false); await vi.advanceTimersByTimeAsync(0);
      expect(legacy.bytes.get(sdkKey)).toBe(sample);
      expect(await session.getItem(sdkKey)).toBe(phase === "read" ? null : sample);
    } finally { vi.useRealTimers(); }
  });
  it("aborts a hung legacy read promptly without dispatching secure writes", async () => {
    const f = fixture(), legacy = legacyFixture(), delayed = deferred<string | null>(), abort = new AbortController();
    legacy.port.getItem.mockReturnValueOnce(delayed.promise);
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port });
    const migration = session.migrateLegacy(abort.signal), rejected = expect(migration).rejects.toThrow(NativeSecureStorageError);
    await Promise.resolve(); await Promise.resolve(); abort.abort(); await rejected;
    delayed.resolve(sample); await Promise.resolve(); expect(f.calls).toEqual([]);
    expect(legacy.port.compareAndRemove).not.toHaveBeenCalled();
  });
  it.each(["read", "compare-remove"])("settles failed logout after hung legacy %s while clearing every native slot", async phase => {
    vi.useFakeTimers();
    try {
      const f = fixture(), legacy = legacyFixture(), delayed = deferred<string | null>(), removal = deferred<boolean>();
      if (phase === "read") legacy.port.getItem.mockImplementation(() => delayed.promise);
      else legacy.port.compareAndRemove.mockReturnValueOnce(removal.promise);
      const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port, legacyTimeoutMs: 50 });
      const clearing = session.clear(), rejected = expect(clearing).rejects.toThrow(NativeSecureStorageError);
      await vi.advanceTimersByTimeAsync(150); await rejected;
      expect(f.calls.filter(call => call.startsWith("remove:"))).toHaveLength(3);
      expect(legacy.port.getItem).toHaveBeenCalledTimes(3);
      expect(legacy.port.compareAndRemove).toHaveBeenCalledTimes(phase === "read" ? 0 : 1);
      delayed.resolve(sample); removal.resolve(false); await vi.advanceTimersByTimeAsync(0);
      await expect(session.getItem(sdkKey)).rejects.toThrow(NativeSecureStorageError);
    } finally { vi.useRealTimers(); }
  });
  it("seals logout before a pending write completes and clears every private project slot", async () => {
    const f = fixture(), legacy = legacyFixture(), delayed = deferred<unknown>();
    vi.mocked(f.bridge.set).mockImplementationOnce(async input => { await delayed.promise; f.bytes.set(input.key, input.value); return { stored: true }; });
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey, legacy: legacy.port });
    const write = session.setItem(sdkKey, sample); const rejected = expect(write).rejects.toThrow(NativeSecureStorageError);
    await Promise.resolve(); await Promise.resolve();
    const clearing = session.clear(); delayed.resolve(undefined);
    await rejected; await clearing;
    expect(f.bytes.size).toBe(0); expect(legacy.bytes.size).toBe(0);
    await expect(session.setItem(sdkKey, "synthetic-late-refresh")).rejects.toThrow(NativeSecureStorageError);
    const newSession = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey });
    expect(await newSession.getItem(sdkKey)).toBeNull();
  });
  it("fails logout truthfully while attempting all remaining private keys", async () => {
    const f = fixture(); vi.mocked(f.bridge.remove).mockRejectedValueOnce(new Error("synthetic-remove-denied"));
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey });
    await expect(session.clear()).rejects.toThrow(NativeSecureStorageError);
    expect(f.bridge.remove).toHaveBeenCalledTimes(3);
    await expect(session.getItem(sdkKey)).rejects.toThrow(NativeSecureStorageError);
  });
  it("disposal fences late reads without claiming disk removal", async () => {
    const f = fixture(), delayed = deferred<unknown>(); vi.mocked(f.bridge.get).mockReturnValueOnce(delayed.promise);
    const session = createNativeSessionStorage({ secureStorage: f.store, storageKey: sdkKey });
    const reading = session.getItem(sdkKey), rejected = expect(reading).rejects.toThrow(NativeSecureStorageError);
    await Promise.resolve(); await Promise.resolve(); session.dispose(); delayed.resolve({ value: sample });
    await rejected; expect(f.calls.some(call => call.startsWith("remove:"))).toBe(false);
  });
});
