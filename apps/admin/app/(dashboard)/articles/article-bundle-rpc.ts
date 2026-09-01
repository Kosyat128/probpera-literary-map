import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;

export type ArticleBundleEnglishMode = "none" | "save" | "stale";

export type ArticleBundleRpcInput = {
  articleId: string | null;
  expectedArticleUpdatedAt: string | null;
  articlePayload: Record<string, unknown>;
  englishMode: ArticleBundleEnglishMode;
  englishPayload: Record<string, unknown> | null;
  expectedEnglishUpdatedAt: string | null;
  redirectSourcePath: string | null;
  redirectDestinationPath: string | null;
  replaceHomepage: boolean;
  auditAction: string;
  auditMetadata: Record<string, unknown>;
  socialPublishRequested: boolean;
  socialMetadata: Record<string, unknown>;
};

export type ArticleBundleRpcResult = {
  articleId: string;
  articleUpdatedAt: string;
  englishUpdatedAt: string | null;
  homepageReplaced: number;
};

function rpcErrorMessage(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "").trim();
  if (message.includes("WORKING_DRAFT_CONFLICT")) {
    return "Рабочий черновик уже изменён в другой вкладке. Обновите страницу и повторите выпуск.";
  }
  if (message.includes("ARTICLE_CONFLICT")) {
    return "Статья уже изменена в другой вкладке. Обновите страницу и повторите правку.";
  }
  if (message.includes("ENGLISH_CONFLICT")) {
    return "Английская версия уже изменена в другой вкладке. Обновите страницу и повторите правку.";
  }
  if (message.includes("STAFF_ACCESS_REQUIRED")) {
    return "Недостаточно прав для сохранения статьи.";
  }
  if (
    message.includes("PROMOTION_INPUT_INVALID") ||
    message.includes("PROMOTION_STATUS_REQUIRED")
  ) {
    return "Не удалось безопасно подтвердить выпуск статьи. Обновите страницу и повторите действие.";
  }
  return "Не удалось атомарно сохранить статью и английскую версию.";
}

function articleBundleRpcArgs(input: ArticleBundleRpcInput) {
  return {
    p_article_id: input.articleId,
    p_expected_article_updated_at: input.expectedArticleUpdatedAt,
    p_article_payload: input.articlePayload,
    p_english_mode: input.englishMode,
    p_english_payload: input.englishPayload,
    p_expected_english_updated_at: input.expectedEnglishUpdatedAt,
    p_redirect_source_path: input.redirectSourcePath,
    p_redirect_destination_path: input.redirectDestinationPath,
    p_replace_homepage: input.replaceHomepage,
    p_audit_action: input.auditAction,
    p_audit_metadata: input.auditMetadata,
    p_social_publish_requested: input.socialPublishRequested,
    p_social_metadata: input.socialMetadata,
  };
}

function parseArticleBundleRpcResult(
  data: unknown,
  error: { message?: string } | null | undefined
): ArticleBundleRpcResult {
  if (error) {
    throw new Error(rpcErrorMessage(error));
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("article_id" in row)) {
    throw new Error("Атомарное сохранение не вернуло идентификатор статьи.");
  }

  const result = row as Record<string, unknown>;
  const articleId = String(result.article_id || "");
  const articleUpdatedAt = String(result.article_updated_at || "");
  if (!articleId || !articleUpdatedAt) {
    throw new Error("Атомарное сохранение вернуло неполный результат.");
  }

  return {
    articleId,
    articleUpdatedAt,
    englishUpdatedAt: result.english_updated_at
      ? String(result.english_updated_at)
      : null,
    homepageReplaced: Number(result.homepage_replaced || 0),
  };
}

export async function saveArticleBundleRpc(
  supabase: ServerSupabaseClient,
  input: ArticleBundleRpcInput
): Promise<ArticleBundleRpcResult> {
  const { data, error } = await supabase.rpc(
    "save_article_bundle",
    articleBundleRpcArgs(input)
  );
  return parseArticleBundleRpcResult(data, error);
}

export async function promoteArticleWorkingDraftRpc(
  supabase: ServerSupabaseClient,
  input: ArticleBundleRpcInput & { expectedWorkingDraftVersion: number }
): Promise<ArticleBundleRpcResult> {
  if (
    !input.articleId ||
    !input.expectedArticleUpdatedAt ||
    !Number.isInteger(input.expectedWorkingDraftVersion) ||
    input.expectedWorkingDraftVersion < 0
  ) {
    throw new Error(
      "Не удалось безопасно подтвердить выпуск статьи. Обновите страницу и повторите действие."
    );
  }
  const { data, error } = await supabase.rpc(
    "promote_article_working_draft",
    {
      ...articleBundleRpcArgs(input),
      p_expected_working_draft_version: input.expectedWorkingDraftVersion,
    }
  );
  return parseArticleBundleRpcResult(data, error);
}
