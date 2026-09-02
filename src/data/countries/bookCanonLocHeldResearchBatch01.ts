import heldReviewBatchJson from "../../../data/book-canon-loc-held-review-batch01.json";

import type { BookCanonResearchOverlay } from "../bookCanonResearchCatalog";
import type {
  WorkDescriptionProvenanceProfile,
  WorkSourceProfile,
} from "./types";

const checkedAt = "2026-09-02";
const expectedBatchFingerprint =
  "5d717a332dbf5ecea2a12f63152c66219e05284dc14058d670a0f6ea3dca245e";

const expectedReviewFingerprints: Record<string, string> = {
  "harriet-beecher-stowe-uncle-toms-cabin":
    "f6782106efbda9b2c048388de2a5ca8bd34ae936030341b20b0aa605f113e6f0",
  "louisa-may-alcott-little-women":
    "9ce6c4a6e095bc0ad5d16895a46c38aa2c2042a43da916ab4a4ad3f7ff79b699",
  "l-frank-baum-wonderful-wizard-of-oz":
    "a3a15416b1b2a8d3b3c966edc6d2bddd2405bf6e7a80b386ff6e591f38713f01",
  "upton-sinclair-the-jungle":
    "ac4dfb68e76d5e0061868338f57879662ff8a545011474535ab60db0ab8ef5e4",
  "margaret-mitchell-gone-with-the-wind":
    "2314b96d8a5adb95b0eb8abc6a5fdcb380050522fd8dd3cd62563708afdf7128",
  "e-b-white-charlottes-web":
    "fd06478f10ad209bb6b34af4848db0f4b0cd24ff9301e0aa633c79f1e3217e64",
  "ayn-rand-atlas-shrugged":
    "e8ad275b380f71f57bce2c574ce6118c80fbefba24e4bea55382bbc3006262c4",
  "rachel-carson-silent-spring":
    "db329c4c3ba1735e89768e1b84ffe2d2d17698a900ba1e12efa9e738c3faef62",
  "truman-capote-in-cold-blood":
    "919814200cc517237f5037d640f75a45ff57eeeb7118faef041d0b025a9fe4c9",
  "toni-morrison-beloved":
    "ed6ce1876adb799071e149ab0ec42d53795eb029acd5f4d927518af9e5107a00",
};

type LocDisplayedManifestation = {
  titleExact: string;
  publicationPlace: string;
  publisher: string;
  year: number;
};

type LocReviewDecision =
  | {
      status: "draft-addition";
      reasonRu: string;
      requiredBeforeIntegration: string[];
    }
  | {
      status: "accepted-mapping";
      recordKey: string;
      sourceTitleAliasExact: string;
      expectedArchiveFields: {
        title: string;
        originalTitle: string;
        firstPublished: number;
      };
      reasonRu: string;
    };

type LocHeldReview = {
  reviewId: string;
  canonHoldRef: {
    sourceId: string;
    ordinal: number;
    itemId: string;
    itemHash: string;
  };
  locIdentity: {
    entityKind: "work";
    titleExact: string;
    creatorExact: string;
    workFirstPublishedYear: number;
    itemUrl: string;
    displayedManifestation: LocDisplayedManifestation;
    sources: Array<{ role: string; url: string; findingRu: string }>;
  };
  ruTitle: {
    recommendedExact: string;
    evidence: {
      authority: string;
      recordKind: "national-bibliography" | "official-publisher-record";
      recordId: string;
      url: string;
      catalogTitleExact: string;
      authorExact: string;
      publisher: string;
      publicationYear: number | null;
      translatorExact: string | null;
      checkedAt: string;
    };
  };
  archiveReview: {
    exactTitleMatchRecordKeys: string[];
    writerMatchKeys: string[];
  };
  decision: LocReviewDecision;
  descriptionDraftRu: string;
  descriptionSourceUrls: string[];
};

type LocHeldReviewBatch = {
  applicationStatus: "research-only";
  sourceId: "loc-books-that-shaped-america-2012";
  batchFingerprint: string;
  summary: {
    reviewCount: number;
    acceptedMappingCount: number;
    draftAdditionCount: number;
    holdCount: number;
    productionActionCount: number;
    canonClaimCount: number;
  };
  reviews: LocHeldReview[];
};

