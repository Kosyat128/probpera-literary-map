import {
  SYSTEM_BOOK_COLLECTION_IDS,
  type BookCollection,
  type BookCollectionItem,
  type BookCollectionSnapshot,
  type BookCollectionSystemType,
  type BookFavoriteMembership,
} from "./bookCollections";

export const BOOK_COLLECTION_ALL_SHELF_ID = "all";
export const BOOK_COLLECTION_FAVORITES_SHELF_ID = "favorites";

export type BookCollectionShelfSection =
  | "archive"
  | "editorial"
  | "library"
  | "personal";

export type BookCollectionShelfKind =
  | "archive"
  | "favorites"
  | BookCollection["kind"];

export type BookCollectionShelfStatus =
  | "ready"
  | "empty"
  | "partial"
  | "missing"
  | "unresolved";

export type BookCollectionMissingReference = Readonly<{
  shelfId: string;
  bookKey: string;
  source: "membership" | "favorite" | "smart-result";
  position: number;
  removable: boolean;
}>;

export type BookCollectionShelfOption = Readonly<{
  id: string;
  title: string;
  description: string;
  section: BookCollectionShelfSection;
  kind: BookCollectionShelfKind;
  collection: BookCollection | null;
  private: boolean;
  manageable: boolean;
  status: BookCollectionShelfStatus;
  count: number;
  referenceCount: number;
  missingCount: number;
  candidateKeys: readonly string[];
  candidateKeySet: ReadonlySet<string>;
  missingReferences: readonly BookCollectionMissingReference[];
}>;

export type BookCollectionShelfGroup = Readonly<{
  id: BookCollectionShelfSection;
  title: string;
  options: readonly BookCollectionShelfOption[];
}>;

export type BookCollectionShelfSelection = Readonly<{
  groups: readonly BookCollectionShelfGroup[];
  options: readonly BookCollectionShelfOption[];
  activeShelfId: string;
  activeOption: BookCollectionShelfOption;
  candidateKeys: readonly string[];
  candidateKeySet: ReadonlySet<string>;
  missingReferences: readonly BookCollectionMissingReference[];
}>;

export type BookCollectionShelfSelectorLabels = Readonly<{
  allArchive: string;
  favorites: string;
  archiveSection: string;
  editorialSection: string;
  librarySection: string;
  personalSection: string;
}>;

export type BookCollectionShelfSelectorInput = Readonly<{
  archiveBookKeys: readonly string[];
  systemSnapshot: BookCollectionSnapshot;
  personalSnapshot: BookCollectionSnapshot;
  editorialSnapshot?: BookCollectionSnapshot;
  smartCandidateKeys?: ReadonlyMap<string, readonly string[]>;
  activeShelfId?: string | null;
  labels?: Partial<BookCollectionShelfSelectorLabels>;
}>;

const defaultLabels: BookCollectionShelfSelectorLabels = Object.freeze({
  allArchive: "Весь архив",
  favorites: "Избранное",
  archiveSection: "Архив",
  editorialSection: "Редакционные полки",
  librarySection: "Моя библиотека",
  personalSection: "Мои полки",
});

type CandidateReference = Readonly<{
  bookKey: string;
  source: BookCollectionMissingReference["source"];
  position: number;
  removable: boolean;
}>;

const systemTypeOrder: Readonly<Record<BookCollectionSystemType, number>> =
  Object.freeze({
    library: 0,
    "want-to-read": 2,
    reading: 3,
    finished: 4,
  });

