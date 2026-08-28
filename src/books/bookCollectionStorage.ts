import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  mergeBookCollectionSnapshots,
  parseBookCollectionSnapshot,
  type BookCollection,
  type BookCollectionItem,
  type BookCollectionSnapshot,
  type BookFavoriteMembership,
} from "./bookCollections";

export const BOOK_COLLECTION_DATABASE_NAME = "probpera-book-collections";
export const BOOK_COLLECTION_DATABASE_VERSION = 1;
export const BOOK_COLLECTION_MAX_COLLECTIONS = 64;
export const BOOK_COLLECTION_MAX_ITEMS = 2_000;
export const BOOK_COLLECTION_MAX_FAVORITES = 1_000;
export const BOOK_COLLECTION_MAX_PENDING_MUTATIONS = 256;

const SNAPSHOT_STORE = "snapshots";
const MUTATION_STORE = "mutations";
const META_STORE = "meta";
const SNAPSHOT_KEY = "current";
const LEGACY_MIGRATION_KEY = "legacy-smart-shelves-v1";
const LEGACY_SMART_SHELVES_KEY = "probpera:book-smart-shelves:v1";
const CHANNEL_NAME = "probpera:book-collections:v1";

export type BookCollectionMutationInput =
  | { readonly kind: "collection-upsert"; readonly value: BookCollection }
  | { readonly kind: "collection-delete"; readonly collectionId: string }
  | { readonly kind: "item-upsert"; readonly value: BookCollectionItem }
  | {
      readonly kind: "item-delete";
      readonly collectionId: string;
      readonly bookKey: string;
    }
  | { readonly kind: "favorite-upsert"; readonly value: BookFavoriteMembership }
  | { readonly kind: "favorite-delete"; readonly bookKey: string };

export type BookCollectionMutation = BookCollectionMutationInput & {
  readonly id: string;
  readonly entityKey: string;
  readonly queuedAt: string;
};

export interface BookCollectionStorageCommitResult {
  readonly snapshot: BookCollectionSnapshot;
  readonly persistent: boolean;
}

export interface BookCollectionLegacyMigrationResult {
  readonly imported: number;
  readonly persistent: boolean;
  readonly completed: boolean;
}

export interface BookCollectionStorage {
  load(): Promise<BookCollectionSnapshot>;
  replace(snapshot: BookCollectionSnapshot): Promise<BookCollectionStorageCommitResult>;
  commit(
    snapshot: BookCollectionSnapshot,
    mutations?: readonly BookCollectionMutation[],
  ): Promise<BookCollectionStorageCommitResult>;
  pendingMutations(): Promise<readonly BookCollectionMutation[]>;
  acknowledgeMutations(ids: readonly string[]): Promise<void>;
  migrateLegacySmartShelves(
    convert: (legacyShelf: unknown, importedAt: string) => BookCollection | null,
    legacyStorage?: Pick<Storage, "getItem"> | null,
  ): Promise<BookCollectionLegacyMigrationResult>;
  subscribe(listener: () => void): () => void;
  isPersistent(): Promise<boolean>;
  close(): void;
}

export interface CreateBookCollectionStorageOptions {
  readonly indexedDB?: IDBFactory | null;
  readonly databaseName?: string;
  readonly broadcastChannel?:
    | (new (name: string) => Pick<BroadcastChannel, "close" | "postMessage" | "onmessage">)
    | null;
  readonly sourceId?: string;
}

type StoredSnapshot = {
  readonly key: typeof SNAPSHOT_KEY;
  readonly value: BookCollectionSnapshot;
};

type StoredMeta = {
  readonly key: string;
  readonly value: unknown;
};

type StorageBackend =
  | { readonly kind: "indexeddb"; readonly database: IDBDatabase }
  | { readonly kind: "memory" };

type BookCollectionBroadcastMessage = {
  readonly sourceId: string;
  readonly schemaVersion: number;
};

const emptySnapshot = (): BookCollectionSnapshot => ({
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  collections: [],
  items: [],
  favorites: [],
});

