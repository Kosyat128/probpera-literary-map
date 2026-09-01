import { z } from "zod";

import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;

const lineItemSchema = z.object({ text: z.string().max(1_000) }).strict();
const editorDocumentSchema = z.record(z.string(), z.unknown());

const articlePayloadSchema = z
  .object({
    title: z.string().min(3).max(240),
    subtitle: z.string().max(360),
    excerpt: z.string().max(700),
    slug: z.string().min(1).max(180),
    content_html: z.string().max(2_000_000),
    content_json: editorDocumentSchema,
    category_id: z.string().uuid().nullable(),
    status: z.enum(["draft", "review"]),
    scheduled_at: z.null(),
    published_at: z.null(),
    cover_external_url: z.string().url().nullable(),
    cover_alt: z.string().max(500),
    legacy_path: z.string().nullable(),
    seo_title: z.string().max(180),
    seo_description: z.string().max(400),
    seo_keywords: z.array(z.string().max(80)).max(30),
    canonical_url: z.string().url(),
    og_title: z.string().max(180),
    og_description: z.string().max(400),
    allow_indexing: z.boolean(),
    sources: z.array(lineItemSchema).max(100),
    bibliography: z.array(lineItemSchema).max(100),
    featured: z.boolean(),
    show_on_homepage: z.boolean(),
    pinned: z.boolean(),
  })
  .strict();

const englishPayloadSchema = z
  .object({
    title: z.string().min(3).max(240),
    subtitle: z.string().max(360),
    excerpt: z.string().max(700),
    content_json: editorDocumentSchema,
    content_html: z.string().max(2_000_000),
    cover_alt: z.string().max(500),
    slug: z.string().min(2).max(180),
    sources: z.array(lineItemSchema).max(100),
    bibliography: z.array(lineItemSchema).max(100),
    seo_title: z.string().max(180),
    seo_description: z.string().max(400),
    seo_keywords: z.array(z.string().max(80)).max(30),
    canonical_url: z.string().url().nullable(),
    og_title: z.string().max(180),
    og_description: z.string().max(400),
    status: z.enum([
      "draft",
      "review",
      "approved",
      "published",
      "stale",
      "archived",
    ]),
    source_content_hash: z.string().min(1),
    reviewed_at: z.string().datetime({ offset: true }).nullable(),
    approved_at: z.string().datetime({ offset: true }).nullable(),
    published_at: z.string().datetime({ offset: true }).nullable(),
    deleted_at: z.null(),
  })
  .strict();

const englishEnvelopeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("disabled") }).strict(),
  z
    .object({
      mode: z.literal("save"),
      payload: englishPayloadSchema,
    })
    .strict(),
]);

