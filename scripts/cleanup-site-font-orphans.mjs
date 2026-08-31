import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_FONT_BUCKET = "site-fonts";
export const FONT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1_000;
export const FONT_ORPHAN_MAX_DELETE_BATCH = 100;
export const FONT_ORPHAN_DELETE_CHUNK_SIZE = 20;
export const FONT_ORPHAN_LIST_PAGE_SIZE = 100;
export const FONT_ORPHAN_DATABASE_PAGE_SIZE = 1_000;

const MAX_STORAGE_OBJECTS = 50_000;
const MAX_STORAGE_PREFIXES = 10_000;
const FONT_OBJECT_PATH_PATTERN =
  /^sha256\/([0-9a-f]{2})\/([0-9a-f]{64})\.(woff2|woff)$/u;

function assertPositiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${label} must be a positive integer no greater than ${maximum}.`);
  }
}

function parseTimestamp(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Storage object ${label} is missing.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Storage object ${label} is invalid.`);
  }
  return timestamp;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isContentAddressedFontPath(value) {
  if (typeof value !== "string") return false;
  const match = FONT_OBJECT_PATH_PATTERN.exec(value);
  return Boolean(match && match[1] === match[2].slice(0, 2));
}

function assertSafeEntryName(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error("Storage listing returned an ambiguous object name.");
  }
  return value;
}

function joinStoragePath(prefix, name) {
  return prefix ? `${prefix}/${name}` : name;
}

function legacyJwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function assertServiceRoleCredential(value) {
  const key = String(value || "").trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  if (key.startsWith("sb_publishable_")) {
    throw new Error("A publishable Supabase key cannot run font cleanup.");
  }
  if (key.startsWith("sb_secret_")) return key;
  if (legacyJwtRole(key) === "service_role") return key;
  throw new Error("Font cleanup requires a Supabase service-role credential.");
}

function resolveConfiguration(environment) {
  const supabaseUrl = String(
    environment.SUPABASE_URL || environment.VITE_SUPABASE_URL || ""
  )
    .trim()
    .replace(/\/+$/u, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is required.");
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new Error("SUPABASE_URL must be an HTTPS origin without credentials.");
  }
  if (parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) {
    throw new Error("SUPABASE_URL must be an origin without a path, query, or hash.");
  }
  return {
    supabaseUrl,
    serviceKey: assertServiceRoleCredential(
      environment.SUPABASE_SERVICE_ROLE_KEY
    ),
  };
}

function serviceHeaders(serviceKey, json = false) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function fetchJson(fetchImpl, url, options, operation) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(`${operation} request failed.`);
  }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? ` (${response.status})` : "";
    throw new Error(`${operation} request was rejected${status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${operation} returned an ambiguous response.`);
  }
}

export async function listSiteFontObjects({
  supabaseUrl,
  serviceKey,
  fetchImpl = fetch,
  pageSize = FONT_ORPHAN_LIST_PAGE_SIZE,
} = {}) {
  assertPositiveInteger(pageSize, "Storage page size", FONT_ORPHAN_LIST_PAGE_SIZE);
  const queue = [""];
  const seenPrefixes = new Set(queue);
  const seenObjects = new Set();
  const objects = [];

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const prefix = queue[queueIndex];
    let offset = 0;
    for (;;) {
      const payload = await fetchJson(
        fetchImpl,
        `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(SITE_FONT_BUCKET)}`,
        {
          method: "POST",
          headers: serviceHeaders(serviceKey, true),
          body: JSON.stringify({
            prefix,
            limit: pageSize,
            offset,
            sortBy: { column: "name", order: "asc" },
          }),
        },
        "Font storage listing"
      );
      if (!Array.isArray(payload)) {
        throw new Error("Font storage listing returned an ambiguous response.");
      }

      for (const entry of payload) {
        if (!isPlainObject(entry)) {
          throw new Error("Font storage listing returned ambiguous metadata.");
        }
        const name = assertSafeEntryName(entry.name);
        const objectPath = joinStoragePath(prefix, name);
        const isDirectory = entry.id == null && entry.metadata == null;
        const isObject =
          typeof entry.id === "string" && entry.id.length > 0 && isPlainObject(entry.metadata);

        if (isDirectory) {
          if (seenPrefixes.has(objectPath)) {
            throw new Error("Font storage listing returned a duplicate prefix.");
          }
          if (seenPrefixes.size >= MAX_STORAGE_PREFIXES) {
            throw new Error("Font storage prefix safety limit was exceeded.");
          }
          seenPrefixes.add(objectPath);
          queue.push(objectPath);
          continue;
        }
        if (!isObject) {
          throw new Error("Font storage listing returned ambiguous object metadata.");
        }
        if (!isContentAddressedFontPath(objectPath)) {
          throw new Error("Font storage contains a non-canonical object path.");
        }
        if (seenObjects.has(objectPath)) {
          throw new Error("Font storage listing returned a duplicate object.");
        }
        if (objects.length >= MAX_STORAGE_OBJECTS) {
          throw new Error("Font storage object safety limit was exceeded.");
        }
        const createdAtMs = parseTimestamp(entry.created_at, "created_at");
        const updatedAtMs =
          entry.updated_at == null
            ? createdAtMs
            : parseTimestamp(entry.updated_at, "updated_at");
        seenObjects.add(objectPath);
        objects.push({
          objectPath,
          createdAtMs,
          lastChangedAtMs: Math.max(createdAtMs, updatedAtMs),
        });
      }

      if (payload.length < pageSize) break;
      offset += payload.length;
    }
  }

  return objects;
}

