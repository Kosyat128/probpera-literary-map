import { ATLAS_URL_FILTERS, readAtlasUrlState, type AtlasUrlFilter, type AtlasUrlView } from "../utils/atlasUrlState";
import { homepageHashTargets } from "../utils/deferredHashNavigation";
import { parseBookArchiveLocation } from "../books/bookArchiveLocation";

/** A partial instruction, never another copy of the application's navigation state. */
export interface NativeNavigationIntent {
  readonly canonicalUrl: string;
  readonly language?: "ru" | "en";
  readonly atlas: Readonly<{ filter?: AtlasUrlFilter; countryId?: string; writerId?: string; view?: AtlasUrlView }>;
  readonly bookKey?: string;
  readonly shelfId?: string;
  readonly section?: string;
}

const entryPaths = new Set(["/", "/ru/", "/en/", "/planet/", "/planet/ru/", "/planet/en/"]);
const parameterNames = new Set(["atlas", "country", "writer", "atlasView", "book", "archiveShelf"]);
const forbiddenCharacters = /[\u0000-\u0020\u007f-\u009f\u202a-\u202e\u2066-\u2069\\]/u;

/** Only canonical HTTPS entry addresses. Local/custom schemes need a separate explicit contract. */
export function parseNativeNavigationUrl(raw: unknown): NativeNavigationIntent | null {
  if (typeof raw !== "string" || raw.length > 4096 || forbiddenCharacters.test(raw) || /%(?![0-9a-f]{2})/iu.test(raw)) return null;
  // Inspect the raw authority/path before URL normalizes ports, dot segments or encoded traversal.
  const match = /^https:\/\/([^/?#]+)([^?#]*)(?:[?#]|$)/u.exec(raw);
  if (!match || match[1] !== "probpera.ru" || !entryPaths.has(match[2])) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== "https://probpera.ru" || url.username || url.password || url.port) return null;
    if (forbiddenCharacters.test(decodeURIComponent(url.search)) || forbiddenCharacters.test(decodeURIComponent(url.hash))) return null;
    const params = url.searchParams;
    for (const [name, value] of params) {
      if (!parameterNames.has(name) || params.getAll(name).length !== 1 || !value || forbiddenCharacters.test(value) || value.trim() !== value) return null;
    }
    if (params.has("atlas") && !ATLAS_URL_FILTERS.some(value => value === params.get("atlas"))) return null;
    if (params.has("atlasView") && !["embedded", "immersive"].includes(params.get("atlasView")!)) return null;
    if (params.has("writer") && !params.has("country")) return null;
    const atlas = readAtlasUrlState(url.href);
    if (params.has("country") && atlas.countryId !== params.get("country")) return null;
    if (params.has("writer") && atlas.writerId !== params.get("writer")) return null;
    const book = parseBookArchiveLocation(url.search);
    if (params.has("book") && book.bookKey !== params.get("book")) return null;
    if (params.has("archiveShelf") && book.shelfId !== params.get("archiveShelf")) return null;
    if (book.bookKey) {
      const [country, writer] = book.bookKey.split(":");
      if ((atlas.countryId && atlas.countryId !== country) || (atlas.writerId && atlas.writerId !== writer)) return null;
    }
    const section = url.hash.slice(1);
    // Do not use the permissive deferred-hash parser's suffix/encoded aliases for incoming links.
    if (url.hash && !homepageHashTargets.has(section)) return null;
    params.sort();
    const language = /\/(ru|en)\/$/u.exec(url.pathname)?.[1] as "ru" | "en" | undefined;
    return Object.freeze({
      canonicalUrl: url.href,
      ...(language ? { language } : {}),
      atlas: Object.freeze({
        ...(params.has("atlas") ? { filter: atlas.filter } : {}),
        ...(atlas.countryId ? { countryId: atlas.countryId } : {}),
        ...(atlas.writerId ? { writerId: atlas.writerId } : {}),
        ...(params.has("atlasView") ? { view: atlas.view } : {}),
      }),
      ...(book.bookKey ? { bookKey: book.bookKey } : {}),
      ...(book.shelfId ? { shelfId: book.shelfId } : {}),
      ...(section ? { section } : {}),
    });
  } catch { return null; }
}

