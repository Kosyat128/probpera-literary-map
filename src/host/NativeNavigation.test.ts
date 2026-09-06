import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNativeBackBroker, createNativeNavigationIntake, parseNativeNavigationUrl,
  type NativeNavigationOptions, type NativeNavigationOutcome, type NativeNavigationSource,
  type NativeNavigationListenerHandle, type NativeNavigationResolution, type NativeBackActionResult,
} from "./NativeNavigation";

const ru = "https://probpera.ru/ru/?country=russia&writer=dostoevsky#atlas";
const en = "https://probpera.ru/en/?country=russia&writer=chekhov#atlas";
const ready = { bootstrap: "ready", policy: "allowed" } as const;
const cleanup: Array<() => void> = [];
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
function fixture(overrides: Partial<NativeNavigationOptions<string>> = {}) {
  const outcomes: NativeNavigationOutcome[] = [];
  // This injected resolver is a lifecycle fixture, not catalog/publication approval evidence.
  const resolve = vi.fn(async (intent: NonNullable<ReturnType<typeof parseNativeNavigationUrl>>) => ({ status: "ready", value: intent.canonicalUrl }) as const);
  const apply = vi.fn<NativeNavigationOptions<string>["apply"]>(() => "applied");
  const controller = createNativeNavigationIntake({ resolve, apply, onOutcome: value => { outcomes.push(value); }, ...overrides });
  cleanup.push(() => controller.dispose());
  return { controller, resolve, apply, outcomes, statuses: () => outcomes.map(item => item.status) };
}
function sourceFixture() {
  let listener: ((url: string) => void) | undefined;
  const launch = deferred<{ url: string } | undefined>();
  const remove = vi.fn();
  const source: NativeNavigationSource = {
    subscribeUrl: vi.fn(callback => { listener = callback; return { remove }; }),
    getLaunchUrl: vi.fn(() => launch.promise),
  };
  return { source, launch, remove, send: (url: string) => listener?.(url) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const stop of cleanup.splice(0)) stop(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("native incoming URL boundary", () => {
  it("reuses canonical atlas/work schemas and keeps a locale-only intent partial and immutable", () => {
    const intent = parseNativeNavigationUrl("https://probpera.ru/planet/en/?writer=dostoevsky&country=russia&book=russia%3Adostoevsky%3Acrime-and-punishment#books")!;
    expect(intent.language).toBe("en"); expect(intent.bookKey).toBe("russia:dostoevsky:crime-and-punishment");
    expect(intent.atlas).toEqual({ countryId: "russia", writerId: "dostoevsky" });
    expect(Object.isFrozen(intent) && Object.isFrozen(intent.atlas)).toBe(true);
    expect(parseNativeNavigationUrl("https://probpera.ru/ru/")).toEqual({ canonicalUrl: "https://probpera.ru/ru/", language: "ru", atlas: {} });
  });
  it.each(["/", "/ru/", "/en/", "/planet/", "/planet/ru/", "/planet/en/"])("accepts only explicit known entry %s", path => {
    expect(parseNativeNavigationUrl("https://probpera.ru" + path + "?atlas=verified&atlasView=immersive#atlas")?.atlas).toEqual({ filter: "verified", view: "immersive" });
  });
  it("retains explicit embedded/all and normalized local shelf without implying access", () => {
    expect(parseNativeNavigationUrl("https://probpera.ru/?atlas=all&atlasView=embedded&archiveShelf=manual%3Aclassics#books")).toMatchObject({ atlas: { filter: "all", view: "embedded" }, shelfId: "manual:classics" });
  });
  it.each([
    null, {}, "", "/ru/", "http://probpera.ru/", "https://example.test/", "https://probpera.ru.evil.test/",
    "https://probpera.ru:443/", "https://probpera.ru:8443/", "https://reader@probpera.ru/", "https://reader:pass@probpera.ru/",
    "https://probpera.ru./", "https://probpera.ru\\@evil.test/", "https://probpera.ru", "https://probpera.ru/admin/",
    "https://probpera.ru/planet/admin/", "https://probpera.ru/planet/account/", "https://probpera.ru/stati/books/example/",
    "https://probpera.ru/../en/", "https://probpera.ru/%2e%2e/en/", "https://probpera.ru/%65n/", "https://probpera.ru/planet//en/",
    "javascript:alert(1)", "capacitor://localhost/", "ru.probpera.literaryplanet://writer/a", "https://probpera.ru/\n",
    "https://probpera.ru/?country=%", "https://probpera.ru/?country=%c3%28", "https://probpera.ru/?country=%00russia",
    "https://probpera.ru/?country=%E2%80%AErussia", "https://probpera.ru/?country=ru+ssia", "https://probpera.ru/?country=",
    "https://probpera.ru/?country=russia&country=france", "https://probpera.ru/?country=russia&%63ountry=france",
    "https://probpera.ru/?writer=dostoevsky", "https://probpera.ru/?atlas=unknown", "https://probpera.ru/?atlasView=unknown",
    "https://probpera.ru/?book=a:b", "https://probpera.ru/?book=a:b:c&book=a:b:d", "https://probpera.ru/?archiveShelf=x&archiveShelf=y",
    "https://probpera.ru/?book=a:b:c&country=russia", "https://probpera.ru/?book=russia:a:b&country=russia&writer=dostoevsky",
    "https://probpera.ru/?access_token=private", "https://probpera.ru/?returnTo=https://evil.test/", "https://probpera.ru/?__proto__=x",
    "https://probpera.ru/#atlas?access_token=x", "https://probpera.ru/#%61tlas", "https://probpera.ru/#account",
    "https://probpera.ru/?country=" + "a".repeat(161), "https://probpera.ru/?country=" + "a".repeat(4096),
  ])("rejects unsupported/untrusted address %j", raw => { expect(parseNativeNavigationUrl(raw)).toBeNull(); });
});

describe("native intake lifecycle", () => {
  it("does no source IO before explicit start and refuses pre-start input", () => {
    const source = sourceFixture(), f = fixture({ source: source.source });
    expect(f.controller.receiveUrl(ru).status).toBe("not-started");
    expect(source.source.getLaunchUrl).not.toHaveBeenCalled(); expect(source.source.subscribeUrl).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    f.controller.start(); f.controller.start();
    expect(source.source.subscribeUrl).toHaveBeenCalledOnce(); expect(source.source.getLaunchUrl).toHaveBeenCalledOnce();
  });
  it("keeps only latest intent until bootstrap AND policy permit application", async () => {
    const f = fixture(); f.controller.start(); f.controller.receiveUrl(ru); f.controller.receiveUrl(en);
    await flush(); expect(f.resolve).not.toHaveBeenCalled(); expect(f.statuses()).toContain("superseded");
    f.controller.setReadiness({ bootstrap: "ready", policy: "unknown" }); await flush(); expect(f.apply).not.toHaveBeenCalled();
    f.controller.setReadiness(ready); await flush();
    expect(f.apply).toHaveBeenCalledOnce(); expect(f.apply.mock.calls[0][0]).toBe(en);
    expect(f.resolve.mock.calls[0][0].language).toBe("en"); expect(f.statuses()).toContain("applied"); expect(vi.getTimerCount()).toBe(0);
  });
  it("deduplicates equivalent queued requests but permits a deliberate same-address revisit after consumption", async () => {
    const f = fixture(); f.controller.start(); f.controller.receiveUrl(ru);
    expect(f.controller.receiveUrl("https://probpera.ru/ru/?writer=dostoevsky&country=russia#atlas").status).toBe("duplicate");
    f.controller.setReadiness(ready); await flush(); f.controller.receiveUrl(ru); await flush(); expect(f.apply).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid input without invoking the resolver or losing a pending valid instruction", async () => {
    const f = fixture(); f.controller.start(); f.controller.receiveUrl(ru); f.controller.receiveUrl("https://evil.test/");
    f.controller.setReadiness(ready); await flush(); expect(f.resolve).toHaveBeenCalledOnce(); expect(f.resolve.mock.calls[0][0].language).toBe("ru");
  });
  it("suppresses late cold launch after a warm event", async () => {
    const source = sourceFixture(), f = fixture({ source: source.source }); f.controller.start(); f.controller.setReadiness(ready);
    source.send(en); await flush(); source.launch.resolve({ url: ru }); await flush();
    expect(f.apply).toHaveBeenCalledOnce(); expect(f.resolve.mock.calls[0][0].language).toBe("en"); expect(f.statuses()).toContain("launch-superseded");
  });
  it("also prioritizes the retained warm event delivered synchronously during subscription", async () => {
    const source: NativeNavigationSource = { subscribeUrl: callback => { callback(en); return { remove() {} }; }, getLaunchUrl: async () => ({ url: ru }) };
    const f = fixture({ source }); f.controller.start(); f.controller.setReadiness(ready); await flush();
    expect(f.resolve).toHaveBeenCalledOnce(); expect(f.resolve.mock.calls[0][0].language).toBe("en"); expect(f.statuses()).toContain("launch-superseded");
  });
  it("late cold lookup cannot undo a newer ordinary UI action", async () => {
    const source = sourceFixture(), f = fixture({ source: source.source }); f.controller.start(); f.controller.setReadiness(ready);
    f.controller.cancelPending(); source.launch.resolve({ url: ru }); await flush(); expect(f.apply).not.toHaveBeenCalled();
  });
  it("aborts old asynchronous resolution and ignores its late success after a new intent", async () => {
    const old = deferred<NativeNavigationResolution<string>>();
    const resolver = vi.fn<NativeNavigationOptions<string>["resolve"]>().mockReturnValueOnce(old.promise).mockResolvedValue({ status: "ready", value: "new" });
    const f = fixture({ resolve: resolver }); f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru); f.controller.receiveUrl(en);
    expect(resolver.mock.calls[0][1].signal.aborted).toBe(true); await flush(); old.resolve({ status: "ready", value: "old" }); await flush();
    expect(f.apply).toHaveBeenCalledOnce(); expect(f.apply).toHaveBeenCalledWith("new", expect.objectContaining({ language: "en" }), expect.any(Object));
  });
  it("policy becoming unknown aborts current resolution; a fresh allowed resolution is required", async () => {
    const old = deferred<NativeNavigationResolution<string>>();
    const resolver = vi.fn<NativeNavigationOptions<string>["resolve"]>().mockReturnValueOnce(old.promise).mockResolvedValue({ status: "ready", value: "fresh" });
    const f = fixture({ resolve: resolver }); f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru);
    f.controller.setReadiness({ bootstrap: "ready", policy: "unknown" }); old.resolve({ status: "ready", value: "old" }); await flush(); expect(f.apply).not.toHaveBeenCalled();
    f.controller.setReadiness(ready); await flush(); expect(f.apply).toHaveBeenCalledWith("fresh", expect.any(Object), expect.any(Object));
  });
  it.each(["denied", "failed"] as const)("drops queued work permanently on %s readiness", async value => {
    const f = fixture(); f.controller.start(); f.controller.receiveUrl(ru);
    f.controller.setReadiness(value === "denied" ? { bootstrap: "ready", policy: "denied" } : { bootstrap: "failed", policy: "allowed" });
    expect(f.controller.receiveUrl(en).status).toBe(value === "denied" ? "denied" : "unavailable");
    f.controller.setReadiness(ready); await flush(); expect(f.apply).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("expires unresolved bootstrap intent and never replays it after readiness", async () => {
    const f = fixture({ queueTimeoutMs: 20 }); f.controller.start(); f.controller.receiveUrl(ru);
    await vi.advanceTimersByTimeAsync(20); f.controller.setReadiness(ready); await flush(); expect(f.statuses()).toContain("expired"); expect(f.apply).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("times out and aborts a resolver, observing late rejection without application", async () => {
    const pending = deferred<NativeNavigationResolution<string>>(); const resolver = vi.fn<NativeNavigationOptions<string>["resolve"]>(() => pending.promise);
    const f = fixture({ resolve: resolver, resolutionTimeoutMs: 20 }); f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru);
    await vi.advanceTimersByTimeAsync(20); expect(resolver.mock.calls[0][1].signal.aborted).toBe(true); pending.reject(new Error("private payload")); await flush();
    expect(f.statuses()).toContain("resolution-timeout"); expect(f.apply).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["missing", "denied", "unavailable"] as const)("honors injected canonical resolver %s without calling apply", async status => {
    const f = fixture({ resolve: async () => ({ status }) }); f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru); await flush();
    expect(f.statuses()).toContain(status); expect(f.apply).not.toHaveBeenCalled();
  });
  it.each(["throw", "reject", "malformed"] as const)("handles resolver %s truthfully and omits private error data", async mode => {
    const f = fixture({ resolve: () => { if (mode === "throw") throw new Error("secret URL"); return mode === "reject" ? Promise.reject(new Error("secret URL")) : Promise.resolve({ status: "invented" } as unknown as NativeNavigationResolution<string>); } });
    f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru); await flush(); expect(f.statuses()).toContain("resolution-failed"); expect(JSON.stringify(f.outcomes)).not.toContain("secret");
  });
  it.each(["declined", "throw", "async"] as const)("records apply %s without false success", async mode => {
    const apply = (() => { if (mode === "throw") throw new Error("private"); return mode === "async" ? Promise.reject(new Error("private")) : "declined"; }) as NativeNavigationOptions<string>["apply"];
    const f = fixture({ apply }); f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru); await flush(); expect(f.statuses()).toContain(mode === "declined" ? "declined" : "apply-failed"); expect(f.statuses()).not.toContain("applied");
  });
  it("contains diagnostic throws/rejections without interrupting real application", async () => {
    const f = fixture({ onOutcome: () => Promise.reject(new Error("diagnostic")) }); f.controller.start(); f.controller.setReadiness(ready); f.controller.receiveUrl(ru); await flush(); expect(f.apply).toHaveBeenCalledOnce();
  });
  it("bounds source promises, ignores late launch and removes late listener handle exactly once", async () => {
    const handle = deferred<NativeNavigationListenerHandle>(), launch = deferred<{ url: string }>(); const remove = vi.fn();
    let emit: ((url: string) => void) | undefined;
    const f = fixture({ source: { subscribeUrl: callback => { emit = callback; return handle.promise; }, getLaunchUrl: () => launch.promise }, sourceTimeoutMs: 10 });
    f.controller.start(); f.controller.setReadiness(ready); await vi.advanceTimersByTimeAsync(10);
    emit?.(ru); handle.resolve({ remove }); launch.resolve({ url: en }); await flush(); f.controller.dispose(); f.controller.dispose();
    expect(remove).toHaveBeenCalledOnce(); expect(f.apply).not.toHaveBeenCalled(); expect(f.statuses()).toEqual(expect.arrayContaining(["listener-timeout", "launch-timeout"])); expect(vi.getTimerCount()).toBe(0);
  });
  it("disposal removes real handles and invalidates callbacks, pending resolution and launch", async () => {
    const source = sourceFixture(), pending = deferred<NativeNavigationResolution<string>>(); const f = fixture({ source: source.source, resolve: () => pending.promise });
    f.controller.start(); f.controller.setReadiness(ready); source.send(ru); await flush(); f.controller.dispose(); f.controller.dispose();
    source.send(en); pending.resolve({ status: "ready", value: "late" }); source.launch.resolve({ url: en }); await flush();
    expect(f.apply).not.toHaveBeenCalled(); expect(source.remove).toHaveBeenCalledOnce(); expect(f.controller.receiveUrl(ru).status).toBe("disposed"); expect(vi.getTimerCount()).toBe(0);
  });
  it("a replacement StrictMode lifetime never receives the disposed lifetime's late native handle/event", async () => {
    const late = deferred<NativeNavigationListenerHandle>(); let oldEvent: ((url: string) => void) | undefined; const remove = vi.fn();
    const first = fixture({ source: { subscribeUrl: callback => { oldEvent = callback; return late.promise; }, getLaunchUrl: async () => undefined } }); first.controller.start(); first.controller.dispose();
    const second = fixture(); second.controller.start(); second.controller.setReadiness(ready); second.controller.receiveUrl(en);
    oldEvent?.(ru); late.resolve({ remove }); await flush(); expect(first.apply).not.toHaveBeenCalled(); expect(second.apply).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
  });
  it.each(["throw", "reject", "malformed"] as const)("reports failed source %s independently and still accepts explicit local intake", async mode => {
    const source = { subscribeUrl: () => { if (mode === "throw") throw new Error("private"); return mode === "reject" ? Promise.reject(new Error("private")) : undefined; }, getLaunchUrl: () => { if (mode === "throw") throw new Error("private"); return mode === "reject" ? Promise.reject(new Error("private")) : Promise.resolve({ nope: true }); } } as unknown as NativeNavigationSource;
    const f = fixture({ source }); f.controller.start(); f.controller.setReadiness(ready); await flush(); f.controller.receiveUrl(ru); await flush();
    expect(f.statuses()).toEqual(expect.arrayContaining(["listener-unavailable", "launch-unavailable", "applied"])); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 30001])("rejects invalid timeout %s before native IO", value => {
    expect(() => fixture({ sourceTimeoutMs: value })).toThrow(); expect(() => fixture({ queueTimeoutMs: value })).toThrow(); expect(() => fixture({ resolutionTimeoutMs: value })).toThrow();
  });
  it("does not begin launch IO if a retained synchronous event disposes the intake", async () => {
    const remove = vi.fn(), getLaunchUrl = vi.fn(async () => undefined);
    const controller = createNativeNavigationIntake<string>({
      source: { subscribeUrl: callback => { callback(ru); return { remove }; }, getLaunchUrl },
      resolve: async () => ({ status: "missing" }), apply: () => "applied",
      onOutcome: outcome => { if (outcome.status === "queued") controller.dispose(); },
    });
    controller.start(); await flush(); expect(getLaunchUrl).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["throw", "reject"] as const)("observes listener removal %s without leaking source callbacks", async mode => {
    const source = sourceFixture(); source.remove.mockImplementation(() => { if (mode === "throw") throw new Error("private cleanup"); return Promise.reject(new Error("private cleanup")); });
    const f = fixture({ source: source.source }); f.controller.start(); await flush(); f.controller.dispose(); source.send(ru); source.launch.reject(new Error("late source")); await flush();
    expect(f.statuses()).toContain("listener-cleanup-failed"); expect(f.apply).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("invalid policy values cannot permit navigation", async () => {
    const f = fixture(); f.controller.start(); f.controller.receiveUrl(ru);
    expect(() => f.controller.setReadiness({ bootstrap: "ready", policy: true } as unknown as Parameters<typeof f.controller.setReadiness>[0])).toThrow();
    await flush(); expect(f.apply).not.toHaveBeenCalled();
  });
  it("a synchronously reentrant new intent from apply is not cleared by completing the old intent", async () => {
    let controller: ReturnType<typeof createNativeNavigationIntake<string>>;
    const seen: string[] = [];
    const f = fixture({ apply: (_value, intent) => { seen.push(intent.language!); if (intent.language === "ru") controller.receiveUrl(en); return "applied"; } });
    controller = f.controller; controller.start(); controller.setReadiness(ready); controller.receiveUrl(ru); await flush();
    expect(seen).toEqual(["ru", "en"]); expect(vi.getTimerCount()).toBe(0);
  });
});

describe("native Back action broker", () => {
  it("closes highest active layer before lower UI, history or root", async () => {
    const calls: string[] = [], history = { canGoBack: vi.fn(() => true), goBack: vi.fn() }, root = vi.fn(() => "handled" as const);
    const broker = createNativeBackBroker({ history, root }); cleanup.push(broker.dispose);
    broker.register({ id: "immersion", priority: 10, handle: () => { calls.push("immersion"); return "handled"; } });
    const remove = broker.register({ id: "search", priority: 20, handle: () => { calls.push("search"); return "handled"; } });
    expect(await broker.requestBack()).toBe("handled"); expect(calls).toEqual(["search"]); expect(history.canGoBack).not.toHaveBeenCalled(); expect(root).not.toHaveBeenCalled();
    remove(); expect(await broker.requestBack()).toBe("handled"); expect(calls).toEqual(["search", "immersion"]);
  });
  it("uses reverse registration for ties and skips explicitly unhandled callbacks", async () => {
    const calls: string[] = [], broker = createNativeBackBroker(); cleanup.push(broker.dispose);
    broker.register({ id: "older", priority: 5, handle: () => { calls.push("older"); return "handled"; } });
    broker.register({ id: "newer", priority: 5, handle: () => { calls.push("newer"); return "unhandled"; } });
    expect(await broker.requestBack()).toBe("handled"); expect(calls).toEqual(["newer", "older"]);
  });
  it("consumes repeated Back while the existing animation/close callback is pending", async () => {
    const pending = deferred<NativeBackActionResult>(), handle = vi.fn(() => pending.promise); const broker = createNativeBackBroker(); cleanup.push(broker.dispose);
    broker.register({ id: "book", priority: 50, handle }); const first = broker.requestBack(); await flush();
    expect(await broker.requestBack()).toBe("pending"); expect(handle).toHaveBeenCalledOnce(); pending.resolve("handled"); expect(await first).toBe("handled"); expect(vi.getTimerCount()).toBe(0);
  });
  it("uses injected own history before explicit root fallback and has no default exit", async () => {
    const history = { canGoBack: vi.fn(() => true), goBack: vi.fn() }, root = vi.fn(() => "handled" as const);
    const broker = createNativeBackBroker({ history, root }); cleanup.push(broker.dispose);
    expect(await broker.requestBack()).toBe("history"); expect(history.goBack).toHaveBeenCalledOnce(); expect(root).not.toHaveBeenCalled();
    history.canGoBack.mockReturnValue(false); expect(await broker.requestBack()).toBe("root"); expect(root).toHaveBeenCalledOnce();
    const empty = createNativeBackBroker(); expect(await empty.requestBack()).toBe("unhandled"); empty.dispose();
  });
  it("cancels a removed pending handler without falling through to history/root", async () => {
    const pending = deferred<NativeBackActionResult>(), root = vi.fn(() => "handled" as const); const broker = createNativeBackBroker({ root }); cleanup.push(broker.dispose);
    const remove = broker.register({ id: "book", priority: 20, handle: () => pending.promise }); const operation = broker.requestBack(); await flush(); remove(); remove();
    expect(await operation).toBe("cancelled"); pending.resolve("unhandled"); await flush(); expect(root).not.toHaveBeenCalled();
  });
  it("a newly opened higher layer fences an older asynchronous Back", async () => {
    const pending = deferred<NativeBackActionResult>(), root = vi.fn(() => "handled" as const); const broker = createNativeBackBroker({ root }); cleanup.push(broker.dispose);
    broker.register({ id: "book", priority: 20, handle: () => pending.promise }); const operation = broker.requestBack(); await flush();
    broker.register({ id: "dialog", priority: 50, handle: () => "handled" }); expect(await operation).toBe("cancelled"); pending.resolve("unhandled"); await flush(); expect(root).not.toHaveBeenCalled(); expect(await broker.requestBack()).toBe("handled");
  });
  it("does not fall through on handler timeout; aborts its context and observes late rejection", async () => {
    const pending = deferred<NativeBackActionResult>(), root = vi.fn(() => "handled" as const); const broker = createNativeBackBroker({ root, timeoutMs: 10 }); cleanup.push(broker.dispose);
    let signal: AbortSignal | undefined; broker.register({ id: "book", priority: 20, handle: context => { signal = context.signal; return pending.promise; } });
    const operation = broker.requestBack(); await vi.advanceTimersByTimeAsync(10); expect(await operation).toBe("timeout"); expect(signal?.aborted).toBe(true);
    pending.reject(new Error("private")); await flush(); expect(root).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["throw", "reject", "malformed"] as const)("fails closed on UI callback %s", async mode => {
    const root = vi.fn(() => "handled" as const), broker = createNativeBackBroker({ root }); cleanup.push(broker.dispose);
    broker.register({ id: "dialog", priority: 10, handle: () => { if (mode === "throw") throw new Error("private"); return mode === "reject" ? Promise.reject(new Error("private")) : undefined as unknown as NativeBackActionResult; } });
    expect(await broker.requestBack()).toBe("failed"); expect(root).not.toHaveBeenCalled();
  });
  it("does not call history after a reentrant disposal in canGoBack", async () => {
    const goBack = vi.fn(); const broker = createNativeBackBroker({ history: { canGoBack: () => { broker.dispose(); return true; }, goBack } });
    expect(await broker.requestBack()).toBe("disposed"); expect(goBack).not.toHaveBeenCalled();
  });
  it("does not report failed history as a successful root action", async () => {
    const root = vi.fn(() => "handled" as const); const broker = createNativeBackBroker({ root, history: { canGoBack: () => true, goBack: async () => { throw new Error("history error"); } } }); cleanup.push(broker.dispose);
    expect(await broker.requestBack()).toBe("failed"); expect(root).not.toHaveBeenCalled();
  });
  it("disposes active Back and never touches root on late completion", async () => {
    const pending = deferred<NativeBackActionResult>(), root = vi.fn(() => "handled" as const), broker = createNativeBackBroker({ root });
    broker.register({ id: "panel", priority: 5, handle: () => pending.promise }); const operation = broker.requestBack(); await flush(); broker.dispose(); broker.dispose();
    expect(await operation).toBe("disposed"); pending.resolve("unhandled"); await flush(); expect(root).not.toHaveBeenCalled(); expect(await broker.requestBack()).toBe("disposed"); expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects duplicate/invalid registrations and allows reuse only after exact cleanup", () => {
    const broker = createNativeBackBroker(); cleanup.push(broker.dispose); const action = { id: "panel", priority: 5, handle: () => "handled" as const }; const remove = broker.register(action);
    expect(() => broker.register(action)).toThrow(); remove(); const removeNew = broker.register(action); remove(); expect(() => broker.register(action)).toThrow(); removeNew();
    expect(() => broker.register({ ...action, priority: NaN })).toThrow(); expect(() => broker.register({ ...action, id: "" })).toThrow();
  });
  it("observes an accidentally asynchronous history predicate and does not traverse", async () => {
    const goBack = vi.fn(), broker = createNativeBackBroker({ history: { canGoBack: (() => Promise.reject(new Error("private"))) as unknown as () => boolean, goBack } }); cleanup.push(broker.dispose);
    expect(await broker.requestBack()).toBe("failed"); await flush(); expect(goBack).not.toHaveBeenCalled();
  });
  it("bounds a pending history operation without invoking root afterwards", async () => {
    const pending = deferred<void>(), root = vi.fn(() => "handled" as const), broker = createNativeBackBroker({ timeoutMs: 10, root, history: { canGoBack: () => true, goBack: () => pending.promise } }); cleanup.push(broker.dispose);
    const operation = broker.requestBack(); await vi.advanceTimersByTimeAsync(10); expect(await operation).toBe("timeout"); pending.resolve(); await flush(); expect(root).not.toHaveBeenCalled();
  });
});
