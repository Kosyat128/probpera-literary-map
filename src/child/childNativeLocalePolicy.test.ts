import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, decodeChildNativeAppReply, CHILD_NATIVE_LOCAL_POLICY_CHECKSUM,
  CHILD_NATIVE_LOCAL_POLICY_VERSION, type ChildNativeAppController, type ChildNativeAppPlugin, type ChildNativeContext } from "./childNativeAppBridge";
import type { ChildLocalePolicy } from "./childProfile";
import type { PlatformSnapshot } from "../platform/ports";

// AUTHORED_NOT_RUN: synthetic correlated DTOs; no native Gate/storage/admission.
const REQUEST = "c".repeat(32), HASH = "a".repeat(64);
const owners: ChildNativeAppController[] = [];
const both = (): ChildLocalePolicy => ({ schemaVersion: 1, allowedLocales: ["ru", "en"] });
function context(generation = 1, admitted = true): ChildNativeContext {
  return { token: generation.toString(16).padStart(32, "0"), generation, revision: generation + 1,
    selectionRevision: generation + 1, profileRevision: generation + 1, policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION,
    policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, mode: "child", profileId: "reader", locale: "en", remainingLifetimeMs: 50_000,
    package: admitted ? { id: "package", version: 1, checksum: HASH } : null,
    home: admitted ? { kind: "activity", id: "home", contentChecksum: HASH } : null };
}
function reply(request: unknown, c = context(), policy: unknown = undefined, locked = true, reason: string | null = null) {
  return { version: 2, requestId: (request as { requestId: string }).requestId, status: c.package ? "child" : "blocked-child",
    reason, context: c, profiles: [{ id: c.profileId, label: "Synthetic reader", exactAge: 9, locale: c.locale, localeLocked: locked,
      ...(policy === undefined ? {} : { localePolicy: policy }) }] };
}
function fixture(initial: ChildLocalePolicy | undefined = undefined, admitted = true) {
  let serial = 0, native = context(1, admitted), policy = initial;
  let platform: PlatformSnapshot = Object.freeze({ connectivity: "online", visibility: "active" });
  const listeners = new Set<() => void>();
  const plugin = {
    bootstrap: vi.fn(async (r: unknown): Promise<unknown> => reply(r, native, policy)),
    readContext: vi.fn(async (r: unknown): Promise<unknown> => reply(r, native, policy)),
    perform: vi.fn(async (r: unknown): Promise<unknown> => {
      native = context(native.generation + 1, admitted);
      policy = (r as { target: { changes: { localePolicy: ChildLocalePolicy } } }).target.changes.localePolicy;
      return reply(r, native, policy);
    }),
    retire: vi.fn(async (r: unknown) => { const q = r as { requestId: string; contextToken: string | null };
      return { version: 2, requestId: q.requestId, status: "retired", contextToken: q.contextToken }; }),
    readEntity: vi.fn(async (_r: unknown): Promise<unknown> => null),
    search: vi.fn(async (_r: unknown): Promise<unknown> => null),
    readCollection: vi.fn(async (_r: unknown): Promise<unknown> => null),
    writeCollection: vi.fn(async (_r: unknown): Promise<unknown> => null),
    addListener: vi.fn(async () => ({ remove: async () => undefined })),
  } satisfies ChildNativeAppPlugin;
  const controller = createChildNativeAppController({ plugin, nowMs: () => Date.now(), timeoutMs: 1_000,
    requestId: () => (++serial).toString(16).padStart(32, "0"),
    lifecycle: { getSnapshot: () => platform, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } } });
  owners.push(controller); controller.attachPresentationBarrier(vi.fn());
  return { controller, plugin, replace(c: ChildNativeContext) { native = c; },
    hide() { platform = Object.freeze({ connectivity: "online", visibility: "background" }); for (const listener of listeners) listener(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(async () => { for (const owner of owners.splice(0)) await owner.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("S16 BIL009 native parent allowed locale policy", () => {
  it("decodes optional strict immutable policy and preserves legacy absence", () => {
    const input = both(), decoded = decodeChildNativeAppReply(reply({ requestId: REQUEST }, context(), input), REQUEST)!;
    expect(decoded.profiles[0].localePolicy).toEqual(input); expect(Object.isFrozen(decoded.profiles[0].localePolicy!.allowedLocales)).toBe(true);
    expect(decodeChildNativeAppReply(reply({ requestId: REQUEST }), REQUEST)!.profiles[0]).not.toHaveProperty("localePolicy");
  });
  it("refuses malformed nested summaries and getters without invoking them", () => {
    for (const policy of [{ schemaVersion: true, allowedLocales: ["en"] }, { schemaVersion: 1, allowedLocales: ["ru"] },
      { schemaVersion: 1, allowedLocales: ["en", "en"] }, null]) {
      expect(decodeChildNativeAppReply(reply({ requestId: REQUEST }, context(), policy), REQUEST)).toBeNull();
    }
    const input = { schemaVersion: 1 }, getter = vi.fn(() => ["en"]);
    Object.defineProperty(input, "allowedLocales", { enumerable: true, get: getter });
    expect(decodeChildNativeAppReply(reply({ requestId: REQUEST }, context(), input), REQUEST)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
  it("proposes an explicit parent policy through original settings and confirms only its exact successor", async () => {
    const f = fixture(); await f.controller.start(); const c = f.controller.getSnapshot().context!, proposed = both();
    expect(await f.controller.setProfileLocalePolicy!(c, proposed)).toBe(true);
    expect(f.plugin.perform).toHaveBeenCalledOnce();
    expect(f.plugin.perform.mock.calls[0][0]).toMatchObject({ contextToken: c.token, action: "expand-access-settings",
      target: { profileId: "reader", changes: { localePolicy: proposed } } });
    expect(f.controller.getSnapshot().profiles[0]).toMatchObject({ locale: "en", localeLocked: true, localePolicy: proposed });
  });
  it("confirms a policy in authenticated blocked-child readback without admitting content", async () => {
    const f = fixture(undefined, false); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    expect(await f.controller.setProfileLocalePolicy!(c, both())).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ status: "blocked-child", context: { package: null, home: null } });
  });
  it("refuses malformed unchanged copied sibling expired and retired-context proposals before native UI", async () => {
    const f = fixture(both()); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    expect(await f.controller.setProfileLocalePolicy!(c, both())).toBe(false);
    expect(await f.controller.setProfileLocalePolicy!(c, { schemaVersion: 1, allowedLocales: ["ru"] })).toBe(false);
    expect(await f.controller.setProfileLocalePolicy!({ ...c }, { schemaVersion: 1, allowedLocales: ["en"] })).toBe(false);
    expect(await f.controller.setProfileLocalePolicy!({ ...c, profileId: "sibling" }, { schemaVersion: 1, allowedLocales: ["en"] })).toBe(false);
    f.replace(context(2)); await f.controller.refresh(); expect(await f.controller.setProfileLocalePolicy!(c, { schemaVersion: 1, allowedLocales: ["en"] })).toBe(false);
    vi.setSystemTime(50_001); expect(await f.controller.setProfileLocalePolicy!(f.controller.getSnapshot().context!, { schemaVersion: 1, allowedLocales: ["en"] })).toBe(false);
    expect(f.plugin.perform).not.toHaveBeenCalled();
  });
  it("does not optimistically save a cancelled policy or replay the native request", async () => {
    const f = fixture(); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    f.plugin.perform.mockImplementation(async r => reply(r, c, undefined, true, "cancelled"));
    expect(await f.controller.setProfileLocalePolicy!(c, both())).toBe(false);
    expect(f.controller.getSnapshot().profiles[0]).not.toHaveProperty("localePolicy"); expect(f.plugin.perform).toHaveBeenCalledOnce();
  });
  it("rejects wrong readback policy changed lock sibling and unchanged profile revision", async () => {
    for (const kind of ["policy", "lock", "sibling", "revision"] as const) {
      const f = fixture(); await f.controller.start(); const c = f.controller.getSnapshot().context!;
      f.plugin.perform.mockImplementation(async r => reply(r,
        kind === "sibling" ? { ...context(2), profileId: "sibling" } : kind === "revision" ? { ...context(2), profileRevision: c.profileRevision } : context(2),
        kind === "policy" ? { schemaVersion: 1, allowedLocales: ["en"] } : both(), kind !== "lock"));
      expect(await f.controller.setProfileLocalePolicy!(c, both())).toBe(false);
    }
  });
  it("rejects a late policy reply after background and immediately seals its old context", async () => {
    const f = fixture(); await f.controller.start(); const c = f.controller.getSnapshot().context!;
    let resolve!: (value: unknown) => void; f.plugin.perform.mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = f.controller.setProfileLocalePolicy!(c, both());
    for (let i = 0; i < 32; i++) await Promise.resolve();
    expect(f.plugin.perform).toHaveBeenCalledOnce(); f.hide(); expect(f.controller.getSnapshot()).toMatchObject({ phase: "sealed", context: null });
    resolve(reply(f.plugin.perform.mock.calls[0][0], context(2), both()));
    expect(await pending).toBe(false); expect(f.controller.getSnapshot().phase).toBe("sealed"); expect(f.plugin.perform).toHaveBeenCalledOnce();
  });
});
