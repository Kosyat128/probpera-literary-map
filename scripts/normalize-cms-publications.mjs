import {
  applyEditorialPublicationFix,
  LATEST_EDITORIAL_ARTICLE_ID,
  latestEditorialArticleFix,
} from "./editorial-publication-fixes.mjs";
import { articleSectionSlug } from "./lib/article-route-policy.mjs";

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).replace(/\/+$/u, "");
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const siteOrigin = (
  process.env.PUBLIC_SITE_URL || "https://probpera.ru"
).replace(/\/+$/u, "");

if (!supabaseUrl || !serviceKey) {
  console.log(
    "CMS normalization skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured."
  );
  process.exit(0);
}

function shortStableHash(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function cleanSlug(article) {
  let slug = String(article.slug || "").trim();
  if (article.legacy_id) {
    const suffix = `-${shortStableHash(String(article.legacy_id))}`;
    if (slug.endsWith(suffix)) slug = slug.slice(0, -suffix.length);
  }
  return slug.replace(/-kopiya-[a-z0-9]{5}$/u, "-kopiya");
}

function relationValue(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function publicPath(slug, categorySlug) {
  return `/stati/${articleSectionSlug(categorySlug)}/${slug}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

const articles = await request(
  "articles?select=id,legacy_id,slug,title,created_by,author_id,categories(slug)&deleted_at=is.null&order=published_at.asc"
);
const normalizedCounts = new Map();
const changes = [];

for (const article of articles) {
  const baseSlug = cleanSlug(article) || "material";
  const count = (normalizedCounts.get(baseSlug) || 0) + 1;
  normalizedCounts.set(baseSlug, count);
  const nextSlug = count === 1 ? baseSlug : `${baseSlug}-${count}`;
  if (nextSlug !== article.slug) changes.push({ article, nextSlug });
}

for (const { article, nextSlug } of changes) {
  const category = relationValue(article.categories);
  const oldPath = publicPath(article.slug, category?.slug);
  const nextPath = publicPath(nextSlug, category?.slug);
  await request(`articles?id=eq.${encodeURIComponent(article.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      slug: nextSlug,
      canonical_url: `${siteOrigin}${nextPath}/`,
      updated_at: new Date().toISOString(),
    }),
  });

  const createdBy = article.created_by || article.author_id;
  if (createdBy) {
    await request("redirects?on_conflict=source_path", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        source_path: oldPath,
        destination_path: nextPath,
        status_code: 301,
        is_active: true,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      }),
    });
  }
}

const latestRows = await request(
  `articles?select=id,title,content_html&id=eq.${encodeURIComponent(
    LATEST_EDITORIAL_ARTICLE_ID
  )}&limit=1`
);
const latestArticle = latestRows[0] || null;
const correctedLatest = applyEditorialPublicationFix(latestArticle);
if (latestArticle && correctedLatest !== latestArticle) {
  await request(`articles?id=eq.${encodeURIComponent(LATEST_EDITORIAL_ARTICLE_ID)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...latestEditorialArticleFix,
      updated_at: new Date().toISOString(),
    }),
  });
}

console.log(
  `CMS normalized: ${changes.length} readable article URLs; latest publication ${
    latestArticle && correctedLatest !== latestArticle
      ? "proofread and updated"
      : "already current"
  }.`
);
