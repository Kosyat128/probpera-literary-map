import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { requestArticleMutation, UnconfirmedArticleSaveError } from "./article-save-result";

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

type ArticleRpcError = { code?: string; message?: string };

function rpcErrorMessage(error: ArticleRpcError, status: number) {
  if (status === 402) return "Редакционная база временно ограничила запросы. Повторите сохранение позже.";
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
  if (message.includes("ARTICLE_NOT_FOUND")) {
    return "Статья не найдена или больше недоступна. Вернитесь к списку статей и откройте её заново.";
  }
  if (
    message.includes("REDIRECT_LIVE_ROUTE_COLLISION") ||
    message.includes("REDIRECT_COLLISION_OR_CHAIN") ||
    message.includes("REDIRECT_SOURCE_EXISTS")
  ) {
    return "Не удалось изменить адрес статьи: прежний адрес связан с другой страницей или перенаправлением. Проверьте адрес и раздел SEO. Изменения не опубликованы.";
  }
  if (message.includes("REDIRECT_WRITE_CONFLICT")) {
    return "Перенаправление уже изменено в другой вкладке. Обновите статью перед повторным выпуском.";
  }
  if (message.includes("REDIRECT_INVALID_PATH") || message.includes("REDIRECT_SELF_REFERENCE")) {
    return "Проверьте адрес статьи и перенаправление в разделе SEO. Изменения не опубликованы.";
  }
  if (
    message.includes("PROMOTION_INPUT_INVALID") ||
    message.includes("PROMOTION_STATUS_REQUIRED")
  ) {
    return "Не удалось безопасно подтвердить выпуск статьи. Обновите страницу и повторите действие.";
  }
  if (error?.code === "42501") {
    return "Сервер отклонил операцию сохранения статьи. Текст не опубликован; код ошибки: ARTICLE_SAVE_PERMISSION.";
  }
  if (error?.code === "23505") {
    return "Адрес статьи или перевода уже занят. Укажите уникальный адрес и повторите сохранение.";
  }
  if (error?.code === "23503") {
    return "Связанная запись больше недоступна. Проверьте выбранную рубрику перед сохранением.";
  }
  if (status === 401 || status === 403) return "Недостаточно прав для сохранения статьи. Проверьте доступ и повторите попытку.";
  return "Не удалось сохранить статью. Изменения не опубликованы; повторите сохранение позже.";
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
  error: ArticleRpcError | null | undefined,
  status: number,
  expectedArticleId: string | null,
  operation: "save_article_bundle" | "promote_article_working_draft"
): ArticleBundleRpcResult {
  if (error) {
    // Retain only a bounded SQLSTATE/PostgREST code, never payloads, SQL or tokens.
    console.error("article-publication-rpc-failed", {
      operation,
      code: /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/u.test(error.code || "")
        ? error.code
        : "unknown",
    });
    throw new Error(rpcErrorMessage(error, status));
  }

  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
  if (!row || typeof row !== "object" || !("article_id" in row)) {
    throw new UnconfirmedArticleSaveError();
  }

  const result = row as Record<string, unknown>;
  const articleId = result.article_id;
  const articleUpdatedAt = result.article_updated_at;
  if (typeof articleId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(articleId) ||
      (expectedArticleId && articleId.toLowerCase() !== expectedArticleId.toLowerCase()) ||
      typeof articleUpdatedAt !== "string" || !Number.isFinite(Date.parse(articleUpdatedAt))) {
    throw new UnconfirmedArticleSaveError();
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
  const args = articleBundleRpcArgs(input);
  const { data, error, status } = await requestArticleMutation(() => supabase.rpc("save_article_bundle", args));
  return parseArticleBundleRpcResult(data, error, status, input.articleId, "save_article_bundle");
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
  const args = {
    ...articleBundleRpcArgs(input),
    p_expected_working_draft_version: input.expectedWorkingDraftVersion,
  };
  const { data, error, status } = await requestArticleMutation(() => supabase.rpc("promote_article_working_draft", args));
  return parseArticleBundleRpcResult(data, error, status, input.articleId, "promote_article_working_draft");
}