export interface NativeNavigationListenerHandle { remove(): void | Promise<void> }
export interface NativeNavigationSource {
  subscribeUrl(listener: (url: string) => void): NativeNavigationListenerHandle | Promise<NativeNavigationListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
}
export interface NativeNavigationReadiness {
  readonly bootstrap: "pending" | "ready" | "failed";
  readonly policy: "unknown" | "allowed" | "denied";
}
export type NativeNavigationResolution<T> = { status: "ready"; value: T } | { status: "missing" | "denied" | "unavailable" };
export interface NativeNavigationContext { readonly sequence: number; readonly signal: AbortSignal }
export type NativeNavigationOutcomeStatus = "queued" | "applied" | "declined" | "rejected" | "duplicate" | "denied" | "missing" | "unavailable" | "superseded" | "cancelled" | "expired" | "resolution-timeout" | "resolution-failed" | "apply-failed" | "launch-timeout" | "launch-unavailable" | "launch-superseded" | "listener-timeout" | "listener-unavailable" | "listener-cleanup-failed" | "disposed" | "not-started";
export interface NativeNavigationOutcome { readonly status: NativeNavigationOutcomeStatus; readonly sequence?: number }
export interface NativeNavigationOptions<T> {
  readonly source?: NativeNavigationSource;
  /** Must resolve against the existing catalog, publication gate and current host/child policy. */
  readonly resolve: (intent: NativeNavigationIntent, context: NativeNavigationContext) => Promise<NativeNavigationResolution<T>>;
  /** Synchronous canonical callbacks only. This module never changes location, history, locale or scene. */
  readonly apply: (value: T, intent: NativeNavigationIntent, context: NativeNavigationContext) => "applied" | "declined";
  readonly onOutcome?: (outcome: NativeNavigationOutcome) => void | Promise<void>;
  readonly sourceTimeoutMs?: number;
  readonly queueTimeoutMs?: number;
  readonly resolutionTimeoutMs?: number;
}

function timeout(value: number | undefined, fallback: number): number {
  const actual = value ?? fallback;
  if (!Number.isSafeInteger(actual) || actual < 1 || actual > 30000) throw new Error("Invalid native navigation timeout.");
  return actual;
}
function observe<T>(operation: Promise<T>, success: (value: T) => void, failure: () => void) {
  // Both paths are observed; diagnostics and late native failures never become unhandled rejections.
  void operation.then(success, failure).catch(() => {});
}
function notify<T>(callback: ((value: T) => void | Promise<void>) | undefined, value: T) {
  try { if (callback) observe(Promise.resolve(callback(value)), () => {}, () => {}); } catch { /* Sanitized diagnostics cannot break navigation. */ }
}

