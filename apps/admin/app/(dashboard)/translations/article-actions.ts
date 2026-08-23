"use server";

import { revalidatePath } from "next/cache";

import { ensurePublishedArticlePremiumEnglish } from "@/lib/auto-translate-published-article-premium";
import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_ARTICLE_TRANSLATIONS = 2;
const MAX_ARTICLE_SCAN = 20;

function translationsUrl(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) {
      params.set(key, String(value));
    }
  }
  return `/translations${params.size ? `?${params}` : ""}`;
}

export async function translatePremiumArticleBatchAction() {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  if (!adminEnv.openAiApiKey) {
    redirect(translationsUrl({ error: "OPENAI_API_KEY не настроен на сервере." }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(translationsUrl({ error: "База данных не подключена." }));

  const articles = await supabase
    .from("articles")
    .select("id")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(MAX_ARTICLE_SCAN);
  if (articles.error) {
    redirect(translationsUrl({ error: articles.error.message }));
  }

  let translated = 0;
  let current = 0;
  let skipped = 0;
  let failed = 0;
  for (const article of articles.data || []) {
    if (translated >= MAX_ARTICLE_TRANSLATIONS) break;
    const result = await ensurePublishedArticlePremiumEnglish({
      supabase,
      actorId: session.user.id,
      articleId: article.id,
    });
    if (result.state === "translated") translated += 1;
    else if (result.state === "current") current += 1;
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
        entityId: "articles-en",
        reason: "premium-translation.articles",
        metadata: {
          premiumEnglish: true,
          kind: "articles",
          translated,
          model: adminEnv.openAiTranslationModel,
          reviewerModel: adminEnv.openAiTranslationReviewModel,
          twoPassReview: adminEnv.openAiPremiumTranslationReview,
        },
      })
    ).state;
  }

  revalidatePath("/translations");
  revalidatePath("/articles");
  redirect(
    translationsUrl({
      success: `Статьи: новых/обновлённых EN ${translated}, актуальных ${current}, пропущено ${skipped}, ошибок ${failed}.`,
      publication,
    })
  );
}
