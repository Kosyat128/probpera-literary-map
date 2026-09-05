import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPwaWorker, type PwaWorkerController, type PwaWorkerOptions } from "./registerPwaWorker";

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
