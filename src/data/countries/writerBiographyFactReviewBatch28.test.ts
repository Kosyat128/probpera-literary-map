import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH28_REVIEWER,
  writerBiographyFactReviewBatch28,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch28";

const expectedKeys = [
  "france:balzac",
  "france:beaumarchais",
  "france:boileau",
  "france:chateaubriand",
  "france:chretien_de_troyes",
  "france:claude_simon",
  "france:corneille",
  "france:diderot",
  "france:emile_zola",
  "france:flaubert",
  "france:franck_thilliez",
  "france:francois_mauriac",
  "france:francois_rabelais",
  "france:francois_villon",
  "france:frederic_mistral",
  "france:george_sand",
  "france:henri_barbusse",
  "france:henri_bergson",
  "france:jean_paul_sartre",
  "france:joachim_du_bellay",
  "france:jules_verne",
  "france:lafontaine",
  "france:laurent_gounelle",
  "france:louis_ferdinand_celine",
  "france:marcel_proust",
  "france:marie_de_france",
  "france:maupassant",
  "france:michel_houellebecq",
  "france:moliere",
  "france:montaigne",
  "france:montesquieu",
  "france:patrick_modiano",
  "france:prosper_merimee",
  "france:racine",
  "france:roger_martin_du_gard",
  "france:romain_rolland",
  "france:ronsard",
  "france:rousseau",
  "france:saint_exupery",
  "france:saint_john_perse",
] as const;

