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
  "bnf-dne-education-epub-selection.html.bin"
);
const sourceId = "bnf-dne-education-epub-selection-2018";
const collectionUrl =
  "https://gallica.bnf.fr/blog/18012018/150-epub-gallica-selectionnes-par-le-ministere-de-leducation-nationale?mode=desktop";
const adjudicatedAt = "2026-09-02";
const adjudicatedBy = "Codex manual BnF Work-identity review";

// These are semantic Work classes, not a guess based on title punctuation. In
// particular, author-established collections remain distinct from later
// editor-defined anthologies, and displayed volumes/illustrated translations
// remain manifestations rather than additional Works.
const kindGroups = new Map([
  [
    "work-cycle",
    new Set([3, 9, 10, 14, 19, 23, 38, 46, 66, 72, 76, 91, 103, 120, 129]),
  ],
  ["coauthored-work", new Set([17, 45])],
  ["anonymous-work", new Set([2])],
  ["ambiguous-multiwork-edition", new Set([31, 65])],
  [
    "edition-aggregate",
    new Set([1, 6, 12, 18, 20, 70, 81, 83, 95, 98, 110, 111, 115]),
  ],
  [
    "editorial-aggregate",
    new Set([11, 33, 40, 47, 48, 89, 90, 92, 93, 102, 144]),
  ],
  [
    "edition-manifestation-artifact",
    new Set([
      4, 5, 15, 16, 21, 24, 25, 28, 29, 39, 41, 42, 43, 44, 49, 51,
      52, 53, 54, 55, 56, 57, 58, 59, 60, 62, 64, 67, 68, 69, 71, 73,
      77, 80, 84, 85, 86, 94, 104, 113, 114, 117, 118, 121, 122, 123,
      124, 125, 126, 127, 132, 133, 135, 136, 137, 138, 139, 140, 141,
      143, 148,
    ]),
  ],
]);

const entityKindByCandidateKind = new Map([
  ["work", "work"],
  ["work-cycle", "aggregate-work"],
  ["coauthored-work", "work"],
  ["anonymous-work", "work"],
  ["collective-work", "work"],
  ["edition-aggregate", "manifestation"],
  ["editorial-aggregate", "aggregate-work"],
  ["edition-manifestation-artifact", "manifestation"],
  ["exhibit-companion", "exhibit-object"],
  ["ambiguous-multiwork-edition", "ambiguous-manifestation"],
]);

// Every target below was checked against both the exact Gallica title/creator
// identity and the archive card. Near-title and duplicate-card cases are not in
// this map.
const acceptedRecordKeys = new Map([
  [27, "france:alexandre_dumas:three-musketeers"],
  [37, "france:flaubert:openlibrary-works-ol893601w"],
  [149, "france:emile_zola:openlibrary-works-ol118984w"],
]);

const rejectedOrdinals = new Set(
  [
    kindGroups.get("edition-aggregate"),
    kindGroups.get("editorial-aggregate"),
    kindGroups.get("edition-manifestation-artifact"),
  ].flatMap((ordinals) => [...ordinals])
);

const specialRejectedReasons = new Map([
  [
    12,
    "The official Gallica record shows an illustrated Doré composition accompanied by a Ballade by Pierre-Jean de Béranger and a separate Poème by Pierre Dupont. It is a multiwork illustrated edition, not one coauthored literary Work and not a separate Work-level canon signal.",
  ],
  [
    20,
    "The exact BnF label is a multi-author Théâtre classique anthology containing four Corneille plays, one Molière play, and three Racine plays. The same Gallica object is repeated at ordinals 81 and 98 under different contributors; none of the three rows is a distinct Work signal.",
  ],
  [
    70,
    "The exact label identifies fifty selected fables by La Fontaine, Florian, and Fénelon, explained and annotated for elementary pupils by E.-A. Vrau. This is a multi-author study-aid anthology, not one author-specific Work.",
  ],
  [
    81,
    "This is the same multi-author Théâtre classique anthology and the same Gallica object as ordinals 20 and 98, merely exposed under Molière as contributor. It must not become either a separate Work or a duplicate canon signal.",
  ],
  [
    95,
    "The exact label combines Le côté de Guermantes II with Sodome et Gomorrhe inside an À la recherche du temps perdu volume. It is a mixed cycle-component edition, not one independently identifiable Work.",
  ],
  [
    98,
    "This is the same multi-author Théâtre classique anthology and the same Gallica object as ordinals 20 and 81, merely exposed under Racine as contributor. It must not become either a separate Work or a duplicate canon signal.",
  ],
  [
    144,
    "BnF identifies Journal d'un poète as an apocryphal title assigned to a chronological edition of Vigny's notebooks. The displayed 1867 volume was collected and selectively published from those private notes by Louis Ratisbonne, so this exact item is an editor-defined posthumous aggregate rather than an author-established Work signal.",
  ],
]);

