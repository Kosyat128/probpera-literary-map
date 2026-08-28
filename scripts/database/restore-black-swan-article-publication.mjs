import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const BLACK_SWAN_ARTICLE_ID =
  "7ad1ab89-8a77-407d-b59a-6147c0e2a7a6";
export const BLACK_SWAN_ARTICLE_LEGACY_ID =
  "page--article--page--books--14";
export const BLACK_SWAN_ARTICLE_TITLE =
  "Мнение о книге Дэвида Митчелла «Под знаком чёрного лебедя»";
// The CMS relation stores the editorial slug. `mnenie-o-knige` is only the
// mapped public route segment and must never be used as the database guard.
export const BLACK_SWAN_ARTICLE_CATEGORY_SLUG = "book-opinions";
export const BLACK_SWAN_ARTICLE_CONTENT_SHA256 =
  "85646997f27307f053793b99776572f3133a08a24949f4660ddd1f87e6945078";
export const BLACK_SWAN_ARTICLE_SLUG =
  "mnenie-o-knige-devida-mitchella-pod-znakom-chernogo-lebedya";
export const BLACK_SWAN_ARTICLE_LEGACY_PATH =
  "/read/page-article/page-books/14";
export const BLACK_SWAN_ARTICLE_CANONICAL_URL =
  "https://probpera.ru/stati/mnenie-o-knige/mnenie-o-knige-devida-mitchella-pod-znakom-chernogo-lebedya/";
export const BLACK_SWAN_ARTICLE_FALLBACK_PUBLISHED_AT =
  "2025-12-12T09:00:00+00:00";

const EXPECTED_PRODUCTION_PROJECT_REF = "sjqejjmwpzfsczxdghvw";
const SELECTED_FIELDS = [
  "id",
  "legacy_id",
  "title",
  "slug",
  "content_html",
  "legacy_path",
  "canonical_url",
  "status",
  "published_at",
  "deleted_at",
  "updated_at",
  "categories(slug)",
].join(",");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function categorySlug(row) {
  const relation = row?.categories;
  if (Array.isArray(relation)) {
    invariant(
      relation.length === 1,
      "The production article does not resolve to exactly one category."
    );
    return relation[0]?.slug;
  }
  return relation?.slug;
}

export function assertBlackSwanArticleIdentity(row) {
  invariant(row?.id === BLACK_SWAN_ARTICLE_ID, "The article id has drifted.");
  invariant(
    row?.legacy_id === BLACK_SWAN_ARTICLE_LEGACY_ID,
    "The article legacy_id has drifted."
  );
  invariant(
    row?.title === BLACK_SWAN_ARTICLE_TITLE,
    "The article title has drifted."
  );
  invariant(
    categorySlug(row) === BLACK_SWAN_ARTICLE_CATEGORY_SLUG,
    "The article category slug has drifted."
  );
  invariant(
    typeof row?.content_html === "string" &&
      sha256Text(row.content_html) === BLACK_SWAN_ARTICLE_CONTENT_SHA256,
    "The article content_html SHA-256 has drifted."
  );
  invariant(
    typeof row?.updated_at === "string" && row.updated_at.length > 0,
    "The article row is missing its optimistic-concurrency timestamp."
  );
  invariant(
    row.published_at === null ||
      (typeof row.published_at === "string" && row.published_at.length > 0),
    "The article published_at value is invalid."
  );
}

export function desiredBlackSwanArticlePatch(row) {
  assertBlackSwanArticleIdentity(row);
  return Object.freeze({
    slug: BLACK_SWAN_ARTICLE_SLUG,
    legacy_path: BLACK_SWAN_ARTICLE_LEGACY_PATH,
    canonical_url: BLACK_SWAN_ARTICLE_CANONICAL_URL,
    status: "published",
    published_at:
      row.published_at === null
        ? BLACK_SWAN_ARTICLE_FALLBACK_PUBLISHED_AT
        : row.published_at,
    deleted_at: null,
  });
}

function matchesPatch(row, patch) {
  return Object.entries(patch).every(([key, value]) => row?.[key] === value);
}

