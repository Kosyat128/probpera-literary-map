import { registryItemHash } from "./book-canon-registry.mjs";

const ITEM_TRANSCRIPTION_FIELDS = [
  "ordinal",
  "itemId",
  "itemUrl",
  "titleExact",
  "contributorExact",
];
const ITEM_EDITORIAL_FIELDS = [
  "candidateKind",
  "entityKind",
  "adjudicationStatus",
  "adjudicatedRecordKey",
  "adjudicatedAt",
  "adjudicatedBy",
  "adjudicationReason",
  "adjudicationEvidenceUrls",
];
const SOURCE_EDITORIAL_FIELDS = [
  "inventoryStatus",
  "coverageStatus",
  "notes",
];

function projectFields(value, fields) {
  return Object.fromEntries(fields.map((field) => [field, value?.[field]]));
}

export function canonItemTranscriptionProjection(item) {
  return projectFields(item, ITEM_TRANSCRIPTION_FIELDS);
}

export function canonInventoryTranscriptionProjection(inventory) {
  return {
    sourceId: inventory?.sourceId,
    items: Array.isArray(inventory?.items)
      ? inventory.items.map(canonItemTranscriptionProjection)
      : [],
  };
}

export function canonSourceTranscriptionProjection(source) {
  return {
    id: source?.id,
    authorityId: source?.authorityId,
    class: source?.class,
    scope: source?.scope,
    url: source?.url,
    snapshot: source?.snapshot,
    declaredItemCount: source?.declaredItemCount,
  };
}

export function sameCanonTranscription(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeExactCanonItemAdjudications(
  sourceId,
  freshItems,
  currentInventory
) {
  const currentItems = Array.isArray(currentInventory?.items)
    ? currentInventory.items
    : [];
  const currentByItemId = new Map(
    currentItems.map((item) => [item?.itemId, item])
  );
  let preservedCount = 0;
  const items = freshItems.map((freshItem) => {
    const currentItem = currentByItemId.get(freshItem.itemId);
    if (
      !currentItem ||
      !sameCanonTranscription(
        canonItemTranscriptionProjection(currentItem),
        canonItemTranscriptionProjection(freshItem)
      )
    ) {
      return freshItem;
    }

    preservedCount += 1;
    const merged = { ...freshItem };
    for (const field of ITEM_EDITORIAL_FIELDS) {
      if (Object.hasOwn(currentItem, field)) merged[field] = currentItem[field];
    }
    merged.itemHash = registryItemHash(sourceId, merged);
    return merged;
  });

  return {
    items,
    preservedCount,
    allItemsPreserved:
      preservedCount === freshItems.length &&
      currentItems.length === freshItems.length,
  };
}

export function preserveCanonSourceEditorialFields(
  freshSource,
  currentSource,
  preserve
) {
  if (!preserve || !currentSource) return freshSource;
  const merged = { ...freshSource };
  for (const field of SOURCE_EDITORIAL_FIELDS) {
    if (Object.hasOwn(currentSource, field)) merged[field] = currentSource[field];
  }
  return merged;
}

export function replaceCanonInventoryInSourceOrder(
  registry,
  sourceId,
  items
) {
  const inventoryBySourceId = new Map(
    (Array.isArray(registry?.inventories) ? registry.inventories : []).map(
      (inventory) => [inventory?.sourceId, inventory]
    )
  );
  return (Array.isArray(registry?.sources) ? registry.sources : []).map(
    (source) => {
      if (source?.id === sourceId) return { sourceId, items };
      const inventory = inventoryBySourceId.get(source?.id);
      if (!inventory) {
        throw new Error(`Canon inventory is missing for source ${source?.id}.`);
      }
      return inventory;
    }
  );
}
