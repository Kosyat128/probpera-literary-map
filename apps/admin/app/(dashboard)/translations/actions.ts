"use server";

import { revalidatePath } from "next/cache";

import { ensureLiteraryWorkEnglishTranslation } from "@/lib/auto-translate-literary-work-safe";
import {
  translateSiteCopyBatchToEnglish,
  translationSourceHash,
} from "@/lib/auto-translate-site-copy";
import { ensureWriterEnglishBiography } from "@/lib/auto-translate-writer-biography";
import { requireStaff } from "@/lib/auth";
import {
  loadEditorialCatalog,
  type EditorialCatalog,
} from "@/lib/editorial-catalog";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import {
  premiumTranslationConfigurationError,
  premiumTranslationRuntimeMetadata,
} from "@/lib/premium-translation-runtime";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readSiteCopyValues } from "@/lib/site-copy-storage";
import {
  advanceBackfillCursor,
  circularBackfillIndex,
  normalizeBackfillCursor,
  translationBackfillCursorParams,
} from "@/lib/translation-backfill-cursor";

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";
const MAX_LIBRARY_TRANSLATIONS = 4;
const MAX_LIBRARY_SCAN = 60;
const MAX_WRITER_TRANSLATIONS = 3;
const MAX_WRITER_SCAN = 120;
const MAX_SITE_COPY_TRANSLATIONS = 50;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function translationsUrl(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) {
      params.set(key, String(value));
    }
  }
  return `/translations${params.size ? `?${params}` : ""}`;
}

function publicBuildMetadata(kind: string, translated: number) {
  const runtime = premiumTranslationRuntimeMetadata();
  return {
    premiumEnglish: true,
    kind,
    translated,
    provider: runtime.provider,
    model: runtime.model,
    reviewerModel: runtime.reviewerModel,
    twoPassReview: runtime.twoPassReview,
  };
}

function batchFailureMessage(error: unknown) {
  const message = typeof error === "string" ? error.trim() : "";
  return message
    ? `Пакет остановлен после первой ошибки перевода: ${message.slice(0, 320)}`
    : "Пакет остановлен после первой ошибки перевода. Повторите запуск позже.";
}

export async function translatePremiumLibraryBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  if (!adminEnv.premiumTranslationConfigured) {
    redirect(
      translationsUrl({
        ...cursorParams,
        error: premiumTranslationConfigurationError(),
      })
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(translationsUrl({ ...cursorParams, error: "База данных не подключена." }));
  }

  const readiness = await supabase.rpc("premium_machine_translation_ready");
  if (readiness.error || readiness.data !== true) {
    redirect(
      translationsUrl({
        ...cursorParams,
        error:
          "Улучшенный английский перевод книги подготовлен, но миграция базы данных для машинных переводов ещё не применена.",
      })
    );
  }

  const countResponse = await supabase
    .from("literary_work_translations")
    .select("work_id", { count: "exact", head: true })
    .eq("locale", "ru")
    .in("editorial_status", ["reviewed", "verified"]);
  if (countResponse.error) {
    redirect(
      translationsUrl({ ...cursorParams, error: countResponse.error.message })
    );
  }
  const totalCandidates = countResponse.count || 0;
  const startCursor = normalizeBackfillCursor(
    cursorParams.libraryCursor,
    totalCandidates
  );

  const russianRows = totalCandidates
    ? await supabase
        .from("literary_work_translations")
        .select("work_id")
        .eq("locale", "ru")
        .in("editorial_status", ["reviewed", "verified"])
        .order("updated_at", { ascending: true })
        .range(
          startCursor,
          Math.min(startCursor + MAX_LIBRARY_SCAN - 1, totalCandidates - 1)
        )
    : { data: [], error: null };
  if (russianRows.error) {
    redirect(
      translationsUrl({ ...cursorParams, error: russianRows.error.message })
    );
  }

  let translated = 0;
  let current = 0;
  let manual = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  let firstError = "";
  const uniqueWorkIds = [
    ...new Set((russianRows.data || []).map((row) => String(row.work_id))),
  ];
  for (const workId of uniqueWorkIds) {
    if (translated >= MAX_LIBRARY_TRANSLATIONS) break;
    processed += 1;
    const result = await ensureLiteraryWorkEnglishTranslation({
      supabase,
      actorId: session.user.id,
      workId,
    });
    if (result.state === "translated") translated += 1;
    else if (result.state === "current") current += 1;
    else if (result.state === "manual") manual += 1;
    else if (result.state === "failed") {
      failed += 1;
      firstError = result.error || "";
      break;
    } else if (result.state === "conflict") failed += 1;
    else skipped += 1;
  }
  const nextLibraryCursor = advanceBackfillCursor(
    startCursor,
    processed,
    totalCandidates
  );

  let publication: string | null = null;
  if (translated > 0) {
    publication = (
      await requestPublicBuild({
        supabase,
        actorId: session.user.id,
        entityType: "premium_translation_batch",
        entityId: "literary-works-en",
        reason: "premium-translation.library",
        metadata: publicBuildMetadata("library", translated),
      })
    ).state;
  }
  revalidatePath("/translations");
  revalidatePath("/library");
  redirect(
    translationsUrl({
      ...cursorParams,
      success: `Книги: новых EN ${translated}, актуальных ${current}, ручных ${manual}, пропущено ${skipped}, ошибок ${failed}.`,
      error: firstError ? batchFailureMessage(firstError) : null,
      publication,
      libraryCursor: nextLibraryCursor,
    })
  );
}