type CandidateConfig = {
  suggestedRecordKey: string;
  writerId: string;
  creditNames: { ru: string; en: string };
  enWorkTitle?: string;
  enDescription: string;
  ruDescriptionSha256: string;
  enDescriptionSha256: string;
  workModelNote: string;
  correctedLocItemUrl?: string;
};

const candidateConfig: Record<string, CandidateConfig> = {
  "harriet-beecher-stowe-uncle-toms-cabin": {
    suggestedRecordKey: "usa:harriet_beecher_stowe:uncle-toms-cabin",
    writerId: "harriet_beecher_stowe",
    creditNames: {
      ru: "Гарриет Бичер-Стоу",
      en: "Harriet Beecher Stowe",
    },
    enDescription:
      "Harriet Beecher Stowe’s novel was first serialized in the abolitionist newspaper National Era from June 1851 to April 1852, and the first book edition was published in March 1852. According to the Library of Congress, the work drew attention to the suffering of enslaved people and the separation of families and significantly strengthened antislavery sentiment before the American Civil War.",
    ruDescriptionSha256:
      "5c328130dfe5bb25fcf6db1b63df4225f6c716a93b05fc545295b7b6fb3856b3",
    enDescriptionSha256:
      "ab013808a1bae742f30e4321c1fd8b23c6b9cf17262836b876acb86382c0cd8b",
    workModelNote:
      "One Work first published in book form in 1852; the preceding newspaper serialization and later multi-volume editions are manifestations or publication history, not separate Works.",
  },
  "louisa-may-alcott-little-women": {
    suggestedRecordKey: "usa:louisa_may_alcott:little-women",
    writerId: "louisa_may_alcott",
    creditNames: { ru: "Луиза Мэй Олкотт", en: "Louisa May Alcott" },
    enDescription:
      "Louisa May Alcott’s novel was published in 1868 and drew substantially on the author’s experience of growing up with three sisters; its first edition was illustrated by her younger sister May. The book was an immediate success with readers, and Alcott later continued the story in two works about the same characters.",
    ruDescriptionSha256:
      "27958ddd7abbe7aaddd739523bee7fe31d6c9190e50b8a5129daa7c88710542d",
    enDescriptionSha256:
      "851c6ea5edbc4929ae4ff6e8c7f5aa9c6609c1067b3bfb8a885d547fe91baf20",
    workModelNote:
      "This candidate represents the 1868 Work identified by LoC; later March-family continuations require their own Work identities and must not be folded into this record.",
  },
  "l-frank-baum-wonderful-wizard-of-oz": {
    suggestedRecordKey: "usa:l_frank_baum:wonderful-wizard-of-oz",
    writerId: "l_frank_baum",
    creditNames: { ru: "Лаймен Фрэнк Баум", en: "L. Frank Baum" },
    enDescription:
      "L. Frank Baum’s fairy tale was published in 1900 and immediately succeeded as one of the first original American fantasies for children. The story of Dorothy and her companions proved so popular that Baum wrote thirteen more books about the land of Oz.",
    ruDescriptionSha256:
      "d605103782a7d4332a2c2c0c2e035e1ff64faf92df234acb67a150cf633b9818",
    enDescriptionSha256:
      "29396c4e456715cda94399c2ecc48e8d7c18661b0106eda80a1892487c7d6566",
    workModelNote:
      "Baum’s Work and its Russian Expression remain distinct from Alexander Volkov’s independent adaptation «Волшебник Изумрудного города».",
  },
  "upton-sinclair-the-jungle": {
    suggestedRecordKey: "usa:upton_sinclair:the-jungle",
    writerId: "upton_sinclair",
    creditNames: { ru: "Эптон Синклер", en: "Upton Sinclair" },
    enDescription:
      "Upton Sinclair’s 1906 novel combines fictional narrative with investigative reporting on labor and production conditions in Chicago’s meatpacking plants. The Library of Congress links the book’s public impact to the adoption in 1906 of federal laws regulating meat inspection and the safety of food and drugs.",
    ruDescriptionSha256:
      "5d8d53bae6ab35037b53644fcf5ff22f353f6d4cfc14b94e66f88474f81e83e3",
    enDescriptionSha256:
      "c95bb56e3990ba068790af81800d7e0eabdcd579011a98e65cff8bac9c241b8e",
    workModelNote:
      "The Work was first published in 1906; the LoC exhibit displays a 1945 Doubleday, Page & Company manifestation. The 1945 date must never replace firstPublished=1906.",
  },
  "margaret-mitchell-gone-with-the-wind": {
    suggestedRecordKey: "usa:margaret_mitchell:gone-with-the-wind",
    writerId: "margaret_mitchell",
    creditNames: { ru: "Маргарет Митчелл", en: "Margaret Mitchell" },
    enDescription:
      "Margaret Mitchell’s novel, first published in 1936, is set in the American South during the Civil War. The Library of Congress notes its enormous success with readers and its Pulitzer Prize and National Book Award, while also pointing to criticism of its portrayal of slavery.",
    ruDescriptionSha256:
      "08ea5bdd623c60eb5286f0e1df5e559370f93b8bc2f6b36fe293deac67102c93",
    enDescriptionSha256:
      "8715072872c4acc4b65a536bba21f212e805f3918490d280094ba4ecc189c01c",
    workModelNote:
      "One 1936 Work; multi-volume Russian editions are manifestations of the same Work and must not create separate Work records.",
    correctedLocItemUrl:
      "https://www.loc.gov/exhibits/books-that-shaped-america/1900-to-1950.html#obj18",
  },
  "e-b-white-charlottes-web": {
    suggestedRecordKey: "usa:e_b_white:charlottes-web",
    writerId: "e_b_white",
    creditNames: { ru: "Элвин Брукс Уайт", en: "E. B. White" },
    enDescription:
      "E. B. White’s children’s story follows the sensible spider Charlotte as she tries to save a pig. The Library of Congress emphasizes that the book speaks to children and adults alike and treats death as a natural part of life without ponderous moralizing.",
    ruDescriptionSha256:
      "b14283a7b25757f339587cbc16db120fe3f031204e6c20330a0dd4c4178e1b23",
    enDescriptionSha256:
      "a5cebef840ef443582b6748b4eec5fe9412a59421ff5e49b4e8aa9f57739b2ab",
    workModelNote:
      "The 1952 Work is modeled independently of any later illustrated, translated, adapted, or collected manifestation.",
  },
  "ayn-rand-atlas-shrugged": {
    suggestedRecordKey: "usa:ayn_rand:atlas-shrugged",
    writerId: "ayn_rand",
    creditNames: { ru: "Эйн Рэнд", en: "Ayn Rand" },
    enDescription:
      "Ayn Rand’s 1957 novel depicts the United States in the near future, suffering a crisis caused by the entanglement of government bureaucracy and business interests. The Library of Congress notes that its defense of the free market and criticism of government intervention made the book influential within the libertarian movement.",
    ruDescriptionSha256:
      "fc4cf736ed4e8178446c3373b2ac3b10e37b8c522e93eee6361cfe0677fac1ea",
    enDescriptionSha256:
      "da1658298e8beea266d33095db5db2f6cae98daef00ece3705b7fcc99bde0427",
    workModelNote:
      "The three-part Russian publication is a multipart manifestation of one 1957 Work, not three Works.",
  },
  "rachel-carson-silent-spring": {
    suggestedRecordKey: "usa:rachel_carson:silent-spring",
    writerId: "rachel_carson",
    creditNames: { ru: "Рейчел Карсон", en: "Rachel Carson" },
    enDescription:
      "Marine biologist Rachel Carson’s 1962 book explained the harm caused by pesticides, especially DDT, to natural systems and human beings. The Library of Congress links its broad public impact to the growth of the environmental movement and the subsequent tightening of controls on hazardous chemicals.",
    ruDescriptionSha256:
      "255f8cc7102a17cadbf8bf998e1ea2d4afbdc68caca641183207abac95b39338",
    enDescriptionSha256:
      "275a718ccbeb5e0ecc9995952cf94aa6aff372b638e3582420a9912fff62137c",
    workModelNote:
      "The 1962 Work identity is separate from later revised, commemorative, translated, and illustrated manifestations.",
  },
  "truman-capote-in-cold-blood": {
    suggestedRecordKey: "usa:truman_capote:in-cold-blood",
    writerId: "truman_capote",
    creditNames: { ru: "Трумен Капоте", en: "Truman Capote" },
    enDescription:
      "Truman Capote’s nonfiction novel grew out of his research into the murder of the Clutter family in Kansas, which he conducted with Harper Lee. Published in 1966, the book combines a verifiable factual basis with techniques of literary narrative and became one of the key examples of the nonfiction novel.",
    ruDescriptionSha256:
      "1df6e84408ea4005aa6deb79e7246aadbbd8540d156497eb5452c1605cf76f0d",
    enDescriptionSha256:
      "ced71e59c62951495965c87d71c0d11475615dcdbd09968e780b7b76b474618d",
    workModelNote:
      "The full 1966 subtitle belongs to the source manifestation transcription; later shortened market titles remain manifestations or title variants of the same Work.",
  },
  "toni-morrison-beloved": {
    suggestedRecordKey: "usa:tony_morrison:beloved",
    writerId: "tony_morrison",
    creditNames: { ru: "Тони Моррисон", en: "Toni Morrison" },
    enWorkTitle: "Beloved",
    enDescription:
      "Toni Morrison’s novel tells the story of Sethe, a formerly enslaved woman, and of the traumatic memory that continues to shape her family’s life after the American Civil War. The book was published in 1987 and received the Pulitzer Prize for Fiction in 1988.",
    ruDescriptionSha256:
      "8634f193bf0c6934ba518a9f3f8ea60fc14097fbbb129c1945e25d320fd052f5",
    enDescriptionSha256:
      "8ae4d8eaefffcaf2b57ba93237e2433fa1545c2c8f1f580f3341255b2baf6166",
    workModelNote:
      "This is a mapping to the existing Beloved Work. «Beloved: A Novel.» is retained only as the exact title of the displayed 1987 Knopf manifestation; it must not create a second Work.",
  },
};

