import type { Common3dResource } from "./childCommon3d";

export interface ChildSceneEncodedCache {
  setLimit(bytes: number): void;
  /** Caller MUST first obtain this exact resource from current native scene
   * authority. A returned copy also narrows its original absolute deadline. */
  read(resource: Common3dResource, sceneToken: string, absoluteDeadline: number, freshNativeValid: () => boolean): Promise<Readonly<{ bytes: Uint8Array; absoluteDeadline: number }> | null>;
  store(resource: Common3dResource, bytes: Uint8Array, sceneToken: string, absoluteDeadline: number, freshNativeValid: () => boolean): Promise<void>;
  retireScene(sceneToken: string): void; clear(): void; join(): Promise<void>;
  getSnapshot(): Readonly<{ entries: number; bytes: number; pendingBytes: number; limit: number; hits: number; misses: number; evictions: number }>;
}
type Entry = { bytes: Uint8Array; sceneToken: string; expiresAt: number };
type Pending = { bytes: Uint8Array; key: string; sceneToken: string; expiresAt: number; cancelled: boolean };
const safe = (n: number, maximum: number) => Number.isSafeInteger(n) && !Object.is(n, -0) && n >= 0 && n <= maximum;
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
/** Encoded copies only: never a scene lease, decoded geometry, texture or GPU
 * root. One cache captures one native context. Original deadlines, pending
 * hash copies and byte peaks are bounded; this LRU never prunes the native
 * encrypted offline/object ledger and never grants admission. */