function staticWriterCandidates(editorialCatalog: EditorialCatalog) {
  const candidates: Array<{
    countryId: string;
    writerId: string;
    sourceFields: Record<string, unknown>;
  }> = [];
  for (const country of editorialCatalog.countries) {
    for (const writer of country.writers) {
      const translations = objectValue(writer.fields.biographyTranslations);
      const ru = objectValue(translations.ru);
      const en = objectValue(translations.en);
      const russianEligible =
        ru.locale === "ru" &&
        ru.method === "editorial-original" &&
        new Set(["reviewed", "verified"]).has(String(ru.status)) &&
        typeof ru.text === "string" &&
        ru.text.trim().length >= 120 &&
        Array.isArray(ru.sources) &&
        ru.sources.length > 0;
      const staticManualEnglish =
        en.locale === "en" &&
        en.method !== "machine-translation" &&
        new Set(["reviewed", "verified"]).has(String(en.status));
      if (russianEligible && !staticManualEnglish) {
        candidates.push({
          countryId: country.id,
          writerId: writer.id,
          sourceFields: writer.fields,
        });
      }
    }
  }
  return candidates;
}

export async function translatePremiumWriterBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  if (!adminEnv.premiumTranslationConfigured) {
    redirect(
      translationsUrl({
        ...cursorParams,
        error: premiumTranslationConfigurationError(),
      })
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(translationsUrl({ ...cursorParams, error: "База данных не подключена." }));
  }

  const editorialCatalog = await loadEditorialCatalog();
  const candidates = staticWriterCandidates(editorialCatalog);
  const startCursor = normalizeBackfillCursor(
    cursorParams.writerCursor,
    candidates.length
  );
  let translated = 0;
  let current = 0;
  let manual = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  let firstError = "";
  const scanLimit = Math.min(MAX_WRITER_SCAN, candidates.length);

  for (let step = 0; step < scanLimit; step += 1) {
    if (translated >= MAX_WRITER_TRANSLATIONS) break;
    const candidate = candidates[
      circularBackfillIndex(startCursor, step, candidates.length)
    ];
    if (!candidate) break;
    processed += 1;
    const result = await ensureWriterEnglishBiography({
      supabase,
      actorId: session.user.id,
      ...candidate,
    });
    if (result.state === "translated") translated += 1;
    else if (result.state === "current") current += 1;
    else if (result.state === "manual") manual += 1;
    else if (result.state === "failed") {
      failed += 1;
      firstError = result.error || "";
      break;
    } else if (result.state === "conflict") failed += 1;
    else skipped += 1;
  }
  const nextWriterCursor = advanceBackfillCursor(
    startCursor,
    processed,
    candidates.length
  );

  let publication: string | null = null;
  if (translated > 0) {
    publication = (
      await requestPublicBuild({
        supabase,
        actorId: session.user.id,
        entityType: "premium_translation_batch",
        entityId: "writer-biographies-en",
        reason: "premium-translation.writer-biographies",
        metadata: publicBuildMetadata("writer-biographies", translated),
      })
    ).state;
  }
  revalidatePath("/translations");
  revalidatePath("/editorial-database");
  redirect(
    translationsUrl({
      ...cursorParams,
      success: `Биографии: новых EN ${translated}, актуальных ${current}, ручных ${manual}, пропущено ${skipped}, ошибок ${failed}.`,
      error: firstError ? batchFailureMessage(firstError) : null,
      publication,
      writerCursor: nextWriterCursor,
    })
  );
}

