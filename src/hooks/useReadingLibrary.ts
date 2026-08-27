import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";

export type SavedReading = {
  id: string;
  kind: "article" | "book";
  title: string;
  sectionId?: string;
  sectionLabel: string;
  href?: string;
  addedAt: string;
  status: ReadingStatus;
};

export type ReadingStatus = "saved" | "reading" | "finished";

const STORAGE_KEY = "probpera-reading-library";
const EVENT_NAME = "probpera:reading-library";

function readItems(): SavedReading[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(readWebStorage("local", STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is Omit<SavedReading, "kind"> & {
            kind?: SavedReading["kind"];
          } =>
            Boolean(item?.id && item?.title && item?.addedAt)
        ).map((item) => ({
          ...item,
          kind: item.kind === "book" ? "book" : "article",
          status:
            item.status === "reading" || item.status === "finished"
              ? item.status
              : "saved",
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
  writeWebStorage("local", STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent<SavedReading[]>(EVENT_NAME, { detail: items })
  );
}

export function useReadingLibrary() {
  const { configured, user } = useAuth();
  const [items, setItems] = useState<SavedReading[]>(readItems);
  const itemsRef = useRef(items);
  const mutationSequenceRef = useRef(0);
  const latestMutationByItemRef = useRef(new Map<string, number>());
  const publishItems = useCallback((next: SavedReading[]) => {
    itemsRef.current = next;
    saveItems(next);
    setItems(next);
  }, []);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<SavedReading[]>).detail;
      const next = Array.isArray(detail) ? detail : readItems();
      itemsRef.current = next;
      setItems(next);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readItems();
      itemsRef.current = next;
      setItems(next);
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
        "item_type,item_id,title,section_id,section_label,href,added_at,reading_status"
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
            status:
              item.reading_status === "reading" ||
              item.reading_status === "finished"
                ? item.reading_status
                : "saved",
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
        publishItems(next);

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
            reading_status: item.status,
          })),
          { onConflict: "user_id,item_type,item_id" }
        );
      });

    return () => {
      active = false;
    };
  }, [configured, publishItems, user]);

  const toggle = useCallback((item: Omit<SavedReading, "addedAt" | "status">) => {
    setItems((current) => {
      const key = itemKey(item);
      const exists = current.some((saved) => itemKey(saved) === key);
      const next = exists
        ? current.filter((saved) => itemKey(saved) !== key)
        : [
            {
              ...item,
              addedAt: new Date().toISOString(),
              status: "saved" as const,
            },
            ...current,
          ].slice(0, 200);
      saveItems(next);
      itemsRef.current = next;

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
                reading_status: saved.status,
              },
              { onConflict: "user_id,item_type,item_id" }
            );
          }
        }
      }
      return next;
    });
  }, [configured, user]);

  const save = useCallback(async (
    item: Omit<SavedReading, "addedAt" | "status">,
    status: ReadingStatus = "saved",
  ) => {
    const key = itemKey(item);
    const current = itemsRef.current;
    const previous = current.find((saved) => itemKey(saved) === key);
    const saved: SavedReading = {
      ...item,
      addedAt: previous?.addedAt || new Date().toISOString(),
      status,
    };
    const next = [
      saved,
      ...current.filter((entry) => itemKey(entry) !== key),
    ].slice(0, 200);
    const mutationId = ++mutationSequenceRef.current;
    latestMutationByItemRef.current.set(key, mutationId);
    publishItems(next);

    if (!configured || !supabase || !user) return true;
    let remoteError: unknown = null;
    try {
      const { error } = await supabase.from("reader_favorites").upsert(
        {
          user_id: user.id,
          item_type: saved.kind,
          item_id: saved.id,
          title: saved.title,
          section_id: saved.sectionId || null,
          section_label: saved.sectionLabel,
          href: saved.href || null,
          added_at: saved.addedAt,
          reading_status: saved.status,
        },
        { onConflict: "user_id,item_type,item_id" }
      );
      remoteError = error;
    } catch (reason) {
      remoteError = reason;
    }
    if (!remoteError) return true;
    if (latestMutationByItemRef.current.get(key) !== mutationId) return true;
    const latest = itemsRef.current.filter((entry) => itemKey(entry) !== key);
    publishItems(previous ? [previous, ...latest].slice(0, 200) : latest);
    return false;
  }, [configured, publishItems, user]);

  const setStatus = useCallback(
    (id: string, kind: SavedReading["kind"], status: ReadingStatus) => {
      setItems((current) => {
        const next = current.map((item) =>
          item.id === id && item.kind === kind ? { ...item, status } : item
        );
        saveItems(next);
        itemsRef.current = next;

        if (configured && supabase && user) {
          void supabase
            .from("reader_favorites")
            .update({ reading_status: status })
            .eq("user_id", user.id)
            .eq("item_type", kind)
            .eq("item_id", id);
        }
        return next;
      });
    },
    [configured, user]
  );

  const remove = useCallback(async (
    id: string,
    kind: SavedReading["kind"] = "article",
  ) => {
    const key = itemKey({ id, kind });
    const current = itemsRef.current;
    const previous = current.find((item) => itemKey(item) === key);
    if (!previous) return true;
    const next = current.filter((item) => itemKey(item) !== key);
    const mutationId = ++mutationSequenceRef.current;
    latestMutationByItemRef.current.set(key, mutationId);
    publishItems(next);

    if (!configured || !supabase || !user) return true;
    let remoteError: unknown = null;
    try {
      const { error } = await supabase
        .from("reader_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("item_type", kind)
        .eq("item_id", id);
      remoteError = error;
    } catch (reason) {
      remoteError = reason;
    }
    if (!remoteError) return true;
    if (latestMutationByItemRef.current.get(key) !== mutationId) return true;
    const latest = itemsRef.current.filter((item) => itemKey(item) !== key);
    publishItems([previous, ...latest].slice(0, 200));
    return false;
  }, [configured, publishItems, user]);

  return { items, toggle, save, remove, setStatus };
}