const expectedOriginalSha256 = new Map<string, string>([
  ["france:balzac", "f6b605ec2374ced66e15b69714d29f4cc9ba4aa5d9060552548a0c64ea80edeb"],
  ["france:beaumarchais", "cf08eb82b2cb11a1a349980aaa6673a69679128c0d5b247ad8958690213071ef"],
  ["france:boileau", "1118403575ba79f4822f5b68992144ee6a91af2fc4490445c2081dcf43a87be7"],
  ["france:chateaubriand", "c55b95245a2c548f1621e5ffe39d4400b80c52033047b3b2fb2dbb1364412956"],
  ["france:chretien_de_troyes", "fbfc99240c72b83cf96071a99f765c49dd19d65b06be51d7db5e9590dcfbe841"],
  ["france:claude_simon", "6603fb553929122b285d63329c15139951cb36ec12c8ae169114ce0bfe7b0fad"],
  ["france:corneille", "f0e573cdf3acf7005b33657f8649d21883ed2424cb80f760c3874e17b01889e3"],
  ["france:diderot", "fd20f0801ee6c4382113cf0c565ea59ee70b5d6070a4a65ad5f6a95967e6faf7"],
  ["france:emile_zola", "3da41b4135edb32a183404f1e94101d9921a902d7c6594583725087eeba9929c"],
  ["france:flaubert", "6a168f1bf1a9e1893f59df5e51170c3cad1f4efe9aff1144435eb3fed8f2247a"],
  ["france:franck_thilliez", "e07f3adaec2152c54c7991448bfe43aa6431005571904f3e7f8be921982fd9c4"],
  ["france:francois_mauriac", "a63b33623f445f1e18cc92d901f8e1623fecc4bf1ad8b96a086dd2afdfe8f2f8"],
  ["france:francois_rabelais", "f513b18ba8134443ff86e8bce91b43614451a90790689c419f70606665be8df1"],
  ["france:francois_villon", "f053fdb8d280bcaf3ba0c50a17016ed1f0268d7201b443bcbb3b0469cc803979"],
  ["france:frederic_mistral", "5602fb693e4a1c592e0ef346fe52eb77386bffaf515a13b363892522f586d97f"],
  ["france:george_sand", "275472df0102eeed0b96c0aa434a844913ddf9da04b167bbbb48d309dcfe9586"],
  ["france:henri_barbusse", "6282508086d1331a1cc73a1ee6b292eb42976154038f99962175e9ce7af0012f"],
  ["france:henri_bergson", "a580abe2848c5cca1a88cd5aba99780d119e2157e41a2e26268122337e23835e"],
  ["france:jean_paul_sartre", "e60520da9b128bba1853cb1de238888abc0d4f1f3667356591da66cd8caffa17"],
  ["france:joachim_du_bellay", "7f8fb9caf9193205e154eb12f486dfc615a391d0bb77525d1f0e3461486d77b6"],
  ["france:jules_verne", "a4464867389089b8ef5cba893b545b9351d95a66511d0131d47ae4d8b9e2108b"],
  ["france:lafontaine", "b8a5f6b7de16c03074c3783baabd1fc46715a866917cc87abd481761b41ad9c3"],
  ["france:laurent_gounelle", "2c767ab48f19801ead769c471af743d47eac9fcac92211f521a8214243372e97"],
  ["france:louis_ferdinand_celine", "a5c6cdeda881339181238b18f0d579618c6efbb837e5eb374f9a19ec36bb0bda"],
  ["france:marcel_proust", "e66e1ca5d24048be1ab4277afc1704d0f14dc8c9cbea39761288e4e3e33e74ac"],
  ["france:marie_de_france", "1e5d2099e80df8581ac0a6c418ea7d99c1d59bbead3eafd29780908f63a75c95"],
  ["france:maupassant", "fe16db3075fc94a274bf39ec020f1c1e6f6a0639451ef9295cb713b56770d420"],
  ["france:michel_houellebecq", "db51b11434cf991f0531ff97163d88407b47cd2ae1303dce6c8c5c3e1dc22040"],
  ["france:moliere", "0d114e8d878da67545a3f5cd3fda1b7a4f8bf83d96f73d9586b771b862ec6d5b"],
  ["france:montaigne", "2cdc41ccff3a189cca90ee3081ce8e16c93f71dd2282f4fad5f3d43422d3a84d"],
  ["france:montesquieu", "691c31c7a395366b2324784622cf7a74b02ae9237ecd2c849a533bb4eefbe9b8"],
  ["france:patrick_modiano", "8479ed9aa744c46118a0c0a9d8f8e8738fc50838c05083d9154610726e9bb207"],
  ["france:prosper_merimee", "71dd3921739b9598a0b3cff23602615980f30589c38bc19635888d04c2fbc869"],
  ["france:racine", "8b0ebfbf099ff343bc6682da5fbf07b70abe05185a67904fa79f77509f31ca72"],
  ["france:roger_martin_du_gard", "39fa457ad4c7bd07a87c5664056730060b37efd5a7c42d87d3b1a6e9b9fed651"],
  ["france:romain_rolland", "1bfe56e5f95cc2f1c6b3d248d8a956841b341dc3399000c61c576a849a22c004"],
  ["france:ronsard", "3020a0671beff9dcf3736e652c99b45b03531d2a505cba4bc2284a948308eeb0"],
  ["france:rousseau", "295fa6a45123c12e89b9b8e5a855dcc11f7f9be08018875d0a6352dc563a69c2"],
  ["france:saint_exupery", "1a77d4e9c83d4c9fb07ee2a038a184c1f0d248a0900e8b8c4202528cf0ba48dc"],
  ["france:saint_john_perse", "1b5966bd272c31e30e03e3f75562fac7ade6e48fbfcad4c63cddb874fd30c70d"],
]);

const factQaPath = path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json");
const reportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch28.json");
const markdownReportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch28.md");

