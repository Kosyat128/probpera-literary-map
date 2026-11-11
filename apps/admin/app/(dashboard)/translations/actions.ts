"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { runLibraryTranslationScan, libraryTranslationScanOrdinal } from "@/lib/library-translation-scan";
import { runProfileTranslationScan } from "@/lib/profile-translation-scan";
import { profileTranslationScanOrdinal } from "@/lib/profile-translation-scan-rpc";
import { ensureSiteCopyEnglishTranslation } from "@/lib/auto-translate-site-copy-private";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { translationBackfillCursorParams } from "@/lib/translation-backfill-cursor";
import { translationErrorCode } from "@/lib/translation-errors";
import { translationOperationBudgetNotice } from "@/lib/translation-operation-budget-notice";
import { recordTranslationSyncRun } from "@/lib/translation-run-record";

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";

function translationsUrl(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) {
      params.set(key, String(value));
    }
  }
  return `/translations${params.size ? `?${params}` : ""}`;
}

export async function translatePremiumLibraryBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(translationsUrl({ ...cursorParams, errorCode: "database_unavailable" }));
  const result = await runLibraryTranslationScan({ supabase, actorId: session.user.id,
    scanIntent: String(formData.get("libraryScanIntent") || "").trim() || null,
    jobId: String(formData.get("libraryJob") || "").trim() || null,
    legacyCursor: String(formData.get("libraryCursor") ?? "0") });
  revalidatePath("/translations");
  revalidatePath("/library");
  redirect(translationsUrl({ ...cursorParams,
    libraryJob: result.recoveryJobId,
    libraryCursor: result.receipt ? libraryTranslationScanOrdinal(result.receipt) : cursorParams.libraryCursor,
    errorCode: result.errorCode,
    success: result.receipt === null && result.processed === 0 ? null :
      (result.errorCode && result.errorCode !== "translation_scan_complete" ? "Пакет книг приостановлен. Подтверждённые итоги: " : "Книги: ") +
      `подтверждённо просмотрено ${result.processed}, подтверждённых машинных черновиков ${result.translated}, ожидают проверки ${result.reviewPending}, устаревших ${result.stale}, актуальных ${result.current}, ручных ${result.manual}, пропущено ${result.skipped}, ошибок ${result.failed}. Машинные черновики не опубликованы.` +
      (result.receipt?.exhausted && result.receipt.status !== "cancelled" && result.receipt.status !== "cancelling"
        ? " Сохранённый набор просмотрен; новые записи войдут в новый обход." : "") +
      translationOperationBudgetNotice(result.budget, result.stopReason),
  }));
}
export async function translatePremiumWriterBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(translationsUrl({ ...cursorParams, errorCode: "database_unavailable" }));
  const result = await runProfileTranslationScan({ supabase, actorId: session.user.id, kind: "writer",
    scanIntent: String(formData.get("writerScanIntent") || "").trim() || null,
    jobId: String(formData.get("writerJob") || "").trim() || null,
    legacyCursor: String(formData.get("writerCursor") ?? "0") });
  revalidatePath("/translations");
  revalidatePath("/editorial-database");
  redirect(translationsUrl({ ...cursorParams,
    writerJob: result.recoveryJobId,
    writerCursor: result.receipt ? profileTranslationScanOrdinal(result.receipt) : cursorParams.writerCursor,
    errorCode: result.errorCode,
    success: result.receipt === null && result.processed === 0 ? null :
      (result.errorCode && result.errorCode !== "translation_scan_complete" ? "Пакет биографий приостановлен. Подтверждённые итоги: " : "Биографии: ") +
      `подтверждённо просмотрено ${result.processed}, подтверждённых машинных черновиков ${result.translated}, ожидают проверки ${result.reviewPending}, устаревших ${result.stale}, актуальных ${result.current}, ручных ${result.manual}, пропущено ${result.skipped}, ошибок ${result.failed}. Машинные черновики не опубликованы.` +
      (result.receipt?.exhausted && result.receipt.status !== "cancelled" && result.receipt.status !== "cancelling"
        ? " Сохранённый набор просмотрен; новые записи войдут в новый обход." : "") +
      translationOperationBudgetNotice(result.budget, result.stopReason),
  }));
}

export async function translatePremiumSiteCopyBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(translationsUrl({ ...cursorParams, errorCode: "database_unavailable" }));
  }
  const freshIntent = String(formData.get("siteCopyIntent") || "").trim();
  const selectedOperation = String(formData.get("siteCopyOperation") || "").trim();
  // The helper observes the logical scope before today's CMS/runtime/flag.
  // An addressed retry is recovery only; a fresh UUID is a distinct command.
  const result = await ensureSiteCopyEnglishTranslation({ supabase, actorId: session.user.id,
    ...(freshIntent ? { operationIntent: freshIntent } : selectedOperation ? { operationId: selectedOperation } : {}) });
  if (!result.operation && (!selectedOperation || freshIntent) &&
    (result.state === "manual" || result.state === "current" || result.state === "skipped")) {
    const response = await supabase.from("homepage_blocks").select("id")
      .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY }).limit(2);
    unstable_rethrow(response.error);
    const rows = z.array(z.object({ id: z.string().uuid() })).max(1).safeParse(response.data);
    if (response.error || !rows.success) redirect(translationsUrl({ ...cursorParams, errorCode: "database_read_failed" }));
    if (rows.data[0]) {
      try {
        await recordTranslationSyncRun({ supabase, kind: "site_copy", items: [{ entityId: rows.data[0].id,
          state: result.state, error: result.error, model: result.model }] });
      } catch (error) {
        unstable_rethrow(error);
        redirect(translationsUrl({ ...cursorParams, errorCode: "translation_run_record_unconfirmed" }));
      }
    }
  }
  const operationId = !freshIntent && selectedOperation ? selectedOperation : result.operation?.operationId ?? null;
  revalidatePath("/translations");
  revalidatePath("/site-copy");
  if (result.state === "failed" || result.state === "not-ready" || result.state === "not-configured" ||
      result.state === "conflict" || result.state === "unconfirmed" || result.state === "cancelled" || result.errorCode) {
    redirect(translationsUrl({ ...cursorParams, siteCopyOperation: operationId,
      errorCode: result.errorCode || (result.state === "unconfirmed" ? "translation_retry_unconfirmed"
      : result.state === "cancelled" ? "translation_operation_stopped"
      : result.state === "conflict" ? "write_conflict"
      : result.state === "not-ready" ? "translation_migration_required"
        : result.state === "not-configured" ? "translation_not_configured" : translationErrorCode(result.error)) }));
  }
  const success = result.state === "translated" || result.state === "review-pending"
    ? "Тексты сайта: машинный черновик сохранён и ожидает вашей проверки. Он не опубликован."
    : result.state === "stale"
      ? "Тексты сайта: сохранённый машинный черновик устарел. Проверьте или отклоните его перед новым переводом."
      : result.state === "manual" ? "Тексты сайта: ручной английский текст сохранён без изменений."
        : "Тексты сайта: новых строк для перевода нет.";
  redirect(translationsUrl({ ...cursorParams, siteCopyOperation: operationId, success }));
}
