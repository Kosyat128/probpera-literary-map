"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { translationBackfillCursorParams } from "@/lib/translation-backfill-cursor";
import { translationOperationBudgetNotice } from "@/lib/translation-operation-budget-notice";
import { runProfileTranslationScan } from "@/lib/profile-translation-scan";
import { profileTranslationScanOrdinal } from "@/lib/profile-translation-scan-rpc";

function translationsUrl(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) {
      params.set(key, String(value));
    }
  }
  return `/translations${params.size ? `?${params}` : ""}`;
}

export async function translatePremiumCountryBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(translationsUrl({ ...cursorParams, errorCode: "database_unavailable" }));
  const result = await runProfileTranslationScan({ supabase, actorId: session.user.id, kind: "country",
    scanIntent: String(formData.get("countryScanIntent") || "").trim() || null,
    jobId: String(formData.get("countryJob") || "").trim() || null,
    legacyCursor: String(formData.get("countryCursor") ?? "0") });
  revalidatePath("/translations");
  revalidatePath("/editorial-database");
  redirect(translationsUrl({ ...cursorParams,
    countryJob: result.recoveryJobId,
    countryCursor: result.receipt ? profileTranslationScanOrdinal(result.receipt) : cursorParams.countryCursor,
    errorCode: result.errorCode,
    success: result.receipt === null && result.processed === 0 ? null :
      (result.errorCode && result.errorCode !== "translation_scan_complete" ? "Пакет стран приостановлен. Подтверждённые итоги: " : "Страны: ") +
      `подтверждённо просмотрено ${result.processed}, подтверждённых машинных черновиков ${result.translated}, ожидают проверки ${result.reviewPending}, устаревших ${result.stale}, актуальных ${result.current}, ручных ${result.manual}, пропущено ${result.skipped}, ошибок ${result.failed}. Машинные черновики не опубликованы.` +
      (result.receipt?.exhausted && result.receipt.status !== "cancelled" && result.receipt.status !== "cancelling"
        ? " Сохранённый набор просмотрен; новые записи войдут в новый обход." : "") +
      translationOperationBudgetNotice(result.budget, result.stopReason),
  }));
}
