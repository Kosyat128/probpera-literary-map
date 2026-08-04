import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/u, "");
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const siteUrl = (process.env.PUBLIC_SITE_URL || "https://probpera.ru")
  .trim()
  .replace(/\/+$/u, "");
const requiredPlatforms = new Set(
  (process.env.SOCIAL_REQUIRED_PLATFORMS || "vk,ok,dzen")
    .split(",")
    .map((item) => item.trim().toLocaleLowerCase("ru"))
    .filter(Boolean)
);
const bootstrapLatest = process.env.SOCIAL_BOOTSTRAP_LATEST === "true";
const dryRun = process.argv.includes("--dry-run");

const categoryRoutes = {
  "book-opinions": "mnenie-o-knige",
  "screen-adaptations": "kniga-i-ekranizatsiya",
  "writers-world": "pisateli-mira",
  "book-guides": "knizhnyy-gid",
  awards: "literaturnye-premii",
  folklore: "folklor-i-mifologiya",
  language: "russkiy-yazyk",
  "literary-essays": "o-literature",
  "author-stories": "literaturnye-istorii",
};

function relationValue(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function articleUrl(article) {
  if (article.canonical_url) return article.canonical_url;
  const category = relationValue(article.categories);
  const route = categoryRoutes[category?.slug || ""] || "materialy";
  return `${siteUrl}/stati/${route}/${article.slug}/`;
}

function socialText(article) {
  const description = String(
    article.og_description || article.seo_description || article.excerpt || ""
  )
    .replace(/\s+/gu, " ")
    .trim();
  return `${article.title}\n\n${description.slice(0, 1200)}\n\n${articleUrl(article)}`;
}

function md5(value) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

async function apiRequest(resource, options = {}) {
  const response = await fetch(resource, {
    ...options,
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  let parsed = body;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    // The caller receives the original text for useful diagnostics.
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${String(body).slice(0, 500)}`);
  }
  return parsed;
}

function supabaseHeaders(prefer) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function selectAuditLog(query) {
  return apiRequest(`${supabaseUrl}/rest/v1/admin_audit_log?${query}`, {
    headers: supabaseHeaders(),
  });
}

async function appendAuditLog(action, entityId, metadata) {
  return apiRequest(`${supabaseUrl}/rest/v1/admin_audit_log`, {
    method: "POST",
    headers: supabaseHeaders("return=representation"),
    body: JSON.stringify({
      actor_id: null,
      action,
      entity_type: "social_publication",
      entity_id: String(entityId),
      metadata,
    }),
  });
}

async function fetchArticle(articleId) {
  const query = new URLSearchParams({
    select:
      "id,title,excerpt,slug,canonical_url,cover_external_url,seo_description,og_description,published_at,categories(slug)",
    id: `eq.${articleId}`,
    status: "eq.published",
    deleted_at: "is.null",
    limit: "1",
  });
  const rows = await apiRequest(`${supabaseUrl}/rest/v1/articles?${query}`, {
    headers: supabaseHeaders(),
  });
  return rows[0] || null;
}

async function bootstrapLatestRequest() {
  if (!bootstrapLatest) return null;
  const existing = await selectAuditLog(
    new URLSearchParams({
      select: "id",
      action: "like.social_publish.%",
      limit: "1",
    })
  );
  if (existing.length) return null;

  const query = new URLSearchParams({
    select: "id,title",
    status: "eq.published",
    deleted_at: "is.null",
    order: "published_at.desc",
    limit: "1",
  });
  const rows = await apiRequest(`${supabaseUrl}/rest/v1/articles?${query}`, {
    headers: supabaseHeaders(),
  });
  if (!rows[0]) return null;
  const inserted = await appendAuditLog("social_publish.requested", rows[0].id, {
    article_id: rows[0].id,
    title: rows[0].title,
    platforms: [...requiredPlatforms],
    reason: "bootstrap-latest-published",
  });
  return inserted[0] || null;
}

async function pendingRequests() {
  const query = new URLSearchParams({
    select: "id,entity_id,metadata,created_at",
    action: "eq.social_publish.requested",
    order: "id.asc",
    limit: "25",
  });
  const requests = await selectAuditLog(query);
  const pending = [];
  for (const request of requests) {
    const resultQuery = new URLSearchParams({
      select: "id,action,metadata",
      entity_id: `eq.${request.id}`,
      action: "in.(social_publish.succeeded,social_publish.completed)",
      order: "id.asc",
      limit: "20",
    });
    const results = await selectAuditLog(resultQuery);
    if (!results.some((result) => result.action === "social_publish.completed")) {
      pending.push({ request, results });
    }
  }
  return pending;
}

async function uploadVkCover(imageUrl, groupId, token) {
  if (!imageUrl) return "";
  try {
    const serverParams = new URLSearchParams({
      group_id: groupId,
      access_token: token,
      v: "5.199",
    });
    const server = await apiRequest(
      `https://api.vk.com/method/photos.getWallUploadServer?${serverParams}`,
      { method: "POST" }
    );
    if (server.error) throw new Error(server.error.error_msg || "VK upload server error");

    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageResponse.ok) throw new Error(`Cover HTTP ${imageResponse.status}`);
    const form = new FormData();
    form.append(
      "photo",
      await imageResponse.blob(),
      new URL(imageUrl).pathname.split("/").at(-1) || "cover.webp"
    );
    const uploaded = await apiRequest(server.response.upload_url, {
      method: "POST",
      body: form,
    });
    const saveParams = new URLSearchParams({
      group_id: groupId,
      server: String(uploaded.server),
      photo: String(uploaded.photo),
      hash: String(uploaded.hash),
      access_token: token,
      v: "5.199",
    });
    const saved = await apiRequest(
      `https://api.vk.com/method/photos.saveWallPhoto?${saveParams}`,
      { method: "POST" }
    );
    if (saved.error) throw new Error(saved.error.error_msg || "VK save photo error");
    const photo = saved.response?.[0];
    return photo ? `photo${photo.owner_id}_${photo.id}` : "";
  } catch (error) {
    console.warn(`VK cover upload skipped: ${error instanceof Error ? error.message : error}`);
    return "";
  }
}

