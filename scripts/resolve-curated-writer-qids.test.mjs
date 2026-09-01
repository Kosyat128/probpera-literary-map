import { describe, expect, it } from "vitest";

import {
  CURATED_MANUAL_IDENTITY_OVERRIDES,
  EVIDENCE_BACKED_QID_REPLACEMENTS,
  addManualIdentityOverrides,
  assertResolverCachesComplete,
  collectUnresolvedAliasTerms,
  createAliasIdentity,
  filterBlockedFreshMappings,
  mergePublishedWriterMappings,
  rowsByAlias,
  selectStrictAliasWriterCandidate,
  writeAppliedWriterRegistry,
} from "./resolve-curated-writer-qids.mjs";

const candidate = (overrides = {}) => ({
  qid: "Q100",
  human: true,
  birthYears: ["1901"],
  portraitFilename: "Writer portrait.jpg",
  literaryOccupationIds: ["Q36180"],
  literaryConfirmed: true,
  descriptions: {},
  ...overrides,
});

const mapping = (wikidataId, portraitFilename) => ({
  wikidataId,
  ...(portraitFilename ? { portraitFilename } : {}),
  identityRule: "trusted-test-fixture",
  identitySignals: ["human", "literary-role"],
  sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
  checkedAt: "2026-08-31",
});

