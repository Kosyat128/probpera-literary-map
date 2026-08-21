export const CURRENT_EDITORIAL_SCHEMA_VERSION =
  "20260822_staff_editorial_read_rls";

export type EditorialSchemaHealth = {
  version?: string;
  outbox?: boolean;
  outboxRpc?: boolean;
  migrationLedger?: boolean;
  publicationTriggers?: boolean;
  staffEditorialReadPolicies?: boolean;
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
  "staffEditorialReadPolicies",
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
  staffEditorialReadPolicies: "права чтения редакции",
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
  const missingCapabilities = EDITORIAL_SCHEMA_REQUIRED_FLAGS.filter(
    (field) => health?.[field] !== true
  ).map((field) => editorialSchemaCapabilityLabels[field]);

  if (health?.version !== CURRENT_EDITORIAL_SCHEMA_VERSION) {
    missingCapabilities.unshift("актуальная версия схемы");
  }

  return missingCapabilities;
}

export function isEditorialSchemaReady(
  health: EditorialSchemaHealth | null | undefined
): boolean {
  return getMissingEditorialSchemaCapabilities(health).length === 0;
}
