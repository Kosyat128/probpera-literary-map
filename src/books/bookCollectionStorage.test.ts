import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

import {
  BOOK_COLLECTION_MAX_PENDING_MUTATIONS,
  coalesceBookCollectionMutations,
  createBookCollectionMutation,
  createBookCollectionStorage,
} from "./bookCollectionStorage";
import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  createEmptyBookCollectionSnapshot,
  type BookCollection,
} from "./bookCollections";

const timestamp = "2026-08-27T10:00:00.000Z";

const collection = (title: string): BookCollection => ({
  id: "manual:modernism",
  kind: "manual",
  title,
  visibility: "private",
  dynamicBookThemes: true,
  themeIntensity: 70,
  sortMode: "title",
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  createdAt: timestamp,
  updatedAt: timestamp,
});

test("the bounded mutation queue coalesces rapid changes by entity", () => {
  const first = createBookCollectionMutation({
    kind: "collection-upsert",
    value: collection("Первая"),
  }, "2026-08-27T10:00:00.000Z");
  const second = createBookCollectionMutation({
    kind: "collection-upsert",
    value: collection("Обновлённая"),
  }, "2026-08-27T10:00:01.000Z");
  const favorite = createBookCollectionMutation({
    kind: "favorite-delete",
    bookKey: "russia:bulgakov:master-and-margarita",
  });

  const queue = coalesceBookCollectionMutations([first], [second, favorite]);
  assert.equal(queue.length, 2);
  assert.equal(queue[0]?.id, second.id);
  assert.equal(queue[1]?.entityKey, "favorite:russia:bulgakov:master-and-margarita");

  const overflow = Array.from(
    { length: BOOK_COLLECTION_MAX_PENDING_MUTATIONS + 1 },
    (_, index) => createBookCollectionMutation({
      kind: "favorite-delete",
      bookKey: `book:${index}`,
    }),
  );
  assert.throws(
    () => coalesceBookCollectionMutations([], overflow),
    /mutation-queue-full/,
  );
});

test("collection deletion removes dependent offline item writes", () => {
  const value = collection("Временная");
  const item = {
    collectionId: value.id,
    bookKey: "russia:tolstoy:war-and-peace",
    position: 0,
    addedAt: timestamp,
    updatedAt: timestamp,
  };
  const queue = coalesceBookCollectionMutations(
    [
      createBookCollectionMutation({ kind: "collection-upsert", value }),
      createBookCollectionMutation({ kind: "item-upsert", value: item }),
    ],
    [
      createBookCollectionMutation({
        kind: "collection-delete",
        collectionId: value.id,
      }),
    ],
  );
  assert.deepEqual(queue.map(({ kind }) => kind), ["collection-delete"]);
});

test("unavailable IndexedDB fails closed to bounded in-memory state", async () => {
  const storage = createBookCollectionStorage({
    indexedDB: null,
    broadcastChannel: null,
  });
  let notifications = 0;
  const unsubscribe = storage.subscribe(() => {
    notifications += 1;
  });
  const next = {
    ...createEmptyBookCollectionSnapshot(),
    collections: [collection("Модернизм")],
  };
  const mutation = createBookCollectionMutation({
    kind: "collection-upsert",
    value: next.collections[0],
  });

  const result = await storage.commit(next, [mutation]);
  assert.equal(result.persistent, false);
  assert.deepEqual(await storage.load(), next);
  assert.equal((await storage.pendingMutations()).length, 1);
  assert.equal(notifications, 1);

  await storage.acknowledgeMutations([mutation.id]);
  assert.deepEqual(await storage.pendingMutations(), []);
  assert.equal(await storage.isPersistent(), false);
  unsubscribe();
  storage.close();
});

test("stale tab commits merge before applying their own queued mutation", async () => {
  const storage = createBookCollectionStorage({
    indexedDB: null,
    broadcastChannel: null,
  });
  const first = collection("Первая");
  const second = { ...collection("Вторая"), id: "manual:second" };
  await storage.commit({
    ...createEmptyBookCollectionSnapshot(),
    collections: [first],
  }, [createBookCollectionMutation({ kind: "collection-upsert", value: first })]);
  await storage.commit({
    ...createEmptyBookCollectionSnapshot(),
    collections: [second],
  }, [createBookCollectionMutation({ kind: "collection-upsert", value: second })]);

  assert.deepEqual(
    (await storage.load()).collections.map(({ id }) => id),
    ["manual:modernism", "manual:second"],
  );
  storage.close();
});

test("authoritative replacement does not resurrect stale local entities", async () => {
  const storage = createBookCollectionStorage({
    indexedDB: null,
    broadcastChannel: null,
  });
  await storage.replace({
    ...createEmptyBookCollectionSnapshot(),
    collections: [collection("Устаревшая")],
  });
  await storage.replace(createEmptyBookCollectionSnapshot());
  assert.deepEqual(await storage.load(), createEmptyBookCollectionSnapshot());
  storage.close();
});

test("reconciliation keeps mutations queued during the first-login read", async () => {
  const storage = createBookCollectionStorage({
    indexedDB: null,
    broadcastChannel: null,
  });
  const value = collection("Офлайн");
  await storage.commit({
    ...createEmptyBookCollectionSnapshot(),
    collections: [value],
  }, [createBookCollectionMutation({ kind: "collection-upsert", value })]);
  const result = await storage.commit(createEmptyBookCollectionSnapshot());
  assert.deepEqual(result.snapshot.collections.map(({ id }) => id), [value.id]);
  storage.close();
});

test("legacy smart shelves are read-only and never migrate outside IndexedDB", async () => {
  let reads = 0;
  const storage = createBookCollectionStorage({
    indexedDB: null,
    broadcastChannel: null,
  });
  const result = await storage.migrateLegacySmartShelves(
    () => collection("Legacy"),
    { getItem: () => { reads += 1; return "[]"; } },
  );
  assert.deepEqual(result, { imported: 0, persistent: false, completed: false });
  assert.equal(reads, 0);
  storage.close();

  const source = readFileSync(new URL("./bookCollectionStorage.ts", import.meta.url), "utf8");
  assert.match(source, /legacyStorage\.getItem\(LEGACY_SMART_SHELVES_KEY\)/u);
  assert.doesNotMatch(source, /legacyStorage\.(?:setItem|removeItem|clear)\(/u);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|removeItem|clear)\(/u);
});
