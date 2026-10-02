import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadingLibraryController, readingLibraryStorageKey, READING_LIBRARY_REMOTE_TIMEOUT_MS,
  type ReadingLibraryRemote, type SavedReading } from "./useReadingLibrary";
import { createReadingLibraryStorage, READING_LIBRARY_PENDING_LIMIT,
  type ReadingLibraryEnvelope } from "./readingLibraryStorage";
import type { BookDossierProgress } from "../books/bookDossierProgress";

const date = "2026-09-19T10:00:00.000Z";
const book = (id = "book-a"): SavedReading => ({ id, kind: "book", title: id, sectionLabel: "Books", status: "saved", addedAt: date });
const remoteRow = (item: SavedReading) => ({ item_id: item.id, item_type: item.kind, title: item.title, section_label: item.sectionLabel,
  added_at: item.addedAt, reading_status: item.status });
const progress = (pageId: string): BookDossierProgress => ({ pageId, updatedAt: date,
  anchor: { sectionId: "overview", blockId: pageId, dossierVersion: "v1", locale: "ru", readingMode: "BEFORE_READING" } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function lazy<T>(start: () => Promise<T>): PromiseLike<T> { return { then: (fulfilled, rejected) => start().then(fulfilled, rejected) }; }
async function flush() { for (let turn = 0; turn < 30; turn++) await Promise.resolve(); }
function fixture(initial: SavedReading[] | ReadingLibraryEnvelope = [], adult = true) {
  let raw = JSON.stringify(initial), current = true, online = true, storageFailure: "throw" | "ignore" | null = null;
  const key = readingLibraryStorageKey(adult ? "user-a" : null);
  const port = {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((_key: string, value: string) => {
      if (storageFailure === "throw") throw new Error("quota");
      if (storageFailure !== "ignore") raw = value;
    }),
  };
  const remote = {
    read: vi.fn<ReadingLibraryRemote["read"]>(async () => ({ data: [], error: null })),
    save: vi.fn<ReadingLibraryRemote["save"]>(async () => ({ error: null })),
    remove: vi.fn<ReadingLibraryRemote["remove"]>(async () => ({ error: null })),
    setStatus: vi.fn<ReadingLibraryRemote["setStatus"]>(async () => ({ error: null })),
  };
  const storage = createReadingLibraryStorage(key, adult, () => port);
  const options = { storage, remote: adult ? remote : null, isCurrent: () => current, isOnline: () => online };
  const controller = createReadingLibraryController(options);
  return { controller, remote, port, storage, options, raw: () => raw, persisted: () => JSON.parse(raw) as ReadingLibraryEnvelope,
    switchIdentity: () => { current = false; }, setOnline: (value: boolean) => { online = value; },
    failStorage: (value: typeof storageFailure) => { storageFailure = value; },
    coldController: () => createReadingLibraryController({ ...options, storage: createReadingLibraryStorage(key, adult, () => port) }),
    external: (value: SavedReading[] | ReadingLibraryEnvelope) => { raw = JSON.stringify(value); controller.syncExternal(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(date)); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("offline reading library ownership and durable intent", () => {
  it("defers discarded StrictMode setup and shares one lazy transport among two live leases", async () => {
    const f = fixture(), executed: string[] = [];
    f.remote.read.mockImplementation(() => lazy(async () => { executed.push("read"); return { data: [], error: null }; }));
    f.remote.save.mockImplementation(() => lazy(async () => { executed.push("save"); return { error: null }; }));
    f.remote.remove.mockImplementation(() => lazy(async () => { executed.push("remove"); return { error: null }; }));
    expect(executed).toEqual([]);
    f.controller.activate()();
    const stopFirst = f.controller.activate(), stopSecond = f.controller.activate(); await flush();
    f.controller.toggle(book()); await flush(); stopFirst();
    f.controller.setStatus("book-a", "book", "reading"); await flush();
    f.controller.toggle(book()); await flush();
    expect(executed).toEqual(["read", "save", "save", "remove"]);
    expect(f.remote.setStatus).not.toHaveBeenCalled(); expect(f.controller.getSnapshot()).toEqual([]); stopSecond();
  });
  it("coalesces offline creation/status, survives cold reload and uploads full metadata without private progress", async () => {
    const f = fixture(); f.setOnline(false); const stop = f.controller.activate(); await flush();
    expect(await f.controller.save(book())).toBe(true);
    f.controller.setStatus("book-a", "book", "finished"); f.controller.setDossierProgress("book-a", progress("private-page"));
    await flush(); expect(f.remote.save).not.toHaveBeenCalled(); expect(f.remote.read).not.toHaveBeenCalled();
    expect(f.persisted()).toMatchObject({ schemaVersion: 1, items: [{ status: "finished", dossierProgress: progress("private-page") }],
      pending: [{ operation: "upsert", item: { status: "finished" } }] });
    expect(f.persisted().pending).toHaveLength(1); expect(f.persisted().pending[0]).not.toHaveProperty("item.dossierProgress");
    stop(); f.setOnline(true);
    const cold = f.coldController(), stopCold = cold.activate(); await flush();
    expect(f.remote.save).toHaveBeenCalledOnce(); expect(f.remote.save.mock.calls[0][0]).toMatchObject({ id: "book-a", title: "book-a", status: "finished" });
    expect(f.remote.save.mock.calls[0][0]).not.toHaveProperty("dossierProgress");
    expect(cold.getSnapshot()[0].dossierProgress).toEqual(progress("private-page"));
    expect(cold.getSyncSnapshot()).toMatchObject({ status: "idle", pendingCount: 0, persistence: "persistent" }); stopCold();
  });
  it("acknowledges a removal without letting an older hydration resurrect the removed book", async () => {
    const f = fixture([book()]), read = deferred<{ data: unknown; error: unknown }>();
    f.remote.read.mockReturnValue(read.promise); const stop = f.controller.activate(); await flush();
    expect(await f.controller.remove("book-a", "book")).toBe(true); await flush();
    expect(f.persisted().pending).toEqual([]);
    read.resolve({ data: [remoteRow(book()), remoteRow(book("remote-b"))], error: null }); await flush();
    expect(f.controller.getSnapshot()).toEqual([]); expect(f.remote.save).not.toHaveBeenCalled(); stop();
  });
  it("keeps failed durable tombstones through restart and applies them over remote data until acknowledged", async () => {
    const f = fixture([book()]); f.remote.remove.mockResolvedValue({ error: new Error("offline server") });
    const stop = f.controller.activate(); await flush();
    expect(await f.controller.remove("book-a", "book")).toBe(true); await flush();
    expect(f.controller.getSnapshot()).toEqual([]); expect(f.controller.getSyncSnapshot()).toMatchObject({ status: "pending", pendingCount: 1 });
    stop(); f.remote.read.mockResolvedValue({ data: [remoteRow(book())], error: null });
    const pending = deferred<{ error: unknown }>(); f.remote.remove.mockReturnValue(pending.promise);
    const cold = f.coldController(), stopCold = cold.activate(); await flush();
    expect(cold.getSnapshot()).toEqual([]); expect(f.persisted().pending[0]).toMatchObject({ operation: "delete", id: "book-a" });
    pending.resolve({ error: null }); await flush(); expect(f.persisted().pending).toEqual([]); stopCold();
  });
  it("preserves local dossier progress during remote hydration and never uploads a legacy array by itself", async () => {
    const local = { ...book(), dossierProgress: progress("local-page") }, f = fixture([local]);
    f.remote.read.mockResolvedValue({ data: [{ ...remoteRow(book()), title: "Updated title", added_at: "2026-09-20T10:00:00Z",
      dossierProgress: progress("remote-forgery") }], error: null });
    const stop = f.controller.activate(); await flush();
    expect(f.controller.getSnapshot()[0]).toMatchObject({ title: "Updated title", dossierProgress: local.dossierProgress });
    expect(f.remote.save).not.toHaveBeenCalled(); expect(f.persisted().pending).toEqual([]); stop();
  });
  it("retains rejected status and private progress and gives a newer same-book edit one send opportunity", async () => {
    const f = fixture([{ ...book(), dossierProgress: progress("first") }]), first = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush();
    f.remote.save.mockReturnValueOnce(first.promise).mockResolvedValue({ error: new Error("still unavailable") });
    expect(await f.controller.save(book(), "reading")).toBe(true); await flush();
    const firstSignal = f.remote.save.mock.calls[0][1];
    expect(await f.controller.save(book(), "finished")).toBe(true);
    f.controller.setDossierProgress("book-a", progress("later")); await flush();
    expect(firstSignal.aborted).toBe(false); expect(f.remote.save).toHaveBeenCalledOnce();
    first.resolve({ error: new Error("older failed") }); await flush();
    expect(f.remote.save).toHaveBeenCalledTimes(2); expect(f.remote.save.mock.calls[1][0].status).toBe("finished");
    expect(f.controller.getSnapshot()[0]).toMatchObject({ status: "finished", dossierProgress: progress("later") });
    expect(f.controller.getSyncSnapshot()).toMatchObject({ status: "pending", pendingCount: 1 });
    await vi.advanceTimersByTimeAsync(READING_LIBRARY_REMOTE_TIMEOUT_MS * 3);
    expect(f.remote.save).toHaveBeenCalledTimes(2); stop();
  });
  it("rereads external intent before an old acknowledgement and retains another reader's dossier change", async () => {
    const f = fixture([book()]), first = deferred<{ error: unknown }>(), second = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.save.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    expect(await f.controller.save(book(), "reading")).toBe(true); await flush();
    const prior = f.persisted(), latest = { ...book(), status: "finished" as const };
    f.external({ ...prior, items: [{ ...latest, dossierProgress: progress("other-reader") }],
      pending: [{ token: "external-latest", operation: "upsert", item: latest }] });
    first.resolve({ error: null }); await flush();
    expect(f.remote.save).toHaveBeenCalledTimes(2); expect(f.persisted().pending[0].token).toBe("external-latest");
    expect(f.controller.getSnapshot()[0].dossierProgress).toEqual(progress("other-reader"));
    second.resolve({ error: null }); await flush(); expect(f.persisted().pending).toEqual([]);
    expect(f.controller.getSnapshot()[0].status).toBe("finished"); stop();
  });
  it("does not cancel an in-flight save for an external dossier-only edit and keeps that edit on acknowledgement", async () => {
    const f = fixture([book()]), pending = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.save.mockReturnValueOnce(pending.promise);
    expect(await f.controller.save(book(), "reading")).toBe(true); await flush();
    expect(await f.controller.save(book(), "finished")).toBe(true);
    const signal = f.remote.save.mock.calls[0][1], value = f.persisted();
    f.external({ ...value, items: value.items.map(item => ({ ...item, dossierProgress: progress("reader-two") })) });
    expect(signal.aborted).toBe(false); pending.resolve({ error: null }); await flush();
    expect(f.controller.getSnapshot()[0].dossierProgress).toEqual(progress("reader-two"));
    expect(f.remote.save).toHaveBeenCalledTimes(2); expect(f.remote.save.mock.calls[1][0].status).toBe("finished");
    expect(f.persisted().pending).toEqual([]); stop();
  });
  it("bounds hanging writes, keeps deletion locally, and retries only on a new explicit opportunity", async () => {
    const f = fixture([book()]), pending = deferred<{ error: unknown }>();
    const stop = f.controller.activate(); await flush(); f.remote.remove.mockReturnValueOnce(pending.promise);
    expect(await f.controller.remove("book-a", "book")).toBe(true); await flush();
    const signal = f.remote.remove.mock.calls[0][2]; await vi.advanceTimersByTimeAsync(READING_LIBRARY_REMOTE_TIMEOUT_MS);
    expect(signal.aborted).toBe(true); expect(f.controller.getSnapshot()).toEqual([]);
    expect(f.controller.getSyncSnapshot().status).toBe("pending");
    await vi.advanceTimersByTimeAsync(READING_LIBRARY_REMOTE_TIMEOUT_MS * 2); expect(f.remote.remove).toHaveBeenCalledOnce();
    await f.controller.retrySync(); expect(f.remote.remove).toHaveBeenCalledTimes(2);
    expect(f.controller.getSyncSnapshot().pendingCount).toBe(0);
    pending.resolve({ error: new Error("late unabortable reply") }); await flush();
    expect(f.controller.getSnapshot()).toEqual([]); stop();
  });
  it("fences old account continuations and queued work as soon as the committed identity changes", async () => {
    const a = fixture([book()]), read = deferred<{ data: unknown; error: unknown }>(), write = deferred<{ error: unknown }>();
    a.remote.read.mockReturnValue(read.promise); a.remote.save.mockReturnValue(write.promise);
    const stopA = a.controller.activate(); await flush();
    await a.controller.save(book(), "reading"); await flush(); await a.controller.save(book(), "finished");
    const count = a.port.setItem.mock.calls.length; a.switchIdentity();
    const b = fixture([book("user-b")]), stopB = b.controller.activate(); await flush();
    read.resolve({ data: [remoteRow(book("old-user-remote"))], error: null }); write.resolve({ error: null }); await flush();
    expect(a.remote.save).toHaveBeenCalledOnce(); expect(a.port.setItem).toHaveBeenCalledTimes(count);
    expect(await a.controller.save(book("stale-handler"))).toBe(false);
    expect(b.controller.getSnapshot().map(item => item.id)).toEqual(["user-b"]); stopA(); stopB();
  });
  it.each(["throw", "ignore"] as const)("reports session-only when strict persistence %s fails, retains intent on remount and recovers on retry", async failure => {
    const f = fixture(); f.setOnline(false); const stop = f.controller.activate(); await flush(); f.failStorage(failure);
    expect(await f.controller.save(book())).toBe(true);
    expect(f.controller.getSyncSnapshot()).toMatchObject({ status: "pending", persistence: "session-only", pendingCount: 1 });
    expect(JSON.parse(f.raw())).toEqual([]); stop();
    const stopAgain = f.controller.activate(); await flush(); expect(f.controller.getSnapshot()[0].id).toBe("book-a");
    f.failStorage(null); f.setOnline(true); await f.controller.retrySync(); await flush();
    expect(f.persisted().items[0].id).toBe("book-a");
    expect(f.controller.getSyncSnapshot()).toMatchObject({ status: "idle", persistence: "persistent", pendingCount: 0 }); stopAgain();
  });
  it("quarantines a mixed corrupt outbox without uploading valid-looking fragments or resurrecting unknown removals", async () => {
    const f = fixture({ schemaVersion: 1, items: [book()], pending: [
      { token: "valid-looking", operation: "upsert", item: book() },
      { token: "bad", operation: "delete", id: "removed", kind: "foreign" },
    ] } as unknown as ReadingLibraryEnvelope);
    const raw = f.raw(), stop = f.controller.activate(); await flush(); await f.controller.retrySync();
    expect(f.remote.read).not.toHaveBeenCalled(); expect(f.remote.save).not.toHaveBeenCalled(); expect(f.remote.remove).not.toHaveBeenCalled();
    expect(f.controller.getSyncSnapshot().persistence).toBe("session-only"); expect(f.raw()).toBe(raw);
    expect(await f.controller.save(book("explicit-new"))).toBe(true); await flush();
    expect(f.remote.save).toHaveBeenCalledOnce(); expect(f.remote.save.mock.calls[0][0].id).toBe("explicit-new");
    expect(f.raw()).toBe(raw); expect(f.remote.read).not.toHaveBeenCalled(); stop();
  });
  it("refuses overflow before changing items and never drops an older deletion tombstone", async () => {
    const pending: ReadingLibraryEnvelope["pending"] = Array.from({ length: READING_LIBRARY_PENDING_LIMIT }, (_, index) =>
      ({ token: `pending-${index}`, operation: "delete", id: `book-${index}`, kind: "book" }));
    const f = fixture({ schemaVersion: 1, items: [], pending }); f.setOnline(false); const stop = f.controller.activate(); await flush();
    const raw = f.raw(); expect(await f.controller.save(book("too-many"))).toBe(false); expect(f.raw()).toBe(raw);
    expect(f.controller.getSnapshot()).toEqual([]); expect(f.controller.getSyncSnapshot().pendingCount).toBe(READING_LIBRARY_PENDING_LIMIT);
    expect(await f.controller.remove("book-0", "book")).toBe(true); expect(f.persisted().pending).toHaveLength(READING_LIBRARY_PENDING_LIMIT);
    expect(f.persisted().pending.some(entry => entry.token === "pending-255")).toBe(true); stop();
  });
  it("keeps guest arrays independent and local, while rejecting new adult payloads outside actual server constraints", async () => {
    expect(readingLibraryStorageKey(null)).toBe("probpera-reading-library");
    expect(readingLibraryStorageKey("user/a")).toBe("probpera-reading-library:user:user%2Fa");
    const guest = fixture([], false), stopGuest = guest.controller.activate();
    const longBook = { ...book("x".repeat(300)), title: "title".repeat(80) };
    expect(await guest.controller.save(longBook)).toBe(true); guest.controller.setDossierProgress(longBook.id, progress("guest"));
    guest.controller.setStatus(longBook.id, "book", "reading"); await flush();
    expect(JSON.parse(guest.raw())[0]).toMatchObject({ status: "reading", dossierProgress: progress("guest") });
    expect(guest.controller.getSyncSnapshot().status).toBe("local");
    expect(await guest.controller.remove(longBook.id, "book")).toBe(true);
    for (const method of Object.values(guest.remote)) expect(method).not.toHaveBeenCalled(); stopGuest();
    const adult = fixture([book()]), stopAdult = adult.controller.activate(); await flush();
    expect(await adult.controller.save({ ...book(), title: longBook.title })).toBe(false);
    expect(adult.controller.getSnapshot()[0].title).toBe("book-a"); expect(adult.remote.save).not.toHaveBeenCalled(); stopAdult();
  });
  it("revalidates authority after a reentrant observer and cleans a synchronously revoked listener without transport", async () => {
    const f = fixture(), cleanup = vi.fn(); let owns = true;
    const controller = createReadingLibraryController({ ...f.options, isCurrent: () => owns,
      listen: (_external, online) => { owns = false; online(); return cleanup; } });
    const stop = controller.activate(); await flush(); expect(cleanup).toHaveBeenCalledOnce();
    expect(f.remote.read).not.toHaveBeenCalled(); expect(f.remote.save).not.toHaveBeenCalled(); stop();
    const next = fixture(), stopNext = next.controller.activate(); await flush();
    const unsubscribe = next.controller.subscribe(() => { if (next.controller.getSnapshot().length) next.switchIdentity(); });
    expect(await next.controller.save(book())).toBe(true); await flush();
    expect(next.remote.save).not.toHaveBeenCalled(); expect(next.persisted().pending).toHaveLength(1); unsubscribe(); stopNext();
  });
});


it("privacy cleanup permanently seals cached library and rejects its late hydration/acknowledgement", async () => {
  const env = fixture([book("private-a")]), late = deferred<{ data: unknown; error: unknown }>();
  env.remote.read.mockReturnValue(late.promise);
  const stop = env.controller.activate(); await flush();
  env.controller.forget(); const writes = env.port.setItem.mock.calls.length;
  late.resolve({ data: [remoteRow(book("late-private-a"))], error: null }); await flush();
  const old = env.controller.activate();
  expect(env.controller.getSnapshot()).toEqual([]); expect(await env.controller.save(book("forbidden-after-logout"))).toBe(false);
  expect(env.port.setItem).toHaveBeenCalledTimes(writes); stop(); old();
});
