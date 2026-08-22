import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CURRENT_EDITORIAL_SCHEMA_VERSION,
  EDITORIAL_SCHEMA_REQUIRED_FLAGS,
  getMissingEditorialSchemaCapabilities,
  isEditorialSchemaReady,
  type EditorialSchemaHealth,
} from "./editorial-schema-health";

const root = path.resolve(process.cwd());
const latestSchemaMigration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260822_zz_atomic_article_bundle.sql"
  ),
  "utf8"
);
const productionMigrationPlanner = readFileSync(
  path.join(root, "scripts/database/build-production-migration-plan.mjs"),
  "utf8"
);

const completeHealth: EditorialSchemaHealth = {
  version: CURRENT_EDITORIAL_SCHEMA_VERSION,
  outbox: true,
  outboxRpc: true,
  articleBundleRpc: true,
  migrationLedger: true,
  publicationTriggers: true,
  staffEditorialReadPolicies: true,
  pendingPublicBuilds: 0,
  revisionHistory: true,
  workTranslations: true,
  workCoverArtworks: true,
  countryOverrides: true,
  writerOverrides: true,
  homepageMove: true,
  tagsUpdatedAt: true,
};

describe("editorial schema health", () => {
  it("accepts the complete current production schema contract", () => {
    expect(isEditorialSchemaReady(completeHealth)).toBe(true);
    expect(getMissingEditorialSchemaCapabilities(completeHealth)).toEqual([]);
  });

  it("keeps the admin readiness version aligned with database reconciliation", () => {
    expect(latestSchemaMigration).toContain(
      `'version', '${CURRENT_EDITORIAL_SCHEMA_VERSION}'`
    );
    expect(productionMigrationPlanner).toContain(
      `health ->> 'version' <> '${CURRENT_EDITORIAL_SCHEMA_VERSION}'`
    );
  });

  it("rejects every missing or false required database capability", () => {
    for (const field of EDITORIAL_SCHEMA_REQUIRED_FLAGS) {
      expect(
        isEditorialSchemaReady({
          ...completeHealth,
          [field]: false,
        })
      ).toBe(false);

      const withoutField = { ...completeHealth };
      delete withoutField[field];
      expect(isEditorialSchemaReady(withoutField)).toBe(false);
    }
  });

  it("rejects missing and stale schema health versions", () => {
    expect(
      getMissingEditorialSchemaCapabilities({
        ...completeHealth,
        version: "20260822_staff_editorial_read_rls",
      })
    ).toContain("актуальная версия схемы");
    expect(
      isEditorialSchemaReady({
        ...completeHealth,
        version: undefined,
      })
    ).toBe(false);
  });

  it("names the database capabilities that still need attention", () => {
    expect(
      getMissingEditorialSchemaCapabilities({
        ...completeHealth,
        articleBundleRpc: false,
        migrationLedger: false,
        staffEditorialReadPolicies: false,
      })
    ).toEqual([
      "атомарное сохранение статьи и перевода",
      "журнал миграций",
      "права чтения редакции",
    ]);
  });

  it("does not report an unavailable health response as ready", () => {
    expect(isEditorialSchemaReady(null)).toBe(false);
    expect(isEditorialSchemaReady(undefined)).toBe(false);
    expect(isEditorialSchemaReady({})).toBe(false);
  });
});
