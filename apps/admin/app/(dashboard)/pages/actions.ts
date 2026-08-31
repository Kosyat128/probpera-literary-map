"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import {
  safeTextToneSpanAttributes,
  sanitizeArticleTextToneJson,
} from "@/lib/article-content-presentation";
import { adminEnv } from "@/lib/env";
import { sanitizeEditorAnchorAttributes } from "@/lib/editor-link";
import {
  editorialGalleryAttributeNames,
  safeEditorialGalleryHtmlAttributes,
  sanitizeEditorialGalleryJson,
} from "@/lib/editorial-gallery";
import {
  editorialImageDataAttributes,
  safeEditorialImageHtmlAttributes,
  sanitizeEditorialMediaJson,
} from "@/lib/editorial-media-content";
import {
  assertEditorialMediaIdentityParity,
  editorialMediaHtmlAccessibilityIssues,
  parseEditorialContentJson,
} from "@/lib/editorial-media-identity";
import {
  pageCatalogFromForm,
  pageCatalogHref,
  pageCatalogPageNumber,
  pageEditorHref,
} from "@/lib/page-catalog-query";
import { requestPublicBuild } from "@/lib/publication";
import {
  normalizeShortHyphensDeep,
  normalizeShortHyphensFormData,
} from "@/lib/short-hyphens";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const pageSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(180),
  excerpt: z.string().trim().max(700).default(""),
  slug: z.string().trim().min(2).max(120),
  contentHtml: z.string().max(2_000_000).default(""),
  contentJson: z.string().max(2_000_000).default("{}"),
  status: z.enum(["draft", "published", "hidden"]),
  seoTitle: z.string().trim().max(180).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  canonicalUrl: z.string().url().nullable(),
  allowIndexing: z.boolean(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

const versionSchema = z.string().datetime({ offset: true });

const allowedPageHtml = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "mark",
    "aside",
    "section",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: [
      "src",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "data-image-layout",
      "data-caption",
      "data-media-id",
    ],
    "*": [
      "class",
      "id",
      "data-editorial-block",
      "data-reveal",
      "data-image-layout",
      "data-caption",
      "data-media-id",
      ...editorialImageDataAttributes,
      ...editorialGalleryAttributeNames,
      "data-text-tone",
      "data-typography-scope",
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    img: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeEditorialImageHtmlAttributes(attributes),
    }),
    section: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeEditorialGalleryHtmlAttributes(attributes),
    }),
    a: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: sanitizeEditorAnchorAttributes(attributes),
    }),
    span: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeTextToneSpanAttributes(attributes),
    }),
  },
};

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function sanitizeStoredPageContent(
  contentJsonValue: unknown,
  contentHtmlValue: unknown,
  label: string
) {
  const serializedJson =
    typeof contentJsonValue === "string"
      ? contentJsonValue
      : JSON.stringify(contentJsonValue);
  if (typeof serializedJson !== "string" || serializedJson.length > 2_000_000) {
    throw new Error(`${label}: JSON редактора отсутствует или слишком велик.`);
  }
  if (
    typeof contentHtmlValue !== "string" ||
    contentHtmlValue.length > 2_000_000
  ) {
    throw new Error(`${label}: HTML редактора отсутствует или слишком велик.`);
  }
  const contentJson = sanitizeEditorialGalleryJson(
    sanitizeEditorialMediaJson(
      sanitizeArticleTextToneJson(
        parseEditorialContentJson(serializedJson, label)
      )
    )
  );
  const contentHtml = sanitizeHtml(contentHtmlValue, allowedPageHtml);
  assertEditorialMediaIdentityParity(contentJson, contentHtml, label);
  return { contentJson, contentHtml };
}

function assertPagePublicationMedia(contentHtml: string) {
  const issues = editorialMediaHtmlAccessibilityIssues(contentHtml);
  if (issues.length) {
    throw new Error(`Публикация остановлена: ${issues.join("; ")}.`);
  }
}

async function auditPage(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  actorId: string,
  pageId: string,
  action: string,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "page",
    entity_id: pageId,
    metadata: {
      ...metadata,
    },
  });
  return requestPublicBuild({
    supabase,
    actorId,
    entityType: "page",
    entityId: pageId,
    reason: action,
    metadata,
  });
}

