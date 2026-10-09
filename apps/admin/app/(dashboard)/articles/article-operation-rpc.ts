import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { parseArticleOperationIntent } from "../../../lib/article-operation-intent";
import {
  parseArticleOperationResult,
  type ArticleOperationResult,
  type ArticleOperationResultContext,
} from "../../../lib/article-operation-result";

export type ArticleOperationRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};
export type ArticleOperationRpcCategory = "capability-unavailable" | "permission" | "intent-conflict"
  | "dependency-unavailable" | "unknown";

const safeMessages: Record<ArticleOperationRpcCategory, string> = {
  "capability-unavailable": "Подтверждение операций сейчас недоступно. Повтор сохранения остановлен.",
  permission: "Недостаточно прав для операции со статьёй.",
  "intent-conflict": "Операция не соответствует первоначально отправленному намерению.",
  "dependency-unavailable": "Не удалось проверить результат операции. Повтор сохранения остановлен.",
  unknown: "Не удалось подтвердить результат операции. Повтор сохранения остановлен.",
};
export class ArticleOperationRpcError extends Error {
  readonly category: ArticleOperationRpcCategory;
  constructor(category: ArticleOperationRpcCategory) {
    super(safeMessages[category]);
    this.name = "ArticleOperationRpcError";
    this.category = category;
  }
}

const operationNames = {
  save_article_bundle: "save_article_bundle_operation",
  save_article_working_draft: "save_article_working_draft_operation",
  promote_article_working_draft: "promote_article_working_draft_operation",
} as const;
type ArticleWriteOperation = keyof typeof operationNames;
const operationPersistence = { save_article_bundle: "article-bundle", save_article_working_draft: "working-draft", promote_article_working_draft: "working-draft-promotion" } as const;
export type ArticleOperationLookupResult =
  | { outcome: "found"; result: ArticleOperationResult }
  | { outcome: "not-found" };

function validContext(context: ArticleOperationResultContext) {
  return Boolean(context && z.string().uuid().safeParse(context.operationId).success
    && parseArticleOperationIntent(context.submittedIntent));
}
function fault(error: unknown, operation: string, lookup: boolean, confirmedError = true): ArticleOperationRpcError {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  const category: ArticleOperationRpcCategory = !confirmedError
    ? lookup ? "dependency-unavailable" : "unknown"
    : code === "PGRST202" || code === "42883"
    ? "capability-unavailable"
    : code === "42501"
      ? "permission"
      : code === "22023" && (message === "EDITOR_OPERATION_CONFLICT" || message === "EDITOR_OPERATION_INTENT_INVALID")
        ? "intent-conflict"
        : lookup ? "dependency-unavailable" : "unknown";
  console.error("article-operation-rpc-failed", {
    operation,
    code: /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/u.test(code) ? code : "unknown",
  });
  return new ArticleOperationRpcError(category);
}

async function callRpc(
  supabase: ArticleOperationRpcClient,
  operation: string,
  args: Record<string, unknown>,
  lookup: boolean
) {
  let response;
  try {
    response = await supabase.rpc(operation, args);
  } catch (error) {
    unstable_rethrow(error);
    throw fault(error, operation, lookup);
  }
  if (!response || typeof response !== "object" || Array.isArray(response)
    || !Object.hasOwn(response, "data") || !Object.hasOwn(response, "error")) {
    throw fault(response?.error, operation, lookup, false);
  }
  if (response.error !== null) {
    // A PostgREST refusal has null data. Contradictory or missing data cannot
    // turn an unconfirmed write into a known prewrite refusal.
    throw fault(response.error, operation, lookup, response.data === null);
  }
  return response.data;
}

/** Use only the guarded operation RPC; never retry through a legacy write. */
export async function saveArticleOperationRpc(
  supabase: ArticleOperationRpcClient,
  operation: ArticleWriteOperation,
  args: Record<string, unknown>,
  context: ArticleOperationResultContext,
): Promise<ArticleOperationResult> {
  if (!validContext(context) || !Object.hasOwn(operationNames, operation)
    || !args || typeof args !== "object" || Array.isArray(args)
    || Object.hasOwn(args, "p_operation_id") || Object.hasOwn(args, "p_submitted_intent")) {
    throw new ArticleOperationRpcError("intent-conflict");
  }
  const name = operationNames[operation];
  const data = await callRpc(supabase, name, {
    ...args, p_operation_id: context.operationId, p_submitted_intent: context.submittedIntent,
  }, false);
  const result = parseArticleOperationResult(data, context);
  if (!result || result.persistence !== operationPersistence[operation]) throw fault(null, name, false);
  return result;
}

/** Only a successful exact SQL null means no matching saved operation. */
export async function lookupArticleOperationRpc(
  supabase: ArticleOperationRpcClient,
  context: ArticleOperationResultContext,
): Promise<ArticleOperationLookupResult> {
  if (!validContext(context)) throw new ArticleOperationRpcError("intent-conflict");
  const name = "get_editor_operation_result";
  const data = await callRpc(supabase, name, {
    p_operation_id: context.operationId, p_submitted_intent: context.submittedIntent,
  }, true);
  if (data === null) return { outcome: "not-found" };
  const result = parseArticleOperationResult(data, context);
  if (!result || !result.replayed) throw fault(null, name, true);
  return { outcome: "found", result };
}


