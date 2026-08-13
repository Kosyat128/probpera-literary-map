import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import {
  countries as publicCountries,
  writerBiographyFactReviewSourceCountries as countries,
} from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH30_REVIEWER,
  writerBiographyFactReviewBatch30,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch30";

const expectedKeys = [
  "germany:hartmann_von_aue",
  "germany:heinrich_boell",
  "germany:heinrich_heine",
  "germany:heinrich_von_kleist",
  "germany:hermann_hesse",
  "germany:herta_mueller",
  "germany:johann_gottfried_herder",
  "germany:johann_wolfgang_goethe",
  "germany:lessing",
  "germany:martin_luther",
  "germany:patrick_suskind",
  "germany:paul_heyse",
  "germany:robert_musil",
  "germany:rudolf_eucken",
  "germany:sebastian_brant",
  "germany:stefan_zweig",
  "germany:theodor_fontane",
  "germany:theodor_mommsen",
  "germany:thomas_mann",
  "germany:walther_von_der_vogelweide",
  "germany:wolfram_von_eschenbach",
  "ghana:ama_ata_aidoo",
  "ghana:ayi_kwei_armah",
  "ghana:joseph_casely_hayford",
  "ghana:kofi_awoonor",
  "ghana:martin_egblewogbe",
  "ghana:nii_ayikwei_parkes",
  "greece:andreas_kalvos",
  "greece:dionysios_solomos",
  "greece:giannis_ritsos",
  "greece:giorgos_seferis",
  "greece:homer",
  "greece:nikos_kazantzakis",
  "greece:odysseas_elytis",
  "greece:sappho",
  "grenada:george_brizan",
  "grenada:julian_fedon",
  "guatemala:augusto_monterroso",
  "guatemala:enrique_gomez_carrillo",
  "guatemala:francisco_alejandro_mendez",
] as const;

