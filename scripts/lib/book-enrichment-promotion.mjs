import {
  canonicalWorkSourceField,
  curatedRecordIssues,
} from "./book-enrichment-policy.mjs";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function externalIdProfile(identity, fallbackUrl) {
  const [scheme, ...valueParts] = String(identity || "").split(":");
  const value = valueParts.join(":").trim();
  if (!value) return null;
  if (scheme === "openlibrary" && /^OL\d+W$/u.test(value)) {
    return {
      scheme: "openlibrary",
      value,
      sourceUrl: `https://openlibrary.org/works/${value}`,
    };
  }
  if (scheme === "wikidata" && /^Q\d+$/u.test(value)) {
    return {
      scheme: "wikidata",
      value,
      sourceUrl: `https://www.wikidata.org/wiki/${value}`,
    };
  }
  if (!/^https:\/\//iu.test(String(fallbackUrl || ""))) return null;
  return {
    scheme: "other",
    value: String(identity),
    sourceUrl: fallbackUrl,
  };
}

export function buildReviewedWork({ sourceRecord, curatedRecord }) {
  const canonical = curatedRecord.canonical;
  const sourceUrls = unique(
    (curatedRecord.sources || []).map((source) => source.url)
  );
  const reviewedAt = [
    curatedRecord.annotationRu?.reviewedAt,
    curatedRecord.annotationEn?.reviewedAt,
  ]
    .filter(Boolean)
    .sort()
    .at(-1);
  const identities = unique([
    ...(sourceRecord.externalIdentities || []),
    ...(curatedRecord.externalIdentities || []),
  ]);
  const externalIds = identities
    .map((identity) => externalIdProfile(identity, sourceUrls[0]))
    .filter(Boolean);

  return {
    id: sourceRecord.sourceId || sourceRecord.id,
    title: canonical.titleRu,
    alternateTitles: unique([
      sourceRecord.title,
      canonical.titleEn,
      canonical.originalTitle,
    ]).filter((title) => title !== canonical.titleRu),
    originalTitle: canonical.originalTitle,
    firstPublished: canonical.firstPublished,
    originalLanguage: canonical.originalLanguage,
    genres: canonical.genres,
    tags: ["редакционно проверено", "двуязычная карточка"],
    description: curatedRecord.annotationRu.text,
    translations: {
      ru: {
        locale: "ru",
        title: canonical.titleRu,
        description: curatedRecord.annotationRu.text,
        sourceLanguage: "ru",
        status: "reviewed",
        sourceUrls,
        method: "editorial-original",
        reviewedAt: curatedRecord.annotationRu.reviewedAt,
      },
      en: {
        locale: "en",
        title: canonical.titleEn,
        description: curatedRecord.annotationEn.text,
        sourceLanguage: "en",
        status: "reviewed",
        sourceUrls,
        method: "editorial-original",
        reviewedAt: curatedRecord.annotationEn.reviewedAt,
      },
    },
    sources: (curatedRecord.sources || []).map((source) => ({
      provider: source.provider,
      url: source.url,
      fields: unique(
        (source.fields || [])
          .map(canonicalWorkSourceField)
          .filter(Boolean)
      ),
      license: source.license || undefined,
      usage: source.usage,
      retrievedAt: source.retrievedAt,
    })),
    externalIds,
    sourceUrl: sourceUrls[0],
    editorial: {
      status: "reviewed",
      reviewedAt,
    },
  };
}

export function reviewedPayload({ manifest, readyRecords }) {
  const works = {};
  for (const { sourceRecord, curatedRecord } of readyRecords) {
    if (curatedRecordIssues(curatedRecord).length > 0) continue;
    const writerKey = `${sourceRecord.countryId}:${sourceRecord.writerId}`;
    if (!works[writerKey]) works[writerKey] = [];
    works[writerKey].push(buildReviewedWork({ sourceRecord, curatedRecord }));
  }
  for (const records of Object.values(works)) {
    records.sort((left, right) => left.id.localeCompare(right.id, "en"));
  }
  return {
    generatedAt: manifest.generatedAt,
    sourceManifestFingerprint: manifest.datasetFingerprint,
    source:
      "Validated book-enrichment-curated-batch files; raw imports remain unchanged",
    works: Object.fromEntries(
      Object.entries(works).sort(([left], [right]) =>
        left.localeCompare(right, "en")
      )
    ),
  };
}
