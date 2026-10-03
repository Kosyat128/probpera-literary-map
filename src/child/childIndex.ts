import { childDataNamespace, decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";
import { childDataArray, childEntityAllowed, childRecord, compileChildPackage, copyChildPackageChallenge,
  decodeChildEntityPayload, decodeChildEntityReference, type ChildCompiledPackage, type ChildEntityReference, type ChildIndexedEntity,
  type ChildPackageDigestPort } from "./childPackage";
import type { ChildPlatform } from "./childAccessPolicy";
import type { ChildPackageChallenge, ChildRouteChallenge, ChildVerifiedPackagePort, ChildVerifiedRoutePort } from "./childStartup";

export interface ChildReviewChallenge {
  readonly startup: ChildPackageChallenge; readonly scope: ChildDataScope; readonly nowEpochMs: number;
}
export interface ChildCurrentPackageReviewPort {
  /** Independently authenticate current human review/rights for these exact
   * child bytes and policy, including every entity/media reference. Success:
   * {status:'verified',challenge:<same object>,validUntilEpochMs:number}.
   * A signature, package metadata or JSON approval flag is insufficient. */
  verify(challenge: ChildReviewChallenge, signal: AbortSignal): Promise<unknown>;
}
export type ChildIndexPurpose = "search" | "history" | "cache" | "offline";
export interface ChildScopedDataRequest {
  readonly purpose: ChildIndexPurpose; readonly scope: ChildDataScope; readonly key: string; readonly lease: object;
  /** Must be checked atomically at the actual storage commit, not only at dispatch. */
  isCurrent(): boolean;
}
export interface ChildScopedDataPort {
  /** Exact child namespace only; no enumeration, adult fallback or cloud profile. */
  read(request: ChildScopedDataRequest, signal: AbortSignal): Promise<unknown>;
  /** CAS response is strictly true/false. An OS adapter must honor isCurrent
   * under the same lock/transaction as its durable compare-and-write. */
  compareAndSet(request: ChildScopedDataRequest, expectedRevision: number, value: unknown, signal: AbortSignal): Promise<boolean>;
}
export interface ChildIndexOptions {
  source: { load(challenge: ChildPackageChallenge, signal: AbortSignal): Promise<unknown> };
  digest: ChildPackageDigestPort; review: ChildCurrentPackageReviewPort;
  ports: Readonly<Record<ChildIndexPurpose, ChildScopedDataPort>>;
  /** Protected host selection/profile/policy generation; no inferred UI default. */
  isCurrent(challenge: ChildPackageChallenge): boolean;
  clock: { nowEpochMs(): number }; timeoutMs: number; platform: ChildPlatform; territory: string;
  initialVisibility: "active" | "background";
}
export type ChildIndexSnapshot = Readonly<{ phase: "sealed" | "loading" | "ready" | "disposed" }>;
type Slot = Readonly<{ revision: number; value: unknown }>;
type Lease = { startup: ChildPackageChallenge; fingerprint: string; compiled: ChildCompiledPackage; generation: number;
  validUntilEpochMs: number; authority: object; abort: AbortController; externalAbort: () => void; external: AbortSignal };
const epoch = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && value <= 8_640_000_000_000_000;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const purposeList: readonly ChildIndexPurpose[] = ["search", "history", "cache", "offline"];
function slot(value: unknown): Slot | null {
  try { const row = childRecord(value, ["revision", "value"]);
    return row && typeof row.revision === "number" && Number.isSafeInteger(row.revision) && row.revision >= 0
      ? Object.freeze({ revision: row.revision, value: row.value }) : null;
  } catch { return null; }
}
function refs(value: unknown, maximum = 4096): readonly ChildEntityReference[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  if (Reflect.ownKeys(descriptors).length !== value.length + 1) return null;
  const output: ChildEntityReference[] = [];
  for (let index = 0; index < value.length; index++) {
    const item = descriptors[String(index)];
    if (!item || !("value" in item) || !item.enumerable) return null;
    const reference = decodeChildEntityReference(item.value); if (!reference) return null;
    output.push(reference);
  }
  if (new Set(output.map(ref => `${ref.kind}/${ref.id}`)).size !== output.length) return null;
  return Object.freeze(output);
}
const referenceEqual = (a: ChildEntityReference, b: ChildEntityReference) => a.kind === b.kind && a.id === b.id && a.contentChecksum === b.contentChecksum;
const normalized = (text: string) => text.normalize("NFKC").toLowerCase();

/** Child-only package/route adapter with real compilation and scoped data I/O.
 * Unintegrated: no native restoration, installed time/frame guarantee or actual
 * editorial approval is supplied here. The host must clear visible views on
 * retirement; immutable content already handed to a caller cannot be erased. */
export function createVerifiedChildIndex(options: ChildIndexOptions) {
  if (!options || !positive(options.timeoutMs) || options.timeoutMs > 2_147_483_647
    || typeof options.clock?.nowEpochMs !== "function" || typeof options.isCurrent !== "function"
    || !["web-pwa", "android-google", "android-rustore", "ios-ipados"].includes(options.platform)
    || !/^[A-Z]{2}$/u.test(options.territory) || typeof options.source?.load !== "function"
    || typeof options.review?.verify !== "function" || typeof options.digest?.sha256 !== "function"
    || options.initialVisibility !== "active" && options.initialVisibility !== "background"
    || purposeList.some(purpose => typeof options.ports?.[purpose]?.read !== "function"
      || typeof options.ports?.[purpose]?.compareAndSet !== "function")) throw new TypeError("Explicit child index ports required");
  const clock = options.clock.nowEpochMs.bind(options.clock), hostCurrent = options.isCurrent.bind(options);
  const source = options.source.load.bind(options.source), review = options.review.verify.bind(options.review);
  const digest = Object.freeze({ sha256: options.digest.sha256.bind(options.digest) });
  const platform = options.platform, territory = options.territory, timeoutMs = options.timeoutMs;
  const ports = Object.fromEntries(purposeList.map(purpose => [purpose, Object.freeze({
    read: options.ports[purpose].read.bind(options.ports[purpose]),
    compareAndSet: options.ports[purpose].compareAndSet.bind(options.ports[purpose]),
  })])) as Record<ChildIndexPurpose, ChildScopedDataPort>;
  let generation = 0, disposed = false, brokenClock = false, lastNow = -1, lease: Lease | null = null;
  let visible = options.initialVisibility === "active";
  let snapshot: ChildIndexSnapshot = Object.freeze({ phase: "sealed" });
  const operations = new Set<AbortController>();
  const operationDeadlines = new WeakMap<AbortSignal, number>();
  function retire() {
    const old = lease, oldOperations = [...operations]; lease = null;
    for (const operation of oldOperations) { operations.delete(operation); operationDeadlines.delete(operation.signal); }
    if (generation === Number.MAX_SAFE_INTEGER) brokenClock = true; else generation++;
    const ticket = generation;
    snapshot = Object.freeze({ phase: disposed ? "disposed" : "sealed" });
    if (old) { old.external.removeEventListener("abort", old.externalAbort); old.abort.abort(); }
    for (const operation of oldOperations) operation.abort();
    return ticket;
  }
  function now(): number | null {
    if (disposed || brokenClock) return null;
    try { const at = clock();
      if (!epoch(at) || at < lastNow) { brokenClock = true; retire(); return null; }
      lastNow = at; return at;
    } catch { brokenClock = true; retire(); return null; }
  }
  function leaseCurrent(captured: Lease, allowLoading = false): boolean {
    return !disposed && !brokenClock && visible && lease === captured && captured.generation === generation
      && !captured.abort.signal.aborted && !captured.external.aborted
      && (snapshot.phase === "ready" || allowLoading && snapshot.phase === "loading");
  }
  function trustedCurrent(captured: Lease, allowLoading = false): boolean {
    if (!leaseCurrent(captured, allowLoading)) return false;
    const at = now(); if (at === null || at >= captured.validUntilEpochMs) { if (lease === captured) retire(); return false; }
    if (!leaseCurrent(captured, allowLoading)) return false;
    let current = false;
    try { current = hostCurrent(captured.startup) === true; } catch { /* Unknown host authority denies. */ }
    if (!current) { if (lease === captured) retire(); return false; }
    if (!leaseCurrent(captured, allowLoading)) return false;
    // Host inspection may consume validity or reenter another admission.
    const completedAt = now();
    if (!leaseCurrent(captured, allowLoading)) return false;
    if (completedAt === null || completedAt >= captured.validUntilEpochMs) { if (lease === captured) retire(); return false; }
    return true;
  }
  function operationCurrent(signal: AbortSignal): boolean {
    const deadline = operationDeadlines.get(signal), at = now();
    return !signal.aborted && deadline !== undefined && at !== null && at < deadline;
  }
  async function bounded<T>(signal: AbortSignal, current: () => boolean, task: (childSignal: AbortSignal) => Promise<T>): Promise<T | null> {
    const operationGeneration = generation, at = now();
    if (at === null || signal.aborted || !current() || generation !== operationGeneration) return null;
    const deadline = at + timeoutMs; if (!epoch(deadline)) { retire(); return null; }
    const validatedAt = now();
    if (validatedAt === null || validatedAt >= deadline || signal.aborted || generation !== operationGeneration) return null;
    const abort = new AbortController(); operations.add(abort); operationDeadlines.set(abort.signal, deadline);
    return new Promise(resolve => {
      let settled = false;
      const finish = (value: T | null) => {
        if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener("abort", cancel);
        abort.signal.removeEventListener("abort", cancel); operations.delete(abort); operationDeadlines.delete(abort.signal); resolve(value);
      };
      const cancel = () => { if (!abort.signal.aborted) abort.abort(); finish(null); };
      const timer = setTimeout(() => { abort.abort(); finish(null); }, deadline - validatedAt);
      signal.addEventListener("abort", cancel, { once: true }); abort.signal.addEventListener("abort", cancel, { once: true });
      // Both branches consume late replies/rejections after timeout or retirement.
      Promise.resolve().then(() => !signal.aborted && operationCurrent(abort.signal) && current() && operationCurrent(abort.signal) ? task(abort.signal) : null).then(value => {
        const completedAt = now();
        finish(!abort.signal.aborted && !signal.aborted && completedAt !== null && completedAt < deadline && current() && operationCurrent(abort.signal) ? value : null);
      }, () => finish(null));
    });
  }
  async function freshReview(captured: Lease, signal: AbortSignal, allowLoading = false): Promise<boolean> {
    const at = now(); if (at === null || !operationCurrent(signal) || !trustedCurrent(captured, allowLoading) || !operationCurrent(signal)) return false;
    const challenge: ChildReviewChallenge = Object.freeze({ startup: captured.startup, scope: captured.compiled.scope, nowEpochMs: at });
    const result = childRecord(await review(challenge, signal), ["status", "challenge", "validUntilEpochMs"]);
    const completedAt = now();
    if (!result || result.status !== "verified" || result.challenge !== challenge || !epoch(result.validUntilEpochMs)
      || completedAt === null || result.validUntilEpochMs <= completedAt || !trustedCurrent(captured, allowLoading) || !operationCurrent(signal)) return false;
    captured.validUntilEpochMs = Math.min(captured.validUntilEpochMs, result.validUntilEpochMs);
    return trustedCurrent(captured, allowLoading) && operationCurrent(signal);
  }
  function request(captured: Lease, purpose: ChildIndexPurpose, signal: AbortSignal, reference: ChildEntityReference | null = null, allowLoading = false): ChildScopedDataRequest {
    const base = childDataNamespace(captured.compiled.scope, purpose)!;
    return Object.freeze({ purpose, scope: captured.compiled.scope,
      key: reference ? `${base}/item/${reference.kind}/${reference.id}` : base, lease: captured.authority,
      isCurrent: () => operationCurrent(signal) && trustedCurrent(captured, allowLoading) && operationCurrent(signal) });
  }
  function entity(captured: Lease, reference: ChildEntityReference): ChildIndexedEntity | null {
    const row = captured.compiled.entities.find(candidate => referenceEqual(candidate.reference, reference));
    if (!row || !trustedCurrent(captured)) return null;
    const at = now();
    if (at === null || !leaseCurrent(captured) || !childEntityAllowed(row, captured.compiled,
      { challenge: captured.startup, platform, territory, nowEpochMs: at })) return null;
    for (const link of row.payload.references) {
      const target = captured.compiled.entities.find(candidate => referenceEqual(candidate.reference, link));
      if (!target || !childEntityAllowed(target, captured.compiled, { challenge: captured.startup, platform, territory, nowEpochMs: at })) return null;
    }
    return row;
  }
  function closure(captured: Lease, root: ChildIndexedEntity): readonly ChildIndexedEntity[] | null {
    const output: ChildIndexedEntity[] = [], seen = new Set<string>(), queue = [root.reference];
    for (let index = 0; index < queue.length; index++) {
      const reference = queue[index], key = `${reference.kind}/${reference.id}`;
      if (seen.has(key)) continue;
      const row = entity(captured, reference); if (!row || output.length >= 4096) return null;
      seen.add(key); output.push(row); queue.push(...row.payload.references);
    }
    return Object.freeze(output);
  }
  /** Synchronous handoff only. Promise/thenable returns are observed and denied;
   * an async host executor needs its own cancellation seam instead of this API. */
  function deliver<T>(captured: Lease, signal: AbortSignal, visitor: (value: T) => void, value: T): boolean {
    if (!operationCurrent(signal) || !trustedCurrent(captured) || !operationCurrent(signal)) return false;
    try {
      const completion: unknown = visitor(value);
      if (completion !== undefined) { void Promise.resolve(completion).catch(() => {}); return false; }
      return operationCurrent(signal) && trustedCurrent(captured) && operationCurrent(signal);
    } catch { return false; }
  }
  async function action(task: (captured: Lease, signal: AbortSignal) => Promise<boolean>): Promise<boolean> {
    const captured = lease; if (!captured || !trustedCurrent(captured)) return false;
    const result = await bounded(captured.abort.signal, () => trustedCurrent(captured), async signal => {
      if (!await freshReview(captured, signal) || !trustedCurrent(captured) || !operationCurrent(signal)) return false;
      return task(captured, signal);
    });
    if (result !== true && lease === captured) retire();
    return result === true;
  }
  function envelope(captured: Lease, references: readonly ChildEntityReference[]) {
    return Object.freeze({ schemaVersion: 1, scope: captured.compiled.scope, references });
  }
  function readEnvelope(value: unknown, captured: Lease): readonly ChildEntityReference[] | null {
    const row = childRecord(value, ["schemaVersion", "scope", "references"]);
    return row?.schemaVersion === 1 && sameChildDataScope(row.scope, captured.compiled.scope) ? refs(row.references) : null;
  }
  async function put(captured: Lease, purpose: ChildIndexPurpose, value: unknown, reference: ChildEntityReference | null,
    signal: AbortSignal, allowLoading = false): Promise<boolean> {
    const port = ports[purpose], scoped = request(captured, purpose, signal, reference, allowLoading);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!scoped.isCurrent()) return false;
      const previous = slot(await port.read(scoped, signal));
      if (!previous || signal.aborted || !scoped.isCurrent()) return false;
      const committed = await port.compareAndSet(scoped, previous.revision, value, signal);
      if (signal.aborted || !scoped.isCurrent()) return false;
      if (committed === true) return true;
      if (committed !== false) return false;
    }
    return false;
  }
  const packagePort: ChildVerifiedPackagePort = Object.freeze({ async verify(original: ChildPackageChallenge, external: AbortSignal) {
    const ticket = retire(), startedAt = now();
    const startup = startedAt === null ? null : copyChildPackageChallenge(original, startedAt);
    if (!startup || disposed || brokenClock || !visible || external.aborted || generation !== ticket) return { status: "unavailable", challenge: original };
    let host = false; try { host = hostCurrent(startup) === true; } catch { /* Deny. */ }
    if (!host || generation !== ticket) return { status: "unavailable", challenge: original };
    snapshot = Object.freeze({ phase: "loading" });
    const sameInput = () => {
      const at = now(), currentInput = at === null ? null : copyChildPackageChallenge(original, at);
      let current = false; try { current = hostCurrent(startup) === true; } catch { /* Deny. */ }
      return generation === ticket && !disposed && !brokenClock && visible && !external.aborted && current
        && currentInput !== null && JSON.stringify(currentInput) === JSON.stringify(startup);
    };
    const result = await bounded(external, sameInput, async signal => {
      const bytes = await source(startup, signal); if (signal.aborted || !sameInput()) return null;
      const compiledAt = now(); if (compiledAt === null) return null;
      const compiled = await compileChildPackage(bytes, { challenge: startup, platform, territory, nowEpochMs: compiledAt, signal, digest });
      if (!compiled || signal.aborted || !sameInput()) return null;
      const captured: Lease = { startup, fingerprint: JSON.stringify(startup), compiled, generation: ticket,
        validUntilEpochMs: compiled.validUntilEpochMs, authority: Object.freeze({}), abort: new AbortController(), external,
        externalAbort: () => { if (lease === captured) retire(); } };
      lease = captured; external.addEventListener("abort", captured.externalAbort, { once: true });
      if (!await freshReview(captured, signal, true) || !sameInput()) return null;
      const searchRows = compiled.entities.filter(row => row.reference.kind === "search-result").map(row => row.reference);
      if (!await put(captured, "search", envelope(captured, Object.freeze(searchRows)), null, signal, true) || !sameInput()) return null;
      return captured;
    });
    if (!result || generation !== ticket || lease !== result || !sameInput() || !trustedCurrent(result, true)) {
      if (generation === ticket) retire(); return { status: "unavailable", challenge: original };
    }
    snapshot = Object.freeze({ phase: "ready" });
    return Object.freeze({ status: "verified", challenge: original, scope: result.compiled.scope, validUntilEpochMs: result.validUntilEpochMs });
  } });
  function routeSnapshot(original: unknown, captured: Lease): ChildRouteChallenge | null {
    try {
      const raw = childRecord(original, ["generation", "request", "selection", "profile", "scope", "validUntilEpochMs"]), at = now();
      if (!raw || at === null || lease !== captured) return null;
      const copied = copyChildPackageChallenge({ generation: raw.generation, request: raw.request, selection: raw.selection, profile: raw.profile }, at);
      const scope = decodeChildDataScope(raw.scope);
      return copied && JSON.stringify(copied) === captured.fingerprint && scope && sameChildDataScope(scope, captured.compiled.scope)
        && raw.validUntilEpochMs === captured.validUntilEpochMs
        ? Object.freeze({ ...copied, scope, validUntilEpochMs: captured.validUntilEpochMs }) : null;
    } catch { return null; }
  }
  const routePort: ChildVerifiedRoutePort = Object.freeze({ async verify(original: ChildRouteChallenge, signal: AbortSignal) {
    const capturedLease = lease, route = capturedLease && routeSnapshot(original, capturedLease);
    const verified = !!route && !signal.aborted && await action(async (captured, childSignal) => {
      if (signal.aborted || childSignal.aborted || captured.validUntilEpochMs !== route!.validUntilEpochMs) return false;
      if (route!.request.route.kind === "home") return !!entity(captured, captured.compiled.home);
      const target = captured.compiled.entities.find(row => row.reference.kind === route!.request.route.kind
        && row.reference.id === route!.request.route.entityId);
      return !!target && !!entity(captured, target.reference) && captured.compiled.entities.some(row => row.reference.kind === "deep-link"
        && row.payload.references.some(ref => referenceEqual(ref, target.reference)) && !!entity(captured, row.reference));
    });
    const finalRoute = capturedLease && routeSnapshot(original, capturedLease);
    return Object.freeze({ status: verified && !signal.aborted && finalRoute && JSON.stringify(finalRoute) === JSON.stringify(route)
      && trustedCurrent(capturedLease!) ? "verified" : "unavailable", challenge: original });
  } });
  async function visitStored(purpose: "cache" | "offline", input: unknown, visitor: (entities: readonly ChildIndexedEntity[]) => void): Promise<boolean> {
    const reference = decodeChildEntityReference(input); if (!reference || typeof visitor !== "function") return false;
    return action(async (captured, signal) => {
      const root = entity(captured, reference); if (!root || purpose === "offline" && reference.kind !== "offline-package") return false;
      const scoped = request(captured, purpose, signal, reference); if (!scoped.isCurrent()) return false;
      const saved = slot(await ports[purpose].read(scoped, signal));
      if (!saved || !scoped.isCurrent()) return false;
      const row = childRecord(saved.value, ["schemaVersion", "scope", "entries"]);
      const entries = row && childDataArray(row.entries, 4096), expected = closure(captured, root);
      if (!row || row.schemaVersion !== 1 || !sameChildDataScope(row.scope, captured.compiled.scope) || !entries || !expected
        || entries.length !== expected.length) return false;
      for (let index = 0; index < expected.length; index++) {
        const item = childRecord(entries[index], ["reference", "payload"]), ref = item && decodeChildEntityReference(item.reference);
        const content = item && decodeChildEntityPayload(item.payload);
        if (!item || !ref || !content || !referenceEqual(ref, expected[index].reference)
          || JSON.stringify(content) !== JSON.stringify(expected[index].payload)) return false;
      }
      if (!scoped.isCurrent()) return false;
      return deliver(captured, signal, visitor, expected);
    });
  }
  async function saveStored(purpose: "cache" | "offline", input: unknown): Promise<boolean> {
    const reference = decodeChildEntityReference(input); if (!reference) return false;
    return action(async (captured, signal) => {
      const root = entity(captured, reference); if (!root || purpose === "offline" && reference.kind !== "offline-package") return false;
      const entities = closure(captured, root); if (!entities) return false;
      const value = { schemaVersion: 1, scope: captured.compiled.scope,
        entries: entities.map(item => ({ reference: item.reference, payload: item.payload })) };
      return put(captured, purpose, value, reference, signal);
    });
  }
  return Object.freeze({ packagePort, routePort,
    getSnapshot(): ChildIndexSnapshot { const captured = lease; if (captured) trustedCurrent(captured, snapshot.phase === "loading"); return snapshot; },
    retire() { retire(); },
    background() { visible = false; retire(); },
    foreground() { if (!disposed) { visible = true; retire(); } },
    dispose() { if (!disposed) { disposed = true; retire(); } },
    async visitEntity(input: unknown, visitor: (entity: ChildIndexedEntity) => void): Promise<boolean> {
      const reference = decodeChildEntityReference(input); if (!reference || typeof visitor !== "function") return false;
      return action(async (captured, signal) => { const row = entity(captured, reference); if (!row || !operationCurrent(signal)
        || !trustedCurrent(captured)) return false;
        return deliver(captured, signal, visitor, row); });
    },
    async visitSearch(query: unknown, visitor: (entities: readonly ChildIndexedEntity[]) => void): Promise<boolean> {
      if (typeof query !== "string" || query.length > 160 || /[\u0000-\u001f\u007f]/u.test(query) || typeof visitor !== "function") return false;
      return action(async (captured, signal) => {
        const scoped = request(captured, "search", signal); if (!scoped.isCurrent()) return false;
        const saved = slot(await ports.search.read(scoped, signal));
        if (!saved || !scoped.isCurrent()) return false;
        const references = readEnvelope(saved.value, captured);
        const canonical = captured.compiled.entities.filter(row => row.reference.kind === "search-result").map(row => row.reference);
        if (!references || references.length !== canonical.length || references.some((ref, index) => !referenceEqual(ref, canonical[index]))) return false;
        const needle = normalized(query.trim()), result: ChildIndexedEntity[] = [];
        for (const ref of references) { const row = entity(captured, ref); if (!row) return false;
          if (!needle || [row.payload.title, ...row.payload.terms].some(term => normalized(term).includes(needle))) result.push(row);
        }
        if (!scoped.isCurrent()) return false;
        return deliver(captured, signal, visitor, Object.freeze(result));
      });
    },
    async rememberRecent(input: unknown): Promise<boolean> {
      const reference = decodeChildEntityReference(input); if (!reference || reference.kind !== "recent") return false;
      return action(async (captured, signal) => {
        if (!entity(captured, reference)) return false;
        const scoped = request(captured, "history", signal);
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!scoped.isCurrent()) return false;
          const saved = slot(await ports.history.read(scoped, signal)); if (!saved || signal.aborted || !scoped.isCurrent()) return false;
          const previous = saved.value === null ? [] : readEnvelope(saved.value, captured);
          if (!previous || previous.some(ref => ref.kind !== "recent" || !entity(captured, ref))) return false;
          const next = Object.freeze([reference, ...previous.filter(ref => !referenceEqual(ref, reference))].slice(0, 100));
          const committed = await ports.history.compareAndSet(scoped, saved.revision, envelope(captured, next), signal);
          if (signal.aborted || !scoped.isCurrent()) return false;
          if (committed === true) return true; if (committed !== false) return false;
        }
        return false;
      });
    },
    async visitHistory(visitor: (entities: readonly ChildIndexedEntity[]) => void): Promise<boolean> {
      if (typeof visitor !== "function") return false;
      return action(async (captured, signal) => {
        const scoped = request(captured, "history", signal); if (!scoped.isCurrent()) return false;
        const saved = slot(await ports.history.read(scoped, signal));
        if (!saved || !scoped.isCurrent()) return false;
        const references = saved.value === null ? [] : readEnvelope(saved.value, captured);
        if (!references || references.length > 100 || references.some(ref => ref.kind !== "recent")) return false;
        const rows = references.map(ref => entity(captured, ref)); if (rows.some(row => !row)) return false;
        if (!scoped.isCurrent()) return false;
        return deliver(captured, signal, visitor, Object.freeze(rows as ChildIndexedEntity[]));
      });
    },
    cache: (reference: unknown) => saveStored("cache", reference),
    visitCache: (reference: unknown, visitor: (entities: readonly ChildIndexedEntity[]) => void) => visitStored("cache", reference, visitor),
    downloadOffline: (reference: unknown) => saveStored("offline", reference),
    visitOffline: (reference: unknown, visitor: (entities: readonly ChildIndexedEntity[]) => void) => visitStored("offline", reference, visitor),
  });
}

