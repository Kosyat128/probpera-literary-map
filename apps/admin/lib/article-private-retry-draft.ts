import { parseArticleWorkingDraft } from "../app/(dashboard)/articles/article-working-draft";

// This is only the required RU snapshot of an English-only working copy.
// The existing read model continues to take RU from the canonical article.
export function articlePrivateRetrySourceSnapshot(input: {
  article: Record<string, unknown>;
  sourceUpdatedAt: string;
  expectedEnglishUpdatedAt: string | null;
}) {
  const article = input.article;
  const optionalText = (key: string) => article[key] === null ? "" : article[key];
  const optionalList = (key: string) => article[key] === null ? [] : article[key];
  const payload = {
    title: article.title,
    subtitle: optionalText("subtitle"),
    excerpt: optionalText("excerpt"),
    slug: article.slug,
    content_html: article.content_html,
    content_json: article.content_json,
    category_id: article.category_id,
    status: "draft",
    scheduled_at: null,
    published_at: null,
    cover_external_url: article.cover_external_url,
    cover_alt: optionalText("cover_alt"),
    legacy_path: article.legacy_path,
    seo_title: optionalText("seo_title"),
    seo_description: optionalText("seo_description"),
    seo_keywords: optionalList("seo_keywords"),
    canonical_url: article.canonical_url,
    og_title: optionalText("og_title"),
    og_description: optionalText("og_description"),
    allow_indexing: article.allow_indexing,
    sources: optionalList("sources"),
    bibliography: optionalList("bibliography"),
    featured: article.featured,
    show_on_homepage: article.show_on_homepage,
    pinned: article.pinned,
  };
  return parseArticleWorkingDraft({
    article_id: article.id,
    base_article_updated_at: input.sourceUpdatedAt,
    payload,
    english_payload: { mode: "disabled" },
    expected_english_updated_at: input.expectedEnglishUpdatedAt,
    draft_scope: "bundle",
    draft_english_enabled: false,
    version: 1,
    updated_at: input.sourceUpdatedAt,
  }).payload;
}
