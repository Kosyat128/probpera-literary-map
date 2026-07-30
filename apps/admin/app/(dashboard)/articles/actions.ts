"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { articlePublicPath } from "@/lib/article-route";
import { triggerPublicBuild } from "@/lib/public-build";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  subtitle: z.string().trim().max(360).default(""),
  excerpt: z.string().trim().max(700).default(""),
  slug: z.string().trim().max(180).optional(),
  contentHtml: z.string().max(2_000_000).default(""),
  contentJson: z.string().max(2_000_000).default("{}"),
  categoryId: z.string().uuid().nullable(),
  status: z.enum(["draft", "review", "scheduled", "published", "hidden", "archived"]),
  scheduledAt: z.string().nullable(),
  coverExternalUrl: z.string().url().nullable(),
  coverAlt: z.string().trim().max(500).default(""),
  legacyPath: z.string().trim().nullable(),
  seoTitle: z.string().trim().max(180).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  seoKeywords: z.array(z.string().max(80)).max(30).default([]),
  canonicalUrl: z.string().url().nullable(),
  ogTitle: z.string().trim().max(180).default(""),
  ogDescription: z.string().trim().max(400).default(""),
  sources: z.array(z.object({ text: z.string().max(1000) })).max(100).default([]),
  bibliography: z.array(z.object({ text: z.string().max(1000) })).max(100).default([]),
  allowIndexing: z.boolean(),
  featured: z.boolean(),
  showOnHomepage: z.boolean(),
  pinned: z.boolean(),
});

