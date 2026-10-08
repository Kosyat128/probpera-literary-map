import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, decodeChildNativeAppReply, CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
  CHILD_NATIVE_LOCAL_POLICY_VERSION, type ChildNativeAppController, type ChildNativeContext } from "./childNativeAppBridge";
import type { PlatformSnapshot } from "../platform/ports";

// AUTHORED_NOT_RUN: correlated DTO fixtures test refusal/presentation mechanics.
// They cannot supply a native Gate, secure storage, package, or OS admission.
const REQUEST = "c".repeat(32), HASH = "a".repeat(64);
const owners: ChildNativeAppController[] = [];
function context(generation = 1, admitted = true): ChildNativeContext {
  return { token: generation.toString(16).padStart(32, "0"), generation, revision: generation + 1,
    selectionRevision: generation + 1, profileRevision: generation + 1,
    policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION, policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
    mode: "child", profileId: "reader", locale: "en", remainingLifetimeMs: 50_000,
    package: admitted ? { id: "package", version: 1, checksum: HASH } : null,
    home: admitted ? { kind: "activity", id: "home", contentChecksum: HASH } : null };
}
function reply(request: unknown, c = context(), locked: unknown = undefined, reason: string | null = null) {
  return { version: 2, requestId: (request as { requestId: string }).requestId,
    status: c.package ? "child" : "blocked-child", reason, context: c,
    profiles: [{ id: c.profileId, label: "Synthetic reader", exactAge: 9, locale: c.locale,
      ...(locked === undefined ? {} : { localeLocked: locked }) }] };
}
function fixture(initialLock: boolean | undefined, admitted = true) {
  let serial = 0, native = context(1, admitted), locked = initialLock;
  let platform: PlatformSnapshot = Object.freeze({ connectivity: "online", visibility: "active" });
  const listeners = new Set<() => void>();
  const plugin = {
    bootstrap: vi.fn(async (r: unknown): Promise<unknown> => reply(r, native, locked)),
    readContext: vi.fn(async (r: unknown): Promise<unknown> => reply(r, native, locked)),
    perform: vi.fn(async (r: unknown): Promise<unknown> => {
      native = context(native.generation + 1, admitted);
      locked = (r as { target: { changes: { localeLocked: boolean } } }).target.changes.localeLocked;
      return reply(r, native, locked);
    }),
    retire: vi.fn(async (r: unknown) => { const q = r as { requestId: string; contextToken: string | null };
      return { version: 2, requestId: q.requestId, status: "retired", contextToken: q.contextToken }; }),
    addListener: vi.fn(async () => ({ remove: async () => undefined })),
  };
  const controller = createChildNativeAppController({ plugin,
    lifecycle: { getSnapshot: () => platform, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } },
    nowMs: () => Date.now(), timeoutMs: 1_000, requestId: () => (++serial).toString(16).padStart(32, "0") });
  owners.push(controller); const clear = vi.fn(); controller.attachPresentationBarrier(clear);
  return { controller, plugin, clear,
    replace(c: ChildNativeContext) { native = c; },
    hide() { platform = Object.freeze({ connectivity: "online", visibility: "background" }); for (const listener of listeners) listener(); } };
}
async function settle() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(async () => { for (const owner of owners.splice(0)) await owner.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("S16 BIL009 parent language lock", () => {
  it("decodes strict true and false while legacy absence remains unknown", () => {
    for (const locked of [true, false]) expect(decodeChildNativeAppReply(reply({ requestId: REQUEST }, context(), locked), REQUEST)?.profiles[0].localeLocked).toBe(locked);
    const legacy = decodeChildNativeAppReply(reply({ requestId: REQUEST }), REQUEST)!;
    expect(legacy.profiles[0]).not.toHaveProperty("localeLocked"); expect(Object.isFrozen(legacy.profiles[0])).toBe(true);
  });
  it("rejects numeric string null undefined-own and accessor lock values without reading getters", () => {
    for (const locked of [1, 0, "true", "false", null]) expect(decodeChildNativeAppReply(reply({ requestId: REQUEST }, context(), locked), REQUEST)).toBeNull();
    const own = reply({ requestId: REQUEST }); Object.assign(own.profiles[0], { localeLocked: undefined });
    expect(decodeChildNativeAppReply(own, REQUEST)).toBeNull();
    const accessor = reply({ requestId: REQUEST }), getter = vi.fn(() => false);
    Object.defineProperty(accessor.profiles[0], "localeLocked", { enumerable: true, get: getter });
    expect(decodeChildNativeAppReply(accessor, REQUEST)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("rejects hostile proxy reflection traps without reading profile getters", () => {
    for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"] as const) {
      const envelope = reply({ requestId: REQUEST }), profile = envelope.profiles[0];
      const getter = vi.fn(() => { throw new Error("Profile getter must not run"); });
      Object.defineProperty(profile, "localeLocked", { enumerable: true, get: getter });
      const refused = vi.fn(() => { throw new Error("Hostile reflection trap"); });
      const handler: ProxyHandler<typeof profile> = trap === "getPrototypeOf" ? { getPrototypeOf: refused }
        : trap === "ownKeys" ? { ownKeys: refused } : { getOwnPropertyDescriptor: refused };
      envelope.profiles[0] = new Proxy(profile, handler);
      expect(decodeChildNativeAppReply(envelope, REQUEST)).toBeNull();
      expect(refused).toHaveBeenCalled(); expect(getter).not.toHaveBeenCalled();
    }
  });
  it.each([true, false])("proposes strict %s only through the original settings action and confirms native successor", async locked => {
    const f = fixture(!locked); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    expect(await f.controller.setProfileLocaleLocked!(c, locked)).toBe(true);
    expect(f.plugin.perform).toHaveBeenCalledOnce(); expect(f.plugin.perform.mock.calls[0][0]).toEqual({
      version: 2, requestId: "2".padStart(32, "0"), contextToken: c.token,
      action: "expand-access-settings", target: { profileId: "reader", changes: { localeLocked: locked } } });
    expect(f.controller.getSnapshot()).toMatchObject({ context: { locale: "en", profileRevision: 3 }, profiles: [{ localeLocked: locked }] });
    expect(f.clear).toHaveBeenCalled();
  });
  it("keeps the existing parent locale action available while language is locked", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    f.plugin.perform.mockImplementation(async r => reply(r, { ...context(2), locale: "ru" }, true));
    expect(await f.controller.perform("expand-access-settings", { profileId: "reader", changes: { locale: "ru" } })).toBe(true);
    expect(f.plugin.perform.mock.calls[0][0]).toMatchObject({ contextToken: c.token, action: "expand-access-settings", target: { profileId: "reader", changes: { locale: "ru" } } });
    expect(f.controller.getSnapshot()).toMatchObject({ context: { locale: "ru" }, profiles: [{ localeLocked: true }] });
  });
  it("allows an explicit parent decision for legacy absence without inferring false", async () => {
    const f = fixture(undefined); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    expect(f.controller.getSnapshot().profiles[0]).not.toHaveProperty("localeLocked");
    expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(true);
    expect(f.controller.getSnapshot().profiles[0].localeLocked).toBe(false);
  });
  it("rejects malformed proposals and unchanged settings without arming native UI", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    for (const bad of [1, "false", null]) expect(await f.controller.setProfileLocaleLocked!(c, bad as unknown as boolean)).toBe(false);
    expect(await f.controller.setProfileLocaleLocked!(c, true)).toBe(false); expect(f.plugin.perform).not.toHaveBeenCalled();
  });
  it("rejects a copied context sibling proposal and retired generation before dispatch", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    expect(await f.controller.setProfileLocaleLocked!({ ...c }, false)).toBe(false);
    expect(await f.controller.setProfileLocaleLocked!({ ...c, profileId: "sibling" }, false)).toBe(false);
    f.replace(context(2)); await f.controller.refresh();
    expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(false); expect(f.plugin.perform).not.toHaveBeenCalled();
  });
  it("rejects an expired current context without dispatch", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    vi.setSystemTime(50_001); expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(false);
    expect(f.plugin.perform).not.toHaveBeenCalled();
  });
  it("keeps cancellation readback locked without optimistic unlock or replay", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    f.plugin.perform.mockImplementation(async r => reply(r, c, true, "cancelled"));
    expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(false);
    expect(f.controller.getSnapshot().profiles[0].localeLocked).toBe(true); expect(f.plugin.perform).toHaveBeenCalledOnce();
  });
  it("rejects a late unlock after lifecycle retirement without repaint or replay", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    let resolve!: (value: unknown) => void; const delayed = new Promise<unknown>(done => { resolve = done; });
    f.plugin.perform.mockImplementation(() => delayed);
    const proposal = f.controller.setProfileLocaleLocked!(c, false); await settle();
    expect(f.plugin.perform).toHaveBeenCalledOnce(); f.hide();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: "sealed", context: null });
    resolve(reply(f.plugin.perform.mock.calls[0][0], context(2), false));
    expect(await proposal).toBe(false); expect(f.controller.getSnapshot().phase).toBe("sealed");
    expect(f.plugin.perform).toHaveBeenCalledOnce();
  });
  it("refuses successor lock acknowledgement when profile revision did not advance", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    f.plugin.perform.mockImplementation(async r => reply(r, { ...context(2), profileRevision: c.profileRevision }, false));
    expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(false);
  });
  it("refuses a sibling or locale-changing successor as this profile lock receipt", async () => {
    for (const successor of [{ ...context(2), profileId: "sibling" }, { ...context(2), locale: "ru" as const }]) {
      const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
      f.plugin.perform.mockImplementation(async r => reply(r, successor, false));
      expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(false);
    }
  });
  it("seals malformed native lock readback without claiming success", async () => {
    const f = fixture(true); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    f.plugin.perform.mockImplementation(async r => reply(r, context(2), 1));
    expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(false);
    expect(f.controller.getSnapshot().phase).toBe("sealed"); expect(f.plugin.perform).toHaveBeenCalledOnce();
  });
  it("confirms a blocked-child parent setting without admitting a package", async () => {
    const f = fixture(true, false); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    expect(await f.controller.setProfileLocaleLocked!(c, false)).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ status: "blocked-child", context: { package: null, home: null }, profiles: [{ localeLocked: false }] });
  });
});
