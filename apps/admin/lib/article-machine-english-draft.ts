import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { articleWorkingDraftEnglishEnvelope, parseArticleWorkingDraft } from "../app/(dashboard)/articles/article-working-draft";
import { isMachineOwnedEnglishArticleTranslation } from "./article-translation-machine-ownership";
import { sameArticleRetryRevision } from "./article-retry-revision";

export type ArticleMachineEnglishDraftIntent = {
  articleId: string;
  sourceHash: string;
  sourceUpdatedAt: string;
  sourceSnapshot: Record<string, unknown>;
  expectedEnglishUpdatedAt: string | null;
};

const revision = z.string().datetime({ offset: true });
const identity = {
  version: z.literal(1),
  articleId: z.string().uuid(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
  sourceUpdatedAt: revision,
  englishUpdatedAt: revision.nullable(),
};
const contextSchema = z.object({
  ...identity,
  canGenerate: z.boolean(),
  blockReason: z.enum(["source_changed", "english_changed", "manual_english", "draft_exists"]).nullable(),
}).strict();
const receiptSchema = z.object({
  ...identity,
  workingDraftVersion: z.literal(1),
  workingDraftUpdatedAt: revision,
  scope: z.literal("english-only"),
  publication: z.literal("unchanged"),
  humanReview: z.literal("pending"),
  persistence: z.literal("working-draft"),
}).strict();

export class ArticleMachineEnglishDraftError extends Error {
  constructor(readonly phase: "context" | "save", readonly code: "conflict" | "unavailable" | "unconfirmed" | "invalid" | "failed") {
    super(code === "conflict" ? "Article or English draft changed concurrently"
      : code === "unavailable" ? "Private English draft storage unavailable"
      : code === "invalid" ? "Private English draft input invalid"
      : phase === "save" ? "Private English draft save result not confirmed"
      : "Private English draft context not confirmed");
  }
}

function intentArgs(intent: ArticleMachineEnglishDraftIntent) {
  if (!z.string().uuid().safeParse(intent.articleId).success ||
    !identity.sourceHash.safeParse(intent.sourceHash).success ||
    !revision.safeParse(intent.sourceUpdatedAt).success ||
    !revision.nullable().safeParse(intent.expectedEnglishUpdatedAt).success) {
    throw new ArticleMachineEnglishDraftError("context", "invalid");
  }
  try {
    parseArticleWorkingDraft({
      article_id: intent.articleId,
      base_article_updated_at: intent.sourceUpdatedAt,
      payload: intent.sourceSnapshot,
      english_payload: { mode: "disabled" },
      expected_english_updated_at: intent.expectedEnglishUpdatedAt,
      draft_scope: "bundle",
      draft_english_enabled: false,
      version: 1,
      updated_at: intent.sourceUpdatedAt,
    });
    if (new TextEncoder().encode(JSON.stringify(intent.sourceSnapshot)).byteLength > 5_242_880) throw new Error();
  } catch (error) {
    unstable_rethrow(error);
    throw new ArticleMachineEnglishDraftError("context", "invalid");
  }
  return {
    p_article_id: intent.articleId,
    p_source_hash: intent.sourceHash,
    p_source_updated_at: intent.sourceUpdatedAt,
    p_source_snapshot: intent.sourceSnapshot,
    p_expected_english_updated_at: intent.expectedEnglishUpdatedAt,
  };
}

function bound(value: z.infer<typeof contextSchema> | z.infer<typeof receiptSchema>, intent: ArticleMachineEnglishDraftIntent) {
  return value.articleId.toLowerCase() === intent.articleId.toLowerCase() &&
    value.sourceHash === intent.sourceHash &&
    sameArticleRetryRevision(value.sourceUpdatedAt, intent.sourceUpdatedAt) &&
    sameArticleRetryRevision(value.englishUpdatedAt, intent.expectedEnglishUpdatedAt);
}

async function rpc(supabase: SupabaseClient, name: string, args: Record<string, unknown>, phase: "context" | "save") {
  let response;
  try {
    response = await supabase.rpc(name, args);
  } catch (error) {
    unstable_rethrow(error);
    throw new ArticleMachineEnglishDraftError(phase, "unconfirmed");
  }
  unstable_rethrow(response.error);
  if (response.error) {
    const code = response.error.code;
    throw new ArticleMachineEnglishDraftError(phase, code === "40001" ? "conflict"
      : phase === "context" && (code === "42883" || code === "PGRST202") ? "unavailable" : "failed");
  }
  if (response.error !== null) throw new ArticleMachineEnglishDraftError(phase, "unconfirmed");
  return response.data;
}

export async function getArticleMachineEnglishDraftContext(supabase: SupabaseClient, intent: ArticleMachineEnglishDraftIntent) {
  const value = await rpc(supabase, "get_article_machine_english_draft_context", intentArgs(intent), "context");
  const parsed = contextSchema.safeParse(value);
  if (!parsed.success || !bound(parsed.data, intent) || parsed.data.canGenerate !== (parsed.data.blockReason === null)) {
    throw new ArticleMachineEnglishDraftError("context", "unconfirmed");
  }
  return parsed.data;
}

export async function saveArticleMachineEnglishDraft(supabase: SupabaseClient, intent: ArticleMachineEnglishDraftIntent,
  englishPayload: Record<string, unknown>) {
  const args = intentArgs(intent);
  let envelope;
  try {
    envelope = articleWorkingDraftEnglishEnvelope(englishPayload);
    if (envelope.mode !== "save" || envelope.payload.status !== "draft" ||
      envelope.payload.source_content_hash !== intent.sourceHash ||
      envelope.payload.reviewed_at !== null || envelope.payload.approved_at !== null ||
      envelope.payload.published_at !== null || envelope.payload.deleted_at !== null ||
      !isMachineOwnedEnglishArticleTranslation({ contentJson: envelope.payload.content_json, sourceContentHash: intent.sourceHash }) ||
      new TextEncoder().encode(JSON.stringify(envelope)).byteLength > 5_242_880) throw new Error();
  } catch (error) {
    unstable_rethrow(error);
    throw new ArticleMachineEnglishDraftError("save", "invalid");
  }
  const value = await rpc(supabase, "save_article_machine_english_draft", { ...args, p_english_payload: envelope }, "save");
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || !bound(parsed.data, intent)) throw new ArticleMachineEnglishDraftError("save", "unconfirmed");
  return parsed.data;
}
