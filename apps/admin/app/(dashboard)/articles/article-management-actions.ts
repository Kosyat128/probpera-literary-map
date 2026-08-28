"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { articleEditPath } from "@/lib/admin-routes";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function articleIdFromForm(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

function articleExpectedUpdatedAtFromForm(formData: FormData) {
  const parsed = z.string().datetime({ offset: true }).safeParse(
    formData.get("expected_updated_at")
  );
  return parsed.success ? parsed.data : null;
}

async function auditArticleAction(
  action: string,
  articleId: string,
  metadata: Record<string, unknown> = {}
) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: "article",
    entity_id: articleId,
    metadata,
  });
  return { userId: session.user.id, supabase };
}

export async function duplicateArticleAction(formData: FormData) {
  const id = articleIdFromForm(formData);
  if (!id) redirect("/articles?error=Некорректный материал");
  const { userId, supabase } = await auditArticleAction(
    "article.duplicate.requested",
    id
  );
  const [
    { data: source, error: sourceError },
    { data: sourceEnglishTranslation, error: sourceEnglishError },
  ] = await Promise.all([
    supabase.from("articles").select("*").eq("id", id).single(),
    supabase
      .from("article_translations")
      .select(
        "title,subtitle,excerpt,content_json,content_html,cover_alt,slug,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description"
      )
      .eq("article_id", id)
      .eq("locale", "en")
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (sourceError || !source) {
    redirect(`/articles?error=${encodeURIComponent(sourceError?.message || "Статья не найдена")}`);
  }
  if (sourceEnglishError) {
    redirect(
      `/articles?error=${encodeURIComponent(
        `Не удалось прочитать английскую версию: ${sourceEnglishError.message}`
      )}`
    );
  }

  const copySlugBase = createSlug(`${source.slug}-kopiya`).slice(0, 170);
  const { data: existingCopies } = await supabase
    .from("articles")
    .select("slug")
    .like("slug", `${copySlugBase}%`);
  const usedCopySlugs = new Set(
    (existingCopies || []).map((article) => String(article.slug || ""))
  );
  let copySlug = copySlugBase;
  let copyNumber = 2;
  while (usedCopySlugs.has(copySlug)) {
    copySlug = `${copySlugBase}-${copyNumber}`;
    copyNumber += 1;
  }
  const { data: copy, error } = await supabase
    .from("articles")
    .insert({
      title: `${source.title} - копия`,
      subtitle: source.subtitle,
      excerpt: source.excerpt,
      content_json: source.content_json,
      content_html: source.content_html,
      cover_media_id: source.cover_media_id,
      cover_external_url: source.cover_external_url,
      cover_alt: source.cover_alt,
      category_id: source.category_id,
      author_id: userId,
      status: "draft",
      slug: copySlug,
      featured: false,
      show_on_homepage: false,
      pinned: false,
      related_article_id: source.id,
      sources: source.sources || [],
      bibliography: source.bibliography || [],
      seo_title: source.seo_title,
      seo_description: source.seo_description,
      seo_keywords: source.seo_keywords || [],
      og_title: source.og_title,
      og_description: source.og_description,
      allow_indexing: false,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (error || !copy) {
    redirect(`/articles?error=${encodeURIComponent(error?.message || "Не удалось создать копию")}`);
  }

  if (sourceEnglishTranslation) {
    const englishCopySlugBase = createSlug(
      `${sourceEnglishTranslation.slug || sourceEnglishTranslation.title}-copy`
    ).slice(0, 170);
    const { data: existingEnglishCopies, error: englishSlugsError } =
      await supabase
        .from("article_translations")
        .select("slug")
        .eq("locale", "en")
        .like("slug", `${englishCopySlugBase}%`);

    let englishCopyError = englishSlugsError;
    if (!englishCopyError) {
      const usedEnglishCopySlugs = new Set(
        (existingEnglishCopies || []).map((translation) =>
          String(translation.slug || "")
        )
      );
      let englishCopySlug = englishCopySlugBase;
      let englishCopyNumber = 2;
      while (usedEnglishCopySlugs.has(englishCopySlug)) {
        englishCopySlug = `${englishCopySlugBase}-${englishCopyNumber}`;
        englishCopyNumber += 1;
      }

      const { error: insertEnglishCopyError } = await supabase
        .from("article_translations")
        .insert({
          article_id: copy.id,
          locale: "en",
          title: sourceEnglishTranslation.title,
          subtitle: sourceEnglishTranslation.subtitle,
          excerpt: sourceEnglishTranslation.excerpt,
          content_json: sourceEnglishTranslation.content_json,
          content_html: sourceEnglishTranslation.content_html,
          cover_alt: sourceEnglishTranslation.cover_alt,
          slug: englishCopySlug,
          sources: sourceEnglishTranslation.sources || [],
          bibliography: sourceEnglishTranslation.bibliography || [],
          seo_title: sourceEnglishTranslation.seo_title,
          seo_description: sourceEnglishTranslation.seo_description,
          seo_keywords: sourceEnglishTranslation.seo_keywords || [],
          canonical_url: null,
          og_title: sourceEnglishTranslation.og_title,
          og_description: sourceEnglishTranslation.og_description,
          status: "draft",
          source_content_hash: null,
          source_article_updated_at: null,
          reviewed_by: null,
          reviewed_at: null,
          approved_by: null,
          approved_at: null,
          published_at: null,
          created_by: userId,
          updated_by: userId,
          deleted_at: null,
        });
      englishCopyError = insertEnglishCopyError;
    }

    if (englishCopyError) {
      const { data: rolledBackCopy, error: rollbackError } = await supabase
        .from("articles")
        .delete()
        .eq("id", copy.id)
        .select("id")
        .maybeSingle();
      const rollbackFailure =
        rollbackError?.message ||
        (!rolledBackCopy ? "запись копии не была удалена" : null);
      const rollbackMessage = rollbackFailure
        ? `; удалить неполную копию также не удалось: ${rollbackFailure}`
        : "; неполная русская копия удалена";
      redirect(
        `/articles?error=${encodeURIComponent(
          `Английская версия не скопирована: ${englishCopyError.message}${rollbackMessage}`
        )}`
      );
    }
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: "article.duplicated",
    entity_type: "article",
    entity_id: copy.id,
    metadata: { sourceId: id },
  });
  revalidatePath("/articles");
  redirect(articleEditPath(copy.id, { saved: 1 }));
}

export async function changeArticleStatusAction(formData: FormData) {
  const id = articleIdFromForm(formData);
  const expectedUpdatedAt = articleExpectedUpdatedAtFromForm(formData);
  const statusValue = String(formData.get("status") || "");
  const allowedStatuses = new Set([
    "draft",
    "review",
    "scheduled",
    "published",
    "hidden",
    "archived",
  ]);
  if (!id || !expectedUpdatedAt || !allowedStatuses.has(statusValue)) {
    redirect("/articles?error=Некорректное изменение статуса");
  }
  if (statusValue === "published" || statusValue === "scheduled") {
    redirect(
      articleEditPath(id, {
        error:
          "Публикация и планирование выполняются только из редактора после полной проверки RU и EN.",
      })
    );
  }
  const { userId, supabase } = await auditArticleAction(
    "article.status.requested",
    id,
    { status: statusValue }
  );
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      status: statusValue,
      ...(statusValue === "published"
        ? { published_at: new Date().toISOString() }
        : {}),
      updated_by: userId,
    })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) {
    redirect(`/articles?error=${encodeURIComponent(error.message)}`);
  }
  if (!updated) {
    redirect("/articles?error=Статья уже изменена в другой вкладке. Обновите список.");
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: `article.status.${statusValue}`,
    entity_type: "article",
    entity_id: id,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: userId,
    entityType: "article",
    entityId: id,
    reason: `article.status.${statusValue}`,
  });
  revalidatePath("/articles");
  revalidatePath(articleEditPath(id));
  redirect(`/articles?saved=1&published=${publication.state}`);
}