const specialHoldReasons = new Map([
  [
    2,
    "The BnF item identifies the anonymous medieval Farce de maître Pathelin, but the archive has no exact card with anonymous authorship. It is held rather than assigning the Work to an invented person or treating a manifestation contributor as author.",
  ],
  [
    7,
    "BnF identifies Balzac's Le Père Goriot, but the archive contains both france:balzac:openlibrary-works-ol85047w (with the malformed title La père Goriot) and france:balzac:legacy-balzac-отец-горио for the same apparent Work. The item is held until the multilingual duplicate pair is merged or one record is authoritatively deprecated.",
  ],
  [
    17,
    "The BnF bibliographic record credits Les Démoniaques dans l'art jointly to Jean-Martin Charcot and Paul Richer. The archive has no exact Work card carrying both linked author credits, so the Work is held rather than attributed to either person alone.",
  ],
  [
    31,
    "The verified inventory label says only Traduction de Leconte de Lisle under Eschyle and does not name the translated play or a stable collection identity. The exact Work boundary cannot be reconstructed from this ambiguous manifestation label, so no record key is invented.",
  ],
  [
    34,
    "BnF identifies Flaubert's Salammbô, but the archive contains both france:flaubert:openlibrary-works-ol893958w and the Russian-title card france:flaubert:legacy-flaubert-саламбо for the same Work. A literal French-title match is not sufficient to choose one multilingual duplicate arbitrarily.",
  ],
  [
    35,
    "BnF identifies Flaubert's L'Éducation sentimentale, but the archive contains both france:flaubert:openlibrary-works-ol893802w and the Russian-title card france:flaubert:legacy-flaubert-воспитание-чувств for the same Work. A literal French-title match is not sufficient to choose one multilingual duplicate arbitrarily.",
  ],
  [
    36,
    "BnF identifies Flaubert's La Tentation de saint Antoine, but the archive contains both france:flaubert:openlibrary-works-ol893948w and the English-title card france:flaubert:openlibrary-works-ol31515044w for the same apparent Work. Neither multilingual duplicate is selected without a reviewed merge/deprecation decision.",
  ],
  [
    45,
    "The inventory row shortens the contributor to Edmond de Goncourt, while BnF's own bibliographic authority credits Germinie Lacerteux to both Edmond and Jules de Goncourt. The archive has no exact card with linked multiple authorship, so it is held and must not be assigned to Edmond alone.",
  ],
  [
    65,
    "The inventory attributes this translated and illustrated Münchhausen item to Abraham Gotthelf Kästner, while BnF's bibliographic record for the same French title identifies Gottfried August Bürger as text author. This unresolved Work/manifestation authorship conflict makes an exact archive mapping unsafe.",
  ],
  [
    75,
    "BnF identifies Guy de Maupassant's Une vie, but the archive exposes two plausible same-author records (france:maupassant:openlibrary-works-ol93840w titled Une vie and france:maupassant:openlibrary-works-ol93822w titled Vie). Neither duplicate is selected arbitrarily; the item is held pending merge or authoritative deprecation.",
  ],
  [
    96,
    "The BnF row identifies the Recherche cycle component À l'ombre des jeunes filles en fleurs, but the archive exposes both france:marcel_proust:openlibrary-works-ol29549062w and the English-title card france:marcel_proust:openlibrary-works-ol1190226w for the same apparent component. It is held pending multilingual duplicate resolution.",
  ],
  [
    99,
    "BnF identifies Racine's Britannicus, but the archive contains both france:racine:openlibrary-works-ol15725668w and the Russian-title card france:racine:legacy-racine-британник for the same Work. A literal French-title match is not sufficient to choose one multilingual duplicate arbitrarily.",
  ],
  [
    100,
    "BnF identifies Racine's Phèdre, but the archive contains both france:racine:openlibrary-works-ol19922727w and the Russian-title card france:racine:legacy-racine-федра for the same Work. A literal French-title match is not sufficient to choose one multilingual duplicate arbitrarily.",
  ],
  [
    120,
    "BnF treats Chroniques italiennes as a conventional authorial collection title comprising Stendhal's related nouvelles, so it is modeled as a work-cycle rather than an editorial manifestation. The archive nevertheless has no unique exact Work card, and the item remains held without an invented target.",
  ],
  [
    131,
    "BnF identifies Jules Verne's Voyage au centre de la terre, but the archive contains the French-title card france:jules_verne:openlibrary-works-ol1099513w, a Russian legacy card, and several additional translated-title cards for the same apparent Work. The exact-title card is not selected until those multilingual duplicates are merged or deprecated.",
  ],
  [
    146,
    "BnF identifies Émile Zola's Thérèse Raquin, but the archive contains two same-author cards for the same apparent Work (france:emile_zola:openlibrary-works-ol7982341w and france:emile_zola:openlibrary-works-ol3521623w). Neither duplicate is selected arbitrarily; the item is held pending merge or authoritative deprecation.",
  ],
  [
    147,
    "The BnF label identifies Le ventre de Paris as tome 3 of Les Rougon-Macquart, while the archive contains both france:emile_zola:openlibrary-works-ol118977w and france:emile_zola:legacy-emile_zola-чрево-парижа for that novel. The series/tome wording and multilingual duplicate pair require a reviewed identity merge before mapping.",
  ],
]);

