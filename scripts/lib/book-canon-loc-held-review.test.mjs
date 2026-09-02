import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  locHeldReviewBatchFingerprint,
  locHeldReviewIssues,
} from "./book-canon-loc-held-review.mjs";
import { archiveCountries, archiveRawBooks } from "../archive-source.ts";

const LOC_OFFICIAL_HOSTS = new Set(["guides.loc.gov", "www.loc.gov"]);
const RU_OFFICIAL_HOSTS = new Set([
  "ast.ru",
  "azbooka.ru",
  "eksmo.ru",
  "rusneb.ru",
  "search.rsl.ru",
]);

function usesExactHttpsHost(value, allowedHosts) {
  if (typeof value !== "string" || value !== value.trim()) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      allowedHosts.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

async function fixture(relativePath) {
  return JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8")
  );
}

async function checkedInFixtures() {
  const [batch, canonRegistry] = await Promise.all([
    fixture("../../data/book-canon-loc-held-review-batch01.json"),
    fixture("../../data/book-canon-source-registry.json"),
  ]);
  return { batch, canonRegistry };
}

function validationContext(canonRegistry, archiveRecords = archiveRawBooks) {
  return {
    canonRegistry,
    archiveRecords,
    archiveCountries,
  };
}

describe("LoC held Work identity review batch 01", () => {
  it("passes the pinned registry, official-source and complete raw-archive contract", async () => {
    const { batch, canonRegistry } = await checkedInFixtures();

    expect(
      locHeldReviewIssues(batch, validationContext(canonRegistry))
    ).toEqual([]);
    expect(batch.batchFingerprint).toBe(locHeldReviewBatchFingerprint(batch));
    expect(batch.applicationStatus).toBe("research-only");
  });

  it("records one unique mapping, nine draft additions and no executable action", async () => {
    const { batch } = await checkedInFixtures();
    const statusCounts = Object.groupBy(
      batch.reviews,
      (review) => review.decision.status
    );

    expect(batch.reviews).toHaveLength(10);
    expect(statusCounts["accepted-mapping"]).toHaveLength(1);
    expect(statusCounts["draft-addition"]).toHaveLength(9);
    expect(statusCounts.hold || []).toHaveLength(0);
    expect(batch.summary).toEqual({
      reviewCount: 10,
      acceptedMappingCount: 1,
      draftAdditionCount: 9,
      holdCount: 0,
      productionActionCount: 0,
      canonClaimCount: 0,
    });
    expect(JSON.stringify(batch)).not.toMatch(
      /"activation"|"productionAction"|"canonClaim"\s*:/u
    );
  });

  it("maps the full LoC Beloved title to the only existing Work without creating another Work", async () => {
    const { batch } = await checkedInFixtures();
    const review = batch.reviews.find(
      (entry) => entry.reviewId === "toni-morrison-beloved"
    );

    expect(review.locIdentity).toMatchObject({
      titleExact: "Beloved: A Novel.",
      creatorExact: "Toni Morrison (b. 1931)",
      workFirstPublishedYear: 1987,
    });
    expect(review.archiveReview.exactTitleMatchRecordKeys).toEqual([
      "usa:tony_morrison:beloved",
    ]);
    expect(review.decision).toMatchObject({
      status: "accepted-mapping",
      recordKey: "usa:tony_morrison:beloved",
      sourceTitleAliasExact: "Beloved: A Novel.",
      expectedArchiveFields: {
        title: "Возлюбленная",
        originalTitle: "Beloved",
        firstPublished: 1987,
      },
    });
  });

  it("keeps The Jungle Work year separate from the displayed 1945 manifestation", async () => {
    const { batch } = await checkedInFixtures();
    const review = batch.reviews.find(
      (entry) => entry.reviewId === "upton-sinclair-the-jungle"
    );

    expect(review.locIdentity.workFirstPublishedYear).toBe(1906);
    expect(review.locIdentity.displayedManifestation).toMatchObject({
      titleExact: "The Jungle.",
      publisher: "Doubleday, Page & Company",
      year: 1945,
    });
    expect(review.ruTitle).toMatchObject({
      recommendedExact: "Джунгли",
      evidence: {
        authority:
          "Национальная электронная библиотека; запись Российской национальной библиотеки",
        recordId: "000200_000018_v19_rc_2097738",
      },
    });
  });

  it("uses only LoC for identity and description facts and official Russian title records", async () => {
    const { batch } = await checkedInFixtures();

    for (const review of batch.reviews) {
      expect(
        usesExactHttpsHost(review.locIdentity.itemUrl, LOC_OFFICIAL_HOSTS)
      ).toBe(true);
      expect(
        review.locIdentity.sources.every((source) =>
          usesExactHttpsHost(source.url, LOC_OFFICIAL_HOSTS)
        )
      ).toBe(true);
      expect(
        review.descriptionSourceUrls.every((url) =>
          usesExactHttpsHost(url, LOC_OFFICIAL_HOSTS)
        )
      ).toBe(true);
      expect(
        usesExactHttpsHost(review.ruTitle.evidence.url, RU_OFFICIAL_HOSTS)
      ).toBe(true);
      expect(review.ruTitle.recommendedExact).toBe(
        review.ruTitle.evidence.catalogTitleExact
      );
    }
  });

  it("accepts only the exact official LoC HTTPS hosts", () => {
    expect(
      usesExactHttpsHost(
        "https://www.loc.gov/exhibits/books-that-shaped-america/",
        LOC_OFFICIAL_HOSTS
      )
    ).toBe(true);
    expect(
      usesExactHttpsHost(
        "https://guides.loc.gov/this-month-in-business-history/",
        LOC_OFFICIAL_HOSTS
      )
    ).toBe(true);

    for (const value of [
      "http://www.loc.gov/exhibits/",
      "https://loc.gov/exhibits/",
      "https://evil.loc.gov/exhibits/",
      "https://www.loc.gov.example/exhibits/",
      "https://example.org/www.loc.gov/exhibits/",
      "https://user:password@www.loc.gov/exhibits/",
      "not-a-url",
    ]) {
      expect(usesExactHttpsHost(value, LOC_OFFICIAL_HOSTS), value).toBe(false);
    }
  });

  it("fails closed on registry drift, batch tampering or a newly matching archive card", async () => {
    const { batch, canonRegistry } = await checkedInFixtures();

    const tampered = structuredClone(batch);
    tampered.reviews[0].ruTitle.recommendedExact = "Дословный перевод";
    expect(
      locHeldReviewIssues(tampered, validationContext(canonRegistry))
    ).toContain("batchFingerprint is stale");

    const staleRegistryRef = structuredClone(batch);
    staleRegistryRef.reviews[0].canonHoldRef.itemHash = "0".repeat(64);
    staleRegistryRef.batchFingerprint =
      locHeldReviewBatchFingerprint(staleRegistryRef);
    expect(
      locHeldReviewIssues(staleRegistryRef, validationContext(canonRegistry))
    ).toContain("reviews[0].canonHoldRef.itemHash is stale");

    const newlyMatchedArchive = [
      ...archiveRawBooks,
      {
        ...archiveRawBooks[0],
        countryId: "usa",
        writerId: "rachel_carson",
        id: "silent-spring-review-fixture",
        title: "Безмолвная весна",
        originalTitle: "Silent Spring",
      },
    ];
    expect(
      locHeldReviewIssues(
        batch,
        validationContext(canonRegistry, newlyMatchedArchive)
      )
    ).toContain("reviews[7].archiveReview exact-title result is stale");
  });
});
