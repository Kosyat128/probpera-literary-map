import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const MAX_ROWS = 10_000;
const MAX_BYTES = 8 * 1024 * 1024;
export const NEWS_RUNTIME_PAGE_SIZE = 25;
export const newsDeliveryStatuses = ["pending", "inflight", "sent_current", "correction_pending", "ambiguous", "blocked", "explicitly_closed", "unknown"] as const;
export type NewsDeliveryStatus = typeof newsDeliveryStatuses[number];
type Row = { id: string; key: string; state: Record<string, unknown> };
type FetchPage = (cursor: string | null, limit: number) => Promise<{ data: unknown[] | null; error: unknown }>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 160) => typeof value === "string" && value.length <= max ? value : null;
const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const identifier = (value: unknown) => typeof value === "string" && /^-[1-9]\d{0,15}$/u.test(value) ? value : null;
const platform = (value: unknown) => value === "telegram" || value === "vk" ? value : null;
const errorCode = (value: unknown) => typeof value === "string" && /^[a-z0-9_:-]{1,120}$/u.test(value) ? value : null;
const mode = (value: unknown) => ["off", "shadow", "canary", "on"].includes(String(value)) ? String(value) : "unknown";
function evidenceLink(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/u.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
function mediaDetails(value: unknown, provider: "telegram" | "vk", destinationId: string) {
  const media = object(value), destination = object(media.destination);
  const credit = text(media.credit, 1200), license = text(media.license, 80);
  if (destination.platform !== provider || destination.id !== destinationId || !credit || !license
    || typeof media.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(media.sha256)
    || media.mime !== "image/jpeg" || !Number.isSafeInteger(media.width) || !Number.isSafeInteger(media.height)
    || Number(media.width) < 1 || Number(media.height) < 1 || Number(media.width) > 1600 || Number(media.height) > 1600) return null;
  return { credit, license, sha256: media.sha256, width: Number(media.width), height: Number(media.height),
    checkedAt: timestamp(media.checkedAt), validUntil: timestamp(media.validUntil),
    sourceUrl: evidenceLink(media.sourceUrl), licenseEvidenceUrl: evidenceLink(media.licenseEvidenceUrl) };
}
function matchesPostKey(key: string, newsId: unknown, provider: string, destinationId: string) {
  if (typeof newsId !== "string" || !newsId || newsId.length > 120) return false;
  try { return key === `post:news:${encodeURIComponent(newsId)}:${provider}:${destinationId}`; } catch { return false; }
}
function remoteLink(value: unknown, provider: "telegram" | "vk", destinationId: string) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (provider === "telegram" && /^-100\d+$/u.test(destinationId) && url.hostname === "t.me" && new RegExp(`^/c/${destinationId.slice(4)}/[1-9]\\d*$`, "u").test(url.pathname)) return url.href;
    if (provider === "vk" && url.hostname === "vk.com" && new RegExp(`^/wall${destinationId}_[1-9]\\d*$`, "u").test(url.pathname)) return url.href;
  } catch { /* Untrusted links never leave the data projection. */ }
  return null;
}

