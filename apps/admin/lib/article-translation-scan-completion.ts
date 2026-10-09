import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { isReadRecord } from "./admin-read-result";
import { decodeArticleTranslationResumeCursor } from "./article-translation-scan";
import type { TranslationErrorCode } from "./translation-errors";

type CompletionResult =
  | { outcome: "confirmed"; jobId: string }
  | { outcome: "failed"; errorCode: TranslationErrorCode };

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  }
  if (isReadRecord(left) && isReadRecord(right)) {
    const keys = Object.keys(left).sort();
    return keys.length === Object.keys(right).length &&
      keys.every(key => Object.hasOwn(right, key) && sameJson(left[key], right[key]));
  }
  return false;
}

export async function completeArticleTranslationScan(input: {
  supabase: SupabaseClient;
  jobId: string;
  expectedCursor: unknown;
}): Promise<CompletionResult> {
  const cursor = decodeArticleTranslationResumeCursor(input.expectedCursor);
  if (!z.string().uuid().safeParse(input.jobId).success || !isReadRecord(input.expectedCursor) ||
    cursor.kind !== "scan" || cursor.state.afterId === null || cursor.state.pendingIds.length !== 0 ||
    cursor.state.nextIndex !== 0 || cursor.state.lastWindow || cursor.state.exhausted) {
    return { outcome: "failed", errorCode: "translation_resume_stale" };
  }
  const desiredCursor = { ...input.expectedCursor,
    articleScan: { ...cursor.state, lastWindow: true, exhausted: true } };
  try {
    const response = await input.supabase.rpc("complete_article_translation_scan", {
      p_job_id: input.jobId,
      p_expected_cursor: input.expectedCursor,
    });
    unstable_rethrow(response.error);
    if (response.error) {
      const code = response.error.code;
      const errorCode: TranslationErrorCode = code === "42883" || code === "PGRST202"
        ? "translation_migration_required" : code === "40001" ? "write_conflict"
        : code === "42501" ? "translation_operation_stopped" : code === "22023"
        ? "translation_resume_stale" : code === "P0002" ? "database_read_failed"
        : "translation_scan_unconfirmed";
      return { outcome: "failed", errorCode };
    }
    const receipt = response.data;
    if (!isReadRecord(receipt) || typeof receipt.id !== "string" ||
      receipt.id.toLowerCase() !== input.jobId.toLowerCase() || receipt.kind !== "article" ||
      typeof receipt.status !== "string" || !["completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured"].includes(receipt.status) ||
      !sameJson(receipt.resumeCursor, desiredCursor)) {
      return { outcome: "failed", errorCode: "translation_scan_unconfirmed" };
    }
    return { outcome: "confirmed", jobId: receipt.id };
  } catch (error) {
    unstable_rethrow(error);
    return { outcome: "failed", errorCode: "translation_scan_unconfirmed" };
  }
}
