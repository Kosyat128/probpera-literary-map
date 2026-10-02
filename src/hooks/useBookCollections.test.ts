import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, vi } from "vitest";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  createEmptyBookCollectionSnapshot,
  type BookCollection,
  type BookCollectionSnapshot,
} from "../books/bookCollections";
import { createBookCollectionMutation, createBookCollectionStorage, type BookCollectionStorageCommitResult } from "../books/bookCollectionStorage";
import {
  applyBookCollectionMutations,
  createBookCollectionSnapshotMutations,
  findBookCollectionConflicts,
  commitBookCollectionUpdate,
  loadBookCollectionPersistence,
  flushBookCollectionMutations,
  type BookCollectionPersistenceStatus,
} from "./useBookCollections";

const firstTimestamp = "2026-08-27T10:00:00.000Z";
const secondTimestamp = "2026-08-27T11:00:00.000Z";

const manualCollection = (title: string, updatedAt = firstTimestamp): BookCollection => ({
  id: "manual:classics",
  kind: "manual",
  title,
  visibility: "private",
  dynamicBookThemes: true,
  themeIntensity: 70,
  sortMode: "manual",
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  createdAt: firstTimestamp,
  updatedAt,
});

test("pending offline mutations remain authoritative after first-login merge", () => {
  const collection = manualCollection("Классика");
  const source = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [collection],
    items: [{
      collectionId: collection.id,
      bookKey: "russia:tolstoy:war-and-peace",
      position: 0,
      addedAt: firstTimestamp,
      updatedAt: firstTimestamp,
    }],
    favorites: [{
      bookKey: "russia:bulgakov:master-and-margarita",
      addedAt: firstTimestamp,
      updatedAt: firstTimestamp,
    }],
  };
  const next = applyBookCollectionMutations(source, [
    createBookCollectionMutation({
      kind: "item-delete",
      collectionId: collection.id,
      bookKey: "russia:tolstoy:war-and-peace",
    }),
    createBookCollectionMutation({
      kind: "favorite-delete",
      bookKey: "russia:bulgakov:master-and-margarita",
    }),
  ]);

  assert.deepEqual(next.items, []);
  assert.deepEqual(next.favorites, []);
  assert.equal(next.collections.length, 1);
});

test("divergent local and remote entities are surfaced as deterministic conflicts", () => {
  const local = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [manualCollection("Локальная")],
  };
  const remote = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [manualCollection("Удалённая", secondTimestamp)],
  };
  assert.deepEqual(findBookCollectionConflicts(local, remote), [
    "collection:manual:classics",
  ]);
});

test("server timestamp normalization does not create a false sync conflict", () => {
  const local = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [manualCollection("Классика", firstTimestamp)],
  };
  const remote = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [manualCollection("Классика", secondTimestamp)],
  };
  assert.deepEqual(findBookCollectionConflicts(local, remote), []);
});

test("anonymous first-login transfer materializes every membership without metadata", () => {
  const snapshot = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [manualCollection("Классика")],
    items: [{
      collectionId: "manual:classics",
      bookKey: "russia:tolstoy:war-and-peace",
      position: 0,
      addedAt: firstTimestamp,
      updatedAt: firstTimestamp,
    }],
    favorites: [{
      bookKey: "russia:bulgakov:master-and-margarita",
      addedAt: firstTimestamp,
      updatedAt: firstTimestamp,
    }],
  };
  assert.deepEqual(
    createBookCollectionSnapshotMutations(snapshot).map(({ kind }) => kind),
    ["collection-upsert", "item-upsert", "favorite-upsert"],
  );
});

test("remote writes are owner-scoped and memberships never duplicate archive metadata", () => {
  const source = readFileSync(new URL("./useBookCollections.ts", import.meta.url), "utf8");
  assert.match(source, /user_id:\s*userId/u);
  assert.match(source, /\.eq\("user_id", userId\)/u);
  assert.match(source, /const remoteItem = \(value: BookCollectionItem, userId: string\)/u);
  const remoteItemBody = source.split("const remoteItem =", 2)[1]?.split("const remoteFavorite", 1)[0] ?? "";
  assert.doesNotMatch(remoteItemBody, /\b(?:title|author|cover|description)\b/iu);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|removeItem)\(/u);
  assert.match(source, /databaseName: `\$\{BOOK_COLLECTION_DATABASE_NAME\}:\$\{storageScope\}`/u);
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
};

