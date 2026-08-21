export type WebStorageArea = "local" | "session";

type StorageHost = Pick<Window, "localStorage" | "sessionStorage">;

function resolveStorage(
  area: WebStorageArea,
  host: StorageHost | null | undefined =
    typeof window === "undefined" ? null : window
): Storage | null {
  if (!host) return null;
  try {
    return area === "local" ? host.localStorage : host.sessionStorage;
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