export type BookCanonLocHeldResearchOverlay = BookCanonResearchOverlay & {
  sourceReviewId: string;
  descriptionResearch: NonNullable<
    BookCanonResearchOverlay["descriptionResearch"]
  >;
  researchVisibility: {
    catalog: "server-editorial-research-only";
    visitorArchive: "excluded";
    publicSearch: "excluded";
  };
  identityResearch: {
    entityKind: "work";
    titleTranscriptionExact: string;
    creatorTranscriptionExact: string;
    workFirstPublishedYear: number;
    registryItemUrl: string;
    currentLocItemUrl: string;
    displayedManifestation: LocDisplayedManifestation & {
      entityKind: "manifestation";
    };
  };
  descriptionDraftHashes: { ru: string; en: string };
  archiveIdentityResult: {
    exactTitleMatchRecordKeys: string[];
    writerMatchKeys: string[];
  };
  mappingAlias?: {
    targetRecordKey: string;
    aliasExact: string;
    aliasEntityKind: "manifestation-title";
    createsWork: false;
  };
};

function invariant(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`book-canon-loc-held-research:${code}`);
}

function copyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertReviewBatch(value: unknown): LocHeldReviewBatch {
  const batch = value as LocHeldReviewBatch;
  invariant(batch?.applicationStatus === "research-only", "application-status");
  invariant(
    batch.sourceId === "loc-books-that-shaped-america-2012",
    "source-id"
  );
  invariant(
    batch.batchFingerprint === expectedBatchFingerprint,
    "batch-fingerprint-not-reviewed"
  );
  invariant(
    Array.isArray(batch.reviews) && batch.reviews.length === 10,
    "review-cardinality"
  );
  invariant(
    batch.summary.reviewCount === 10 &&
      batch.summary.draftAdditionCount === 9 &&
      batch.summary.acceptedMappingCount === 1 &&
      batch.summary.holdCount === 0 &&
      batch.summary.productionActionCount === 0 &&
      batch.summary.canonClaimCount === 0,
    "summary-contract"
  );

  const reviewIds = batch.reviews.map((review) => review.reviewId);
  invariant(
    new Set(reviewIds).size === 10 &&
      Object.keys(candidateConfig).every((reviewId) => reviewIds.includes(reviewId)),
    "review-identity-set"
  );

  for (const review of batch.reviews) {
    invariant(review.locIdentity.entityKind === "work", `${review.reviewId}:kind`);
    invariant(
      review.ruTitle.recommendedExact ===
        review.ruTitle.evidence.catalogTitleExact,
      `${review.reviewId}:ru-title-exact`
    );
    invariant(
      Boolean(expectedReviewFingerprints[review.reviewId]),
      `${review.reviewId}:review-fingerprint`
    );
    if (review.decision.status === "draft-addition") {
      invariant(
        review.archiveReview.exactTitleMatchRecordKeys.length === 0 &&
          review.archiveReview.writerMatchKeys.length === 0,
        `${review.reviewId}:draft-must-remain-absent`
      );
    }
  }

  const beloved = batch.reviews.find(
    (review) => review.reviewId === "toni-morrison-beloved"
  );
  invariant(
    beloved?.decision.status === "accepted-mapping" &&
      beloved.decision.recordKey === "usa:tony_morrison:beloved" &&
      beloved.decision.sourceTitleAliasExact === "Beloved: A Novel.",
    "beloved-mapping"
  );

  const gone = batch.reviews.find(
    (review) => review.reviewId === "margaret-mitchell-gone-with-the-wind"
  );
  invariant(
    gone?.descriptionSourceUrls.includes(
      "https://www.loc.gov/exhibits/books-that-shaped-america/1900-to-1950.html#obj18"
    ),
    "gone-with-the-wind-current-anchor"
  );
  return batch;
}

