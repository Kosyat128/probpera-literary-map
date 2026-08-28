"use server";

import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";

import { redirect } from "@/lib/navigation";
import { requireStaff } from "@/lib/auth";
import { articlePublicPath } from "@/lib/article-route";
import { safeTextToneSpanAttributes } from "@/lib/article-content-presentation";
import { positionLeadingIllustrationHtml } from "@/lib/article-leading-illustration";
import { adminEnv } from "@/lib/env";
import { sanitizeEditorAnchorAttributes } from "@/lib/editor-link";
import { createSlug } from "@/lib/slug";
import { normalizeShortHyphensDeep } from "@/lib/short-hyphens";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedArticleHtml = {
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
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": [
      "class",
      "id",
      "data-editorial-block",
      "data-reveal",
      "data-image-layout",
      "data-caption",
      "data-media-id",
      "data-text-tone",
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
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

type LegacyArticleCatalogItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  sectionId?: string;
  publishedLabel?: string;
  url?: string;
};

type LegacyArticleDocument = {
  contentHtml?: string;
};

const legacyCategoryBySection: Record<string, string> = {
  "book-opinions": "book-opinions",
  "screen-adaptations": "screen-adaptations",
  "writers-world": "writers-world",
  "book-guides": "book-guides",
  awards: "awards",
  folklore: "folklore",
  language: "language",
  "literary-essays": "literary-essays",
  "author-stories": "author-stories",
};

function legacyPath(value?: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value, adminEnv.publicSiteUrl);
    return parsed.hostname === new URL(adminEnv.publicSiteUrl).hostname
      ? parsed.pathname
      : null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Источник архива ответил ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function importLegacyArticlesAction() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");

  let catalog: LegacyArticleCatalogItem[];
  try {
    catalog = await fetchJson<LegacyArticleCatalogItem[]>(
      `${adminEnv.publicSiteUrl}/articles/index.json`
    );
  } catch (error) {
    redirect(
      `/articles?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Не удалось прочитать архив статей."
      )}`
    );
  }

  const [{ data: existingRows }, { data: categoryRows }] = await Promise.all([
    supabase.from("articles").select("legacy_id").not("legacy_id", "is", null),
    supabase.from("categories").select("id,slug"),
  ]);
  const existingIds = new Set(
    (existingRows || []).map((article) => String(article.legacy_id || ""))
  );
  const categoryIds = new Map(
    (categoryRows || []).map((category) => [category.slug, category.id])
  );
  const missing = catalog.filter(
    (article) => article.id && article.title && !existingIds.has(article.id)
  );

  let imported = 0;
  for (let offset = 0; offset < missing.length; offset += 12) {
    const batch = missing.slice(offset, offset + 12);
    const documents = await Promise.all(
      batch.map(async (article) => {
        try {
          return await fetchJson<LegacyArticleDocument>(
            `${adminEnv.publicSiteUrl}/articles/${encodeURIComponent(article.id)}.json`
          );
        } catch {
          return { contentHtml: "" };
        }
      })
    );
    const payload = batch.map((article, index) => {
      const categorySlug = legacyCategoryBySection[article.sectionId || ""];
      const slug = createSlug(article.title) || "material";
      const path = legacyPath(article.url);
      return normalizeShortHyphensDeep({
        legacy_id: article.id,
        title: article.title.trim(),
        excerpt: String(article.description || "").trim().slice(0, 700),
        content_json: { type: "doc", content: [] },
        content_html: positionLeadingIllustrationHtml(
          sanitizeHtml(documents[index]?.contentHtml || "", allowedArticleHtml)
        ),
        cover_external_url: article.imageUrl || null,
        cover_alt:
          article.imageAlt ||
          (article.imageUrl ? `Иллюстрация к статье «${article.title}»` : ""),
        category_id: categorySlug ? categoryIds.get(categorySlug) || null : null,
        author_id: userId,
        status: "draft",
        slug,
        legacy_path: path,
        published_at: null,
        seo_title: article.title.trim(),
        seo_description:
          String(article.description || "").trim().slice(0, 400) ||
          `Авторский материал журнала «Проба Пера»: ${article.title}`,
        canonical_url: `${adminEnv.publicSiteUrl}${articlePublicPath(slug, categorySlug)}`,
        allow_indexing: false,
        created_by: userId,
        updated_by: userId,
      });
    });
    const { error } = await supabase.from("articles").insert(payload);
    if (error) {
      redirect(`/articles?error=${encodeURIComponent(error.message)}`);
    }
    imported += payload.length;
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: "articles.legacy_imported",
    entity_type: "article",
    metadata: {
      imported,
      skipped: catalog.length - missing.length,
      source: `${adminEnv.publicSiteUrl}/articles/index.json`,
    },
  });
  revalidatePath("/articles");
  revalidatePath("/dashboard");
  redirect(
    `/articles?imported=${imported}&skipped=${catalog.length - missing.length}`
  );
}