export async function createPageAction(formData: FormData) {
  normalizeShortHyphensFormData(formData);
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const catalog = pageCatalogFromForm(formData);
  const revisionPage = pageCatalogPageNumber(formData.get("editor_revision_page"));
  const editorTarget = (
    pageId: string,
    options: Parameters<typeof pageEditorHref>[2] = {}
  ) => pageEditorHref(pageId, catalog, { revisionPage, ...options });
  const catalogTarget = (options: Parameters<typeof pageCatalogHref>[1] = {}) =>
    pageCatalogHref(catalog, options);
  const title = String(formData.get("title") || "");
  const slug =
    createSlug(String(formData.get("slug") || title)) ||
    `stranitsa-${Date.now()}`;
  const content = sanitizeHtml(
    String(formData.get("content") || "")
      .split(/\n{2,}/u)
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join(""),
    allowedPageHtml
  );
  const parsed = pageSchema
    .pick({ title: true, excerpt: true, slug: true })
    .safeParse({
      title,
      excerpt: String(formData.get("excerpt") || ""),
      slug,
    });
  if (!parsed.success) {
    redirect(catalogTarget({ error: "Проверьте поля новой страницы" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(catalogTarget({ error: "База данных не подключена" }));
  const { data, error } = await supabase
    .from("pages")
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt,
      content_html: content,
      content_json: { type: "doc", content: [] },
      status: "draft",
      seo_title: parsed.data.title,
      seo_description: parsed.data.excerpt,
      canonical_url: `${adminEnv.publicSiteUrl}/stranitsy/${parsed.data.slug}/`,
      allow_indexing: true,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(catalogTarget({ error: error?.message || "Страница не создана" }));
  }
  const publication = await auditPage(supabase, session.user.id, data.id, "page.created", {
    slug: parsed.data.slug,
  });
  revalidatePath("/pages");
  redirect(editorTarget(data.id, { saved: "1", published: publication.state }));
}

export async function savePageAction(formData: FormData) {
  normalizeShortHyphensFormData(formData);
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const catalog = pageCatalogFromForm(formData);
  const revisionPage = pageCatalogPageNumber(formData.get("editor_revision_page"));
  const editorTarget = (
    pageId: string,
    options: Parameters<typeof pageEditorHref>[2] = {}
  ) => pageEditorHref(pageId, catalog, { revisionPage, ...options });
  const id = optionalText(formData.get("id"));
  const title = String(formData.get("title") || "");
  const slug =
    createSlug(String(formData.get("slug") || title)) ||
    `stranitsa-${Date.now()}`;
  const intent = String(formData.get("intent") || "save");
  const requestedStatus =
    intent === "publish"
      ? "published"
      : String(formData.get("status") || "draft");
  const parsed = pageSchema.safeParse({
    id: id || undefined,
    title,
    excerpt: String(formData.get("excerpt") || ""),
    slug,
    contentHtml: String(formData.get("content_html") || ""),
    contentJson: String(formData.get("content_json") || "{}"),
    status: requestedStatus,
    seoTitle: String(formData.get("seo_title") || ""),
    seoDescription: String(formData.get("seo_description") || ""),
    canonicalUrl: optionalText(formData.get("canonical_url")),
    allowIndexing: formData.get("allow_indexing") === "on",
    expectedUpdatedAt: formData.get("expected_updated_at"),
  });
  if (!parsed.success || !id) {
    redirect(editorTarget(id || "", {
      error: parsed.success
        ? "Некорректная страница"
        : parsed.error.issues[0]?.message || "Проверьте поля страницы",
    }));
  }

  let contentJson: unknown;
  try {
    contentJson = sanitizeEditorialGalleryJson(
      sanitizeEditorialMediaJson(
        sanitizeArticleTextToneJson(
          parseEditorialContentJson(parsed.data.contentJson, "Страница")
        )
      )
    );
  } catch (error) {
    redirect(editorTarget(id, {
      error:
        error instanceof Error
          ? error.message
          : "Страница: JSON редактора повреждён. Обновите страницу и повторите сохранение.",
    }));
  }

  const contentHtml = sanitizeHtml(parsed.data.contentHtml, allowedPageHtml);
  try {
    assertEditorialMediaIdentityParity(contentJson, contentHtml, "Страница");
  } catch (error) {
    redirect(editorTarget(id, {
      error:
        error instanceof Error
          ? error.message
          : "Сохранение остановлено: данные изображений в редакторе расходятся.",
    }));
  }

  if (parsed.data.status === "published") {
    try {
      assertPagePublicationMedia(contentHtml);
    } catch (error) {
      redirect(editorTarget(id, {
        error: error instanceof Error ? error.message : "Проверьте alt-тексты изображений.",
      }));
    }
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(editorTarget(id, { error: "База данных не подключена" }));
  const { data: updated, error } = await supabase
    .from("pages")
    .update(normalizeShortHyphensDeep({
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt,
      content_html: contentHtml,
      content_json: contentJson,
      status: parsed.data.status,
      seo_title: parsed.data.seoTitle || parsed.data.title,
      seo_description: parsed.data.seoDescription || parsed.data.excerpt,
      canonical_url:
        parsed.data.canonicalUrl ||
        `${adminEnv.publicSiteUrl}/stranitsy/${parsed.data.slug}/`,
      allow_indexing: parsed.data.allowIndexing,
      updated_by: session.user.id,
    }))
    .eq("id", id)
    .eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) {
    redirect(editorTarget(id, { error: error.message }));
  }
  if (!updated) {
    redirect(editorTarget(id, {
      error: "Страницу уже изменили в другой вкладке. Обновите страницу и повторите правку.",
    }));
  }
  const publication = await auditPage(supabase, session.user.id, id, "page.updated", {
    status: parsed.data.status,
    slug: parsed.data.slug,
  });
  revalidatePath("/pages");
  revalidatePath(`/pages/${id}`);
  redirect(editorTarget(id, { saved: "1", published: publication.state }));
}

export async function changePageStatusAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const catalog = pageCatalogFromForm(formData);
  const target = (options: Parameters<typeof pageCatalogHref>[1] = {}) =>
    pageCatalogHref(catalog, options);
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z
    .enum(["draft", "published", "hidden"])
    .safeParse(formData.get("status"));
  const expectedUpdatedAt = versionSchema.safeParse(formData.get("expected_updated_at"));
  if (!id.success || !status.success || !expectedUpdatedAt.success) {
    redirect(target({ error: "Некорректное действие или версия страницы" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена" }));
  let checkedPublicationContent: ReturnType<typeof sanitizeStoredPageContent> | null = null;
  if (status.data === "published") {
    const { data: currentPage, error: currentPageError } = await supabase
      .from("pages")
      .select("content_json,content_html")
      .eq("id", id.data)
      .eq("updated_at", expectedUpdatedAt.data)
      .maybeSingle();
    if (currentPageError) redirect(target({ error: currentPageError.message }));
    if (!currentPage) {
      redirect(target({
        error: "Страницу уже изменили в другой вкладке. Обновите список и повторите действие.",
      }));
    }
    try {
      checkedPublicationContent = sanitizeStoredPageContent(
        currentPage.content_json,
        currentPage.content_html,
        "Страница"
      );
      assertPagePublicationMedia(checkedPublicationContent.contentHtml);
    } catch (error) {
      redirect(target({
        error:
          error instanceof Error
            ? error.message
            : "Публикация остановлена: проверьте изображения страницы.",
      }));
    }
  }
  const { data: updated, error } = await supabase
    .from("pages")
    .update({
      status: status.data,
      updated_by: session.user.id,
      ...(checkedPublicationContent
        ? {
            content_json: checkedPublicationContent.contentJson,
            content_html: checkedPublicationContent.contentHtml,
          }
        : {}),
    })
    .eq("id", id.data)
    .eq("updated_at", expectedUpdatedAt.data)
    .select("id")
    .maybeSingle();
  if (error) redirect(target({ error: error.message }));
  if (!updated) {
    redirect(target({
      error: "Статус уже изменён в другой вкладке. Обновите список и повторите действие.",
    }));
  }
  const publication = await auditPage(supabase, session.user.id, id.data, "page.status_changed", {
    status: status.data,
  });
  revalidatePath("/pages");
  redirect(target({ saved: "1", published: publication.state }));
}

export async function softDeletePageAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const catalog = pageCatalogFromForm(formData);
  const target = (options: Parameters<typeof pageCatalogHref>[1] = {}) =>
    pageCatalogHref(catalog, options);
  const id = z.string().uuid().safeParse(formData.get("id"));
  const expectedUpdatedAt = versionSchema.safeParse(formData.get("expected_updated_at"));
  if (!id.success || !expectedUpdatedAt.success) {
    redirect(target({ error: "Некорректная страница или версия" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(target({ error: "База данных не подключена" }));
  const { data: deleted, error } = await supabase
    .from("pages")
    .update({
      deleted_at: new Date().toISOString(),
      status: "hidden",
      updated_by: session.user.id,
    })
    .eq("id", id.data)
    .eq("updated_at", expectedUpdatedAt.data)
    .select("id")
    .maybeSingle();
  if (error) redirect(target({ error: error.message }));
  if (!deleted) {
    redirect(target({
      error: "Страницу уже изменили в другой вкладке. Обновите данные перед удалением.",
    }));
  }
  const publication = await auditPage(supabase, session.user.id, id.data, "page.deleted");
  revalidatePath("/pages");
  redirect(target({ deleted: "1", published: publication.state }));
}

export async function restorePageRevisionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const catalog = pageCatalogFromForm(formData);
  const revisionPage = pageCatalogPageNumber(formData.get("editor_revision_page"));
  const editorTarget = (
    pageId: string,
    options: Parameters<typeof pageEditorHref>[2] = {}
  ) => pageEditorHref(pageId, catalog, { revisionPage, ...options });
  const id = z.string().uuid().safeParse(formData.get("id"));
  const revisionId = z.coerce.number().int().positive().safeParse(
    formData.get("revision_id")
  );
  const expectedUpdatedAt = versionSchema.safeParse(formData.get("expected_updated_at"));
  if (!id.success || !revisionId.success || !expectedUpdatedAt.success) {
    redirect(pageCatalogHref(catalog, { error: "Некорректная версия" }));
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(editorTarget(id.data, { error: "База данных не подключена" }));
  const { data: revision, error: revisionError } = await supabase
    .from("page_revisions")
    .select("snapshot,revision_number")
    .eq("id", revisionId.data)
    .eq("page_id", id.data)
    .maybeSingle();
  if (revisionError || !revision?.snapshot) {
    redirect(editorTarget(id.data, { error: "Версия не найдена" }));
  }
  const snapshot = revision.snapshot as Record<string, unknown>;
  const restoredStatus = z
    .enum(["draft", "published", "hidden"])
    .safeParse(snapshot.status);
  if (!restoredStatus.success) {
    redirect(editorTarget(id.data, {
      error: "Версия содержит некорректный статус страницы.",
    }));
  }
  let restoredContent: ReturnType<typeof sanitizeStoredPageContent>;
  try {
    restoredContent = sanitizeStoredPageContent(
      snapshot.content_json,
      snapshot.content_html,
      "Восстанавливаемая версия страницы"
    );
    if (restoredStatus.data === "published") {
      assertPagePublicationMedia(restoredContent.contentHtml);
    }
  } catch (error) {
    redirect(editorTarget(id.data, {
      error:
        error instanceof Error
          ? error.message
          : "Версия не прошла проверку содержимого и изображений.",
    }));
  }
  const { data: restored, error } = await supabase
    .from("pages")
    .update(normalizeShortHyphensDeep({
      title: snapshot.title,
      slug: snapshot.slug,
      excerpt: snapshot.excerpt,
      content_html: restoredContent.contentHtml,
      content_json: restoredContent.contentJson,
      status: restoredStatus.data,
      seo_title: snapshot.seo_title,
      seo_description: snapshot.seo_description,
      canonical_url: snapshot.canonical_url,
      allow_indexing: snapshot.allow_indexing,
      updated_by: session.user.id,
    }))
    .eq("id", id.data)
    .eq("updated_at", expectedUpdatedAt.data)
    .select("id")
    .maybeSingle();
  if (error) {
    redirect(editorTarget(id.data, { error: error.message }));
  }
  if (!restored) {
    redirect(editorTarget(id.data, {
      error: "Страницу уже изменили в другой вкладке. Обновите её перед восстановлением версии.",
    }));
  }
  const publication = await auditPage(supabase, session.user.id, id.data, "page.revision_restored", {
    revision: revision.revision_number,
  });
  revalidatePath(`/pages/${id.data}`);
  redirect(editorTarget(id.data, { saved: "1", published: publication.state }));
}
