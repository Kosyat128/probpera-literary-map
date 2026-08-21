import { describe, expect, it } from "vitest";
import {
  EDITORIAL_SCHEMA_REQUIRED_FLAGS,
  isEditorialSchemaReady,
  type EditorialSchemaHealth,
} from "./editorial-schema-health";

const completeHealth: EditorialSchemaHealth = {
  version: "20260820_literary_work_cover_artworks",
  outbox: true,
  outboxRpc: true,
  migrationLedger: true,
  publicationTriggers: true,
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

  it("does not report an unavailable health response as ready", () => {
    expect(isEditorialSchemaReady(null)).toBe(false);
    expect(isEditorialSchemaReady(undefined)).toBe(false);
    expect(isEditorialSchemaReady({})).toBe(false);
  });
});
