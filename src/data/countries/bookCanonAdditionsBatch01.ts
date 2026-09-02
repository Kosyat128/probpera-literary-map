import batchManifestJson from "../../../data/book-canon-additions-batch01.json";

import type {
  WorkDescriptionProvenanceProfile,
  WorkProfile,
  WorkSourceProfile,
} from "./types";

const checkedAt = "2026-09-02";
const expectedManifestFingerprint =
  "c3b4fb2d1628799832b6bc81c498c2bfa389a5f70100455f37ae5fc5adbd8ea4";
const expectedCandidateFingerprints: Record<string, string> = {
  "twelve-chairs-coauthored-work":
    "315ce98760588cfb912b6bd6f4a918658a214f5183da0234a7e5c5a78988c94a",
  "moscow-and-muscovites-work":
    "b01dc024eeef942557bb5c5a21807bdde001bc4e346e070819b2993e19d7e1c7",
  "year-of-the-lord-work":
    "2421895331fea20b902a238b211225bfe57abb65c114094a9131428d09aea0b2",
};
const russianOfficialDescriptionAuthorities = new Set([
  "neb",
  "rsl",
  "ast",
  "azbooka",
]);

type BatchEvidenceClass =
  | "current-registry"
  | "proposed-authority"
  | "discovery-only";

type BatchSource = {
  sourceId: string;
  provider: string;
  authorityId: string | null;
  evidenceClass: BatchEvidenceClass;
  authorityTier: "A" | "B" | null;
  sourceKind: string;
  url: string;
  recordId: string;
  retrievedAt: string;
};

export type BookCanonResearchTitleEvidence = {
  sourceId: string;
  manifestationId: string;
  catalogTitleExact?: string;
  observedTitleExact?: string;
  publicationYear?: number;
  publisher?: string;
  translator?: string;
  isbn13?: string;
  evidenceUse?: "discovery-only";
  [key: string]: unknown;
};

export type BookCanonResearchTitleProfile = {
  status: "verified-research" | "withheld";
  selectedValue: string | null;
  market: "RU" | "US";
  expressionLanguage: "ru" | "en";
  selectionRule: string | null;
  reason?: string;
  evidence?: BookCanonResearchTitleEvidence[];
  observedManifestations?: BookCanonResearchTitleEvidence[];
  [key: string]: unknown;
};

export type BookCanonResearchDescriptionProfile = {
  text: string;
  sha256: string;
  origin: "official-source-synthesis" | "human-translation";
  sourceLanguage: string;
  sourceIds: string[];
  translatedFromLocale?: "ru";
  translatedFromSourceHash?: string;
  rights: {
    textOrigin: "project-original";
    copiedSourceText: false;
  };
  sentenceAttestations?: Array<{
    sentence: number;
    sourceIds: string[];
  }>;
};

type BatchCandidate = {
  candidateId: string;
  suggestedRecordKey: string;
  registryHoldRef: {
    sourceId: string;
    ordinal: number;
    itemId: string;
    itemHash: string;
  };
  work: {
    entityKind: "work";
    originalTitle: string;
    originalLanguage: "ru";
    firstPublished: number | null;
    genre: string;
    publicationModel: string;
  };
  authorship: {
    kind: "single" | "multiple";
    authors: Array<{
      position: number;
      countryId: string;
      writerId: string;
      creditNames: { ru: string; en: string };
      linkStatus: "missing-active-writer";
    }>;
    sourceIds: string[];
  };
  localizedTitles: {
    ru: BookCanonResearchTitleProfile;
    en: BookCanonResearchTitleProfile;
  };
  descriptions: {
    ru: BookCanonResearchDescriptionProfile;
    en: BookCanonResearchDescriptionProfile;
  };
  publicationAssessment: {
    status: "hold";
    holdCodes: string[];
    nextStep: string;
  };
  canonAssessment: {
    status: "hold-no-claim";
    holdCodes: string[];
  };
  reviewFingerprint: string;
};

