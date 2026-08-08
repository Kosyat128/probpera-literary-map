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
const vkApiVersion = "5.199";
const pendingBatchSize = 25;
const pendingPageSize = 100;

class VkApiError extends Error {
  constructor(method, error = {}, response = {}) {
    const code = Number.isFinite(Number(error.error_code))
      ? Number(error.error_code)
      : null;
    const subcode = Number.isFinite(Number(error.error_subcode))
      ? Number(error.error_subcode)
      : null;
    const message = String(error.error_msg || "VK API request failed").trim();
    super(`${method}: ${code === null ? "VK API" : `VK ${code}`} — ${message}`);
    this.name = "VkApiError";
    this.method = method;
    this.code = code;
    this.subcode = subcode;
    this.requestId = String(error.request_id || response.request_id || "").trim() || null;
    this.coverError = null;
  }
}

function cleanErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const knownVkTokens = [
    process.env.VK_USER_ACCESS_TOKEN,
    process.env.VK_GROUP_ACCESS_TOKEN,
    process.env.VK_ACCESS_TOKEN,
  ]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length >= 8);
  let cleaned = message;
  for (const token of knownVkTokens) {
    cleaned = cleaned.split(token).join("[redacted]");
  }
  return cleaned
    .replace(/access_token=[^&\s]+/giu, "access_token=[redacted]")
    .replace(/Bearer\s+[^\s]+/giu, "Bearer [redacted]")
    .replace(/\bvk[12]\.[a-z]\.[a-z0-9._-]+/giu, "[redacted]")
    .slice(0, 1000);
}

function sanitizeVkError(error) {
  if (error instanceof VkApiError) {
    return {
      provider: "vk",
      method: error.method,
      code: error.code,
      subcode: error.subcode,
      request_id: error.requestId,
      message: cleanErrorMessage(error),
      ...(error.coverError ? { cover_error: error.coverError } : {}),
    };
  }

  return {
    provider: "vk",
    method: "unknown",
    code: null,
    subcode: null,
    request_id: null,
    message: cleanErrorMessage(error),
  };
}

function logSanitizedError(label, details) {
  console.error(`${label}: ${JSON.stringify(details)}`);
}

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