export async function softDeleteArticleAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = articleIdFromForm(formData);
  const expectedUpdatedAt = articleExpectedUpdatedAtFromForm(formData);
  if (!id || !expectedUpdatedAt) redirect("/articles?error=Некорректный материал или версия");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      status: "archived",
      deleted_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(`/articles?error=${encodeURIComponent(error.message)}`);
  if (!updated) redirect("/articles?error=Статья уже изменена в другой вкладке. Обновите страницу.");
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "article.soft_deleted",
    entity_type: "article",
    entity_id: id,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "article",
    entityId: id,
    reason: "article.soft_deleted",
  });
  revalidatePath("/articles");
  redirect(`/articles?deleted=1&published=${publication.state}`);
}

export async function restoreArticleRevisionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const articleId = articleIdFromForm(formData);
  const expectedUpdatedAt = articleExpectedUpdatedAtFromForm(formData);
  const revisionId = z.coerce.number().int().positive().safeParse(
    formData.get("revision_id")
  );
  if (!articleId || !expectedUpdatedAt || !revisionId.success) {
    redirect("/articles?error=Некорректная версия");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  const { data: revision, error: revisionError } = await supabase
    .from("article_revisions")
    .select("snapshot,revision_number")
    .eq("id", revisionId.data)
    .eq("article_id", articleId)
    .single();
  if (revisionError || !revision?.snapshot) {
    redirect(articleEditPath(articleId, {
      error: revisionError?.message || "Версия не найдена",
    }));
  }

  const snapshot = revision.snapshot as Record<string, unknown>;
  const restorableFields = [
    "title",
    "subtitle",
    "excerpt",
    "content_json",
    "content_html",
    "cover_media_id",
    "cover_external_url",
    "cover_alt",
    "category_id",
    "slug",
    "legacy_path",
    "featured",
    "show_on_homepage",
    "pinned",
    "related_article_id",
    "sources",
    "bibliography",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "canonical_url",
    "og_title",
    "og_description",
    "og_media_id",
    "allow_indexing",
  ] as const;
  const payload = Object.fromEntries(
    restorableFields
      .filter((field) => field in snapshot)
      .map((field) => [field, snapshot[field]])
  );
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      ...payload,
      status: "draft",
      scheduled_at: null,
      published_at: null,
      updated_by: session.user.id,
    })
    .eq("id", articleId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) {
    redirect(articleEditPath(articleId, { error: error.message }));
  }
  if (!updated) {
    redirect(articleEditPath(articleId, {
      error: "Статья уже изменена в другой вкладке. Обновите страницу.",
    }));
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "article.revision.restored",
    entity_type: "article",
    entity_id: articleId,
    metadata: { revisionNumber: revision.revision_number },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "article",
    entityId: articleId,
    reason: "article.revision.restored",
  });
  revalidatePath(articleEditPath(articleId));
  redirect(articleEditPath(articleId, { saved: 1, publish: publication.state }));
}
