import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";

export type ReaderSubscription = {
  type: "country" | "writer" | "section";
  id: string;
  label: string;
  createdAt: string;
};

const STORAGE_KEY = "probpera-reader-subscriptions";
const EVENT_NAME = "probpera:reader-subscriptions";

function keyOf(item: Pick<ReaderSubscription, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

function readItems(): ReaderSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(readWebStorage("local", STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is ReaderSubscription =>
            ["country", "writer", "section"].includes(item?.type) &&
            Boolean(item?.id && item?.label && item?.createdAt)
        )
      : [];
  } catch {
    return [];
  }
}

function writeItems(items: ReaderSubscription[]) {
  writeWebStorage("local", STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent<ReaderSubscription[]>(EVENT_NAME, { detail: items })
  );
}

export function useSubscriptions() {
  const { configured, user } = useAuth();
  const [items, setItems] = useState<ReaderSubscription[]>(readItems);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<ReaderSubscription[]>).detail;
      setItems(Array.isArray(detail) ? detail : readItems());
    };
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, []);

  useEffect(() => {
    if (!configured || !supabase || !user) return;
    let active = true;
    const client = supabase;
    void client
      .from("reader_subscriptions")
      .select("subject_type,subject_id,label,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (!active || error) return;
        const remote = (data || []).map(
          (item): ReaderSubscription => ({
            type: item.subject_type,
            id: item.subject_id,
            label: item.label,
            createdAt: item.created_at,
          })
        );
        const merged = new Map<string, ReaderSubscription>();
        [...remote, ...readItems()].forEach((item) =>
          merged.set(keyOf(item), item)
        );
        const next = [...merged.values()].slice(0, 100);
        writeItems(next);
        setItems(next);

        const remoteKeys = new Set(remote.map(keyOf));
        const localOnly = next.filter((item) => !remoteKeys.has(keyOf(item)));
        if (localOnly.length) {
          await client.from("reader_subscriptions").upsert(
            localOnly.map((item) => ({
              user_id: user.id,
              subject_type: item.type,
              subject_id: item.id,
              label: item.label,
              created_at: item.createdAt,
            })),
            { onConflict: "user_id,subject_type,subject_id" }
          );
        }
      });
    return () => {
      active = false;
    };
  }, [configured, user]);

  const toggle = useCallback(
    (item: Omit<ReaderSubscription, "createdAt">) => {
      setItems((current) => {
        const key = keyOf(item);
        const exists = current.some((entry) => keyOf(entry) === key);
        const next = exists
          ? current.filter((entry) => keyOf(entry) !== key)
          : [{ ...item, createdAt: new Date().toISOString() }, ...current].slice(
              0,
              100
            );
        writeItems(next);

        if (configured && supabase && user) {
          if (exists) {
            void supabase
              .from("reader_subscriptions")
              .delete()
              .eq("user_id", user.id)
              .eq("subject_type", item.type)
              .eq("subject_id", item.id);
          } else {
            const created = next.find((entry) => keyOf(entry) === key);
            if (created) {
              void supabase.from("reader_subscriptions").upsert(
                {
                  user_id: user.id,
                  subject_type: created.type,
                  subject_id: created.id,
                  label: created.label,
                  created_at: created.createdAt,
                },
                { onConflict: "user_id,subject_type,subject_id" }
              );
            }
          }
        }
        return next;
      });
    },
    [configured, user]
  );

  const isSubscribed = useCallback(
    (type: ReaderSubscription["type"], id: string) =>
      items.some((item) => item.type === type && item.id === id),
    [items]
  );

  return { items, toggle, isSubscribed };
}
