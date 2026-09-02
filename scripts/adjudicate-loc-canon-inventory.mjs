import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registryItemHash } from "./lib/book-canon-registry.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(projectRoot, "data", "book-canon-source-registry.json");
const snapshotPath = path.join(
  projectRoot,
  "data",
  "book-canon-snapshots",
  "loc-books-that-shaped-america.html.bin"
);
const sourceId = "loc-books-that-shaped-america-2012";
const collectionUrl =
  "https://wwws.loc.gov/exhibits/books-that-shaped-america/exhibititems.html";
const adjudicatedAt = "2026-09-02";
const adjudicatedBy = "Codex manual LoC Work-identity review";

const kindGroups = new Map([
  [
    "work-cycle",
    new Set([24, 38, 42, 46, 48, 65, 75, 85]),
  ],
  ["coauthored-work", new Set([5, 11, 28, 70, 87])],
  ["anonymous-work", new Set([6])],
  ["collective-work", new Set([56, 60, 92])],
  ["ambiguous-multiwork-edition", new Set([2, 10])],
  ["edition-manifestation-artifact", new Set([8, 13, 18, 30])],
  ["exhibit-companion", new Set([21, 32, 53, 59])],
  ["editorial-aggregate", new Set([31, 64, 96])],
]);

const entityKindByCandidateKind = new Map([
  ["work", "work"],
  ["work-cycle", "aggregate-work"],
  ["coauthored-work", "work"],
  ["anonymous-work", "work"],
  ["collective-work", "work"],
  ["ambiguous-multiwork-edition", "ambiguous-manifestation"],
  ["edition-manifestation-artifact", "manifestation"],
  ["exhibit-companion", "exhibit-object"],
  ["editorial-aggregate", "aggregate-work"],
]);

const acceptedRecordKeys = new Map([
  [4, "usa:thomas_paine:openlibrary-works-ol60358w"],
  [12, "usa:washington_irving:openlibrary-works-ol63985w"],
  [17, "usa:nathaniel_hawthorne:openlibrary-works-ol455305w"],
  [19, "usa:herman_melville:moby-dick"],
  [24, "usa:walt_whitman:openlibrary-works-ol16333w"],
  [47, "usa:francis_scott_fitzgerald:the-great-gatsby"],
  [71, "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial"],
  [72, "usa:ralph_ellison:openlibrary-works-ol495470w"],
  [74, "usa:ray_bradbury:fahrenheit-451-editorial"],
  [78, "usa:jack_kerouac:openlibrary-works-ol65906w"],
  [79, "usa:harper_lee:to-kill-a-mockingbird-editorial"],
]);

const rejectedReasons = new Map([
  [
    2,
    "The displayed object is the 1758 annual issue of Poor Richard Improved. The official LoC page explains that its preface was later reprinted as Father Abraham's Speech and The Way to Wealth; the almanac issue is therefore an ambiguous multiwork manifestation, not a separate stable Work signal.",
  ],
  [
    8,
    "The official LoC page identifies this title as the 1793 first English retranslation of the French book edition of Franklin's autobiography. It is a translation/edition manifestation under a variant title, not a second Work distinct from the autobiography.",
  ],
  [
    10,
    "The displayed title combines The New England Primer, Improved with the Assembly of Divines' Catechism. This is a multiwork edition label and cannot identify one exact Work-level canon signal.",
  ],
  [
    13,
    "The wording Newly Revised Eclectic Primer, With Pictorial Illustrations identifies a particular revised and illustrated textbook manifestation; the inventory supplies no exact stable Work identity separate from that edition artifact.",
  ],
  [
    18,
    "This is the second object attached to the same LoC Scarlet Letter exhibit entry: a 1941 Limited Editions Club manifestation with an introduction, illustrations, and a cover facsimile. The 1850 Work signal is recorded once at ordinal 17, so this later edition artifact is rejected as a duplicate signal.",
  ],
  [
    21,
    "National Era, December 11, 1851 is explicitly identified by LoC as a newspaper shown alongside the serialized Uncle Tom's Cabin materials. It is an exhibit companion, not a separate Work-level signal for the novel.",
  ],
  [
    30,
    "This 1885 New York manifestation is the second displayed edition attached to the same LoC Huckleberry Finn exhibit object as the 1884 London manifestation. It must not create a second Work signal and is rejected as a duplicate edition artifact.",
  ],
  [
    31,
    "The 1890 Poems volume is a posthumous editor-defined selection of multiple Emily Dickinson poems, rather than a single poem or an author-established collection identity that can be mapped exactly to one archive Work.",
  ],
  [
    32,
    "LoC describes Slant of Light=Sesgo de Luz as a 1998 handcrafted bilingual book-art selection of Dickinson poems made by Ediciones Vigia. It is an exhibition/illustration companion and later selected manifestation, not a separate authorial Work.",
  ],
  [
    53,
    "The object is William F. Warnecke's circa-1938 photograph of Margaret Mitchell holding Gone With the Wind. It is a photographic exhibit companion and cannot be counted as another signal for the novel.",
  ],
  [
    59,
    "The object is Carol M. Highsmith's photograph/facsimile of a Grapes of Wrath billboard along a California highway. It is a visual exhibit companion, not John Steinbeck's Work.",
  ],
  [
    64,
    "A Treasury of American Folklore is explicitly credited to Benjamin A. Botkin as editor and aggregates stories, legends, tales, traditions, ballads, and songs from many creators. It is an editorial anthology, not one author-specific Work signal.",
  ],
  [
    96,
    "The Words of Cesar Chavez is explicitly credited to Richard Jensen and John C. Hammerback as editors and compiles Chavez's words from multiple underlying texts. It is an editorial aggregate, not a single authored Work by the named editors.",
  ],
]);