const allowedArticleHtml = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "mark",
    "aside",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": ["class", "id"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
  },
};

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function commaList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[,;\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function lineItems(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((text) => ({ text }));
}

export async function saveArticleAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");

  const intent = String(formData.get("intent") || "save");
  const requestedStatus =
    intent === "publish" ? "published" : String(formData.get("status") || "draft");
  const title = String(formData.get("title") || "");
  const rawSlug = String(formData.get("slug") || "");
  const generatedSlug = createSlug(rawSlug || title) || `material-${Date.now()}`;
  const scheduledAt = optionalText(formData.get("scheduled_at"));
  const status =
    requestedStatus === "scheduled" && !scheduledAt ? "draft" : requestedStatus;
  const canonicalUrl = optionalText(formData.get("canonical_url"));

  const parsed = articleSchema.safeParse({
    id: optionalText(formData.get("id")) || undefined,
    title,
    subtitle: String(formData.get("subtitle") || ""),
    excerpt: String(formData.get("excerpt") || ""),
    slug: generatedSlug,
    contentHtml: String(formData.get("content_html") || ""),
    contentJson: String(formData.get("content_json") || "{}"),
    categoryId: optionalText(formData.get("category_id")),
    status,
    scheduledAt,
    coverExternalUrl: optionalText(formData.get("cover_external_url")),
    coverAlt: String(formData.get("cover_alt") || ""),
    legacyPath: optionalText(formData.get("legacy_path")),
    seoTitle: String(formData.get("seo_title") || ""),
    seoDescription: String(formData.get("seo_description") || ""),
    seoKeywords: commaList(formData.get("seo_keywords")),
    canonicalUrl,
    ogTitle: String(formData.get("og_title") || ""),
    ogDescription: String(formData.get("og_description") || ""),
    sources: lineItems(formData.get("sources")),
    bibliography: lineItems(formData.get("bibliography")),
    allowIndexing: formData.get("allow_indexing") === "on",
    featured: formData.get("featured") === "on",
    showOnHomepage: formData.get("show_on_homepage") === "on",
    pinned: formData.get("pinned") === "on",
  });

  if (!parsed.success) {
    const failedArticleId = optionalText(formData.get("id")) || "new";
    redirect(
      `/articles/${failedArticleId}?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "Проверьте поля статьи."
      )}`
    );
  }
  const savedSlug = parsed.data.slug || generatedSlug;

  let contentJson: unknown;
  try {
    contentJson = JSON.parse(parsed.data.contentJson);
  } catch {
    contentJson = { type: "doc", content: [] };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles/new?error=База данных не подключена");

  const now = new Date().toISOString();
  let articleId = parsed.data.id;
  let previousSlug: string | null = null;
  let previousPublishedAt: string | null = null;
  let previousCategorySlug: string | null = null;

  let categorySlug: string | null = null;
  if (parsed.data.categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", parsed.data.categoryId)
      .maybeSingle();
    categorySlug = category?.slug || null;
  }

  if (articleId) {
    const { data: previous } = await supabase
      .from("articles")
      .select("slug,published_at,categories(slug)")
      .eq("id", articleId)
      .single();
    previousSlug = previous?.slug || null;
    previousPublishedAt = previous?.published_at || null;
    const previousCategory = Array.isArray(previous?.categories)
      ? previous.categories[0]
      : previous?.categories;
    previousCategorySlug = previousCategory?.slug || null;
  }

  const payload = {
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    excerpt: parsed.data.excerpt,
    slug: savedSlug,
    content_html: sanitizeHtml(parsed.data.contentHtml, allowedArticleHtml),
    content_json: contentJson,
    category_id: parsed.data.categoryId,
    status: parsed.data.status,
    scheduled_at: parsed.data.status === "scheduled" ? parsed.data.scheduledAt : null,
    published_at:
      parsed.data.status === "published" ? previousPublishedAt || now : null,
    cover_external_url: parsed.data.coverExternalUrl,
    cover_alt: parsed.data.coverAlt,
    legacy_path: parsed.data.legacyPath,
    seo_title: parsed.data.seoTitle || parsed.data.title,
    seo_description: parsed.data.seoDescription || parsed.data.excerpt,
    seo_keywords: parsed.data.seoKeywords,
    canonical_url:
      parsed.data.canonicalUrl ||
      `${adminEnv.publicSiteUrl}${articlePublicPath(savedSlug, categorySlug)}`,
    og_title: parsed.data.ogTitle || parsed.data.seoTitle || parsed.data.title,
    og_description:
      parsed.data.ogDescription ||
      parsed.data.seoDescription ||
      parsed.data.excerpt,
    allow_indexing: parsed.data.allowIndexing,
    sources: parsed.data.sources,
    bibliography: parsed.data.bibliography,
    featured: parsed.data.featured,
    show_on_homepage: parsed.data.showOnHomepage,
    pinned: parsed.data.pinned,
    updated_by: session.user.id,
  };

  if (articleId) {
    const { error } = await supabase.from("articles").update(payload).eq("id", articleId);
    if (error) {
      redirect(`/articles/${articleId}?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { data, error } = await supabase
      .from("articles")
      .insert({
        ...payload,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      redirect(`/articles/new?error=${encodeURIComponent(error?.message || "Статья не создана")}`);
    }
    articleId = data.id;
  }

  if (
    previousSlug &&
    (previousSlug !== savedSlug || previousCategorySlug !== categorySlug)
  ) {
    await supabase.from("redirects").upsert(
      {
        source_path: articlePublicPath(previousSlug, previousCategorySlug),
        destination_path: articlePublicPath(savedSlug, categorySlug),
        status_code: 301,
        is_active: true,
        created_by: session.user.id,
      },
      { onConflict: "source_path" }
    );
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: parsed.data.id ? "article.updated" : "article.created",
    entity_type: "article",
    entity_id: articleId,
    metadata: {
      title: parsed.data.title,
      status: parsed.data.status,
      slug: savedSlug,
    },
  });

  if (parsed.data.status === "published") {
    const build = await triggerPublicBuild("article.published");
    await supabase.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: build.ok ? "public_build.requested" : "public_build.failed",
      entity_type: "article",
      entity_id: articleId,
      metadata: {
        configured: build.configured,
        error: build.ok ? null : build.error,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/articles");
  redirect(`/articles/${articleId}?saved=1`);
}

function articleIdFromForm(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
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
  const { data: source, error: sourceError } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();
  if (sourceError || !source) {
    redirect(`/articles?error=${encodeURIComponent(sourceError?.message || "Статья не найдена")}`);
  }

  const copySlug = createSlug(
    `${source.slug}-kopiya-${Date.now().toString(36).slice(-5)}`
  ).slice(0, 179);
  const { data: copy, error } = await supabase
    .from("articles")
    .insert({
      title: `${source.title} — копия`,
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
  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: "article.duplicated",
    entity_type: "article",
    entity_id: copy.id,
    metadata: { sourceId: id },
  });
  revalidatePath("/articles");
  redirect(`/articles/${copy.id}?saved=1`);
}

export async function changeArticleStatusAction(formData: FormData) {
  const id = articleIdFromForm(formData);
  const statusValue = String(formData.get("status") || "");
  const allowedStatuses = new Set([
    "draft",
    "review",
    "published",
    "hidden",
    "archived",
  ]);
  if (!id || !allowedStatuses.has(statusValue)) {
    redirect("/articles?error=Некорректное изменение статуса");
  }
  const { userId, supabase } = await auditArticleAction(
    "article.status.requested",
    id,
    { status: statusValue }
  );
  const { error } = await supabase
    .from("articles")
    .update({
      status: statusValue,
      published_at:
        statusValue === "published" ? new Date().toISOString() : undefined,
      updated_by: userId,
    })
    .eq("id", id);
  if (error) {
    redirect(`/articles?error=${encodeURIComponent(error.message)}`);
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: `article.status.${statusValue}`,
    entity_type: "article",
    entity_id: id,
  });
  if (["published", "hidden", "archived"].includes(statusValue)) {
    await triggerPublicBuild(`article.status.${statusValue}`);
  }
  revalidatePath("/articles");
  revalidatePath(`/articles/${id}`);
}

export async function softDeleteArticleAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = articleIdFromForm(formData);
  if (!id) redirect("/articles?error=Некорректный материал");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  const { error } = await supabase
    .from("articles")
    .update({
      status: "archived",
      deleted_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id);
  if (error) redirect(`/articles?error=${encodeURIComponent(error.message)}`);
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "article.soft_deleted",
    entity_type: "article",
    entity_id: id,
  });
  await triggerPublicBuild("article.soft_deleted");
  revalidatePath("/articles");
}

export async function restoreArticleRevisionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const articleId = articleIdFromForm(formData);
  const revisionId = z.coerce.number().int().positive().safeParse(
    formData.get("revision_id")
  );
  if (!articleId || !revisionId.success) {
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
    redirect(`/articles/${articleId}?error=${encodeURIComponent(revisionError?.message || "Версия не найдена")}`);
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
    "status",
    "slug",
    "legacy_path",
    "published_at",
    "scheduled_at",
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
  const { error } = await supabase
    .from("articles")
    .update({ ...payload, updated_by: session.user.id })
    .eq("id", articleId);
  if (error) {
    redirect(`/articles/${articleId}?error=${encodeURIComponent(error.message)}`);
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "article.revision.restored",
    entity_type: "article",
    entity_id: articleId,
    metadata: { revisionNumber: revision.revision_number },
  });
  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}?saved=1`);
}
