export type WebStorageArea = "local" | "session";

type StorageHost = Pick<Window, "localStorage" | "sessionStorage">;
type StorageProperty = keyof StorageHost;
type StoragePrototypeLike = {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};
type StorageMethodName =
  | "clear"
  | "getItem"
  | "key"
  | "removeItem"
  | "setItem";

const installationMarker = "__probperaSafeWebStorageInstalled__";
const storageProperties: Record<WebStorageArea, StorageProperty> = {
  local: "localStorage",
  session: "sessionStorage",
};

type StrictStoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const originalStorageMethods = new WeakMap<object, Partial<Record<StorageMethodName, unknown>>>();
const strictStoragePorts = new WeakMap<object, Partial<Record<WebStorageArea, StrictStoragePort | null>>>();

function captureStrictStoragePort(host: StorageHost, area: WebStorageArea): StrictStoragePort | null {
  let ports = strictStoragePorts.get(host);
  if (!ports) { ports = {}; strictStoragePorts.set(host, ports); }
  if (Object.prototype.hasOwnProperty.call(ports, area)) return ports[area] ?? null;
  try {
    const storage = host[storageProperties[area]];
    const original = (method: keyof StrictStoragePort) => {
      let owner: object | null = storage;
      while (owner) {
        if (Object.prototype.hasOwnProperty.call(owner, method)) {
          const candidate = originalStorageMethods.get(owner)?.[method] ?? Reflect.get(storage, method);
          if (typeof candidate !== "function") throw new Error("Storage method unavailable");
          return candidate;
        }
        owner = Object.getPrototypeOf(owner);
      }
      throw new Error("Storage method unavailable");
    };
    const get = original("getItem"), set = original("setItem"), remove = original("removeItem");
    const port: StrictStoragePort = Object.freeze({
      getItem: (key: string) => Reflect.apply(get, storage, [key]) as string | null,
      setItem: (key: string, value: string) => { Reflect.apply(set, storage, [key, value]); },
      removeItem: (key: string) => { Reflect.apply(remove, storage, [key]); },
    });
    ports[area] = port;
    return port;
  } catch { ports[area] = null; return null; }
}

/** Explicit capability for migrations that must distinguish failed IO from absence.
 * Capture occurs before our legacy facade/prototype patch, never through its
 * in-memory overlay. Existing resilient callers retain their original policy.
 */
export function strictWebStorage(
  area: WebStorageArea,
  host: StorageHost | null | undefined = typeof window === "undefined" ? null : window,
): StrictStoragePort {
  const port = host ? captureStrictStoragePort(host, area) : null;
  if (!port) throw new Error("Strict storage unavailable");
  return port;
}

