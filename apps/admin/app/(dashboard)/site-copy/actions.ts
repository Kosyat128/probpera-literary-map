"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";

import {
  translateSiteCopyBatchToEnglish,
  translationSourceHash,
} from "@/lib/auto-translate-site-copy";
import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import {
  premiumTranslationConfigurationError,
  premiumTranslationRuntimeMetadata,
} from "@/lib/premium-translation-runtime";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadAllSiteCopyKeys } from "@/lib/site-copy-catalog";
import {
  mergeSiteCopyRows,
  readSiteCopyValues,
} from "@/lib/site-copy-storage";

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";
const SITE_COPY_DISPLAY_ORDER = 2_000_000_000;
const MAX_COPY_LENGTH = 4_000;
const TRANSLATION_BATCH_SIZE = 50;

type MachineCopyState = Record<
  string,
  {
    sourceHash: string;
    model?: string;
    reviewerModel?: string | null;
    generatedAt?: string;
  }
>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readMachineCopyState(value: unknown): MachineCopyState {
  const result: MachineCopyState = {};
  for (const [key, rawEntry] of Object.entries(objectValue(value))) {
    const entry = objectValue(rawEntry);
    if (typeof entry.sourceHash !== "string" || !entry.sourceHash.trim()) continue;
    result[key] = {
      sourceHash: entry.sourceHash.trim(),
      model: typeof entry.model === "string" ? entry.model : undefined,
      reviewerModel:
        typeof entry.reviewerModel === "string" ? entry.reviewerModel : null,
      generatedAt:
        typeof entry.generatedAt === "string" ? entry.generatedAt : undefined,
    };
  }
  return result;
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
  const keys = formData.getAll("copy_key").map(String);
  const russianValues = formData.getAll("copy_ru").map(String);
  const englishValues = formData.getAll("copy_en").map(String);
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
  const customSource = String(formData.get("custom_source") || "").trim();
  if (customSource) {
    rows.push({
      key: `interface.${customSource}`,
      ru: String(formData.get("custom_ru") || "").trim(),
      en: String(formData.get("custom_en") || "").trim(),
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

async function autoTranslateChangedRows({
  rows,
  existingSettings,
}: {
  rows: ReturnType<typeof submittedRows>;
  existingSettings: Record<string, unknown>;
}) {
  const current = readSiteCopyValues(existingSettings.siteCopy);
  const premiumState = objectValue(existingSettings.premiumTranslation);
  const machine = readMachineCopyState(premiumState.siteCopyEn);
  const pending: Array<{ key: string; text: string; sourceHash: string }> = [];

  for (const row of rows) {
    const previousRu = current.ru[row.key] || "";
    const previousEn = current.en[row.key] || "";
    const ruChanged = row.ru !== previousRu;
    const enChanged = row.en !== previousEn;

    if (!row.ru) {
      delete machine[row.key];
      continue;
    }
    if (enChanged) {
      // Any explicit English edit becomes human-owned immediately.
      delete machine[row.key];
    }
    if (!ruChanged) continue;

    const sourceHash = await translationSourceHash({ key: row.key, text: row.ru });
    const machineOwned = Boolean(machine[row.key]);
    const shouldTranslate = !row.en || (machineOwned && !enChanged);
    if (shouldTranslate) pending.push({ key: row.key, text: row.ru, sourceHash });
  }

  if (!pending.length || !adminEnv.openAiAutoTranslateSiteCopy) {
    return {
      rows,
      machine,
      translationCalls: 0,
      translationModel: null as string | null,
      translationReviewerModel: null as string | null,
    };
  }
  if (!adminEnv.premiumTranslationConfigured) {
    throw new Error(premiumTranslationConfigurationError());
  }

  const runtime = premiumTranslationRuntimeMetadata();
  const translatedByKey = new Map<string, string>();
  let translationCalls = 0;
  let lastModel = runtime.model;
  let lastReviewerModel: string | null = runtime.reviewerModel;
  for (let start = 0; start < pending.length; start += TRANSLATION_BATCH_SIZE) {
    const batch = pending.slice(start, start + TRANSLATION_BATCH_SIZE);
    const translated = await translateSiteCopyBatchToEnglish(
      batch.map(({ key, text }) => ({ key, text }))
    );
    if (!translated) continue;
    translationCalls += 1;
    lastModel = translated.translatorModel;
    lastReviewerModel = translated.reviewerModel;
    for (const item of translated.value.items) {
      translatedByKey.set(item.key, item.text);
    }
  }

  const generatedAt = new Date().toISOString();
  const enrichedRows = rows.map((row) => {
    const translated = translatedByKey.get(row.key);
    if (!translated) return row;
    const pendingItem = pending.find((item) => item.key === row.key);
    if (!pendingItem) return row;
    machine[row.key] = {
      sourceHash: pendingItem.sourceHash,
      model: lastModel,
      reviewerModel: lastReviewerModel,
      generatedAt,
    };
    return { ...row, en: translated };
  });

  return {
    rows: enrichedRows,
    machine,
    translationCalls,
    translationModel: translationCalls ? lastModel : null,
    translationReviewerModel: translationCalls ? lastReviewerModel : null,
  };
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
  } catch (error) {
    redirect(
      `/site-copy?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Проверьте тексты"
      )}`
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/site-copy?error=База данных не подключена");

  const { data: existingRows, error: existingError } = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingError) {
    redirect(`/site-copy?error=${encodeURIComponent(existingError.message)}`);
  }

  const existing = existingRows?.[0];
  if (existing && (!expectedUpdatedAt || existing.updated_at !== expectedUpdatedAt)) {
    redirect(
      "/site-copy?error=" +
        encodeURIComponent(
          "Тексты уже изменили в другой вкладке. Обновите страницу и повторите сохранение."
        )
    );
  }
  const existingSettings = objectValue(existing?.settings);

  let translationResult: Awaited<ReturnType<typeof autoTranslateChangedRows>>;
  try {
    translationResult = await autoTranslateChangedRows({ rows, existingSettings });
  } catch (error) {
    redirect(
      `/site-copy?error=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "Не удалось подготовить премиальный английский перевод."
      )}`
    );
  }

  const { ru, en } = mergeSiteCopyRows(
    readSiteCopyValues(existingSettings.siteCopy),
    translationResult.rows
  );
  const existingPremium = objectValue(existingSettings.premiumTranslation);
  const runtime = premiumTranslationRuntimeMetadata();

  const payload = {
    block_type: "text",
    title: "Системные тексты сайта",
    settings: {
      ...existingSettings,
      systemKey: SITE_COPY_SYSTEM_KEY,
      version: 1,
      siteCopy: { ru, en },
      premiumTranslation: {
        ...existingPremium,
        siteCopyEn: translationResult.machine,
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

  let blockId = existing?.id;
  if (blockId) {
    const { data: updated, error } = await supabase
      .from("homepage_blocks")
      .update(payload)
      .eq("id", blockId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id")
      .maybeSingle();
    if (error) redirect(`/site-copy?error=${encodeURIComponent(error.message)}`);
    if (!updated) {
      redirect(
        "/site-copy?error=" +
          encodeURIComponent(
            "Тексты уже изменили в другой вкладке. Обновите страницу и повторите сохранение."
          )
      );
    }
  } else {
    const { data, error } = await supabase
      .from("homepage_blocks")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      redirect(
        `/site-copy?error=${encodeURIComponent(
          error?.message || "Не удалось сохранить тексты"
        )}`
      );
    }
    blockId = data.id;
  }
  if (!blockId) redirect("/site-copy?error=Не удалось определить запись текстов");

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "site_copy.updated",
    entity_type: "site_copy",
    entity_id: blockId,
    metadata: {
      russian_overrides: Object.keys(ru).length,
      english_overrides: Object.keys(en).length,
      premium_translation_calls: translationResult.translationCalls,
      translation_provider: runtime.provider,
      translation_model: translationResult.translationModel || runtime.model,
      translation_reviewer_model:
        translationResult.translationReviewerModel ?? runtime.reviewerModel,
      storage: "homepage_blocks",
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "site_copy",
    entityId: blockId,
    reason: "site-copy.updated",
    metadata: { storage: "homepage_blocks" },
  });

  revalidatePath("/site-copy");
  revalidatePath("/homepage");
  redirect(`/site-copy?saved=1&published=${publication.state}`);
}
