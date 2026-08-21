export type EditorialSchemaHealth = {
  version?: string;
  outbox?: boolean;
  outboxRpc?: boolean;
  migrationLedger?: boolean;
  publicationTriggers?: boolean;
  pendingPublicBuilds?: number;
  revisionHistory?: boolean;
  workTranslations?: boolean;
  workCoverArtworks?: boolean;
  countryOverrides?: boolean;
  writerOverrides?: boolean;
  homepageMove?: boolean;
  tagsUpdatedAt?: boolean;
};

export const EDITORIAL_SCHEMA_REQUIRED_FLAGS = [
  "outbox",
  "outboxRpc",
  "migrationLedger",
  "publicationTriggers",
  "revisionHistory",
  "workTranslations",
  "workCoverArtworks",
  "countryOverrides",
  "writerOverrides",
  "homepageMove",
  "tagsUpdatedAt",
] as const;

export type EditorialSchemaRequiredFlag =
  (typeof EDITORIAL_SCHEMA_REQUIRED_FLAGS)[number];

const editorialSchemaCapabilityLabels: Record<
  EditorialSchemaRequiredFlag,
  string
> = {
  outbox: "очередь публикации",
  outboxRpc: "RPC публикации",
  migrationLedger: "журнал миграций",
  publicationTriggers: "триггеры публикации",
  revisionHistory: "история версий",
  workTranslations: "переводы произведений",
  workCoverArtworks: "редакционные обложки",
  countryOverrides: "исправления стран",
  writerOverrides: "исправления писателей",
  homepageMove: "перемещение блоков главной",
  tagsUpdatedAt: "метки времени тегов",
};

export function getMissingEditorialSchemaCapabilities(
  health: EditorialSchemaHealth | null | undefined
): string[] {
  return EDITORIAL_SCHEMA_REQUIRED_FLAGS.filter(
    (field) => health?.[field] !== true
  ).map((field) => editorialSchemaCapabilityLabels[field]);
}

export function isEditorialSchemaReady(
  health: EditorialSchemaHealth | null | undefined
): boolean {
  return getMissingEditorialSchemaCapabilities(health).length === 0;
}