/** Keyset pages preserve a stable upper boundary when a runner appends new rows. */
export async function readLatestNewsRuntime(fetchPage: FetchPage, options: { pageSize?: number; maxRows?: number; maxBytes?: number } = {}) {
  const pageSize = Math.max(1, Math.min(PAGE_SIZE, options.pageSize ?? PAGE_SIZE));
  const maxRows = Math.max(1, Math.min(MAX_ROWS, options.maxRows ?? MAX_ROWS));
  const maxBytes = Math.max(1, Math.min(MAX_BYTES, options.maxBytes ?? MAX_BYTES));
  const latest = new Map<string, Row>();
  let cursor: string | null = null, rowsRead = 0, bytesRead = 0, invalidRows = 0;
  while (rowsRead < maxRows && bytesRead < maxBytes) {
    let result;
    const requested = Math.min(pageSize, maxRows - rowsRead);
    try { result = await fetchPage(cursor, requested); } catch { return { rows: [...latest.values()], complete: false, readError: true, rowsRead, invalidRows }; }
    if (result.error || !Array.isArray(result.data)) return { rows: [...latest.values()], complete: false, readError: true, rowsRead, invalidRows };
    for (const raw of result.data) {
      if (rowsRead >= maxRows) return { rows: [...latest.values()], complete: false, readError: false, rowsRead, invalidRows };
      const value = object(raw);
      const id = typeof value.id === "number" && Number.isSafeInteger(value.id) ? String(value.id) : value.id;
      if (typeof id !== "string" || !/^[1-9]\d*$/u.test(id) || cursor !== null && BigInt(id) >= BigInt(cursor)) return { rows: [...latest.values()], complete: false, readError: true, rowsRead, invalidRows: invalidRows + 1 };
      cursor = id; rowsRead++;
      bytesRead += new TextEncoder().encode(JSON.stringify(value.metadata ?? null)).byteLength;
      if (bytesRead > maxBytes) return { rows: [...latest.values()], complete: false, readError: false, rowsRead, invalidRows };
      if (typeof value.entity_id !== "string" || value.entity_id.length > 400 || !value.metadata || Array.isArray(value.metadata) || typeof value.metadata !== "object") { invalidRows++; continue; }
      if (!latest.has(value.entity_id)) latest.set(value.entity_id, { id, key: value.entity_id, state: object(value.metadata) });
    }
    if (result.data.length < requested) return { rows: [...latest.values()], complete: invalidRows === 0, readError: false, rowsRead, invalidRows };
  }
  return { rows: [...latest.values()], complete: false, readError: false, rowsRead, invalidRows };
}