const stableSnapshot = (value: unknown): BookCollectionSnapshot => {
  const parsed = parseBookCollectionSnapshot(value);
  if (!parsed) return emptySnapshot();
  const collections = parsed.collections.slice(0, BOOK_COLLECTION_MAX_COLLECTIONS);
  const collectionIds = new Set(collections.map(({ id }) => id));
  return {
    ...parsed,
    collections,
    items: parsed.items
      .filter(({ collectionId }) => collectionIds.has(collectionId))
      .slice(0, BOOK_COLLECTION_MAX_ITEMS),
    favorites: parsed.favorites.slice(0, BOOK_COLLECTION_MAX_FAVORITES),
  };
};

const randomId = (): string => {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const mutationEntityKey = (input: BookCollectionMutationInput): string => {
  switch (input.kind) {
    case "collection-upsert":
      return `collection:${input.value.id}`;
    case "collection-delete":
      return `collection:${input.collectionId}`;
    case "item-upsert":
      return `item:${input.value.collectionId}:${input.value.bookKey}`;
    case "item-delete":
      return `item:${input.collectionId}:${input.bookKey}`;
    case "favorite-upsert":
      return `favorite:${input.value.bookKey}`;
    case "favorite-delete":
      return `favorite:${input.bookKey}`;
  }
};

export const createBookCollectionMutation = (
  input: BookCollectionMutationInput,
  queuedAt = new Date().toISOString(),
): BookCollectionMutation => ({
  ...input,
  id: randomId(),
  entityKey: mutationEntityKey(input),
  queuedAt,
});

export const coalesceBookCollectionMutations = (
  current: readonly BookCollectionMutation[],
  incoming: readonly BookCollectionMutation[],
  limit = BOOK_COLLECTION_MAX_PENDING_MUTATIONS,
): readonly BookCollectionMutation[] => {
  const byEntity = new Map<string, BookCollectionMutation>();
  for (const mutation of [...current, ...incoming]) {
    if (mutation.kind === "collection-delete") {
      for (const [key, queued] of byEntity) {
        const queuedCollectionId =
          queued.kind === "item-upsert"
            ? queued.value.collectionId
            : queued.kind === "item-delete"
              ? queued.collectionId
              : null;
        if (queuedCollectionId === mutation.collectionId) byEntity.delete(key);
      }
    } else if (mutation.kind === "item-upsert" || mutation.kind === "item-delete") {
      const collectionId =
        mutation.kind === "item-upsert"
          ? mutation.value.collectionId
          : mutation.collectionId;
      if (
        byEntity.get(`collection:${collectionId}`)?.kind ===
        "collection-delete"
      ) {
        continue;
      }
    }
    byEntity.delete(mutation.entityKey);
    byEntity.set(mutation.entityKey, mutation);
  }
  const priority = (mutation: BookCollectionMutation) =>
    mutation.kind === "collection-upsert"
      ? 0
      : mutation.kind === "collection-delete"
        ? 2
        : 1;
  const next = [...byEntity.values()].sort(
    (first, second) => priority(first) - priority(second),
  );
  if (next.length > limit) {
    throw new Error("book-collection-mutation-queue-full");
  }
  return next;
};

export const applyBookCollectionMutationBatch = (
  source: BookCollectionSnapshot,
  mutations: readonly BookCollectionMutation[],
): BookCollectionSnapshot => {
  const collections = new Map(source.collections.map((value) => [value.id, value]));
  const itemEntityKey = (value: Pick<BookCollectionItem, "collectionId" | "bookKey">) =>
    `${value.collectionId}\u0000${value.bookKey}`;
  const items = new Map(source.items.map((value) => [itemEntityKey(value), value]));
  const favorites = new Map(source.favorites.map((value) => [value.bookKey, value]));
  for (const mutation of mutations) {
    switch (mutation.kind) {
      case "collection-upsert":
        collections.set(mutation.value.id, mutation.value);
        break;
      case "collection-delete":
        collections.delete(mutation.collectionId);
        for (const [key, item] of items) {
          if (item.collectionId === mutation.collectionId) items.delete(key);
        }
        break;
      case "item-upsert":
        if (collections.has(mutation.value.collectionId)) {
          items.set(itemEntityKey(mutation.value), mutation.value);
        }
        break;
      case "item-delete":
        items.delete(itemEntityKey(mutation));
        break;
      case "favorite-upsert":
        favorites.set(mutation.value.bookKey, mutation.value);
        break;
      case "favorite-delete":
        favorites.delete(mutation.bookKey);
        break;
    }
  }
  return stableSnapshot({
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections: [...collections.values()],
    items: [...items.values()],
    favorites: [...favorites.values()],
  });
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb-request-failed"));
  });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("indexeddb-transaction-failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("indexeddb-transaction-aborted"));
  });