export async function listReferencedSiteFontPaths({
  supabaseUrl,
  serviceKey,
  fetchImpl = fetch,
  pageSize = FONT_ORPHAN_DATABASE_PAGE_SIZE,
} = {}) {
  assertPositiveInteger(pageSize, "Database page size", FONT_ORPHAN_DATABASE_PAGE_SIZE);
  const paths = new Set();
  let offset = 0;

  for (;;) {
    const url = new URL(`${supabaseUrl}/rest/v1/font_assets`);
    url.searchParams.set("select", "object_path");
    url.searchParams.set("storage_bucket", `eq.${SITE_FONT_BUCKET}`);
    url.searchParams.set("order", "id.asc");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const payload = await fetchJson(
      fetchImpl,
      url,
      { method: "GET", headers: serviceHeaders(serviceKey) },
      "Font asset reference listing"
    );
    if (!Array.isArray(payload)) {
      throw new Error("Font asset reference listing returned an ambiguous response.");
    }
    for (const row of payload) {
      if (!isPlainObject(row) || !isContentAddressedFontPath(row.object_path)) {
        throw new Error("Font asset reference listing returned an invalid object path.");
      }
      paths.add(row.object_path);
    }
    if (payload.length < pageSize) break;
    offset += payload.length;
  }

  return paths;
}

async function deleteSiteFontObjects({
  supabaseUrl,
  serviceKey,
  fetchImpl,
  objectPaths,
}) {
  let deleted = 0;
  for (
    let offset = 0;
    offset < objectPaths.length;
    offset += FONT_ORPHAN_DELETE_CHUNK_SIZE
  ) {
    const prefixes = objectPaths.slice(offset, offset + FONT_ORPHAN_DELETE_CHUNK_SIZE);
    const payload = await fetchJson(
      fetchImpl,
      `${supabaseUrl}/storage/v1/object/${encodeURIComponent(SITE_FONT_BUCKET)}`,
      {
        method: "DELETE",
        headers: serviceHeaders(serviceKey, true),
        body: JSON.stringify({ prefixes }),
      },
      "Font orphan deletion"
    );
    if (!Array.isArray(payload)) {
      throw new Error("Font orphan deletion returned an ambiguous response.");
    }
    // Supabase Storage can legally return either the deleted FileObject rows or
    // an empty array after accepting the exact `prefixes` batch.
    if (payload.length === 0) {
      deleted += prefixes.length;
      continue;
    }
    const returned = new Set();
    for (const row of payload) {
      if (!isPlainObject(row) || !isContentAddressedFontPath(row.name)) {
        throw new Error("Font orphan deletion returned ambiguous object metadata.");
      }
      returned.add(row.name);
    }
    if (
      returned.size !== prefixes.length ||
      prefixes.some((objectPath) => !returned.has(objectPath))
    ) {
      throw new Error("Font orphan deletion did not confirm the exact requested batch.");
    }
    deleted += prefixes.length;
  }
  return deleted;
}

export async function cleanupSiteFontOrphans({
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
  apply = false,
  listPageSize = FONT_ORPHAN_LIST_PAGE_SIZE,
  databasePageSize = FONT_ORPHAN_DATABASE_PAGE_SIZE,
  maxDeleteBatch = FONT_ORPHAN_MAX_DELETE_BATCH,
} = {}) {
  const { supabaseUrl, serviceKey } = resolveConfiguration(environment);
  assertPositiveInteger(
    maxDeleteBatch,
    "Delete batch size",
    FONT_ORPHAN_MAX_DELETE_BATCH
  );
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid cleanup clock.");
  const cutoffMs = nowMs - FONT_ORPHAN_GRACE_MS;

  const objects = await listSiteFontObjects({
    supabaseUrl,
    serviceKey,
    fetchImpl,
    pageSize: listPageSize,
  });
  const firstReferenceSnapshot = await listReferencedSiteFontPaths({
    supabaseUrl,
    serviceKey,
    fetchImpl,
    pageSize: databasePageSize,
  });
  const referencePaths = new Set(firstReferenceSnapshot);

  if (apply && objects.length > 0) {
    const finalReferenceSnapshot = await listReferencedSiteFontPaths({
      supabaseUrl,
      serviceKey,
      fetchImpl,
      pageSize: databasePageSize,
    });
    for (const objectPath of finalReferenceSnapshot) referencePaths.add(objectPath);
  }

  const eligible = objects
    .filter(
      (object) =>
        !referencePaths.has(object.objectPath) && object.lastChangedAtMs < cutoffMs
    )
    .sort(
      (left, right) =>
        left.lastChangedAtMs - right.lastChangedAtMs ||
        left.objectPath.localeCompare(right.objectPath)
    );
  const plannedPaths = eligible
    .slice(0, maxDeleteBatch)
    .map((object) => object.objectPath);
  const deleted = apply
    ? await deleteSiteFontObjects({
        supabaseUrl,
        serviceKey,
        fetchImpl,
        objectPaths: plannedPaths,
      })
    : 0;

  return {
    mode: apply ? "apply" : "dry-run",
    bucket: SITE_FONT_BUCKET,
    graceHours: FONT_ORPHAN_GRACE_MS / 3_600_000,
    scannedObjects: objects.length,
    referencedObjects: referencePaths.size,
    eligibleOrphans: eligible.length,
    batchLimit: maxDeleteBatch,
    planned: plannedPaths.length,
    truncated: eligible.length > plannedPaths.length,
    deleted,
  };
}

function parseCliArguments(argumentsList) {
  for (const argument of argumentsList) {
    if (argument !== "--apply") {
      throw new Error("Unknown command-line argument.");
    }
  }
  return { apply: argumentsList.includes("--apply") };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    const result = await cleanupSiteFontOrphans({
      ...parseCliArguments(process.argv.slice(2)),
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(
      `Site font orphan cleanup failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    process.exitCode = 1;
  }
}