const workingDraftSchema = z
  .object({
    article_id: z.string().uuid(),
    base_article_updated_at: z.string().datetime({ offset: true }),
    payload: articlePayloadSchema,
    english_payload: englishEnvelopeSchema,
    expected_english_updated_at: z
      .string()
      .datetime({ offset: true })
      .nullable(),
    version: z.coerce.number().int().positive(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type ArticleWorkingDraft = z.infer<typeof workingDraftSchema>;
export type ArticleWorkingDraftEnglishEnvelope = z.infer<
  typeof englishEnvelopeSchema
>;

export function articleWorkingDraftEnglishEnvelope(
  payload: Record<string, unknown> | null
): ArticleWorkingDraftEnglishEnvelope {
  if (!payload) return { mode: "disabled" };
  const parsed = englishEnvelopeSchema.safeParse({ mode: "save", payload });
  if (!parsed.success) {
    throw new Error(
      "Не удалось безопасно сохранить рабочий черновик. Проверьте английскую версию."
    );
  }
  return parsed.data;
}

export function parseArticleWorkingDraft(value: unknown) {
  const parsed = workingDraftSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Рабочий черновик повреждён и не был открыт. Опубликованная версия оставлена без изменений."
    );
  }
  return parsed.data;
}

export function articleWithWorkingDraft<
  Article extends Record<string, unknown>,
>(article: Article, draft: ArticleWorkingDraft) {
  return {
    ...article,
    ...draft.payload,
    id: article.id,
    // Keep the live CAS boundary captured when the working copy was created.
    // A concurrent live change must conflict instead of being overwritten.
    updated_at: draft.base_article_updated_at,
    working_draft_version: draft.version,
  };
}

export function englishTranslationWithWorkingDraft<
  Translation extends Record<string, unknown>,
>(
  translation: Translation | null,
  draft: ArticleWorkingDraft
): (Translation & Record<string, unknown>) | Record<string, unknown> | null {
  const envelope = draft.english_payload;
  if (envelope.mode === "disabled") {
    return draft.expected_english_updated_at
      ? { updated_at: draft.expected_english_updated_at }
      : null;
  }
  return {
    ...(translation || {}),
    ...envelope.payload,
    id: translation?.id,
    article_id: translation?.article_id,
    locale: "en",
    updated_at: draft.expected_english_updated_at || undefined,
  };
}

export function previewEnglishTranslationWithWorkingDraft<
  Translation extends Record<string, unknown>,
>(translation: Translation | null, draft: ArticleWorkingDraft) {
  const envelope = draft.english_payload;
  if (envelope.mode === "disabled") return null;
  return {
    ...(translation || {}),
    ...envelope.payload,
    id: translation?.id,
    article_id: translation?.article_id,
    locale: "en" as const,
    updated_at: draft.updated_at,
  };
}

function workingDraftRpcError(error: { message?: string } | null | undefined) {
  const message = String(error?.message || "");
  if (
    message.includes("article-version-conflict") ||
    message.includes("working-draft-version-conflict")
  ) {
    return "Черновик или опубликованная статья уже изменены в другой вкладке. Обновите страницу и повторите правку.";
  }
  if (message.includes("english-version-conflict")) {
    return "Английская версия уже изменена в другой вкладке. Обновите страницу и повторите правку.";
  }
  if (message.includes("published-article-required")) {
    return "Отдельный рабочий черновик доступен только для опубликованной статьи.";
  }
  if (message.includes("staff-required")) {
    return "Недостаточно прав для сохранения рабочего черновика.";
  }
  if (message.includes("working-draft-not-found")) {
    return "Рабочий черновик уже удалён. Обновите страницу.";
  }
  return "Не удалось безопасно сохранить рабочий черновик. Опубликованная версия не изменена.";
}

export async function saveArticleWorkingDraftRpc(
  supabase: ServerSupabaseClient,
  input: {
    articleId: string;
    baseArticleUpdatedAt: string;
    articlePayload: Record<string, unknown>;
    englishEnvelope: ArticleWorkingDraftEnglishEnvelope;
    expectedEnglishUpdatedAt: string | null;
    expectedVersion: number;
  }
) {
  const articlePayload = articlePayloadSchema.safeParse(input.articlePayload);
  const englishEnvelope = englishEnvelopeSchema.safeParse(input.englishEnvelope);
  if (!articlePayload.success || !englishEnvelope.success) {
    throw new Error(
      "Не удалось безопасно сохранить рабочий черновик. Проверьте поля статьи."
    );
  }
  const { data, error } = await supabase.rpc("save_article_working_draft", {
    p_article_id: input.articleId,
    p_base_article_updated_at: input.baseArticleUpdatedAt,
    p_payload: articlePayload.data,
    p_english_payload: englishEnvelope.data,
    p_expected_english_updated_at: input.expectedEnglishUpdatedAt,
    p_expected_version: input.expectedVersion,
  });
  if (error) throw new Error(workingDraftRpcError(error));

  const result = z
    .object({
      articleId: z.string().uuid(),
      version: z.coerce.number().int().positive(),
      updatedAt: z.string().datetime({ offset: true }),
    })
    .strict()
    .safeParse(data);
  if (!result.success || result.data.articleId !== input.articleId) {
    throw new Error(
      "Рабочий черновик сохранён с некорректным ответом сервера. Обновите страницу перед следующей правкой."
    );
  }
  return result.data;
}

export async function discardArticleWorkingDraftRpc(
  supabase: ServerSupabaseClient,
  input: { articleId: string; expectedVersion: number }
) {
  const { data, error } = await supabase.rpc("discard_article_working_draft", {
    p_article_id: input.articleId,
    p_expected_version: input.expectedVersion,
  });
  if (error) throw new Error(workingDraftRpcError(error));
  const result = z
    .object({
      articleId: z.string().uuid(),
      discarded: z.literal(true),
    })
    .strict()
    .safeParse(data);
  if (!result.success || result.data.articleId !== input.articleId) {
    throw new Error(
      "Не удалось подтвердить удаление рабочего черновика. Обновите страницу."
    );
  }
  return result.data;
}