const specialHoldReasons = new Map([
  [
    3,
    "LoC identifies The Way to Wealth as Benjamin Franklin's separate Work, but the archive contains two competing Work records (usa:benjamin_franklin:openlibrary-works-ol26610w and usa:benjamin_franklin:openlibrary-works-ol2514745w). The item is held until those duplicate identities are merged or one is authoritatively deprecated.",
  ],
  [
    5,
    "The official LoC page identifies The Federalist essays as the work of Alexander Hamilton, James Madison, and John Jay, with some essay-level attribution still disputed. The archive has no exact Work card carrying linked multiple authorship, so this coauthored Work is held rather than assigned to one person.",
  ],
  [
    6,
    "LoC presents A Curious Hieroglyphick Bible as an anonymously issued selection/adaptation of biblical passages and names Isaiah Thomas as printer, not author. The archive has no exact card with authorship.kind=anonymous; it is held rather than falsely crediting the printer.",
  ],
  [
    11,
    "The LoC catalog identifies Meriwether Lewis and William Clark as joint authors and Paul Allen and Nicholas Biddle as editors of this expedition history. The archive has no exact card with linked multiple authorship and editorial responsibility, so the Work is held rather than attributed to Lewis alone.",
  ],
  [
    23,
    "LoC identifies Walden; or, Life in the Woods by Henry David Thoreau, but the archive exposes competing records for the same Work (usa:henry_david_thoreau:openlibrary-works-ol21138836w and usa:henry_david_thoreau:openlibrary-works-ol55649w), plus a separate multiwork edition. The item is held pending duplicate resolution.",
  ],
  [
    28,
    "The official LoC page credits The American Woman's Home jointly to Catharine E. Beecher and Harriet Beecher Stowe. No exact archive card carries both linked author credits, so the coauthored Work is held and must not be assigned to either sister alone.",
  ],
  [
    29,
    "The LoC item identifies Mark Twain's exact Work with its full subtitle, The Adventures of Huckleberry Finn (Tom Sawyer's Comrade), but the only plausible single-Work archive card uses the shortened title Adventures of Huckleberry Finn. Because the exact-title gate does not establish that alias, the Work is held; ordinal 30 is separately rejected as a duplicate manifestation.",
  ],
  [
    34,
    "The verified inventory row misspells the author as Steven Crane, while the official LoC Work page correctly identifies Stephen Crane. The archive contains no exact Stephen Crane Work card, so the item is held with the source discrepancy documented rather than normalized silently.",
  ],
  [
    37,
    "LoC identifies Jack London's The Call of the Wild, but the archive contains two competing exact Work records (usa:jack_london:openlibrary-works-ol14942956w and usa:jack_london:openlibrary-works-ol144705w). The item is held pending a reviewed merge/deprecation decision.",
  ],
  [
    49,
    "LoC identifies William Faulkner's The Sound and the Fury, but the archive contains both usa:william_faulkner:openlibrary-works-ol82870w and usa:william_faulkner:the-sound-and-the-fury-editorial for the same Work. Neither record is selected arbitrarily; the item is held pending duplicate resolution.",
  ],
  [
    56,
    "LoC credits Idaho: A Guide in Word and Pictures to the Federal Writers' Project, a collective creator. The archive has no exact Work card with a non-person collective-authorship model, so the item is held rather than attached to an invented individual writer.",
  ],
  [
    58,
    "LoC identifies John Steinbeck's The Grapes of Wrath, but the archive contains both usa:john_steinbeck:openlibrary-works-ol23205w and usa:john_steinbeck:the-grapes-of-wrath-editorial for the same Work. The item is held until that duplicate pair is reviewed and merged or deprecated.",
  ],
  [
    60,
    "LoC displays the third edition of Alcoholics Anonymous and supplies no personal author because the Work has anonymous/collective fellowship authorship. The archive has no exact card with a suitable collective-authorship model, so it is held rather than attributed to one writer or treated as a new edition Work.",
  ],
  [
    61,
    "LoC identifies Ernest Hemingway's For Whom the Bell Tolls, but the archive contains both usa:ernest_hemingway:openlibrary-works-ol63009w and usa:ernest_hemingway:for-whom-the-bell-tolls-editorial for the same Work. The item is held pending duplicate resolution.",
  ],
  [
    70,
    "The LoC title-page record credits Sexual Behavior in the Human Male jointly to Alfred C. Kinsey, Wardell B. Pomeroy, and Clyde E. Martin, although the exhibition inventory shortens the contributor to Kinsey. The archive has no exact multiple-authorship card, so the Work is held rather than assigned to Kinsey alone.",
  ],
  [
    80,
    "The verified LoC inventory row gives Joseph Heller the impossible dates 1888-1957 while naming Catch-22. Because the archive has no exact Heller Work card and the official row contains an identity-metadata error, the item is held with the discrepancy explicit rather than silently corrected into a mapping.",
  ],
  [
    87,
    "The official LoC page credits The Autobiography of Malcolm X jointly to Malcolm X and Alex Haley. The archive has no exact Work card with both linked author credits, so it is held and must not be assigned to either contributor alone.",
  ],
  [
    92,
    "LoC credits Our Bodies, Ourselves to the Boston Women's Health Book Collective and explains that a dozen women collaborated on it. The archive has no exact card with collective authorship, so the item is held rather than mapped to an invented single writer.",
  ],
  [
    94,
    "LoC identifies Toni Morrison's Beloved: A Novel, while the plausible archive card is titled only Beloved and no reviewed exact-title alias connects the inventory wording to that record. The item is held under the exact-title gate rather than accepting a near-title match.",
  ],
]);