type BatchManifest = {
  applicationStatus: "isolated-research-hold";
  publicationEffect: "none";
  manifestFingerprint: string;
  sources: BatchSource[];
  candidates: BatchCandidate[];
};

export type BookCanonAdditionResearchOverlay = {
  candidateId: string;
  suggestedRecordKey: string;
  sourceManifestFingerprint: string;
  reviewFingerprint: string;
  researchDisposition: "draft-addition" | "accepted-mapping";
  integrationStatus: "research-hold";
  publicationEffect: "none";
  canonClaim: null;
  registryHoldRef: BatchCandidate["registryHoldRef"];
  publicationHoldCodes: string[];
  canonHoldCodes: string[];
  nextStep: string;
  proposedAuthorityIds: string[];
  discoveryOnlySourceIds: string[];
  titleResearch: {
    ru: BookCanonResearchTitleProfile;
    en: BookCanonResearchTitleProfile;
  };
  descriptionResearch?: {
    ru: BookCanonResearchDescriptionProfile;
    en: BookCanonResearchDescriptionProfile;
  };
  workModelNote: string;
  work: WorkProfile;
};

function invariant(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`book-canon-additions-batch01:${code}`);
}

function copyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function assertResearchManifest(value: unknown): BatchManifest {
  const manifest = value as BatchManifest;
  invariant(
    manifest?.applicationStatus === "isolated-research-hold",
    "application-status-must-remain-research-hold"
  );
  invariant(
    manifest.publicationEffect === "none",
    "publication-effect-must-remain-none"
  );
  invariant(
    manifest.manifestFingerprint === expectedManifestFingerprint,
    "manifest-fingerprint-not-reviewed"
  );
  invariant(Array.isArray(manifest.sources), "sources-missing");
  invariant(
    Array.isArray(manifest.candidates) && manifest.candidates.length === 3,
    "candidate-cardinality"
  );

  const sourceIds = new Set(manifest.sources.map((source) => source.sourceId));
  const sourceById = new Map(
    manifest.sources.map((source) => [source.sourceId, source])
  );
  const candidateIds = new Set(manifest.candidates.map((item) => item.candidateId));
  invariant(
    candidateIds.size === 3 &&
      Object.keys(expectedCandidateFingerprints).every((id) => candidateIds.has(id)),
    "candidate-identity-set"
  );

  for (const candidate of manifest.candidates) {
    invariant(candidate.work?.entityKind === "work", "entity-kind");
    invariant(candidate.work.originalLanguage === "ru", "original-language");
    invariant(
      candidate.publicationAssessment?.status === "hold",
      `${candidate.candidateId}:publication-status`
    );
    invariant(
      candidate.canonAssessment?.status === "hold-no-claim",
      `${candidate.candidateId}:canon-status`
    );
    invariant(
      candidate.reviewFingerprint ===
        expectedCandidateFingerprints[candidate.candidateId],
      `${candidate.candidateId}:review-fingerprint`
    );
    invariant(
      candidate.localizedTitles?.ru?.status === "verified-research" &&
        typeof candidate.localizedTitles.ru.selectedValue === "string",
      `${candidate.candidateId}:ru-title-research-status`
    );
    invariant(
      candidate.authorship?.kind === "single" ||
        candidate.authorship?.kind === "multiple",
      `${candidate.candidateId}:authorship-kind`
    );
    invariant(
      candidate.authorship.kind !== "single" ||
        candidate.authorship.authors.length === 1,
      `${candidate.candidateId}:single-authorship-cardinality`
    );
    invariant(
      candidate.authorship.kind !== "multiple" ||
        candidate.authorship.authors.length >= 2,
      `${candidate.candidateId}:multiple-authorship-cardinality`
    );

    const referencedSourceIds = [
      ...candidate.authorship.sourceIds,
      ...candidate.descriptions.ru.sourceIds,
      ...candidate.descriptions.en.sourceIds,
      ...(candidate.localizedTitles.ru.evidence || []).map((item) => item.sourceId),
      ...(candidate.localizedTitles.en.evidence || []).map((item) => item.sourceId),
      ...(candidate.localizedTitles.en.observedManifestations || []).map(
        (item) => item.sourceId
      ),
    ];
    invariant(
      referencedSourceIds.every((sourceId) => sourceIds.has(sourceId)),
      `${candidate.candidateId}:unknown-source`
    );
    invariant(
      JSON.stringify(candidate.descriptions.en.sourceIds) ===
        JSON.stringify(candidate.descriptions.ru.sourceIds),
      `${candidate.candidateId}:description-source-provenance-mismatch`
    );
    invariant(
      candidate.descriptions.ru.sourceIds.every((sourceId) => {
        const source = sourceById.get(sourceId);
        return (
          source?.evidenceClass === "current-registry" &&
          source.authorityId !== null &&
          russianOfficialDescriptionAuthorities.has(source.authorityId)
        );
      }),
      `${candidate.candidateId}:ru-description-source-authority`
    );
    invariant(
      candidate.descriptions.ru.sentenceAttestations?.length === 2 &&
        candidate.descriptions.ru.sentenceAttestations.every(
          (attestation, index) =>
            attestation.sentence === index + 1 &&
            attestation.sourceIds.length > 0 &&
            attestation.sourceIds.every((sourceId) =>
              candidate.descriptions.ru.sourceIds.includes(sourceId)
            )
        ),
      `${candidate.candidateId}:ru-description-sentence-attestations`
    );
  }

  const twelveChairs = manifest.candidates.find(
    (candidate) => candidate.candidateId === "twelve-chairs-coauthored-work"
  );
  invariant(
    twelveChairs?.authorship.kind === "multiple" &&
      twelveChairs.authorship.authors.map((author) => author.writerId).join("|") ===
        "ilya-ilf|yevgeny-petrov",
    "twelve-chairs-coauthorship"
  );

  const yearOfTheLord = manifest.candidates.find(
    (candidate) => candidate.candidateId === "year-of-the-lord-work"
  );
  invariant(
    yearOfTheLord?.localizedTitles.en.status === "withheld" &&
      yearOfTheLord.localizedTitles.en.selectedValue === null &&
      yearOfTheLord.localizedTitles.en.selectionRule === null,
    "year-of-the-lord-en-title-must-remain-withheld"
  );
  invariant(
    yearOfTheLord.work.firstPublished === null,
    "year-of-the-lord-first-published-must-remain-withheld"
  );
  return manifest;
}