const frozenBatch28Keys = [
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

const frozenBatch29Keys = [
  "france:simone_de_beauvoir",
  "france:stendhal",
  "france:sully_prudhomme",
  "france:victor_hugo",
  "france:voltaire",
  "french_guiana:leon_gontran_damas",
  "gabon:angele_rawiri",
  "gabon:florentin_moussavou_nzigu",
  "gabon:juste_auguste_kotto",
  "gabon:laurent_owondo",
  "gabon:sylvie_ntsame",
  "gambia:baaba_jobarteh",
  "gambia:lenrie_peters",
  "gambia:nana_grey_johnson",
  "gambia:tijan_sallah",
  "georgia:aka_morchiladze",
  "georgia:akaki_tsereteli",
  "georgia:galaktion_tabidze",
  "georgia:ilia_chavchavadze",
  "georgia:konstantine_gamsakhurdia",
  "georgia:nodar_dumbadze",
  "georgia:otar_chiladze",
  "georgia:shota_rustaveli",
  "georgia:vazha_pshavela",
  "germany:alfred_doblin",
  "germany:andreas_gryphius",
  "germany:anna_seghers",
  "germany:bernhard_schlink",
  "germany:bertolt_brecht",
  "germany:christa_wolf",
  "germany:christoph_martin_wieland",
  "germany:daniel_kehlmann",
  "germany:eduard_morike",
  "germany:erich_maria_remarque",
  "germany:franz_kafka",
  "germany:friedrich_schiller",
  "germany:gerhart_hauptmann",
  "germany:grimmelshausen",
  "germany:guenter_grass",
  "germany:hans_sachs",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch30.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch30.md"
);

function sourceTextForKey(key: string): string {
  const [countryId, writerId] = key.split(":");
  const writer = countries
    .find((country) => country.id === countryId)
    ?.writers.find((item) => item.id === writerId);
  if (!writer) throw new Error(`Writer not found: ${key}`);
  const text = legacyWriterBiography(writer);
  if (!text) throw new Error(`Legacy Russian biography not found: ${key}`);
  return text;
}

function sha256(text: string): string {
  return createHash("sha256")
    .update(Buffer.from(text, "utf8"))
    .digest("hex");
}

function priorReportKeys(): string[] {
  const keys: string[] = [];
  for (let batch = 1; batch <= 27; batch += 1) {
    const suffix = String(batch).padStart(2, "0");
    const report = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          `reports/writer-biography-fact-review-batch${suffix}.json`
        ),
        "utf8"
      )
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 30", () => {
  it("pins the exact 40-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorReport = priorReportKeys();
    const priorAssigned = [
      ...priorReport,
      ...frozenBatch28Keys,
      ...frozenBatch29Keys,
    ];
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const reviewQueueSet = new Set(reviewQueueKeys);
    const keys = writerBiographyFactReviewBatch30.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch30
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch30
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);

    // The report freezes the original allocation snapshot. The integrated
    // live queue is smaller because held identities from later batches,
    // including six from Batch 38 and the later Batch 39/40 holds, are now
    // quarantined; the Batch 30 slice itself must remain unchanged.
    expect(reviewQueueKeys).toHaveLength(1690);
    expect(reviewQueueSet.size).toBe(1690);
    expect(priorReport).toHaveLength(560);
    expect(new Set(priorReport).size).toBe(560);
    expect(priorAssigned).toHaveLength(640);
    expect(priorAssignedSet.size).toBe(640);
    expect(quarantineKeys).toHaveLength(79);
    expect(new Set(quarantineKeys).size).toBe(79);
    expect(keys).toEqual(expectedKeys);
    expect(applicableKeys.every((key) => reviewQueueSet.has(key))).toBe(true);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
    expect(heldKeys).toEqual(["grenada:julian_fedon"]);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(
      false
    );
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важней|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch30) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH30_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.every((claim) => claim.verdict === "not-established")
        ).toBe(true);
      } else if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "supported")
        ).toBe(true);
      } else {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "corrected")
        ).toBe(true);
      }

      for (const claim of record.claims) {
        const hostnames = new Set(
          claim.evidence.map((item) => new URL(item.url).hostname)
        );
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
        expect(hostnames.size).toBeGreaterThanOrEqual(2);
        for (const item of claim.evidence) {
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-09");
          expect(item.findingRu.trim()).not.toBe("");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch30.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(9);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(30);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(1);
  });

  it("integrates source-backed identities and dates through the build-only registry", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
      records: Array<{
        key: string;
        manualResolutions: Array<{
          field: string;
          cardValue: string;
          decision: string;
          sources: Array<{ url: string }>;
        }>;
        wikidataEvidence: {
          identityValidationStatus?: string;
          manualIdentityConfirmation?: { qid: string } | null;
        };
      }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch30.map((record) => [record.key, record])
    );
    const identityItems = factQa.wikidataIdentityReviewQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, qid }) => ({ key, qid }));
    const dateItems = factQa.wikidataDateDiscrepancyQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, field }) => ({ key, field }));
    const badQidItems = factQa.badQidIdentityQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, qid }) => ({ key, qid }));
    const calendarItems = factQa.calendarOrSourceDiscrepancyQueue.filter((item) =>
      batchKeys.has(item.key)
    );
    const qaByKey = new Map(factQa.records.map((record) => [record.key, record]));
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const runtimeReviewAggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );
    const buildSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    for (const [key, qid] of [
      ["germany:hartmann_von_aue", "Q75852"],
      ["germany:sebastian_brant", "Q60351"],
      ["germany:walther_von_der_vogelweide", "Q44385"],
      ["germany:wolfram_von_eschenbach", "Q18821"],
    ] as const) {
      expect(qaByKey.get(key)?.wikidataEvidence).toMatchObject({
        identityValidationStatus: "identity-corroborated",
        manualIdentityConfirmation: { qid },
      });
    }
    const expectedManualDateResolutions = {
      "germany:sebastian_brant": [
        ["birthDate", "1458", "corrected-card"],
      ],
      "ghana:joseph_casely_hayford": [
        ["birthDate", "1866", "reduced-conflicting-day-precision"],
        ["deathDate", "1930-08-11", "corrected-card"],
      ],
      "ghana:martin_egblewogbe": [
        ["birthDate", "1975", "reduced-unsupported-precision"],
      ],
      "ghana:nii_ayikwei_parkes": [
        ["birthDate", "1974", "reduced-unsupported-precision"],
      ],
      "greece:andreas_kalvos": [
        ["birthDate", "1792", "reduced-unsupported-precision"],
      ],
      "grenada:george_brizan": [
        ["birthDate", "1942-10-31", "corrected-card"],
        ["deathDate", "2012", "reduced-unsupported-precision"],
      ],
      "guatemala:francisco_alejandro_mendez": [
        ["deathDate", "2026-03-28", "added-source-confirmed-date"],
      ],
    } as const;
    for (const [key, expected] of Object.entries(
      expectedManualDateResolutions
    )) {
      const actual = qaByKey
        .get(key)
        ?.manualResolutions.map((item) => [
          item.field,
          item.cardValue,
          item.decision,
        ]);
      expect(actual, key).toEqual(expected);
      expect(
        qaByKey
          .get(key)
          ?.manualResolutions.every(
            (item) =>
              item.sources.length > 0 &&
              item.sources.every((source) => /^https:\/\//u.test(source.url))
          )
      ).toBe(true);
    }
    expect(qaByKey.get("germany:rudolf_eucken")?.manualResolutions).toEqual([]);
    expect(qaByKey.get("greece:giannis_ritsos")?.manualResolutions).toEqual([]);
    expect(byKey.get("germany:sebastian_brant")?.notes).toContain("1458");
    expect(byKey.get("germany:hartmann_von_aue")?.reviewedTextRu).toContain(
      "ок. 1160 — начало XIII века"
    );
    expect(byKey.get("germany:hartmann_von_aue")?.reviewedTextRu).not.toContain(
      "после 1210"
    );
    expect(byKey.get("germany:rudolf_eucken")?.notes).toContain("1926-09-14");
    expect(byKey.get("germany:rudolf_eucken")?.notes).toContain("1926-09-15");
    expect(byKey.get("ghana:joseph_casely_hayford")?.reviewedTextRu).toContain(
      "Джозеф Эфраим Кейсли-Хейфорд"
    );
    expect(byKey.get("ghana:joseph_casely_hayford")?.notes).toContain("1930-08-11");
    expect(
      byKey
        .get("ghana:joseph_casely_hayford")
        ?.claims[0]?.evidence.find((item) => item.provider === "Inner Temple")
        ?.url
    ).toBe(
      "https://www.innertemple.org.uk/celebrating-diversity-at-the-bar/joseph-ephraim-casely-hayford/"
    );
    expect(
      byKey
        .get("ghana:joseph_casely_hayford")
        ?.claims[0]?.evidence.find((item) => item.provider === "Inner Temple")
        ?.findingRu
    ).not.toContain("11 августа 1930");
    expect(
      byKey
        .get("ghana:joseph_casely_hayford")
        ?.claims[0]?.evidence.find(
          (item) => item.provider === "Encyclopaedia Africana"
        )?.findingRu
    ).toContain("11 августа 1930");
    expect(
      byKey
        .get("greece:homer")
        ?.claims[0]?.evidence.find(
          (item) => item.provider === "University College London"
        )?.url
    ).toBe(
      "https://www.ucl.ac.uk/arts-humanities/classics/events/classical-play/past-productions/2021-homers-odyssey/2021-homers-odyssey-study-guide"
    );
    expect(
      byKey
        .get("greece:sappho")
        ?.claims[0]?.evidence.find(
          (item) => item.provider === "Cambridge University Press"
        )?.url
    ).toBe(
      "https://www.cambridge.org/highereducation/books/sappho/6AA37FEF8D846985479CF107B2E6CD16"
    );
    expect(byKey.get("ghana:nii_ayikwei_parkes")?.notes).toContain("1974-04-01");
    expect(byKey.get("greece:andreas_kalvos")?.notes).toContain("1792-04");
    expect(byKey.get("greece:giannis_ritsos")?.notes).toContain("1/14 мая 1909");
    expect(byKey.get("grenada:george_brizan")?.notes).toContain("1942-10-31");
    expect(byKey.get("guatemala:francisco_alejandro_mendez")?.notes).toContain("2026-03-28");
    expect(byKey.get("grenada:julian_fedon")?.decision).toBe("held");
    const publicKeys = new Set(
      publicCountries.flatMap((country) =>
        country.writers.map((writer) => `${country.id}:${writer.id}`)
      )
    );
    expect(publicKeys.has("grenada:julian_fedon")).toBe(false);
    expect(publicKeys.has("germany:robert_musil")).toBe(true);
    expect(publicKeys.has("germany:stefan_zweig")).toBe(true);
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch30");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch30"
    );
    expect(buildSource).toContain("writerBiographyFactReviewBatch30");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch30.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch30.test.ts"
      ),
      reportPath,
      markdownReportPath,
    ];
    for (const sourcePath of sourcePaths) {
      const bytes = fs.readFileSync(sourcePath);
      const utf8 = bytes.toString("utf8");
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(
        false
      );
      expect(utf8).not.toContain(String.fromCharCode(0xfffd));
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      batch: string;
      generatedAt: string;
      selectionSnapshot: {
        reviewQueue: number;
        priorAssignedRecords: number;
        priorAssignedUnique: number;
        quarantine: number;
        boundary: number;
        boundaryUnique: number;
        overlapPriorAssigned: number;
        overlapQuarantine: number;
      };
      summary: {
        records: number;
        unchanged: number;
        corrected: number;
        held: number;
      };
      records: WriterBiographyFactReviewRecord[];
    };
    const markdown = fs.readFileSync(markdownReportPath, "utf8");

    expect(report.batch).toBe("30");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1719,
      priorAssignedRecords: 640,
      priorAssignedUnique: 640,
      quarantine: 50,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 9,
      corrected: 30,
      held: 1,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch30);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 9");
    expect(markdown).toContain("Исправлено: 30");
    expect(markdown).toContain("Удержано: 1");
    expect(markdown).toContain("overlap с Batch01–29: 0");
    expect(markdown).toContain("Q75852");
    expect(markdown).toContain("1930-08-11");
    expect(markdown).toContain("2026-03-28");
  });
});
