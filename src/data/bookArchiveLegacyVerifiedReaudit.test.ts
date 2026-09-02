import { describe, expect, it } from "vitest";

import {
  bookArchiveKey,
  buildBookArchive,
  buildPublicBookArchive,
} from "./bookArchive";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import { bookEvidenceV2LegacyVerifiedReaudit01RecordKeys } from "./countries/bookEvidenceV2LegacyVerifiedReaudit01";

describe("book archive legacy-verified Evidence V2 guard", () => {
  it("runs after archive overlays and downgrades exactly the five audited records", () => {
    const sourceStatuses = new Map(
      bookArchiveCountries.flatMap((country) =>
        country.writers.flatMap((writer) =>
          (writer.workDetails || []).map((work) => [
            bookArchiveKey(country.id, writer.id, work.id),
            work.editorial?.status,
          ])
        )
      )
    );
    const archive = buildBookArchive(bookArchiveCountries);

    for (const recordKey of bookEvidenceV2LegacyVerifiedReaudit01RecordKeys) {
      expect(sourceStatuses.get(recordKey), recordKey).toBe("verified");
      const matches = archive.filter(
        (work) =>
          bookArchiveKey(work.countryId, work.writerId, work.id) === recordKey
      );
      expect(matches, recordKey).toHaveLength(1);
      const [work] = matches;
      expect(work.editorial, recordKey).toEqual(
        expect.objectContaining({
          status: "draft",
          reviewedAt: "2026-09-02",
        })
      );
      if (work.translations?.ru) {
        expect(work.translations.ru.status, recordKey).toBe("draft");
      }
      if (work.translations?.en) {
        expect(work.translations.en.status, recordKey).toBe("draft");
      }
      expect(isPublicBook(work), recordKey).toBe(false);
    }
  });

  it("keeps all five fail-closed records out of the visitor-facing archive", () => {
    const publicKeys = new Set(
      buildPublicBookArchive(bookArchiveCountries).map((work) =>
        bookArchiveKey(work.countryId, work.writerId, work.id)
      )
    );

    for (const recordKey of bookEvidenceV2LegacyVerifiedReaudit01RecordKeys) {
      expect(publicKeys.has(recordKey), recordKey).toBe(false);
    }
  });
});
