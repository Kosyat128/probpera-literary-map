export const CURRENT_EDITORIAL_SCHEMA_VERSION =
  "20260830_media_studio_lifecycle";

export type EditorialSchemaHealth = {
  version?: string;
  outbox?: boolean;
  outboxRpc?: boolean;
  articleBundleRpc?: boolean;
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
  mediaStudioLifecycle?: boolean;
  mediaUsageGraph?: boolean;
  mediaSafeReplaceRpc?: boolean;
};

export const EDITORIAL_SCHEMA_REQUIRED_FLAGS = [
  "outbox",
  "outboxRpc",
  "articleBundleRpc",
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
  "mediaStudioLifecycle",
  "mediaUsageGraph",
  "mediaSafeReplaceRpc",
] as const;

export type EditorialSchemaRequiredFlag =
  (typeof EDITORIAL_SCHEMA_REQUIRED_FLAGS)[number];

const editorialSchemaCapabilityLabels: Record<
  EditorialSchemaRequiredFlag,
  string
> = {
  outbox: "очередь публикации",
  outboxRpc: "RPC публикации",
  articleBundleRpc: "атомарное сохранение статьи и перевода",
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
  mediaStudioLifecycle: "жизненный цикл медиатеки",
  mediaUsageGraph: "граф использования изображений",
  mediaSafeReplaceRpc: "безопасная атомарная замена изображений",
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
