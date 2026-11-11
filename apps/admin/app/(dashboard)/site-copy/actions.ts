"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { redirect } from "@/lib/navigation";

import { ensureSiteCopyEnglishTranslation } from "@/lib/auto-translate-site-copy-private";
import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import {
  premiumTranslationRuntimeMetadata,
} from "@/lib/premium-translation-runtime";
import { translationErrorCode } from "@/lib/translation-errors";
import { premiumTranslationRuntimeGate } from "@/lib/translation-runtime-gate";
import { requestPublicBuild } from "@/lib/publication";
import {
  normalizeShortHyphens,
  normalizeShortHyphensDeep,
} from "@/lib/short-hyphens";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadAllSiteCopyKeys } from "@/lib/site-copy-catalog";
import {
  mergeSiteCopyRows,
  readSiteCopyValues,
} from "@/lib/site-copy-storage";

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";
const SITE_COPY_DISPLAY_ORDER = 2_000_000_000;
const MAX_COPY_LENGTH = 4_000;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isAllowedCopyKey(key: string, allowedKeys: ReadonlySet<string>) {
  return (
    allowedKeys.has(key) ||
    (key.startsWith("interface.") &&
      key.slice("interface.".length).trim().length > 0 &&
      key.length <= 1_200)
  );
}

function submittedRows(
  formData: FormData,
  allowedKeys: ReadonlySet<string>
) {
  const keys = formData
    .getAll("copy_key")
    .map((value) => normalizeShortHyphens(String(value)));
  const russianValues = formData
    .getAll("copy_ru")
    .map((value) => normalizeShortHyphens(String(value)));
  const englishValues = formData
    .getAll("copy_en")
    .map((value) => normalizeShortHyphens(String(value)));
  if (
    keys.length !== russianValues.length ||
    keys.length !== englishValues.length ||
    keys.length > allowedKeys.size + 100
  ) {
    throw new Error("Форма текстов повреждена. Обновите страницу и повторите.");
  }

  const rows = keys.map((key, index) => ({
    key: key.trim(),
    ru: russianValues[index]?.trim() || "",
    en: englishValues[index]?.trim() || "",
  }));
  const customSource = normalizeShortHyphens(
    String(formData.get("custom_source") || "").trim()
  );
  if (customSource) {
    rows.push({
      key: `interface.${customSource}`,
      ru: normalizeShortHyphens(
        String(formData.get("custom_ru") || "").trim()
      ),
      en: normalizeShortHyphens(
        String(formData.get("custom_en") || "").trim()
      ),
    });
  }

  for (const row of rows) {
    if (!isAllowedCopyKey(row.key, allowedKeys)) {
      throw new Error(`Неизвестное поле текста: ${row.key}`);
    }
    if (row.ru.length > MAX_COPY_LENGTH || row.en.length > MAX_COPY_LENGTH) {
      throw new Error(
        `Текст «${row.key}» длиннее ${MAX_COPY_LENGTH} символов.`
      );
    }
  }
  return rows;
}

