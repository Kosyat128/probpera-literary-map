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
let publishedArticles = [];
if (dueArticles.length) {
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
  publishedArticles = await updateResponse.json();
} else {
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
  { headers }
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
