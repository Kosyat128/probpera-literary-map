import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";

import { articleCanonicalUrl } from "./article-route";
import {
  premiumArticleMachineContentJson,
} from "./article-translation-machine-ownership";
import { articleTranslationSourceHash } from "./article-translations";
import { translateArticleSourceToEnglish } from "./auto-translate-article";
import { adminEnv } from "./env";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { publishedArticleEnglishState, validPublishedArticleSourceRevision, type PublishedArticleEnglishState } from "./published-article-english-state";
import { translationErrorCode } from "./translation-errors";
import type { TranslationOperationBudget } from "./translation-operation-budget";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import { createSlug } from "./slug";
import { sameArticleRetryRevision } from "./article-retry-revision";
import type { TranslationProviderCallJournal } from "./premium-english-translation";
import type { ArticleTranslationOrdinaryOperation, ArticleTranslationOrdinaryRunContext } from "./article-translation-ordinary-coordinator";
import type { TranslationErrorCode } from "./translation-errors";

type ArticleRow = {
  id: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  slug: string;
  content_html: string;
  content_json: unknown;
  cover_alt: string | null;
  status: string;
  sources: unknown[] | null;
  bibliography: unknown[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  updated_at: string;
  categories: { slug?: string } | { slug?: string }[] | null;
};

type ExistingEnglishRow = {
  id: string;
  updated_at: string;
  slug: string;
  canonical_url: string | null;
  status: string;
  source_content_hash: string | null;
  source_article_updated_at?: string | null;
  deleted_at?: string | null;
  content_json: unknown;
};

function normalizedLineItems(value: unknown[] | null | undefined) {
  return (value || [])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: unknown }).text || "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

export type PremiumArticleBackfillState =
  | "translated"
  | "current"
  | "manual"
  | "skipped"
  | "not-configured"
  | "conflict"
  | "stale"
  | "failed";

export type PrivateArticleRetryCandidate = {
  englishPayload: Record<string, unknown>;
  model: string;
  reviewerModel: string | null;
  requestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
};

export type PrivateArticleRetry = {
  providerJournal?: TranslationProviderCallJournal;
  stageCandidate?: (candidate: PrivateArticleRetryCandidate) => Promise<void>;
  expectedEnglishUpdatedAt: string | null;
  admit: (source: {
    sourceHash: string;
    sourceUpdatedAt: string;
    expectedEnglishUpdatedAt: string | null;
  }) => Promise<boolean>;
  persist: (candidate: PrivateArticleRetryCandidate) => Promise<{ confirmed: boolean; draftVersion?: number }>;
};