/** Actual scoped in-memory CAS ports for an accountless child host. This has no
 * persistence/OS claim and never scans or falls back to a browser/adult store. */
export function createChildMemoryDataPorts(): Readonly<Record<ChildIndexPurpose, ChildScopedDataPort>> {
  const output = {} as Record<ChildIndexPurpose, ChildScopedDataPort>;
  for (const purpose of purposeList) {
    const records = new Map<string, Slot>();
    const valid = (request: ChildScopedDataRequest, signal: AbortSignal) => {
      const base = childDataNamespace(request.scope, purpose);
      return !signal.aborted && request.purpose === purpose && base !== null
        && (request.key === base || request.key.startsWith(`${base}/item/`)) && request.isCurrent() === true;
    };
    const copy = (value: unknown): unknown => value === null ? null : JSON.parse(JSON.stringify(value));
    output[purpose] = Object.freeze({
      async read(request: ChildScopedDataRequest, signal: AbortSignal) {
        if (!valid(request, signal)) throw new Error("Child scope unavailable");
        const current = records.get(request.key) ?? { revision: 0, value: null };
        return { revision: current.revision, value: copy(current.value) };
      },
      async compareAndSet(request: ChildScopedDataRequest, expectedRevision: number, value: unknown, signal: AbortSignal) {
        const copied = copy(value);
        if (!valid(request, signal) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return false;
        const current = records.get(request.key) ?? { revision: 0, value: null };
        if (current.revision !== expectedRevision || current.revision === Number.MAX_SAFE_INTEGER) return false;
        records.set(request.key, { revision: current.revision + 1, value: copied }); return true;
      },
    });
  }
  return Object.freeze(output);
}
