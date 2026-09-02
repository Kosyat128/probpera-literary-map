import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registryItemHash } from "./lib/book-canon-registry.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const registryPath = path.join(
  projectRoot,
  "data",
  "book-canon-source-registry.json"
);
const sourceId = "neb-svet-important-classics-2026-09-02";
const collectionUrl =
  "https://svetapp.rusneb.ru/collections/vazhnaya-klassika";
const adjudicatedAt = "2026-09-02";
const adjudicatedBy = "Codex manual Work-identity review";

const acceptedRecordKeys = new Map([
  ["goncharov-i-a-oblomov", "russia:goncharov:oblomov-editorial"],
  [
    "ivan-sergeevich-turgenev-zapiski-okhotnika",
    "russia:turgenev:legacy-turgenev-записки-охотника",
  ],
  ["gogol-n-v-myortvye-dushi", "russia:gogol:legacy-gogol-мёртвые-души"],
  [
    "lermontov-m-yu-geroi-nashego-vremeni",
    "russia:lermontov:a-hero-of-our-time-editorial",
  ],
  [
    "fedor-mikhailovich-dostoevskii-prestuplenie-i-nakazanie",
    "russia:dostoevsky:crime-and-punishment",
  ],
  ["povesti-belkina", "russia:pushkin:legacy-pushkin-повести-белкина"],
  [
    "ivan-sergeevich-turgenev-otcy-i-deti",
    "russia:turgenev:fathers-and-sons",
  ],
  ["pushkin-a-s-evgenii-onegin", "russia:pushkin:eugene-onegin-editorial"],
  ["tri-mushketyora", "france:alexandre_dumas:three-musketeers"],
  [
    "sobor-parizhskoi-bogomateri",
    "france:victor_hugo:the-hunchback-of-notre-dame-editorial",
  ],
  [
    "proshai-oruzhie",
    "usa:ernest_hemingway:legacy-ernest_hemingway-прощай-оружие",
  ],
  [
    "aleksandr-sergeevich-griboedov-gore-ot-uma",
    "russia:griboedov:legacy-griboedov-горе-от-ума",
  ],
  ["doktor-zhivago", "russia:pasternak:doctor-zhivago-editorial"],
  ["anton-pavlovich-chekhov-chaika", "russia:chekhov:legacy-chekhov-чайка"],
  [
    "fedor-mikhailovich-dostoevskii-bratya-karamazovy",
    "russia:dostoevsky:the-brothers-karamazov-editorial",
  ],
  [
    "don-kikhot",
    "spain:miguel_de_cervantes:openlibrary-works-ol15272537w",
  ],
  [
    "mashina-vremeni",
    "england:h_g_wells:legacy-h_g_wells-машина-времени",
  ],
  ["lev-nikolaevich-tolstoi-anna-karenina", "russia:tolstoy:anna-karenina-editorial"],
  [
    "faust",
    "germany:johann_wolfgang_goethe:legacy-johann_wolfgang_goethe-фауст",
  ],
  [
    "pigmalion",
    "ireland:george_bernard_shaw:legacy-george_bernard_shaw-пигмалион",
  ],
  ["gamlet", "england:william_shakespeare:hamlet"],
  ["dzheyn-eyr", "england:charlotte_bronte:jane-eyre-editorial"],
  [
    "velikii-getsbi",
    "usa:francis_scott_fitzgerald:the-great-gatsby",
  ],
  [
    "ostrov-doktora-moro",
    "england:h_g_wells:legacy-h_g_wells-остров-доктора-моро",
  ],
  [
    "theodore-dreiser-finansist",
    "usa:theodore_dreiser:legacy-theodore_dreiser-финансист",
  ],
]);

