import { pathToFileURL } from "node:url";

export const BIBLE_ARTICLE_ID = "50978dc4-c80f-4bc6-aed0-7e9fd693193a";
export const BIBLE_ARTICLE_SLUG =
  "15-krylatyh-vyrazheniy-prishedshih-k-niz-biblii";
export const BIBLE_ARTICLE_BEFORE = Object.freeze({
  id: BIBLE_ARTICLE_ID,
  title: "15 крылатых выражений, пришедших к низ Библии",
  slug: BIBLE_ARTICLE_SLUG,
  seo_title:
    "15 крылатых выражений, пришедших к нам из древнегреческой мифологии",
  og_title:
    "15 крылатых выражений, пришедших к нам из древнегреческой мифологии",
  status: "published",
});
export const BIBLE_ARTICLE_PATCH = Object.freeze({
  title: "15 крылатых выражений, пришедших к нам из Библии",
  seo_title: "15 крылатых выражений, пришедших к нам из Библии",
  og_title: "15 крылатых выражений, пришедших к нам из Библии",
});
export const BIBLE_ARTICLE_AFTER = Object.freeze({
  ...BIBLE_ARTICLE_BEFORE,
  ...BIBLE_ARTICLE_PATCH,
});

const EXPECTED_PRODUCTION_PROJECT_REF = "sjqejjmwpzfsczxdghvw";
const SELECTED_FIELDS =
  "id,title,slug,seo_title,og_title,status,updated_at";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function matches(row, expected) {
  return Object.entries(expected).every(([key, value]) => row?.[key] === value);
}

export function classifyBibleArticleMetadata(row) {
  invariant(
    typeof row?.updated_at === "string" && row.updated_at.length > 0,
    "The article row is missing its optimistic-concurrency timestamp."
  );
  if (matches(row, BIBLE_ARTICLE_AFTER)) return "after";
  if (matches(row, BIBLE_ARTICLE_BEFORE)) return "before";
  throw new Error(
    "The production article does not match the exact reviewed before or after state."
  );
}

export function resolveBibleArticleProductionEnvironment(environment) {
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
      id: `eq.${BIBLE_ARTICLE_ID}`,
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

export async function applyBibleArticleMetadataFix({
  fetchImpl = globalThis.fetch,
  environment = process.env,
} = {}) {
  invariant(typeof fetchImpl === "function", "A fetch implementation is required.");
  const { supabaseUrl, serviceRoleKey } =
    resolveBibleArticleProductionEnvironment(environment);
  const request = { fetchImpl, supabaseUrl, serviceRoleKey };
  const before = await readArticle(request);
  const state = classifyBibleArticleMetadata(before);
  if (state === "after") {
    return Object.freeze({ status: "already-correct", id: BIBLE_ARTICLE_ID });
  }

  const updatedRows = await requestJson(
    fetchImpl,
    articleUrl(supabaseUrl, {
      id: `eq.${BIBLE_ARTICLE_ID}`,
      updated_at: `eq.${before.updated_at}`,
      select: SELECTED_FIELDS,
    }),
    {
      method: "PATCH",
      headers: requestHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify(BIBLE_ARTICLE_PATCH),
    },
    "Guarded article update"
  );
  invariant(
    Array.isArray(updatedRows) && updatedRows.length === 1,
    "The guarded article update lost its updated_at concurrency race."
  );

  const after = await readArticle(request);
  invariant(
    classifyBibleArticleMetadata(after) === "after",
    "The production article did not retain the exact verified after state."
  );
  return Object.freeze({ status: "updated-and-verified", id: BIBLE_ARTICLE_ID });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--validate-environment-only") {
    resolveBibleArticleProductionEnvironment(process.env);
    console.log("Production metadata-fix environment is valid.");
    return;
  }
  invariant(
    args.length === 1 && args[0] === "--apply",
    "Refusing to run without the single explicit --apply argument."
  );
  const result = await applyBibleArticleMetadataFix();
  console.log(`Bible article metadata fix: ${result.status}.`);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Bible article metadata fix failed."
    );
    process.exitCode = 1;
  });
}
