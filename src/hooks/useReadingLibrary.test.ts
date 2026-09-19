import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadingLibraryController, readingLibraryStorageKey, READING_LIBRARY_REMOTE_TIMEOUT_MS,
  type ReadingLibraryRemote, type SavedReading } from "./useReadingLibrary";
import type { BookDossierProgress } from "../books/bookDossierProgress";

const date = "2026-09-19T10:00:00.000Z";
const book = (id = "book-a"): SavedReading => ({ id, kind: "book", title: id, sectionLabel: "Books", status: "saved", addedAt: date });
const remoteRow = (item: SavedReading) => ({ item_id: item.id, item_type: item.kind, title: item.title, section_label: item.sectionLabel,
  added_at: item.addedAt, reading_status: item.status });
const progress = (pageId: string): BookDossierProgress => ({ pageId, updatedAt: date,
  anchor: { sectionId: "overview", blockId: pageId, dossierVersion: "v1", locale: "ru", readingMode: "BEFORE_READING" } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function lazy<T>(start: () => Promise<T>): PromiseLike<T> { return { then: (fulfilled, rejected) => start().then(fulfilled, rejected) }; }
async function flush() { for (let turn = 0; turn < 20; turn++) await Promise.resolve(); }
function fixture(initial: SavedReading[] = [], remoteEnabled = true) {
  let stored = initial, current = true;
  const remote = {
    read: vi.fn<ReadingLibraryRemote["read"]>(async () => ({ data: [], error: null })),
    save: vi.fn<ReadingLibraryRemote["save"]>(async () => ({ error: null })),
    remove: vi.fn<ReadingLibraryRemote["remove"]>(async () => ({ error: null })),
    setStatus: vi.fn<ReadingLibraryRemote["setStatus"]>(async () => ({ error: null })),
  };
  const writeLocal = vi.fn((items: SavedReading[]) => { stored = structuredClone(items); });
  const controller = createReadingLibraryController({ readLocal: () => stored, writeLocal, remote: remoteEnabled ? remote : null, isCurrent: () => current });
  return { controller, remote, writeLocal, stored: () => stored, switchIdentity: () => { current = false; },
    external: (items: SavedReading[]) => { stored = items; controller.syncExternal(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(date)); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("reading library ownership and awaited mutations", () => {
  it("executes lazy read, toggle and status thenables once, without constructor network IO", async () => {
    const f = fixture(), executed: string[] = [];
    f.remote.read.mockImplementation(() => lazy(async () => { executed.push("read"); return { data: [], error: null }; }));
    f.remote.save.mockImplementation(() => lazy(async () => { executed.push("save"); return { error: null }; }));
    f.remote.setStatus.mockImplementation(() => lazy(async () => { executed.push("status"); return { error: null }; }));
    f.remote.remove.mockImplementation(() => lazy(async () => { executed.push("remove"); return { error: null }; }));
    expect(executed).toEqual([]); const stop = f.controller.activate(); await flush();
    f.controller.toggle(book()); await flush();
    f.controller.setStatus("book-a", "book", "reading"); await flush();
    f.controller.toggle(book()); await flush();
    expect(executed).toEqual(["read", "save", "status", "remove"]); expect(f.controller.getSnapshot()).toEqual([]); stop();
  });
  it("fences pending hydration after removing an item and never uploads a hydration merge", async () => {
    const f = fixture([book()]), pending = deferred<{ data: unknown; error: unknown }>();
    f.remote.read.mockReturnValue(pending.promise); const stop = f.controller.activate();
    expect(await f.controller.remove("book-a", "book")).toBe(true);
    pending.resolve({ data: [remoteRow(book()), remoteRow(book("remote-b"))], error: null }); await flush();
    expect(f.controller.getSnapshot()).toEqual([]); expect(f.stored()).toEqual([]); expect(f.remote.save).not.toHaveBeenCalled(); stop();
  });
  it("preserves private dossier progress when remote hydration wins the newer metadata", async () => {
    const local = { ...book(), dossierProgress: progress("local-page") }, f = fixture([local]);
    f.remote.read.mockResolvedValue({ data: [{ ...remoteRow(book()), title: "Updated title", added_at: "2026-09-20T10:00:00Z",
      dossierProgress: progress("remote-forgery") }], error: null });
    const stop = f.controller.activate(); await flush();
    expect(f.controller.getSnapshot()[0]).toMatchObject({ title: "Updated title", dossierProgress: local.dossierProgress });
    expect(f.remote.save).not.toHaveBeenCalled();
    expect(await f.controller.save(book(), "reading")).toBe(true);
    expect(f.remote.save.mock.calls[0][0]).not.toHaveProperty("dossierProgress"); stop();
  });
  it("rolls back only the failing item while retaining another item and a newer local dossier location", async () => {
    const f = fixture([{ ...book(), dossierProgress: progress("first") }]), status = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.setStatus.mockReturnValue(status.promise);
    f.controller.setStatus("book-a", "book", "reading"); await flush();
    expect(await f.controller.save(book("book-b"))).toBe(true);
    f.controller.setDossierProgress("book-a", progress("later"));
    status.resolve({ error: new Error("rejected") }); await flush();
    expect(f.controller.getSnapshot().find(item => item.id === "book-a")).toMatchObject({ status: "saved", dossierProgress: progress("later") });
    expect(f.controller.getSnapshot().find(item => item.id === "book-b")).toBeDefined(); stop();
  });
  it("serializes same-item requests while a newer edit fences the older failure rollback", async () => {
    const f = fixture([book()]), first = deferred<{ error: unknown }>(), second = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush();
    f.remote.save.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const saveFirst = f.controller.save(book(), "reading"); await flush();
    const saveSecond = f.controller.save(book(), "finished"); await flush();
    expect(f.remote.save).toHaveBeenCalledTimes(1); expect(f.controller.getSnapshot()[0].status).toBe("finished");
    first.resolve({ error: new Error("older failed") }); expect(await saveFirst).toBe(false); await flush();
    expect(f.remote.save).toHaveBeenCalledTimes(2); expect(f.controller.getSnapshot()[0].status).toBe("finished");
    second.resolve({ error: null }); expect(await saveSecond).toBe(true); stop();
  });
  it("keeps immediate save then status in order so lazy creation cannot be skipped", async () => {
    const f = fixture(), order: string[] = [], pending = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush();
    f.remote.save.mockImplementation(() => { order.push("save"); return pending.promise; });
    f.remote.setStatus.mockImplementation(async () => { order.push("status"); return { error: null }; });
    const saved = f.controller.save(book()); f.controller.setStatus("book-a", "book", "reading"); await flush();
    expect(order).toEqual(["save"]); pending.resolve({ error: null }); expect(await saved).toBe(true); await flush();
    expect(order).toEqual(["save", "status"]); expect(f.controller.getSnapshot()[0].status).toBe("reading"); stop();
  });
  it("discards old-account hydration and failed writes after identity ownership changes", async () => {
    const old = fixture([book()]), read = deferred<{ data: unknown; error: unknown }>(), write = deferred<{ error: unknown }>();
    old.remote.read.mockReturnValue(read.promise); old.remote.remove.mockReturnValue(write.promise);
    const stopOld = old.controller.activate(), removal = old.controller.remove("book-a", "book"); await flush();
    const writesBeforeSwitch = old.writeLocal.mock.calls.length;
    old.switchIdentity(); stopOld();
    const next = fixture([book("user-b")]), stopNext = next.controller.activate(); await flush();
    read.resolve({ data: [remoteRow(book("old-user-remote"))], error: null }); write.resolve({ error: new Error("late") });
    expect(await removal).toBe(false); await flush();
    expect(old.writeLocal).toHaveBeenCalledTimes(writesBeforeSwitch);
    expect(next.controller.getSnapshot().map(item => item.id)).toEqual(["user-b"]); stopNext();
  });
  it("external scoped updates cancel hydration and invalidate queued writes and rollback", async () => {
    const f = fixture([book()]), write = deferred<{ error: unknown }>(), read = deferred<{ data: unknown; error: unknown }>();
    f.remote.read.mockReturnValue(read.promise); f.remote.save.mockReturnValue(write.promise);
    const stop = f.controller.activate(), first = f.controller.save(book(), "reading"); await flush();
    const second = f.controller.save(book(), "finished");
    f.external([book("external")]);
    write.resolve({ error: new Error("old failure") }); read.resolve({ data: [remoteRow(book())], error: null });
    expect(await first).toBe(false); expect(await second).toBe(false); await flush();
    expect(f.controller.getSnapshot().map(item => item.id)).toEqual(["external"]); expect(f.remote.save).toHaveBeenCalledOnce(); stop();
  });
  it("keeps another reader's unchanged snapshots and different-item updates from cancelling an active save", async () => {
    const f = fixture([book()]), write = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.save.mockReturnValue(write.promise);
    const saved = f.controller.save(book(), "reading"); await flush();
    const signal = f.remote.save.mock.calls[0][1], unchanged = structuredClone(f.controller.getSnapshot());
    f.external(unchanged); expect(signal.aborted).toBe(false);
    const other = { ...book("book-b"), dossierProgress: progress("other-reader") };
    f.external([...unchanged, other]); expect(signal.aborted).toBe(false);
    write.resolve({ error: null }); expect(await saved).toBe(true);
    expect(f.controller.getSnapshot()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "book-a", status: "reading" }),
      expect.objectContaining({ id: "book-b", dossierProgress: other.dossierProgress })])); stop();
  });
  it("retains an external dossier-only edit on the same book without cancelling its remote save", async () => {
    const f = fixture([{ ...book(), dossierProgress: progress("first") }]), write = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.save.mockReturnValue(write.promise);
    const saved = f.controller.save(book(), "reading"); await flush();
    const signal = f.remote.save.mock.calls[0][1];
    f.external(f.controller.getSnapshot().map(item => ({ ...item, dossierProgress: progress("other-reader-page") })));
    expect(signal.aborted).toBe(false);
    write.resolve({ error: null }); expect(await saved).toBe(true);
    expect(f.controller.getSnapshot()[0]).toMatchObject({ status: "reading", dossierProgress: progress("other-reader-page") }); stop();
  });
  it("bounds a stalled mutation and restores owned local state without leaking a late rejection", async () => {
    const f = fixture([book()]), write = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.remove.mockReturnValue(write.promise);
    const removal = f.controller.remove("book-a", "book"); await flush();
    const signal = f.remote.remove.mock.calls[0][2];
    await vi.advanceTimersByTimeAsync(READING_LIBRARY_REMOTE_TIMEOUT_MS);
    expect(await removal).toBe(false); expect(signal.aborted).toBe(true); expect(f.controller.getSnapshot()[0].id).toBe("book-a");
    write.resolve({ error: new Error("late") }); await flush(); expect(f.controller.getSnapshot()).toHaveLength(1); stop();
  });
  it("keeps guest storage independent and every guest mutation local", async () => {
    expect(readingLibraryStorageKey(null)).toBe("probpera-reading-library");
    expect(readingLibraryStorageKey("user/a")).toBe("probpera-reading-library:user:user%2Fa");
    expect(readingLibraryStorageKey("user-a")).not.toBe(readingLibraryStorageKey("user-b"));
    const f = fixture([], false), stop = f.controller.activate();
    expect(await f.controller.save(book())).toBe(true);
    f.controller.setDossierProgress("book-a", progress("guest")); f.controller.setStatus("book-a", "book", "reading"); await flush();
    expect(f.stored()[0]).toMatchObject({ status: "reading", dossierProgress: progress("guest") });
    expect(await f.controller.remove("book-a", "book")).toBe(true);
    for (const method of Object.values(f.remote)) expect(method).not.toHaveBeenCalled(); stop();
  });
});
