import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assessRegistryCompletion,
  classifyRegistryItem,
  contributorMatchesWriter,
  isBlockingRegistryStatus,
  isIsoCalendarDate,
  registryIssues,
  registryItemHash,
} from "./book-canon-registry.mjs";

function validRegistry() {
  const sourceId = "official-list";
  const item = {
    ordinal: 1,
    itemId: "proshai-oruzhie",
    itemUrl: "https://svetapp.rusneb.ru/catalog/proshai-oruzhie",
    titleExact: "Прощай, оружие!",
    contributorExact: "Хемингуэй Эрнест",
    candidateKind: "work",
    entityKind: "work",
    adjudicationStatus: "pending-review",
    adjudicatedRecordKey: null,
  };
  item.itemHash = registryItemHash(sourceId, item);
  return {
    schemaVersion: 2,
    registryVersion: "world-canon-2026-09-v2",
    snapshotDate: "2026-09-02",
    completionStatus: "in-progress",
    minimumIndependentWorkSignals: 2,
    completionRule:
      "Every accepted Work needs two work-specific signals from independent groups.",
    itemHashProfile: "sha256-exact-registry-fields-v1",
    itemHashRule: "The item hash covers exact registry fields, not HTML.",
    authorities: [
      {
        authorityId: "neb",
        provider: "national-electronic-library",
        authorityCountryId: "russia",
        independenceGroup: "russian-national-library-infrastructure",
        tier: "A",
        allowedRoles: [
          "canon-selection",
          "title-national-record",
          "description-fact",
        ],
        domains: ["rusneb.ru"],
        markets: ["RU"],
      },
    ],
    sources: [
      {
        id: sourceId,
        authorityId: "neb",
        class: "national-library-heritage-collection",
        scope: "global-curated-collection",
        url: "https://svetapp.rusneb.ru/collections/vazhnaya-klassika",
        snapshot: {
          capturedAt: "2026-09-02",
          snapshotStatus: "unverified-content-hash",
          contentSha256: null,
          extractionMethod: "manual-transcription",
          version: "manual-v1",
        },
        inventoryStatus: "transcribed",
        coverageStatus: "in-progress",
        declaredItemCount: 1,
      },
    ],
    inventories: [{ sourceId, items: [item] }],
  };
}

function issueSet(registry) {
  return new Set(registryIssues(registry));
}

function addAdjudicationAudit(item) {
  item.adjudicatedAt = "2026-09-02";
  item.adjudicatedBy = "Probpera editorial research";
  item.adjudicationReason =
    "The source item and the archive target were compared at Work level.";
  item.adjudicationEvidenceUrls = [
    "https://search.rsl.ru/ru/record/01000000000",
  ];
}