function commitFixture(persistent: boolean) {
  const previous = createEmptyBookCollectionSnapshot();
  const next = { ...previous, collections: [manualCollection("Synthetic personal shelf")] };
  const snapshots: BookCollectionSnapshot[] = [];
  const persistence: BookCollectionPersistenceStatus[] = [];
  const reportError = vi.fn();
  const clearError = vi.fn();
  const storage = {
    commit: vi.fn(async (): Promise<BookCollectionStorageCommitResult> => ({ snapshot: next, persistent })),
    // Spies intentionally detect forbidden compensating writes after rejection.
    replace: vi.fn(), acknowledgeMutations: vi.fn(),
  };
  const options = {
    previous, next,
    mutations: [createBookCollectionMutation({ kind: "collection-upsert", value: next.collections[0] })],
    storage,
    isCurrent: () => true,
    isScopeCurrent: () => true,
    publishSnapshot: (snapshot: BookCollectionSnapshot) => { snapshots.push(snapshot); },
    publishPersistence: (status: BookCollectionPersistenceStatus) => { persistence.push(status); },
    reportError, clearError,
  };
  return { options, snapshots, persistence, reportError, clearError, storage };
}

test.each([true, false])("local commit reports actual persistent=%s without conflating usable edits and durable storage", async persistent => {
  const env = commitFixture(persistent);
  assert.equal(await commitBookCollectionUpdate(env.options), true);
  assert.equal(env.snapshots[env.snapshots.length - 1], env.options.next);
  assert.deepEqual(env.persistence, ["unknown", persistent ? "persistent" : "session-only"]);
  assert.equal(env.reportError.mock.calls.length, 0);
});

test.each([true, false])("server sync failure retains a successful local persistent=%s edit and its pending mutation", async persistent => {
  const env = commitFixture(persistent), failure = new Error("synthetic-remote-unavailable");
  const flush = vi.fn(async () => { throw failure; });
  assert.equal(await commitBookCollectionUpdate({ ...env.options, flush }), true);
  assert.equal(env.snapshots[env.snapshots.length - 1], env.options.next);
  assert.equal(env.persistence[env.persistence.length - 1], persistent ? "persistent" : "session-only");
  assert.deepEqual(env.reportError.mock.calls, [[failure, "sync"]]);
  assert.equal(env.storage.replace.mock.calls.length, 0);
  assert.equal(env.storage.acknowledgeMutations.mock.calls.length, 0);
});

test("a rejected atomic local commit changes only the current optimistic view, never rewrites storage", async () => {
  const env = commitFixture(true), failure = new Error("synthetic-transaction-rejected");
  env.storage.commit.mockRejectedValueOnce(failure);
  assert.equal(await commitBookCollectionUpdate(env.options), false);
  assert.equal(env.snapshots[env.snapshots.length - 1], env.options.previous);
  assert.deepEqual(env.persistence, ["unknown", "error"]);
  assert.deepEqual(env.reportError.mock.calls, [[failure, "local"]]);
  assert.equal(env.storage.replace.mock.calls.length, 0);
  assert.equal(env.storage.acknowledgeMutations.mock.calls.length, 0);
});

test("a scope changed away and back cannot accept the old generation's completed snapshot or persistence", async () => {
  const env = commitFixture(true), commit = deferred<BookCollectionStorageCommitResult>();
  const originalScope = { name: "user:synthetic-a" };
  let activeScope = originalScope;
  env.storage.commit.mockReturnValueOnce(commit.promise);
  const operation = commitBookCollectionUpdate({ ...env.options,
    isCurrent: () => activeScope === originalScope,
    isScopeCurrent: () => activeScope === originalScope,
  });
  activeScope = { name: "user:synthetic-b" };
  activeScope = { name: "user:synthetic-a" };
  commit.resolve({ snapshot: env.options.next, persistent: true });
  assert.equal(await operation, false);
  assert.deepEqual(env.snapshots, [env.options.next]);
  assert.deepEqual(env.persistence, ["unknown"]);
  assert.equal(env.clearError.mock.calls.length, 0);
});

test("a later completion cannot replace a newer merged snapshot or upgrade its session-only status", async () => {
  const env = commitFixture(true), first = deferred<BookCollectionStorageCommitResult>();
  let revision = 1;
  env.storage.commit.mockReturnValueOnce(first.promise);
  const older = commitBookCollectionUpdate({ ...env.options, isCurrent: () => revision === 1 });
  revision = 2;
  const merged = { ...env.options.next, favorites: [{ bookKey: "russia:tolstoy:war-and-peace", addedAt: firstTimestamp, updatedAt: firstTimestamp }] };
  env.storage.commit.mockResolvedValueOnce({ snapshot: merged, persistent: false });
  assert.equal(await commitBookCollectionUpdate({ ...env.options, next: merged, isCurrent: () => revision === 2 }), true);
  first.resolve({ snapshot: env.options.next, persistent: true });
  assert.equal(await older, true);
  assert.equal(env.snapshots[env.snapshots.length - 1], merged);
  assert.equal(env.persistence[env.persistence.length - 1], "session-only");
});

