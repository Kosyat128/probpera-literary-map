import type { NewsFeed } from "./types";
import { isNewsDate } from "./feed";

export const NEWS_WITHDRAWAL_STORAGE_KEY = "probpera-literary-news-withdrawals-v1";
export const NEWS_WITHDRAWAL_MAX_ROWS = 25_000;
export const NEWS_WITHDRAWAL_MAX_BYTES = 2_000_000;
const LEGACY_MAX_CHARS = 6_000_000;
const blockedMarker = JSON.stringify({ schemaVersion: 2, reliable: false, rows: [] });
type Withdrawals = NonNullable<NewsFeed["withdrawals"]>;
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type NewsWithdrawalHistory = { rows: Withdrawals; reliable: boolean; complete: boolean };
const unavailable = (): NewsWithdrawalHistory => ({ rows: [], reliable: false, complete: false });
const storageFor = (storage?: StoragePort) => storage ?? window.localStorage;

function compactRows(values: unknown, now: number): Withdrawals {
  if (!Array.isArray(values) || values.length > NEWS_WITHDRAWAL_MAX_ROWS) throw new Error("withdrawal_history_limit");
  const unique = new Map<string, Withdrawals[number]>();
  for (const value of values) {
    const id: unknown = Array.isArray(value) ? value[0] : value?.id;
    const time: unknown = Array.isArray(value) ? value[1] : value?.withdrawnAt;
    if (typeof id !== "string" || !id.trim() || id.length > 120 || typeof time !== "string" || time.length > 40
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(time)
      || !isNewsDate(time.slice(0, 10)) || !Number.isFinite(Date.parse(time)) || Date.parse(time) > now) throw new Error("withdrawal_history_invalid");
    const previous = unique.get(id);
    if (!previous || Date.parse(time) > Date.parse(previous.withdrawnAt)) unique.set(id, { id, withdrawnAt: time, reason: "" });
  }
  return [...unique.values()];
}

/** Missing or damaged history is explicitly untrusted for offline publication. */
export function readKnownNewsWithdrawals(storage?: StoragePort, now = Date.now()): NewsWithdrawalHistory {
  try {
    const raw = storageFor(storage).getItem(NEWS_WITHDRAWAL_STORAGE_KEY);
    // A clean first online response may initialize history; offline first visits remain unavailable.
    if (raw === null) return { rows: [], reliable: false, complete: true };
    if (raw.length > LEGACY_MAX_CHARS) return unavailable();
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return { rows: compactRows(value, now), reliable: true, complete: true };
    if (!value || typeof value !== "object" || !("schemaVersion" in value) || value.schemaVersion !== 2
      || !("reliable" in value) || typeof value.reliable !== "boolean" || !("rows" in value)
      || new TextEncoder().encode(raw).byteLength > NEWS_WITHDRAWAL_MAX_BYTES) return unavailable();
    return { rows: compactRows(value.rows, now), reliable: value.reliable, complete: value.reliable };
  } catch { return unavailable(); }
}

/** Establish a durable fail-closed marker BEFORE fetching potentially new withdrawals. */
export function beginNewsWithdrawalUpdate(storage?: StoragePort): boolean {
  try {
    const target = storageFor(storage);
    target.setItem(NEWS_WITHDRAWAL_STORAGE_KEY, blockedMarker);
    return target.getItem(NEWS_WITHDRAWAL_STORAGE_KEY) === blockedMarker;
  } catch { return false; }
}

/** Persist only IDs/times, never long reasons. A lost/overflowed history cannot heal itself on reload. */
export function saveKnownNewsWithdrawals(rows: Withdrawals, history: NewsWithdrawalHistory, storage?: StoragePort): NewsWithdrawalHistory {
  let merged: Withdrawals = history.rows;
  if (!beginNewsWithdrawalUpdate(storage)) return { ...history, reliable: false };
  try {
    const unique = new Map(history.rows.map(row => [row.id, row]));
    for (const row of rows) {
      const old = unique.get(row.id);
      if (!old || Date.parse(row.withdrawnAt) > Date.parse(old.withdrawnAt)) unique.set(row.id, row);
    }
    merged = compactRows([...unique.values()], Date.now());
    const raw = JSON.stringify({ schemaVersion: 2, reliable: history.complete, rows: merged.map(row => [row.id, row.withdrawnAt]) });
    if (new TextEncoder().encode(raw).byteLength > NEWS_WITHDRAWAL_MAX_BYTES) return { rows: merged, reliable: false, complete: false };
    const target = storageFor(storage);
    target.setItem(NEWS_WITHDRAWAL_STORAGE_KEY, raw);
    if (target.getItem(NEWS_WITHDRAWAL_STORAGE_KEY) !== raw) return { rows: merged, reliable: false, complete: false };
    return { rows: merged, reliable: history.complete, complete: history.complete };
  } catch { return { rows: merged, reliable: false, complete: false }; }
}
