import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  createEmptyBookCollectionSnapshot,
  mergeBookCollectionSnapshots,
  parseBookCollection,
  parseBookCollectionItem,
  parseBookCollectionSnapshot,
  parseBookFavoriteMembership,
  type BookCollection,
  type BookCollectionItem,
  type BookCollectionSnapshot,
  type BookFavoriteMembership,
} from "../books/bookCollections";
import {
  BOOK_COLLECTION_MAX_COLLECTIONS,
  BOOK_COLLECTION_DATABASE_NAME,
  BOOK_COLLECTION_MAX_FAVORITES,
  BOOK_COLLECTION_MAX_ITEMS,
  applyBookCollectionMutationBatch,
  bookCollectionStorage,
  coalesceBookCollectionMutations,
  createBookCollectionStorage,
  createBookCollectionMutation,
  type BookCollectionMutation,
  type BookCollectionStorage,
} from "../books/bookCollectionStorage";
import { useAuth } from "../community/AuthContext";
import { readerPrivacy } from "../community/readerPrivacy";
import { supabase } from "../lib/supabase";

export type BookCollectionSyncStatus =
  | "local-only"
  | "syncing"
  | "synced"
  | "error";

export type BookCollectionPersistenceStatus =
  | "unknown"
  | "persistent"
  | "session-only"
  | "error";

/** Probe after loading: a failed IndexedDB read can switch to session memory. */
export async function loadBookCollectionPersistence(
  storage: Pick<BookCollectionStorage, "load" | "isPersistent">,
) {
  const snapshot = await storage.load();
  const persistent = await storage.isPersistent();
  return { snapshot, persistence: persistent ? "persistent" as const : "session-only" as const };
}

/** Local commit and remote sync have separate failure and rollback boundaries. */
export async function commitBookCollectionUpdate(options: {
  next: BookCollectionSnapshot;
  previous: BookCollectionSnapshot;
  mutations: readonly BookCollectionMutation[];
  storage: Pick<BookCollectionStorage, "commit">;
  isCurrent: () => boolean;
  isScopeCurrent: () => boolean;
  publishSnapshot: (snapshot: BookCollectionSnapshot) => void;
  publishPersistence: (status: BookCollectionPersistenceStatus) => void;
  reportError: (reason: unknown, phase: "local" | "sync") => void;
  clearError: () => void;
  flush?: () => Promise<void>;
}): Promise<boolean> {
  if (!options.isCurrent()) return false;
  options.publishSnapshot(options.next);
  options.publishPersistence("unknown");
  let committed: Awaited<ReturnType<BookCollectionStorage["commit"]>>;
  try {
    committed = await options.storage.commit(options.next, options.mutations);
  } catch (reason) {
    if (options.isCurrent()) {
      // The storage transaction is atomic. Compensating writes could erase a
      // newer edit; only the current optimistic view returns to its prior value.
      options.publishSnapshot(options.previous);
      options.publishPersistence("error");
      options.reportError(reason, "local");
    }
    return false;
  }
  if (!options.isScopeCurrent()) return false;
  if (options.isCurrent()) {
    options.publishSnapshot(committed.snapshot);
    options.publishPersistence(committed.persistent ? "persistent" : "session-only");
    options.clearError();
  }
  if (options.flush) {
    try {
      await options.flush();
    } catch (reason) {
      if (options.isCurrent()) options.reportError(reason, "sync");
      // A server failure must never remove a successfully committed local edit.
    }
  }
  return options.isScopeCurrent();
}

