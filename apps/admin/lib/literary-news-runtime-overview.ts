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

const nativeDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
function nativeDeliveryHeartbeat(value: unknown, current: Date) {
  const state = object(value), day = object(state.dayStatus), finishedAt = timestamp(state.finishedAt);
  const status = ["dispatch_reconciliation_required", "daily_target_deficit", "daily_minimum_reached"].includes(String(state.status)) ? String(state.status) : null;
  const fields = ["acknowledgedCreates", "acknowledgedPhotoCreates", "freshCreates", "freshPhotoCreates", "legacyReceiptsWithUnknownFirstDate", "deficitToMinimum"] as const;
  if (state.runner !== "native-cron" || !finishedAt || Date.parse(finishedAt) > current.getTime() || !status
    || typeof day.editorialDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(day.editorialDay)
    || day.editorialDay !== nativeDayFormatter.format(new Date(finishedAt)) || day.timeZone !== "Europe/Moscow"
    || day.minimum !== 10 || day.maximum !== 15
    || fields.some(key => !Number.isSafeInteger(day[key]) || Number(day[key]) < 0 || Number(day[key]) > 10_000_000)
    || Number(day.freshPhotoCreates) > Number(day.acknowledgedPhotoCreates) || Number(day.acknowledgedPhotoCreates) > Number(day.acknowledgedCreates)
    || Number(day.freshPhotoCreates) > Number(day.freshCreates) || Number(day.freshCreates) > Number(day.acknowledgedCreates)
    || day.deficitToMinimum !== Math.max(0, 10 - Number(day.freshCreates))
    || status === "daily_minimum_reached" && day.deficitToMinimum !== 0
    || status === "daily_target_deficit" && day.deficitToMinimum === 0) return null;
  return { finishedAt, status, editorialDay: day.editorialDay, timeZone: "Europe/Moscow",
    isCurrentDay: day.editorialDay === nativeDayFormatter.format(current), minimum: 10, maximum: 15,
    acknowledgedCreates: Number(day.acknowledgedCreates), acknowledgedPhotoCreates: Number(day.acknowledgedPhotoCreates),
    freshCreates: Number(day.freshCreates), freshPhotoCreates: Number(day.freshPhotoCreates), deficitToMinimum: Number(day.deficitToMinimum),
    freshTextCreates: Number(day.freshCreates) - Number(day.freshPhotoCreates),
    legacyReceiptsWithUnknownFirstDate: Number(day.legacyReceiptsWithUnknownFirstDate),
    nonFreshPhotoCreates: Number(day.acknowledgedPhotoCreates) - Number(day.freshPhotoCreates),
    otherAcknowledgedCreates: Number(day.acknowledgedCreates) - Number(day.acknowledgedPhotoCreates) };
}

export function summarizeNewsRuntime(read: Awaited<ReturnType<typeof readLatestNewsRuntime>>, configured = true, current = new Date()) {
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
  const nativeState = read.rows.find(row => row.key === "heartbeat:native-delivery")?.state;
  const nativeDelivery = nativeState ? nativeDeliveryHeartbeat(nativeState, current) : null;
  const nativeDeliveryInvalid = Boolean(nativeState && !nativeDelivery);
  if (nativeDeliveryInvalid) invalidRows++;
  const legacySchedulerAt = timestamp(heartbeat?.finishedAt);
  const nativeIsLatest = Boolean(nativeDelivery && (!legacySchedulerAt || Date.parse(nativeDelivery.finishedAt) > Date.parse(legacySchedulerAt)));
  const successes = posts.flatMap(post => post.acknowledgedAt ? [post.acknowledgedAt] : []).sort((a, b) => Date.parse(b) - Date.parse(a));
  posts.sort((a, b) => (Date.parse(a.admittedAt || "") || 0) - (Date.parse(b.admittedAt || "") || 0) || a.key.localeCompare(b.key));
  return { configured, complete: read.complete && invalidRows === 0, readError: read.readError, rowsRead: read.rowsRead, invalidRows,
    hasRuntime: read.rows.length > 0, lastSchedulerAt: nativeIsLatest ? nativeDelivery!.finishedAt : legacySchedulerAt,
    nativeDelivery, nativeDeliveryInvalid,
    schedulerMode: nativeIsLatest ? "native-cron" : ["--preview-local", "--shadow", "--capture", "--send", "--preflight"].includes(String(heartbeat?.mode)) ? String(heartbeat?.mode) : null, lastDeliveryAt: successes[0] ?? null,
    historyStatus: errorCode(history?.status), historyObservedSince: timestamp(history?.observedSince),
    destinations: destinationRows, posts };
}

/** Read a stable latest-key snapshot through the separately staff-gated invoker RPC.
 * Only an explicitly missing first RPC can fall back to the bounded legacy scan. */