export function resolveBlackSwanProductionEnvironment(environment) {
  const supabaseUrl = String(environment?.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(
    environment?.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  invariant(
    supabaseUrl && serviceRoleKey,
    "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("VITE_SUPABASE_URL is not a valid production API URL.");
  }
  invariant(
    parsedUrl.protocol === "https:" &&
      parsedUrl.hostname === `${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co` &&
      parsedUrl.port === "" &&
      parsedUrl.username === "" &&
      parsedUrl.password === "" &&
      parsedUrl.pathname === "/" &&
      parsedUrl.search === "" &&
      parsedUrl.hash === "",
    "VITE_SUPABASE_URL does not identify the pinned production project."
  );
  invariant(
    serviceRoleKey.length >= 20,
    "SUPABASE_SERVICE_ROLE_KEY is not configured as a production credential."
  );
  return Object.freeze({
    supabaseUrl: parsedUrl.origin,
    serviceRoleKey,
  });
}

function articleUrl(supabaseUrl, parameters) {
  const url = new URL("/rest/v1/articles", supabaseUrl);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function requestHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

async function requestJson(fetchImpl, url, options, label) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch {
    throw new Error(`${label} failed before receiving a response.`);
  }
  invariant(
    response?.ok,
    `${label} failed with HTTP status ${Number(response?.status) || "unknown"}.`
  );
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned an invalid JSON response.`);
  }
}

async function readArticle({ fetchImpl, supabaseUrl, serviceRoleKey }) {
  const rows = await requestJson(
    fetchImpl,
    articleUrl(supabaseUrl, {
      id: `eq.${BLACK_SWAN_ARTICLE_ID}`,
      select: SELECTED_FIELDS,
      limit: "2",
    }),
    { method: "GET", headers: requestHeaders(serviceRoleKey) },
    "Article read"
  );
  invariant(
    Array.isArray(rows) && rows.length === 1,
    "The exact production article could not be resolved uniquely."
  );
  return rows[0];
}

export async function restoreBlackSwanArticlePublication({
  fetchImpl = globalThis.fetch,
  environment = process.env,
} = {}) {
  invariant(typeof fetchImpl === "function", "A fetch implementation is required.");
  const { supabaseUrl, serviceRoleKey } =
    resolveBlackSwanProductionEnvironment(environment);
  const request = { fetchImpl, supabaseUrl, serviceRoleKey };
  const before = await readArticle(request);
  const patch = desiredBlackSwanArticlePatch(before);
  if (matchesPatch(before, patch)) {
    return Object.freeze({
      status: "already-correct",
      id: BLACK_SWAN_ARTICLE_ID,
    });
  }

  const updatedRows = await requestJson(
    fetchImpl,
    articleUrl(supabaseUrl, {
      id: `eq.${BLACK_SWAN_ARTICLE_ID}`,
      updated_at: `eq.${before.updated_at}`,
      select: SELECTED_FIELDS,
    }),
    {
      method: "PATCH",
      headers: requestHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify(patch),
    },
    "Guarded article publication restore"
  );
  invariant(
    Array.isArray(updatedRows) && updatedRows.length === 1,
    "The guarded article publication restore lost its updated_at concurrency race."
  );

  const after = await readArticle(request);
  assertBlackSwanArticleIdentity(after);
  invariant(
    matchesPatch(after, patch),
    "The production article did not retain the exact restored publication state."
  );
  return Object.freeze({
    status: "updated-and-verified",
    id: BLACK_SWAN_ARTICLE_ID,
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--validate-environment-only") {
    resolveBlackSwanProductionEnvironment(process.env);
    console.log("Production article-restore environment is valid.");
    return;
  }
  invariant(
    args.length === 1 && args[0] === "--apply",
    "Refusing to run without the single explicit --apply argument."
  );
  const result = await restoreBlackSwanArticlePublication();
  console.log(`Black Swan article publication restore: ${result.status}.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Black Swan article publication restore failed."
    );
    process.exitCode = 1;
  });
}