function recordKind(
  sourceKind: string
): NonNullable<WorkSourceProfile["recordKind"]> {
  if (sourceKind === "official-publisher-record") return "publisher-catalog";
  if (sourceKind === "national-library-bibliographic-record") {
    return "national-bibliography";
  }
  if (
    sourceKind === "national-library-work-page" ||
    sourceKind === "national-library-digital-record"
  ) {
    return "authoritative-work-page";
  }
  return "structured-dataset";
}

type WorkSourceField = WorkSourceProfile["fields"][number];

function workSources(
  candidate: BatchCandidate,
  sourceById: Map<string, BatchSource>
): WorkSourceProfile[] {
  const fieldsBySource = new Map<string, Set<WorkSourceField>>();
  const add = (sourceId: string, fields: WorkSourceField[]) => {
    const current = fieldsBySource.get(sourceId) || new Set<WorkSourceField>();
    fields.forEach((field) => current.add(field));
    fieldsBySource.set(sourceId, current);
  };

  candidate.authorship.sourceIds.forEach((sourceId) =>
    add(sourceId, ["identity", "authorship"])
  );
  for (const locale of ["ru", "en"] as const) {
    (candidate.localizedTitles[locale].evidence || []).forEach((evidence) =>
      add(evidence.sourceId, [
        "identity",
        "title",
        "publication-year",
        "language",
        "market",
      ])
    );
  }
  candidate.descriptions.ru.sourceIds.forEach((sourceId) =>
    add(sourceId, ["identity", "description"])
  );
  candidate.descriptions.en.sourceIds.forEach((sourceId) =>
    add(sourceId, ["identity", "description"])
  );

  return [...fieldsBySource.entries()].flatMap(([sourceId, fields]) => {
    const source = sourceById.get(sourceId);
    invariant(source, `${candidate.candidateId}:source-${sourceId}-missing`);
    if (source.evidenceClass === "discovery-only") return [];
    return [
      {
        provider: source.provider,
        ...(source.authorityId ? { authorityId: source.authorityId } : {}),
        ...(source.authorityTier ? { authorityTier: source.authorityTier } : {}),
        recordKind: recordKind(source.sourceKind),
        recordId: source.recordId,
        url: source.url,
        fields: [...fields],
        usage: "reference-only" as const,
        retrievedAt: source.retrievedAt,
      },
    ];
  });
}