async function publishVk(article) {
  const token = (process.env.VK_ACCESS_TOKEN || "").trim();
  const groupId = (process.env.VK_GROUP_ID || "").trim().replace(/^-/, "");
  if (!token || !groupId) {
    return { ok: false, state: "not-configured", message: "VK_ACCESS_TOKEN/VK_GROUP_ID" };
  }
  const attachment = await uploadVkCover(article.cover_external_url, groupId, token);
  const params = new URLSearchParams({
    owner_id: `-${groupId}`,
    from_group: "1",
    message: socialText(article),
    attachments: [attachment, articleUrl(article)].filter(Boolean).join(","),
    access_token: token,
    v: "5.199",
  });
  const result = await apiRequest("https://api.vk.com/method/wall.post", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (result.error) throw new Error(result.error.error_msg || "VK API error");
  return {
    ok: true,
    state: "published",
    remoteId: result.response?.post_id ? String(result.response.post_id) : null,
    coverAttached: Boolean(attachment),
  };
}

async function publishOk(article) {
  const accessToken = (process.env.OK_ACCESS_TOKEN || "").trim();
  const applicationKey = (process.env.OK_APPLICATION_KEY || "").trim();
  const sessionSecret = (process.env.OK_SESSION_SECRET_KEY || "").trim();
  const groupId = (process.env.OK_GROUP_ID || "").trim();
  if (!accessToken || !applicationKey || !sessionSecret || !groupId) {
    return {
      ok: false,
      state: "not-configured",
      message: "OK_ACCESS_TOKEN/OK_APPLICATION_KEY/OK_SESSION_SECRET_KEY/OK_GROUP_ID",
    };
  }
  const attachment = JSON.stringify({
    media: [
      { type: "text", text: socialText(article) },
      { type: "link", url: articleUrl(article) },
    ],
    onBehalfOfGroup: "true",
  });
  const signedParams = {
    application_key: applicationKey,
    attachment,
    format: "json",
    gid: groupId,
    method: "mediatopic.post",
    type: "GROUP_THEME",
  };
  const signatureSource = Object.entries(signedParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("");
  const params = new URLSearchParams({
    ...signedParams,
    access_token: accessToken,
    sig: md5(`${signatureSource}${sessionSecret}`),
  });
  const result = await apiRequest("https://api.ok.ru/fb.do", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (result?.error_code) throw new Error(result.error_msg || `OK ${result.error_code}`);
  return { ok: true, state: "published", remoteId: String(result || "") || null };
}

async function verifyDzenRss(article) {
  const rssUrl = (process.env.DZEN_RSS_URL || `${siteUrl}/rss.xml`).trim();
  const localRssPath = path.join(projectRoot, "dist", "rss.xml");
  let rss = "";
  try {
    rss = await fs.readFile(localRssPath, "utf8");
  } catch {
    const response = await fetch(rssUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
    rss = await response.text();
  }
  const canonical = articleUrl(article);
  if (!rss.includes(canonical) && !rss.includes(article.slug)) {
    throw new Error("Новая статья ещё не появилась в RSS после сборки.");
  }
  return { ok: true, state: "rss-ready", feedUrl: rssUrl };
}

const publishers = {
  vk: publishVk,
  ok: publishOk,
  dzen: verifyDzenRss,
};

async function dryRunPreview() {
  const snapshotPath = path.join(projectRoot, "public", "cms", "published-content.json");
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  const latest = snapshot.articles?.[0];
  if (!latest) throw new Error("В CMS-снимке нет опубликованных статей для проверки.");
  const article = {
    ...latest,
    canonical_url: latest.canonicalUrl,
    cover_external_url: latest.imageUrl,
    seo_description: latest.seoDescription,
    og_description: latest.ogDescription,
  };
  console.log(JSON.stringify({ url: articleUrl(article), text: socialText(article) }, null, 2));
}

async function main() {
  if (dryRun) {
    await dryRunPreview();
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    console.warn(
      "Social publishing is pending: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
    return;
  }

  await bootstrapLatestRequest();
  const jobs = await pendingRequests();
  if (!jobs.length) {
    console.log("No pending social publication requests.");
    return;
  }

  for (const { request, results } of jobs) {
    const articleId = request.metadata?.article_id || request.entity_id;
    const article = await fetchArticle(articleId);
    if (!article) {
      await appendAuditLog("social_publish.failed", request.id, {
        platform: "all",
        error: "published-article-not-found",
      });
      continue;
    }

    const succeeded = new Set(
      results
        .filter((result) => result.action === "social_publish.succeeded")
        .map((result) => result.metadata?.platform)
        .filter(Boolean)
    );
    const states = {};
    for (const platform of requiredPlatforms) {
      if (succeeded.has(platform)) {
        states[platform] = "already-published";
        continue;
      }
      const publisher = publishers[platform];
      if (!publisher) {
        states[platform] = "unsupported";
        continue;
      }
      try {
        const result = await publisher(article);
        states[platform] = result.state;
        await appendAuditLog(
          result.ok ? "social_publish.succeeded" : "social_publish.pending",
          request.id,
          {
            article_id: article.id,
            platform,
            ...result,
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        states[platform] = "failed";
        await appendAuditLog("social_publish.failed", request.id, {
          article_id: article.id,
          platform,
          error: message.slice(0, 1000),
        });
      }
    }

    const complete = [...requiredPlatforms].every((platform) =>
      ["published", "rss-ready", "already-published"].includes(states[platform])
    );
    if (complete) {
      await appendAuditLog("social_publish.completed", request.id, {
        article_id: article.id,
        platforms: states,
      });
    }
    console.log(`${article.title}: ${JSON.stringify(states)}`);
  }
}

await main();
