type MetadataStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Keep per-tab autosave metadata usable when browser storage is unavailable. */
export function createEditorAutosaveMetadataStorage(resolveStorage: () => MetadataStorage): MetadataStorage {
  const metadata = new Map<string, string>();
  let persistentAvailable = true;
  return {
    getItem(key) {
      if (persistentAvailable) {
        try {
          const value = resolveStorage().getItem(key);
          if (value === null) metadata.delete(key);
          else metadata.set(key, value);
          return value;
        } catch {
          persistentAvailable = false;
        }
      }
      return metadata.get(key) ?? null;
    },
    setItem(key, value) {
      metadata.set(key, value);
      if (!persistentAvailable) return;
      try {
        resolveStorage().setItem(key, value);
      } catch {
        persistentAvailable = false;
      }
    },
    removeItem(key) {
      metadata.delete(key);
      if (!persistentAvailable) return;
      try {
        resolveStorage().removeItem(key);
      } catch {
        persistentAvailable = false;
      }
    },
  };
}
