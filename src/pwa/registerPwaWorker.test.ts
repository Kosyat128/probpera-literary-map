import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPwaWorker, type PwaWorkerController, type PwaWorkerOptions } from "./registerPwaWorker";
import { PWA_BOOTSTRAP_MAX_TOTAL_BYTES } from "./pwaBootstrapBudgets";

const ORIGIN = "https://probpera.ru";
const BUILD = "b".repeat(64);
const PREVIOUS = "a".repeat(64);
class TrackedTarget extends EventTarget {
  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (callback) { const group = this.listeners.get(type) ?? new Set(); group.add(callback); this.listeners.set(type, group); }
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (callback) this.listeners.get(type)?.delete(callback);
    super.removeEventListener(type, callback, options);
  }
  count(type?: string) { return type ? this.listeners.get(type)?.size ?? 0 : [...this.listeners.values()].reduce((sum, group) => sum + group.size, 0); }
}
class FakeWorker extends TrackedTarget {
  scriptURL = ORIGIN + "/planet/sw.js";
  state: ServiceWorkerState = "installed";
  postMessage = vi.fn<(data: Record<string, unknown>) => void>();
}
class FakeRegistration extends TrackedTarget {
  scope = ORIGIN + "/planet/";
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn(async () => this as unknown as ServiceWorkerRegistration);
}
class FakeContainer extends TrackedTarget {
  controller: FakeWorker | null = null;
  register = vi.fn<(url: string | URL, options?: RegistrationOptions) => Promise<ServiceWorkerRegistration>>();
}
const controllers: PwaWorkerController[] = [];
function fixture({ waiting = true, autoStatus = true, ...overrides }: Partial<PwaWorkerOptions> & { waiting?: boolean; autoStatus?: boolean } = {}) {
  const worker = new FakeWorker();
  const registration = new FakeRegistration();
  const container = new FakeContainer();
  container.register.mockResolvedValue(registration as unknown as ServiceWorkerRegistration);
  registration.waiting = waiting ? worker : null;
  const reload = vi.fn();
  function reply(data: Record<string, unknown>, source: unknown = worker, origin = ORIGIN) {
    container.dispatchEvent(Object.assign(new Event("message"), { data, source, origin }));
  }
  worker.postMessage.mockImplementation((data) => {
    if (autoStatus && data.type === "PLANET_UPDATE_STATUS") reply({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: data.requestId, buildId: BUILD, ready: true });
  });
  const service = registerPwaWorker({ controlledDistribution: true, serviceWorker: container as unknown as ServiceWorkerContainer, location: { href: ORIGIN + "/planet/ru/" }, reload, timeoutMs: 100, ...overrides });
  controllers.push(service);
  return { worker, registration, container, reload, service, reply };
}
async function settled(service: PwaWorkerController) {
  await service.ready;
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
}
function latest(worker: FakeWorker, type: string) {
  const messages = worker.postMessage.mock.calls.map(([data]) => data).filter((data) => data.type === type);
  return messages[messages.length - 1]!;
}
function activateReply(env: ReturnType<typeof fixture>, accepted = true) {
  const request = latest(env.worker, "PLANET_ACTIVATE_UPDATE");
  env.reply({ type: "PLANET_UPDATE_ACTIVATION_RESULT", requestId: request.requestId, buildId: BUILD, accepted });
}
function controllerChange(env: ReturnType<typeof fixture>, target: FakeWorker = env.worker) {
  env.registration.waiting = null;
  env.container.controller = target;
  env.container.dispatchEvent(new Event("controllerchange"));
}
afterEach(() => { for (const service of controllers.splice(0)) service.dispose(); vi.useRealTimers(); });

