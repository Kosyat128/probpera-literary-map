import { useCallback, useEffect, useState } from "react";

export type SavedReading = {
  id: string;
  title: string;
  sectionId?: string;
  sectionLabel: string;
  addedAt: string;
};

const STORAGE_KEY = "probpera-reading-library";
const EVENT_NAME = "probpera:reading-library";

function readItems(): SavedReading[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SavedReading =>
            Boolean(item?.id && item?.title && item?.addedAt)
        )
      : [];
  } catch {
    return [];
  }
}

function saveItems(items: SavedReading[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent<SavedReading[]>(EVENT_NAME, { detail: items })
  );
}

export function useReadingLibrary() {
  const [items, setItems] = useState<SavedReading[]>(readItems);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<SavedReading[]>).detail;
      setItems(Array.isArray(detail) ? detail : readItems());
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setItems(readItems());
    };
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const toggle = useCallback((item: Omit<SavedReading, "addedAt">) => {
    setItems((current) => {
      const exists = current.some((saved) => saved.id === item.id);
      const next = exists
        ? current.filter((saved) => saved.id !== item.id)
        : [
            {
              ...item,
              addedAt: new Date().toISOString(),
            },
            ...current,
          ].slice(0, 100);
      saveItems(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      saveItems(next);
      return next;
    });
  }, []);

  return { items, toggle, remove };
}