const normalizeKeys = (keys: readonly string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of keys) {
    const key = String(value || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return Object.freeze(normalized);
};

const collectionItems = (
  items: readonly BookCollectionItem[],
  collectionId: string
) =>
  [...items]
    .filter((item) => item.collectionId === collectionId)
    .sort(
      (left, right) =>
        left.position - right.position ||
        left.bookKey.localeCompare(right.bookKey, "en")
    );

const membershipReferences = (
  items: readonly BookCollectionItem[],
  collection: BookCollection
): readonly CandidateReference[] =>
  collectionItems(items, collection.id).map((item) => ({
    bookKey: item.bookKey,
    source: "membership",
    position: item.position,
    removable:
      collection.kind === "manual" || collection.kind === "system",
  }));

const favoriteReferences = (
  favorites: readonly BookFavoriteMembership[]
): readonly CandidateReference[] =>
  favorites.map((favorite, position) => ({
    bookKey: favorite.bookKey,
    source: "favorite",
    position,
    removable: true,
  }));

const statusFor = (
  candidateCount: number,
  referenceCount: number,
  missingCount: number,
  unresolved: boolean
): BookCollectionShelfStatus => {
  if (unresolved) return "unresolved";
  if (referenceCount === 0) return "empty";
  if (missingCount === referenceCount) return "missing";
  if (missingCount > 0) return "partial";
  return candidateCount > 0 ? "ready" : "empty";
};

function optionFromReferences({
  id,
  title,
  description = "",
  section,
  kind,
  collection,
  private: isPrivate,
  manageable,
  references,
  archiveKeySet,
  unresolved = false,
}: {
  id: string;
  title: string;
  description?: string;
  section: BookCollectionShelfSection;
  kind: BookCollectionShelfKind;
  collection: BookCollection | null;
  private: boolean;
  manageable: boolean;
  references: readonly CandidateReference[];
  archiveKeySet: ReadonlySet<string>;
  unresolved?: boolean;
}): BookCollectionShelfOption {
  const seen = new Set<string>();
  const candidateKeys: string[] = [];
  const missingReferences: BookCollectionMissingReference[] = [];
  for (const reference of references) {
    const key = String(reference.bookKey || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (archiveKeySet.has(key)) {
      candidateKeys.push(key);
      continue;
    }
    missingReferences.push(
      Object.freeze({
        shelfId: id,
        bookKey: key,
        source: reference.source,
        position: reference.position,
        removable: reference.removable,
      })
    );
  }
  const frozenCandidateKeys = Object.freeze(candidateKeys);
  const frozenMissingReferences = Object.freeze(missingReferences);
  const referenceCount = seen.size;
  return Object.freeze({
    id,
    title,
    description,
    section,
    kind,
    collection,
    private: isPrivate,
    manageable,
    status: statusFor(
      candidateKeys.length,
      referenceCount,
      missingReferences.length,
      unresolved
    ),
    count: candidateKeys.length,
    referenceCount,
    missingCount: missingReferences.length,
    candidateKeys: frozenCandidateKeys,
    candidateKeySet: new Set(frozenCandidateKeys),
    missingReferences: frozenMissingReferences,
  });
}

const optionForCollection = ({
  collection,
  items,
  section,
  archiveKeySet,
  smartCandidateKeys,
}: {
  collection: BookCollection;
  items: readonly BookCollectionItem[];
  section: BookCollectionShelfSection;
  archiveKeySet: ReadonlySet<string>;
  smartCandidateKeys?: ReadonlyMap<string, readonly string[]>;
}) => {
  const smartKeys =
    collection.kind === "smart"
      ? smartCandidateKeys?.get(collection.id)
      : undefined;
  const references: readonly CandidateReference[] =
    collection.kind === "smart"
      ? (smartKeys || []).map((bookKey, position) => ({
          bookKey,
          source: "smart-result",
          position,
          removable: false,
        }))
      : membershipReferences(items, collection);
  return optionFromReferences({
    id: collection.id,
    title: collection.title,
    description: collection.description || "",
    section,
    kind: collection.kind,
    collection,
    private: collection.visibility === "private",
    manageable:
      collection.visibility === "private" &&
      (collection.kind === "manual" || collection.kind === "smart"),
    references,
    archiveKeySet,
    unresolved: collection.kind === "smart" && smartKeys === undefined,
  });
};

const sortByTitle = (
  left: BookCollectionShelfOption,
  right: BookCollectionShelfOption
) => left.title.localeCompare(right.title, "ru") || left.id.localeCompare(right.id, "en");

/**
 * Builds the DOM switcher model and the exact logical key scope. It never
 * substitutes a missing work and never treats a saved entry as a favourite.
 */
export function selectBookCollectionShelf(
  input: BookCollectionShelfSelectorInput
): BookCollectionShelfSelection {
  const labels = Object.freeze({ ...defaultLabels, ...input.labels });
  const archiveBookKeys = normalizeKeys(input.archiveBookKeys);
  const archiveKeySet = new Set(archiveBookKeys);
  const allOption = optionFromReferences({
    id: BOOK_COLLECTION_ALL_SHELF_ID,
    title: labels.allArchive,
    section: "archive",
    kind: "archive",
    collection: null,
    private: false,
    manageable: false,
    references: archiveBookKeys.map((bookKey, position) => ({
      bookKey,
      source: "membership",
      position,
      removable: false,
    })),
    archiveKeySet,
  });

  const editorialOptions = input.editorialSnapshot
    ? input.editorialSnapshot.collections
        .filter((collection) => collection.kind === "editorial")
        .map((collection) =>
          optionForCollection({
            collection,
            items: input.editorialSnapshot!.items,
            section: "editorial",
            archiveKeySet,
          })
        )
        .sort(sortByTitle)
    : [];

  const systemOptions = input.systemSnapshot.collections
    .filter(
      (collection): collection is BookCollection & {
        kind: "system";
        systemType: BookCollectionSystemType;
      } => collection.kind === "system" && Boolean(collection.systemType)
    )
    .map((collection) =>
      optionForCollection({
        collection,
        items: input.systemSnapshot.items,
        section: "library",
        archiveKeySet,
      })
    )
    .sort((left, right) => {
      const leftType = left.collection?.systemType;
      const rightType = right.collection?.systemType;
      return (
        (leftType ? systemTypeOrder[leftType] : 99) -
          (rightType ? systemTypeOrder[rightType] : 99) ||
        sortByTitle(left, right)
      );
    });

  const favoritesOption = optionFromReferences({
    id: BOOK_COLLECTION_FAVORITES_SHELF_ID,
    title: labels.favorites,
    section: "library",
    kind: "favorites",
    collection: null,
    private: true,
    manageable: false,
    references: favoriteReferences(input.personalSnapshot.favorites),
    archiveKeySet,
  });
  const libraryOption = systemOptions.find(
    (option) => option.id === SYSTEM_BOOK_COLLECTION_IDS.library
  );
  const remainingSystemOptions = systemOptions.filter(
    (option) => option !== libraryOption
  );
  const libraryOptions = Object.freeze([
    ...(libraryOption ? [libraryOption] : []),
    favoritesOption,
    ...remainingSystemOptions,
  ]);

  const personalOptions = input.personalSnapshot.collections
    .filter(
      (collection) =>
        collection.visibility === "private" &&
        (collection.kind === "manual" || collection.kind === "smart")
    )
    .map((collection) =>
      optionForCollection({
        collection,
        items: input.personalSnapshot.items,
        section: "personal",
        archiveKeySet,
        smartCandidateKeys: input.smartCandidateKeys,
      })
    )
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "manual" ? -1 : 1;
      return sortByTitle(left, right);
    });

  const groups = Object.freeze([
    Object.freeze({
      id: "archive" as const,
      title: labels.archiveSection,
      options: Object.freeze([allOption]),
    }),
    Object.freeze({
      id: "editorial" as const,
      title: labels.editorialSection,
      options: Object.freeze(editorialOptions),
    }),
    Object.freeze({
      id: "library" as const,
      title: labels.librarySection,
      options: libraryOptions,
    }),
    Object.freeze({
      id: "personal" as const,
      title: labels.personalSection,
      options: Object.freeze(personalOptions),
    }),
  ]);
  const options = Object.freeze(groups.flatMap((group) => group.options));
  const optionById = new Map<string, BookCollectionShelfOption>();
  for (const option of options) {
    if (!optionById.has(option.id)) optionById.set(option.id, option);
  }
  const requestedId = String(input.activeShelfId || "").trim();
  const activeOption = optionById.get(requestedId) || allOption;

  return Object.freeze({
    groups,
    options,
    activeShelfId: activeOption.id,
    activeOption,
    candidateKeys: activeOption.candidateKeys,
    candidateKeySet: activeOption.candidateKeySet,
    missingReferences: activeOption.missingReferences,
  });
}
