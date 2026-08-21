import { describe, expect, it } from "vitest";

import {
  installSafeWebStorage,
  readWebStorage,
  removeWebStorage,
  writeWebStorage,
} from "./safeWebStorage";

function memoryStorage(options: {
  throwOnGet?: boolean;
  throwOnSet?: boolean;
  throwOnRemove?: boolean;
} = {}) {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      if (options.throwOnGet) throw new DOMException("blocked", "SecurityError");
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      if (options.throwOnRemove) {
        throw new DOMException("blocked", "SecurityError");
      }
      values.delete(key);
    },
    setItem(key: string, value: string) {
      if (options.throwOnSet) {
        throw new DOMException("full", "QuotaExceededError");
      }
      values.set(key, value);
    },
  } satisfies Storage;
  return storage;
}

function host(localStorage: Storage, sessionStorage: Storage = memoryStorage()) {
  return { localStorage, sessionStorage } as Pick<
    Window,
    "localStorage" | "sessionStorage"
  >;
}

function throwingStoragePrototype() {
  const prototype = {} as Storage;
  Object.defineProperties(prototype, {
    length: {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
    clear: {
      configurable: true,
      writable: true,
      value() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
    getItem: {
      configurable: true,
      writable: true,
      value() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
    key: {
      configurable: true,
      writable: true,
      value() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
    removeItem: {
      configurable: true,
      writable: true,
      value() {
        throw new DOMException("blocked", "SecurityError");
      },
    },
    setItem: {
      configurable: true,
      writable: true,
      value() {
        throw new DOMException("full", "QuotaExceededError");
      },
    },
  });
  return prototype;
}

describe("safe web storage", () => {
  it("reads, writes, and removes values when storage works", () => {
    const storageHost = host(memoryStorage());

    expect(writeWebStorage("local", "theme", "book", storageHost)).toBe(true);
    expect(readWebStorage("local", "theme", storageHost)).toBe("book");
    expect(removeWebStorage("local", "theme", storageHost)).toBe(true);
    expect(readWebStorage("local", "theme", storageHost)).toBeNull();
  });

  it("survives a host whose storage property throws", () => {
    const storageHost = Object.defineProperties({}, {
      localStorage: {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      },
      sessionStorage: { value: memoryStorage() },
    }) as Pick<Window, "localStorage" | "sessionStorage">;

    expect(() => readWebStorage("local", "key", storageHost)).not.toThrow();
    expect(readWebStorage("local", "key", storageHost)).toBeNull();
    expect(writeWebStorage("local", "key", "value", storageHost)).toBe(false);
    expect(removeWebStorage("local", "key", storageHost)).toBe(false);
  });

  it("survives storage method and quota failures", () => {
    expect(
      readWebStorage("local", "key", host(memoryStorage({ throwOnGet: true })))
    ).toBeNull();
    expect(
      writeWebStorage(
        "local",
        "key",
        "value",
        host(memoryStorage({ throwOnSet: true }))
      )
    ).toBe(false);
    expect(
      removeWebStorage(
        "local",
        "key",
        host(memoryStorage({ throwOnRemove: true }))
      )
    ).toBe(false);
  });

  it("returns neutral values without a browser host", () => {
    expect(readWebStorage("local", "key", null)).toBeNull();
    expect(writeWebStorage("session", "key", "value", null)).toBe(false);
    expect(removeWebStorage("session", "key", null)).toBe(false);
  });

  it("makes legacy direct Storage calls non-throwing", () => {
    const prototype = throwingStoragePrototype();
    const storageHost = host(
      Object.create(prototype) as Storage,
      Object.create(prototype) as Storage
    );

    expect(installSafeWebStorage(storageHost, prototype)).toBe(true);
    expect(storageHost.localStorage.getItem("draft")).toBeNull();
    expect(storageHost.localStorage.key(0)).toBeNull();
    expect(storageHost.localStorage.length).toBe(0);
    expect(() => storageHost.localStorage.setItem("draft", "text")).not.toThrow();
    expect(() => storageHost.localStorage.removeItem("draft")).not.toThrow();
    expect(() => storageHost.localStorage.clear()).not.toThrow();
    expect(installSafeWebStorage(storageHost, prototype)).toBe(true);
  });

  it("replaces an inaccessible storage property with an in-memory session view", () => {
    const storageHost = Object.defineProperties({}, {
      localStorage: {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      },
      sessionStorage: {
        configurable: true,
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      },
    }) as Pick<Window, "localStorage" | "sessionStorage">;

    expect(installSafeWebStorage(storageHost, null)).toBe(true);
    storageHost.localStorage.setItem("draft", "saved in memory");
    expect(storageHost.localStorage.getItem("draft")).toBe("saved in memory");
    storageHost.localStorage.removeItem("draft");
    expect(storageHost.localStorage.getItem("draft")).toBeNull();
  });

  it("keeps failed quota writes readable during the current page session", () => {
    const storageHost = host(memoryStorage({ throwOnSet: true }));

    expect(installSafeWebStorage(storageHost, null)).toBe(true);
    storageHost.localStorage.setItem("page-draft", "recovery copy");
    expect(storageHost.localStorage.getItem("page-draft")).toBe("recovery copy");
  });
});