const openDatabase = (
  factory: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(
      databaseName,
      BOOK_COLLECTION_DATABASE_VERSION,
    );
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb-open-failed"));
    request.onblocked = () => reject(new Error("indexeddb-upgrade-blocked"));
  });

const resolveIndexedDB = (
  configured: IDBFactory | null | undefined,
): IDBFactory | null => {
  if (configured !== undefined) return configured;
  try {
    return typeof indexedDB === "undefined" ? null : indexedDB;
  } catch {
    return null;
  }
};

const resolveBroadcastChannel = (
  configured: CreateBookCollectionStorageOptions["broadcastChannel"],
): CreateBookCollectionStorageOptions["broadcastChannel"] => {
  if (configured !== undefined) return configured;
  try {
    return typeof BroadcastChannel === "undefined" ? null : BroadcastChannel;
  } catch {
    return null;
  }
};

const resolveLegacyStorage = (): Pick<Storage, "getItem"> | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const createBookCollectionStorage = (
  options: CreateBookCollectionStorageOptions = {},
): BookCollectionStorage => {
  const databaseName = options.databaseName?.trim() || BOOK_COLLECTION_DATABASE_NAME;
  if (
    databaseName.length > 240 ||
    !/^[A-Za-z0-9:_-]+$/u.test(databaseName)
  ) {
    throw new Error("book-collection-database-name-invalid");
  }
  const sourceId = options.sourceId ?? randomId();
  const listeners = new Set<() => void>();
  let memorySnapshot = emptySnapshot();
  let memoryMutations: readonly BookCollectionMutation[] = [];
  let closed = false;

  const channelConstructor = resolveBroadcastChannel(options.broadcastChannel);
  const channel = channelConstructor
    ? new channelConstructor(`${CHANNEL_NAME}:${databaseName}`)
    : null;

  const factory = resolveIndexedDB(options.indexedDB);
  let backendPromise: Promise<StorageBackend> = factory
    ? openDatabase(factory, databaseName)
        .then((database): StorageBackend => ({ kind: "indexeddb", database }))
        .catch((): StorageBackend => ({ kind: "memory" }))
    : Promise.resolve({ kind: "memory" });

  const degrade = (): StorageBackend => {
    backendPromise = Promise.resolve({ kind: "memory" });
    return { kind: "memory" };
  };

  const notify = (broadcast: boolean): void => {
    for (const listener of listeners) listener();
    if (broadcast && channel) {
      channel.postMessage({
        sourceId,
        schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
      } satisfies BookCollectionBroadcastMessage);
    }
  };

  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as Partial<BookCollectionBroadcastMessage> | null;
      if (
        !message ||
        message.sourceId === sourceId ||
        message.schemaVersion !== BOOK_COLLECTION_SCHEMA_VERSION
      ) {
        return;
      }
      notify(false);
    };
  }

  const readIndexedSnapshot = async (database: IDBDatabase) => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
    const record = await requestResult(
      transaction.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY),
    ) as StoredSnapshot | undefined;
    await transactionComplete(transaction);
    return stableSnapshot(record?.value);
  };

  const readIndexedMutations = async (
    database: IDBDatabase,
  ): Promise<readonly BookCollectionMutation[]> => {
    const transaction = database.transaction(MUTATION_STORE, "readonly");
    const records = await requestResult(
      transaction.objectStore(MUTATION_STORE).getAll(),
    ) as BookCollectionMutation[];
    await transactionComplete(transaction);
    return records
      .filter((record) => record && typeof record.entityKey === "string")
      .sort((first, second) => first.queuedAt.localeCompare(second.queuedAt))
      .slice(0, BOOK_COLLECTION_MAX_PENDING_MUTATIONS);
  };

  const commitIndexed = async (
    database: IDBDatabase,
    snapshot: BookCollectionSnapshot,
    incoming: readonly BookCollectionMutation[],
  ): Promise<{
    readonly snapshot: BookCollectionSnapshot;
    readonly mutations: readonly BookCollectionMutation[];
  }> => {
    const transaction = database.transaction(
      [SNAPSHOT_STORE, MUTATION_STORE],
      "readwrite",
    );
    const mutationStore = transaction.objectStore(MUTATION_STORE);
    const snapshotRequest = transaction.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY);
    const mutationRequest = mutationStore.getAll();
    const [stored, existing] = await Promise.all([
      requestResult(snapshotRequest) as Promise<StoredSnapshot | undefined>,
      requestResult(mutationRequest) as Promise<BookCollectionMutation[]>,
    ]);
    const mutations = coalesceBookCollectionMutations(existing, incoming);
    const committedSnapshot = mutations.length
      ? applyBookCollectionMutationBatch(
          mergeBookCollectionSnapshots(stableSnapshot(stored?.value), snapshot),
          mutations,
        )
      : snapshot;
    transaction.objectStore(SNAPSHOT_STORE).put({
      key: SNAPSHOT_KEY,
      value: committedSnapshot,
    } satisfies StoredSnapshot);
    mutationStore.clear();
    for (const mutation of mutations) mutationStore.put(mutation);
    await transactionComplete(transaction);
    return { snapshot: committedSnapshot, mutations };
  };

  const load = async (): Promise<BookCollectionSnapshot> => {
    const backend = await backendPromise;
    if (backend.kind === "memory") return memorySnapshot;
    try {
      memorySnapshot = await readIndexedSnapshot(backend.database);
      return memorySnapshot;
    } catch {
      degrade();
      return memorySnapshot;
    }
  };

  const pendingMutations = async (): Promise<readonly BookCollectionMutation[]> => {
    const backend = await backendPromise;
    if (backend.kind === "memory") return memoryMutations;
    try {
      memoryMutations = await readIndexedMutations(backend.database);
      return memoryMutations;
    } catch {
      degrade();
      return memoryMutations;
    }
  };

  const commit = async (
    value: BookCollectionSnapshot,
    incoming: readonly BookCollectionMutation[] = [],
  ): Promise<BookCollectionStorageCommitResult> => {
    const snapshot = stableSnapshot(value);
    const backend = await backendPromise;
    if (backend.kind === "indexeddb") {
      try {
        const committed = await commitIndexed(backend.database, snapshot, incoming);
        memorySnapshot = committed.snapshot;
        memoryMutations = committed.mutations;
        notify(true);
        return { snapshot: committed.snapshot, persistent: true };
      } catch (error) {
        throw error;
      }
    }
    const mutations = coalesceBookCollectionMutations(memoryMutations, incoming);
    memorySnapshot = mutations.length
      ? applyBookCollectionMutationBatch(
          mergeBookCollectionSnapshots(memorySnapshot, snapshot),
          mutations,
        )
      : snapshot;
    memoryMutations = mutations;
    notify(true);
    return { snapshot: memorySnapshot, persistent: false };
  };

  const replace = async (
    value: BookCollectionSnapshot,
  ): Promise<BookCollectionStorageCommitResult> => {
    const snapshot = stableSnapshot(value);
    const backend = await backendPromise;
    if (backend.kind === "indexeddb") {
      const transaction = backend.database.transaction(SNAPSHOT_STORE, "readwrite");
      transaction.objectStore(SNAPSHOT_STORE).put({
        key: SNAPSHOT_KEY,
        value: snapshot,
      } satisfies StoredSnapshot);
      await transactionComplete(transaction);
    }
    memorySnapshot = snapshot;
    notify(true);
    return { snapshot, persistent: backend.kind === "indexeddb" };
  };

  const acknowledgeMutations = async (ids: readonly string[]): Promise<void> => {
    if (!ids.length) return;
    const acknowledged = new Set(ids);
    const backend = await backendPromise;
    if (backend.kind === "indexeddb") {
      try {
        const transaction = backend.database.transaction(MUTATION_STORE, "readwrite");
        const store = transaction.objectStore(MUTATION_STORE);
        for (const id of acknowledged) store.delete(id);
        await transactionComplete(transaction);
        memoryMutations = memoryMutations.filter(
          (mutation) => !acknowledged.has(mutation.id),
        );
        notify(true);
        return;
      } catch (error) {
        throw error;
      }
    }
    const next = memoryMutations.filter((mutation) => !acknowledged.has(mutation.id));
    memoryMutations = next;
    notify(true);
  };

  const readMeta = async (
    database: IDBDatabase,
    key: string,
  ): Promise<unknown> => {
    const transaction = database.transaction(META_STORE, "readonly");
    const record = await requestResult(
      transaction.objectStore(META_STORE).get(key),
    ) as StoredMeta | undefined;
    await transactionComplete(transaction);
    return record?.value;
  };

  const writeMeta = async (
    database: IDBDatabase,
    key: string,
    value: unknown,
  ): Promise<void> => {
    const transaction = database.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put({ key, value } satisfies StoredMeta);
    await transactionComplete(transaction);
  };

  const migrateLegacySmartShelves = async (
    convert: (legacyShelf: unknown, importedAt: string) => BookCollection | null,
    legacyStorage: Pick<Storage, "getItem"> | null = resolveLegacyStorage(),
  ): Promise<BookCollectionLegacyMigrationResult> => {
    const backend = await backendPromise;
    if (backend.kind !== "indexeddb") {
      return { imported: 0, persistent: false, completed: false };
    }
    try {
      if (await readMeta(backend.database, LEGACY_MIGRATION_KEY)) {
        return { imported: 0, persistent: true, completed: true };
      }
      if (!legacyStorage) {
        await writeMeta(backend.database, LEGACY_MIGRATION_KEY, true);
        return { imported: 0, persistent: true, completed: true };
      }
      const serialized = legacyStorage.getItem(LEGACY_SMART_SHELVES_KEY);
      const parsed = serialized ? JSON.parse(serialized) as unknown : [];
      if (!Array.isArray(parsed)) {
        return { imported: 0, persistent: true, completed: false };
      }
      const importedAt = new Date().toISOString();
      const collections = parsed
        .map((candidate) => convert(candidate, importedAt))
        .filter((candidate): candidate is BookCollection => candidate !== null)
        .slice(0, BOOK_COLLECTION_MAX_COLLECTIONS);
      const current = await load();
      const byId = new Map(current.collections.map((collection) => [collection.id, collection]));
      const newlyImported: BookCollection[] = [];
      for (const collection of collections) {
        if (!byId.has(collection.id)) {
          byId.set(collection.id, collection);
          newlyImported.push(collection);
        }
      }
      const result = await commit({
        ...current,
        collections: [...byId.values()].slice(0, BOOK_COLLECTION_MAX_COLLECTIONS),
      }, newlyImported.map((value) => createBookCollectionMutation({
        kind: "collection-upsert",
        value,
      }, importedAt)));
      if (!result.persistent) {
        return { imported: 0, persistent: false, completed: false };
      }
      await writeMeta(backend.database, LEGACY_MIGRATION_KEY, true);
      return { imported: newlyImported.length, persistent: true, completed: true };
    } catch {
      return { imported: 0, persistent: true, completed: false };
    }
  };

  return {
    load,
    replace,
    commit,
    pendingMutations,
    acknowledgeMutations,
    migrateLegacySmartShelves,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isPersistent: async () => (await backendPromise).kind === "indexeddb",
    close: () => {
      if (closed) return;
      closed = true;
      channel?.close();
      void backendPromise.then((backend) => {
        if (backend.kind === "indexeddb") backend.database.close();
      });
      listeners.clear();
    },
  };
};

export const bookCollectionStorage = createBookCollectionStorage();