function authorityId(review: LocHeldReview) {
  const hostname = new URL(review.ruTitle.evidence.url).hostname;
  if (hostname === "search.rsl.ru") return "rsl";
  if (hostname === "rusneb.ru") return "neb";
  if (hostname === "ast.ru") return "ast";
  if (hostname === "azbooka.ru") return "azbooka";
  if (hostname === "eksmo.ru") return "eksmo";
  throw new Error(`book-canon-loc-held-research:${review.reviewId}:ru-authority`);
}

function descriptionProvenance(
  review: LocHeldReview,
  locale: "ru" | "en",
  ruDescriptionSha256: string
): WorkDescriptionProvenanceProfile {
  const base = {
    sourceCountry: "usa",
    sourceUrls: [...review.descriptionSourceUrls],
    transformations: [
      "condensed",
      "deduplicated",
      "spoiler-limited",
      "style-edited",
    ] as WorkDescriptionProvenanceProfile["transformations"],
    rights: {
      textOrigin: "project-original" as const,
      copiedSourceText: false as const,
    },
    author: "Probpera LoC editorial synthesis",
    createdAt: checkedAt,
    reviewedBy: "Probpera LoC held-identity review",
    reviewedAt: checkedAt,
  };
  return locale === "ru"
    ? {
        ...base,
        origin: "official-source-synthesis",
        sourceLanguage: "en",
      }
    : {
        ...base,
        origin: "human-translation",
        sourceLanguage: "ru",
        translatedFromLocale: "ru",
        translatedFromSourceHash: ruDescriptionSha256,
      };
}