type RemoteCollectionRow = {
  id: string;
  name: string;
  collection_type: string;
  system_type: string | null;
  description: string | null;
  icon: string | null;
  visibility: string;
  background_preset: string | null;
  dynamic_book_themes: boolean;
  theme_intensity: number;
  sort_mode: string;
  filter_state: unknown;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

type RemoteItemRow = {
  collection_id: string;
  book_key: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type RemoteFavoriteRow = {
  book_key: string;
  created_at: string;
  updated_at: string;
};

const collectionKey = ({ id }: Pick<BookCollection, "id">) => `collection:${id}`;
const itemKey = ({
  collectionId,
  bookKey,
}: Pick<BookCollectionItem, "collectionId" | "bookKey">) =>
  `item:${collectionId}:${bookKey}`;
const favoriteKey = ({ bookKey }: Pick<BookFavoriteMembership, "bookKey">) =>
  `favorite:${bookKey}`;

const stableJson = (value: unknown) => JSON.stringify(value);

export const findBookCollectionConflicts = (
  local: BookCollectionSnapshot,
  remote: BookCollectionSnapshot,
): readonly string[] => {
  const conflicts: string[] = [];
  const compare = <T,>(
    localValues: readonly T[],
    remoteValues: readonly T[],
    keyOf: (value: T) => string,
    comparable: (value: T) => unknown,
  ) => {
    const remoteByKey = new Map(remoteValues.map((value) => [keyOf(value), value]));
    for (const value of localValues) {
      const other = remoteByKey.get(keyOf(value));
      if (other && stableJson(comparable(value)) !== stableJson(comparable(other))) {
        conflicts.push(keyOf(value));
      }
    }
  };
  compare(local.collections, remote.collections, collectionKey, (value) => {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...content } = value;
    return content;
  });
  compare(local.items, remote.items, itemKey, (value) => {
    const { addedAt: _addedAt, updatedAt: _updatedAt, ...content } = value;
    return content;
  });
  compare(local.favorites, remote.favorites, favoriteKey, ({ bookKey }) => ({
    bookKey,
  }));
  return conflicts.sort();
};

export const applyBookCollectionMutations = applyBookCollectionMutationBatch;

export const createBookCollectionSnapshotMutations = (
  snapshot: BookCollectionSnapshot,
): readonly BookCollectionMutation[] => [
  ...snapshot.collections.map((value) =>
    createBookCollectionMutation({ kind: "collection-upsert", value })
  ),
  ...snapshot.items.map((value) =>
    createBookCollectionMutation({ kind: "item-upsert", value })
  ),
  ...snapshot.favorites.map((value) =>
    createBookCollectionMutation({ kind: "favorite-upsert", value })
  ),
];

const collectionFromRemote = (row: RemoteCollectionRow): BookCollection | null => {
  const hasFilterState =
    row.filter_state !== null &&
    typeof row.filter_state === "object" &&
    !Array.isArray(row.filter_state) &&
    Object.keys(row.filter_state).length > 0;
  return parseBookCollection({
    id: row.id,
    kind: row.collection_type,
    ...(row.system_type ? { systemType: row.system_type } : {}),
    title: row.name,
    ...(row.description ? { description: row.description } : {}),
    ...(row.icon ? { icon: row.icon } : {}),
    visibility: row.visibility,
    ...(row.background_preset ? { backgroundPreset: row.background_preset } : {}),
    dynamicBookThemes: row.dynamic_book_themes,
    themeIntensity: row.theme_intensity,
    sortMode: row.sort_mode,
    ...(hasFilterState ? { filterState: row.filter_state } : {}),
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const itemFromRemote = (row: RemoteItemRow): BookCollectionItem | null =>
  parseBookCollectionItem({
    collectionId: row.collection_id,
    bookKey: row.book_key,
    position: row.position,
    addedAt: row.created_at,
    updatedAt: row.updated_at,
  });

const favoriteFromRemote = (
  row: RemoteFavoriteRow,
): BookFavoriteMembership | null =>
  parseBookFavoriteMembership({
    bookKey: row.book_key,
    addedAt: row.created_at,
    updatedAt: row.updated_at,
  });

const readRemoteSnapshot = async (
  client: SupabaseClient,
  userId: string,
): Promise<BookCollectionSnapshot> => {
  const [collectionResult, itemResult, favoriteResult] = await Promise.all([
    client
      .from("reader_book_collections")
      .select(
        "id,name,collection_type,system_type,description,icon,visibility,background_preset,dynamic_book_themes,theme_intensity,sort_mode,filter_state,schema_version,created_at,updated_at",
      )
      .eq("user_id", userId),
    client
      .from("reader_book_collection_items")
      .select("collection_id,book_key,position,created_at,updated_at")
      .eq("user_id", userId),
    client
      .from("reader_book_favorites")
      .select("book_key,created_at,updated_at")
      .eq("user_id", userId),
  ]);
  const error = collectionResult.error || itemResult.error || favoriteResult.error;
  if (error) throw error;

  const collections = (collectionResult.data as RemoteCollectionRow[] | null ?? [])
    .map(collectionFromRemote);
  const items = (itemResult.data as RemoteItemRow[] | null ?? []).map(itemFromRemote);
  const favorites = (favoriteResult.data as RemoteFavoriteRow[] | null ?? [])
    .map(favoriteFromRemote);
  if (
    collections.some((value) => value === null) ||
    items.some((value) => value === null) ||
    favorites.some((value) => value === null)
  ) {
    throw new Error("book-collection-remote-data-invalid");
  }
  const parsed = parseBookCollectionSnapshot({
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections,
    items,
    favorites,
  });
  if (!parsed) throw new Error("book-collection-remote-snapshot-invalid");
  return parsed;
};

const remoteCollection = (value: BookCollection, userId: string) => ({
  id: value.id,
  user_id: userId,
  name: value.title,
  collection_type: value.kind,
  system_type: value.systemType ?? null,
  description: value.description ?? null,
  icon: value.icon ?? null,
  visibility: value.visibility,
  background_preset: value.backgroundPreset ?? null,
  dynamic_book_themes: value.dynamicBookThemes,
  theme_intensity: value.themeIntensity,
  sort_mode: value.sortMode,
  filter_state: value.filterState ?? {},
  schema_version: value.schemaVersion,
  created_at: value.createdAt,
  updated_at: value.updatedAt,
});

const remoteItem = (value: BookCollectionItem, userId: string) => ({
  collection_id: value.collectionId,
  user_id: userId,
  book_key: value.bookKey,
  position: value.position,
  schema_version: BOOK_COLLECTION_SCHEMA_VERSION,
  created_at: value.addedAt,
  updated_at: value.updatedAt,
});

const remoteFavorite = (value: BookFavoriteMembership, userId: string) => ({
  user_id: userId,
  book_key: value.bookKey,
  schema_version: BOOK_COLLECTION_SCHEMA_VERSION,
  created_at: value.addedAt,
  updated_at: value.updatedAt,
});

const sendMutation = async (
  client: SupabaseClient,
  userId: string,
  mutation: BookCollectionMutation,
): Promise<void> => {
  let result: { error: { message: string } | null };
  switch (mutation.kind) {
    case "collection-upsert":
      if (mutation.value.visibility !== "private") {
        throw new Error("book-collection-private-only");
      }
      result = await client
        .from("reader_book_collections")
        .upsert(remoteCollection(mutation.value, userId), { onConflict: "user_id,id" });
      break;
    case "collection-delete":
      result = await client
        .from("reader_book_collections")
        .delete()
        .eq("user_id", userId)
        .eq("id", mutation.collectionId);
      break;
    case "item-upsert":
      result = await client
        .from("reader_book_collection_items")
        .upsert(remoteItem(mutation.value, userId), {
          onConflict: "user_id,collection_id,book_key",
        });
      break;
    case "item-delete":
      result = await client
        .from("reader_book_collection_items")
        .delete()
        .eq("user_id", userId)
        .eq("collection_id", mutation.collectionId)
        .eq("book_key", mutation.bookKey);
      break;
    case "favorite-upsert":
      result = await client
        .from("reader_book_favorites")
        .upsert(remoteFavorite(mutation.value, userId), {
          onConflict: "user_id,book_key",
        });
      break;
    case "favorite-delete":
      result = await client
        .from("reader_book_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("book_key", mutation.bookKey);
      break;
  }
  if (result.error) throw result.error;
};

const legacySmartCollection = (
  value: unknown,
  importedAt: string,
): BookCollection | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const legacyId = typeof record.id === "string"
    ? record.id.trim().replace(/\./gu, "-dot-").slice(0, 192)
    : record.id;
  const filterState = record.filterState;
  const filterSort =
    filterState && typeof filterState === "object" && !Array.isArray(filterState)
      ? (filterState as Record<string, unknown>).sort
      : undefined;
  return parseBookCollection({
    id: legacyId,
    kind: "smart",
    title: record.label,
    visibility: "private",
    dynamicBookThemes: true,
    themeIntensity: 70,
    sortMode: typeof filterSort === "string" ? filterSort : "editorial-relevance",
    filterState,
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    createdAt: importedAt,
    updatedAt: importedAt,
  });
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "book-collection-sync-failed";

/** Keep a completed old account request from acknowledging or sending more work. */
export async function flushBookCollectionMutations(options: {
  storage: Pick<BookCollectionStorage, "pendingMutations" | "acknowledgeMutations">;
  send: (mutation: BookCollectionMutation) => Promise<void>;
  isScopeCurrent: () => boolean;
}): Promise<boolean> {
  if (!options.isScopeCurrent()) return false;
  const mutations = await options.storage.pendingMutations();
  for (const mutation of mutations) {
    if (!options.isScopeCurrent()) return false;
    await options.send(mutation);
    if (!options.isScopeCurrent()) return false;
    await options.storage.acknowledgeMutations([mutation.id]);
  }
  return options.isScopeCurrent();
}

export function useBookCollections() {
  const { configured, user } = useAuth();
  const storageScope = user ? `user:${user.id}` : "anonymous";
  const storage = useMemo(
    () =>
      storageScope === "anonymous"
        ? bookCollectionStorage
        : createBookCollectionStorage({
            databaseName: `${BOOK_COLLECTION_DATABASE_NAME}:${storageScope}`,
          }),
    [storageScope],
  );
  const emptySnapshot = useMemo(
    createEmptyBookCollectionSnapshot,
    [storageScope],
  );
  const operationScope = useMemo(() => ({
    active: true,
    revision: 0,
    loadRevision: 0,
    pending: new Set<number>(),
    persistence: "unknown" as BookCollectionPersistenceStatus,
  }), [storage]);
  const activeOperationScopeRef = useRef(operationScope);
  activeOperationScopeRef.current = operationScope;
  const isScopeCurrent = useCallback(
    () => activeOperationScopeRef.current === operationScope && operationScope.active,
    [operationScope],
  );
  const [scopedPersistence, setScopedPersistence] = useState(() => ({
    scope: operationScope,
    value: "unknown" as BookCollectionPersistenceStatus,
  }));
  const localPersistenceStatus = scopedPersistence.scope === operationScope
    ? scopedPersistence.value
    : "unknown";
  const publishPersistence = useCallback((value: BookCollectionPersistenceStatus) => {
    if (!isScopeCurrent()) return;
    operationScope.persistence = value;
    setScopedPersistence({ scope: operationScope, value });
  }, [isScopeCurrent, operationScope]);
  const getLocalPersistenceStatus = useCallback(
    () => isScopeCurrent() ? operationScope.persistence : "unknown" as const,
    [isScopeCurrent, operationScope],
  );
  const [scopedSnapshot, setScopedSnapshot] = useState(() => ({
    scope: operationScope,
    value: emptySnapshot,
  }));
  const snapshot =
    scopedSnapshot.scope === operationScope
      ? scopedSnapshot.value
      : emptySnapshot;
  const [status, setStatus] = useState<BookCollectionSyncStatus>("local-only");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<readonly string[]>([]);
  const snapshotRef = useRef(snapshot);
  const snapshotScopeRef = useRef(storageScope);
  const flushRef = useRef<{
    scope: typeof operationScope;
    promise: Promise<void>;
  } | null>(null);
  const flushRequestedRef = useRef(false);
  if (snapshotScopeRef.current !== storageScope) {
    snapshotScopeRef.current = storageScope;
    snapshotRef.current = emptySnapshot;
    flushRequestedRef.current = false;
  }

  useEffect(() => {
    operationScope.active = true;
    const unregister = user ? readerPrivacy.register(user.id, () => {
      operationScope.active = false; storage.close();
      setScopedSnapshot({ scope: operationScope, value: emptySnapshot });
      setScopedPersistence({ scope: operationScope, value: "unknown" });
    }) : () => {};
    return () => {
      unregister(); operationScope.active = false;
      if (storage !== bookCollectionStorage) storage.close();
    };
  }, [operationScope, storage, emptySnapshot, user?.id]);

  const publishSnapshot = useCallback((next: BookCollectionSnapshot) => {
    if (!isScopeCurrent()) return;
    snapshotRef.current = next;
    setScopedSnapshot({ scope: operationScope, value: next });
  }, [isScopeCurrent, operationScope]);

  const flush = useCallback((): Promise<void> => {
    if (!isScopeCurrent()) return Promise.resolve();
    if (!configured || !supabase || !user) {
      setStatus("local-only");
      return Promise.resolve();
    }
    const currentFlush = flushRef.current;
    if (currentFlush?.scope === operationScope) {
      flushRequestedRef.current = true;
      return currentFlush.promise.then(() => {
        if (!isScopeCurrent()) return;
        if (!flushRequestedRef.current) return;
        flushRequestedRef.current = false;
        return flush();
      });
    }
    const client = supabase;
    const userId = user.id;
    const revision = operationScope.revision;
    setStatus("syncing");
    const operation = (async () => {
      await flushBookCollectionMutations({ storage, isScopeCurrent,
        send: mutation => sendMutation(client, userId, mutation) });
      if (isScopeCurrent() && operationScope.revision === revision) {
        setError(null);
        setStatus("synced");
      }
    })().catch((reason: unknown) => {
      if (isScopeCurrent() && operationScope.revision === revision) {
        setError(errorMessage(reason));
        setStatus("error");
      }
      throw reason;
    }).finally(() => {
      if (flushRef.current?.promise === operation) flushRef.current = null;
    });
    flushRef.current = { scope: operationScope, promise: operation };
    return operation;
  }, [configured, isScopeCurrent, operationScope, storage, storageScope, user]);

  useEffect(() => {
    let active = true;
    const migrationRevision = operationScope.revision;
    const load = async () => {
      const revision = operationScope.revision;
      const loadRevision = ++operationScope.loadRevision;
      try {
        const local = await loadBookCollectionPersistence(storage);
        if (!active || !isScopeCurrent() || operationScope.revision !== revision ||
          operationScope.loadRevision !== loadRevision || operationScope.pending.size) return;
        publishSnapshot(local.snapshot);
        publishPersistence(local.persistence);
      } catch (reason) {
        if (!active || !isScopeCurrent() || operationScope.revision !== revision ||
          operationScope.loadRevision !== loadRevision || operationScope.pending.size) return;
        publishPersistence("error");
        setError(errorMessage(reason));
      }
    };
    void (async () => {
      if (storage === bookCollectionStorage) {
        await bookCollectionStorage.migrateLegacySmartShelves(legacySmartCollection);
      }
      if (active && isScopeCurrent()) await load();
    })().catch((reason: unknown) => {
      if (!active || !isScopeCurrent() || operationScope.revision !== migrationRevision) return;
      publishPersistence("error");
      setError(errorMessage(reason));
    });
    const unsubscribe = storage.subscribe(() => {
      if (!operationScope.pending.size) void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isScopeCurrent, operationScope, publishPersistence, publishSnapshot, storage]);

  useEffect(() => {
    if (!configured || !supabase || !user) {
      setStatus("local-only");
      setError(null);
      setConflicts([]);
      return;
    }
    let active = true;
    const client = supabase;
    const userId = user.id;
    const startingRevision = operationScope.revision;
    let syncRevision = startingRevision;
    setStatus("syncing");
    void (async () => {
      await bookCollectionStorage.migrateLegacySmartShelves(legacySmartCollection);
      const [local, remote, pending, anonymous, anonymousPending] =
        await Promise.all([
          storage.load(),
          readRemoteSnapshot(client, userId),
          storage.pendingMutations(),
          bookCollectionStorage.load(),
          bookCollectionStorage.pendingMutations(),
        ]);
      if (!active || !isScopeCurrent() || operationScope.revision !== startingRevision) return;
      const localWithAnonymous = mergeBookCollectionSnapshots(anonymous, local);
      const anonymousTransferMutations = coalesceBookCollectionMutations(
        createBookCollectionSnapshotMutations(anonymous),
        anonymousPending,
      );
      const combinedPending = coalesceBookCollectionMutations(
        anonymousTransferMutations,
        pending,
      );
      const conflictKeys = findBookCollectionConflicts(
        localWithAnonymous,
        remote,
      );
      const merged = applyBookCollectionMutations(
        mergeBookCollectionSnapshots(localWithAnonymous, remote),
        combinedPending,
      );
      const revision = ++operationScope.revision;
      syncRevision = revision;
      operationScope.pending.add(revision);
      publishPersistence("unknown");
      let committed: Awaited<ReturnType<BookCollectionStorage["commit"]>>;
      try {
        committed = await storage.commit(merged, combinedPending);
      } catch (reason) {
        if (active && isScopeCurrent() && operationScope.revision === revision) publishPersistence("error");
        throw reason;
      } finally {
        operationScope.pending.delete(revision);
      }
      if (!active || !isScopeCurrent() || operationScope.revision !== revision) return;
      publishSnapshot(committed.snapshot);
      publishPersistence(committed.persistent ? "persistent" : "session-only");
      if (committed.persistent && anonymousTransferMutations.length > 0) {
        await bookCollectionStorage.replace(createEmptyBookCollectionSnapshot());
        await bookCollectionStorage.acknowledgeMutations(
          anonymousPending.map(({ id }) => id),
        );
      }
      if (!active || !isScopeCurrent() || operationScope.revision !== revision) return;
      setConflicts(conflictKeys);
      setError(null);
      await flush();
    })().catch((reason: unknown) => {
      if (!active || !isScopeCurrent() || operationScope.revision !== syncRevision) return;
      setError(errorMessage(reason));
      setStatus("error");
    });
    return () => {
      active = false;
    };
  }, [configured, flush, isScopeCurrent, operationScope, publishPersistence, publishSnapshot, storage, user]);

  const commitOptimistic = useCallback(async (
    next: BookCollectionSnapshot,
    mutations: readonly BookCollectionMutation[],
  ): Promise<boolean> => {
    if (!isScopeCurrent()) return false;
    const previous = snapshotRef.current;
    const revision = ++operationScope.revision;
    operationScope.pending.add(revision);
    try {
      return await commitBookCollectionUpdate({
        next, previous, mutations, storage, isScopeCurrent,
        isCurrent: () => isScopeCurrent() && operationScope.revision === revision,
        publishSnapshot, publishPersistence,
        clearError: () => {
          setError(null);
          if (!configured || !supabase || !user) setStatus("local-only");
        },
        reportError: (reason) => {
          setError(errorMessage(reason));
          setStatus("error");
        },
        ...(configured && supabase && user ? { flush } : {}),
      });
    } finally {
      operationScope.pending.delete(revision);
    }
  }, [configured, flush, isScopeCurrent, operationScope, publishPersistence, publishSnapshot, storage, user]);

  const upsertCollection = useCallback(async (value: BookCollection) => {
    if (!isScopeCurrent()) return false;
    const safe = parseBookCollection(value);
    if (!safe) return false;
    if (safe.visibility !== "private") {
      setError("book-collection-private-only");
      return false;
    }
    const current = snapshotRef.current;
    const exists = current.collections.some(({ id }) => id === safe.id);
    if (!exists && current.collections.length >= BOOK_COLLECTION_MAX_COLLECTIONS) {
      setError("book-collection-limit-reached");
      return false;
    }
    const next = parseBookCollectionSnapshot({
      ...current,
      collections: [safe, ...current.collections.filter(({ id }) => id !== safe.id)],
    });
    return next
      ? commitOptimistic(next, [createBookCollectionMutation({
          kind: "collection-upsert",
          value: safe,
        })])
      : false;
  }, [commitOptimistic, isScopeCurrent]);

  const removeCollection = useCallback(async (collectionId: string) => {
    if (!isScopeCurrent()) return false;
    const current = snapshotRef.current;
    if (!current.collections.some(({ id }) => id === collectionId)) return true;
    const next = parseBookCollectionSnapshot({
      ...current,
      collections: current.collections.filter(({ id }) => id !== collectionId),
      items: current.items.filter((item) => item.collectionId !== collectionId),
    });
    return next
      ? commitOptimistic(next, [createBookCollectionMutation({
          kind: "collection-delete",
          collectionId,
        })])
      : false;
  }, [commitOptimistic, isScopeCurrent]);

  const addBook = useCallback(async (
    collectionId: string,
    bookKey: string,
    position?: number,
  ) => {
    if (!isScopeCurrent()) return false;
    const current = snapshotRef.current;
    if (!current.collections.some(({ id }) => id === collectionId)) return false;
    const previous = current.items.find(
      (item) => item.collectionId === collectionId && item.bookKey === bookKey,
    );
    if (!previous && current.items.length >= BOOK_COLLECTION_MAX_ITEMS) {
      setError("book-collection-item-limit-reached");
      return false;
    }
    const now = new Date().toISOString();
    const fallbackPosition = current.items.reduce(
      (maximum, item) => item.collectionId === collectionId
        ? Math.max(maximum, item.position + 1)
        : maximum,
      0,
    );
    const item = parseBookCollectionItem({
      collectionId,
      bookKey,
      position: position ?? previous?.position ?? fallbackPosition,
      addedAt: previous?.addedAt ?? now,
      updatedAt: now,
    });
    if (!item) return false;
    const next = parseBookCollectionSnapshot({
      ...current,
      items: [
        item,
        ...current.items.filter((value) => itemKey(value) !== itemKey(item)),
      ],
    });
    return next
      ? commitOptimistic(next, [createBookCollectionMutation({
          kind: "item-upsert",
          value: item,
        })])
      : false;
  }, [commitOptimistic, isScopeCurrent]);

  const removeBook = useCallback(async (collectionId: string, bookKey: string) => {
    if (!isScopeCurrent()) return false;
    const current = snapshotRef.current;
    const next = parseBookCollectionSnapshot({
      ...current,
      items: current.items.filter(
        (item) => item.collectionId !== collectionId || item.bookKey !== bookKey,
      ),
    });
    return next
      ? commitOptimistic(next, [createBookCollectionMutation({
          kind: "item-delete",
          collectionId,
          bookKey,
        })])
      : false;
  }, [commitOptimistic, isScopeCurrent]);

  const reorderBooks = useCallback(async (
    collectionId: string,
    orderedBookKeys: readonly string[],
  ) => {
    if (!isScopeCurrent()) return false;
    const current = snapshotRef.current;
    const collection = current.collections.find(({ id }) => id === collectionId);
    if (!collection || collection.kind !== "manual") return false;
    const currentItems = current.items.filter(
      (item) => item.collectionId === collectionId,
    );
    const uniqueKeys = [...new Set(orderedBookKeys)];
    const currentKeySet = new Set(currentItems.map(({ bookKey }) => bookKey));
    if (
      uniqueKeys.length !== orderedBookKeys.length ||
      uniqueKeys.length !== currentKeySet.size ||
      uniqueKeys.some((key) => !currentKeySet.has(key))
    ) {
      return false;
    }
    const currentByKey = new Map(currentItems.map((item) => [item.bookKey, item]));
    const now = new Date().toISOString();
    const reordered = uniqueKeys.flatMap((bookKey, position) => {
      const previous = currentByKey.get(bookKey);
      if (!previous) return [];
      const item = parseBookCollectionItem({
        ...previous,
        position,
        updatedAt: previous.position === position ? previous.updatedAt : now,
      });
      return item ? [item] : [];
    });
    if (reordered.length !== uniqueKeys.length) return false;
    const changed = reordered.filter(
      (item) => currentByKey.get(item.bookKey)?.position !== item.position,
    );
    if (!changed.length) return true;
    const next = parseBookCollectionSnapshot({
      ...current,
      items: [
        ...current.items.filter((item) => item.collectionId !== collectionId),
        ...reordered,
      ],
    });
    return next
      ? commitOptimistic(
          next,
          changed.map((value) =>
            createBookCollectionMutation({ kind: "item-upsert", value }),
          ),
        )
      : false;
  }, [commitOptimistic, isScopeCurrent]);

  const toggleFavorite = useCallback(async (bookKey: string) => {
    if (!isScopeCurrent()) return false;
    const current = snapshotRef.current;
    const previous = current.favorites.find((value) => value.bookKey === bookKey);
    if (!previous && current.favorites.length >= BOOK_COLLECTION_MAX_FAVORITES) {
      setError("book-favorite-limit-reached");
      return false;
    }
    if (previous) {
      const next = parseBookCollectionSnapshot({
        ...current,
        favorites: current.favorites.filter((value) => value.bookKey !== bookKey),
      });
      return next
        ? commitOptimistic(next, [createBookCollectionMutation({
            kind: "favorite-delete",
            bookKey,
          })])
        : false;
    }
    const now = new Date().toISOString();
    const favorite = parseBookFavoriteMembership({
      bookKey,
      addedAt: now,
      updatedAt: now,
    });
    if (!favorite) return false;
    const next = parseBookCollectionSnapshot({
      ...current,
      favorites: [favorite, ...current.favorites],
    });
    return next
      ? commitOptimistic(next, [createBookCollectionMutation({
          kind: "favorite-upsert",
          value: favorite,
        })])
      : false;
  }, [commitOptimistic, isScopeCurrent]);

  const favoriteKeys = useMemo(
    () => new Set(snapshot.favorites.map(({ bookKey }) => bookKey)),
    [snapshot.favorites],
  );

  return {
    snapshot,
    collections: snapshot.collections,
    items: snapshot.items,
    favorites: snapshot.favorites,
    favoriteKeys,
    status,
    localPersistenceStatus,
    getLocalPersistenceStatus,
    error,
    conflicts,
    isFavorite: (bookKey: string) => favoriteKeys.has(bookKey),
    upsertCollection,
    removeCollection,
    addBook,
    removeBook,
    reorderBooks,
    toggleFavorite,
    retrySync: flush,
  };
}
