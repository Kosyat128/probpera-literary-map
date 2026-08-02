import { appendFile } from "node:fs/promises";

const supabaseUrl = (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/+$/u, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const outputPath = process.env.GITHUB_OUTPUT || "";
const finalizeArgument = process.argv.find((argument) =>
  argument.startsWith("--finalize=")
);

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

if (finalizeArgument) {
  const ids = finalizeArgument
    .slice("--finalize=".length)
    .split(",")
    .map((id) => id.trim())
    .filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)
    );
  if (!ids.length) {
    console.log("No scheduled publication ids to finalize.");
    process.exit(0);
  }
  const finalizeResponse = await fetch(
    `${supabaseUrl}/rest/v1/articles?id=in.(${encodeURIComponent(ids.join(","))})`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ scheduled_at: null }),
    }
  );
  if (!finalizeResponse.ok) {
    throw new Error(
      `Scheduled article finalization failed: ${finalizeResponse.status} ${await finalizeResponse.text()}`
    );
  }
  console.log(`Finalized ${ids.length} scheduled article(s).`);
  process.exit(0);
}

const query = new URLSearchParams({
  select: "id,slug,scheduled_at",
  status: "in.(scheduled,published)",
  deleted_at: "is.null",
  scheduled_at: `lte.${now}`,
  order: "scheduled_at.asc",
  limit: "100",
});
const dueResponse = await fetch(
  `${supabaseUrl}/rest/v1/articles?${query.toString()}`,
  { headers }
);
if (!dueResponse.ok) {
  throw new Error(
    `Scheduled article query failed: ${dueResponse.status} ${await dueResponse.text()}`
  );
}

const dueArticles = await dueResponse.json();
if (!dueArticles.length) {
  console.log("No scheduled articles are due.");
  await setOutput("published", "0");
  await setOutput("ids", "");
  process.exit(0);
}

const ids = dueArticles.map((article) => article.id).join(",");
const updateResponse = await fetch(
  `${supabaseUrl}/rest/v1/articles?id=in.(${encodeURIComponent(ids)})`,
  {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: "published",
      published_at: now,
    }),
  }
);
if (!updateResponse.ok) {
  throw new Error(
    `Scheduled article update failed: ${updateResponse.status} ${await updateResponse.text()}`
  );
}

const published = await updateResponse.json();
await setOutput("published", String(published.length));
await setOutput("ids", published.map((article) => article.id).join(","));
console.log(`Published ${published.length} scheduled article(s).`);