const extraEvidenceUrls = new Map([
  [11, ["https://www.loc.gov/item/rc01001484/"]],
  [70, ["https://www.loc.gov/pictures/item/2005696084/"]],
]);

function candidateKindForOrdinal(ordinal) {
  for (const [candidateKind, ordinals] of kindGroups) {
    if (ordinals.has(ordinal)) return candidateKind;
  }
  return "work";
}

function reviewFields({ status, recordKey = null, reason, evidenceUrls }) {
  return {
    adjudicationStatus: status,
    adjudicatedRecordKey: recordKey,
    adjudicatedAt,
    adjudicatedBy,
    adjudicationReason: reason,
    adjudicationEvidenceUrls: [...new Set(evidenceUrls)],
  };
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const source = registry.sources.find((candidate) => candidate.id === sourceId);
const inventory = registry.inventories.find(
  (candidate) => candidate.sourceId === sourceId
);
if (!source || !inventory || inventory.items.length !== 96) {
  throw new Error("Expected the exact 96-item LoC inventory");
}

const snapshotBytes = await readFile(snapshotPath);
const observedSnapshotHash = createHash("sha256")
  .update(snapshotBytes)
  .digest("hex");
if (
  source.snapshot.snapshotStatus !== "verified-content-hash" ||
  source.snapshot.contentSha256 !== observedSnapshotHash
) {
  throw new Error(
    `LoC snapshot hash mismatch: registry=${source.snapshot.contentSha256}, observed=${observedSnapshotHash}`
  );
}

const classifiedOrdinals = new Set(
  [...kindGroups.values()].flatMap((ordinals) => [...ordinals])
);
if (
  classifiedOrdinals.size !== 30 ||
  [...classifiedOrdinals].some((ordinal) => ordinal < 1 || ordinal > 96)
) {
  throw new Error("LoC non-default classification matrix is incomplete or invalid");
}
if (
  acceptedRecordKeys.size !== 11 ||
  rejectedReasons.size !== 13 ||
  [...acceptedRecordKeys.keys()].some((ordinal) => rejectedReasons.has(ordinal))
) {
  throw new Error("LoC outcome matrices are inconsistent");
}

const nebInventory = registry.inventories.find(
  (candidate) => candidate.sourceId === "neb-svet-important-classics-2026-09-02"
);
const nebGatsby = nebInventory?.items.find(
  (item) =>
    item.adjudicationStatus === "accepted" &&
    item.adjudicatedRecordKey ===
      "usa:francis_scott_fitzgerald:the-great-gatsby"
);
if (!nebGatsby) {
  throw new Error("Expected the previously adjudicated NEB Great Gatsby mapping");
}

for (const item of inventory.items) {
  item.candidateKind = candidateKindForOrdinal(item.ordinal);
  item.entityKind = entityKindByCandidateKind.get(item.candidateKind);
  if (!item.entityKind) {
    throw new Error(`Missing entity kind for LoC ordinal ${item.ordinal}`);
  }

  const evidenceUrls = [
    item.itemUrl,
    collectionUrl,
    ...(extraEvidenceUrls.get(item.ordinal) || []),
  ];
  let decision;
  if (acceptedRecordKeys.has(item.ordinal)) {
    const recordKey = acceptedRecordKeys.get(item.ordinal);
    if (item.ordinal === 47) {
      decision = reviewFields({
        status: "accepted",
        recordKey,
        reason:
          "Manual Work-level review confirms that the LoC entry identifies F. Scott Fitzgerald's The Great Gatsby and maps to the exact record already adjudicated for the same Work in the independent NEB inventory. That prior reviewed mapping supplies a non-arbitrary target despite a lower-quality duplicate import. This records a second independent signal but does not write a canon claim.",
        evidenceUrls: [
          ...evidenceUrls,
          nebGatsby.itemUrl,
          ...(nebGatsby.adjudicationEvidenceUrls || []),
        ],
      });
    } else if (item.ordinal === 24) {
      decision = reviewFields({
        status: "accepted",
        recordKey,
        reason:
          "Manual identity review confirms Leaves of Grass as Walt Whitman's authorial, repeatedly revised poetry collection and maps that aggregate Work to the one exact archive record. It is one LoC signal only and creates no canon claim by itself.",
        evidenceUrls,
      });
    } else {
      decision = reviewFields({
        status: "accepted",
        recordKey,
        reason: `Manual title-and-author review confirms that the LoC entry «${item.titleExact}» by ${item.contributorExact} identifies the exact archive Work ${recordKey}. Different displayed manifestations are not counted separately, and this decision does not itself create a canon claim.`,
        evidenceUrls,
      });
    }
  } else if (rejectedReasons.has(item.ordinal)) {
    decision = reviewFields({
      status: "rejected",
      reason: rejectedReasons.get(item.ordinal),
      evidenceUrls,
    });
  } else {
    const reason =
      specialHoldReasons.get(item.ordinal) ||
      `The official LoC entry identifies «${item.titleExact}» by ${
        item.contributorExact || "an unrecorded contributor"
      }, but manual title-and-author review found no unique exact archive Work card. The item is held instead of inventing a record key, silently normalizing identity, or treating the displayed edition as a new Work.`;
    decision = reviewFields({
      status: "held",
      reason,
      evidenceUrls,
    });
  }

  Object.assign(item, decision);
  item.itemHash = registryItemHash(sourceId, item);
}

const counts = Object.fromEntries(
  ["accepted", "rejected", "held"].map((status) => [
    status,
    inventory.items.filter((item) => item.adjudicationStatus === status).length,
  ])
);
if (counts.accepted !== 11 || counts.rejected !== 13 || counts.held !== 72) {
  throw new Error(`Unexpected LoC decision counts: ${JSON.stringify(counts)}`);
}

source.inventoryStatus = "transcribed";
source.coverageStatus = "in-progress";
source.notes =
  "The verified 96-row LoC exhibition inventory has a recorded manual Work-level decision for every displayed row: 11 accepted exact archive mappings, 13 rejected non-Work-specific manifestations/companions/aggregates, and 72 evidence-backed holds. The rejected rows comprise two ambiguous multiwork editions, four edition/manifestation artifacts, four exhibit companions, and three editorial aggregates. Holds preserve missing exact cards, unresolved duplicate cards, exact-title discrepancies, and nine works requiring coauthored, anonymous, or collective authorship models. The source remains transcribed/in-progress because holds remain. Great Gatsby is the only exact cross-source overlap mapped to the already adjudicated NEB record; no canon claim is written automatically.";

await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      sourceId,
      snapshotSha256: observedSnapshotHash,
      items: inventory.items.length,
      ...counts,
      acceptedRecordKeys: inventory.items
        .filter((item) => item.adjudicationStatus === "accepted")
        .map((item) => item.adjudicatedRecordKey),
    },
    null,
    2
  )
);
