"use server";

import { revalidatePath } from "next/cache";

import { ensurePublishedArticlePremiumEnglish } from "@/lib/auto-translate-published-article-premium";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import {
  premiumTranslationRuntimeMetadata,
} from "@/lib/premium-translation-runtime";
import { requestPublicBuild } from "@/lib/publication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  advanceBackfillCursor,
  normalizeBackfillCursor,
  translationBackfillCursorParams,
} from "@/lib/translation-backfill-cursor";
import { translationErrorCode } from "@/lib/translation-errors";
import { premiumTranslationRuntimeGate } from "@/lib/translation-runtime-gate";
import {
  recordTranslationSyncRun,
  type TranslationRunItem,
} from "@/lib/translation-run-record";

const MAX_ARTICLE_TRANSLATIONS = 2;
const ARTICLE_SCAN_PAGE_SIZE = 100;
const MAX_ARTICLE_SCAN = 500;

function translationsUrl(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) {
      params.set(key, String(value));
    }
  }
  return `/translations${params.size ? `?${params}` : ""}`;
}

export async function translatePremiumArticleBatchAction(formData: FormData) {
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

  const candidateCount = await supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .is("deleted_at", null);
  if (candidateCount.error) {
    redirect(translationsUrl({ ...cursorParams, errorCode: "database_read_failed" }));
  }
  const totalCandidates = candidateCount.count || 0;
  const startOffset = normalizeBackfillCursor(
    cursorParams.articleCursor,
    totalCandidates
  );

  let translated = 0;
  let current = 0;
  let manual = 0;
  let skipped = 0;
  let failed = 0;
  let offset = startOffset;
  let processed = 0;
  let firstError = "";
  const runItems: TranslationRunItem[] = [];

  while (
    translated < MAX_ARTICLE_TRANSLATIONS &&
    !firstError &&
    runItems.length < MAX_ARTICLE_SCAN
  ) {
    const articles = await supabase
      .from("articles")
      .select("id")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .range(offset, offset + ARTICLE_SCAN_PAGE_SIZE - 1);
    if (articles.error) {
      redirect(
        translationsUrl({ ...cursorParams, errorCode: "database_read_failed" })
      );
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
      redirect(
        translationsUrl({ ...cursorParams, errorCode: "database_read_failed" })
      );
    }

    const englishStatus = new Map(
      (englishRows.data || []).map((row) => [String(row.article_id), String(row.status)])
    );

    for (const articleId of articleIds) {
      if (
        translated >= MAX_ARTICLE_TRANSLATIONS ||
        firstError ||
        runItems.length >= MAX_ARTICLE_SCAN
      ) break;
      processed += 1;
      if (englishStatus.get(articleId) === "published") {
        current += 1;
        runItems.push({ entityId: articleId, state: "current" });
        continue;
      }

      const result = await ensurePublishedArticlePremiumEnglish({
        supabase,
        actorId: session.user.id,
        articleId,
        runtimeApproved: true,
      });
      runItems.push({
        entityId: articleId,
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

    offset = startOffset + processed;
    if (page.length < ARTICLE_SCAN_PAGE_SIZE) break;
  }
  const nextArticleCursor = advanceBackfillCursor(
    startOffset,
    processed,
    totalCandidates
  );

  try {
    await recordTranslationSyncRun({
      supabase,
      kind: "article",
      items: runItems,
      resumeCursor: { articleCursor: nextArticleCursor },
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
        entityId: "articles-en",
        reason: "premium-translation.articles",
        metadata: {
          premiumEnglish: true,
          kind: "articles",
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
  revalidatePath("/articles");
  redirect(
    translationsUrl({
      ...cursorParams,
      success: `Статьи: новых/обновлённых EN ${translated}, актуальных ${current}, ручных ${manual}, пропущено ${skipped}, ошибок ${failed}.`,
      errorCode: firstError ? translationErrorCode(firstError) : null,
      publication,
      articleCursor: nextArticleCursor,
    })
  );
}