function locSource(
  url: string,
  recordId: string,
  fields: WorkSourceProfile["fields"]
): WorkSourceProfile {
  return {
    provider: "Library of Congress",
    authorityId: "loc",
    authorityTier: "A",
    country: "usa",
    market: "US",
    language: "English",
    recordKind: "authoritative-work-page",
    recordId,
    url,
    fields,
    usage: "reference-only",
    retrievedAt: checkedAt,
  };
}

function locSources(
  review: LocHeldReview,
  currentLocItemUrl: string
): WorkSourceProfile[] {
  const primary = locSource(
    currentLocItemUrl,
    review.canonHoldRef.itemId,
    [
      "identity",
      "authorship",
      "title",
      "original-title",
      "publication-year",
      "description",
    ]
  );
  const additionalUrls = [...new Set(review.descriptionSourceUrls)].filter(
    (url) => url !== currentLocItemUrl
  );
  return [
    primary,
    ...additionalUrls.map((url, index) =>
      locSource(
        url,
        `${review.canonHoldRef.itemId}:description-${index + 2}`,
        ["identity", "description"]
      )
    ),
  ];
}

function ruTitleSource(review: LocHeldReview): WorkSourceProfile {
  const evidence = review.ruTitle.evidence;
  return {
    provider: evidence.authority,
    authorityId: authorityId(review),
    authorityTier:
      evidence.recordKind === "national-bibliography" ? "A" : "B",
    market: "RU",
    language: "Russian",
    recordKind:
      evidence.recordKind === "national-bibliography"
        ? "national-bibliography"
        : "publisher-catalog",
    recordId: evidence.recordId,
    url: evidence.url,
    fields: [
      "identity",
      "authorship",
      "title",
      "publication-year",
      "language",
      "market",
    ],
    usage: "reference-only",
    retrievedAt: evidence.checkedAt,
  };
}