function descriptionProvenance(
  locale: "ru" | "en",
  description: BookCanonResearchDescriptionProfile,
  sourceById: Map<string, BatchSource>,
  ruHash: string
): WorkDescriptionProvenanceProfile {
  const sourceUrls = description.sourceIds.map((sourceId) => {
    const source = sourceById.get(sourceId);
    invariant(source, `description-source-${sourceId}-missing`);
    return source.url;
  });
  const base = {
    sourceLanguage: description.sourceLanguage,
    sourceCountry: "russia",
    sourceUrls,
    transformations: [
      "condensed",
      "deduplicated",
      "spoiler-limited",
      "style-edited",
    ] as WorkDescriptionProvenanceProfile["transformations"],
    rights: { textOrigin: "project-original" as const, copiedSourceText: false as const },
    author: "Probpera Evidence V2 editorial synthesis",
    createdAt: checkedAt,
    reviewedBy: "Probpera research hold review",
    reviewedAt: checkedAt,
  };
  return locale === "ru"
    ? { ...base, origin: "official-source-synthesis" }
    : {
        ...base,
        origin: "human-translation",
        translatedFromLocale: "ru",
        translatedFromSourceHash: ruHash,
      };
}

function sourceUrls(
  sourceIds: string[],
  sourceById: Map<string, BatchSource>
) {
  return unique(
    sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      invariant(source, `translation-source-${sourceId}-missing`);
      return source.url;
    })
  );
}