async function readStaffLatestNewsRuntime(fetchPage: (after: string | null, upper: string | null, limit: number) =>
  Promise<{ data: unknown[] | null; error: unknown }>) {
  const rows: Row[] = [];
  let cursor: string | null = null, upper: string | null = null, rowsRead = 0, bytesRead = 0, invalidRows = 0;
  const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value)
    : typeof value === "string" && /^[1-9]\d*$/u.test(value) ? value : null;
  while (rowsRead < MAX_ROWS && bytesRead < MAX_BYTES) {
    const limit = Math.min(PAGE_SIZE, MAX_ROWS - rowsRead);
    let result;
    try { result = await fetchPage(cursor, upper, limit); }
    catch { return { rows, rowsRead, invalidRows, complete: false, readError: true, missingRpc: false }; }
    if (result.error) {
      const missingRpc = cursor === null && rowsRead === 0 && ["PGRST202", "42883"].includes(String(object(result.error).code));
      return { rows, rowsRead, invalidRows, complete: false, readError: !missingRpc, missingRpc };
    }
    if (!Array.isArray(result.data) || result.data.length > limit)
      return { rows, rowsRead, invalidRows: invalidRows + 1, complete: false, readError: true, missingRpc: false };
    for (const raw of result.data) {
      const value = object(raw), id = integer(value.id), watermark = integer(value.snapshot_upper_id), key = value.entity_id;
      if (!id || !watermark || BigInt(id) > BigInt(watermark) || upper !== null && watermark !== upper
        || typeof key !== "string" || !/^[\x20-\x7e]{1,400}$/u.test(key) || cursor !== null && key <= cursor)
        return { rows, rowsRead, invalidRows: invalidRows + 1, complete: false, readError: true, missingRpc: false };
      upper ??= watermark; cursor = key; rowsRead++;
      if (!value.metadata || typeof value.metadata !== "object" || Array.isArray(value.metadata)) { invalidRows++; continue; }
      bytesRead += new TextEncoder().encode(JSON.stringify(value.metadata)).byteLength;
      if (bytesRead > MAX_BYTES) return { rows, rowsRead, invalidRows, complete: false, readError: false, missingRpc: false };
      rows.push({ id, key, state: object(value.metadata) });
    }
    if (result.data.length < limit) return { rows, rowsRead, invalidRows, complete: invalidRows === 0, readError: false, missingRpc: false };
  }
  return { rows, rowsRead, invalidRows, complete: false, readError: false, missingRpc: false };
}

/** Hydrate only the exact latest IDs selected by the bounded head scan.
 * Appended states cannot change this snapshot; mutations still use its CAS ID. */
async function readNewsRuntimePayloads(heads: Awaited<ReturnType<typeof readLatestNewsRuntime>>,
  fetchIds: (ids: string[]) => Promise<{ data: unknown[] | null; error: unknown }>) {
  const rows: Row[] = [];
  let bytesRead = 0, invalidRows = heads.invalidRows;
  for (let offset = 0; offset < heads.rows.length; offset += 250) {
    const batch = heads.rows.slice(offset, offset + 250), expected = new Map(batch.map(row => [row.id, row.key]));
    let result;
    try { result = await fetchIds(batch.map(row => row.id)); }
    catch { return { ...heads, rows, invalidRows, complete: false, readError: true }; }
    if (result.error || !Array.isArray(result.data))
      return { ...heads, rows, invalidRows, complete: false, readError: true };
    const loaded = new Map<string, Row>(), seen = new Set<string>();
    for (const raw of result.data) {
      const value = object(raw), id = typeof value.id === "number" && Number.isSafeInteger(value.id) ? String(value.id) : value.id;
      if (typeof id !== "string" || !expected.has(id) || seen.has(id)) { invalidRows++; continue; }
      seen.add(id);
      if (value.entity_id !== expected.get(id) || !value.metadata || Array.isArray(value.metadata) || typeof value.metadata !== "object") {
        invalidRows++; continue;
      }
      bytesRead += new TextEncoder().encode(JSON.stringify(value.metadata)).byteLength;
      if (bytesRead > MAX_BYTES) return { ...heads, rows, invalidRows, complete: false };
      loaded.set(id, { id, key: expected.get(id)!, state: object(value.metadata) });
    }
    for (const row of batch) {
      const payload = loaded.get(row.id);
      if (payload) rows.push(payload);
      else if (!seen.has(row.id)) invalidRows++;
    }
  }
  return { ...heads, rows, invalidRows, complete: heads.complete && invalidRows === 0 };
}

/** The caller must have passed requireStaff; this uses session RLS and performs SELECT only. */
export async function loadLiteraryNewsRuntimeOverview(client: (Pick<SupabaseClient, "from"> & Partial<Pick<SupabaseClient, "rpc">>) | null) {
  if (!client) return summarizeNewsRuntime({ rows: [], complete: false, readError: false, rowsRead: 0, invalidRows: 0 }, false);
  if (typeof client.rpc === "function") {
    const latest = await readStaffLatestNewsRuntime(async (after, upper, limit) => {
      const { data, error } = await client.rpc!("read_staff_latest_literary_news_runtime", {
        p_after_key: after, p_limit: limit, p_upper_id: upper,
      });
      return { data, error };
    });
    if (!latest.missingRpc) return summarizeNewsRuntime(latest);
  }
  // Historical replay rows carry large prepared text/media evidence. Scan only
  // their IDs and keys, then fetch metadata once per latest durable state.
  const heads = await readLatestNewsRuntime(async (cursor, limit) => {
    let query = client.from("admin_audit_log").select("id,entity_id").eq("entity_type", "literary_news_runtime").order("id", { ascending: false }).limit(limit);
    if (cursor) query = query.lt("id", cursor);
    const { data, error } = await query;
    return { data: Array.isArray(data) ? data.map(row => ({ ...object(row), metadata: {} })) : null, error };
  });
  const read = await readNewsRuntimePayloads(heads, async ids => {
    const { data, error } = await client.from("admin_audit_log").select("id,entity_id,metadata")
      .eq("entity_type", "literary_news_runtime").in("id", ids);
    return { data, error };
  });
  return summarizeNewsRuntime(read);
}
export type LiteraryNewsRuntimeOverview = Awaited<ReturnType<typeof loadLiteraryNewsRuntimeOverview>>;
