import { describe, expect, it } from "vitest";

import { writerBiographyFactReviews } from "./writer-biography-review-source";

describe("complete writer biography fact-review evidence", () => {
  it("keeps two independent authoritative source domains for every record", () => {
    expect(writerBiographyFactReviews).toHaveLength(1740);

    for (const record of writerBiographyFactReviews) {
      const evidence = record.claims.flatMap((claim) => claim.evidence);
      const hostnames = new Set(
        evidence.map((item) => new URL(item.url).hostname.toLowerCase())
      );

      expect(evidence.length, record.key).toBeGreaterThanOrEqual(2);
      expect(hostnames.size, record.key).toBeGreaterThanOrEqual(2);
      for (const item of evidence) {
        expect(item.url, record.key).toMatch(/^https:\/\//u);
        expect(new URL(item.url).hostname, record.key).not.toMatch(
          /(?:^|\.)wiki(?:data|pedia)\.org$/iu
        );
      }
    }
  });
});
