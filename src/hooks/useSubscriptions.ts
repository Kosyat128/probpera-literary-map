import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "../community/AuthContext";
import { readerPrivacy } from "../community/readerPrivacy";
import { supabase } from "../lib/supabase";
import { strictWebStorage } from "../utils/safeWebStorage";
import { createReaderSubscriptionsController, readerSubscriptionsStorageKey, type ReaderSubscription } from "./readerSubscriptions";
export type { ReaderSubscription } from "./readerSubscriptions";
const eventName = "probpera:reader-subscriptions";
type Controller = ReturnType<typeof createReaderSubscriptionsController>;
const shared = new WeakMap<Window, Map<string, Controller>>();
function controllerFor(userId: string | null, configured: boolean): Controller {
  const key = readerSubscriptionsStorageKey(userId), client = userId && configured ? supabase : null;
  const cacheKey = `${client ? "remote" : "local"}:${key}`;
  let cache = typeof window === "undefined" ? undefined : shared.get(window);
  if (typeof window !== "undefined" && !cache) { cache = new Map(); shared.set(window, cache); }
  const existing = cache?.get(cacheKey); if (existing) return existing;
  const source = {};
  let storage: Pick<Storage, "getItem" | "setItem"> | null = null;
  try { storage = strictWebStorage("local"); } catch { /* Session controller remains available. */ }
  const controller = createReaderSubscriptionsController({
    storage: {
      read: () => { if (!storage) throw new Error("Subscription persistence unavailable"); return storage.getItem(key); },
      write(value) {
        if (!storage) throw new Error("Subscription persistence unavailable"); storage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent(eventName, { detail: { key, source } }));
      },
    },
    isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
    listen(external, online) {
      if (typeof window === "undefined") return () => {};
      const changed = (event: Event) => {
        const detail = (event as CustomEvent<{ key?: string; source?: unknown }>).detail;
        if (detail?.key === key && detail.source !== source) external();
      };
      const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) external(); };
      window.addEventListener(eventName, changed); window.addEventListener("storage", storage); window.addEventListener("online", online);
      return () => { window.removeEventListener(eventName, changed); window.removeEventListener("storage", storage); window.removeEventListener("online", online); };
    },
    remote: client && userId ? {
      read: async signal => {
        const result = await client.from("reader_subscriptions").select("subject_type,subject_id,label,created_at")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(100).abortSignal(signal);
        return { error: result.error, data: result.data?.map(item => ({ type: item.subject_type, id: item.subject_id, label: item.label, createdAt: item.created_at })) };
      },
      save: (item, signal) => client.from("reader_subscriptions").upsert({ user_id: userId, subject_type: item.type,
        subject_id: item.id, label: item.label, created_at: item.createdAt }, { onConflict: "user_id,subject_type,subject_id" }).abortSignal(signal),
      remove: (type, id, signal) => client.from("reader_subscriptions").delete().eq("user_id", userId)
        .eq("subject_type", type).eq("subject_id", id).abortSignal(signal),
    } : null,
  });
  cache?.set(cacheKey, controller);
  if (userId) readerPrivacy.register(userId, () => { controller.forget(); if (cache?.get(cacheKey) === controller) cache.delete(cacheKey); });
  return controller;
}
export function useSubscriptions() {
  const { configured, user } = useAuth(), userId = user?.id ?? null;
  const current = useRef<Controller>();
  const controller = useMemo(() => controllerFor(userId, configured), [userId, configured]);
  useLayoutEffect(() => { current.current = controller; return () => { if (current.current === controller) current.current = undefined; }; }, [controller]);
  const items = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => controller.activate(() => current.current === controller), [controller]);
  const actions = useMemo(() => ({
    toggle: (item: Omit<ReaderSubscription, "createdAt">) => { if (current.current === controller) controller.toggle(item); },
    retrySync: () => current.current === controller ? controller.retry() : Promise.resolve(),
  }), [controller]);
  return { items, ...actions, isSubscribed: (type: ReaderSubscription["type"], id: string) => items.some(item => item.type === type && item.id === id) };
}
