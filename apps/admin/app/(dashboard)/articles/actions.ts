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
  canonicalUrl: z.string().url().nullable(),
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
    canonicalUrl,
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
    canonical_url:
      parsed.data.canonicalUrl ||
      `${adminEnv.publicSiteUrl}${articlePublicPath(savedSlug, categorySlug)}`,
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
