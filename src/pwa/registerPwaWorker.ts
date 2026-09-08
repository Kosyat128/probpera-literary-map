/** The controlled /planet/ distribution owns this lifecycle; the public site does not. */
export type PwaWorkerPhase = "disabled" | "registering" | "ready" | "checking" | "update-available" | "activating" | "rolling-back" | "reloading" | "error" | "disposed";
export type PwaWorkerError = "unsupported" | "invalid-configuration" | "registration-failed" | "update-failed" | "message-failed" | "timeout" | "cancelled" | "disposed" | "not-ready" | "busy" | "worker-changed" | "rejected" | "reload-failed" | "multiple-clients";
export interface PwaWorkerSnapshot {
  readonly phase: PwaWorkerPhase;
  readonly update: { readonly buildId: string } | null;
  readonly error: PwaWorkerError | null;
  readonly rollback: { readonly buildId: string } | null;
  readonly activeBuildId: string | null;
  readonly engineBuildId: string | null;
}
export type PwaWorkerResult = { readonly ok: true } | { readonly ok: false; readonly reason: PwaWorkerError };
export type PwaOfflineReadinessResult =
  | { readonly status: "complete"; readonly engineBuildId: string; readonly activeBuildId: string; readonly fileCount: number; readonly bytes: number }
  | { readonly status: "incomplete"; readonly engineBuildId: string; readonly activeBuildId: string }
  | { readonly status: "unavailable"; readonly reason: PwaWorkerError };
/** Current verified access controller capability, never a token or SW authority. */
export interface PwaOfflineRepairAccess {
  getDeadline(): number | null;
  subscribe(callback: () => void): () => void;
}
export type PwaOfflineRepairError = PwaWorkerError | "access-required" | "missing-manifest";
export type PwaOfflineRepairResult =
  | { readonly status: "complete"; readonly engineBuildId: string; readonly activeBuildId: string; readonly fileCount: number; readonly bytes: number; readonly repairedFiles: number; readonly repairedBytes: number }
  | { readonly status: "incomplete"; readonly engineBuildId: string; readonly activeBuildId: string; readonly reason: "network-or-integrity" | "storage" | "verification-failed"; readonly repairedFiles: number; readonly repairedBytes: number }
  | { readonly status: "unavailable"; readonly reason: PwaOfflineRepairError };
export interface PwaWorkerOptions {
  readonly controlledDistribution: boolean;
  /** Null explicitly disables unavailable browser APIs, including SSR fixtures. */
  readonly serviceWorker?: ServiceWorkerContainer | null;
  readonly location?: Pick<Location, "href"> | null;
  readonly reload?: () => void;
  readonly allowLocalQa?: boolean;
  readonly timeoutMs?: number;
  readonly repairTimeoutMs?: number;
  readonly signal?: AbortSignal;
}
export interface PwaWorkerController {
  readonly ready: Promise<boolean>;
  getSnapshot(): PwaWorkerSnapshot;
  subscribe(callback: () => void): () => void;
  checkForUpdate(options?: { readonly signal?: AbortSignal }): Promise<PwaWorkerResult>;
  /** Explicit user-requested cache integrity check only. No repair, download or
   * entitlement check; success does not promise that the OS will retain files. */
  checkOfflineReadiness(options?: { readonly signal?: AbortSignal }): Promise<PwaOfflineReadinessResult>;
  /** Explicit repair of public immutable base bytes only. No entitlement grant,
   * activation, reload or guarantee that future browser eviction cannot occur. */
  repairOfflineBase(options: { readonly access: PwaOfflineRepairAccess | null; readonly signal?: AbortSignal }): Promise<PwaOfflineRepairResult>;
  /** Call only from an explicit user action. Cancellation cannot undo skipWaiting. */
  activateUpdate(options?: { readonly signal?: AbortSignal }): Promise<PwaWorkerResult>;
  /** Explicit whole-app rollback; the installed worker engine remains current.
   * Cancellation cannot undo a selection already committed by the worker. */
  rollback(options?: { readonly signal?: AbortSignal }): Promise<PwaWorkerResult>;
  dispose(): void;
}

const HASH = /^[a-f0-9]{64}$/u;
const ROUTES = new Set(["/planet/", "/planet/ru/", "/planet/en/"]);
const success = (): PwaWorkerResult => Object.freeze({ ok: true });
const failure = (reason: PwaWorkerError): PwaWorkerResult => Object.freeze({ ok: false, reason });
class LifecycleError extends Error {
  constructor(readonly reason: PwaWorkerError) { super(reason); }
}