export async function saveSiteCopyAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const expectedUpdatedAt = String(
    formData.get("expected_updated_at") || ""
  ).trim();

  let rows: ReturnType<typeof submittedRows>;
  try {
    const allowedKeys = await loadAllSiteCopyKeys();
    rows = submittedRows(formData, allowedKeys);
  } catch {
    redirect("/site-copy?errorCode=invalid_input");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/site-copy?errorCode=database_unavailable");

  const { data: existingRows, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(2);
  unstable_rethrow(existingError);
  const existingResult = z.array(z.object({
    id: z.string().uuid(), settings: z.record(z.string(), z.unknown()),
    updated_at: z.string().datetime({ offset: true }),
  })).max(1).safeParse(existingRows);
  if (existingError || !existingResult.success) {
    redirect("/site-copy?errorCode=database_read_failed");
  }

  const existing = existingResult.data[0];
  if ((!existing && expectedUpdatedAt) ||
      (existing && (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt))) {
    redirect(
      "/site-copy?errorCode=write_conflict"
    );
  }
  const existingSettings = objectValue(existing?.settings);

  const rawCopy = objectValue(existingSettings.siteCopy);
  const existingPremium = objectValue(existingSettings.premiumTranslation);
  const rawMachine = existingPremium.siteCopyEn;
  const rawMaps = [existingSettings.siteCopy, rawCopy.ru, rawCopy.en,
    existingSettings.premiumTranslation, rawMachine];
  if (rawMaps.some(value => value != null && (typeof value !== "object" || Array.isArray(value)))) {
    redirect("/site-copy?errorCode=database_read_failed");
  }
  const previousCopy = readSiteCopyValues(existingSettings.siteCopy);
  const machine = { ...objectValue(rawMachine) };
  const changedRussianKeys: string[] = [];
  for (const row of rows) {
    if (row.ru && row.ru !== (previousCopy.ru[row.key] || "")) changedRussianKeys.push(row.key);
    if ((!row.ru && row.ru !== (previousCopy.ru[row.key] || "")) ||
        row.en !== (previousCopy.en[row.key] || "")) delete machine[row.key];
  }

  const { ru, en } = mergeSiteCopyRows(
    readSiteCopyValues(existingSettings.siteCopy),
    rows
  );
  const runtime = premiumTranslationRuntimeMetadata();

  const payload = {
    block_type: "text",
    title: "Системные тексты сайта",
    settings: {
      ...existingSettings,
      systemKey: SITE_COPY_SYSTEM_KEY,
      version: 1,
      siteCopy: normalizeShortHyphensDeep({ ru, en }),
      premiumTranslation: {
        ...existingPremium,
        siteCopyEn: machine,
        provider: runtime.provider,
        model: runtime.model,
        reviewerModel: runtime.reviewerModel,
        twoPassReview: runtime.twoPassReview,
        updatedAt: new Date().toISOString(),
      },
    },
    display_order: SITE_COPY_DISPLAY_ORDER,
    is_enabled: true,
    background_style: "transparent",
    background_media_id: null,
    updated_by: session.user.id,
  };

  // Apply the existing editor projection only to submitted keys. Unsubmitted
  // authored values, other locales and unrelated settings retain their raw JSON.
  const retainedCopy = { ...rawCopy, ru: { ...objectValue(rawCopy.ru) }, en: { ...objectValue(rawCopy.en) } };
  for (const row of rows) {
    if (row.ru !== (previousCopy.ru[row.key] || "") || !Object.hasOwn(retainedCopy.ru, row.key)) {
      if (Object.hasOwn(payload.settings.siteCopy.ru, row.key)) retainedCopy.ru[row.key] = payload.settings.siteCopy.ru[row.key];
      else delete retainedCopy.ru[row.key];
    }
    if (row.en !== (previousCopy.en[row.key] || "") || !Object.hasOwn(retainedCopy.en, row.key)) {
      if (Object.hasOwn(payload.settings.siteCopy.en, row.key)) retainedCopy.en[row.key] = payload.settings.siteCopy.en[row.key];
      else delete retainedCopy.en[row.key];
    }
  }
  payload.settings.siteCopy = retainedCopy as typeof payload.settings.siteCopy;

  const { data: blockId, error: saveError } = await supabase.rpc(
    "save_site_copy_block",
    {
      p_expected_updated_at: expectedUpdatedAt || null,
      p_payload: payload,
      p_audit_metadata: {
        russian_overrides: Object.keys(ru).length,
        english_overrides: Object.keys(en).length,
        premium_translation_calls: 0,
        translation_provider: runtime.provider,
        translation_model: runtime.model,
        translation_reviewer_model: runtime.reviewerModel,
      },
    }
  );
  unstable_rethrow(saveError);
  if (saveError?.message === "SITE_COPY_WRITE_CONFLICT") {
    redirect("/site-copy?errorCode=write_conflict");
  }
  if (saveError) redirect("/site-copy?errorCode=database_write_failed");
  if (!z.string().uuid().safeParse(blockId).success || existing && blockId !== existing.id) {
    redirect("/site-copy?errorCode=database_write_failed");
  }
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "site_copy",
    entityId: blockId,
    reason: "site-copy.updated",
    metadata: { storage: "homepage_blocks" },
  });

  let translationState = "";
  let translationError = "";
  let translationOperation = "";
  if (adminEnv.openAiAutoTranslateSiteCopy && changedRussianKeys.length) {
    try {
      if (!(await premiumTranslationRuntimeGate(supabase))) {
        translationState = "not-configured";
        translationError = "translation_not_configured";
      } else {
        const translation = await ensureSiteCopyEnglishTranslation({
          supabase, actorId: session.user.id, blockId, keys: [...new Set(changedRussianKeys)], runtimeApproved: true,
        });
        translationState = translation.state;
        translationOperation = translation.operation?.operationId || "";
        if (["failed", "not-ready", "not-configured", "conflict", "unconfirmed", "cancelled"].includes(translation.state)) {
          translationError = translation.errorCode || (translation.state === "unconfirmed" ? "translation_retry_unconfirmed"
            : translation.state === "cancelled" ? "translation_operation_stopped"
            : translation.state === "not-ready" ? "translation_migration_required"
            : translation.state === "not-configured" ? "translation_not_configured"
              : translation.state === "conflict" ? "write_conflict" : translationErrorCode(translation.error));
        }
      }
    } catch (error) {
      unstable_rethrow(error);
      translationState = "failed";
      translationError = translationErrorCode(error);
    }
  }

  revalidatePath("/site-copy");
  revalidatePath("/homepage");
  const query = new URLSearchParams({ saved: "1", published: publication.state });
  if (translationState) query.set("translation", translationState);
  if (translationError) query.set("errorCode", translationError);
  if (translationOperation) query.set("translation_operation", translationOperation);
  redirect(`/site-copy?${query.toString()}`);
}
