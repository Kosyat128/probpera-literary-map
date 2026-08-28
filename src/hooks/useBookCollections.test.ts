import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  createEmptyBookCollectionSnapshot,
  type BookCollection,
} from "../books/bookCollections";
import { createBookCollectionMutation } from "../books/bookCollectionStorage";
import {
  applyBookCollectionMutations,
  createBookCollectionSnapshotMutations,
  findBookCollectionConflicts,
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