function createResilientStorage(primary: Storage | null): Storage {
  const overlay = new Map<string, string>();
  const removed = new Set<string>();
  let hidePrimary = false;

  function primaryKeys() {
    if (!primary || hidePrimary) return [];
    try {
      return Array.from({ length: primary.length }, (_, index) => primary.key(index))
        .filter((key): key is string => Boolean(key))
        .filter((key) => !removed.has(key));
    } catch {
      return [];
    }
  }

  function visibleKeys() {
    return [...new Set([...primaryKeys(), ...overlay.keys()])];
  }

  return {
    get length() {
      return visibleKeys().length;
    },
    clear() {
      overlay.clear();
      removed.clear();
      hidePrimary = true;
      try {
        primary?.clear();
        hidePrimary = false;
      } catch {
        // The in-memory view remains empty even when persistent clear fails.
      }
    },
    getItem(key: string) {
      if (overlay.has(key)) return overlay.get(key) ?? null;
      if (hidePrimary || removed.has(key)) return null;
      try {
        return primary?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    key(index: number) {
      return visibleKeys()[index] ?? null;
    },
    removeItem(key: string) {
      overlay.delete(key);
      removed.add(key);
      try {
        primary?.removeItem(key);
      } catch {
        // The local tombstone keeps the value hidden for this page session.
      }
    },
    setItem(key: string, value: string) {
      removed.delete(key);
      if (!primary) {
        overlay.set(key, value);
        return;
      }
      try {
        primary.setItem(key, value);
        overlay.delete(key);
      } catch {
        // Preserve the current-page experience when persistence is blocked or
        // the browser quota is full.
        overlay.set(key, value);
      }
    },
  };
}

function patchStoragePrototype(
  prototype: StoragePrototypeLike | null | undefined
) {
  if (!prototype) return false;
  const markedPrototype = prototype as StoragePrototypeLike &
    Record<string, unknown>;
  if (markedPrototype[installationMarker] === true) return true;

  let patched = false;
  const methods: StorageMethodName[] = [
    "clear",
    "getItem",
    "key",
    "removeItem",
    "setItem",
  ];

  for (const method of methods) {
    const original = prototype[method] as unknown;
    if (typeof original !== "function") continue;
    let originals = originalStorageMethods.get(prototype);
    if (!originals) { originals = {}; originalStorageMethods.set(prototype, originals); }
    if (!Object.prototype.hasOwnProperty.call(originals, method)) originals[method] = original;
    try {
      Object.defineProperty(prototype, method, {
        configurable: true,
        writable: true,
        value: function safeStorageMethod(
          this: StoragePrototypeLike,
          ...args: unknown[]
        ) {
          try {
            return Reflect.apply(original, this, args);
          } catch {
            return method === "getItem" || method === "key" ? null : undefined;
          }
        },
      });
      patched = true;
    } catch {
      // Some embedded browsers expose non-configurable Storage methods. The
      // per-window facade below remains the fallback for those environments.
    }
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(prototype, "length");
  if (lengthDescriptor?.get) {
    try {
      Object.defineProperty(prototype, "length", {
        ...lengthDescriptor,
        get: function safeStorageLength(this: StoragePrototypeLike) {
          try {
            return Reflect.apply(lengthDescriptor.get!, this, []);
          } catch {
            return 0;
          }
        },
      });
      patched = true;
    } catch {
      // Non-configurable length is harmless for callers that use the helpers.
    }
  }

  try {
    Object.defineProperty(markedPrototype, installationMarker, {
      configurable: false,
      value: patched,
    });
  } catch {
    markedPrototype[installationMarker] = patched;
  }
  return patched;
}

function installStorageFacade(host: StorageHost, property: StorageProperty) {
  let primary: Storage | null = null;
  try {
    primary = host[property];
  } catch {
    // A strict privacy mode may throw while resolving the property itself.
  }

  try {
    Object.defineProperty(host, property, {
      configurable: true,
      enumerable: true,
      value: createResilientStorage(primary),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs a non-throwing compatibility layer for legacy direct storage calls.
 * New code should still use readWebStorage/writeWebStorage/removeWebStorage.
 */
export function installSafeWebStorage(
  host: StorageHost | null | undefined =
    typeof window === "undefined" ? null : window,
  prototype: StoragePrototypeLike | null | undefined =
    typeof Storage === "undefined"
      ? null
      : (Storage.prototype as unknown as StoragePrototypeLike)
) {
  if (!host) return false;
  for (const area of ["local", "session"] as const) captureStrictStoragePort(host, area);
  const prototypePatched = patchStoragePrototype(prototype);
  let ready = prototypePatched;

  for (const property of Object.values(storageProperties)) {
    try {
      const storage = host[property];
      storage.getItem("__probpera_storage_probe__");
      if (prototypePatched) {
        ready = true;
        continue;
      }
    } catch {
      // Fall through to an in-memory facade.
    }
    ready = installStorageFacade(host, property) || ready;
  }

  return ready;
}

function resolveStorage(
  area: WebStorageArea,
  host: StorageHost | null | undefined =
    typeof window === "undefined" ? null : window
): Storage | null {
  if (!host) return null;
  try {
    return host[storageProperties[area]];
  } catch {
    // Some privacy modes expose the property but throw a SecurityError when it
    // is accessed. Storage is optional enhancement; the interface must still
    // be able to start and remain usable.
    return null;
  }
}

export function readWebStorage(
  area: WebStorageArea,
  key: string,
  host?: StorageHost | null
): string | null {
  const storage = resolveStorage(area, host);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeWebStorage(
  area: WebStorageArea,
  key: string,
  value: string,
  host?: StorageHost | null
): boolean {
  const storage = resolveStorage(area, host);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // QuotaExceededError and SecurityError must never turn a preference,
    // reading list, or recovery draft into a fatal application error.
    return false;
  }
}

export function removeWebStorage(
  area: WebStorageArea,
  key: string,
  host?: StorageHost | null
): boolean {
  const storage = resolveStorage(area, host);
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
