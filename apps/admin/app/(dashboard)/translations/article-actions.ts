"use server";

import { revalidatePath } from "next/cache";

import { ensurePublishedArticlePremiumEnglish } from "@/lib/auto-translate-published-article-premium";
import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_ARTICLE_TRANSLATIONS = 2;
const ARTICLE_SCAN_PAGE_SIZE = 100;

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

  let translated = 0;
  let current = 0;
  let manual = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  while (translated < MAX_ARTICLE_TRANSLATIONS) {
    const articles = await supabase
      .from("articles")
      .select("id")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .range(offset, offset + ARTICLE_SCAN_PAGE_SIZE - 1);
    if (articles.error) {
      redirect(translationsUrl({ error: articles.error.message }));
    }

    const page = articles.data || [];
    if (!page.length) break;
    const articleIds = page.map((article) => String(article.id));
    const englishRows = await supabase
      .from("article_translations")
      .select("article_id,status")
      .eq("locale", "en")
      .is("deleted_at", null)
      .in("article_id", articleIds);
    if (englishRows.error) {
      redirect(translationsUrl({ error: englishRows.error.message }));
    }

    const englishStatus = new Map(
      (englishRows.data || []).map((row) => [String(row.article_id), String(row.status)])
    );

    for (const articleId of articleIds) {
      if (translated >= MAX_ARTICLE_TRANSLATIONS) break;
      if (englishStatus.get(articleId) === "published") {
        current += 1;
        continue;
      }

      const result = await ensurePublishedArticlePremiumEnglish({
        supabase,
        actorId: session.user.id,
        articleId,
      });
      if (result.state === "translated") translated += 1;
      else if (result.state === "current") current += 1;
      else if (result.state === "manual") manual += 1;
      else if (result.state === "failed" || result.state === "conflict") failed += 1;
      else skipped += 1;
    }

    offset += page.length;
    if (page.length < ARTICLE_SCAN_PAGE_SIZE) break;
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
      success: `Статьи: новых/обновлённых EN ${translated}, актуальных ${current}, ручных ${manual}, пропущено ${skipped}, ошибок ${failed}.`,
      publication,
    })
  );
}