async function vkApiRequest(method, parameters, token) {
  const body = new URLSearchParams({
    ...parameters,
    access_token: token,
    v: vkApiVersion,
  });
  let response;
  try {
    response = await fetch(`https://api.vk.com/method/${method}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new VkApiError(method, {
      error_msg: `Network request failed: ${cleanErrorMessage(error)}`,
    });
  }

  let payload = null;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new VkApiError(method, {
      error_msg: `VK returned an invalid response (HTTP ${response.status}).`,
    });
  }

  if (!response.ok) {
    throw new VkApiError(
      method,
      payload?.error || { error_msg: `VK returned HTTP ${response.status}.` },
      payload
    );
  }
  if (payload?.error) {
    throw new VkApiError(method, payload.error, payload);
  }
  return payload?.response;
}

async function uploadVkPhoto(uploadUrl, form) {
  let response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new VkApiError("photos.uploadWallPhoto", {
      error_msg: `Upload request failed: ${cleanErrorMessage(error)}`,
    });
  }

  let payload = null;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new VkApiError("photos.uploadWallPhoto", {
      error_msg: `VK upload server returned an invalid response (HTTP ${response.status}).`,
    });
  }

  if (!response.ok || payload?.error) {
    throw new VkApiError(
      "photos.uploadWallPhoto",
      payload?.error || { error_msg: `VK upload server returned HTTP ${response.status}.` },
      payload
    );
  }
  if (!payload?.server || !payload?.photo || !payload?.hash) {
    throw new VkApiError("photos.uploadWallPhoto", {
      error_msg: "VK upload server response is incomplete.",
    });
  }
  return payload;
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
  const pending = [];
  let offset = 0;

  while (pending.length < pendingBatchSize) {
    const query = new URLSearchParams({
      select: "id,entity_id,metadata,created_at",
      action: "eq.social_publish.requested",
      order: "id.asc",
      limit: String(pendingPageSize),
      offset: String(offset),
    });
    const requests = await selectAuditLog(query);
    if (!requests.length) break;

    const requestIds = requests.map((request) => String(request.id));
    const resultQuery = new URLSearchParams({
      select: "id,entity_id,action,metadata",
      entity_id: `in.(${requestIds.join(",")})`,
      action: "in.(social_publish.succeeded,social_publish.completed)",
      order: "id.asc",
      limit: String(pendingPageSize * 20),
    });
    const pageResults = await selectAuditLog(resultQuery);
    const requestResults = requests.map((request) => ({
      request,
      results: pageResults.filter(
        (result) => String(result.entity_id) === String(request.id)
      ),
    }));

    for (const item of requestResults) {
      if (!item.results.some((result) => result.action === "social_publish.completed")) {
        pending.push(item);
        if (pending.length >= pendingBatchSize) break;
      }
    }

    offset += requests.length;
    if (requests.length < pendingPageSize) break;
  }

  return pending;
}

async function uploadVkCover(imageUrl, groupId, userToken) {
  if (!imageUrl) return "";
  const server = await vkApiRequest(
    "photos.getWallUploadServer",
    { group_id: groupId },
    userToken
  );
  if (!server?.upload_url) {
    throw new VkApiError("photos.getWallUploadServer", {
      error_msg: "VK did not return a wall photo upload URL.",
    });
  }

  let imageResponse;
  try {
    imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new VkApiError("photos.fetchCover", {
      error_msg: `Cover request failed: ${cleanErrorMessage(error)}`,
    });
  }
  if (!imageResponse.ok) {
    throw new VkApiError("photos.fetchCover", {
      error_msg: `Cover returned HTTP ${imageResponse.status}.`,
    });
  }

  const form = new FormData();
  form.append(
    "photo",
    await imageResponse.blob(),
    new URL(imageUrl).pathname.split("/").at(-1) || "cover.webp"
  );
  const uploaded = await uploadVkPhoto(server.upload_url, form);
  const saved = await vkApiRequest(
    "photos.saveWallPhoto",
    {
      group_id: groupId,
      server: String(uploaded.server),
      photo: String(uploaded.photo),
      hash: String(uploaded.hash),
    },
    userToken
  );
  const photo = saved?.[0];
  return photo ? `photo${photo.owner_id}_${photo.id}` : "";
}

async function publishVk(article, context = {}) {
  const groupToken =
    (process.env.VK_GROUP_ACCESS_TOKEN || "").trim() ||
    (process.env.VK_ACCESS_TOKEN || "").trim();
  const userToken = (process.env.VK_USER_ACCESS_TOKEN || "").trim();
  const groupId = (process.env.VK_GROUP_ID || "").trim().replace(/^-/, "");
  const wallToken = userToken || groupToken;
  if (!wallToken || !groupId) {
    return {
      ok: false,
      state: "not-configured",
      message: "VK_USER_ACCESS_TOKEN or VK_GROUP_ACCESS_TOKEN/VK_ACCESS_TOKEN, and VK_GROUP_ID",
    };
  }

  let attachment = "";
  let coverError = null;
  let coverState = article.cover_external_url ? "skipped-no-user-token" : "not-provided";
  if (userToken && article.cover_external_url) {
    try {
      attachment = await uploadVkCover(article.cover_external_url, groupId, userToken);
      coverState = attachment ? "attached" : "not-returned";
    } catch (error) {
      coverError = sanitizeVkError(error);
      coverState = "failed";
      logSanitizedError("VK cover upload skipped", coverError);
    }
  }

  const parameters = {
    owner_id: `-${groupId}`,
    from_group: "1",
    message: socialText(article),
    guid: md5(`probpera:vk:${String(context.requestId || article.id)}`),
    ...(userToken
      ? { attachments: [attachment, articleUrl(article)].filter(Boolean).join(",") }
      : {}),
  };
  try {
    const result = await vkApiRequest("wall.post", parameters, wallToken);
    return {
      ok: true,
      state: "published",
      remoteId: result?.post_id ? String(result.post_id) : null,
      authMode: userToken ? "user" : "group",
      coverAttached: Boolean(attachment),
      coverState,
      ...(coverError ? { cover_error: coverError } : {}),
    };
  } catch (error) {
    if (error instanceof VkApiError && coverError) {
      error.coverError = coverError;
    }
    throw error;
  }
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
    console.error(
      "Social publishing is pending: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
    process.exitCode = 1;
    return;
  }

  await bootstrapLatestRequest();
  const jobs = await pendingRequests();
  if (!jobs.length) {
    console.log("No pending social publication requests.");
    return;
  }

  let hasRealFailure = false;
  for (const { request, results } of jobs) {
    const articleId = request.metadata?.article_id || request.entity_id;
    const article = await fetchArticle(articleId);
    if (!article) {
      const errorDetails = {
        provider: "content",
        code: "published-article-not-found",
        message: "Published article was not found for the social publication request.",
      };
      hasRealFailure = true;
      logSanitizedError("Social publication failed", errorDetails);
      await appendAuditLog("social_publish.failed", request.id, {
        platform: "all",
        error: "published-article-not-found",
        error_details: errorDetails,
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
        hasRealFailure = true;
        const errorDetails = {
          provider: platform,
          code: "unsupported-platform",
          message: `Social publisher is not implemented for platform: ${platform}`,
        };
        logSanitizedError("Social publication failed", errorDetails);
        await appendAuditLog("social_publish.failed", request.id, {
          article_id: article.id,
          platform,
          error: errorDetails.message,
          error_details: errorDetails,
        });
        continue;
      }
      try {
        const result = await publisher(article, {
          requestId: request.id,
          request,
        });
        states[platform] = result.state;
        if (!result.ok) {
          hasRealFailure = true;
          logSanitizedError("Social publication is not configured", {
            provider: platform,
            code: result.state || "not-configured",
            message: cleanErrorMessage(result.message || "Required social channel is not configured."),
          });
        }
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
        const errorDetails =
          platform === "vk"
            ? sanitizeVkError(error)
            : {
                provider: platform,
                message: cleanErrorMessage(error),
              };
        hasRealFailure = true;
        states[platform] = "failed";
        logSanitizedError("Social publication failed", errorDetails);
        await appendAuditLog("social_publish.failed", request.id, {
          article_id: article.id,
          platform,
          error: errorDetails.message,
          error_details: errorDetails,
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

  if (hasRealFailure) {
    process.exitCode = 1;
  }
}

await main();
