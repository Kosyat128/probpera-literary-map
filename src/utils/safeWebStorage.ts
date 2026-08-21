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
      try {
        primary?.setItem(key, value);
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
