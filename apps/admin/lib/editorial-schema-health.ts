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

export function isEditorialSchemaReady(
  health: EditorialSchemaHealth | null | undefined
): boolean {
  return Boolean(
    health &&
      EDITORIAL_SCHEMA_REQUIRED_FLAGS.every((field) => health[field] === true)
  );
}