/** Explicit-start, latest-intent intake. At most one queued/resolving instruction; no DOM/SDK IO at construction. */
export function createNativeNavigationIntake<T>(options: NativeNavigationOptions<T>) {
  if (typeof options.resolve !== "function" || typeof options.apply !== "function") throw new Error("Native navigation callbacks are required.");
  if (options.source && (typeof options.source.subscribeUrl !== "function" || typeof options.source.getLaunchUrl !== "function")) throw new Error("Invalid native navigation source.");
  const sourceMs = timeout(options.sourceTimeoutMs, 1500);
  const queueMs = timeout(options.queueTimeoutMs, 15000);
  const resolutionMs = timeout(options.resolutionTimeoutMs, 2500);
  let started = false, disposed = false, revision = 0, sequence = 0;
  let readiness: NativeNavigationReadiness = { bootstrap: "pending", policy: "unknown" };
  type Pending = { intent: NativeNavigationIntent; sequence: number; timer: ReturnType<typeof setTimeout> };
  let pending: Pending | null = null;
  let active: { pending: Pending; abort: AbortController; timer: ReturnType<typeof setTimeout> } | null = null;
  let listenerHandle: NativeNavigationListenerHandle | null = null;
  let listenerEnabled = false, launchEnabled = false;
  let listenerTimer: ReturnType<typeof setTimeout> | undefined;
  let launchTimer: ReturnType<typeof setTimeout> | undefined;
  const emit = (status: NativeNavigationOutcomeStatus, id?: number) => {
    const outcome = Object.freeze({ status, ...(id === undefined ? {} : { sequence: id }) });
    notify(options.onOutcome, outcome); return outcome;
  };
  const abortResolution = () => {
    if (!active) return;
    const old = active; active = null; clearTimeout(old.timer); old.abort.abort();
  };
  const finish = (status: NativeNavigationOutcomeStatus) => {
    const old = pending; pending = null; abortResolution();
    if (old) { clearTimeout(old.timer); emit(status, old.sequence); }
  };
  const pump = () => {
    if (disposed || !started || !pending || active || readiness.bootstrap !== "ready" || readiness.policy !== "allowed") return;
    const current = pending;
    const abort = new AbortController();
    const operation = { pending: current, abort, timer: setTimeout(() => { if (active === operation) finish("resolution-timeout"); }, resolutionMs) };
    active = operation;
    const context = Object.freeze({ sequence: current.sequence, signal: abort.signal });
    const valid = () => active === operation && pending === current && !disposed && !abort.signal.aborted && readiness.bootstrap === "ready" && readiness.policy === "allowed";
    const fail = () => { if (valid()) finish("resolution-failed"); };
    try {
      observe(Promise.resolve(options.resolve(current.intent, context)), result => {
        if (!valid()) return;
        if (!result || !["ready", "missing", "denied", "unavailable"].includes(result.status)) { finish("resolution-failed"); return; }
        if (result.status !== "ready") { finish(result.status); return; }
        try {
          const outcome = options.apply(result.value, current.intent, context);
          if (outcome !== "applied" && outcome !== "declined") {
            observe(Promise.resolve(outcome), () => {}, () => {});
            if (valid()) finish("apply-failed");
          } else if (valid()) finish(outcome);
        } catch { if (valid()) finish("apply-failed"); }
      }, fail);
    } catch { fail(); }
  };
  const receive = (raw: unknown, origin: "launch" | "external" = "external"): NativeNavigationOutcome => {
    if (disposed) return emit("disposed");
    if (!started) return emit("not-started");
    const intent = parseNativeNavigationUrl(raw);
    if (!intent) return emit("rejected");
    if (origin === "external") revision++;
    if (readiness.policy === "denied") return emit("denied");
    if (readiness.bootstrap === "failed") return emit("unavailable");
    if (pending?.intent.canonicalUrl === intent.canonicalUrl) return emit("duplicate", pending.sequence);
    finish("superseded");
    const id = ++sequence;
    const item: Pending = { intent, sequence: id, timer: setTimeout(() => { if (pending === item) finish("expired"); }, queueMs) };
    pending = item; const outcome = emit("queued", id); pump(); return outcome;
  };
  const remove = (handle: NativeNavigationListenerHandle) => {
    try { observe(Promise.resolve(handle.remove()), () => {}, () => { emit("listener-cleanup-failed"); }); }
    catch { emit("listener-cleanup-failed"); }
  };
  return Object.freeze({
    start() {
      if (disposed || started) return;
      started = true;
      if (!options.source) return;
      const launchRevision = revision;
      listenerEnabled = true;
      listenerTimer = setTimeout(() => { listenerEnabled = false; emit("listener-timeout"); }, sourceMs);
      const listenerFailed = () => { clearTimeout(listenerTimer); if (listenerEnabled && !disposed) emit("listener-unavailable"); listenerEnabled = false; };
      try {
        observe(Promise.resolve(options.source.subscribeUrl(url => { if (listenerEnabled && !disposed) receive(url); })), handle => {
          clearTimeout(listenerTimer);
          if (!handle || typeof handle.remove !== "function") { listenerFailed(); return; }
          if (!listenerEnabled || disposed) remove(handle); else listenerHandle = handle;
        }, listenerFailed);
      } catch { listenerFailed(); }
      if (disposed) return;
      launchEnabled = true;
      launchTimer = setTimeout(() => { launchEnabled = false; emit("launch-timeout"); }, sourceMs);
      const launchFailed = () => { clearTimeout(launchTimer); if (launchEnabled && !disposed) emit("launch-unavailable"); launchEnabled = false; };
      try {
        observe(Promise.resolve(options.source.getLaunchUrl()), result => {
          clearTimeout(launchTimer);
          if (!launchEnabled || disposed) return;
          launchEnabled = false;
          if (launchRevision !== revision) { emit("launch-superseded"); return; }
          if (result === undefined) return;
          if (!result || typeof result.url !== "string") { emit("launch-unavailable"); return; }
          receive(result.url, "launch");
        }, launchFailed);
      } catch { launchFailed(); }
    },
    receiveUrl(raw: unknown) { return receive(raw); },
    setReadiness(next: NativeNavigationReadiness) {
      if (!next || !["pending", "ready", "failed"].includes(next.bootstrap) || !["unknown", "allowed", "denied"].includes(next.policy)) throw new Error("Invalid native navigation readiness.");
      if (disposed) return;
      readiness = Object.freeze({ bootstrap: next.bootstrap, policy: next.policy });
      if (next.policy === "denied") { revision++; finish("denied"); }
      else if (next.bootstrap === "failed") { revision++; finish("unavailable"); }
      else if (next.policy !== "allowed" || next.bootstrap !== "ready") abortResolution();
      else pump();
    },
    /** Call for a newer ordinary in-app selection/Back too, so late launch work cannot overwrite it. */
    cancelPending() { revision++; finish("cancelled"); },
    dispose() {
      if (disposed) return;
      disposed = true; listenerEnabled = false; launchEnabled = false;
      clearTimeout(listenerTimer); clearTimeout(launchTimer); finish("disposed");
      if (listenerHandle) { const handle = listenerHandle; listenerHandle = null; remove(handle); }
    },
  });
}