export async function ensurePublishedArticlePremiumEnglish(input: {
  supabase: SupabaseClient;
  actorId: string;
  articleId: string;
  runtimeApproved?: boolean;
  operationBudget?: TranslationOperationBudget;
  expectedSourceHash?: string;
  expectedSourceUpdatedAt?: string;
  privateRetry?: PrivateArticleRetry;
  ordinaryRun?: ArticleTranslationOrdinaryRunContext;
}): Promise<{
  state: PremiumArticleBackfillState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
  sourceHash?: string;
  sourceUpdatedAt?: string;
  retryAdmission?: "existing";
  workingDraftVersion?: number;
  workingDraftUpdatedAt?: string;
  translationPersistence?: "working-draft";
  humanReview?: "pending";
  ordinaryOperation?: ArticleTranslationOrdinaryOperation;
  ordinaryErrorCode?: TranslationErrorCode;
} & Partial<PublishedArticleEnglishState>> {
  if (!adminEnv.openAiAutoTranslateArticles) return { state: "skipped" };
  if (!input.runtimeApproved && !(await premiumTranslationRuntimeGate(input.supabase))) {
    return { state: "not-configured" };
  }

  const articleResponse = await input.supabase
    .from("articles")
    .select(
      "id,title,subtitle,excerpt,slug,content_html,content_json,cover_alt,status,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description,updated_at,categories(slug),category_id,cover_external_url,legacy_path,canonical_url,allow_indexing,featured,show_on_homepage,pinned"
    )
    .eq("id", input.articleId)
    .is("deleted_at", null)
    .maybeSingle();
  unstable_rethrow(articleResponse.error);
  if (articleResponse.error || !articleResponse.data) {
    return {
      state: "failed",
      error: articleResponse.error?.message || "published article not found",
      ordinaryErrorCode: "database_read_failed",
    };
  }
  const article = articleResponse.data as unknown as ArticleRow;
  if (article.status !== "published") return { state: "skipped" };

  const sourceHash = articleTranslationSourceHash({
    title: article.title,
    subtitle: article.subtitle || "",
    excerpt: article.excerpt || "",
    contentJson: article.content_json || { type: "doc", content: [] },
    contentHtml: article.content_html || "",
    coverAlt: article.cover_alt || "",
    slug: article.slug,
    sources: article.sources || [],
    bibliography: article.bibliography || [],
    seoTitle: article.seo_title || article.title,
    seoDescription: article.seo_description || article.excerpt || "",
    seoKeywords: article.seo_keywords || [],
    ogTitle: article.og_title || article.seo_title || article.title,
    ogDescription:
      article.og_description ||
      article.seo_description ||
      article.excerpt ||
      "",
  });
  const sourceContext = {
    sourceHash,
    ...(validPublishedArticleSourceRevision(article.updated_at)
      ? { sourceUpdatedAt: article.updated_at } : {}),
  };
  if (input.privateRetry || input.expectedSourceHash !== undefined || input.expectedSourceUpdatedAt !== undefined) {
    if (!z.string().regex(/^[a-f0-9]{64}$/u).safeParse(input.expectedSourceHash).success ||
      !validPublishedArticleSourceRevision(input.expectedSourceUpdatedAt) ||
      !sourceContext.sourceUpdatedAt || input.expectedSourceHash !== sourceHash ||
      (input.privateRetry
        ? !sameArticleRetryRevision(input.expectedSourceUpdatedAt ?? null, article.updated_at)
        : input.expectedSourceUpdatedAt !== article.updated_at)) {
      return { ...sourceContext, state: "stale", error: "Russian source no longer matches retry intent" };
    }
  }

  const englishResponse = await input.supabase
    .from("article_translations")
    .select(
      "id,updated_at,slug,canonical_url,status,source_content_hash,source_article_updated_at,content_json,deleted_at"
    )
    .eq("article_id", article.id)
    .eq("locale", "en")
    .maybeSingle();
  unstable_rethrow(englishResponse.error);
  if (englishResponse.error) {
    return { ...sourceContext, state: "failed", error: englishResponse.error.message, ordinaryErrorCode: "database_read_failed" };
  }
  const existing = englishResponse.data as ExistingEnglishRow | null;
  const classification = publishedArticleEnglishState({
    sourceHash,
    sourceUpdatedAt: article.updated_at,
    translation: existing,
  });
  const context = { ...classification, ...sourceContext };
  // A retained deleted row still owns its unique article/locale slot. Do not
  // pay for a doomed insert or implicitly restore an author's deleted version.
  if (existing?.deleted_at) {
    return { ...context, state: "skipped", publication: null };
  }

  // Anything that predates the premium ownership marker, or anything an
  // editor has subsequently taken over, is human-owned and is never replaced
  // by a batch backfill.
  if (classification.ownership === "manual") {
    return { ...context, state: "manual" };
  }
  if (!validPublishedArticleSourceRevision(article.updated_at)) {
    return { ...context, state: "skipped" };
  }
  if (existing && classification.freshness === "current") {
    return { ...context, state: existing.status === "published" ? "current" : "skipped" };
  }
  if (existing && classification.freshness === "unknown") {
    // Missing provenance needs a read/review decision, never paid generation
    // merely to establish whether an already stored translation is current.
    return { ...context, state: "skipped" };
  }

  let ordinaryDraftIntent: import("./article-machine-english-draft").ArticleMachineEnglishDraftIntent | undefined;
  let ordinaryCoordinator: ReturnType<typeof import("./article-translation-ordinary-coordinator").createArticleTranslationOrdinaryCoordinator> | undefined;
  function ordinaryFields(operation: ArticleTranslationOrdinaryOperation, fallback: PremiumArticleBackfillState, errorCode?: TranslationErrorCode) {
    const result = operation.receipt?.phase === "finished" ? operation.receipt.result : null;
    const state: PremiumArticleBackfillState = result?.outcome === "succeeded" ? "translated" : result?.outcome === "dead_letter" ? "failed"
      : result?.outcome === "cancelled" || result?.outcome === "skipped" ? "skipped" : result?.outcome ?? fallback;
    const confirmedError = result ? result.errorCode ?? undefined : errorCode;
    return { ordinaryOperation: operation, state, ...(confirmedError ? { ordinaryErrorCode: confirmedError } : {}),
      ...(result?.persistence === "working-draft" ? { publication: "draft" as const, workingDraftVersion: result.workingDraftVersion!,
        workingDraftUpdatedAt: result.workingDraftUpdatedAt!, translationPersistence: "working-draft" as const, humanReview: "pending" as const } : {}) };
  }
  if (!input.privateRetry) {
    try {
      const { articlePrivateRetrySourceSnapshot } = await import("./article-private-retry-draft");
      const { getArticleMachineEnglishDraftContext } = await import("./article-machine-english-draft");
      ordinaryDraftIntent = {
        articleId: article.id,
        sourceHash,
        sourceUpdatedAt: article.updated_at,
        expectedEnglishUpdatedAt: existing?.updated_at ?? null,
        sourceSnapshot: articlePrivateRetrySourceSnapshot({ article: article as unknown as Record<string, unknown>,
          sourceUpdatedAt: article.updated_at, expectedEnglishUpdatedAt: existing?.updated_at ?? null }),
      };
      const admission = await getArticleMachineEnglishDraftContext(input.supabase, ordinaryDraftIntent);
      if (!admission.canGenerate) {
        return { ...context, state: admission.blockReason === "source_changed" ? "stale"
          : admission.blockReason === "english_changed" ? "conflict"
          : admission.blockReason === "manual_english" ? "manual" : "skipped",
          ...(admission.blockReason === "manual_english" ? { ownership: "manual" as const } : {}),
          error: admission.blockReason === "draft_exists" ? "An existing private author draft blocks translation"
            : "Translation source or English context changed before generation" };
      }
      const { createTranslationOperationBudget } = await import("./translation-operation-budget");
      const { createArticleTranslationOrdinaryCoordinator } = await import("./article-translation-ordinary-coordinator");
      input.operationBudget ??= createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300_000 });
      ordinaryCoordinator = createArticleTranslationOrdinaryCoordinator({ supabase: input.supabase, articleId: article.id,
        sourceHash, sourceUpdatedAt: article.updated_at, expectedEnglishUpdatedAt: existing?.updated_at ?? null,
        sourceSnapshot: ordinaryDraftIntent.sourceSnapshot, budget: input.operationBudget, run: input.ordinaryRun });
      input.expectedSourceHash = sourceHash;
      input.expectedSourceUpdatedAt = article.updated_at;
      input.privateRetry = ordinaryCoordinator.privateRetry;
    } catch (error) {
      unstable_rethrow(error);
      const { ArticleMachineEnglishDraftError } = await import("./article-machine-english-draft");
      return { ...context, state: error instanceof ArticleMachineEnglishDraftError && error.code === "unavailable"
        ? "not-configured" : "failed", error: "Private English draft context not confirmed" };
    }
  }
  if (input.privateRetry) {
    const expectedEnglish = input.privateRetry.expectedEnglishUpdatedAt;
    if (expectedEnglish !== null && !validPublishedArticleSourceRevision(expectedEnglish) ||
      !sameArticleRetryRevision(expectedEnglish, existing?.updated_at ?? null)) {
      return { ...context, state: "conflict", error: "English translation changed before retry admission" };
    }
    try {
      const { articlePrivateRetrySourceSnapshot } = await import("./article-private-retry-draft");
      articlePrivateRetrySourceSnapshot({
        article: article as unknown as Record<string, unknown>,
        sourceUpdatedAt: article.updated_at,
        expectedEnglishUpdatedAt: expectedEnglish,
      });
    } catch (error) {
      unstable_rethrow(error);
      return { ...context, state: "skipped", error: "Russian source cannot form a complete private retry snapshot" };
    }
    const draft = await input.supabase.from("article_working_drafts")
      .select("article_id,version").eq("article_id", article.id).maybeSingle();
    unstable_rethrow(draft.error);
    if (draft.error || draft.data !== null) {
      return { ...context, state: "skipped", error: draft.error
        ? "Private draft read failed before retry admission" : "An existing private author draft blocks retry" };
    }
    try {
      if (await input.privateRetry.admit({ sourceHash, sourceUpdatedAt: input.expectedSourceUpdatedAt!,
        expectedEnglishUpdatedAt: expectedEnglish }) !== true) {
        return { ...context, state: "skipped", retryAdmission: "existing",
          ...(ordinaryCoordinator ? ordinaryFields(ordinaryCoordinator.operation(), "skipped") : {}) };
      }
    } catch (error) {
      unstable_rethrow(error);
      if (!ordinaryCoordinator) throw error;
      const failure = await ordinaryCoordinator.failed(error);
      return { ...context, ...ordinaryFields(failure.operation, failure.errorCode === "translation_migration_required" ? "not-configured" : "failed", failure.errorCode),
        error: "Ordinary article translation admission was not confirmed" };
    }
  }

  const startedAt = Date.now();
  try {
    input.operationBudget?.startAttempt();
    const translated = await translateArticleSourceToEnglish({
      title: article.title,
      subtitle: article.subtitle || "",
      excerpt: article.excerpt || "",
      contentHtml: article.content_html || "",
      coverAlt: article.cover_alt || `Иллюстрация к статье «${article.title}»`,
      sources: normalizedLineItems(article.sources),
      bibliography: normalizedLineItems(article.bibliography),
      seoTitle: article.seo_title || article.title,
      seoDescription: article.seo_description || article.excerpt || "",
      seoKeywords: [...(article.seo_keywords || [])],
      ogTitle: article.og_title || article.seo_title || article.title,
      ogDescription:
        article.og_description ||
        article.seo_description ||
        article.excerpt ||
        "",
    }, {
      operationBudget: input.operationBudget,
      ...(input.privateRetry?.providerJournal === undefined ? {} : { providerJournal: input.privateRetry.providerJournal }),
    });

    const privateCandidate = async (englishSlug: string, categorySlug: string | null, now: string): Promise<PrivateArticleRetryCandidate> => {
      const { articleWorkingDraftEnglishEnvelope } = await import("../app/(dashboard)/articles/article-working-draft");
      const envelope = articleWorkingDraftEnglishEnvelope({
        title: translated.title,
        subtitle: translated.subtitle,
        excerpt: translated.excerpt,
        content_json: premiumArticleMachineContentJson({ sourceHash,
          model: translated.model, reviewerModel: translated.reviewModel,
          translatorRequestId: translated.requestId, reviewerRequestId: translated.reviewRequestId,
          generatedAt: now }, translated.content_html),
        content_html: translated.content_html,
        cover_alt: translated.cover_alt,
        slug: englishSlug,
        sources: translated.sources.map(text => ({ text })),
        bibliography: translated.bibliography.map(text => ({ text })),
        seo_title: translated.seo_title,
        seo_description: translated.seo_description,
        seo_keywords: translated.seo_keywords,
        canonical_url: existing?.canonical_url || articleCanonicalUrl(adminEnv.publicSiteUrl,
          englishSlug, categorySlug),
        og_title: translated.og_title,
        og_description: translated.og_description,
        status: "draft",
        source_content_hash: sourceHash,
        reviewed_at: null,
        approved_at: null,
        published_at: null,
        deleted_at: null,
      });
      if (envelope.mode !== "save") throw new Error("Private retry English draft was not validated");
      return {
        englishPayload: envelope.payload,
        model: translated.model,
        reviewerModel: translated.reviewModel,
        requestId: translated.requestId,
        inputTokens: translated.inputTokens,
        outputTokens: translated.outputTokens,
        durationMs: Date.now() - startedAt,
      };
    };
    let staged: { candidate: PrivateArticleRetryCandidate; englishSlug: string; generatedAt: string } | undefined;
    if (input.privateRetry?.stageCandidate) {
      const category = Array.isArray(article.categories) ? article.categories[0] : article.categories;
      const englishSlug = existing?.slug || createSlug(translated.title) || `article-${article.id.slice(0, 8)}`;
      const generatedAt = new Date().toISOString();
      staged = { candidate: await privateCandidate(englishSlug, category?.slug || null, generatedAt), englishSlug, generatedAt };
      await input.privateRetry.stageCandidate(staged.candidate);
    }

    const latest = await input.supabase
      .from("articles")
      .select("updated_at")
      .eq("id", article.id)
      .is("deleted_at", null)
      .maybeSingle();
    unstable_rethrow(latest.error);
    if (staged) {
      if (latest.error) throw latest.error;
      if (latest.error !== null) {
        throw new Error("Russian source read result was not confirmed after candidate staging");
      }
      if (latest.data !== null && !validPublishedArticleSourceRevision(latest.data?.updated_at)) {
        throw new Error("Russian source revision read was not confirmed after candidate staging");
      }
    }
    if (
      latest.error ||
      !latest.data ||
      (input.privateRetry
        ? !sameArticleRetryRevision(latest.data.updated_at, article.updated_at)
        : latest.data.updated_at !== article.updated_at)
    ) {
      const ordinaryOperation = ordinaryCoordinator ? await ordinaryCoordinator.complete("conflict") : undefined;
      return { ...context, state: "conflict", error: "Russian source changed during translation",
        ...(ordinaryOperation ? ordinaryFields(ordinaryOperation, "conflict") : {}) };
    }

    const category = Array.isArray(article.categories)
      ? article.categories[0]
      : article.categories;
    const englishSlug = staged?.englishSlug ||
      existing?.slug ||
      createSlug(translated.title) ||
      `article-${article.id.slice(0, 8)}`;
    const now = staged?.generatedAt || new Date().toISOString();
    if (input.privateRetry) {
      const candidate = staged?.candidate ?? await privateCandidate(englishSlug, category?.slug || null, now);
      const saved = await input.privateRetry.persist(candidate);
      if (saved.confirmed !== true || !Number.isSafeInteger(saved.draftVersion) || Number(saved.draftVersion) < 1) {
        return { ...context, state: "failed", error: "Private retry draft save result not confirmed",
          ...(ordinaryCoordinator ? ordinaryFields(ordinaryCoordinator.operation(), "failed") : {}) };
      }
      const ordinaryOperation = ordinaryCoordinator ? await ordinaryCoordinator.complete("translated") : undefined;
      return { ...context, state: "translated", ownership: "machine", freshness: "current",
        publication: "draft", model: translated.model, reviewerModel: translated.reviewModel,
        workingDraftVersion: saved.draftVersion,
        ...(ordinaryOperation ? ordinaryFields(ordinaryOperation, "translated") : {}) };
    }
    throw new Error("Translation draft context unavailable");
  } catch (error) {
    unstable_rethrow(error);
    if (ordinaryCoordinator) {
      const failure = await ordinaryCoordinator.failed(error);
      return { ...context, ...ordinaryFields(failure.operation, "failed", failure.errorCode),
        ...(failure.operation.receipt?.phase === "finished" && failure.operation.receipt.result?.outcome === "succeeded"
          ? {} : { error: failure.operation.receipt?.phase === "finished" &&
            ["conflict", "stale"].includes(failure.operation.receipt.result?.outcome ?? "")
            ? "Article source or English changed during translation" : "Ordinary article translation result was not confirmed" }) };
    }
    // An accepted provider request can have an unknown outcome. Only the
    // durable item operation may reconcile it; no canonical-write fallback.
    if (input.privateRetry) throw error;
    const message =
      error instanceof Error ? error.message : "premium article translation failed";
    const runtime = premiumTranslationRuntimeMetadata();
    const audit = await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "article.premium_translation.backfill.failed",
      entity_type: "article",
      entity_id: article.id,
      metadata: {
        locale: "en",
        provider: runtime.provider,
        model: runtime.model,
        reviewer_model: runtime.reviewerModel,
        error_code: translationErrorCode(message),
        duration_ms: Date.now() - startedAt,
      },
    });
    unstable_rethrow(audit.error);
    return { ...context, state: "failed", error: message };
  }
}