function assignedReportKeys(): string[] {
  const keys: string[] = [];
  for (let batch = 1; batch <= 27; batch += 1) {
    const suffix = String(batch).padStart(2, "0");
    const report = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `reports/writer-biography-fact-review-batch${suffix}.json`), "utf8")) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 28", () => {
  it("pins the exact frozen 40-key boundary with zero prior and quarantine overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as { reviewQueue: Array<{ key: string }> };
    const assignedKeys = assignedReportKeys();
    const quarantineKeys = quarantinedWriterIdentities.map((item) => `${item.countryId}:${item.writerId}`);
    const excluded = new Set<string>([...assignedKeys, ...quarantineKeys]);
    const queueSet = new Set(factQa.reviewQueue.map((item) => item.key));
    const keys = writerBiographyFactReviewBatch28.map((record) => record.key);

    expect(keys).toEqual(expectedKeys);
    expect(keys).toHaveLength(40);
    expect(new Set(keys).size).toBe(40);
    expect(assignedKeys).toHaveLength(560);
    expect(new Set(assignedKeys).size).toBe(560);
    expect(keys.every((key) => queueSet.has(key))).toBe(true);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins raw hashes, neutral Russian and two independent institutional sources", () => {
    const subjectiveSuperlative = /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|важнейш|главнейш|известнейш)/iu;
    const publicReviewMarker = /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch28) {
      const sentenceCount = record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;
      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(expectedOriginalSha256.get(record.key));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(80);
      expect(sentenceCount, record.key).toBeGreaterThanOrEqual(2);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(WRITER_BIOGRAPHY_FACT_REVIEW_BATCH28_REVIEWER);
      expect(record.decision).toBe("corrected");
      expect(record.applicableTextRu).toBe(record.reviewedTextRu);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      for (const claim of record.claims) {
        const hostnames = new Set(claim.evidence.map((item) => new URL(item.url).hostname));
        expect(claim.verdict).toBe("corrected");
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
        expect(hostnames.size).toBeGreaterThanOrEqual(2);
        for (const item of claim.evidence) {
          const parsedUrl = new URL(item.url);
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-09");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    expect(writerBiographyFactReviewBatch28.filter((record) => record.decision === "unchanged")).toHaveLength(0);
    expect(writerBiographyFactReviewBatch28.filter((record) => record.decision === "corrected")).toHaveLength(40);
    expect(writerBiographyFactReviewBatch28.filter((record) => record.decision === "held")).toHaveLength(0);
  });

  it("records resolved recommendations while keeping raw evidence out of runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(writerBiographyFactReviewBatch28.map((record) => [record.key, record]));
    const runtimeIndex = fs.readFileSync(path.resolve(process.cwd(), "src/data/countries/index.ts"), "utf8");
    const aggregator = fs.readFileSync(path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"), "utf8");
    const buildReviewSource = fs.readFileSync(path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"), "utf8");

    expectNoProvenLiveFactRegression(factQa, batchKeys);
    expect(byKey.get("france:chretien_de_troyes")?.notes).toContain("Q4302");
    expect(byKey.get("france:franck_thilliez")?.notes).toContain("Q779144");
    expect(byKey.get("france:franck_thilliez")?.notes).toContain("1973-10-15");
    expect(byKey.get("france:francois_rabelais")?.notes).toContain("Q131018");
    expect(byKey.get("france:racine")?.notes).toContain("Q742");
    expect(byKey.get("france:racine")?.notes).toContain("1639-12-22");
    expect(byKey.get("france:racine")?.notes).toContain("1699-04-21");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch28");
    expect(aggregator).not.toContain("writerBiographyFactReviewBatch28");
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch28");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch28.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch28.test.ts"),
      reportPath,
      markdownReportPath,
    ];
    for (const sourcePath of sourcePaths) {
      const bytes = fs.readFileSync(sourcePath);
      const utf8 = bytes.toString("utf8");
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
      expect(utf8).not.toContain(String.fromCharCode(0xfffd));
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      batch: string;
      generatedAt: string;
      boundarySnapshot: Record<string, number>;
      summary: { records: number; unchanged: number; corrected: number; held: number };
      identityAndDateRecommendations: string[];
      records: WriterBiographyFactReviewRecord[];
    };
    const markdown = fs.readFileSync(markdownReportPath, "utf8");

    expect(report.batch).toBe("28");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.boundarySnapshot).toEqual({
      reviewQueue: 1720,
      reviewQueueUnique: 1720,
      assignedRecords: 560,
      assignedUnique: 560,
      quarantine: 49,
      quarantineUnique: 49,
      eligible: 1180,
      boundary: 40,
      boundaryUnique: 40,
      overlapAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({ records: 40, unchanged: 0, corrected: 40, held: 0 });
    expect(report.records).toEqual(writerBiographyFactReviewBatch28);
    expect(report.identityAndDateRecommendations).toHaveLength(4);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 40");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("Q4302");
    expect(markdown).toContain("Q779144");
    expect(markdown).toContain("Q131018");
    expect(markdown).toContain("Q742");
  });
});