type MachineSiteCopy = Record<
  string,
  { sourceHash?: unknown; model?: unknown; reviewerModel?: unknown; generatedAt?: unknown }
>;

export async function translatePremiumSiteCopyBatchAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const cursorParams = translationBackfillCursorParams(formData);
  if (!adminEnv.premiumTranslationConfigured) {
    redirect(
      translationsUrl({
        ...cursorParams,
        error: premiumTranslationConfigurationError(),
      })
    );
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(translationsUrl({ ...cursorParams, error: "База данных не подключена." }));
  }

  const existingRows = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingRows.error) {
    redirect(
      translationsUrl({ ...cursorParams, error: existingRows.error.message })
    );
  }
  const existing = existingRows.data?.[0];
  if (!existing) {
    redirect(
      translationsUrl({
        ...cursorParams,
        success: "Site copy: русских CMS-переопределений для перевода пока нет.",
      })
    );
  }

  const settings = objectValue(existing.settings);
  const values = readSiteCopyValues(settings.siteCopy);
  const premium = objectValue(settings.premiumTranslation);
  const machine = objectValue(premium.siteCopyEn) as MachineSiteCopy;
  const pending: Array<{ key: string; text: string; sourceHash: string }> = [];

  for (const [key, text] of Object.entries(values.ru)) {
    if (pending.length >= MAX_SITE_COPY_TRANSLATIONS) break;
    const sourceHash = await translationSourceHash({ key, text });
    const machineEntry = objectValue(machine[key]);
    const existingEnglish = values.en[key] || "";
    const machineOwned = typeof machineEntry.sourceHash === "string";
    if (!existingEnglish || (machineOwned && machineEntry.sourceHash !== sourceHash)) {
      pending.push({ key, text, sourceHash });
    }
  }

  if (!pending.length) {
    redirect(
      translationsUrl({
        ...cursorParams,
        success: "Site copy: все машинные/пустые EN уже актуальны.",
      })
    );
  }

  let translated: Awaited<ReturnType<typeof translateSiteCopyBatchToEnglish>>;
  try {
    translated = await translateSiteCopyBatchToEnglish(
      pending.map(({ key, text }) => ({ key, text }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    redirect(
      translationsUrl({
        ...cursorParams,
        error: batchFailureMessage(message),
      })
    );
  }
  if (!translated) {
    redirect(
      translationsUrl({ ...cursorParams, success: "Site copy: нечего переводить." })
    );
  }

  const en = { ...values.en };
  const generatedAt = new Date().toISOString();
  for (const item of translated.value.items) {
    en[item.key] = item.text;
    const source = pending.find((candidate) => candidate.key === item.key)!;
    machine[item.key] = {
      sourceHash: source.sourceHash,
      model: translated.translatorModel,
      reviewerModel: translated.reviewerModel,
      generatedAt,
    };
  }

  const update = await supabase
    .from("homepage_blocks")
    .update({
      settings: {
        ...settings,
        siteCopy: { ru: values.ru, en },
        premiumTranslation: {
          ...premium,
          siteCopyEn: machine,
          model: translated.translatorModel,
          reviewerModel: translated.reviewerModel,
          twoPassReview: adminEnv.openAiPremiumTranslationReview,
          updatedAt: generatedAt,
        },
      },
      updated_by: session.user.id,
    })
    .eq("id", existing.id)
    .eq("updated_at", existing.updated_at)
    .select("id")
    .maybeSingle();
  if (update.error || !update.data) {
    redirect(
      translationsUrl({
        ...cursorParams,
        error:
          update.error?.message ||
          "Site copy изменился во время перевода. Повторите пакет на свежей версии.",
      })
    );
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "site_copy.auto_translation.batch",
    entity_type: "site_copy",
    entity_id: existing.id,
    metadata: {
      translated: translated.value.items.length,
      model: translated.translatorModel,
      reviewer_model: translated.reviewerModel,
      translator_request_id: translated.translatorRequestId,
      reviewer_request_id: translated.reviewerRequestId,
    },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "site_copy",
    entityId: existing.id,
    reason: "premium-translation.site-copy",
    metadata: publicBuildMetadata("site-copy", translated.value.items.length),
  });
  revalidatePath("/translations");
  revalidatePath("/site-copy");
  revalidatePath("/homepage");
  redirect(
    translationsUrl({
      ...cursorParams,
      success: `Site copy: переведено ${translated.value.items.length} строк.`,
      publication: publication.state,
    })
  );
}