describe("book canon source registry", () => {
  it("accepts a valid transcribed inventory without treating it as completed", () => {
    const registry = validRegistry();

    expect(registryIssues(registry)).toEqual([]);
    expect(registry.sources[0].inventoryStatus).toBe("transcribed");
    expect(registry.completionStatus).toBe("in-progress");
    expect(registry.sources[0].snapshot.contentSha256).toBeNull();
  });

  it("preserves a source that states no contributor without inventing one", () => {
    const registry = validRegistry();
    const item = registry.inventories[0].items[0];
    item.contributorExact = "";
    item.candidateKind = "unclassified";
    item.entityKind = "unresolved";
    item.itemHash = registryItemHash(registry.inventories[0].sourceId, item);

    expect(registryIssues(registry)).toEqual([]);
    expect(classifyRegistryItem(item, []).status).toBe(
      "blocking-unclassified-candidate"
    );
  });

  it("allows an official page to use one object URL for multiple listed works", () => {
    const registry = validRegistry();
    const first = registry.inventories[0].items[0];
    const second = {
      ...first,
      ordinal: 2,
      itemId: "second-work-on-the-same-source-object",
      titleExact: "A second separately listed work",
    };
    second.itemHash = registryItemHash(registry.inventories[0].sourceId, second);
    registry.inventories[0].items.push(second);
    registry.sources[0].declaredItemCount = 2;

    expect(registryIssues(registry)).toEqual([]);
  });

  it("accepts the checked-in registry and its exact-field item hashes", async () => {
    const registry = JSON.parse(
      await readFile(
        new URL("../../data/book-canon-source-registry.json", import.meta.url),
        "utf8"
      )
    );

    expect(registryIssues(registry)).toEqual([]);
    expect(
      Object.fromEntries(
        registry.inventories.map((inventory) => [
          inventory.sourceId,
          inventory.items.length,
        ])
      )
    ).toEqual({
      "neb-svet-important-classics-2026-09-02": 47,
      "loc-books-that-shaped-america-2012": 96,
      "bnf-dne-education-epub-selection-2018": 149,
    });
    expect(
      registry.inventories.every((inventory) =>
        inventory.items.every(
          (item) =>
            item.itemHash === registryItemHash(inventory.sourceId, item)
        )
      )
    ).toBe(true);

    const bnfInventory = registry.inventories.find(
      (inventory) =>
        inventory.sourceId === "bnf-dne-education-epub-selection-2018"
    );
    const sharedTheatreManifestations = bnfInventory.items.filter((item) =>
      item.itemUrl.includes("bpt6k5551207g")
    );
    expect(sharedTheatreManifestations).toHaveLength(3);
    expect(
      sharedTheatreManifestations.map((item) => item.contributorExact)
    ).toEqual([
      "Corneille, Pierre (1606-1684)",
      "Molière (1622-1673)",
      "Racine, Jean (1639-1699)",
    ]);
    expect(
      registry.sources.find(
        (source) =>
          source.id === "bnf-dne-education-epub-selection-2018"
      )?.notes
    ).toContain("149 complete title/EPUB link pairs");

    const nebSource = registry.sources.find(
      (source) => source.id === "neb-svet-important-classics-2026-09-02"
    );
    const nebInventory = registry.inventories.find(
      (inventory) =>
        inventory.sourceId === "neb-svet-important-classics-2026-09-02"
    );
    expect(nebSource?.inventoryStatus).toBe("transcribed");
    expect(nebSource?.coverageStatus).toBe("in-progress");
    expect(
      Object.fromEntries(
        ["accepted", "rejected", "held"].map((status) => [
          status,
          nebInventory.items.filter(
            (item) => item.adjudicationStatus === status
          ).length,
        ])
      )
    ).toEqual({ accepted: 25, rejected: 17, held: 5 });
    expect(
      nebInventory.items.every(
        (item) =>
          item.adjudicatedAt === "2026-09-02" &&
          item.adjudicatedBy === "Codex manual Work-identity review" &&
          item.adjudicationReason.length >= 20 &&
          item.adjudicationEvidenceUrls.length >= 2
      )
    ).toBe(true);
    expect(
      nebInventory.items
        .filter((item) => item.adjudicationStatus === "held")
        .map((item) => item.itemId)
    ).toEqual([
      "vladimir-alekseevich-gilyarovskii-moskva-i-moskvichi",
      "dvenadcat-stulev",
      "printsessa-turandot",
      "portret-doriana-greya",
      "leto-gospodne",
    ]);
    expect(
      nebInventory.items.find(
        (item) => item.itemId === "povesti-belkina"
      )
    ).toMatchObject({
      candidateKind: "work-cycle",
      entityKind: "aggregate-work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey:
        "russia:pushkin:legacy-pushkin-повести-белкина",
    });
    expect(
      nebInventory.items.find(
        (item) => item.itemId === "peterburgskie-povesti"
      )
    ).toMatchObject({
      candidateKind: "edition-aggregate",
      entityKind: "manifestation",
      adjudicationStatus: "rejected",
      adjudicatedRecordKey: null,
    });

    const locSource = registry.sources.find(
      (source) => source.id === "loc-books-that-shaped-america-2012"
    );
    const locInventory = registry.inventories.find(
      (inventory) => inventory.sourceId === "loc-books-that-shaped-america-2012"
    );
    expect(locSource).toMatchObject({
      inventoryStatus: "transcribed",
      coverageStatus: "in-progress",
      snapshot: {
        snapshotStatus: "verified-content-hash",
        contentSha256:
          "06a902ab97ad5b8f057a6c6ece8e88dfd7f87ffc1e46a669d94e9a46a5d99e4a",
      },
    });
    expect(
      Object.fromEntries(
        ["accepted", "rejected", "held"].map((status) => [
          status,
          locInventory.items.filter(
            (item) => item.adjudicationStatus === status
          ).length,
        ])
      )
    ).toEqual({ accepted: 11, rejected: 13, held: 72 });
    expect(
      Object.fromEntries(
        [
          "work",
          "work-cycle",
          "coauthored-work",
          "anonymous-work",
          "collective-work",
          "ambiguous-multiwork-edition",
          "edition-manifestation-artifact",
          "exhibit-companion",
          "editorial-aggregate",
        ].map((candidateKind) => [
          candidateKind,
          locInventory.items.filter(
            (item) => item.candidateKind === candidateKind
          ).length,
        ])
      )
    ).toEqual({
      work: 66,
      "work-cycle": 8,
      "coauthored-work": 5,
      "anonymous-work": 1,
      "collective-work": 3,
      "ambiguous-multiwork-edition": 2,
      "edition-manifestation-artifact": 4,
      "exhibit-companion": 4,
      "editorial-aggregate": 3,
    });
    expect(
      locInventory.items.every(
        (item) =>
          item.adjudicatedAt === "2026-09-02" &&
          item.adjudicatedBy === "Codex manual LoC Work-identity review" &&
          item.adjudicationReason.length >= 20 &&
          item.adjudicationEvidenceUrls.length >= 2
      )
    ).toBe(true);
    expect(
      locInventory.items
        .filter((item) => item.adjudicationStatus === "accepted")
        .map((item) => item.adjudicatedRecordKey)
    ).toEqual([
      "usa:thomas_paine:openlibrary-works-ol60358w",
      "usa:washington_irving:openlibrary-works-ol63985w",
      "usa:nathaniel_hawthorne:openlibrary-works-ol455305w",
      "usa:herman_melville:moby-dick",
      "usa:walt_whitman:openlibrary-works-ol16333w",
      "usa:francis_scott_fitzgerald:the-great-gatsby",
      "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial",
      "usa:ralph_ellison:openlibrary-works-ol495470w",
      "usa:ray_bradbury:fahrenheit-451-editorial",
      "usa:jack_kerouac:openlibrary-works-ol65906w",
      "usa:harper_lee:to-kill-a-mockingbird-editorial",
    ]);
    expect(
      locInventory.items
        .filter((item) => item.adjudicationStatus === "rejected")
        .map((item) => item.ordinal)
    ).toEqual([2, 8, 10, 13, 18, 21, 30, 31, 32, 53, 59, 64, 96]);
    expect(
      locInventory.items.find((item) => item.ordinal === 47)
    ).toMatchObject({
      candidateKind: "work",
      entityKind: "work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey:
        "usa:francis_scott_fitzgerald:the-great-gatsby",
    });

    const bnfSource = registry.sources.find(
      (source) => source.id === "bnf-dne-education-epub-selection-2018"
    );
    expect(bnfSource).toMatchObject({
      inventoryStatus: "transcribed",
      coverageStatus: "in-progress",
      snapshot: {
        snapshotStatus: "verified-content-hash",
        contentSha256:
          "2ddf392e54a604335ee9290b07ea37326fc5e56df902b34cc67213f78500db08",
      },
    });
    expect(
      Object.fromEntries(
        ["accepted", "rejected", "held"].map((status) => [
          status,
          bnfInventory.items.filter(
            (item) => item.adjudicationStatus === status
          ).length,
        ])
      )
    ).toEqual({ accepted: 3, rejected: 85, held: 61 });
    expect(
      Object.fromEntries(
        [
          "work",
          "work-cycle",
          "coauthored-work",
          "anonymous-work",
          "ambiguous-multiwork-edition",
          "edition-aggregate",
          "editorial-aggregate",
          "edition-manifestation-artifact",
        ].map((candidateKind) => [
          candidateKind,
          bnfInventory.items.filter(
            (item) => item.candidateKind === candidateKind
          ).length,
        ])
      )
    ).toEqual({
      work: 44,
      "work-cycle": 15,
      "coauthored-work": 2,
      "anonymous-work": 1,
      "ambiguous-multiwork-edition": 2,
      "edition-aggregate": 13,
      "editorial-aggregate": 11,
      "edition-manifestation-artifact": 61,
    });
    expect(
      bnfInventory.items.every(
        (item) =>
          item.adjudicatedAt === "2026-09-02" &&
          item.adjudicatedBy === "Codex manual BnF Work-identity review" &&
          item.adjudicationReason.length >= 20 &&
          item.adjudicationEvidenceUrls.length >= 2
      )
    ).toBe(true);
    expect(
      bnfInventory.items
        .filter((item) => item.adjudicationStatus === "accepted")
        .map((item) => item.ordinal)
    ).toEqual([27, 37, 149]);
    expect(
      bnfInventory.items
        .filter((item) => item.adjudicationStatus === "accepted")
        .map((item) => item.adjudicatedRecordKey)
    ).toEqual([
      "france:alexandre_dumas:three-musketeers",
      "france:flaubert:openlibrary-works-ol893601w",
      "france:emile_zola:openlibrary-works-ol118984w",
    ]);
    expect(
      bnfInventory.items
        .filter((item) => item.adjudicationStatus === "rejected")
        .map((item) => item.ordinal)
    ).toEqual([
      1, 4, 5, 6, 11, 12, 15, 16, 18, 20, 21, 24, 25, 28, 29, 33, 39,
      40, 41, 42, 43, 44, 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 58,
      59, 60, 62, 64, 67, 68, 69, 70, 71, 73, 77, 80, 81, 83, 84, 85,
      86, 89, 90, 92, 93, 94, 95, 98, 102, 104, 110, 111, 113, 114,
      115, 117, 118, 121, 122, 123, 124, 125, 126, 127, 132, 133, 135,
      136, 137, 138, 139, 140, 141, 143, 144, 148,
    ]);
    expect(
      bnfInventory.items
        .filter((item) => item.adjudicationStatus === "held")
        .map((item) => item.ordinal)
    ).toEqual([
      2, 3, 7, 8, 9, 10, 13, 14, 17, 19, 22, 23, 26, 30, 31, 32, 34,
      35, 36, 38, 45, 46, 50, 61, 63, 65, 66, 72, 74, 75, 76, 78, 79,
      82, 87, 88, 91, 96, 97, 99, 100, 101, 103, 105, 106, 107, 108,
      109, 112, 116, 119, 120, 128, 129, 130, 131, 134, 142, 145, 146,
      147,
    ]);
    expect(
      bnfInventory.items.find((item) => item.ordinal === 45)
    ).toMatchObject({
      candidateKind: "coauthored-work",
      entityKind: "work",
      adjudicationStatus: "held",
      adjudicatedRecordKey: null,
    });
    expect(
      bnfInventory.items.find((item) => item.ordinal === 144)
    ).toMatchObject({
      candidateKind: "editorial-aggregate",
      entityKind: "aggregate-work",
      adjudicationStatus: "rejected",
      adjudicatedRecordKey: null,
    });
    const bnfAndNebAcceptedOverlap = bnfInventory.items
      .filter(
        (item) =>
          item.adjudicationStatus === "accepted" &&
          nebInventory.items.some(
            (nebItem) =>
              nebItem.adjudicationStatus === "accepted" &&
              nebItem.adjudicatedRecordKey === item.adjudicatedRecordKey
          )
      )
      .map((item) => item.adjudicatedRecordKey);
    expect(bnfAndNebAcceptedOverlap).toEqual([
      "france:alexandre_dumas:three-musketeers",
    ]);
    expect(
      bnfInventory.items.some((item) =>
        /(?:great gatsby|grand gatsby|gatsby)/iu.test(item.titleExact)
      )
    ).toBe(false);

    expect(
      registry.authorities.find(
        (authority) => authority.authorityId === "probpera-editorial"
      )
    ).toEqual({
      authorityId: "probpera-editorial",
      provider: "probpera-editorial",
      authorityCountryId: "russia",
      independenceGroup: "probpera-editorial-project",
      tier: "B",
      allowedRoles: ["project-article"],
      domains: ["probpera.ru"],
      markets: [],
    });
    expect(
      registry.sources.some(
        (source) => source.authorityId === "probpera-editorial"
      )
    ).toBe(false);
    expect(
      registry.authorities.find(
        (authority) => authority.authorityId === "presidential-library-ru"
      )
    ).toEqual({
      authorityId: "presidential-library-ru",
      provider: "presidential-library-of-boris-yeltsin",
      authorityCountryId: "russia",
      independenceGroup: "russian-presidential-library",
      tier: "A",
      allowedRoles: ["description-fact"],
      domains: ["prlib.ru"],
      markets: ["RU"],
    });
    expect(
      registry.sources.some(
        (source) => source.authorityId === "presidential-library-ru"
      )
    ).toBe(false);
  });

  it("accepts a structurally valid authority beyond NEB and LoC", () => {
    const registry = validRegistry();
    registry.authorities.push({
      authorityId: "bnf",
      provider: "bibliotheque-nationale-de-france",
      authorityCountryId: "france",
      independenceGroup: "bnf",
      tier: "A",
      allowedRoles: [
        "canon-selection",
        "title-national-record",
        "description-fact",
      ],
      domains: ["bnf.fr"],
      markets: ["FR"],
    });

    expect(registryIssues(registry)).toEqual([]);
  });

  it("allows project-article authority without market but still requires markets for title roles", () => {
    const registry = validRegistry();
    registry.authorities.push({
      authorityId: "probpera-editorial",
      provider: "probpera-editorial",
      authorityCountryId: "russia",
      independenceGroup: "probpera-editorial-project",
      tier: "B",
      allowedRoles: ["project-article"],
      domains: ["probpera.ru"],
      markets: [],
    });

    expect(registryIssues(registry)).toEqual([]);

    registry.authorities[1].allowedRoles = ["title-publisher"];
    expect(issueSet(registry)).toContain(
      "authority-2-markets-required-for-title-role"
    );
  });

  it("rejects duplicate authorities and cross-group domain collisions", () => {
    const registry = validRegistry();
    registry.authorities.push({
      authorityId: "neb",
      provider: "another-library",
      authorityCountryId: "france",
      independenceGroup: "unrelated-group",
      tier: "A",
      allowedRoles: ["canon-selection"],
      domains: ["svetapp.rusneb.ru"],
      markets: ["FR"],
    });
    const issues = issueSet(registry);

    expect(issues.has("authority-2-authority-id-duplicate")).toBe(true);
    expect(
      issues.has(
        "authority-2-domain-crosses-independence-groups:svetapp.rusneb.ru"
      )
    ).toBe(true);
  });

  it("fails closed for null and empty registries without throwing", () => {
    expect(() => registryIssues(null)).not.toThrow();
    const nullIssues = issueSet(null);
    for (const expected of [
      "registry-object-required",
      "authorities-nonempty-required",
      "sources-nonempty-required",
      "inventories-nonempty-required",
    ]) {
      expect(nullIssues.has(expected), expected).toBe(true);
    }

    const empty = validRegistry();
    empty.authorities = [];
    empty.sources = [];
    empty.inventories = [];
    const emptyIssues = issueSet(empty);
    for (const expected of [
      "authorities-nonempty-required",
      "sources-nonempty-required",
      "inventories-nonempty-required",
    ]) {
      expect(emptyIssues.has(expected), expected).toBe(true);
    }
  });

  it("validates real calendar dates rather than only their shape", () => {
    expect(isIsoCalendarDate("2024-02-29")).toBe(true);
    expect(isIsoCalendarDate("2023-02-29")).toBe(false);
    expect(isIsoCalendarDate("2026-13-01")).toBe(false);
    expect(isIsoCalendarDate("0000-01-01")).toBe(false);
    expect(isIsoCalendarDate(null)).toBe(false);

    const registry = validRegistry();
    registry.snapshotDate = "2026-02-30";
    registry.sources[0].snapshot.capturedAt = "2026-13-01";
    const issues = issueSet(registry);
    expect(issues.has("snapshot-date-invalid")).toBe(true);
    expect(issues.has("source-1-snapshot-captured-at-invalid")).toBe(true);
  });

  it("requires genuine HTTPS URLs on an authority-controlled host", () => {
    const registry = validRegistry();
    registry.sources[0].url = "https://rusneb.ru@evil.example/list";
    registry.inventories[0].items[0].itemUrl = "https://evil.example/item";
    registry.inventories[0].items[0].itemHash = registryItemHash(
      registry.inventories[0].sourceId,
      registry.inventories[0].items[0]
    );
    const issues = issueSet(registry);

    expect(issues.has("source-1-https-url-invalid")).toBe(true);
    expect(
      issues.has("inventory-1-item-1-item-url-host-not-authorized")
    ).toBe(true);
  });

  it("rejects invalid controlled enums and source-declared authority facts", () => {
    const registry = validRegistry();
    registry.completionStatus = "complete";
    registry.minimumIndependentWorkSignals = 1;
    registry.authorities[0].provider = "Self Declared Library";
    registry.authorities[0].authorityCountryId = "USA!";
    registry.authorities[0].tier = "C";
    registry.authorities[0].allowedRoles = ["marketing"];
    registry.authorities[0].markets = ["EARTH"];
    registry.sources[0].class = "blog-list";
    registry.sources[0].scope = "everything";
    registry.sources[0].inventoryStatus = "complete";
    registry.sources[0].coverageStatus = "complete";
    registry.sources[0].snapshot.snapshotStatus = "probably-current";
    registry.sources[0].snapshot.extractionMethod = "magic";
    registry.sources[0].provider = "spoofed";
    registry.sources[0].authorityTier = "A";
    registry.sources[0].authorityCountryId = "russia";
    registry.sources[0].independenceGroup = "self-declared";
    registry.inventories[0].items[0].candidateKind = "book";
    registry.inventories[0].items[0].entityKind = "expression";

    const issues = issueSet(registry);
    for (const expected of [
      "completion-status-invalid",
      "minimum-independent-work-signals-must-be-2",
      "authority-1-provider-invalid",
      "authority-1-authority-country-id-invalid",
      "authority-1-tier-invalid",
      "authority-1-allowed-roles-value-not-allowed:marketing",
      "authority-1-markets-value-invalid:EARTH",
      "source-1-class-invalid",
      "source-1-scope-invalid",
      "source-1-inventory-status-invalid",
      "source-1-coverage-status-invalid",
      "source-1-snapshot-status-invalid",
      "source-1-extraction-method-invalid",
      "source-1-authority-fields-must-not-be-self-declared",
      "source-1-independence-group-must-come-from-authority-registry",
      "inventory-1-item-1-candidate-kind-invalid",
      "inventory-1-item-1-entity-kind-invalid",
    ]) {
      expect(issues.has(expected), expected).toBe(true);
    }
  });

  it("rejects padded identifiers instead of silently normalizing them", () => {
    const registry = validRegistry();
    registry.authorities[0].provider = " national-electronic-library ";
    registry.sources[0].id = " official-list ";
    registry.inventories[0].sourceId = " official-list ";
    registry.inventories[0].items[0].itemId = " proshai-oruzhie ";
    const issues = issueSet(registry);

    expect(issues.has("authority-1-provider-invalid")).toBe(true);
    expect(issues.has("source-1-id-invalid")).toBe(true);
    expect(issues.has("inventory-1-source-id-invalid")).toBe(true);
    expect(issues.has("inventory-1-item-1-item-id-invalid")).toBe(true);
  });

  it("does not accept an invented HTML content hash for an unverified snapshot", () => {
    const registry = validRegistry();
    registry.sources[0].snapshot.contentSha256 = "a".repeat(64);
    expect(
      issueSet(registry).has(
        "source-1-unverified-content-sha256-must-be-null"
      )
    ).toBe(true);

    registry.sources[0].snapshot.snapshotStatus = "verified-content-hash";
    registry.sources[0].snapshot.contentSha256 = "not-a-sha";
    const invalidVerified = issueSet(registry);
    expect(invalidVerified.has("source-1-content-sha256-required")).toBe(true);
  });

  it("binds itemHash to every exact transcription field, not page content", () => {
    const registry = validRegistry();
    const originalHash = registry.inventories[0].items[0].itemHash;
    registry.inventories[0].items[0].titleExact = "Прощай оружие";

    expect(
      issueSet(registry).has("inventory-1-item-1-item-hash-mismatch")
    ).toBe(true);
    expect(
      registryItemHash(
        registry.inventories[0].sourceId,
        registry.inventories[0].items[0]
      )
    ).not.toBe(originalHash);
  });

  it("enforces Work/aggregate Work/Manifestation entity semantics", () => {
    const registry = validRegistry();
    registry.inventories[0].items[0].candidateKind = "edition-aggregate";
    registry.inventories[0].items[0].entityKind = "work";
    registry.inventories[0].items[0].itemHash = registryItemHash(
      registry.inventories[0].sourceId,
      registry.inventories[0].items[0]
    );

    expect(
      issueSet(registry).has(
        "inventory-1-item-1-candidate-entity-kind-mismatch"
      )
    ).toBe(true);
  });

  it("does not accept an item without a Work-level adjudicated record key", () => {
    const registry = validRegistry();
    const item = registry.inventories[0].items[0];
    registry.sources[0].inventoryStatus = "adjudicated";
    registry.sources[0].coverageStatus = "adjudicated";
    item.candidateKind = "edition-aggregate";
    item.entityKind = "manifestation";
    item.adjudicationStatus = "accepted";
    item.adjudicatedRecordKey = "not-a-record-key";
    addAdjudicationAudit(item);
    item.itemHash = registryItemHash(registry.inventories[0].sourceId, item);
    const issues = issueSet(registry);

    expect(
      issues.has("inventory-1-item-1-accepted-signal-must-identify-work")
    ).toBe(true);
    expect(
      issues.has("inventory-1-item-1-adjudicated-record-key-invalid")
    ).toBe(true);
  });

  it("keeps anonymous and collective Works on hold until their authorship models exist", () => {
    for (const candidateKind of ["anonymous-work", "collective-work"]) {
      const registry = validRegistry();
      const item = registry.inventories[0].items[0];
      item.candidateKind = candidateKind;
      item.entityKind = "work";
      item.adjudicationStatus = "accepted";
      item.adjudicatedRecordKey = "usa:collective:work";
      addAdjudicationAudit(item);
      item.itemHash = registryItemHash(registry.inventories[0].sourceId, item);

      expect(issueSet(registry)).toContain(
        "inventory-1-item-1-accepted-signal-must-identify-work"
      );
      expect(classifyRegistryItem(item, [])).toMatchObject({
        status: `model-blocked-${candidateKind}`,
      });
    }
  });

  it("keeps a transcribed pending item separate from adjudicated coverage", () => {
    const registry = validRegistry();
    registry.sources[0].coverageStatus = "adjudicated";
    registry.inventories[0].items[0].adjudicatedRecordKey =
      "usa:writer:work";
    const issues = issueSet(registry);

    expect(
      issues.has(
        "source-1-adjudicated-coverage-requires-adjudicated-inventory"
      )
    ).toBe(true);
    expect(
      issues.has("inventory-1-item-1-unaccepted-record-key-must-be-null")
    ).toBe(true);
  });

  it("allows incremental decisions after transcription but never at research status", () => {
    const registry = validRegistry();
    const item = registry.inventories[0].items[0];
    item.adjudicationStatus = "rejected";
    addAdjudicationAudit(item);

    expect(registryIssues(registry)).toEqual([]);

    registry.sources[0].inventoryStatus = "research";
    expect(
      issueSet(registry).has(
        "inventory-1-item-1-adjudication-requires-transcribed-source"
      )
    ).toBe(true);
  });

  it("records an evidence-backed hold without pretending source coverage is complete", () => {
    const registry = validRegistry();
    const item = registry.inventories[0].items[0];
    item.adjudicationStatus = "held";
    item.adjudicatedRecordKey = null;
    addAdjudicationAudit(item);

    expect(registryIssues(registry)).toEqual([]);
    expect(classifyRegistryItem(item, []).status).toBe(
      "blocking-adjudication-hold"
    );
    expect(isBlockingRegistryStatus("blocking-adjudication-hold")).toBe(true);

    registry.sources[0].inventoryStatus = "adjudicated";
    registry.sources[0].coverageStatus = "adjudicated";
    expect(
      issueSet(registry).has("source-official-list-adjudication-incomplete")
    ).toBe(true);
  });

  it("requires a dated reviewer, rationale and HTTPS evidence for every decision", () => {
    const registry = validRegistry();
    const item = registry.inventories[0].items[0];
    registry.sources[0].inventoryStatus = "adjudicated";
    registry.sources[0].coverageStatus = "adjudicated";
    item.adjudicationStatus = "rejected";
    item.adjudicatedAt = "2026-09-03";
    item.adjudicatedBy = "";
    item.adjudicationReason = "Too short";
    item.adjudicationEvidenceUrls = ["http://example.test/evidence"];
    const issues = issueSet(registry);

    for (const expected of [
      "inventory-1-item-1-adjudicated-after-registry-date",
      "inventory-1-item-1-adjudicated-by-required",
      "inventory-1-item-1-adjudication-reason-required",
      "inventory-1-item-1-adjudication-evidence-url-invalid",
    ]) {
      expect(issues.has(expected), expected).toBe(true);
    }
  });

  it("requires exact inventory count and contiguous ordinals for transcriptions", () => {
    const registry = validRegistry();
    registry.sources[0].declaredItemCount = 2;
    registry.inventories[0].items[0].ordinal = 2;
    registry.inventories[0].items[0].itemHash = registryItemHash(
      registry.inventories[0].sourceId,
      registry.inventories[0].items[0]
    );
    const issues = issueSet(registry);

    expect(issues.has("inventory-1-declared-count-mismatch")).toBe(true);
    expect(issues.has("inventory-1-ordinals-not-contiguous")).toBe(true);
  });

  it("uses exact source membership rather than equal set sizes", () => {
    const registry = validRegistry();
    registry.inventories = [{ sourceId: "wrong-source", items: [] }];
    const assessment = assessRegistryCompletion(registry, []);

    expect(assessment.missingRequiredInventorySourceIds).toEqual([
      "official-list",
    ]);
    expect(assessment.completionBlockingReasons).toContain(
      "required-source-inventories-missing"
    );
  });

  it("never crashes on malformed authorities, sources, inventories or items", () => {
    const registry = validRegistry();
    registry.authorities = [null];
    registry.sources = [null];
    registry.inventories = [{ sourceId: "missing", items: [null] }];

    expect(() => registryIssues(registry)).not.toThrow();
    expect(registryIssues(registry).length).toBeGreaterThan(0);
    expect(() => classifyRegistryItem(null, null)).not.toThrow();
    expect(classifyRegistryItem(null, null).status).toBe(
      "blocking-invalid-registry-item"
    );
  });

  it("matches reordered names but preserves father/son qualifiers", () => {
    expect(
      contributorMatchesWriter("Хемингуэй Эрнест", "Эрнест Хемингуэй")
    ).toBe(true);
    expect(
      contributorMatchesWriter(
        "Гете Иоганн Вольфганг",
        "Иоганн Вольфганг фон Гёте"
      )
    ).toBe(true);
    expect(
      contributorMatchesWriter(
        "Дюма (отец) Александр",
        "Александр Дюма-сын"
      )
    ).toBe(false);
    expect(
      contributorMatchesWriter("Дюма (отец) Александр", "Александр Дюма")
    ).toBe(false);
    expect(
      contributorMatchesWriter(
        "Дюма (отец) Александр",
        "Александр Дюма-отец"
      )
    ).toBe(true);
    expect(contributorMatchesWriter(null, null)).toBe(false);
  });

  it("never auto-accepts a unique title-author match", () => {
    const item = {
      titleExact: "Прощай, оружие!",
      contributorExact: "Хемингуэй Эрнест",
      candidateKind: "work",
    };
    const books = [
      {
        countryId: "usa",
        writerId: "ernest_hemingway",
        id: "farewell-to-arms",
        title: "Прощай, оружие!",
        writerName: "Эрнест Хемингуэй",
      },
    ];
    const result = classifyRegistryItem(item, books);

    expect(result.status).toBe("candidate-needs-identity-review");
    expect(result.matches).toHaveLength(1);
    expect(isBlockingRegistryStatus(result.status)).toBe(true);

    expect(
      classifyRegistryItem(
        {
          ...item,
          adjudicationStatus: "accepted",
          adjudicatedRecordKey: "usa:ernest_hemingway:wrong-work",
        },
        books
      ).status
    ).toBe("blocking-adjudicated-record-key-mismatch");
    expect(
      classifyRegistryItem(
        {
          ...item,
          adjudicationStatus: "accepted",
          adjudicatedRecordKey: "usa:ernest_hemingway:farewell-to-arms",
        },
        books
      ).status
    ).toBe("confirmed-work-specific-signal");
  });

  it("honors a manual record-key adjudication across writing systems", () => {
    const item = {
      titleExact: "The Great Gatsby",
      contributorExact: "F. Scott Fitzgerald (1896-1940)",
      candidateKind: "work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey: "usa:f_scott_fitzgerald:great-gatsby",
    };
    const books = [
      {
        countryId: "usa",
        writerId: "f_scott_fitzgerald",
        id: "great-gatsby",
        title: "Великий Гэтсби",
        originalTitle: "The Great Gatsby",
        writerName: "Фрэнсис Скотт Фицджеральд",
      },
    ];

    expect(classifyRegistryItem(item, books)).toEqual({
      status: "confirmed-work-specific-signal",
      matches: [
        {
          recordKey: "usa:f_scott_fitzgerald:great-gatsby",
          title: "Великий Гэтсби",
          writer: "Фрэнсис Скотт Фицджеральд",
        },
      ],
    });
    expect(
      classifyRegistryItem(
        { ...item, titleExact: "Tender Is the Night" },
        books
      ).status
    ).toBe("blocking-adjudicated-title-mismatch");
  });

  it("accepts an authorial collection Work without collapsing it into an edition aggregate", () => {
    const registry = validRegistry();
    const item = registry.inventories[0].items[0];
    item.titleExact = "Повести Белкина";
    item.contributorExact = "Пушкин Александр Сергеевич";
    item.candidateKind = "work-cycle";
    item.entityKind = "aggregate-work";
    item.adjudicationStatus = "accepted";
    item.adjudicatedRecordKey = "russia:pushkin:belkin-tales";
    addAdjudicationAudit(item);
    item.itemHash = registryItemHash(registry.inventories[0].sourceId, item);
    const books = [
      {
        countryId: "russia",
        writerId: "pushkin",
        id: "belkin-tales",
        title: "Повести Белкина",
        writerName: "Александр Сергеевич Пушкин",
      },
    ];

    expect(registryIssues(registry)).toEqual([]);
    expect(classifyRegistryItem(item, books).status).toBe(
      "confirmed-work-specific-signal"
    );
  });

  it("accepts coauthorship only when the mapped Work carries all linked multiple credits", () => {
    const item = {
      titleExact: "Двенадцать стульев",
      contributorExact:
        "Петров Евгений Петрович, Ильф Илья Арнольдович",
      candidateKind: "coauthored-work",
      entityKind: "work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey: "russia:ilya-ilf:the-twelve-chairs",
    };
    const exactWork = {
      countryId: "russia",
      writerId: "ilya-ilf",
      id: "the-twelve-chairs",
      title: "Двенадцать стульев",
      writerName: "Илья Ильф",
      authorship: {
        kind: "multiple",
        authors: [
          {
            countryId: "russia",
            writerId: "ilya-ilf",
            creditNames: { ru: "Ильф Илья Арнольдович" },
          },
          {
            countryId: "russia",
            writerId: "yevgeny-petrov",
            creditNames: { ru: "Петров Евгений Петрович" },
          },
        ],
      },
    };

    expect(classifyRegistryItem(item, [exactWork]).status).toBe(
      "confirmed-work-specific-signal"
    );
    expect(
      classifyRegistryItem(
        item,
        [{ ...exactWork, authorship: { kind: "single", authors: exactWork.authorship.authors.slice(0, 1) } }]
      ).status
    ).toBe("blocking-adjudicated-coauthorship-mismatch");
    expect(
      classifyRegistryItem(item, [
        {
          ...exactWork,
          authorship: {
            kind: "multiple",
            authors: exactWork.authorship.authors.map((author) => ({
              ...author,
              writerId: "same-writer",
            })),
          },
        },
      ]).status
    ).toBe("blocking-adjudicated-coauthorship-mismatch");
  });

  it("does not turn Dumas father/son into a title-author match", () => {
    const result = classifyRegistryItem(
      {
        titleExact: "Три мушкетёра",
        contributorExact: "Дюма (отец) Александр",
        candidateKind: "work",
      },
      [
        {
          countryId: "france",
          writerId: "alexandre_dumas_fils",
          id: "three-musketeers-wrong-author",
          title: "Три мушкетёра",
          writerName: "Александр Дюма-сын",
        },
      ]
    );

    expect(result.status).toBe("unresolved-title-author-conflict");
  });

  it("keeps aggregates, ambiguity and model-blocked records in blocking coverage", () => {
    const statuses = [
      classifyRegistryItem(
        { candidateKind: "unclassified", entityKind: "unresolved" },
        []
      ).status,
      classifyRegistryItem({ candidateKind: "edition-aggregate" }, []).status,
      classifyRegistryItem({ candidateKind: "editorial-aggregate" }, []).status,
      classifyRegistryItem(
        { candidateKind: "edition-manifestation-artifact" },
        []
      ).status,
      classifyRegistryItem({ candidateKind: "exhibit-companion" }, []).status,
      classifyRegistryItem(
        { candidateKind: "ambiguous-multiwork-edition" },
        []
      ).status,
      classifyRegistryItem({ candidateKind: "coauthored-work" }, []).status,
      classifyRegistryItem({ candidateKind: "anonymous-work" }, []).status,
      classifyRegistryItem({ candidateKind: "collective-work" }, []).status,
    ];

    expect(statuses).toEqual([
      "blocking-unclassified-candidate",
      "blocking-manifestation-aggregate",
      "blocking-editorial-aggregate",
      "blocking-manifestation-artifact",
      "blocking-exhibit-companion",
      "blocking-ambiguous-manifestation",
      "model-blocked-coauthored-work",
      "model-blocked-anonymous-work",
      "model-blocked-collective-work",
    ]);
    expect(statuses.every(isBlockingRegistryStatus)).toBe(true);
    expect(isBlockingRegistryStatus("unknown-future-status")).toBe(true);
    expect(isBlockingRegistryStatus("confirmed-work-specific-signal")).toBe(
      false
    );
    const manuallyRejected = classifyRegistryItem(
      {
        candidateKind: "edition-aggregate",
        adjudicationStatus: "rejected",
      },
      []
    );
    expect(manuallyRejected.status).toBe("reviewed-not-work-specific-signal");
    expect(isBlockingRegistryStatus(manuallyRejected.status)).toBe(false);
  });

  it("requires two controlled independence groups before completion is eligible", () => {
    const registry = validRegistry();
    registry.sources[0].inventoryStatus = "adjudicated";
    registry.sources[0].coverageStatus = "adjudicated";
    registry.sources[0].snapshot.snapshotStatus = "verified-content-hash";
    registry.sources[0].snapshot.contentSha256 = "a".repeat(64);
    registry.authorities.push({
      authorityId: "loc",
      provider: "library-of-congress",
      authorityCountryId: "usa",
      independenceGroup: "united-states-library-of-congress",
      tier: "A",
      allowedRoles: ["canon-selection"],
      domains: ["loc.gov"],
      markets: ["US"],
    });
    registry.sources.push({
      id: "second-official-list",
      authorityId: "loc",
      class: "national-library-heritage-collection",
      scope: "national-influence-collection",
      url: "https://www.loc.gov/exhibits/books-that-shaped-america/",
      snapshot: {
        capturedAt: "2026-09-02",
        snapshotStatus: "verified-content-hash",
        contentSha256: "b".repeat(64),
        extractionMethod: "dom-link-extraction",
        version: "extractor-v1",
      },
      inventoryStatus: "adjudicated",
      coverageStatus: "adjudicated",
      declaredItemCount: 1,
    });
    registry.inventories.push({ sourceId: "second-official-list", items: [] });
    registry.completionStatus = "verified-complete";
    const oneSignal = [
      {
        status: "confirmed-work-specific-signal",
        sourceId: "official-list",
        matches: [{ recordKey: "usa:writer:work" }],
      },
    ];

    const one = assessRegistryCompletion(registry, oneSignal);
    expect(one.completionEligible).toBe(false);
    expect(one.completionClaimValid).toBe(false);
    expect(one.completionBlockingReasons).toContain(
      "works-with-fewer-than-two-independent-signals"
    );

    const sameGroup = assessRegistryCompletion(registry, [
      ...oneSignal,
      { ...oneSignal[0] },
    ]);
    expect(sameGroup.workSignalCounts["usa:writer:work"]).toBe(1);
    expect(sameGroup.completionEligible).toBe(false);

    const twoGroups = assessRegistryCompletion(registry, [
      ...oneSignal,
      { ...oneSignal[0], sourceId: "second-official-list" },
    ]);
    expect(twoGroups.workSignalCounts["usa:writer:work"]).toBe(2);
    expect(twoGroups.completionEligible).toBe(true);
    expect(twoGroups.completionClaimValid).toBe(true);
  });

  it("does not treat a title match under the wrong author as the same Work", () => {
    const result = classifyRegistryItem(
      {
        titleExact: "Затерянный мир",
        contributorExact: "Крайтон Майкл",
        candidateKind: "work",
      },
      [
        {
          countryId: "england",
          writerId: "arthur_conan_doyle",
          id: "lost-world",
          title: "Затерянный мир",
          writerName: "Артур Конан Дойл",
        },
      ]
    );

    expect(result.status).toBe("unresolved-title-author-conflict");
  });
});