const extraEvidenceUrls = new Map([
  [
    12,
    ["https://gallica.bnf.fr/ark:/12148/bpt6k1045490m.texteBrut"],
  ],
  [17, ["https://catalogue.bnf.fr/ark:/12148/cb31213373t"]],
  [45, ["https://catalogue.bnf.fr/ark:/12148/cb416509783"]],
  [65, ["https://catalogue.bnf.fr/ark:/12148/cb34601591q"]],
  [120, ["https://catalogue.bnf.fr/ark:/12148/cb122948673"]],
  [
    144,
    [
      "https://catalogue.bnf.fr/ark:/12148/cb180209245",
      "https://catalogue.bnf.fr/ark:/12148/cb31577980g",
    ],
  ],
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

function rejectedReason(item) {
  const special = specialRejectedReasons.get(item.ordinal);
  if (special) return special;
  if (item.candidateKind === "edition-aggregate") {
    return `The exact BnF label «${item.titleExact}» combines separately identifiable texts, plays, or cycle components in one displayed edition. The bundle is not one stable author-specific Work and cannot supply a Work-level canon signal.`;
  }
  if (item.candidateKind === "editorial-aggregate") {
    return `Manual review of the exact BnF item «${item.titleExact}» identifies an editor-defined selection, complete-works volume, correspondence volume, or posthumous compilation. Its contents do not establish one author-created aggregate Work identity, so it is rejected as an editorial aggregate.`;
  }
  if (item.candidateKind === "edition-manifestation-artifact") {
    return `The exact BnF label «${item.titleExact}» is manifestation-specific: it identifies a dated/revised edition, translator or illustrator, numbered tome, or only a named part of a larger Work. This displayed artifact cannot be counted as a separate canonical Work signal.`;
  }
  throw new Error(`Missing rejection rationale for BnF ordinal ${item.ordinal}`);
}

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const source = registry.sources.find((candidate) => candidate.id === sourceId);
const inventory = registry.inventories.find(
  (candidate) => candidate.sourceId === sourceId
);
if (!source || !inventory || inventory.items.length !== 149) {
  throw new Error("Expected the exact 149-item BnF inventory");
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
    `BnF snapshot hash mismatch: registry=${source.snapshot.contentSha256}, observed=${observedSnapshotHash}`
  );
}

const classifiedOrdinals = [...kindGroups.values()].flatMap((ordinals) => [
  ...ordinals,
]);
if (
  new Set(classifiedOrdinals).size !== classifiedOrdinals.length ||
  classifiedOrdinals.some((ordinal) => ordinal < 1 || ordinal > 149)
) {
  throw new Error("BnF candidate-kind matrix overlaps or has invalid ordinals");
}
if (
  acceptedRecordKeys.size !== 3 ||
  rejectedOrdinals.size !== 85 ||
  [...acceptedRecordKeys.keys()].some((ordinal) =>
    rejectedOrdinals.has(ordinal)
  )
) {
  throw new Error("BnF outcome matrices are inconsistent");
}

const nebInventory = registry.inventories.find(
  (candidate) => candidate.sourceId === "neb-svet-important-classics-2026-09-02"
);
const nebThreeMusketeers = nebInventory?.items.find(
  (item) =>
    item.adjudicationStatus === "accepted" &&
    item.adjudicatedRecordKey === "france:alexandre_dumas:three-musketeers"
);
if (!nebThreeMusketeers) {
  throw new Error(
    "Expected the previously adjudicated NEB Three Musketeers mapping"
  );
}
if (
  inventory.items.some((item) =>
    /(?:great gatsby|grand gatsby|gatsby)/iu.test(item.titleExact)
  )
) {
  throw new Error("Unexpected Great Gatsby item in the verified BnF inventory");
}

for (const item of inventory.items) {
  item.candidateKind = candidateKindForOrdinal(item.ordinal);
  item.entityKind = entityKindByCandidateKind.get(item.candidateKind);
  if (!item.entityKind) {
    throw new Error(`Missing entity kind for BnF ordinal ${item.ordinal}`);
  }

  const evidenceUrls = [
    item.itemUrl,
    collectionUrl,
    ...(extraEvidenceUrls.get(item.ordinal) || []),
  ];
  let decision;
  if (acceptedRecordKeys.has(item.ordinal)) {
    const recordKey = acceptedRecordKeys.get(item.ordinal);
    if (item.ordinal === 27) {
      decision = reviewFields({
        status: "accepted",
        recordKey,
        reason:
          "Manual Work-level review confirms that this BnF row identifies Alexandre Dumas père's Les Trois Mousquetaires and maps to the exact archive record already accepted for the same Work in the independent NEB inventory. This records a second independent signal but writes no canon claim.",
        evidenceUrls: [
          ...evidenceUrls,
          nebThreeMusketeers.itemUrl,
          ...(nebThreeMusketeers.adjudicationEvidenceUrls || []),
        ],
      });
    } else {
      decision = reviewFields({
        status: "accepted",
        recordKey,
        reason: `Manual exact-title, creator, and Work-identity review confirms that the BnF entry «${item.titleExact}» by ${item.contributorExact} maps to the unique archive Work ${recordKey}. No displayed edition or related object is counted separately, and this single BnF signal creates no canon claim.`,
        evidenceUrls,
      });
    }
  } else if (rejectedOrdinals.has(item.ordinal)) {
    decision = reviewFields({
      status: "rejected",
      reason: rejectedReason(item),
      evidenceUrls,
    });
  } else {
    const reason =
      specialHoldReasons.get(item.ordinal) ||
      `The official BnF entry identifies «${item.titleExact}» by ${
        item.contributorExact || "an unrecorded contributor"
      }, but manual title-and-creator review found no unique exact archive Work card. The item is held instead of inventing a record key, accepting a near-title alias, or choosing among unresolved identities.`;
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
if (counts.accepted !== 3 || counts.rejected !== 85 || counts.held !== 61) {
  throw new Error(`Unexpected BnF decision counts: ${JSON.stringify(counts)}`);
}
if (
  inventory.items.some(
    (item) =>
      item.adjudicationStatus === "accepted" &&
      item.candidateKind !== "work"
  )
) {
  throw new Error("BnF accepts only exact single-Work identities in this review");
}

source.inventoryStatus = "transcribed";
source.coverageStatus = "in-progress";
source.notes =
  "The French Ministry of Education DNE page labels the selection as 150 EPUBs but exposes 149 complete title/EPUB link pairs; the registry invents no missing item. All 149 observable rows now have manual fail-closed Work-level decisions: 3 accepted exact archive mappings, 85 rejected non-Work-specific manifestations or aggregates, and 61 evidence-backed holds. Rejections comprise 13 edition aggregates, 11 editorial aggregates, and 61 edition/manifestation artifacts. Holds preserve 41 unmatched or duplicate-blocked single Works, 15 authorial work-cycles, two coauthored Works, one anonymous Work, and two ambiguous manifestations. Multilingual duplicate cards are held even when one card literally matches the French title. The source remains transcribed/in-progress because holds remain. Les Trois Mousquetaires is the only newly accepted BnF row already accepted by an independent source; no canon claim is written automatically, and the pre-existing Great Gatsby cross-source result is unchanged.";

await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      sourceId,
      snapshotSha256: observedSnapshotHash,
      items: inventory.items.length,
      ...counts,
      candidateKindCounts: Object.fromEntries(
        [
          ...inventory.items.reduce((kindCounts, item) => {
            kindCounts.set(
              item.candidateKind,
              (kindCounts.get(item.candidateKind) || 0) + 1
            );
            return kindCounts;
          }, new Map()),
        ].sort(([left], [right]) => left.localeCompare(right, "en"))
      ),
      acceptedOrdinals: inventory.items
        .filter((item) => item.adjudicationStatus === "accepted")
        .map((item) => item.ordinal),
      rejectedOrdinals: inventory.items
        .filter((item) => item.adjudicationStatus === "rejected")
        .map((item) => item.ordinal),
      heldOrdinals: inventory.items
        .filter((item) => item.adjudicationStatus === "held")
        .map((item) => item.ordinal),
      acceptedRecordKeys: inventory.items
        .filter((item) => item.adjudicationStatus === "accepted")
        .map((item) => item.adjudicatedRecordKey),
    },
    null,
    2
  )
);
