"use server";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { prepareArticlePublicationIntent } from "../../../lib/article-publication-intent";
import { captureArticleOperationIntent } from "../../../lib/article-operation-intent";
import { articleOperationSaveResult, type ArticleOperationResultContext } from "../../../lib/article-operation-result";
import { parseArticleSaveResult, type ArticleSaveResult } from "../../../lib/article-save-result";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { ArticleOperationRpcError, lookupArticleOperationRpc } from "./article-operation-rpc";
import { saveArticleAction as saveCanonicalArticleAction } from "./save-article-action";

function operationContext(formData: FormData) {
  const ids = formData.getAll("article_operation_id");
  const id = ids.length === 1 ? z.string().uuid().safeParse(ids[0]) : null;
  const submittedIntent = id?.success ? captureArticleOperationIntent(formData) : null;
  return id?.success && submittedIntent ? { operationId: id.data, submittedIntent } : null;
}

async function operationClient() {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  return createServerSupabaseClient();
}

function boundResult(value: unknown, context: ArticleOperationResultContext): ArticleSaveResult {
  const result = parseArticleSaveResult(value, {
    articleId: context.submittedIntent.entityId,
    articleUpdatedAt: context.submittedIntent.expectedUpdatedAt,
    englishUpdatedAt: context.submittedIntent.englishExpectedUpdatedAt,
    workingDraftVersion: context.submittedIntent.workingDraftVersion,
  });
  // A result already bearing another operation ID must never be rebound.
  if (!result || result.operationId !== undefined
    && result.operationId.toLowerCase() !== context.operationId.toLowerCase()) {
    return { outcome: "unknown-outcome", operationId: context.operationId };
  }
  return { ...result, operationId: context.operationId };
}

async function savedOperation(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  context: ArticleOperationResultContext,
) {
  const lookup = await lookupArticleOperationRpc(supabase, context);
  return lookup.outcome === "found" ? articleOperationSaveResult(lookup.result, context) : null;
}

/** Adapt the editor intent without changing the guarded atomic save pipeline. */
export async function saveArticleAction(formData: FormData) {
  prepareArticlePublicationIntent(formData);
  if (!formData.has("article_operation_id")) return saveCanonicalArticleAction(formData);
  const context = operationContext(formData);
  if (!context) {
    const id = z.string().uuid().safeParse(formData.get("article_operation_id"));
    return { outcome: "rejected", reason: "validation", ...(id.success ? { operationId: id.data } : {}) } satisfies ArticleSaveResult;
  }
  formData.set("article_result_mode", "receipt");
  const unknown = { outcome: "unknown-outcome", operationId: context.operationId } satisfies ArticleSaveResult;
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await operationClient();
    if (!supabase) return unknown;
    const saved = await savedOperation(supabase, context);
    if (saved) return saved;
  } catch (error) {
    unstable_rethrow(error);
    // An unavailable lookup cannot prove an earlier same-ID command failed.
    console.error("article-operation-action-failed", { phase: "initial-lookup" });
    return unknown;
  }
  let result: ArticleSaveResult;
  try {
    result = boundResult(await saveCanonicalArticleAction(formData, context), context);
  } catch (error) {
    unstable_rethrow(error);
    result = error instanceof ArticleOperationRpcError && error.category === "intent-conflict"
      ? { outcome: "conflict", scope: "article", operationId: context.operationId }
      : error instanceof ArticleOperationRpcError && error.category === "permission"
        ? { outcome: "rejected", reason: "permission", operationId: context.operationId }
        : error instanceof ArticleOperationRpcError && error.category === "capability-unavailable"
          ? { outcome: "dependency-unavailable", operationId: context.operationId } : unknown;
    console.error("article-operation-action-failed", { phase: "save" });
  }
  if (result.outcome === "saved") return result;
  // The same command may have committed between the initial lookup and CAS.
  // Read the receipt once; never retry a producer or repeat publication effects.
  try {
    const saved = await savedOperation(supabase, context);
    if (saved) return saved;
  } catch (error) {
    unstable_rethrow(error);
    console.error("article-operation-action-failed", { phase: "final-lookup" });
    return unknown;
  }
  return result;
}

/** Reconcile the frozen submission only; no canonical save or mutation runs. */
export async function checkArticleOperationAction(formData: FormData): Promise<ArticleSaveResult> {
  prepareArticlePublicationIntent(formData);
  const context = operationContext(formData);
  const id = z.string().uuid().safeParse(formData.get("article_operation_id"));
  const unknown = { outcome: "unknown-outcome", ...(id.success ? { operationId: id.data } : {}) } satisfies ArticleSaveResult;
  if (!context) return unknown;
  try {
    const supabase = await operationClient();
    return supabase ? await savedOperation(supabase, context) ?? unknown : unknown;
  } catch (error) {
    unstable_rethrow(error);
    console.error("article-operation-action-failed", { phase: "check" });
    return unknown;
  }
}
