import { describe, expect, it, vi } from "vitest";
import { decodeChildNativeRouteDownload, continueChildNativeRouteDownload } from "./childNativeOfflinePackages";
import { decodeChildNativeDownloadedRoute } from "./childNativePassportProgram";
import type { ChildNativeContext } from "./childNativeAppBridge";
import type { ChildNativePassportController } from "./childNativeDiscoveryPassport";
// Synthetic counters exercise correlation and sequencing.
// They provide no installed storage, review, rights, native PIN or playback proof.
const h = "a".repeat(64), c = { profileId: "reader-one", locale: "en", generation: 4, package: { version: 3 } } as ChildNativeContext;
const binding = { profileId: c.profileId, locale: c.locale, generation: c.generation };
const route = () => ({ journeyId: "route-one", journeyVersion: 3, contentVersion: 3, title: "Synthetic fixture", description: "English text.", nodeCount: 2,
  snapshotChecksum: h, byteLength: 512, storage: "shared-objects" as const,
  media: { locale: "en" as const, audioStatus: "text-only" as const, audioItemCount: 0, imageItemCount: 1, transcriptByteLength: 0, mediaByteLength: 33554432 } });
const staged = (revision = 10) => ({ ...binding, revision, route: null,
  acquisition: { status: "staging", journeyId: "route-one", locale: "en", completedItems: 1, totalItems: 2,
    downloadedBytes: 512, totalBytes: 33554944, sharedItems: 0, reusedItems: 0 } });
const ready = (revision = 11) => ({ ...staged(revision), route: route(),
  acquisition: { ...staged().acquisition, status: "ready", completedItems: 2, downloadedBytes: 33554944, sharedItems: 1, reusedItems: 1 } });
const absent = (status = "absent", revision = 12) => ({ ...binding, revision, route: null,
  acquisition: { ...staged().acquisition, status, completedItems: 0, totalItems: 0, downloadedBytes: 0, totalBytes: 0, sharedItems: 0, reusedItems: 0 } });
