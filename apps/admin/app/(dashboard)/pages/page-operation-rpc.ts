import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { compareArticleSaveRevisions } from "../../../lib/article-save-result";
import { parsePageOperationIntent } from "../../../lib/page-operation-intent";
import { pageOperationStatus, parsePageOperationResult, type PageOperationResult, type PageOperationResultContext } from "../../../lib/page-operation-result";

export type PageOperationRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export type PageOperationRpcInput = { payload: Record<string, unknown>; expectedUpdatedAt: string };
export type PageOperationRpcCategory = "capability-unavailable" | "permission" | "intent-conflict" | "conflict" | "dependency-unavailable" | "unknown";
export type PageOperationLookupResult = { outcome: "found"; result: PageOperationResult } | { outcome: "not-found" };

const messages: Record<PageOperationRpcCategory, string> = {
  "capability-unavailable": "Подтверждение операций страницы сейчас недоступно. Повтор сохранения остановлен.",
  permission: "Недостаточно прав для операции со страницей.",
  "intent-conflict": "Операция не соответствует первоначально отправленному запросу.",
  conflict: "Версия страницы изменилась. Повтор сохранения остановлен.",
  "dependency-unavailable": "Не удалось проверить результат операции. Повтор сохранения остановлен.",
  unknown: "Не удалось подтвердить результат операции. Повтор сохранения остановлен.",
};
export class PageOperationRpcError extends Error {
  readonly category: PageOperationRpcCategory;
  constructor(category: PageOperationRpcCategory) {
    super(messages[category]); this.name = "PageOperationRpcError"; this.category = category;
  }
}

const payloadSchema = z.object({
  title: z.string().min(2).max(180), slug: z.string().min(2).max(120), excerpt: z.string().max(700),
  content_html: z.string().max(2_000_000), content_json: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "published", "hidden"]), seo_title: z.string().max(180), seo_description: z.string().max(400),
  canonical_url: z.string().url(), allow_indexing: z.boolean(), updated_by: z.string().uuid(),
}).strict();
const stamp = z.string().max(80).datetime({ offset: true });

function validContext(context: PageOperationResultContext) {
  return Boolean(context && z.string().uuid().safeParse(context.operationId).success && parsePageOperationIntent(context.submittedIntent));
}

function fault(error: unknown, lookup: boolean, confirmedError = true): PageOperationRpcError {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : "";
  const category: PageOperationRpcCategory = !confirmedError ? lookup ? "dependency-unavailable" : "unknown"
    : code === "PGRST202" || code === "42883" ? "capability-unavailable"
      : code === "42501" ? "permission"
        : code === "22023" && ["EDITOR_OPERATION_CONFLICT", "EDITOR_OPERATION_INTENT_INVALID"].includes(message) ? "intent-conflict"
          : code === "40001" && message === "PAGE_CONFLICT" ? "conflict"
            : lookup ? "dependency-unavailable" : "unknown";
  return new PageOperationRpcError(category);
}

async function callRpc(client: PageOperationRpcClient, name: string, args: Record<string, unknown>, lookup: boolean) {
  let response;
  try { response = await client.rpc(name, args); }
  catch (error) { unstable_rethrow(error); throw fault(error, lookup, false); }
  if (!response || typeof response !== "object" || Array.isArray(response)
    || !Object.hasOwn(response, "data") || !Object.hasOwn(response, "error")) throw fault(null, lookup, false);
  if (response.error !== null) throw fault(response.error, lookup, response.data === null);
  return response.data;
}

/** One guarded transactional producer, with no legacy retry or second write. */
export async function savePageOperationRpc(client: PageOperationRpcClient, input: PageOperationRpcInput,
  context: PageOperationResultContext): Promise<PageOperationResult> {
  if (!validContext(context) || !input || !stamp.safeParse(input.expectedUpdatedAt).success
    || compareArticleSaveRevisions(input.expectedUpdatedAt, context.submittedIntent.expectedUpdatedAt) !== 0
    || !payloadSchema.safeParse(input.payload).success || input.payload.status !== pageOperationStatus(context.submittedIntent)) {
    throw new PageOperationRpcError("intent-conflict");
  }
  const data = await callRpc(client, "save_page_operation", {
    p_payload: input.payload, p_expected_updated_at: input.expectedUpdatedAt,
    p_operation_id: context.operationId, p_submitted_intent: context.submittedIntent,
  }, false);
  const result = parsePageOperationResult(data, context);
  if (!result) throw fault(null, false, false);
  return result;
}

/** Successful exact SQL null is only not-found, never proof that a write failed. */
export async function lookupPageOperationRpc(client: PageOperationRpcClient,
  context: PageOperationResultContext): Promise<PageOperationLookupResult> {
  if (!validContext(context)) throw new PageOperationRpcError("intent-conflict");
  const data = await callRpc(client, "get_editor_operation_result", {
    p_operation_id: context.operationId, p_submitted_intent: context.submittedIntent,
  }, true);
  if (data === null) return { outcome: "not-found" };
  const result = parsePageOperationResult(data, context);
  if (!result || !result.replayed) throw fault(null, true, false);
  return { outcome: "found", result };
}
