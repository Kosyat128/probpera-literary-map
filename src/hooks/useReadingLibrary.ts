import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";

export type SavedReading = {
  id: string;
  kind: "article" | "book";
  title: string;
  sectionId?: string;
  sectionLabel: string;
  href?: string;
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
          (item): item is Omit<SavedReading, "kind"> & {
            kind?: SavedReading["kind"];
          } =>
            Boolean(item?.id && item?.title && item?.addedAt)
        ).map((item) => ({
          ...item,
          kind: item.kind === "book" ? "book" : "article",
        }))
      : [];
  } catch {
    return [];
  }
}

function itemKey(item: Pick<SavedReading, "id" | "kind">) {
  return `${item.kind}:${item.id}`;
}

function saveItems(items: SavedReading[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent<SavedReading[]>(EVENT_NAME, { detail: items })
  );
}

export function useReadingLibrary() {
  const { configured, user } = useAuth();
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

  useEffect(() => {
    if (!configured || !supabase || !user) return;
    let active = true;
    const client = supabase;

    void client
      .from("reader_favorites")
      .select(
        "item_type,item_id,title,section_id,section_label,href,added_at"
      )
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (!active || error) return;

        const remoteItems = (data || []).map(
          (item): SavedReading => ({
            id: item.item_id,
            kind: item.item_type === "book" ? "book" : "article",
            title: item.title,
            sectionId: item.section_id || undefined,
            sectionLabel: item.section_label,
            href: item.href || undefined,
            addedAt: item.added_at,
          })
        );
        const merged = new Map<string, SavedReading>();
        [...readItems(), ...remoteItems]
          .sort(
            (first, second) =>
              Date.parse(second.addedAt) - Date.parse(first.addedAt)
          )
          .forEach((item) => {
            const key = itemKey(item);
            if (!merged.has(key)) merged.set(key, item);
          });
        const next = [...merged.values()].slice(0, 200);
        saveItems(next);
        setItems(next);

        const remoteKeys = new Set(remoteItems.map(itemKey));
        const localOnly = next.filter((item) => !remoteKeys.has(itemKey(item)));
        if (!localOnly.length) return;
        await client.from("reader_favorites").upsert(
          localOnly.map((item) => ({
            user_id: user.id,
            item_type: item.kind,
            item_id: item.id,
            title: item.title,
            section_id: item.sectionId || null,
            section_label: item.sectionLabel,
            href: item.href || null,
            added_at: item.addedAt,
          })),
          { onConflict: "user_id,item_type,item_id" }
        );
      });

    return () => {
      active = false;
    };
  }, [configured, user]);

  const toggle = useCallback((item: Omit<SavedReading, "addedAt">) => {
    setItems((current) => {
      const key = itemKey(item);
      const exists = current.some((saved) => itemKey(saved) === key);
      const next = exists
        ? current.filter((saved) => itemKey(saved) !== key)
        : [
            {
              ...item,
              addedAt: new Date().toISOString(),
            },
            ...current,
          ].slice(0, 200);
      saveItems(next);

      if (configured && supabase && user) {
        if (exists) {
          void supabase
            .from("reader_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("item_type", item.kind)
            .eq("item_id", item.id);
        } else {
          const saved = next.find((entry) => itemKey(entry) === key);
          if (saved) {
            void supabase.from("reader_favorites").upsert(
              {
                user_id: user.id,
                item_type: saved.kind,
                item_id: saved.id,
                title: saved.title,
                section_id: saved.sectionId || null,
                section_label: saved.sectionLabel,
                href: saved.href || null,
                added_at: saved.addedAt,
              },
              { onConflict: "user_id,item_type,item_id" }
            );
          }
        }
      }
      return next;
    });
  }, [configured, user]);

  const remove = useCallback((id: string, kind: SavedReading["kind"] = "article") => {
    setItems((current) => {
      const next = current.filter(
        (item) => !(item.id === id && item.kind === kind)
      );
      saveItems(next);

      if (configured && supabase && user) {
        void supabase
          .from("reader_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("item_type", kind)
          .eq("item_id", id);
      }
      return next;
    });
  }, [configured, user]);

  return { items, toggle, remove };
}