export function createChildSceneEncodedCache(scopeIdentity: string, clock: () => number): ChildSceneEncodedCache {
  const entries = new Map<string, Entry>(), workers = new Set<Promise<unknown>>(), retired = new Map<string, number>(), pending = new Set<Pending>();
  let epoch = 0, limit = 0, total = 0, pendingBytes = 0, hits = 0, misses = 0, evictions = 0, timer: ReturnType<typeof setTimeout> | null = null, lastNow = -1;
  function now() { const n = clock(); if (!Number.isFinite(n) || n < lastNow) { clear(); throw new Error("Encoded cache monotonic clock unavailable"); } lastNow = n; return n; }
  function key(r: Common3dResource) {
    if (r.kind !== "model" && r.kind !== "buffer") return null;
    return JSON.stringify([scopeIdentity, r.assetId, r.entity.kind, r.entity.id, r.entity.contentChecksum, r.kind, r.mime, r.checksum, r.encodedBytes, r.alias]);
  }
  function remove(k: string) { const e = entries.get(k); if (!e) return; entries.delete(k); total -= e.bytes.length; e.bytes.fill(0); ++evictions; }
  function cancelPending(p: Pending) { p.cancelled = true; p.bytes.fill(0); }
  function releasePending(p: Pending, wipe = true) { if (!pending.delete(p)) return; pendingBytes -= p.bytes.length * 2; if (wipe) p.bytes.fill(0); }
  function schedule() {
    if (timer !== null) clearTimeout(timer); timer = null;
    const deadlines = [...entries.values()].map(e => e.expiresAt).concat([...pending].filter(p => !p.cancelled).map(p => p.expiresAt));
    if (!deadlines.length) return;
    const earliest = Math.min(...deadlines);
    timer = setTimeout(() => { timer = null; try { prune(); } catch { clear(); } }, Math.max(1, Math.min(60_000, earliest - now())));
  }
  function evictTo(bytes: number, count = 32) {
    while (total + pendingBytes > bytes || entries.size + pending.size > count) {
      const oldest = entries.keys().next().value as string | undefined; if (oldest === undefined) break; remove(oldest);
    }
  }
  function prune() {
    const at = now(); for (const [k, e] of entries) if (at >= e.expiresAt) remove(k);
    for (const p of [...pending]) if (at >= p.expiresAt) cancelPending(p);
    evictTo(limit); schedule();
  }
  function clear() {
    ++epoch; if (timer !== null) clearTimeout(timer); timer = null;
    for (const k of [...entries.keys()]) remove(k); for (const p of pending) cancelPending(p); retired.clear();
  }
  function track<T>(work: Promise<T>): Promise<T> { workers.add(work); void work.then(() => workers.delete(work), () => workers.delete(work)); return work; }
  function captured(sceneToken: string, deadline: number, valid: () => boolean) {
    const generation = epoch, retiredAt = retired.get(sceneToken) ?? 0;
    return () => generation === epoch && (retired.get(sceneToken) ?? 0) === retiredAt && valid() && Number.isFinite(deadline) && now() < deadline;
  }
  return Object.freeze({
    setLimit(bytes: number) {
      if (!safe(bytes, 4_194_304)) throw new Error("Bounded encoded cache limit required");
      limit = bytes; if (pendingBytes > limit) clear(); prune();
    },
    read(resource: Common3dResource, sceneToken: string, deadline: number, freshNativeValid: () => boolean) {
      return track((async () => {
        const current = captured(sceneToken, deadline, freshNativeValid), k = key(resource);
        if (!k || !current()) return null; prune(); const entry = entries.get(k);
        if (!entry) { ++misses; return null; }
        // WebCrypto copies its BufferSource for the asynchronous digest. Keep
        // BOTH the output copy and that internal input charged until settle,
        // including clear/expiry while the digest is still outstanding.
        if (total + pendingBytes + entry.bytes.length * 2 > limit || entries.size + pending.size >= 32) { ++misses; return null; }
        const reservation: Pending = { bytes: entry.bytes.slice(), key: k, sceneToken, expiresAt: Math.min(entry.expiresAt, deadline), cancelled: false };
        pending.add(reservation); pendingBytes += reservation.bytes.length * 2; let transferred = false;
        try {
          schedule();
          const copy = reservation.bytes;
          if (copy.length !== resource.encodedBytes || await digest(copy) !== resource.checksum || !current() || reservation.cancelled || entries.get(k) !== entry || now() >= entry.expiresAt) { if (entries.get(k) === entry) remove(k); return null; }
          entry.sceneToken = sceneToken; entry.expiresAt = Math.min(entry.expiresAt, deadline);
          entries.delete(k); entries.set(k, entry); ++hits; schedule(); transferred = true;
          return Object.freeze({ bytes: copy, absoluteDeadline: entry.expiresAt });
        } finally { releasePending(reservation, !transferred); }
      })());
    },
    store(resource: Common3dResource, bytes: Uint8Array, sceneToken: string, deadline: number, freshNativeValid: () => boolean) {
      return track((async () => {
        const current = captured(sceneToken, deadline, freshNativeValid), k = key(resource);
        if (!k || !current() || bytes.length !== resource.encodedBytes || bytes.length > limit || !(bytes.buffer instanceof ArrayBuffer)) return;
        prune();
        const earlier = Math.min(deadline, entries.get(k)?.expiresAt ?? deadline, ...[...pending].filter(p => p.key === k && !p.cancelled).map(p => p.expiresAt));
        if (entries.has(k)) remove(k);
        // Evict BEFORE allocating/hash work. Outstanding copy buffers are in
        // the same capacity ledger, never hidden until digest completion.
        evictTo(limit - bytes.length * 2, 31);
        if (total + pendingBytes + bytes.length * 2 > limit || entries.size + pending.size >= 32 || !current() || now() >= earlier) return;
        const reservation: Pending = { bytes: bytes.slice(), key: k, sceneToken, expiresAt: earlier, cancelled: false };
        pending.add(reservation); pendingBytes += reservation.bytes.length * 2; let retained = false;
        try {
          schedule();
          if (await digest(reservation.bytes) !== resource.checksum || !current() || reservation.cancelled || now() >= reservation.expiresAt) return;
          const expiresAt = Math.min(reservation.expiresAt, entries.get(k)?.expiresAt ?? reservation.expiresAt);
          if (entries.has(k)) remove(k);
          releasePending(reservation, false);
          entries.set(k, { bytes: reservation.bytes, sceneToken, expiresAt }); total += reservation.bytes.length; retained = true; prune();
        } finally { if (!retained) { releasePending(reservation); reservation.bytes.fill(0); } }
      })());
    },
    retireScene(sceneToken: string) {
      retired.set(sceneToken, (retired.get(sceneToken) ?? 0) + 1);
      for (const [k, e] of entries) if (e.sceneToken === sceneToken) remove(k);
      for (const p of [...pending]) if (p.sceneToken === sceneToken) cancelPending(p);
      if (retired.size > 128) clear(); else schedule();
    },
    clear,
    async join() { let failed = false; while (workers.size) { const done = await Promise.allSettled([...workers]); failed ||= done.some(r => r.status === "rejected"); } if (failed) throw new Error("Encoded cache worker failed"); },
    getSnapshot: () => Object.freeze({ entries: entries.size, bytes: total + pendingBytes, pendingBytes, limit, hits, misses, evictions }),
  });
}