const rejectedEditionAggregates = new Set([
  "kuprin-a-i-rasskazy",
  "esenin-s-a-stikhotvoreniya",
  "afanasii-afanasevich-fet-stikhotvoreniya",
  "marina-ivanovna-cvetaeva-stikhotvoreniya",
  "pasternak-b-l-stikhotvoreniya",
  "ostrovskii-a-n-pesy",
  "andreev-l-n-povesti-i-rasskazy",
  "fyodor-ivanovich-tyutchev-stikhotvoreniya",
  "zoshenko-mikhail-mikhailovich-povesti-i-rasskazy",
  "pyshka-novelly-i-rasskazy",
  "gumilev-nikolai-stepanovich-stikhotvoreniya",
  "arsenii-aleksandrovich-tarkovskii-stikhotvoreniya",
  "ivan-bunin-povesti-i-rasskazy",
  "blok-alexander-stikhotvoreniya",
  "akhmatova-a-a-stikhotvoreniya",
]);

const holdDecisions = new Map([
  [
    "vladimir-alekseevich-gilyarovskii-moskva-i-moskvichi",
    {
      reason:
        "The NEB item and the RSL national-bibliography record identify «Москва и москвичи» by Vladimir Gilyarovsky as a Work, but the archive contains no exact Work record for that author; the item is held instead of inventing a record key or canon claim.",
      evidenceUrls: [
        "https://search.rsl.ru/ru/record/01006083110",
      ],
    },
  ],
  [
    "dvenadcat-stulev",
    {
      reason:
        "The official records identify «Двенадцать стульев» as one Work by both Ilya Ilf and Yevgeny Petrov, but the archive has no corresponding card with authorship.kind=multiple and two linked author credits; the item is held and must never be assigned to one writer only.",
      evidenceUrls: [
        "https://search.rsl.ru/ru/record/01009200723",
        "https://nupress.northwestern.edu/9780810167162/the-twelve-chairs/",
      ],
    },
  ],
  [
    "printsessa-turandot",
    {
      reason:
        "The NEB item identifies Carlo Gozzi's play «Принцесса Турандот», including the 1923 Russian translation from Italian, but the archive contains no exact Gozzi Work record; the item is held instead of fabricating a target identity.",
      evidenceUrls: [
        "https://old.svetapp.rusneb.ru/catalog/printsessa-turandot",
        "https://onlinebooks.library.upenn.edu/webbin/book/lookupname?key=Gozzi%2C+Carlo%2C+1720-1806",
      ],
    },
  ],
  [
    "portret-doriana-greya",
    {
      reason:
        "The NEB item identifies Oscar Wilde's «Портрет Дориана Грея», but the archive exposes two duplicate target records under England and Ireland. The National Library of Ireland evidence supports Wilde's Irish author identity, yet a reviewed cross-country Work merge is still required before one record key can be selected.",
      evidenceUrls: [
        "https://catalogue.nli.ie/Record/vtls000905378",
      ],
    },
  ],
  [
    "leto-gospodne",
    {
      reason:
        "The NEB item and the RSL national-bibliography record identify Ivan Shmelev's «Лето Господне» as a Work, but the archive contains no exact Work record for Shmelev; the item is held instead of inventing an archive mapping.",
      evidenceUrls: [
        "https://search.rsl.ru/ru/record/01009703909",
      ],
    },
  ],
]);

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
if (!source || !inventory || inventory.items.length !== 47) {
  throw new Error("Expected the exact 47-item NEB inventory");
}

const observedIds = new Set(inventory.items.map((item) => item.itemId));
const decisionIds = new Set([
  ...acceptedRecordKeys.keys(),
  ...rejectedEditionAggregates,
  "dni-turbinyh",
  "peterburgskie-povesti",
  ...holdDecisions.keys(),
]);
if (
  observedIds.size !== decisionIds.size ||
  [...observedIds].some((itemId) => !decisionIds.has(itemId))
) {
  throw new Error("NEB decision inventory does not exactly match all 47 items");
}

