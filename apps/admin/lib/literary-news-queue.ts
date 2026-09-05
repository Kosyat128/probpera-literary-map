import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

export const NEWS_QUEUE_KEY = "literary-news:v1:held-queue";
export const NEWS_SOURCE_STATE_KEY = "literary-news:v1:source-state";
export const NEWS_QUEUE_MAX_BYTES = 5 * 1024 * 1024;
export const NEWS_QUEUE_PAGE_SIZE = 25;

type NewsNamespace = { get(key: string, type: "text"): Promise<string | null> };
const timestamp = z.string().max(40).datetime({ offset: true });
const publicationDate = z.union([timestamp, z.string().date()]);
const identifier = z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9_-]*$/);
const language = z.string().min(2).max(40).refine((value) => {
  try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
});
const sourceUrl = z.string().min(1).max(2_000).url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
});
const candidateSchema = z.object({
  sourceId: identifier,
  source: z.object({ name: z.string().trim().min(1).max(200), url: sourceUrl, language }),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(400).nullable().optional(),
  publishedAt: publicationDate.nullable().optional(),
  discoveredAt: timestamp,
  verification: z.literal("held"),
  reasons: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
});
const queueSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: timestamp,
  lastCheckedAt: timestamp.nullable(),
  verification: z.literal("held"),
  items: z.array(candidateSchema).max(5_000),
}).refine((queue) => new Set(queue.items.map((item) => item.source.url)).size === queue.items.length);
const sourceStateSchema = z.object({
  schemaVersion: z.literal(1),
  lastCheckedAt: timestamp.nullable(),
  refreshIntervalSeconds: z.number().int().min(60).max(86_400),
  pendingCount: z.number().int().min(0).max(5_000),
  sources: z.array(z.object({
    id: identifier,
    name: z.string().trim().min(1).max(200),
    url: sourceUrl,
    status: z.enum(["pending", "ok", "error"]),
    lastSuccessAt: timestamp.nullable(),
    candidateCount: z.number().int().min(0).max(5_000),
  })).max(500),
}).refine((state) => new Set(state.sources.map((source) => source.id)).size === state.sources.length);

export type HeldNewsCandidate = z.infer<typeof candidateSchema>;
export type HeldNewsQueue = z.infer<typeof queueSchema>;
export type NewsSourceState = z.infer<typeof sourceStateSchema>;

function boundedJson(text: string, maximum: number): unknown {
  if (text.length > maximum || new TextEncoder().encode(text).byteLength > maximum) {
    throw new Error("News snapshot exceeds its size limit");
  }
  return JSON.parse(text);
}

export function parseHeldNewsQueue(text: string): HeldNewsQueue {
  return queueSchema.parse(boundedJson(text, NEWS_QUEUE_MAX_BYTES));
}

export function parseNewsSourceState(text: string): NewsSourceState {
  return sourceStateSchema.parse(boundedJson(text, 512 * 1024));
}

function runtimeNamespace(): NewsNamespace | null {
  try { return getCloudflareContext().env.ADMIN_CATALOGS ?? null; } catch { return null; }
}

/** Private, read-only snapshots. Call only after checking the editorial session. */
export async function loadLiteraryNewsQueue(namespace: NewsNamespace | null = runtimeNamespace()) {
  if (!namespace) return { configured: false, queue: null, sources: null, queueError: false, sourcesError: false };
  const [queue, sources] = await Promise.allSettled([
    namespace.get(NEWS_QUEUE_KEY, "text").then((value) => value === null ? null : parseHeldNewsQueue(value)),
    namespace.get(NEWS_SOURCE_STATE_KEY, "text").then((value) => value === null ? null : parseNewsSourceState(value)),
  ]);
  return {
    configured: true,
    queue: queue.status === "fulfilled" ? queue.value : null,
    sources: sources.status === "fulfilled" ? sources.value : null,
    queueError: queue.status === "rejected",
    sourcesError: sources.status === "rejected",
  };
}

const reasonLabels: Record<string, string> = {
  missing_event_date: "Нужно установить дату события по первоисточнику",
  bilingual_review_required: "Нужны проверенные заголовок и краткое описание на русском и английском",
  topic_review_required: "Нужно проверить литературную тематику и категорию события",
};

export function newsHoldReason(reason: string) {
  return reasonLabels[reason] ?? `Дополнительная проверка: ${reason}`;
}

/** Date-only evidence must not imply an unknown publication time. */
export function formatNewsQueueDate(value: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium", ...(dateOnly ? {} : { timeStyle: "short" as const }), timeZone: "UTC",
  }).format(new Date(value));
  return dateOnly ? formatted : `${formatted} UTC`;
}

function queryText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

export function filterHeldNewsQueue(items: HeldNewsCandidate[], input: { q?: unknown; source?: unknown; page?: unknown }) {
  const q = queryText(input.q, 160);
  const source = queryText(input.source, 120);
  const normalized = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/ё/g, "е");
  const terms = normalized(q).split(/\s+/).filter(Boolean);
  const matches = items.filter((item) => (!source || item.sourceId === source)
    && terms.every((term) => normalized(`${item.title} ${item.description ?? ""} ${item.source.name}`).includes(term)))
    .sort((a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt) || a.source.url.localeCompare(b.source.url));
  const pages = Math.max(1, Math.ceil(matches.length / NEWS_QUEUE_PAGE_SIZE));
  const requested = Number(queryText(input.page, 10) || 1);
  const page = Math.min(pages, Number.isSafeInteger(requested) ? Math.max(1, requested) : 1);
  return { q, source, page, pages, total: matches.length, items: matches.slice((page - 1) * NEWS_QUEUE_PAGE_SIZE, page * NEWS_QUEUE_PAGE_SIZE) };
}

export function literaryNewsQueueHref(query: { q: string; source: string }, page = 1) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.source) params.set("source", query.source);
  if (page > 1) params.set("page", String(page));
  return `/literary-news${params.size ? `?${params}` : ""}`;
}