function candidateToOverlay(
  manifest: BatchManifest,
  candidate: BatchCandidate,
  sourceById: Map<string, BatchSource>
): BookCanonAdditionResearchOverlay {
  const [, , localId] = candidate.suggestedRecordKey.split(":");
  invariant(Boolean(localId), `${candidate.candidateId}:suggested-record-key`);

  const ruTitleSourceIds = (candidate.localizedTitles.ru.evidence || []).map(
    (item) => item.sourceId
  );
  const enTitleSourceIds = (candidate.localizedTitles.en.evidence || []).map(
    (item) => item.sourceId
  );
  const ruSourceIds = unique([
    ...ruTitleSourceIds,
    ...candidate.descriptions.ru.sourceIds,
  ]);
  const enSourceIds = unique([
    ...enTitleSourceIds,
    ...candidate.descriptions.en.sourceIds,
  ]);
  const allReferencedSourceIds = unique([
    ...candidate.authorship.sourceIds,
    ...ruSourceIds,
    ...enSourceIds,
    ...(candidate.localizedTitles.en.observedManifestations || []).map(
      (item) => item.sourceId
    ),
  ]);
  const referencedSources = allReferencedSourceIds.map((sourceId) => {
    const source = sourceById.get(sourceId);
    invariant(source, `${candidate.candidateId}:source-${sourceId}-missing`);
    return source;
  });

  const ruTitle = candidate.localizedTitles.ru.selectedValue;
  invariant(typeof ruTitle === "string", `${candidate.candidateId}:ru-title`);
  const enTitle = candidate.localizedTitles.en.selectedValue;
  const translations: WorkProfile["translations"] = {
    ru: {
      locale: "ru",
      title: ruTitle,
      description: candidate.descriptions.ru.text,
      sourceLanguage: candidate.descriptions.ru.sourceLanguage,
      status: "draft",
      sourceUrls: sourceUrls(ruSourceIds, sourceById),
      method: "editorial-original",
      descriptionProvenance: descriptionProvenance(
        "ru",
        candidate.descriptions.ru,
        sourceById,
        candidate.descriptions.ru.sha256
      ),
    },
    ...(typeof enTitle === "string"
      ? {
          en: {
            locale: "en" as const,
            title: enTitle,
            description: candidate.descriptions.en.text,
            sourceLanguage: candidate.descriptions.en.sourceLanguage,
            status: "draft" as const,
            sourceUrls: sourceUrls(enSourceIds, sourceById),
            method: "human-translation" as const,
            descriptionProvenance: descriptionProvenance(
              "en",
              candidate.descriptions.en,
              sourceById,
              candidate.descriptions.ru.sha256
            ),
          },
        }
      : {}),
  };

  const primarySource = sourceById.get(candidate.authorship.sourceIds[0] || "");
  invariant(primarySource, `${candidate.candidateId}:primary-source`);

  const work: WorkProfile = {
    id: localId,
    title: ruTitle,
    originalTitle: candidate.work.originalTitle,
    ...(candidate.work.firstPublished !== null
      ? { firstPublished: candidate.work.firstPublished }
      : {}),
    originalLanguage: "русский",
    genres: [candidate.work.genre],
    description: candidate.descriptions.ru.text,
    authorship: {
      kind: candidate.authorship.kind,
      authors: candidate.authorship.authors.map((author) => ({
        countryId: author.countryId,
        writerId: author.writerId,
        creditNames: { ...author.creditNames },
        attribution: "credited",
      })),
    },
    translations,
    sources: workSources(candidate, sourceById),
    sourceUrl: primarySource.url,
    editorial: { status: "draft" },
  };

  return {
    candidateId: candidate.candidateId,
    suggestedRecordKey: candidate.suggestedRecordKey,
    sourceManifestFingerprint: manifest.manifestFingerprint,
    reviewFingerprint: candidate.reviewFingerprint,
    researchDisposition: "draft-addition",
    integrationStatus: "research-hold",
    publicationEffect: "none",
    canonClaim: null,
    registryHoldRef: copyJson(candidate.registryHoldRef),
    publicationHoldCodes: [...candidate.publicationAssessment.holdCodes],
    canonHoldCodes: [...candidate.canonAssessment.holdCodes],
    nextStep: candidate.publicationAssessment.nextStep,
    proposedAuthorityIds: unique(
      referencedSources
        .filter((source) => source.evidenceClass === "proposed-authority")
        .flatMap((source) => (source.authorityId ? [source.authorityId] : []))
    ),
    discoveryOnlySourceIds: unique(
      referencedSources
        .filter((source) => source.evidenceClass === "discovery-only")
        .map((source) => source.sourceId)
    ),
    titleResearch: copyJson(candidate.localizedTitles),
    descriptionResearch: copyJson(candidate.descriptions),
    workModelNote: candidate.work.publicationModel,
    work,
  };
}

export function buildBookCanonAdditionsBatch01Overlay(
  input: unknown = batchManifestJson
): BookCanonAdditionResearchOverlay[] {
  const manifest = assertResearchManifest(input);
  const sourceById = new Map(
    manifest.sources.map((source) => [source.sourceId, source])
  );
  return manifest.candidates.map((candidate) =>
    candidateToOverlay(manifest, candidate, sourceById)
  );
}

export const bookCanonAdditionsBatch01Overlay = Object.freeze(
  buildBookCanonAdditionsBatch01Overlay()
);

export const bookCanonAdditionsBatch01ManifestFingerprint =
  expectedManifestFingerprint;