for (const item of inventory.items) {
  let decision;
  if (acceptedRecordKeys.has(item.itemId)) {
    const isBelkinCycle = item.itemId === "povesti-belkina";
    decision = reviewFields({
      status: "accepted",
      recordKey: acceptedRecordKeys.get(item.itemId),
      reason: isBelkinCycle
        ? "Manual identity review confirms «Повести Белкина» as Pushkin's authorial five-story cycle and maps that aggregate Work to the single matching archive record. This is one NEB signal only and does not assert canonical status without a second independent signal."
        : `Manual identity review confirms that the NEB collection entry «${item.titleExact}» by ${item.contributorExact} identifies the exact Work mapped to ${acceptedRecordKeys.get(item.itemId)}. This records one NEB signal only and does not assert canonical status without a second independent signal.`,
      evidenceUrls: isBelkinCycle
        ? [
            item.itemUrl,
            collectionUrl,
            "https://www.culture.ru/books/1033/povesti-pokoinogo-ivana-petrovicha-belkina",
            "https://www.pushkinmuseum.ru/?q=node%2F5390",
          ]
        : [item.itemUrl, collectionUrl],
    });
  } else if (rejectedEditionAggregates.has(item.itemId)) {
    decision = reviewFields({
      status: "rejected",
      reason: `The NEB entry «${item.titleExact}» by ${item.contributorExact} is an edition-level compilation of multiple separately identifiable works, not one stable Work identity. It is therefore reviewed and rejected as a Work-specific canon signal.`,
      evidenceUrls: [item.itemUrl, collectionUrl],
    });
  } else if (item.itemId === "dni-turbinyh") {
    decision = reviewFields({
      status: "rejected",
      reason:
        "The NEB title «Дни Турбиных (Белая гвардия)» combines Bulgakov's play «Дни Турбиных» and novel «Белая гвардия» in one manifestation label. Because the label does not identify one Work, it is rejected as a Work-specific canon signal.",
      evidenceUrls: [item.itemUrl, collectionUrl],
    });
  } else if (item.itemId === "peterburgskie-povesti") {
    item.candidateKind = "edition-aggregate";
    item.entityKind = "manifestation";
    decision = reviewFields({
      status: "rejected",
      reason:
        "«Петербургские повести» is a later philological and publishing grouping, not an authorial collection title used by Gogol; the official Gogol House notes that contents vary between editions. The NEB item is therefore classified as an edition aggregate and rejected as a stable Work-specific signal.",
      evidenceUrls: [
        item.itemUrl,
        collectionUrl,
        "https://www.domgogolya.ru/exhibitions/125/",
      ],
    });
  } else if (holdDecisions.has(item.itemId)) {
    const hold = holdDecisions.get(item.itemId);
    decision = reviewFields({
      status: "held",
      reason: hold.reason,
      evidenceUrls: [item.itemUrl, collectionUrl, ...hold.evidenceUrls],
    });
  } else {
    throw new Error(`Missing decision for ${item.itemId}`);
  }

  Object.assign(item, decision);
  item.itemHash = registryItemHash(sourceId, item);
}

source.inventoryStatus = "transcribed";
source.coverageStatus = "in-progress";
source.notes =
  "The 47 collection links were manually transcribed from the rendered official collection page. Work-level review is recorded for every item: 25 accepted mappings (24 individual Works and the authorial aggregate Work «Повести Белкина»), 17 rejected non-Work-specific edition groupings, and 5 evidence-backed holds. The holds cover three missing archive Works, one missing coauthored Work that requires authorship.kind=multiple, and the unresolved duplicate Oscar Wilde records. The source remains transcribed/in-progress because those holds remain and no upstream HTML bytes were retained; snapshotStatus therefore remains unverified-content-hash and no accepted item alone creates a canonical claim.";

await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      sourceId,
      items: inventory.items.length,
      accepted: inventory.items.filter(
        (item) => item.adjudicationStatus === "accepted"
      ).length,
      rejected: inventory.items.filter(
        (item) => item.adjudicationStatus === "rejected"
      ).length,
      held: inventory.items.filter((item) => item.adjudicationStatus === "held")
        .length,
    },
    null,
    2
  )
);