test("a superseded local failure cannot roll back a newer edit or replace its error status", async () => {
  const env = commitFixture(true), first = deferred<BookCollectionStorageCommitResult>();
  let current = true;
  env.storage.commit.mockReturnValueOnce(first.promise);
  const older = commitBookCollectionUpdate({ ...env.options, isCurrent: () => current });
  current = false;
  first.reject(new Error("synthetic-old-failure"));
  assert.equal(await older, false);
  assert.deepEqual(env.snapshots, [env.options.next]);
  assert.deepEqual(env.persistence, ["unknown"]);
  assert.equal(env.reportError.mock.calls.length, 0);
  assert.equal(env.storage.replace.mock.calls.length, 0);
});

test("the persistence probe observes a read-triggered backend downgrade instead of its old capability", async () => {
  let persistent = true;
  const snapshot = createEmptyBookCollectionSnapshot();
  const actual = await loadBookCollectionPersistence({
    load: async () => { persistent = false; return snapshot; },
    isPersistent: async () => persistent,
  });
  assert.equal(actual.snapshot, snapshot);
  assert.equal(actual.persistence, "session-only");
});

test("actual unavailable-IndexedDB storage retains a usable session edit and never reports device persistence", async () => {
  const storage = createBookCollectionStorage({ indexedDB: null, broadcastChannel: null });
  try {
    const env = commitFixture(false);
    assert.equal((await loadBookCollectionPersistence(storage)).persistence, "session-only");
    assert.equal(await commitBookCollectionUpdate({ ...env.options, storage }), true);
    const loaded = await loadBookCollectionPersistence(storage);
    assert.equal(loaded.persistence, "session-only");
    assert.deepEqual(loaded.snapshot.collections, env.options.next.collections);
  } finally {
    storage.close();
  }
});


test("account switching during a pending outbox read sends and acknowledges nothing", async () => {
  const mutation = createBookCollectionMutation({ kind: "collection-upsert", value: manualCollection("Private A") });
  const pending = deferred<readonly typeof mutation[]>(), send = vi.fn(), acknowledgeMutations = vi.fn();
  let current = true;
  const operation = flushBookCollectionMutations({ storage: { pendingMutations: () => pending.promise, acknowledgeMutations },
    send, isScopeCurrent: () => current });
  current = false; pending.resolve([mutation]);
  assert.equal(await operation, false);
  assert.equal(send.mock.calls.length, 0); assert.equal(acknowledgeMutations.mock.calls.length, 0);
});

test("A to B to A rejects the old generation after its first remote write", async () => {
  const first = createBookCollectionMutation({ kind: "collection-upsert", value: manualCollection("Private A") });
  const second = createBookCollectionMutation({ kind: "favorite-delete", bookKey: "synthetic-private-book" });
  const remote = deferred<void>(), acknowledgeMutations = vi.fn(), send = vi.fn(() => remote.promise);
  const original = {}; let active = original;
  const operation = flushBookCollectionMutations({ storage: { pendingMutations: async () => [first, second], acknowledgeMutations },
    send, isScopeCurrent: () => active === original });
  await Promise.resolve(); assert.equal(send.mock.calls.length, 1);
  active = {}; active = {}; remote.resolve();
  assert.equal(await operation, false);
  assert.equal(send.mock.calls.length, 1); assert.equal(acknowledgeMutations.mock.calls.length, 0);
});

test("a switch while acknowledging cannot send the remaining old account mutations", async () => {
  const first = createBookCollectionMutation({ kind: "collection-upsert", value: manualCollection("Private A") });
  const second = createBookCollectionMutation({ kind: "favorite-delete", bookKey: "synthetic-private-book" });
  const acknowledgement = deferred<void>(), send = vi.fn(async () => {}), acknowledgeMutations = vi.fn(() => acknowledgement.promise);
  let current = true;
  const operation = flushBookCollectionMutations({ storage: { pendingMutations: async () => [first, second], acknowledgeMutations },
    send, isScopeCurrent: () => current });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(acknowledgeMutations.mock.calls.length, 1);
  current = false; acknowledgement.resolve();
  assert.equal(await operation, false); assert.equal(send.mock.calls.length, 1);
});