export type NativeBackActionResult = "handled" | "unhandled";
export type NativeBackResult = NativeBackActionResult | "history" | "root" | "pending" | "failed" | "timeout" | "cancelled" | "disposed";
export interface NativeBackContext { readonly signal: AbortSignal }
export interface NativeBackAction {
  readonly id: string;
  /** Higher runs first; equal priority uses most recently registered. Register only active UI layers. */
  readonly priority: number;
  readonly handle: (context: NativeBackContext) => NativeBackActionResult | Promise<NativeBackActionResult>;
}
export interface NativeBackOptions {
  readonly history?: { canGoBack(): boolean; goBack(context: NativeBackContext): void | Promise<void> };
  readonly root?: (context: NativeBackContext) => NativeBackActionResult | Promise<NativeBackActionResult>;
  readonly timeoutMs?: number;
  readonly onOutcome?: (result: NativeBackResult) => void | Promise<void>;
}

/** An ephemeral callback broker. No router, synthetic key event, browser history or native exit mutation. */
export function createNativeBackBroker(options: NativeBackOptions = {}) {
  const timeoutMs = timeout(options.timeoutMs, 3000);
  if (options.history && (typeof options.history.canGoBack !== "function" || typeof options.history.goBack !== "function")) throw new Error("Invalid native Back history port.");
  if (options.root !== undefined && typeof options.root !== "function") throw new Error("Invalid native Back root port.");
  const actions = new Map<string, { action: NativeBackAction; order: number }>();
  let order = 0, disposed = false;
  type BackOperation = { abort: AbortController; finish(result: NativeBackResult): void; actionId?: string };
  let running: BackOperation | null = null;
  const report = (value: NativeBackResult) => { notify(options.onOutcome, value); return value; };
  return Object.freeze({
    register(action: NativeBackAction) {
      if (disposed) throw new Error("Native Back broker is disposed.");
      if (!action || !/^[a-zA-Z0-9:_-]{1,64}$/u.test(action.id) || !Number.isSafeInteger(action.priority) || action.priority < 0 || action.priority > 1000 || typeof action.handle !== "function" || actions.has(action.id)) throw new Error("Invalid or duplicate native Back action.");
      const entry = { action: Object.freeze({ ...action }), order: ++order };
      const id = entry.action.id;
      actions.set(id, entry);
      // A newly opened layer must not be bypassed by an older asynchronous Back action.
      running?.finish("cancelled");
      return () => {
        if (actions.get(id) !== entry) return;
        actions.delete(id);
        if (running?.actionId === id) running.finish("cancelled");
      };
    },
    requestBack(): Promise<NativeBackResult> {
      if (disposed) return Promise.resolve(report("disposed"));
      if (running) return Promise.resolve(report("pending"));
      let resolve!: (value: NativeBackResult) => void;
      const result = new Promise<NativeBackResult>(yes => { resolve = yes; });
      const abort = new AbortController();
      const context = Object.freeze({ signal: abort.signal });
      const current: BackOperation = { abort, finish(value) {
        if (running !== current) return;
        running = null; clearTimeout(timer); abort.abort(); resolve(report(value));
      } };
      const timer = setTimeout(() => current.finish("timeout"), timeoutMs);
      running = current;
      const snapshot = [...actions.values()].sort((a, b) => b.action.priority - a.action.priority || b.order - a.order);
      const work = async () => {
        for (const entry of snapshot) {
          if (running !== current) return;
          if (actions.get(entry.action.id) !== entry) continue;
          current.actionId = entry.action.id;
          const value = await entry.action.handle(context);
          if (running !== current) return;
          current.actionId = undefined;
          if (value === "handled") { current.finish("handled"); return; }
          if (value !== "unhandled") { current.finish("failed"); return; }
        }
        if (running !== current) return;
        if (options.history) {
          const canGoBack = options.history.canGoBack();
          if (running !== current) return;
          if (typeof canGoBack !== "boolean") { observe(Promise.resolve(canGoBack), () => {}, () => {}); current.finish("failed"); return; }
          if (canGoBack) { await options.history.goBack(context); if (running === current) current.finish("history"); return; }
        }
        if (!options.root) { current.finish("unhandled"); return; }
        const value = await options.root(context);
        if (running === current) current.finish(value === "handled" ? "root" : value === "unhandled" ? "unhandled" : "failed");
      };
      observe(Promise.resolve().then(work), () => {}, () => { current.finish("failed"); });
      return result;
    },
    dispose() { if (disposed) return; disposed = true; actions.clear(); running?.finish("disposed"); },
  });
}