describe("curated writer exact-alias fallback", () => {
  it("collects aliases only from records unresolved by the exact-label pass", () => {
    const terms = collectUnresolvedAliasTerms([
      {
        countryId: "example",
        writer: {
          id: "first",
          name: "Псевдоним",
          fullName: "Полное имя",
        },
      },
      {
        countryId: "example",
        writer: {
          id: "second",
          name: "Псевдоним",
          fullName: "Другое имя",
        },
      },
    ]);

    expect(terms).toEqual(["Псевдоним", "Полное имя", "Другое имя"]);
  });

  it("accepts one exact alias only with the matching birth year and literary evidence", () => {
    const index = new Map([["Псевдоним", [candidate()]]]);
    const selection = selectStrictAliasWriterCandidate(
      {
        name: "Псевдоним",
        fullName: "Отсутствующее полное имя",
        birthDate: "1901-04-03",
      },
      index,
      "exact-alias-not-found"
    );

    expect(selection.reason).toBeNull();
    expect(selection.candidate?.qid).toBe("Q100");
    expect(createAliasIdentity(selection.candidate, "1901", "2026-08-31")).toEqual({
      wikidataId: "Q100",
      portraitFilename: "Writer portrait.jpg",
      identityRule: "exact-alias-and-birth-year",
      identitySignals: ["human", "exact-alias", "birth-year", "literary-role"],
      sourceUrl: "https://www.wikidata.org/wiki/Q100",
      checkedAt: "2026-08-31",
    });
  });

  it("rejects an exact alias whose Wikidata birth year does not match", () => {
    const selection = selectStrictAliasWriterCandidate(
      { name: "Same alias", birthDate: "1901-04-03" },
      new Map([
        ["Same alias", [candidate({ birthYears: ["1975"] })]],
      ]),
      "exact-alias-not-found"
    );

    expect(selection).toMatchObject({
      candidate: null,
      reason: "birth-year-mismatch-or-missing",
      expectedYear: "1901",
    });
  });

  it("allows a missing card birth year only for one literary candidate", () => {
    const unique = selectStrictAliasWriterCandidate(
      { name: "Unique alias" },
      new Map([
        [
          "Unique alias",
          [
            candidate({
              birthYears: [],
              literaryOccupationIds: [],
              literaryConfirmed: false,
              descriptions: { en: "British novelist" },
            }),
          ],
        ],
      ]),
      "exact-alias-not-found"
    );

    expect(unique.candidate?.qid).toBe("Q100");
    expect(createAliasIdentity(unique.candidate, "", "2026-08-31")).toMatchObject({
      identityRule: "exact-alias-and-literary-role",
      identitySignals: ["human", "exact-alias", "literary-role"],
    });

    const ambiguous = selectStrictAliasWriterCandidate(
      { name: "Shared alias" },
      new Map([
        [
          "Shared alias",
          [candidate(), candidate({ qid: "Q200" })],
        ],
      ]),
      "exact-alias-not-found"
    );
    expect(ambiguous).toMatchObject({
      candidate: null,
      reason: "ambiguous-identity",
    });
  });

  it("rejects a shared alias even when only one human has literary metadata", () => {
    const selection = selectStrictAliasWriterCandidate(
      { name: "Shared alias" },
      new Map([
        [
          "Shared alias",
          [
            candidate({ birthYears: [] }),
            candidate({
              qid: "Q200",
              birthYears: [],
              literaryOccupationIds: [],
              literaryConfirmed: false,
            }),
          ],
        ],
      ])
    );

    expect(selection).toMatchObject({
      candidate: null,
      reason: "ambiguous-identity",
      expectedYear: "",
    });
  });

  it("collapses repeated SPARQL alias rows by literal and QID", () => {
    const payload = {
      results: {
        bindings: [
          {
            alias: { value: "Псевдоним", "xml:lang": "ru" },
            item: { value: "http://www.wikidata.org/entity/Q100" },
            birth: { value: "1901-04-03T00:00:00Z" },
            literaryOccupation: {
              value: "http://www.wikidata.org/entity/Q36180",
            },
          },
          {
            alias: { value: "Псевдоним", "xml:lang": "ru" },
            item: { value: "http://www.wikidata.org/entity/Q100" },
            description: { value: "русский писатель", "xml:lang": "ru" },
          },
        ],
      },
    };

    expect(rowsByAlias([payload]).get("Псевдоним")).toEqual([
      {
        qid: "Q100",
        human: true,
        birthYears: ["1901"],
        portraitFilename: "",
        literaryOccupationIds: ["Q36180"],
        literaryConfirmed: true,
        descriptions: { ru: "русский писатель" },
      },
    ]);
  });

  it("keeps SPARQL-confirmed literary subtypes without a description", () => {
    const index = rowsByAlias([
      {
        results: {
          bindings: [
            {
              alias: { value: "Specific writer", "xml:lang": "en" },
              item: { value: "http://www.wikidata.org/entity/Q300" },
              literaryOccupation: {
                value: "http://www.wikidata.org/entity/Q123456",
              },
            },
          ],
        },
      },
    ]);

    expect(
      selectStrictAliasWriterCandidate({ name: "Specific writer" }, index)
    ).toMatchObject({
      candidate: {
        qid: "Q300",
        literaryOccupationIds: ["Q123456"],
        literaryConfirmed: true,
      },
      reason: null,
    });
  });

  it("refuses incomplete caches before invoking the output writer", async () => {
    expect(() =>
      assertResolverCachesComplete({
        labels: ["Known", "Missing"],
        aliases: ["Alias"],
        labelCache: { Known: [] },
        aliasCache: { Alias: [] },
      })
    ).toThrow(/cache is incomplete/u);

    const writes = [];
    await expect(
      writeAppliedWriterRegistry({
        applyChanges: true,
        labels: ["Known", "Missing"],
        aliases: ["Alias"],
        labelCache: { Known: [] },
        aliasCache: { Alias: [] },
        failedBatches: 0,
        failedAliasBatches: 0,
        targetPath: "should-not-be-written.json",
        payload: { writers: {} },
        writeOutput: async (...args) => writes.push(args),
      })
    ).rejects.toThrow(/cache is incomplete/u);
    expect(writes).toEqual([]);
  });
});

