export const BOOK_COLLECTION_MEMBERSHIP_SHELF_KINDS = [
  "system",
  "manual",
  "smart",
  "editorial",
] as const;

export type BookCollectionMembershipShelfKind =
  (typeof BOOK_COLLECTION_MEMBERSHIP_SHELF_KINDS)[number];

export type BookCollectionMembershipShelf = Readonly<{
  id: string;
  title: string;
  kind: BookCollectionMembershipShelfKind;
  checked: boolean;
  disabled?: boolean;
  description?: string;
  count?: number;
}>;

export type BookCollectionMembershipDialogModel = Readonly<{
  writableShelves: readonly BookCollectionMembershipShelf[];
  readOnlyShelfCount: number;
}>;

const writableKinds = new Set<BookCollectionMembershipShelfKind>([
  "system",
  "manual",
]);

const forbiddenTitlePattern =
  /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/iu;

export function createBookCollectionMembershipDialogModel(
  shelves: readonly BookCollectionMembershipShelf[],
): BookCollectionMembershipDialogModel {
  const seen = new Set<string>();
  const writableShelves: BookCollectionMembershipShelf[] = [];
  let readOnlyShelfCount = 0;

  for (const shelf of shelves) {
    if (!writableKinds.has(shelf.kind)) {
      readOnlyShelfCount += 1;
      continue;
    }
    if (seen.has(shelf.id)) continue;
    seen.add(shelf.id);
    writableShelves.push(shelf);
  }

  return Object.freeze({
    writableShelves: Object.freeze(writableShelves),
    readOnlyShelfCount,
  });
}

export function normalizeNewBookCollectionTitle(value: string): string | null {
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (
    normalized.length === 0 ||
    normalized.length > 120 ||
    forbiddenTitlePattern.test(normalized)
  ) {
    return null;
  }
  return normalized;
}