describe("controlled PWA registration", () => {
  it.each([
    { controlledDistribution: false }, { location: { href: ORIGIN + "/" } },
    { location: { href: ORIGIN + "/planet/admin/" } }, { location: { href: "http://probpera.ru/planet/" } },
    { location: { href: "https://user:password@probpera.ru/planet/" } }, { timeoutMs: -1 },
  ])("never registers outside the explicit permitted distribution %#", async (options) => {
    const env = fixture(options);
    expect(await env.service.ready).toBe(false);
    expect(env.container.register).not.toHaveBeenCalled();
    expect(env.container.count()).toBe(0);
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("handles explicit unavailable browser APIs and SSR without registration", async () => {
    const service = registerPwaWorker({ controlledDistribution: true, serviceWorker: null, location: { href: ORIGIN + "/planet/" } });
    controllers.push(service);
    expect(await service.ready).toBe(false);
    expect(service.getSnapshot()).toMatchObject({ phase: "disabled", error: "unsupported" });
  });
  it.each(["/planet/", "/planet/ru/", "/planet/en/"])("registers only the exact isolated classic worker for %s", async (path) => {
    const env = fixture({ location: { href: ORIGIN + path } });
    await settled(env.service);
    expect(env.container.register).toHaveBeenCalledExactlyOnceWith("/planet/sw.js", { scope: "/planet/", type: "classic", updateViaCache: "none" });
    expect(env.registration.update).not.toHaveBeenCalled();
    expect(latest(env.worker, "PLANET_UPDATE_STATUS")).not.toHaveProperty("buildId");
    expect(env.service.getSnapshot()).toEqual({ phase: "update-available", update: { buildId: BUILD }, error: null, rollback: null, activeBuildId: null, engineBuildId: null });
    expect(env.worker.postMessage.mock.calls.some(([data]) => data.type === "PLANET_ACTIVATE_UPDATE")).toBe(false);
    expect(env.reload).not.toHaveBeenCalled();
    expect(env.container.count("message")).toBe(0);
  });
  it("exposes stable frozen snapshots and reference-counted subscriptions", async () => {
    const env = fixture({ autoStatus: false });
    await settled(env.service);
    const snapshot = env.service.getSnapshot();
    expect(env.service.getSnapshot()).toBe(snapshot);
    expect(Object.isFrozen(snapshot)).toBe(true);
    const callback = vi.fn();
    const first = env.service.subscribe(callback);
    const second = env.service.subscribe(callback);
    first(); first();
    const request = latest(env.worker, "PLANET_UPDATE_STATUS");
    env.reply({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: request.requestId, buildId: BUILD, ready: true });
    await settled(env.service);
    expect(callback).toHaveBeenCalledOnce();
    expect(Object.isFrozen(env.service.getSnapshot().update)).toBe(true);
    second();
    env.service.dispose();
    expect(callback).toHaveBeenCalledOnce();
  });
  it("observes updatefound/install state and does not reload on first controller acquisition", async () => {
    const env = fixture({ waiting: false });
    await settled(env.service);
    env.worker.state = "installing";
    env.registration.installing = env.worker;
    env.registration.dispatchEvent(new Event("updatefound"));
    expect(env.worker.count("statechange")).toBe(1);
    env.worker.state = "installed";
    env.registration.waiting = env.worker;
    env.worker.dispatchEvent(new Event("statechange"));
    await settled(env.service);
    expect(env.service.getSnapshot().update?.buildId).toBe(BUILD);
    controllerChange(env);
    expect(env.reload).not.toHaveBeenCalled();
    env.worker.state = "activated";
    env.worker.dispatchEvent(new Event("statechange"));
    expect(env.worker.count()).toBe(0);
  });
});

describe("waiting-worker handshake boundary", () => {
  it.each(["wrong source", "wrong origin", "wrong request", "wrong type", "invalid build", "invalid readiness"])("ignores %s and cleans the handshake at its deadline", async (reason) => {
    vi.useFakeTimers();
    const env = fixture({ autoStatus: false });
    await settled(env.service);
    const request = latest(env.worker, "PLANET_UPDATE_STATUS");
    const data = { type: "PLANET_UPDATE_STATUS_RESULT", requestId: request.requestId, buildId: BUILD, ready: true as unknown };
    if (reason === "wrong request") data.requestId = "someone-else";
    if (reason === "wrong type") data.type = "PLANET_UPDATE_ACTIVATION_RESULT";
    if (reason === "invalid build") data.buildId = "latest";
    if (reason === "invalid readiness") data.ready = "true";
    env.reply(data, reason === "wrong source" ? new FakeWorker() : env.worker, reason === "wrong origin" ? "https://other.test" : ORIGIN);
    expect(env.service.getSnapshot().update).toBeNull();
    await vi.advanceTimersByTimeAsync(101);
    expect(env.service.getSnapshot()).toMatchObject({ phase: "ready", error: "timeout", update: null });
    expect(env.container.count("message")).toBe(0);
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("ignores readiness from a superseded waiting worker", async () => {
    const env = fixture({ autoStatus: false });
    await settled(env.service);
    const request = latest(env.worker, "PLANET_UPDATE_STATUS");
    env.registration.waiting = new FakeWorker();
    env.reply({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: request.requestId, buildId: BUILD, ready: true });
    await settled(env.service);
    expect(env.service.getSnapshot().update).toBeNull();
    expect(await env.service.activateUpdate()).toEqual({ ok: false, reason: "not-ready" });
  });
  it("does not expose an unverified completed package", async () => {
    const env = fixture({ autoStatus: false });
    await settled(env.service);
    const request = latest(env.worker, "PLANET_UPDATE_STATUS");
    env.reply({ type: "PLANET_UPDATE_STATUS_RESULT", requestId: request.requestId, buildId: BUILD, ready: false });
    await settled(env.service);
    expect(env.service.getSnapshot()).toMatchObject({ phase: "ready", error: "not-ready", update: null });
  });
  it("requests browser update only on checkForUpdate and deduplicates concurrent checks", async () => {
    const env = fixture({ waiting: false });
    await settled(env.service);
    const first = env.service.checkForUpdate();
    const second = env.service.checkForUpdate();
    expect(first).toBe(second);
    expect(await first).toEqual({ ok: true });
    expect(env.registration.update).toHaveBeenCalledOnce();
    expect(env.reload).not.toHaveBeenCalled();
  });
});

describe("explicit update activation", () => {
  it.each(["reply-first", "controller-first"])("reloads once only after accepted exact build and controllerchange (%s)", async (order) => {
    const env = fixture();
    await settled(env.service);
    const activating = env.service.activateUpdate();
    expect(env.service.activateUpdate()).toBe(activating);
    expect(latest(env.worker, "PLANET_ACTIVATE_UPDATE")).toMatchObject({ buildId: BUILD });
    if (order === "reply-first") activateReply(env); else controllerChange(env);
    await Promise.resolve();
    expect(env.reload).not.toHaveBeenCalled();
    if (order === "reply-first") controllerChange(env); else activateReply(env);
    expect(await activating).toEqual({ ok: true });
    expect(env.reload).toHaveBeenCalledOnce();
    expect(env.service.getSnapshot().phase).toBe("reloading");
    env.container.dispatchEvent(new Event("controllerchange"));
    expect(await env.service.activateUpdate()).toEqual({ ok: false, reason: "not-ready" });
    expect(env.reload).toHaveBeenCalledOnce();
    expect(env.container.count("message")).toBe(0);
  });
  it("denies rejected activation even when a controller changes", async () => {
    const env = fixture();
    await settled(env.service);
    const activating = env.service.activateUpdate();
    controllerChange(env);
    activateReply(env, false);
    expect(await activating).toEqual({ ok: false, reason: "rejected" });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it.each(["missing reply", "wrong build", "unrelated controller"])("does not reload for %s", async (reason) => {
    vi.useFakeTimers();
    const env = fixture();
    await settled(env.service);
    const activating = env.service.activateUpdate();
    if (reason === "missing reply") controllerChange(env);
    if (reason === "wrong build") {
      const request = latest(env.worker, "PLANET_ACTIVATE_UPDATE");
      env.reply({ type: "PLANET_UPDATE_ACTIVATION_RESULT", requestId: request.requestId, buildId: "c".repeat(64), accepted: true });
      controllerChange(env);
    }
    if (reason === "unrelated controller") { activateReply(env); controllerChange(env, new FakeWorker()); }
    await vi.advanceTimersByTimeAsync(201);
    expect(await activating).toEqual({ ok: false, reason: "timeout" });
    expect(env.reload).not.toHaveBeenCalled();
    expect(env.container.count("message")).toBe(0);
  });
  it("cancels activation without reloading later or resending the accepted request", async () => {
    const env = fixture();
    await settled(env.service);
    const cancellation = new AbortController();
    const activating = env.service.activateUpdate({ signal: cancellation.signal });
    activateReply(env);
    cancellation.abort();
    expect(await activating).toEqual({ ok: false, reason: "cancelled" });
    controllerChange(env);
    expect(env.reload).not.toHaveBeenCalled();
    expect(env.worker.postMessage.mock.calls.filter(([data]) => data.type === "PLANET_ACTIVATE_UPDATE")).toHaveLength(1);
  });
});

describe("lifecycle disposal and failure", () => {
  it("disposes pending handshakes and all registration/container/installing listeners", async () => {
    const env = fixture({ autoStatus: false });
    await settled(env.service);
    env.registration.installing = env.worker;
    env.worker.state = "installing";
    env.registration.dispatchEvent(new Event("updatefound"));
    expect(env.container.count()).toBeGreaterThan(0);
    env.service.dispose(); env.service.dispose();
    await settled(env.service);
    expect(env.container.count()).toBe(0);
    expect(env.registration.count()).toBe(0);
    expect(env.worker.count()).toBe(0);
    expect(await env.service.checkForUpdate()).toEqual({ ok: false, reason: "disposed" });
    expect(await env.service.activateUpdate()).toEqual({ ok: false, reason: "disposed" });
    expect(env.service.getSnapshot().phase).toBe("disposed");
  });
  it("respects pre-aborted lifecycle and activation signals without mutations", async () => {
    const signal = AbortSignal.abort();
    const cancelled = fixture({ signal });
    expect(await cancelled.service.ready).toBe(false);
    expect(cancelled.container.register).not.toHaveBeenCalled();
    const env = fixture();
    await settled(env.service);
    expect(await env.service.activateUpdate({ signal })).toEqual({ ok: false, reason: "cancelled" });
    expect(env.worker.postMessage.mock.calls.some(([data]) => data.type === "PLANET_ACTIVATE_UPDATE")).toBe(false);
  });
  it("cleans a timed-out browser update and ignores late completion after disposal", async () => {
    vi.useFakeTimers();
    const env = fixture({ waiting: false });
    await settled(env.service);
    let complete!: (registration: ServiceWorkerRegistration) => void;
    env.registration.update.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const checking = env.service.checkForUpdate();
    await vi.advanceTimersByTimeAsync(101);
    expect(await checking).toEqual({ ok: false, reason: "timeout" });
    env.service.dispose();
    complete(env.registration as unknown as ServiceWorkerRegistration);
    await Promise.resolve();
    expect(env.service.getSnapshot().phase).toBe("disposed");
    expect(env.container.count()).toBe(0);
  });
});

async function rollbackFixture() {
  const env = fixture({ waiting: false });
  await settled(env.service);
  controllerChange(env);
  const request = latest(env.worker, "PLANET_ROLLBACK_STATUS");
  env.reply({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: request.requestId, engineBuildId: BUILD, activeBuildId: BUILD, rollbackBuildId: PREVIOUS, ready: true });
  await settled(env.service);
  return env;
}
function rollbackReply(env: ReturnType<typeof fixture>, overrides: Record<string, unknown> = {}) {
  const request = latest(env.worker, "PLANET_ACTIVATE_ROLLBACK");
  env.reply({ type: "PLANET_ROLLBACK_ACTIVATION_RESULT", requestId: request.requestId, engineBuildId: BUILD, activeBuildId: PREVIOUS, targetBuildId: PREVIOUS, accepted: true, ...overrides });
}

function readinessReply(env: ReturnType<typeof fixture>, overrides: Record<string, unknown> = {}, source: unknown = env.worker, origin = ORIGIN) {
  const request = latest(env.worker, "PLANET_OFFLINE_READINESS");
  env.reply({ ...request, type: "PLANET_OFFLINE_READINESS_RESULT", status: "complete", fileCount: 4, bytes: 2048, ...overrides }, source, origin);
}
function repairAccess() {
  let until: number | null = Date.now() + 60_000;
  const listeners = new Set<() => void>();
  return { getDeadline: () => until, subscribe(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; },
    revoke() { until = null; for (const callback of [...listeners]) callback(); }, listeners };
}
function repairReply(env: ReturnType<typeof fixture>, overrides: Record<string, unknown> = {}, source: unknown = env.worker, origin = ORIGIN) {
  env.reply({ ...latest(env.worker, "PLANET_OFFLINE_REPAIR"), type: "PLANET_OFFLINE_REPAIR_RESULT", status: "complete",
    fileCount: 4, bytes: 2048, repairedFiles: 1, repairedBytes: 128, ...overrides }, source, origin);
}
describe("explicit authorized offline repair", () => {
  it("accepts portrait-scale repair counts from the pinned worker without changing byte limits", async () => {
    const env = await rollbackFixture();
    const operation = env.service.repairOfflineBase({ access: repairAccess() });
    repairReply(env, { fileCount: 1339, bytes: 66_500_000, repairedFiles: 1003, repairedBytes: 27_831_946 });
    expect(await operation).toMatchObject({ status: "complete", fileCount: 1339, repairedFiles: 1003 });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("renews only pinned permission challenges from the live capability and preserves lifecycle state", async () => {
    const env = await rollbackFixture(), access = repairAccess(), snapshot = env.service.getSnapshot();
    const operation = env.service.repairOfflineBase({ access });
    const request = latest(env.worker, "PLANET_OFFLINE_REPAIR");
    env.reply({ ...request, type: "PLANET_OFFLINE_REPAIR_PERMISSION_REQUEST", sequence: 1 });
    const permit = latest(env.worker, "PLANET_OFFLINE_REPAIR_PERMISSION");
    expect(permit).toMatchObject({ requestId: request.requestId, engineBuildId: BUILD, activeBuildId: BUILD, sequence: 1 });
    expect(permit.deadline).toBeLessThanOrEqual(Date.now() + 30_000);
    expect(Object.keys(permit).sort()).toEqual(["type", "requestId", "engineBuildId", "activeBuildId", "sequence", "deadline"].sort());
    repairReply(env); expect(await operation).toMatchObject({ status: "complete", repairedFiles: 1 });
    expect(env.service.getSnapshot()).toBe(snapshot); expect(env.reload).not.toHaveBeenCalled(); expect(env.registration.update).not.toHaveBeenCalled();
    expect(access.listeners.size).toBe(0); expect(env.container.count("message")).toBe(0);
  });
  it.each(["missing", "revoked", "throwing"])("never starts with %s access capability", async state => {
    const env = await rollbackFixture(), access = repairAccess();
    if (state === "revoked") access.revoke();
    if (state === "throwing") access.getDeadline = () => { throw new Error("failed"); };
    expect(await env.service.repairOfflineBase({ access: state === "missing" ? null : access })).toEqual({ status: "unavailable", reason: "access-required" });
    expect(latest(env.worker, "PLANET_OFFLINE_REPAIR")).toBeUndefined();
  });
  it.each(["wrong origin", "wrong source", "wrong request", "wrong engine", "wrong active", "extra field", "bad counts"])("rejects %s result until the operation deadline", async reason => {
    vi.useFakeTimers();
    const env = await rollbackFixture();
    const operation = env.service.repairOfflineBase({ access: repairAccess() });
    const patch = reason === "wrong request" ? { requestId: "other" } : reason === "wrong engine" ? { engineBuildId: PREVIOUS }
      : reason === "wrong active" ? { activeBuildId: PREVIOUS } : reason === "extra field" ? { verifiedGrant: true }
      : reason === "bad counts" ? { repairedFiles: 5 } : {};
    repairReply(env, patch, reason === "wrong source" ? new FakeWorker() : env.worker, reason === "wrong origin" ? "https://foreign.invalid" : ORIGIN);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await operation).toEqual({ status: "unavailable", reason: "access-required" });
    expect(latest(env.worker, "PLANET_CANCEL_OFFLINE_REPAIR")).toBeTruthy(); expect(env.container.count("message")).toBe(0);
  });
  it.each(["cancel", "revoke", "expire", "dispose", "controller"])("cancels %s and ignores later successful replies", async action => {
    vi.useFakeTimers();
    const env = await rollbackFixture(), access = repairAccess(), controller = new AbortController();
    const operation = env.service.repairOfflineBase({ access, signal: controller.signal });
    if (action === "cancel") controller.abort();
    if (action === "revoke") access.revoke();
    if (action === "expire") await vi.advanceTimersByTimeAsync(60_001);
    if (action === "dispose") env.service.dispose();
    if (action === "controller") controllerChange(env, new FakeWorker());
    expect(await operation).toEqual({ status: "unavailable", reason: action === "cancel" ? "cancelled" : action === "dispose" ? "disposed" : action === "controller" ? "worker-changed" : "access-required" });
    repairReply(env); expect(latest(env.worker, "PLANET_CANCEL_OFFLINE_REPAIR")).toBeTruthy(); expect(access.listeners.size).toBe(0);
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("bounds actual timeout separately from a still-valid access capability", async () => {
    vi.useFakeTimers();
    const env = fixture({ waiting: false, repairTimeoutMs: 100 }); await settled(env.service); controllerChange(env);
    const probe = latest(env.worker, "PLANET_ROLLBACK_STATUS");
    env.reply({ ...probe, type: "PLANET_ROLLBACK_STATUS_RESULT", engineBuildId: BUILD, activeBuildId: BUILD, rollbackBuildId: null, ready: false });
    await settled(env.service);
    const operation = env.service.repairOfflineBase({ access: repairAccess() });
    await vi.advanceTimersByTimeAsync(101); expect(await operation).toEqual({ status: "unavailable", reason: "timeout" });
    expect(env.container.count("message")).toBe(0);
  });
  it("serializes repair against check, update and rollback without performing them", async () => {
    const env = await rollbackFixture(), access = repairAccess();
    const operation = env.service.repairOfflineBase({ access });
    expect(await env.service.repairOfflineBase({ access })).toEqual({ status: "unavailable", reason: "busy" });
    expect(await env.service.checkOfflineReadiness()).toEqual({ status: "unavailable", reason: "busy" });
    expect(await env.service.activateUpdate()).toEqual({ ok: false, reason: "busy" });
    expect(await env.service.rollback()).toEqual({ ok: false, reason: "busy" });
    repairReply(env); await operation;
  });
  it("returns partial write counts only from an exact incomplete reply", async () => {
    const env = await rollbackFixture(); const operation = env.service.repairOfflineBase({ access: repairAccess() });
    env.reply({ ...latest(env.worker, "PLANET_OFFLINE_REPAIR"), type: "PLANET_OFFLINE_REPAIR_RESULT", status: "incomplete",
      reason: "storage", repairedFiles: 1, repairedBytes: 20 });
    expect(await operation).toEqual({ status: "incomplete", engineBuildId: BUILD, activeBuildId: BUILD, reason: "storage", repairedFiles: 1, repairedBytes: 20 });
  });
});

describe("explicit read-only offline readiness", () => {
  it("accepts portrait-scale readiness counts from the pinned worker", async () => {
    const env = await rollbackFixture();
    const operation = env.service.checkOfflineReadiness();
    readinessReply(env, { fileCount: 1339, bytes: 66_500_000 });
    expect(await operation).toMatchObject({ status: "complete", fileCount: 1339, bytes: 66_500_000 });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("does not infer readiness from discovered generations and only checks on demand without changing snapshots", async () => {
    const env = await rollbackFixture();
    const snapshot = env.service.getSnapshot();
    const changed = vi.fn(); env.service.subscribe(changed);
    expect(latest(env.worker, "PLANET_OFFLINE_READINESS")).toBeUndefined();
    const operation = env.service.checkOfflineReadiness();
    expect(latest(env.worker, "PLANET_OFFLINE_READINESS")).toMatchObject({ engineBuildId: BUILD, activeBuildId: BUILD });
    readinessReply(env);
    const result = await operation;
    expect(result).toEqual({ status: "complete", engineBuildId: BUILD, activeBuildId: BUILD, fileCount: 4, bytes: 2048 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(env.service.getSnapshot()).toBe(snapshot); expect(changed).not.toHaveBeenCalled();
    expect(env.registration.update).not.toHaveBeenCalled(); expect(env.reload).not.toHaveBeenCalled();
    expect(latest(env.worker, "PLANET_ACTIVATE_UPDATE")).toBeUndefined(); expect(latest(env.worker, "PLANET_ACTIVATE_ROLLBACK")).toBeUndefined();
    expect(env.container.count("message")).toBe(0);
  });
  it("returns incomplete without counts and without starting a repair or reload", async () => {
    const env = await rollbackFixture();
    const operation = env.service.checkOfflineReadiness();
    env.reply({ ...latest(env.worker, "PLANET_OFFLINE_READINESS"), type: "PLANET_OFFLINE_READINESS_RESULT", status: "incomplete" });
    expect(await operation).toEqual({ status: "incomplete", engineBuildId: BUILD, activeBuildId: BUILD });
    expect(env.registration.update).not.toHaveBeenCalled(); expect(env.reload).not.toHaveBeenCalled();
  });
  it("pins a selected previous app generation separately from the current worker engine", async () => {
    const env = fixture({ waiting: false }); await settled(env.service); controllerChange(env);
    const request = latest(env.worker, "PLANET_ROLLBACK_STATUS");
    env.reply({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: request.requestId, engineBuildId: BUILD, activeBuildId: PREVIOUS, rollbackBuildId: null, ready: false });
    await settled(env.service);
    const operation = env.service.checkOfflineReadiness();
    expect(latest(env.worker, "PLANET_OFFLINE_READINESS")).toMatchObject({ engineBuildId: BUILD, activeBuildId: PREVIOUS });
    readinessReply(env);
    expect(await operation).toMatchObject({ status: "complete", engineBuildId: BUILD, activeBuildId: PREVIOUS });
  });
  it.each(["wrong origin", "wrong source", "wrong request", "wrong engine", "wrong active", "wrong status", "invalid count", "invalid bytes", "incomplete with counts", "unknown fields"])("rejects a forged or malformed response until the bounded deadline: %s", async reason => {
    vi.useFakeTimers();
    const env = await rollbackFixture(); const operation = env.service.checkOfflineReadiness();
    const overrides: Record<string, unknown> = {};
    if (reason === "wrong request") overrides.requestId = "some-other-check";
    if (reason === "wrong engine") overrides.engineBuildId = PREVIOUS;
    if (reason === "wrong active") overrides.activeBuildId = PREVIOUS;
    if (reason === "wrong status") overrides.status = "ready";
    if (reason === "invalid count") overrides.fileCount = 2049;
    if (reason === "invalid bytes") overrides.bytes = PWA_BOOTSTRAP_MAX_TOTAL_BYTES + 1;
    if (reason === "incomplete with counts") overrides.status = "incomplete";
    if (reason === "unknown fields") overrides.entitled = true;
    readinessReply(env, overrides, reason === "wrong source" ? new FakeWorker() : env.worker, reason === "wrong origin" ? "https://other.test" : ORIGIN);
    await vi.advanceTimersByTimeAsync(101);
    expect(await operation).toEqual({ status: "unavailable", reason: "timeout" });
    expect(latest(env.worker, "PLANET_CANCEL_OFFLINE_READINESS")).toMatchObject({ requestId: latest(env.worker, "PLANET_OFFLINE_READINESS").requestId });
    expect(env.container.count("message")).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(env.reload).not.toHaveBeenCalled();
  });
  it("bounds duplicate requests to one worker scan and releases the slot after completion", async () => {
    const env = await rollbackFixture();
    const first = env.service.checkOfflineReadiness();
    expect(await env.service.checkOfflineReadiness()).toEqual({ status: "unavailable", reason: "busy" });
    expect(env.worker.postMessage.mock.calls.filter(([data]) => data.type === "PLANET_OFFLINE_READINESS")).toHaveLength(1);
    readinessReply(env); await first;
    const next = env.service.checkOfflineReadiness(); readinessReply(env); expect(await next).toMatchObject({ status: "complete" });
  });
  it.each(["abort", "dispose"])("cleans pending listeners and cancels the exact worker scan on %s", async reason => {
    const env = await rollbackFixture(); const cancellation = new AbortController();
    const operation = env.service.checkOfflineReadiness({ signal: cancellation.signal });
    if (reason === "abort") cancellation.abort(); else env.service.dispose();
    expect(await operation).toEqual({ status: "unavailable", reason: reason === "abort" ? "cancelled" : "disposed" });
    expect(latest(env.worker, "PLANET_CANCEL_OFFLINE_READINESS")).toMatchObject({ engineBuildId: BUILD, activeBuildId: BUILD, requestId: latest(env.worker, "PLANET_OFFLINE_READINESS").requestId });
    readinessReply(env); expect(env.container.count("message")).toBe(0); expect(env.reload).not.toHaveBeenCalled();
    if (reason === "abort") {
      const retry = env.service.checkOfflineReadiness(); readinessReply(env); expect(await retry).toMatchObject({ status: "complete" });
    }
  });
  it("does not send a query without a known controller generation or with a pre-aborted signal", async () => {
    const pending = fixture({ waiting: false }); await settled(pending.service);
    expect(await pending.service.checkOfflineReadiness()).toEqual({ status: "unavailable", reason: "not-ready" });
    const env = await rollbackFixture();
    expect(await env.service.checkOfflineReadiness({ signal: AbortSignal.abort() })).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(latest(env.worker, "PLANET_OFFLINE_READINESS")).toBeUndefined();
    env.service.dispose(); expect(await env.service.checkOfflineReadiness()).toEqual({ status: "unavailable", reason: "disposed" });
  });
  it("rejects a complete old response after controller replacement", async () => {
    const env = await rollbackFixture(); const operation = env.service.checkOfflineReadiness();
    const replacement = new FakeWorker(); controllerChange(env, replacement);
    const request = latest(replacement, "PLANET_ROLLBACK_STATUS");
    env.reply({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: request.requestId, engineBuildId: "c".repeat(64), activeBuildId: "c".repeat(64), rollbackBuildId: BUILD, ready: true }, replacement);
    readinessReply(env);
    expect(await operation).toEqual({ status: "unavailable", reason: "worker-changed" });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("rejects a result that overlaps even a rejected rollback attempt", async () => {
    const env = await rollbackFixture(); const operation = env.service.checkOfflineReadiness();
    const rollback = env.service.rollback(); rollbackReply(env, { accepted: false, activeBuildId: BUILD, reason: "multiple-clients" });
    expect(await rollback).toEqual({ ok: false, reason: "multiple-clients" });
    readinessReply(env);
    expect(await operation).toEqual({ status: "unavailable", reason: "worker-changed" });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("returns an explicit worker unavailability without adding it to shared lifecycle state", async () => {
    const env = await rollbackFixture(), snapshot = env.service.getSnapshot();
    const operation = env.service.checkOfflineReadiness();
    env.reply({ ...latest(env.worker, "PLANET_OFFLINE_READINESS"), type: "PLANET_OFFLINE_READINESS_RESULT", status: "unavailable", reason: "busy" });
    expect(await operation).toEqual({ status: "unavailable", reason: "busy" }); expect(env.service.getSnapshot()).toBe(snapshot);
  });
});

describe("explicit whole-generation rollback", () => {
  it("discovers an anchored previous generation without activation or reload", async () => {
    const env = await rollbackFixture();
    expect(env.service.getSnapshot()).toMatchObject({ phase: "ready", rollback: { buildId: PREVIOUS }, activeBuildId: BUILD, engineBuildId: BUILD });
    expect(Object.isFrozen(env.service.getSnapshot().rollback)).toBe(true);
    expect(env.service.getSnapshot()).toBe(env.service.getSnapshot());
    expect(env.worker.postMessage.mock.calls.some(([data]) => data.type === "PLANET_ACTIVATE_ROLLBACK")).toBe(false);
    expect(env.reload).not.toHaveBeenCalled();
    expect(env.container.count("message")).toBe(0);
  });
  it("reloads once on accepted explicit rollback without changing the worker engine", async () => {
    const env = await rollbackFixture();
    const operation = env.service.rollback();
    expect(env.service.rollback()).toBe(operation);
    expect(latest(env.worker, "PLANET_ACTIVATE_ROLLBACK")).toMatchObject({ engineBuildId: BUILD, targetBuildId: PREVIOUS });
    expect(env.service.getSnapshot().phase).toBe("rolling-back");
    expect(env.reload).not.toHaveBeenCalled();
    expect(await env.service.activateUpdate()).toEqual({ ok: false, reason: "busy" });
    rollbackReply(env);
    expect(await operation).toEqual({ ok: true });
    expect(env.reload).toHaveBeenCalledOnce();
    expect(env.container.controller).toBe(env.worker);
    expect(env.service.getSnapshot()).toMatchObject({ phase: "reloading", rollback: null, activeBuildId: PREVIOUS, engineBuildId: BUILD });
    rollbackReply(env);
    expect(await env.service.rollback()).toEqual({ ok: false, reason: "busy" });
    expect(env.reload).toHaveBeenCalledOnce();
    expect(env.container.count("message")).toBe(0);
  });
  it.each(["wrong engine", "wrong target", "wrong active", "wrong origin", "wrong source"])("does not reload for %s", async reason => {
    vi.useFakeTimers();
    const env = await rollbackFixture();
    const operation = env.service.rollback();
    const request = latest(env.worker, "PLANET_ACTIVATE_ROLLBACK");
    const data = { type: "PLANET_ROLLBACK_ACTIVATION_RESULT", requestId: request.requestId, engineBuildId: BUILD, targetBuildId: PREVIOUS, activeBuildId: PREVIOUS, accepted: true };
    if (reason === "wrong engine") data.engineBuildId = "c".repeat(64);
    if (reason === "wrong target") data.targetBuildId = BUILD;
    if (reason === "wrong active") data.activeBuildId = BUILD;
    env.reply(data, reason === "wrong source" ? new FakeWorker() : env.worker, reason === "wrong origin" ? "https://other.test" : ORIGIN);
    await vi.advanceTimersByTimeAsync(101);
    expect(await operation).toEqual({ ok: false, reason: "timeout" });
    expect(env.reload).not.toHaveBeenCalled();
    expect(env.container.count("message")).toBe(0);
  });
  it("reports a multiple-window rejection without switching or reloading", async () => {
    const env = await rollbackFixture();
    const operation = env.service.rollback();
    rollbackReply(env, { accepted: false, activeBuildId: BUILD, reason: "multiple-clients" });
    expect(await operation).toEqual({ ok: false, reason: "multiple-clients" });
    expect(env.service.getSnapshot()).toMatchObject({ activeBuildId: BUILD, rollback: { buildId: PREVIOUS }, error: "multiple-clients" });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it.each(["abort", "dispose", "controller changed"])("does not reload after %s supersedes a pending request", async reason => {
    const env = await rollbackFixture();
    const cancellation = new AbortController();
    const operation = env.service.rollback({ signal: cancellation.signal });
    if (reason === "abort") cancellation.abort();
    if (reason === "dispose") env.service.dispose();
    if (reason === "controller changed") controllerChange(env, new FakeWorker());
    rollbackReply(env);
    expect(await operation).toEqual({ ok: false, reason: reason === "abort" ? "cancelled" : reason === "dispose" ? "disposed" : "worker-changed" });
    expect(env.reload).not.toHaveBeenCalled();
    expect(env.container.count("message")).toBe(0);
  });
  it("rejects a pre-aborted rollback before messaging the worker", async () => {
    const env = await rollbackFixture();
    expect(await env.service.rollback({ signal: AbortSignal.abort() })).toEqual({ ok: false, reason: "cancelled" });
    expect(env.worker.postMessage.mock.calls.some(([data]) => data.type === "PLANET_ACTIVATE_ROLLBACK")).toBe(false);
  });
  it("probes a replacement controller immediately while an older status request is pending", async () => {
    const env = fixture({ waiting: false });
    await settled(env.service);
    controllerChange(env);
    const oldRequest = latest(env.worker, "PLANET_ROLLBACK_STATUS");
    const replacement = new FakeWorker();
    controllerChange(env, replacement);
    const nextRequest = latest(replacement, "PLANET_ROLLBACK_STATUS");
    expect(nextRequest).toBeDefined();
    env.reply({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: nextRequest.requestId, engineBuildId: "c".repeat(64), activeBuildId: "c".repeat(64), rollbackBuildId: BUILD, ready: true }, replacement);
    env.reply({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: oldRequest.requestId, engineBuildId: BUILD, activeBuildId: BUILD, rollbackBuildId: PREVIOUS, ready: true });
    await settled(env.service);
    expect(env.service.getSnapshot()).toMatchObject({ engineBuildId: "c".repeat(64), rollback: { buildId: BUILD } });
    expect(env.reload).not.toHaveBeenCalled();
  });
  it("keeps restored generation status after a fresh page lifecycle without offering a second rollback", async () => {
    const env = fixture({ waiting: false });
    await settled(env.service);
    controllerChange(env);
    const request = latest(env.worker, "PLANET_ROLLBACK_STATUS");
    env.reply({ type: "PLANET_ROLLBACK_STATUS_RESULT", requestId: request.requestId, engineBuildId: BUILD, activeBuildId: PREVIOUS, rollbackBuildId: null, ready: false });
    await settled(env.service);
    expect(env.service.getSnapshot()).toMatchObject({ activeBuildId: PREVIOUS, engineBuildId: BUILD, rollback: null });
    expect(await env.service.rollback()).toEqual({ ok: false, reason: "not-ready" });
  });
});