const parsed = (raw: unknown) => decodeChildNativeRouteDownload(raw, c, "route-one")!;
const port = (extra: Partial<ChildNativePassportController>) => ({ read: vi.fn(async () => null), recordCountryOpen: vi.fn(async () => null), ...extra }) as ChildNativePassportController;
const callbacks = () => ({ resume: false, alive: vi.fn(() => true), cancelled: vi.fn(() => false), progress: vi.fn() });
describe("native independent locale acquisition presentation", () => {
  it("describes checked full-size shared native objects without duplicating them into the compact route or granting playback", () => {
    expect(parsed(ready()).route).toMatchObject({ storage: "shared-objects", byteLength: 512, media: { mediaByteLength: 33554432, locale: "en" } });
    const inline = { ...route() }; delete (inline as { storage?: string }).storage;
    expect(decodeChildNativeDownloadedRoute(inline, 3)).toBeNull();
    expect(decodeChildNativeDownloadedRoute({ ...route(), storage: "approved-cache" }, 3)).toBeNull();
  });
  it("separates absence, interrupted staging and atomic activation and forbids partial active or fabricated byte status", () => {
    expect(parsed(absent()).acquisition.status).toBe("absent"); expect(parsed(staged()).route).toBeNull();
    for (const value of [{ ...ready(), acquisition: { ...ready().acquisition, completedItems: 1 } },
      { ...ready(), acquisition: { ...ready().acquisition, downloadedBytes: 512 } }, { ...staged(), route: route() },
      { ...absent(), acquisition: { ...absent().acquisition, totalItems: 2 } },
      { ...staged(), acquisition: { ...staged().acquisition, sharedItems: 2 } },
      { ...staged(), acquisition: { ...staged().acquisition, approved: true } },
      { ...ready(), route: { ...route(), playable: true } }]) expect(decodeChildNativeRouteDownload(value, c, "route-one")).toBeNull();
  });
  it("rejects a sibling, opposite language, stale host, wrong route or noncurrent package without treating cached identity as permission", () => {
    for (const value of [{ ...staged(), profileId: "reader-two" }, { ...staged(), locale: "ru" }, { ...staged(), generation: 3 },
      { ...staged(), acquisition: { ...staged().acquisition, locale: "ru" } },
      { ...ready(), route: { ...route(), contentVersion: 2 } }]) expect(decodeChildNativeRouteDownload(value, c, "route-one")).toBeNull();
    expect(decodeChildNativeRouteDownload(staged(), c, "route-two")).toBeNull();
    expect(decodeChildNativeRouteDownload(staged(), { ...c, profileId: null }, "route-one")).toBeNull();
  });
  it("requires observed monotonic durable revision and bounded progress without converting read facts to a mutation receipt", () => {
    expect(decodeChildNativeRouteDownload(staged(10), c, "route-one", 9)?.revision).toBe(10);
    for (const value of [staged(9), staged(140), { ...staged(), acquisition: { ...staged().acquisition, totalItems: 67 } },
      { ...staged(), acquisition: { ...staged().acquisition, totalBytes: 2148007937 } }]) expect(decodeChildNativeRouteDownload(value, c, "route-one", 9)).toBeNull();
  });
  it("never invokes accessors on a restored acquisition", () => {
    const value = staged(), getter = vi.fn(() => value.acquisition); Object.defineProperty(value, "acquisition", { enumerable: true, get: getter });
    expect(decodeChildNativeRouteDownload(value, c, "route-one")).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("continues an explicit new intent with the actual staged revision and stops when the complete native generation activates", async () => {
    const save = vi.fn(async () => parsed(staged())), resume = vi.fn(async () => parsed(ready())), options = callbacks();
    expect(await continueChildNativeRouteDownload(port({ saveJourneyRoute: save, resumeJourneyRoute: resume }), "route-one", 9, options)).toMatchObject({ status: "saved", value: { revision: 11 } });
    expect(save).toHaveBeenCalledWith("route-one", 9); expect(resume).toHaveBeenCalledWith("route-one", 10); expect(options.progress).toHaveBeenCalledTimes(2);
  });
  it("an interrupted intent resumes retained native staging without starting or renewing another generation", async () => {
    const save = vi.fn(async () => parsed(staged())), resume = vi.fn(async () => parsed(ready())), options = { ...callbacks(), resume: true };
    expect((await continueChildNativeRouteDownload(port({ saveJourneyRoute: save, resumeJourneyRoute: resume }), "route-one", 10, options)).status).toBe("saved");
    expect(save).not.toHaveBeenCalled(); expect(resume).toHaveBeenCalledWith("route-one", 10);
  });
  it("cancellation joins an in-flight durable step and uses the returned revision before cancelling pending files", async () => {
    let release!: () => void, cancel = false; const work = new Promise<void>(done => { release = done; });
    const save = vi.fn(async () => { await work; return parsed(staged()); }), resume = vi.fn(async () => parsed(ready()));
    const stop = vi.fn(async () => parsed(absent("cancelled", 11))), options = { ...callbacks(), cancelled: () => cancel };
    const result = continueChildNativeRouteDownload(port({ saveJourneyRoute: save, resumeJourneyRoute: resume, cancelJourneyRoute: stop }), "route-one", 9, options);
    cancel = true; expect(stop).not.toHaveBeenCalled(); release(); expect((await result).status).toBe("cancelled");
    expect(stop).toHaveBeenCalledWith("route-one", 10); expect(resume).not.toHaveBeenCalled();
  });
  it("late cancellation reports a generation already atomically activated as saved without manufacturing rollback or cancelled status", async () => {
    let cancel = false; const save = vi.fn(async () => { cancel = true; return parsed(ready(10)); }), stop = vi.fn(async () => parsed(ready(11)));
    const result = await continueChildNativeRouteDownload(port({ saveJourneyRoute: save, cancelJourneyRoute: stop }), "route-one", 9,
      { ...callbacks(), cancelled: () => cancel });
    expect(result.status).toBe("saved"); expect(result.value?.revision).toBe(11); expect(stop).toHaveBeenCalledWith("route-one", 10);
  });
  it("context retirement after a step drops late facts and never mutates staged state with the retired profile", async () => {
    let live = true; const resume = vi.fn(async () => parsed(ready())), stop = vi.fn(async () => parsed(absent("cancelled")));
    const save = vi.fn(async () => { live = false; return parsed(staged()); }), options = { ...callbacks(), alive: () => live };
    expect((await continueChildNativeRouteDownload(port({ saveJourneyRoute: save, resumeJourneyRoute: resume, cancelJourneyRoute: stop }), "route-one", 9, options)).status).toBe("paused");
    expect(options.progress).not.toHaveBeenCalled(); expect(resume).not.toHaveBeenCalled(); expect(stop).not.toHaveBeenCalled();
  });
  it("a lost or uncorrelated mutation reply stops the intent without replay, cancellation or synthetic success", async () => {
    const save = vi.fn(async () => null), resume = vi.fn(async () => parsed(ready())), stop = vi.fn(async () => parsed(absent("cancelled")));
    expect(await continueChildNativeRouteDownload(port({ saveJourneyRoute: save, resumeJourneyRoute: resume, cancelJourneyRoute: stop }), "route-one", 9, callbacks())).toEqual({ status: "failed", value: null });
    expect(save).toHaveBeenCalledTimes(1); expect(resume).not.toHaveBeenCalled(); expect(stop).not.toHaveBeenCalled();
  });
  it("does not publish a saved result after a progress recipient synchronously retires the current context", async () => {
    let live = true; const save = vi.fn(async () => parsed(ready(10))), resume = vi.fn(async () => parsed(ready()));
    const result = await continueChildNativeRouteDownload(port({ saveJourneyRoute: save, resumeJourneyRoute: resume }), "route-one", 9,
      { ...callbacks(), alive: () => live, progress: () => { live = false; } });
    expect(result).toEqual({ status: "paused", value: null }); expect(resume).not.toHaveBeenCalled();
  });
  it("bounded uncompleted native steps pause while leaving the last checked stage available for a later explicit intent", async () => {
    let revision = 10; const resume = vi.fn(async () => parsed(staged(revision++))), options = { ...callbacks(), resume: true };
    const result = await continueChildNativeRouteDownload(port({ resumeJourneyRoute: resume }), "route-one", 9, options);
    expect(result.status).toBe("paused"); expect(resume).toHaveBeenCalledTimes(69); expect(result.value).not.toBeNull();
  });
});
