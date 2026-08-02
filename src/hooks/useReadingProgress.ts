import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";

type ReadingKind = "article" | "book";

type StoredProgress = {
  progress: number;
  positionHint?: string;
  updatedAt: string;
};

const STORAGE_KEY = "probpera-reading-progress";
const REMOTE_DEBOUNCE_MS = 5_000;

function storageKey(kind: ReadingKind, id: string) {
  return `${kind}:${id}`;
}

function readProgress(kind: ReadingKind, id: string): StoredProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const item = value?.[storageKey(kind, id)];
    if (!item || !Number.isFinite(item.progress)) return null;
    return {
      progress: Math.max(0, Math.min(100, Math.round(item.progress))),
      positionHint:
        typeof item.positionHint === "string" ? item.positionHint : undefined,
      updatedAt:
        typeof item.updatedAt === "string"
          ? item.updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function writeProgress(
  kind: ReadingKind,
  id: string,
  progress: number,
  positionHint?: string
) {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    value[storageKey(kind, id)] = {
      progress,
      positionHint: positionHint || undefined,
      updatedAt: new Date().toISOString(),
    } satisfies StoredProgress;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Reading must continue even when storage is unavailable or full.
  }
}

export function useReadingProgress(kind: ReadingKind, id: string) {
  const { configured, user } = useAuth();
  const [restoredProgress, setRestoredProgress] = useState<number | null>(() =>
    readProgress(kind, id)?.progress ?? null
  );
  const timerRef = useRef<number>();
  const pendingRef = useRef<{ progress: number; positionHint?: string } | null>(
    null
  );

  const persistRemote = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending || !configured || !supabase || !user) return;
    await supabase.from("reader_progress").upsert(
      {
        user_id: user.id,
        item_type: kind,
        item_id: id,
        progress_percent: pending.progress,
        position_hint: pending.positionHint || null,
        completed_at: pending.progress >= 96 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
  }, [configured, id, kind, user]);

  useEffect(() => {
    const local = readProgress(kind, id);
    setRestoredProgress(local?.progress ?? null);
    if (!configured || !supabase || !user) return;

    let active = true;
    void supabase
      .from("reader_progress")
      .select("progress_percent,position_hint,updated_at")
      .eq("user_id", user.id)
      .eq("item_type", kind)
      .eq("item_id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const remoteUpdated = Date.parse(data.updated_at || "") || 0;
        const localUpdated = Date.parse(local?.updatedAt || "") || 0;
        if (local && localUpdated > remoteUpdated) return;
        const next = Math.max(
          0,
          Math.min(100, Math.round(data.progress_percent || 0))
        );
        writeProgress(kind, id, next, data.position_hint || undefined);
        setRestoredProgress(next);
      });

    return () => {
      active = false;
    };
  }, [configured, id, kind, user]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (pendingRef.current) void persistRemote();
    },
    [persistRemote]
  );

  const saveProgress = useCallback(
    (rawProgress: number, positionHint?: string) => {
      const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
      writeProgress(kind, id, progress, positionHint);
      pendingRef.current = { progress, positionHint };
      if (!configured || !supabase || !user || timerRef.current) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        void persistRemote();
      }, REMOTE_DEBOUNCE_MS);
    },
    [configured, id, kind, persistRemote, user]
  );

  const markCompleted = useCallback(
    (positionHint?: string) => {
      setRestoredProgress(100);
      saveProgress(100, positionHint);
    },
    [saveProgress]
  );

  return { restoredProgress, saveProgress, markCompleted };
}
