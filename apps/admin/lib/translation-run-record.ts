import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";

import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { translationErrorCode } from "./translation-errors";

export type TranslationRunState =
  | "translated"
  | "review-pending"
  | "current"
  | "manual"
  | "skipped"
  | "not-configured"
  | "conflict"
  | "stale"
  | "failed";

export type TranslationRunItem = {
  entityId: string;
  state: TranslationRunState;
  error?: string;
  model?: string;
  sourceHash?: string;
};

function durableOutcome(item: TranslationRunItem) {
  if (item.state === "translated") {
    return { status: "succeeded", ...(item.model ? { model: item.model } : {}) };
  }
  if (item.state === "conflict") {
    return { status: "conflict", errorCode: "write_conflict" };
  }
  if (item.state === "stale") {
    return { status: "stale", errorCode: "source_changed" };
  }
  if (item.state === "not-configured") {
    return {
      status: "not-configured",
      errorCode: "translation_not_configured",
    };
  }
  if (item.state === "failed") {
    return {
      status: "dead_letter",
      errorCode: translationErrorCode(item.error),
    };
  }
  return { status: "skipped" };
}

export async function recordTranslationSyncRun(input: {
  supabase: SupabaseClient;
  kind: "article" | "literary_work" | "writer" | "country" | "site_copy";
  items: readonly TranslationRunItem[];
  resumeCursor?: Record<string, unknown>;
}) {
  if (!input.items.length) return null;
  const runtime = premiumTranslationRuntimeMetadata();
  const response = await input.supabase.rpc("record_translation_sync_run", {
    p_kind: input.kind,
    p_provider: runtime.provider,
    p_items: input.items.map((item) => ({
      entityType: input.kind,
      entityId: item.entityId,
      ...(item.sourceHash ? { sourceHash: item.sourceHash } : {}),
    })),
    p_outcomes: input.items.map(durableOutcome),
    p_resume_cursor: input.resumeCursor || {},
  });
  unstable_rethrow(response.error);
  if (response.error || !z.string().uuid().safeParse(response.data).success) {
    throw new Error("translation run record failed");
  }
  return response.data;
}