function reviewToOverlay(
  batch: LocHeldReviewBatch,
  review: LocHeldReview
): BookCanonLocHeldResearchOverlay {
  const config = candidateConfig[review.reviewId];
  invariant(config, `${review.reviewId}:config`);
  const isMapping = review.decision.status === "accepted-mapping";
  const currentLocItemUrl = config.correctedLocItemUrl || review.locIdentity.itemUrl;
  const enWorkTitle = config.enWorkTitle || review.locIdentity.titleExact;
  const ruEvidence = review.ruTitle.evidence;
  const locEvidenceId = `LOC-BTSA:${review.canonHoldRef.itemId}`;
  const ruEvidenceId = `${authorityId(review).toUpperCase()}:${ruEvidence.recordId}`;
  const descriptionSourceIds = review.descriptionSourceUrls.map(
    (_url, index) => `loc-description:${review.reviewId}:${index + 1}`
  );

  const titleResearch: BookCanonResearchOverlay["titleResearch"] = {
    ru: {
      status: "verified-research",
      selectedValue: review.ruTitle.recommendedExact,
      market: "RU",
      expressionLanguage: "ru",
      selectionRule:
        "Exact published Russian title from the cited national-library or official-publisher manifestation record.",
      evidence: [
        {
          sourceId: `ru-title:${review.reviewId}`,
          manifestationId: ruEvidenceId,
          catalogTitleExact: ruEvidence.catalogTitleExact,
          ...(ruEvidence.publicationYear !== null
            ? { publicationYear: ruEvidence.publicationYear }
            : {}),
          publisher: ruEvidence.publisher,
          ...(ruEvidence.translatorExact
            ? { translator: ruEvidence.translatorExact }
            : {}),
        },
      ],
    },
    en: {
      status: "verified-research",
      selectedValue: enWorkTitle,
      market: "US",
      expressionLanguage: "en",
      selectionRule: isMapping
        ? "Existing runtime Work title retained; the exact LoC manifestation title is stored only as a mapping alias."
        : "Exact title transcribed from the cited Library of Congress Work exhibit and displayed US manifestation.",
      evidence: [
        {
          sourceId: `loc-identity:${review.reviewId}`,
          manifestationId: locEvidenceId,
          catalogTitleExact: review.locIdentity.titleExact,
          publicationYear: review.locIdentity.displayedManifestation.year,
          publisher: review.locIdentity.displayedManifestation.publisher,
        },
      ],
      observedManifestations: [
        {
          sourceId: `loc-identity:${review.reviewId}`,
          manifestationId: locEvidenceId,
          observedTitleExact: review.locIdentity.displayedManifestation.titleExact,
          publicationYear: review.locIdentity.displayedManifestation.year,
          publisher: review.locIdentity.displayedManifestation.publisher,
        },
      ],
    },
  };

  const publicationHoldCodes = isMapping
    ? ["mapping-only-no-runtime-write", "source-title-alias-storage-not-reviewed"]
    : [
        "archive-work-record-missing",
        "active-writer-link-missing",
        "evidence-v2-promotion-not-reviewed",
        "description-editorial-promotion-not-reviewed",
        "rights-safe-artwork-unresolved",
      ];
  const canonHoldCodes = [
    "no-canon-claim",
    "registry-held-adjudication-not-promoted",
  ];

  return {
    candidateId: review.reviewId,
    suggestedRecordKey: config.suggestedRecordKey,
    sourceManifestFingerprint: batch.batchFingerprint,
    reviewFingerprint: expectedReviewFingerprints[review.reviewId],
    researchDisposition: isMapping ? "accepted-mapping" : "draft-addition",
    integrationStatus: "research-hold",
    publicationEffect: "none",
    canonClaim: null,
    registryHoldRef: copyJson(review.canonHoldRef),
    publicationHoldCodes,
    canonHoldCodes,
    nextStep: isMapping
      ? "Store the verified manifestation-title alias only after a dedicated alias review; do not create or replace a Work."
      : "Complete author identity, Evidence V2, editorial-description, and rights-safe artwork review in a separate approved integration.",
    proposedAuthorityIds: [],
    discoveryOnlySourceIds: [],
    titleResearch,
    descriptionResearch: {
      ru: {
        text: review.descriptionDraftRu,
        sha256: config.ruDescriptionSha256,
        origin: "official-source-synthesis",
        sourceLanguage: "en",
        sourceIds: [...descriptionSourceIds],
        rights: { textOrigin: "project-original", copiedSourceText: false },
        sentenceAttestations: [1, 2].map((sentence) => ({
          sentence,
          sourceIds: [...descriptionSourceIds],
        })),
      },
      en: {
        text: config.enDescription,
        sha256: config.enDescriptionSha256,
        origin: "human-translation",
        sourceLanguage: "ru",
        sourceIds: [...descriptionSourceIds],
        translatedFromLocale: "ru",
        translatedFromSourceHash: config.ruDescriptionSha256,
        rights: { textOrigin: "project-original", copiedSourceText: false },
        sentenceAttestations: [1, 2].map((sentence) => ({
          sentence,
          sourceIds: [...descriptionSourceIds],
        })),
      },
    },
    workModelNote: config.workModelNote,
    work: {
      id: config.suggestedRecordKey.split(":")[2],
      title: review.ruTitle.recommendedExact,
      originalTitle: enWorkTitle,
      firstPublished: review.locIdentity.workFirstPublishedYear,
      originalLanguage: "английский",
      description: review.descriptionDraftRu,
      authorship: {
        kind: "single",
        authors: [
          {
            countryId: "usa",
            writerId: config.writerId,
            creditNames: { ...config.creditNames },
            attribution: "credited",
          },
        ],
      },
      translations: {
        ru: {
          locale: "ru",
          title: review.ruTitle.recommendedExact,
          description: review.descriptionDraftRu,
          sourceLanguage: "en",
          status: "draft",
          sourceUrls: [ruEvidence.url, ...review.descriptionSourceUrls],
          method: "editorial-original",
          descriptionProvenance: descriptionProvenance(
            review,
            "ru",
            config.ruDescriptionSha256
          ),
        },
        en: {
          locale: "en",
          title: enWorkTitle,
          description: config.enDescription,
          sourceLanguage: "ru",
          status: "draft",
          sourceUrls: [...review.descriptionSourceUrls],
          method: "human-translation",
          descriptionProvenance: descriptionProvenance(
            review,
            "en",
            config.ruDescriptionSha256
          ),
        },
      },
      sources: [
        ...locSources(review, currentLocItemUrl),
        ruTitleSource(review),
      ],
      sourceUrl: currentLocItemUrl,
      edition: {
        title: review.locIdentity.displayedManifestation.titleExact,
        publisher: review.locIdentity.displayedManifestation.publisher,
        publicationYear: review.locIdentity.displayedManifestation.year,
        language: "English",
        sourceUrl: currentLocItemUrl,
      },
      editorial: { status: "draft" },
    },
    sourceReviewId: review.reviewId,
    researchVisibility: {
      catalog: "server-editorial-research-only",
      visitorArchive: "excluded",
      publicSearch: "excluded",
    },
    identityResearch: {
      entityKind: "work",
      titleTranscriptionExact: review.locIdentity.titleExact,
      creatorTranscriptionExact: review.locIdentity.creatorExact,
      workFirstPublishedYear: review.locIdentity.workFirstPublishedYear,
      registryItemUrl: review.locIdentity.itemUrl,
      currentLocItemUrl,
      displayedManifestation: {
        entityKind: "manifestation",
        ...copyJson(review.locIdentity.displayedManifestation),
      },
    },
    descriptionDraftHashes: {
      ru: config.ruDescriptionSha256,
      en: config.enDescriptionSha256,
    },
    archiveIdentityResult: copyJson(review.archiveReview),
    ...(isMapping && review.decision.status === "accepted-mapping"
      ? {
          mappingAlias: {
            targetRecordKey: review.decision.recordKey,
            aliasExact: review.decision.sourceTitleAliasExact,
            aliasEntityKind: "manifestation-title" as const,
            createsWork: false as const,
          },
        }
      : {}),
  };
}

export function buildBookCanonLocHeldResearchBatch01Overlay(
  input: unknown = heldReviewBatchJson
): BookCanonLocHeldResearchOverlay[] {
  const batch = assertReviewBatch(input);
  return batch.reviews.map((review) => reviewToOverlay(batch, review));
}

export const bookCanonLocHeldResearchBatch01Overlay = Object.freeze(
  buildBookCanonLocHeldResearchBatch01Overlay()
);

export const bookCanonLocHeldResearchBatch01ManifestFingerprint =
  expectedBatchFingerprint;
