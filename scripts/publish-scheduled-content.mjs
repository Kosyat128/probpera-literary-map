import { appendFile } from "node:fs/promises";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";

const rawSupabaseUrl = (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/+$/u, "");
const supabaseUrl = rawSupabaseUrl
  ? trustedSupabaseOrigin(rawSupabaseUrl)
  : "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const outputPath = process.env.GITHUB_OUTPUT || "";
const finalizeArgument = process.argv.find((argument) =>
  argument.startsWith("--finalize=")
);
const articleIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const articleTimestampPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

function isDatabaseTimestamp(value) {
  const match = typeof value === "string" && articleTimestampPattern.exec(value);
  if (!match || match[0] !== value || !Number.isFinite(Date.parse(value))) return false;
  const calendar = Date.parse(`${match[1]}Z`);
  return Number.isFinite(calendar) && new Date(calendar).toISOString().slice(0, 19) === match[1];
}

async function setOutput(name, value) {
  if (outputPath) await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

if (!supabaseUrl || !serviceKey) {
  if (process.env.GITHUB_ACTIONS === "true") {
    throw new Error(
      "Scheduled publishing requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  console.log(
    "Scheduled publishing skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured."
  );
  await setOutput("published", "0");
  await setOutput("ids", "");
  process.exit(0);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};
const now = new Date().toISOString();
const articlesEndpoint = new URL("/rest/v1/articles", supabaseUrl);

if (finalizeArgument) {
  const ids = finalizeArgument
    .slice("--finalize=".length)
    .split(",")
    .map((id) => id.trim())
    .filter((id) => articleIdPattern.test(id));
  if (!ids.length) {
    console.log("No scheduled publication ids to finalize.");
    process.exit(0);
  }
  const finalizeUrl = new URL(articlesEndpoint);
  finalizeUrl.searchParams.set("id", `in.(${ids.join(",")})`);
  const finalizeResponse = await fetch(finalizeUrl, {
    method: "PATCH",
    redirect: "error",
    headers,
    body: JSON.stringify({ scheduled_at: null }),
  });
  if (!finalizeResponse.ok) {
    throw new Error(
      `Scheduled article finalization failed: ${finalizeResponse.status} ${await finalizeResponse.text()}`
    );
  }
  console.log(`Finalized ${ids.length} scheduled article(s).`);
  process.exit(0);
}

const dueUrl = new URL(articlesEndpoint);
dueUrl.search = new URLSearchParams({
  select: "id,status,scheduled_at,updated_at",
  status: "in.(scheduled,published)",
  deleted_at: "is.null",
  scheduled_at: `lte.${now}`,
  order: "scheduled_at.asc",
  limit: "100",
}).toString();
const dueResponse = await fetch(dueUrl, { headers, redirect: "error" });
if (!dueResponse.ok) {
  throw new Error(
    `Scheduled article query failed: ${dueResponse.status} ${await dueResponse.text()}`
  );
}

const dueArticles = await dueResponse.json();
if (!Array.isArray(dueArticles) || dueArticles.length > 100 || dueArticles.some((article) =>
  typeof article?.id !== "string" || article.id.length !== 36 || !articleIdPattern.test(article.id) ||
  (article.status !== "scheduled" && article.status !== "published") ||
  !isDatabaseTimestamp(article.scheduled_at) || !isDatabaseTimestamp(article.updated_at)
)) {
  throw new Error("Scheduled article query returned an invalid row.");
}
const publishedArticles = [];
for (const article of dueArticles) {
  // A staff edit can supersede this selection before we send the mutation.
  // Compare the selected article revision in the same statement as publication.
  const updateUrl = new URL(articlesEndpoint);
  updateUrl.searchParams.set("select", "id");
  updateUrl.searchParams.set("id", `eq.${article.id}`);
  updateUrl.searchParams.set("status", `eq.${article.status}`);
  updateUrl.searchParams.set("scheduled_at", `eq.${article.scheduled_at}`);
  updateUrl.searchParams.set("updated_at", `eq.${article.updated_at}`);
  updateUrl.searchParams.set("deleted_at", "is.null");
  const updateResponse = await fetch(
    updateUrl,
    {
      method: "PATCH",
      redirect: "error",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "published",
        published_at: now,
        // The transactional outbox is the retry contract. Clearing the schedule
        // in the same mutation prevents a failed deploy from publishing the row
        // repeatedly while still leaving its outbox request pending.
        scheduled_at: null,
      }),
    }
  );
  if (!updateResponse.ok) {
    throw new Error(
      `Scheduled article update failed: ${updateResponse.status} ${await updateResponse.text()}`
    );
  }
  const updatedRows = await updateResponse.json();
  if (!Array.isArray(updatedRows) || updatedRows.length > 1 ||
      (updatedRows.length === 1 && updatedRows[0]?.id !== article.id)) {
    throw new Error("Scheduled article update returned an invalid row.");
  }
  if (updatedRows.length === 1) publishedArticles.push(article);
}
if (!dueArticles.length) {
  console.log("No scheduled articles are due.");
}

const designQuery = new URLSearchParams({
  select: "id,cas_version,scheduled_at",
  status: "eq.approved",
  scheduled_at: `lte.${now}`,
  order: "scheduled_at.asc",
  limit: "25",
});
const dueDesignResponse = await fetch(
  `${supabaseUrl}/rest/v1/site_design_change_sets?${designQuery.toString()}`,
  { headers, redirect: "error" }
);
if (!dueDesignResponse.ok) {
  throw new Error(
    `Scheduled Site Studio query failed: ${dueDesignResponse.status} ${await dueDesignResponse.text()}`
  );
}
const dueDesignChangeSets = await dueDesignResponse.json();
const publishedDesignChangeSets = [];
for (const changeSet of dueDesignChangeSets) {
  const publishResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/publish_site_design_change_set`,
    {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify({
        p_change_set_id: changeSet.id,
        p_expected_cas_version: changeSet.cas_version,
      }),
    }
  );
  if (!publishResponse.ok) {
    throw new Error(
      `Scheduled Site Studio release failed: ${publishResponse.status} ${await publishResponse.text()}`
    );
  }
  publishedDesignChangeSets.push(changeSet.id);
}

const publishedCount =
  publishedArticles.length + publishedDesignChangeSets.length;
await setOutput("published", String(publishedCount));
await setOutput(
  "ids",
  publishedArticles.map((article) => article.id).join(",")
);
console.log(
  `Published ${publishedArticles.length} scheduled article(s) and ${publishedDesignChangeSets.length} Site Studio release(s).`
);
