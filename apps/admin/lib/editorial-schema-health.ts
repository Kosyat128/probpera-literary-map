export const CURRENT_EDITORIAL_SCHEMA_VERSION =
  "20260902_zz_article_working_drafts_health";

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
  siteTypographyEngine?: boolean;
  siteStudioEngine?: boolean;
  visualDirectEditV2?: boolean;
  staffOwnerInvariant?: boolean;
  dataStudioIntegrity?: boolean;
  translationOperations?: boolean;
  adminMutationGuards?: boolean;
  adminAnalyticsReporting?: boolean;
  adminOpsObservability?: boolean;
  articleWorkingDrafts?: boolean;
  articleWorkingDraftPromotionCas?: boolean;
  articlePublicationRbac?: boolean;
  articleTranslationRbac?: boolean;
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
  "siteTypographyEngine",
  "siteStudioEngine",
  "visualDirectEditV2",
  "staffOwnerInvariant",
  "dataStudioIntegrity",
  "translationOperations",
  "adminMutationGuards",
  "adminAnalyticsReporting",
  "adminOpsObservability",
  "articleWorkingDrafts",
  "articleWorkingDraftPromotionCas",
  "articlePublicationRbac",
  "articleTranslationRbac",
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
  siteTypographyEngine: "шрифты и типографика сайта",
  siteStudioEngine: "Site Studio и управляемые дизайн-токены",
  visualDirectEditV2: "безопасное визуальное редактирование",
  staffOwnerInvariant: "защита последнего владельца",
  dataStudioIntegrity: "целостность Data Studio",
  translationOperations: "операционный контур переводов",
  adminMutationGuards: "атомарные административные изменения",
  adminAnalyticsReporting: "агрегированная аналитика",
  adminOpsObservability: "наблюдаемость резервного копирования",
  articleWorkingDrafts: "рабочие черновики статей",
  articleWorkingDraftPromotionCas: "атомарная публикация рабочего черновика",
  articlePublicationRbac: "права публикации статей",
  articleTranslationRbac: "права публикации переводов статей",
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