/** No module-level browser reads, registration, update, activation or reload. */
export function registerPwaWorker(options: PwaWorkerOptions): PwaWorkerController {
  const container = options.serviceWorker === undefined ? globalThis.navigator?.serviceWorker : options.serviceWorker;
  const location = options.location === undefined ? globalThis.location : options.location;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const repairTimeoutMs = options.repairTimeoutMs ?? 120_000;
  const reload = options.reload ?? (() => globalThis.location.reload());
  let origin = "";
  let allowed = options.controlledDistribution === true;
  let initialError: PwaWorkerError | null = null;
  if (allowed) {
    try {
      const url = new URL(location?.href ?? "");
      const local = options.allowLocalQa === true && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if ((!local && url.protocol !== "https:") || (local && !["https:", "http:"].includes(url.protocol)) || !ROUTES.has(url.pathname) || url.username || url.password || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000 || !Number.isFinite(repairTimeoutMs) || repairTimeoutMs <= 0 || repairTimeoutMs > 120_000) throw new Error("Invalid distribution boundary");
      origin = url.origin;
      if (!container?.register || !container.addEventListener) initialError = "unsupported";
    } catch { initialError = "invalid-configuration"; }
    allowed = initialError === null;
  }
  let generationState = { activeBuildId: null as string | null, engineBuildId: null as string | null, rollbackBuildId: null as string | null };
  let snapshot: PwaWorkerSnapshot = Object.freeze({ phase: allowed ? "registering" : "disabled", update: null, error: initialError, rollback: null, activeBuildId: null, engineBuildId: null });
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  let availableWorker: ServiceWorker | undefined;
  let reloaded = false;
  let requestSequence = 0;
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const lifetime = new AbortController();
  const subscribers = new Map<() => void, number>();
  const workerCleanups = new Map<ServiceWorker, () => void>();
  let removeRegistrationListener: (() => void) | undefined;
  let pendingProbe: { worker: ServiceWorker; promise: Promise<PwaWorkerResult> } | undefined;
  let pendingCheck: Promise<PwaWorkerResult> | undefined;
  let activation: { worker: ServiceWorker; changed: Promise<void>; confirmChange: () => void; promise?: Promise<PwaWorkerResult> } | undefined;
  let rollbackOperation: Promise<PwaWorkerResult> | undefined;
  let activeProbe: { worker: ServiceWorker; promise: Promise<void> } | undefined;
  let generationEpoch = 0;
  let offlineReadinessPending = false;
  let offlineRepairAbort: ((reason: PwaOfflineRepairError) => void) | null = null;

  function setSnapshot(phase: PwaWorkerPhase, buildId: string | null = null, error: PwaWorkerError | null = null) {
    if (snapshot.phase === phase && snapshot.update?.buildId === (buildId ?? undefined) && snapshot.error === error && snapshot.activeBuildId === generationState.activeBuildId && snapshot.engineBuildId === generationState.engineBuildId && snapshot.rollback?.buildId === (generationState.rollbackBuildId ?? undefined)) return;
    snapshot = Object.freeze({ phase, update: buildId ? Object.freeze({ buildId }) : null, error, activeBuildId: generationState.activeBuildId, engineBuildId: generationState.engineBuildId, rollback: generationState.rollbackBuildId ? Object.freeze({ buildId: generationState.rollbackBuildId }) : null });
    for (const callback of [...subscribers.keys()]) {
      try { callback(); } catch { /* A consumer cannot break worker cleanup. */ }
    }
  }
  function combinedSignal(signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    for (const source of [lifetime.signal, signal]) {
      source?.addEventListener("abort", abort, { once: true });
      if (source?.aborted) abort();
    }
    return { signal: controller.signal, cleanup: () => {
      lifetime.signal.removeEventListener("abort", abort);
      signal?.removeEventListener("abort", abort);
    } };
  }
  function bounded<T>(operation: Promise<T>, signal: AbortSignal, limit = timeoutMs): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new LifecycleError("timeout")), limit);
      const abort = () => finish(new LifecycleError(disposed ? "disposed" : "cancelled"));
      let settled = false;
      function finish(error?: unknown, value?: T) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve(value as T);
      }
      signal.addEventListener("abort", abort, { once: true });
      operation.then((value) => finish(undefined, value), (error) => finish(error));
      if (signal.aborted) abort();
    });
  }
  function errorReason(error: unknown, fallback: PwaWorkerError): PwaWorkerError {
    return error instanceof LifecycleError ? error.reason : fallback;
  }
  async function handshake(worker: ServiceWorker, type: "PLANET_UPDATE_STATUS" | "PLANET_ACTIVATE_UPDATE", signal: AbortSignal, buildId?: string) {
    const requestId = `pwa-${nonce}-${++requestSequence}`;
    const responseType = type === "PLANET_UPDATE_STATUS" ? "PLANET_UPDATE_STATUS_RESULT" : "PLANET_UPDATE_ACTIVATION_RESULT";
    let onMessage: ((event: MessageEvent) => void) | undefined;
    try {
      return await bounded(new Promise<{ buildId: string; confirmed: boolean }>((resolve, reject) => {
        if (signal.aborted || disposed) { reject(new LifecycleError(disposed ? "disposed" : "cancelled")); return; }
        onMessage = (event) => {
          const data = event.data;
          const field = type === "PLANET_UPDATE_STATUS" ? "ready" : "accepted";
          if (event.source !== worker || event.origin !== origin || !data || typeof data !== "object" || data.type !== responseType || data.requestId !== requestId || typeof data.buildId !== "string" || !HASH.test(data.buildId) || (buildId && data.buildId !== buildId) || typeof data[field] !== "boolean") return;
          resolve({ buildId: data.buildId, confirmed: data[field] });
        };
        container!.addEventListener("message", onMessage);
        try { worker.postMessage({ type, requestId, ...(buildId ? { buildId } : {}) }); }
        catch { reject(new LifecycleError("message-failed")); }
      }), signal);
    } finally {
      if (onMessage) container!.removeEventListener("message", onMessage);
    }
  }
  function workerAllowed(worker: ServiceWorker) {
    try { return worker.scriptURL === origin + "/planet/sw.js" && worker.state !== "redundant"; }
    catch { return false; }
  }
  async function rollbackHandshake(worker: ServiceWorker, signal: AbortSignal, target?: { engineBuildId: string; buildId: string }) {
    const requestId = `pwa-${nonce}-${++requestSequence}`;
    const type = target ? "PLANET_ACTIVATE_ROLLBACK" : "PLANET_ROLLBACK_STATUS";
    const responseType = target ? "PLANET_ROLLBACK_ACTIVATION_RESULT" : "PLANET_ROLLBACK_STATUS_RESULT";
    let onMessage: ((event: MessageEvent) => void) | undefined;
    try {
      return await bounded(new Promise<{ engineBuildId: string; activeBuildId: string | null; rollbackBuildId: string | null; confirmed: boolean; reason: PwaWorkerError }>((resolve, reject) => {
        if (disposed || signal.aborted) { reject(new LifecycleError(disposed ? "disposed" : "cancelled")); return; }
        onMessage = event => {
          const data = event.data;
          if (event.source !== worker || event.origin !== origin || !data || typeof data !== "object" || data.type !== responseType || data.requestId !== requestId || typeof data.engineBuildId !== "string" || !HASH.test(data.engineBuildId) || (data.activeBuildId !== null && (typeof data.activeBuildId !== "string" || !HASH.test(data.activeBuildId)))) return;
          if (target) {
            if (data.engineBuildId !== target.engineBuildId || data.targetBuildId !== target.buildId || typeof data.accepted !== "boolean" || (data.accepted && data.activeBuildId !== target.buildId)) return;
          } else if (typeof data.ready !== "boolean" || (data.rollbackBuildId !== null && (typeof data.rollbackBuildId !== "string" || !HASH.test(data.rollbackBuildId))) || (data.ready && (data.activeBuildId !== data.engineBuildId || !data.rollbackBuildId || data.rollbackBuildId === data.engineBuildId)) || (!data.ready && data.rollbackBuildId !== null)) return;
          resolve({ engineBuildId: data.engineBuildId, activeBuildId: data.activeBuildId, rollbackBuildId: target ? null : data.rollbackBuildId, confirmed: target ? data.accepted : data.ready, reason: data.reason === "multiple-clients" ? "multiple-clients" : "rejected" });
        };
        container!.addEventListener("message", onMessage);
        try { worker.postMessage({ type, requestId, ...(target ? { engineBuildId: target.engineBuildId, targetBuildId: target.buildId } : {}) }); }
        catch { reject(new LifecycleError("message-failed")); }
      }), signal);
    } finally { if (onMessage) container!.removeEventListener("message", onMessage); }
  }
  function probeActiveGeneration(): Promise<void> {
    const worker = container?.controller;
    if (disposed || activation || rollbackOperation || reloaded || !worker || !workerAllowed(worker)) return Promise.resolve();
    if (activeProbe?.worker === worker) return activeProbe.promise;
    const epoch = generationEpoch;
    let operation!: Promise<void>;
    operation = (async () => {
      try {
        const reply = await rollbackHandshake(worker, lifetime.signal);
        if (disposed || activation || rollbackOperation || reloaded || generationEpoch !== epoch || container?.controller !== worker) return;
        generationState = { activeBuildId: reply.activeBuildId, engineBuildId: reply.engineBuildId, rollbackBuildId: reply.rollbackBuildId };
        setSnapshot(snapshot.phase, snapshot.update?.buildId ?? null, snapshot.error);
      } catch { /* Older engines may not expose rollback. Never auto-reload or guess a target. */ }
      finally { if (activeProbe?.promise === operation) activeProbe = undefined; }
    })();
    activeProbe = { worker, promise: operation };
    return operation;
  }
  function probeWaiting(signal?: AbortSignal): Promise<PwaWorkerResult> {
    if (disposed) return Promise.resolve(failure("disposed"));
    if (activation || rollbackOperation || reloaded) return Promise.resolve(failure("busy"));
    const worker = registration?.waiting;
    if (!worker) {
      availableWorker = undefined;
      setSnapshot("ready");
      return Promise.resolve(success());
    }
    if (!workerAllowed(worker)) return Promise.resolve(failure("worker-changed"));
    if (pendingProbe?.worker === worker) return signal ? bounded(pendingProbe.promise, signal).catch((error) => failure(errorReason(error, "message-failed"))) : pendingProbe.promise;
    const joined = combinedSignal(signal);
    const promise = (async () => {
      try {
        const reply = await handshake(worker, "PLANET_UPDATE_STATUS", joined.signal);
        if (disposed) return failure("disposed");
        if (registration?.waiting !== worker || !workerAllowed(worker)) return failure("worker-changed");
        if (!reply.confirmed) { availableWorker = undefined; setSnapshot("ready", null, "not-ready"); return failure("not-ready"); }
        availableWorker = worker;
        setSnapshot("update-available", reply.buildId);
        return success();
      } catch (error) {
        const reason = errorReason(error, "message-failed");
        if (!disposed && !activation && registration?.waiting === worker) setSnapshot("ready", null, reason);
        return failure(reason);
      } finally {
        joined.cleanup();
        if (pendingProbe?.worker === worker) pendingProbe = undefined;
      }
    })();
    pendingProbe = { worker, promise };
    return promise;
  }
  function watchInstalling() {
    if (disposed) return;
    const worker = registration?.installing;
    if (!worker || workerCleanups.has(worker)) return;
    const changed = () => {
      if (disposed) return;
      if (worker.state === "installed") void probeWaiting();
      if (worker.state === "activated" || worker.state === "redundant") {
        workerCleanups.get(worker)?.();
        workerCleanups.delete(worker);
        if (!activation && registration?.waiting !== availableWorker) void probeWaiting();
      }
    };
    worker.addEventListener("statechange", changed);
    workerCleanups.set(worker, () => worker.removeEventListener("statechange", changed));
    changed();
  }
  function controllerChanged() {
    if (disposed) return;
    offlineRepairAbort?.("worker-changed");
    generationEpoch++;
    generationState = { activeBuildId: null, engineBuildId: null, rollbackBuildId: null };
    if (activation) {
      if (container!.controller === activation.worker) activation.confirmChange();
    } else if (!reloaded && registration) { void probeWaiting(); void probeActiveGeneration(); }
  }
  const ready = (async () => {
    if (!allowed || options.signal?.aborted) return false;
    container!.addEventListener("controllerchange", controllerChanged);
    try {
      const result = await bounded(container!.register("/planet/sw.js", { scope: "/planet/", type: "classic", updateViaCache: "none" }), lifetime.signal);
      if (disposed) return false;
      if (result.scope !== origin + "/planet/") throw new LifecycleError("invalid-configuration");
      registration = result;
      registration.addEventListener("updatefound", watchInstalling);
      removeRegistrationListener = () => registration?.removeEventListener("updatefound", watchInstalling);
      setSnapshot("ready");
      watchInstalling();
      void probeWaiting();
      void probeActiveGeneration();
      return true;
    } catch (error) {
      if (!disposed) setSnapshot("error", null, errorReason(error, "registration-failed"));
      container!.removeEventListener("controllerchange", controllerChanged);
      return false;
    }
  })();
  function checkForUpdate({ signal }: { signal?: AbortSignal } = {}): Promise<PwaWorkerResult> {
    if (disposed) return Promise.resolve(failure("disposed"));
    if (pendingCheck) return signal ? bounded(pendingCheck, signal).catch((error) => failure(errorReason(error, "update-failed"))) : pendingCheck;
    const joined = combinedSignal(signal);
    const operation = (async () => {
      try {
        if (!await bounded(ready, joined.signal) || !registration) return failure("not-ready");
        if (activation || rollbackOperation || reloaded) return failure("busy");
        if (joined.signal.aborted) return failure(disposed ? "disposed" : "cancelled");
        if (!snapshot.update) setSnapshot("checking");
        await bounded(registration.update(), joined.signal);
        void probeActiveGeneration();
        return await probeWaiting(joined.signal);
      } catch (error) {
        const reason = errorReason(error, "update-failed");
        if (!disposed && !activation && !snapshot.update) setSnapshot("ready", null, reason);
        return failure(reason);
      } finally { joined.cleanup(); pendingCheck = undefined; }
    })();
    pendingCheck = operation;
    return operation;
  }
  async function checkOfflineReadiness({ signal }: { signal?: AbortSignal } = {}): Promise<PwaOfflineReadinessResult> {
    const unavailable = (reason: PwaWorkerError): PwaOfflineReadinessResult => Object.freeze({ status: "unavailable", reason });
    if (disposed) return unavailable("disposed");
    if (signal?.aborted) return unavailable("cancelled");
    if (offlineReadinessPending || offlineRepairAbort || activation || rollbackOperation || reloaded) return unavailable("busy");
    const worker = container?.controller;
    const { engineBuildId, activeBuildId } = generationState;
    if (!allowed || !registration || !worker || !workerAllowed(worker) || !engineBuildId || !activeBuildId) return unavailable("not-ready");
    const epoch = generationEpoch;
    const joined = combinedSignal(signal);
    const requestId = `pwa-${nonce}-${++requestSequence}`;
    let onMessage: ((event: MessageEvent) => void) | undefined;
    let completed = false;
    offlineReadinessPending = true;
    try {
      const result = await bounded(new Promise<PwaOfflineReadinessResult>((resolve, reject) => {
        onMessage = event => {
          const data = event.data;
          if (event.source !== worker || event.origin !== origin || !data || typeof data !== "object" || Array.isArray(data)
            || data.type !== "PLANET_OFFLINE_READINESS_RESULT" || data.requestId !== requestId
            || data.engineBuildId !== engineBuildId || data.activeBuildId !== activeBuildId) return;
          const extraKeys = data.status === "complete" ? ["fileCount", "bytes"] : data.status === "unavailable" ? ["reason"] : [];
          if (Object.keys(data).some(key => !["type", "requestId", "engineBuildId", "activeBuildId", "status", ...extraKeys].includes(key))) return;
          if (data.status === "complete") {
            if (!Number.isSafeInteger(data.fileCount) || data.fileCount < 2 || data.fileCount > 512
              || !Number.isSafeInteger(data.bytes) || data.bytes < data.fileCount || data.bytes > 64 * 1024 * 1024) return;
            resolve(Object.freeze({ status: "complete", engineBuildId, activeBuildId, fileCount: data.fileCount, bytes: data.bytes }));
          } else if (data.status === "incomplete") {
            if (Object.prototype.hasOwnProperty.call(data, "fileCount") || Object.prototype.hasOwnProperty.call(data, "bytes")) return;
            resolve(Object.freeze({ status: "incomplete", engineBuildId, activeBuildId }));
          } else if (data.status === "unavailable" && ["busy", "worker-changed", "timeout", "cancelled", "not-ready"].includes(data.reason)) {
            resolve(unavailable(data.reason));
          }
        };
        container!.addEventListener("message", onMessage);
        try { worker.postMessage({ type: "PLANET_OFFLINE_READINESS", requestId, engineBuildId, activeBuildId }); }
        catch { reject(new LifecycleError("message-failed")); }
      }), joined.signal);
      if (disposed || joined.signal.aborted) return unavailable(disposed ? "disposed" : "cancelled");
      if (epoch !== generationEpoch || container?.controller !== worker || !workerAllowed(worker)
        || generationState.engineBuildId !== engineBuildId || generationState.activeBuildId !== activeBuildId
        || activation || rollbackOperation || reloaded) return unavailable("worker-changed");
      completed = true;
      return result;
    } catch (error) {
      return unavailable(errorReason(error, "message-failed"));
    } finally {
      if (onMessage) container!.removeEventListener("message", onMessage);
      if (!completed) {
        try { worker.postMessage({ type: "PLANET_CANCEL_OFFLINE_READINESS", requestId, engineBuildId, activeBuildId }); }
        catch { /* Local listener and deadline are already released. */ }
      }
      joined.cleanup();
      offlineReadinessPending = false;
    }
  }
  async function repairOfflineBase({ access, signal }: { access: PwaOfflineRepairAccess | null; signal?: AbortSignal }): Promise<PwaOfflineRepairResult> {
    const unavailable = (reason: PwaOfflineRepairError): PwaOfflineRepairResult => Object.freeze({ status: "unavailable", reason });
    if (disposed) return unavailable("disposed");
    if (signal?.aborted) return unavailable("cancelled");
    if (offlineRepairAbort || offlineReadinessPending || activation || rollbackOperation || reloaded) return unavailable("busy");
    const worker = container?.controller;
    const { engineBuildId, activeBuildId } = generationState;
    if (!allowed || !registration || !worker || !workerAllowed(worker) || !engineBuildId || !activeBuildId) return unavailable("not-ready");
    const deadline = () => {
      try {
        const value = access?.getDeadline();
        return typeof value === "number" && Number.isSafeInteger(value) && value > Date.now() ? value : null;
      } catch { return null; }
    };
    if (!access?.subscribe || deadline() === null) return unavailable("access-required");
    const epoch = generationEpoch, requestId = `pwa-${nonce}-${++requestSequence}`;
    const operationAbort = new AbortController(), joined = combinedSignal(operationAbort.signal);
    let abortReason: PwaOfflineRepairError | null = null, completed = false, sequence = 0;
    let removeAccess: (() => void) | undefined, onMessage: ((event: MessageEvent) => void) | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const current = () => !disposed && epoch === generationEpoch && container?.controller === worker && workerAllowed(worker)
      && generationState.engineBuildId === engineBuildId && generationState.activeBuildId === activeBuildId
      && !activation && !rollbackOperation && !reloaded;
    const abort = (reason: PwaOfflineRepairError) => { abortReason ??= reason; operationAbort.abort(); };
    const externalAbort = () => abort("cancelled");
    const verifyAccess = () => {
      clearTimeout(expiryTimer);
      const until = deadline();
      if (until === null) { abort("access-required"); return null; }
      expiryTimer = setTimeout(verifyAccess, Math.min(2_147_000_000, Math.max(1, until - Date.now())));
      return until;
    };
    offlineRepairAbort = abort;
    signal?.addEventListener("abort", externalAbort, { once: true });
    try {
      removeAccess = access.subscribe(() => { verifyAccess(); });
      verifyAccess();
      if (signal?.aborted) externalAbort();
      const result = await bounded(new Promise<PwaOfflineRepairResult>((resolve, reject) => {
        if (joined.signal.aborted) { reject(new LifecycleError("cancelled")); return; }
        onMessage = event => {
          const data = event.data;
          if (event.source !== worker || event.origin !== origin || !data || typeof data !== "object" || Array.isArray(data)
            || data.requestId !== requestId || data.engineBuildId !== engineBuildId || data.activeBuildId !== activeBuildId) return;
          if (!current()) { abort("worker-changed"); return; }
          const until = verifyAccess();
          if (until === null) return;
          const baseKeys = ["type", "requestId", "engineBuildId", "activeBuildId"];
          if (data.type === "PLANET_OFFLINE_REPAIR_PERMISSION_REQUEST") {
            if (Object.keys(data).length !== 5 || Object.keys(data).some(key => ![...baseKeys, "sequence"].includes(key))
              || !Number.isSafeInteger(data.sequence) || data.sequence !== sequence + 1) return;
            sequence = data.sequence;
            try { worker.postMessage({ type: "PLANET_OFFLINE_REPAIR_PERMISSION", requestId, engineBuildId, activeBuildId,
              sequence, deadline: Math.min(until, Date.now() + 30_000) }); }
            catch { abort("message-failed"); }
            return;
          }
          if (data.type !== "PLANET_OFFLINE_REPAIR_RESULT") return;
          const counts = ["repairedFiles", "repairedBytes"];
          const validCounts = () => Number.isSafeInteger(data.repairedFiles) && data.repairedFiles >= 0 && data.repairedFiles <= 512
            && Number.isSafeInteger(data.repairedBytes) && data.repairedBytes >= data.repairedFiles && data.repairedBytes <= 64 * 1024 * 1024
            && (data.repairedFiles !== 0 || data.repairedBytes === 0);
          const fields = data.status === "complete" ? [...counts, "fileCount", "bytes"] : data.status === "incomplete" ? [...counts, "reason"] : ["reason"];
          if (Object.keys(data).some(key => ![...baseKeys, "status", ...fields].includes(key))) return;
          if (data.status === "complete") {
            if (!validCounts() || !Number.isSafeInteger(data.fileCount) || data.fileCount < 2 || data.fileCount > 512
              || !Number.isSafeInteger(data.bytes) || data.bytes < data.fileCount || data.bytes > 64 * 1024 * 1024
              || data.repairedFiles > data.fileCount || data.repairedBytes > data.bytes) return;
            resolve(Object.freeze({ status: "complete", engineBuildId, activeBuildId, fileCount: data.fileCount, bytes: data.bytes,
              repairedFiles: data.repairedFiles, repairedBytes: data.repairedBytes }));
          } else if (data.status === "incomplete" && validCounts() && ["network-or-integrity", "storage", "verification-failed"].includes(data.reason)) {
            resolve(Object.freeze({ status: "incomplete", engineBuildId, activeBuildId, reason: data.reason,
              repairedFiles: data.repairedFiles, repairedBytes: data.repairedBytes }));
          } else if (data.status === "unavailable" && ["busy", "worker-changed", "timeout", "cancelled", "not-ready", "access-required", "missing-manifest"].includes(data.reason)) resolve(unavailable(data.reason));
        };
        container!.addEventListener("message", onMessage);
        try { worker.postMessage({ type: "PLANET_OFFLINE_REPAIR", requestId, engineBuildId, activeBuildId }); }
        catch { reject(new LifecycleError("message-failed")); }
      }), joined.signal, repairTimeoutMs);
      if (disposed || joined.signal.aborted) return unavailable(abortReason ?? (disposed ? "disposed" : "cancelled"));
      if (!current()) return unavailable("worker-changed");
      if (deadline() === null) return unavailable("access-required");
      completed = true; return result;
    } catch (error) { return unavailable(abortReason ?? errorReason(error, "message-failed")); }
    finally {
      if (onMessage) container!.removeEventListener("message", onMessage);
      if (!completed) {
        try { worker.postMessage({ type: "PLANET_CANCEL_OFFLINE_REPAIR", requestId, engineBuildId, activeBuildId }); } catch { /* Local cleanup still completes. */ }
      }
      clearTimeout(expiryTimer); removeAccess?.(); signal?.removeEventListener("abort", externalAbort);
      joined.cleanup(); if (offlineRepairAbort === abort) offlineRepairAbort = null;
    }
  }
  function activateUpdate({ signal }: { signal?: AbortSignal } = {}): Promise<PwaWorkerResult> {
    if (disposed) return Promise.resolve(failure("disposed"));
    if (activation?.promise) return activation.promise;
    if (rollbackOperation || offlineRepairAbort) return Promise.resolve(failure("busy"));
    const worker = registration?.waiting;
    const buildId = snapshot.update?.buildId;
    if (reloaded || !worker || worker !== availableWorker || !buildId || !workerAllowed(worker)) return Promise.resolve(failure("not-ready"));
    const joined = combinedSignal(signal);
    if (joined.signal.aborted) { joined.cleanup(); return Promise.resolve(failure("cancelled")); }
    let confirmChange!: () => void;
    const changed = new Promise<void>((resolve) => { confirmChange = resolve; });
    const attempt = { worker, changed, confirmChange, promise: undefined as Promise<PwaWorkerResult> | undefined };
    activation = attempt;
    setSnapshot("activating", buildId);
    attempt.promise = (async () => {
      try {
        const reply = await handshake(worker, "PLANET_ACTIVATE_UPDATE", joined.signal, buildId);
        if (!reply.confirmed) throw new LifecycleError("rejected");
        await bounded(changed, joined.signal);
        if (disposed || joined.signal.aborted) throw new LifecycleError(disposed ? "disposed" : "cancelled");
        if (container!.controller !== worker) throw new LifecycleError("worker-changed");
        reloaded = true;
        availableWorker = undefined;
        setSnapshot("reloading");
        try { reload(); } catch { throw new LifecycleError("reload-failed"); }
        return success();
      } catch (error) {
        const reason = errorReason(error, "message-failed");
        if (!disposed) setSnapshot(registration?.waiting === worker && !reloaded ? "update-available" : "error", registration?.waiting === worker && !reloaded ? buildId : null, reason);
        return failure(reason);
      } finally { joined.cleanup(); if (activation === attempt) activation = undefined; }
    })();
    return attempt.promise;
  }
  function rollback({ signal }: { signal?: AbortSignal } = {}): Promise<PwaWorkerResult> {
    if (disposed) return Promise.resolve(failure("disposed"));
    if (rollbackOperation) return rollbackOperation;
    if (activation || reloaded || offlineRepairAbort) return Promise.resolve(failure("busy"));
    const worker = container?.controller, buildId = snapshot.rollback?.buildId, engineBuildId = snapshot.engineBuildId;
    if (!worker || !workerAllowed(worker) || !buildId || !engineBuildId || snapshot.activeBuildId !== engineBuildId) return Promise.resolve(failure("not-ready"));
    const joined = combinedSignal(signal);
    if (joined.signal.aborted) { joined.cleanup(); return Promise.resolve(failure("cancelled")); }
    generationEpoch++;
    setSnapshot("rolling-back", snapshot.update?.buildId ?? null);
    let operation!: Promise<PwaWorkerResult>;
    operation = (async () => {
      try {
        const reply = await rollbackHandshake(worker, joined.signal, { buildId, engineBuildId });
        if (!reply.confirmed) throw new LifecycleError(reply.reason);
        if (disposed || joined.signal.aborted) throw new LifecycleError(disposed ? "disposed" : "cancelled");
        if (container!.controller !== worker) throw new LifecycleError("worker-changed");
        generationState = { engineBuildId, activeBuildId: buildId, rollbackBuildId: null };
        reloaded = true;
        setSnapshot("reloading");
        try { reload(); } catch { throw new LifecycleError("reload-failed"); }
        return success();
      } catch (error) {
        const reason = errorReason(error, "message-failed");
        if (!disposed) setSnapshot(snapshot.update ? "update-available" : "ready", snapshot.update?.buildId ?? null, reason);
        return failure(reason);
      } finally { joined.cleanup(); if (rollbackOperation === operation) rollbackOperation = undefined; }
    })();
    rollbackOperation = operation;
    return operation;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    options.signal?.removeEventListener("abort", dispose);
    container?.removeEventListener("controllerchange", controllerChanged);
    removeRegistrationListener?.();
    for (const cleanup of workerCleanups.values()) cleanup();
    workerCleanups.clear();
    availableWorker = undefined;
    generationState = { activeBuildId: null, engineBuildId: null, rollbackBuildId: null };
    setSnapshot("disposed");
    subscribers.clear();
  }
  options.signal?.addEventListener("abort", dispose, { once: true });
  if (options.signal?.aborted) dispose();
  return Object.freeze({ ready, getSnapshot: () => snapshot, checkForUpdate, checkOfflineReadiness, repairOfflineBase, activateUpdate, rollback, dispose,
    subscribe(callback: () => void) {
      if (disposed) return () => undefined;
      subscribers.set(callback, (subscribers.get(callback) ?? 0) + 1);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        const count = subscribers.get(callback) ?? 0;
        if (count <= 1) subscribers.delete(callback); else subscribers.set(callback, count - 1);
      };
    },
  });
}