describe("curated writer registry monotonic merge", () => {
  it("preserves an existing mapping unresolved by the fresh pass", () => {
    const existing = { "china:confucius": mapping("Q4604", "Confucius.jpg") };
    const result = mergePublishedWriterMappings(existing, {});

    expect(result.writers).toEqual(existing);
    expect(result.preservedExisting).toBe(1);
    expect(result.newlyAddedKeys).toEqual([]);
  });

  it("adds a fresh mapping only when its key is missing", () => {
    const existing = { "china:confucius": mapping("Q4604") };
    const fresh = { "usa:isaac_asimov": mapping("Q34981", "Asimov.jpg") };
    const result = mergePublishedWriterMappings(existing, fresh);

    expect(result.writers).toEqual({ ...existing, ...fresh });
    expect(result.newlyAddedKeys).toEqual(["usa:isaac_asimov"]);
    expect(result.conflicts).toEqual([]);
  });

  it("preserves and reports an unapproved conflicting QID", () => {
    const existing = { "example:writer": mapping("Q100") };
    const fresh = { "example:writer": mapping("Q200", "Wrong.jpg") };
    const result = mergePublishedWriterMappings(existing, fresh);

    expect(result.writers["example:writer"]).toEqual(existing["example:writer"]);
    expect(result.conflicts).toEqual([
      {
        key: "example:writer",
        existingWikidataId: "Q100",
        freshWikidataId: "Q200",
        resolution: "preserved-existing",
      },
    ]);
  });

  it("never removes an existing mapping", () => {
    const existing = {
      "china:confucius": mapping("Q4604"),
      "china:li_bai": mapping("Q9327"),
      "usa:isaac_asimov": mapping("Q34981"),
    };
    const result = mergePublishedWriterMappings(existing, {
      "china:confucius": mapping("Q999999"),
    });

    expect(Object.keys(result.writers)).toEqual(Object.keys(existing));
    expect(result.removedExistingKeys).toEqual([]);
  });

  it("applies only the evidence-backed Ana Paula Tavares remediation", () => {
    const key = "angola:ana_paula_tavares";
    const result = mergePublishedWriterMappings(
      { [key]: mapping("Q59186426") },
      { [key]: mapping("Q460121") }
    );

    expect(EVIDENCE_BACKED_QID_REPLACEMENTS[key]).toMatchObject({
      previousWikidataId: "Q59186426",
      replacementWikidataId: "Q460121",
      evidenceUrls: expect.arrayContaining([
        "https://www.wikidata.org/wiki/Q59186426",
        "https://www.wikidata.org/wiki/Q460121",
      ]),
    });
    expect(result.writers[key].wikidataId).toBe("Q460121");
    expect(result.conflicts).toMatchObject([
      {
        key,
        resolution: "evidence-backed-replacement",
      },
    ]);
    expect(result.evidenceBackedReplacements).toBe(1);
    expect(result.preservedExisting).toBe(0);
  });

  it("keeps the authoritative Avvakum mapping across resolver runs", () => {
    const key = "russia:avvakum";
    const candidates = addManualIdentityOverrides({});
    const firstRun = mergePublishedWriterMappings({}, candidates);
    const laterUnresolvedRun = mergePublishedWriterMappings(
      firstRun.writers,
      addManualIdentityOverrides({})
    );

    expect(CURATED_MANUAL_IDENTITY_OVERRIDES[key]).toMatchObject({
      wikidataId: "Q318473",
      portraitFilename: "Protopop Avvakym.jpg",
      authoritativeSourceUrl:
        "https://www.prlib.ru/Great_Russia/cultural_XVII/Avvakum_Petrov",
    });
    expect(firstRun.writers[key].wikidataId).toBe("Q318473");
    expect(laterUnresolvedRun.writers[key]).toEqual(firstRun.writers[key]);
    expect(laterUnresolvedRun.removedExistingKeys).toEqual([]);
  });

  it("blocks only an exact key and QID pair from identity remediations", () => {
    const blockedKey = "cameroon:jean_roger_essomba";
    const result = filterBlockedFreshMappings(
      {
        [blockedKey]: mapping("Q95950701"),
        "example:safe_writer": mapping("Q200"),
      },
      [
        {
          key: blockedKey,
          oldQid: "Q95950701",
          reason: "Known different person.",
        },
      ]
    );

    expect(result.writers[blockedKey]).toBeUndefined();
    expect(result.writers["example:safe_writer"]?.wikidataId).toBe("Q200");
    expect(result.blocked).toEqual([
      {
        key: blockedKey,
        wikidataId: "Q95950701",
        reason: "Known different person.",
        resolution: "blocked-by-identity-remediation",
      },
    ]);

    expect(
      filterBlockedFreshMappings(
        { [blockedKey]: mapping("Q123456") },
        [{ key: blockedKey, oldQid: "Q95950701", reason: "Known different person." }]
      ).writers[blockedKey]?.wikidataId
    ).toBe("Q123456");
  });
});
