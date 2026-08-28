import {
  BOOK_ARCHIVE_SORTS,
  type BookArchiveSort,
} from "./bookArchiveFacets";
import {
  bookScenePresetIds,
  type BookScenePresetId,
} from "./bookArchiveSceneSettings";
import {
  BOOK_COLLECTION_ICON_IDS,
  type BookCollectionIconId,
} from "./bookCollections";

export type BookCollectionManagerBookItem = Readonly<{
  bookKey: string;
  title: string;
  writer?: string;
  missing?: boolean;
}>;

export type BookCollectionMoveCommand = "first" | "up" | "down" | "last";
export type BookCollectionDropPlacement = "before" | "after";

export type BookCollectionManagerDraftInput = Readonly<{
  title: unknown;
  description?: unknown;
  icon?: unknown;
  backgroundPreset: unknown;
  dynamicBookThemes: unknown;
  themeIntensity: unknown;
  sortMode: unknown;
}>;

export type BookCollectionManagerUpdate = Readonly<{
  title: string;
  description?: string;
  icon: BookCollectionIconId;
  backgroundPreset: BookScenePresetId;
  dynamicBookThemes: boolean;
  themeIntensity: number;
  sortMode: BookArchiveSort;
}>;

const forbiddenControlPattern =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const unsafeTextPattern = /[<>]|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/iu;

const safeText = (value: unknown, maximum: number) => {
  if (typeof value !== "string" || forbiddenControlPattern.test(value)) {
    return null;
  }
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maximum || unsafeTextPattern.test(normalized)) {
    return null;
  }
  return normalized;
};

export function normalizeBookCollectionManagerDraft(
  input: BookCollectionManagerDraftInput
): BookCollectionManagerUpdate | null {
  const title = safeText(input.title, 120);
  const rawDescription =
    typeof input.description === "string" ? input.description.trim() : "";
  const description = rawDescription
    ? safeText(rawDescription, 800)
    : undefined;
  const preset = bookScenePresetIds.includes(input.backgroundPreset as never)
    ? (input.backgroundPreset as BookScenePresetId)
    : null;
  const icon = BOOK_COLLECTION_ICON_IDS.includes(
    (input.icon === undefined ? "book" : input.icon) as never,
  )
    ? ((input.icon === undefined ? "book" : input.icon) as BookCollectionIconId)
    : null;
  const sortMode = BOOK_ARCHIVE_SORTS.includes(input.sortMode as never)
    ? (input.sortMode as BookArchiveSort)
    : null;
  const intensity = Number(input.themeIntensity);
  if (
    !title ||
    (rawDescription && !description) ||
    !preset ||
    !icon ||
    !sortMode ||
    typeof input.dynamicBookThemes !== "boolean" ||
    !Number.isFinite(intensity)
  ) {
    return null;
  }
  return Object.freeze({
    title,
    ...(description ? { description } : {}),
    icon,
    backgroundPreset: preset,
    dynamicBookThemes: input.dynamicBookThemes,
    themeIntensity: Math.min(100, Math.max(0, Math.round(intensity))),
    sortMode,
  });
}

export function reorderBookCollectionManagerItems(
  items: readonly BookCollectionManagerBookItem[],
  bookKey: string,
  command: BookCollectionMoveCommand
) {
  const sourceIndex = items.findIndex((item) => item.bookKey === bookKey);
  if (sourceIndex < 0 || items.length < 2) return items;
  const targetIndex =
    command === "first"
      ? 0
      : command === "last"
        ? items.length - 1
        : command === "up"
          ? Math.max(0, sourceIndex - 1)
          : Math.min(items.length - 1, sourceIndex + 1);
  if (sourceIndex === targetIndex) return items;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return Object.freeze(next);
}

export function reorderBookCollectionManagerItemsByDrop(
  items: readonly BookCollectionManagerBookItem[],
  sourceBookKey: string,
  targetBookKey: string,
  placement: BookCollectionDropPlacement,
) {
  const sourceIndex = items.findIndex((item) => item.bookKey === sourceBookKey);
  const targetIndex = items.findIndex((item) => item.bookKey === targetBookKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  const targetAfterRemoval = next.findIndex(
    (item) => item.bookKey === targetBookKey,
  );
  const insertionIndex = Math.min(
    next.length,
    targetAfterRemoval + (placement === "after" ? 1 : 0),
  );
  next.splice(insertionIndex, 0, moved);
  return Object.freeze(next);
}
