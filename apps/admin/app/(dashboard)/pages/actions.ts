"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { triggerPublicBuild } from "@/lib/public-build";
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
});

const allowedPageHtml = {
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

async function auditPage(
  actorId: string,
  pageId: string,
  action: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return;
  const build = await triggerPublicBuild(action);
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "page",
    entity_id: pageId,
    metadata: {
      ...metadata,
      publicBuildRequested: build.ok,
      publicBuildConfigured: build.configured,
    },
  });
}

export async function createPageAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
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
    redirect("/pages?error=Проверьте поля новой страницы");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/pages?error=База данных не подключена");
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
    redirect(
      `/pages?error=${encodeURIComponent(error?.message || "Страница не создана")}`
    );
  }
  await auditPage(session.user.id, data.id, "page.created", {
    slug: parsed.data.slug,
  });
  revalidatePath("/pages");
  redirect(`/pages/${data.id}?saved=1`);
}

export async function savePageAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
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
  });
  if (!parsed.success || !id) {
    redirect(
      `/pages/${id || ""}?error=${encodeURIComponent(
        parsed.success
          ? "Некорректная страница"
          : parsed.error.issues[0]?.message || "Проверьте поля страницы"
      )}`
    );
  }

  let contentJson: unknown;
  try {
    contentJson = JSON.parse(parsed.data.contentJson);
  } catch {
    contentJson = { type: "doc", content: [] };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`/pages/${id}?error=База данных не подключена`);
  const { error } = await supabase
    .from("pages")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt,
      content_html: sanitizeHtml(parsed.data.contentHtml, allowedPageHtml),
      content_json: contentJson,
      status: parsed.data.status,
      seo_title: parsed.data.seoTitle || parsed.data.title,
      seo_description: parsed.data.seoDescription || parsed.data.excerpt,
      canonical_url:
        parsed.data.canonicalUrl ||
        `${adminEnv.publicSiteUrl}/stranitsy/${parsed.data.slug}/`,
      allow_indexing: parsed.data.allowIndexing,
      updated_by: session.user.id,
    })
    .eq("id", id);
  if (error) {
    redirect(`/pages/${id}?error=${encodeURIComponent(error.message)}`);
  }
  await auditPage(session.user.id, id, "page.updated", {
    status: parsed.data.status,
    slug: parsed.data.slug,
  });
  revalidatePath("/pages");
  revalidatePath(`/pages/${id}`);
  redirect(`/pages/${id}?saved=1`);
}

export async function changePageStatusAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z
    .enum(["draft", "published", "hidden"])
    .safeParse(formData.get("status"));
  if (!id.success || !status.success) {
    redirect("/pages?error=Некорректное действие");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/pages?error=База данных не подключена");
  const { error } = await supabase
    .from("pages")
    .update({
      status: status.data,
      updated_by: session.user.id,
    })
    .eq("id", id.data);
  if (error) redirect(`/pages?error=${encodeURIComponent(error.message)}`);
  await auditPage(session.user.id, id.data, "page.status_changed", {
    status: status.data,
  });
  revalidatePath("/pages");
  redirect("/pages?saved=1");
}

export async function softDeletePageAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/pages?error=Некорректная страница");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/pages?error=База данных не подключена");
  const { error } = await supabase
    .from("pages")
    .update({
      deleted_at: new Date().toISOString(),
      status: "hidden",
      updated_by: session.user.id,
    })
    .eq("id", id.data);
  if (error) redirect(`/pages?error=${encodeURIComponent(error.message)}`);
  await auditPage(session.user.id, id.data, "page.deleted");
  revalidatePath("/pages");
  redirect("/pages?deleted=1");
}

export async function restorePageRevisionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const revisionId = z.coerce.number().int().positive().safeParse(
    formData.get("revision_id")
  );
  if (!id.success || !revisionId.success) {
    redirect("/pages?error=Некорректная версия");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`/pages/${id.data}?error=База данных не подключена`);
  const { data: revision, error: revisionError } = await supabase
    .from("page_revisions")
    .select("snapshot,revision_number")
    .eq("id", revisionId.data)
    .eq("page_id", id.data)
    .maybeSingle();
  if (revisionError || !revision?.snapshot) {
    redirect(`/pages/${id.data}?error=Версия не найдена`);
  }
  const snapshot = revision.snapshot as Record<string, unknown>;
  const { error } = await supabase
    .from("pages")
    .update({
      title: snapshot.title,
      slug: snapshot.slug,
      excerpt: snapshot.excerpt,
      content_html: snapshot.content_html,
      content_json: snapshot.content_json,
      status: snapshot.status,
      seo_title: snapshot.seo_title,
      seo_description: snapshot.seo_description,
      canonical_url: snapshot.canonical_url,
      allow_indexing: snapshot.allow_indexing,
      updated_by: session.user.id,
    })
    .eq("id", id.data);
  if (error) {
    redirect(`/pages/${id.data}?error=${encodeURIComponent(error.message)}`);
  }
  await auditPage(session.user.id, id.data, "page.revision_restored", {
    revision: revision.revision_number,
  });
  revalidatePath(`/pages/${id.data}`);
  redirect(`/pages/${id.data}?saved=1`);
}