export function summarizeNewsRuntime(read: Awaited<ReturnType<typeof readLatestNewsRuntime>>, configured = true) {
  let invalidRows = read.invalidRows;
  const posts = read.rows.filter(row => row.key.startsWith("post:news:")).flatMap(row => {
    const state = row.state, destination = object(state.destination);
    const provider = platform(destination.platform), destinationId = identifier(destination.id);
    if (!provider || !destinationId || !matchesPostKey(row.key, state.newsId, provider, destinationId)) { invalidRows++; return []; }
    const prepared = object(state.prepared), payload = object(prepared.payload);
    const isPhoto = provider === "telegram" && payload.photo === "attach://news_photo";
    const preparedText = provider === "telegram"
      ? isPhoto ? payload.text === undefined ? text(payload.caption, 1024) : null : text(payload.text, 4096)
      : text(payload.message, 16000);
    const media = mediaDetails(prepared.media, provider, destinationId);
    const remoteId = typeof state.remoteId === "string" && /^[1-9]\d{0,19}$/u.test(state.remoteId) ? state.remoteId : null;
    const acknowledgedAt = remoteId && typeof state.acknowledgedRevision === "string" && /^[a-f0-9]{64}$/u.test(state.acknowledgedRevision) ? timestamp(state.acknowledgedAt) : null;
    const rawStatus = newsDeliveryStatuses.includes(state.status as NewsDeliveryStatus) ? state.status as NewsDeliveryStatus : "unknown";
    const status = rawStatus === "sent_current" && (!acknowledgedAt || state.acknowledgedRevision !== state.desiredRevision) ? "unknown" : rawStatus;
    return [{ key: row.key, newsId: text(state.newsId, 120) || "ID не указан", platform: provider as "telegram" | "vk", destinationId, status, expectedVersion: row.id,
      admittedAt: timestamp(state.originalAdmission), acknowledgedAt, remoteId,
      remoteUrl: remoteId ? remoteLink(state.remoteUrl, provider, destinationId) : null,
      preparedText, media, mediaInvalid: prepared.media != null && !media,
      fallbackReason: errorCode(prepared.fallbackReason),
      error: errorCode(state.lastError), nextDueAt: timestamp(state.nextDueAt) }];
  });
  const destinations = new Map<string, { platform: "telegram" | "vk"; id: string; mode: string; paused: boolean | null; expectedVersion: string | null; historyReconciled: boolean; pauseReason: string | null }>();
  for (const row of read.rows.filter(item => item.key.startsWith("destination:"))) {
    const [, rawPlatform, rawId] = row.key.split(":");
    const provider = platform(rawPlatform), id = identifier(rawId);
    if (provider && id && row.key === `destination:${provider}:${id}`) destinations.set(`${provider}:${id}`, { platform: provider, id, expectedVersion: row.id, mode: mode(row.state.mode), paused: typeof row.state.paused === "boolean" ? row.state.paused : null, historyReconciled: row.state.historyReconciled === true, pauseReason: errorCode(row.state.pauseReason) });
    else invalidRows++;
  }
  for (const post of posts) if (!destinations.has(`${post.platform}:${post.destinationId}`)) destinations.set(`${post.platform}:${post.destinationId}`, { platform: post.platform, id: post.destinationId, expectedVersion: null, mode: "unknown", paused: null, historyReconciled: false, pauseReason: null });
  const destinationRows = [...destinations.values()].map(destination => {
    const items = posts.filter(post => post.platform === destination.platform && post.destinationId === destination.id);
    const counts = Object.fromEntries(newsDeliveryStatuses.map(status => [status, items.filter(post => post.status === status).length])) as Record<NewsDeliveryStatus, number>;
    const waiting = items.filter(post => !["sent_current", "explicitly_closed"].includes(post.status)).flatMap(post => post.admittedAt ? [post.admittedAt] : []).sort((a, b) => Date.parse(a) - Date.parse(b));
    const successes = items.flatMap(post => post.acknowledgedAt ? [post.acknowledgedAt] : []).sort((a, b) => Date.parse(b) - Date.parse(a));
    return { ...destination, counts, knownJobs: items.length, oldestBacklogAt: waiting[0] ?? null, lastDeliveryAt: successes[0] ?? null };
  });
  const heartbeat = read.rows.find(row => row.key === "heartbeat:scheduler")?.state;
  const history = read.rows.find(row => row.key === "history:coverage")?.state;
  const successes = posts.flatMap(post => post.acknowledgedAt ? [post.acknowledgedAt] : []).sort((a, b) => Date.parse(b) - Date.parse(a));
  posts.sort((a, b) => (Date.parse(a.admittedAt || "") || 0) - (Date.parse(b.admittedAt || "") || 0) || a.key.localeCompare(b.key));
  return { configured, complete: read.complete && invalidRows === 0, readError: read.readError, rowsRead: read.rowsRead, invalidRows,
    hasRuntime: read.rows.length > 0, lastSchedulerAt: timestamp(heartbeat?.finishedAt),
    schedulerMode: ["--preview-local", "--shadow", "--capture", "--send", "--preflight"].includes(String(heartbeat?.mode)) ? String(heartbeat?.mode) : null, lastDeliveryAt: successes[0] ?? null,
    historyStatus: errorCode(history?.status), historyObservedSince: timestamp(history?.observedSince),
    destinations: destinationRows, posts };
}

/** The caller must have passed requireStaff; this uses session RLS and performs SELECT only. */
export async function loadLiteraryNewsRuntimeOverview(client: Pick<SupabaseClient, "from"> | null) {
  if (!client) return summarizeNewsRuntime({ rows: [], complete: false, readError: false, rowsRead: 0, invalidRows: 0 }, false);
  const read = await readLatestNewsRuntime(async (cursor, limit) => {
    let query = client.from("admin_audit_log").select("id,entity_id,metadata").eq("entity_type", "literary_news_runtime").order("id", { ascending: false }).limit(limit);
    if (cursor) query = query.lt("id", cursor);
    const { data, error } = await query;
    return { data, error };
  });
  return summarizeNewsRuntime(read);
}
export type LiteraryNewsRuntimeOverview = Awaited<ReturnType<typeof loadLiteraryNewsRuntimeOverview>>;
