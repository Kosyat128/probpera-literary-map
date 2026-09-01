"use server";

import { revalidatePath } from "next/cache";

import { ensureCountryEnglishProfile } from "@/lib/auto-translate-country-profile";
import { requireStaff } from "@/lib/auth";
import { loadEditorialCatalog } from "@/lib/editorial-catalog";
import { redirect } from "@/lib/navigation";
import {
  premiumTranslationRuntimeMetadata,
} from "@/lib/premium-translation-runtime";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  advanceBackfillCursor,
  circularBackfillIndex,
  normalizeBackfillCursor,
  translationBackfillCursorParams,
} from "@/lib/translation-backfill-cursor";
import { translationErrorCode } from "@/lib/translation-errors";
import { premiumTranslationRuntimeGate } from "@/lib/translation-runtime-gate";
import {
  recordTranslationSyncRun,
  type TranslationRunItem,
} from "@/lib/translation-run-record";

const MAX_COUNTRY_TRANSLATIONS = 2;
const MAX_COUNTRY_SCAN = 30;

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
  if (!supabase) {
    redirect(translationsUrl({ ...cursorParams, errorCode: "database_unavailable" }));
  }
  if (!(await premiumTranslationRuntimeGate(supabase))) {
    redirect(translationsUrl({ ...cursorParams, errorCode: "translation_not_configured" }));
  }

  const editorialCatalog = await loadEditorialCatalog();
  const candidates = editorialCatalog.countries;
  const startCursor = normalizeBackfillCursor(
    cursorParams.countryCursor,
    candidates.length
  );
  let translated = 0;
  let current = 0;
  let manual = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  let firstError = "";
  const runItems: TranslationRunItem[] = [];
  const scanLimit = Math.min(MAX_COUNTRY_SCAN, candidates.length);

  for (let step = 0; step < scanLimit; step += 1) {
    if (translated >= MAX_COUNTRY_TRANSLATIONS || firstError) break;
    const country = candidates[
      circularBackfillIndex(startCursor, step, candidates.length)
    ];
    if (!country) break;
    processed += 1;
    const result = await ensureCountryEnglishProfile({
      supabase,
      actorId: session.user.id,
      countryId: country.id,
      sourceFields: country.fields,
      runtimeApproved: true,
    });
    runItems.push({
      entityId: country.id,
      state: result.state,
      error: result.error,
      model: result.model,
    });
    if (result.state === "translated") translated += 1;
    else if (result.state === "current") current += 1;
    else if (result.state === "manual") manual += 1;
    else if (result.state === "failed") {
      failed += 1;
      firstError = result.error || "";
    } else if (result.state === "conflict") failed += 1;
    else skipped += 1;
  }
  const nextCountryCursor = advanceBackfillCursor(
    startCursor,
    processed,
    candidates.length
  );
  try {
    await recordTranslationSyncRun({
      supabase,
      kind: "country",
      items: runItems,
      resumeCursor: { countryCursor: nextCountryCursor },
    });
  } catch {
    redirect(translationsUrl({ ...cursorParams, errorCode: "database_write_failed" }));
  }

  let publication: string | null = null;
  if (translated > 0) {
    const runtime = premiumTranslationRuntimeMetadata();
    publication = (
      await requestPublicBuild({
        supabase,
        actorId: session.user.id,
        entityType: "premium_translation_batch",
        entityId: "countries-en",
        reason: "premium-translation.countries",
        metadata: {
          premiumEnglish: true,
          kind: "countries",
          translated,
          provider: runtime.provider,
          model: runtime.model,
          reviewerModel: runtime.reviewerModel,
          twoPassReview: runtime.twoPassReview,
        },
      })
    ).state;
  }

  revalidatePath("/translations");
  revalidatePath("/editorial-database");
  redirect(
    translationsUrl({
      ...cursorParams,
      success: `Страны: новых EN ${translated}, актуальных ${current}, ручных ${manual}, пропущено ${skipped}, ошибок ${failed}.`,
      errorCode: firstError ? translationErrorCode(firstError) : null,
      publication,
      countryCursor: nextCountryCursor,
    })
  );
}
