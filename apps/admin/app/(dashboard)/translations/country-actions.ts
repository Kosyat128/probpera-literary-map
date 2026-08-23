"use server";

import { revalidatePath } from "next/cache";

import { ensureCountryEnglishProfile } from "@/lib/auto-translate-country-profile";
import { requireStaff } from "@/lib/auth";
import { editorialCatalog } from "@/lib/editorial-catalog";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function translatePremiumCountryBatchAction() {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  if (!adminEnv.openAiApiKey) {
    redirect(translationsUrl({ error: "OPENAI_API_KEY не настроен на сервере." }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(translationsUrl({ error: "База данных не подключена." }));

  let translated = 0;
  let current = 0;
  let manual = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;

  for (const country of editorialCatalog.countries) {
    if (translated >= MAX_COUNTRY_TRANSLATIONS || scanned >= MAX_COUNTRY_SCAN) break;
    scanned += 1;
    const result = await ensureCountryEnglishProfile({
      supabase,
      actorId: session.user.id,
      countryId: country.id,
      sourceFields: country.fields,
    });
    if (result.state === "translated") translated += 1;
    else if (result.state === "current") current += 1;
    else if (result.state === "manual") manual += 1;
    else if (result.state === "failed" || result.state === "conflict") failed += 1;
    else skipped += 1;
  }

  let publication: string | null = null;
  if (translated > 0) {
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
          model: adminEnv.openAiTranslationModel,
          reviewerModel: adminEnv.openAiTranslationReviewModel,
          twoPassReview: adminEnv.openAiPremiumTranslationReview,
        },
      })
    ).state;
  }

  revalidatePath("/translations");
  revalidatePath("/editorial-database");
  redirect(
    translationsUrl({
      success: `Страны: новых EN ${translated}, актуальных ${current}, ручных ${manual}, пропущено ${skipped}, ошибок ${failed}.`,
      publication,
    })
  );
}
