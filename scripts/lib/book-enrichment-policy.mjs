const SENTENCE_END = /[.!?…]+(?=\s|$)/gu;

const GENERIC_ANNOTATION_PATTERNS = [
  /\b(?:annotation|summary|description)\s+(?:needed|pending|todo)\b/iu,
  /(?:карточка|описание).{0,40}(?:готовится|ожидает|требует|нужно)/iu,
  /произведение представлено в редакционной книжной подборке/iu,
  /карточка связана с исходной статьёй/iu,
];

const HIGH_CONFIDENCE_REJECT_RULES = [
  [
    "study-material",
    /\b(?:study guide|workbook|teacher(?:'s|s)? guide|lesson plans?|sparknotes|cliffsnotes|reader's companion)\b/iu,
  ],
  [
    "textbook-or-course-anthology",
    /\b(?:prentice hall literature|norton anthology|harbrace anthology|riverside anthology of literature|literature textbook|school reader|mercury reader)\b/iu,
  ],
  [
    "edition-not-work",
    /\b(?:large print|abridged|unabridged|anniversary edition|critical edition|student edition|with connections)\b/iu,
  ],
  [
    "translation-or-editor-credit-in-title",
    /\b(?:translated|edited|introduced|illustrated)\s+by\b/iu,
  ],
  ["publisher-pack", /\b(?:counterpack)\b/iu],
];

const RESEARCH_TITLE_RULES = [
  ["adaptation-or-derivative", /\b(?:adaptation|adapted|screenplay|graphic novel)\b|адаптац/iu],
  ["collection-or-omnibus", /\b(?:omnibus|box set|collected works|complete works|selected works|complete novels|collected novels)\b/iu],
  ["anthology-needs-authorship-check", /\bantholog(?:y|ies)\b/iu],
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SOURCE_USAGES = new Set([
  "structured-data",
  "reference-only",
  "licensed-copy",
]);
const CANONICAL_WORK_SOURCE_FIELDS = new Set([
  "identity",
  "authorship",
  "title",
  "original-title",
  "publication-year",
  "language",
  "genre",
  "description",
  "award-criterion",
  "bestseller-evidence",
  "market",
  "period",
  "measurement",
]);
const WORK_SOURCE_FIELD_ALIASES = new Map([
  ["alias", "identity"],
  ["source-record", "identity"],
  ["authorship-context", "authorship"],
  ["context", "description"],
  ["first-edition", "publication-year"],
  ["original-language", "language"],
  ["publication-history", "publication-year"],
  ["work-form", "genre"],
]);

export function canonicalWorkSourceField(value = "") {
  const field = String(value).trim().toLocaleLowerCase("en");
  const canonical = WORK_SOURCE_FIELD_ALIASES.get(field) || field;
  return CANONICAL_WORK_SOURCE_FIELDS.has(canonical) ? canonical : null;
}

function normalizedPerson(value = "") {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase("ru");
}

function isIsoCalendarDate(value = "") {
  const text = String(value);
  if (!ISO_DATE.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === text
  );
}

export function sourceAuthorityFamily(source = {}) {
  const declaredAuthority = String(source.authorityId || "")
    .trim()
    .toLocaleLowerCase("en");
  if (declaredAuthority) return declaredAuthority;

  try {
    const hostname = new URL(source.url).hostname.replace(/^www\./u, "");
    if (
      /(?:wikidata\.org|wikipedia\.org|wikimedia\.org)$/iu.test(hostname)
    ) {
      return "wikimedia";
    }
    if (/(?:google\.[a-z.]+|googleusercontent\.com)$/iu.test(hostname)) {
      return "google";
    }
    if (/(?:openlibrary\.org|archive\.org)$/iu.test(hostname)) {
      return "internet-archive";
    }
    if (/(?:bnf\.fr)$/iu.test(hostname)) return "bnf";
    if (/(?:rsl\.ru)$/iu.test(hostname)) return "rsl";
    if (/(?:nlr\.ru)$/iu.test(hostname)) return "nlr";
    if (/(?:rusneb\.ru)$/iu.test(hostname)) return "neb";
    if (/(?:loc\.gov)$/iu.test(hostname)) return "loc";
    if (/(?:bl\.uk)$/iu.test(hostname)) return "british-library";
    if (/(?:chekhovmuseum\.com)$/iu.test(hostname)) {
      return "chekhov-museum";
    }
    return hostname;
  } catch {
    return String(source.authority || "").trim().toLocaleLowerCase("en");
  }
}

function externalIdentityFromSourceUrl(url = "") {
  const text = String(url);
  const openLibraryId = text.toLocaleUpperCase("en").match(/OL\d+W/u)?.[0];
  if (openLibraryId && /openlibrary\.org/iu.test(text)) {
    return `openlibrary:${openLibraryId}`;
  }
  const wikidataId = text.toLocaleUpperCase("en").match(/Q\d+/u)?.[0];
  if (wikidataId && /wikidata\.org/iu.test(text)) {
    return `wikidata:${wikidataId}`;
  }
  return "";
}

export function normalizeBookIdentity(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Matches the title key currently used by buildBookArchive. */
export function archiveBookTitleKey(value = "") {
  return String(value)
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[«»"'.,:;!?()[\]{}]/gu, "");
}

export function extractOpenLibraryId(record = {}) {
  const text = `${record.id || ""} ${record.sourceUrl || ""}`.toLocaleUpperCase(
    "en"
  );
  return text.match(/OL\d+[AWM]/u)?.[0] || "";
}

export function automaticRejectReasons(record = {}) {
  const reasons = [];
  const title = String(record.title || "").trim();

  if (!title || /^(?:untitled|unknown|n\/?a|без названия)$/iu.test(title)) {
    reasons.push("missing-or-placeholder-title");
  }
  for (const [reason, pattern] of HIGH_CONFIDENCE_REJECT_RULES) {
    if (pattern.test(title)) reasons.push(reason);
  }
  return [...new Set(reasons)];
}

export function automaticResearchReasons(record = {}) {
  const title = String(record.title || "");
  const reasons = [];
  for (const [reason, pattern] of RESEARCH_TITLE_RULES) {
    if (pattern.test(title)) reasons.push(reason);
  }
  const openLibraryId = extractOpenLibraryId(record);
  const looksLikeOpenLibraryRecord =
    String(record.id || "").startsWith("openlibrary-") ||
    /openlibrary\.org/iu.test(String(record.sourceUrl || ""));
  if (looksLikeOpenLibraryRecord && !/^OL\d+W$/u.test(openLibraryId)) {
    reasons.push("invalid-openlibrary-work-id-needs-canonical-resolution");
  }
  if (!record.firstPublished) reasons.push("publication-year-unverified");
  if (!record.originalLanguage) reasons.push("original-language-unverified");
  if (!record.genres?.length) reasons.push("genre-unverified");
  return [...new Set(reasons)];
}

export function countAnnotationSentences(value = "") {
  const text = String(value).replace(/\s+/gu, " ").trim();
  if (!text) return 0;
  return text.match(SENTENCE_END)?.length || 0;
}

export function russianAnnotationIssues(annotation = {}) {
  const text = String(annotation?.text || "").replace(/\s+/gu, " ").trim();
  const issues = [];
  const sentences = countAnnotationSentences(text);

  if (!text) return ["missing-russian-annotation"];
  if (sentences < 2 || sentences > 3) {
    issues.push("russian-annotation-must-have-2-or-3-sentences");
  }
  if (text.length < 140 || text.length > 900) {
    issues.push("russian-annotation-must-have-140-to-900-characters");
  }
  if (!/[А-Яа-яЁё]/u.test(text)) {
    issues.push("russian-annotation-must-contain-cyrillic");
  }
  if (/<[a-z][^>]*>/iu.test(text)) {
    issues.push("russian-annotation-must-be-plain-text");
  }
  if (GENERIC_ANNOTATION_PATTERNS.some((pattern) => pattern.test(text))) {
    issues.push("generic-or-placeholder-annotation");
  }
  if (annotation?.method !== "editorial-original") {
    issues.push("annotation-method-must-be-editorial-original");
  }
  if (!String(annotation?.author || "").trim()) {
    issues.push("annotation-author-required");
  }
  if (!String(annotation?.createdAt || "").trim()) {
    issues.push("annotation-created-at-required");
  } else if (!isIsoCalendarDate(annotation.createdAt)) {
    issues.push("annotation-created-at-must-be-iso-date");
  }
  if (!String(annotation?.reviewedBy || "").trim()) {
    issues.push("annotation-reviewer-required");
  }
  if (!String(annotation?.reviewedAt || "").trim()) {
    issues.push("annotation-reviewed-at-required");
  } else if (!isIsoCalendarDate(annotation.reviewedAt)) {
    issues.push("annotation-reviewed-at-must-be-iso-date");
  }
  if (
    annotation?.author &&
    annotation?.reviewedBy &&
    normalizedPerson(annotation.author) === normalizedPerson(annotation.reviewedBy)
  ) {
    issues.push("annotation-reviewer-must-differ-from-author");
  }
  return issues;
}

export function englishAnnotationIssues(annotation = {}) {
  const text = String(annotation?.text || "").replace(/\s+/gu, " ").trim();
  const issues = [];
  const sentences = countAnnotationSentences(text);

  if (!text) return ["missing-english-annotation"];
  if (sentences < 2 || sentences > 3) {
    issues.push("english-annotation-must-have-2-or-3-sentences");
  }
  if (text.length < 140 || text.length > 900) {
    issues.push("english-annotation-must-have-140-to-900-characters");
  }
  if (!/[A-Za-z]/u.test(text)) {
    issues.push("english-annotation-must-contain-latin-letters");
  }
  if (/\p{Script=Cyrillic}/u.test(text)) {
    issues.push("english-annotation-must-not-contain-cyrillic");
  }
  if (/<[a-z][^>]*>/iu.test(text)) {
    issues.push("english-annotation-must-be-plain-text");
  }
  if (GENERIC_ANNOTATION_PATTERNS.some((pattern) => pattern.test(text))) {
    issues.push("generic-or-placeholder-english-annotation");
  }
  if (annotation?.method !== "editorial-original") {
    issues.push("english-annotation-method-must-be-editorial-original");
  }
  if (!String(annotation?.author || "").trim()) {
    issues.push("english-annotation-author-required");
  }
  if (!String(annotation?.createdAt || "").trim()) {
    issues.push("english-annotation-created-at-required");
  } else if (!isIsoCalendarDate(annotation.createdAt)) {
    issues.push("english-annotation-created-at-must-be-iso-date");
  }
  if (!String(annotation?.reviewedBy || "").trim()) {
    issues.push("english-annotation-reviewer-required");
  }
  if (!String(annotation?.reviewedAt || "").trim()) {
    issues.push("english-annotation-reviewed-at-required");
  } else if (!isIsoCalendarDate(annotation.reviewedAt)) {
    issues.push("english-annotation-reviewed-at-must-be-iso-date");
  }
  if (
    annotation?.author &&
    annotation?.reviewedBy &&
    normalizedPerson(annotation.author) === normalizedPerson(annotation.reviewedBy)
  ) {
    issues.push("english-annotation-reviewer-must-differ-from-author");
  }
  return issues;
}

export function sourceLegalIssues(source = {}) {
  const issues = [];
  const url = String(source.url || "");
  if (!/^https:\/\//iu.test(url)) issues.push("source-must-use-https");
  if (!String(source.provider || "").trim()) issues.push("source-provider-required");
  if (!Array.isArray(source.fields) || source.fields.length === 0) {
    issues.push("source-fields-required");
  } else {
    for (const field of source.fields) {
      if (!canonicalWorkSourceField(field)) {
        issues.push(`source-field-unsupported:${String(field)}`);
      }
    }
  }
  if (!SOURCE_USAGES.has(source.usage)) {
    issues.push("source-usage-invalid");
  }
  if (source.usage === "licensed-copy" && !String(source.license || "").trim()) {
    issues.push("licensed-copy-license-required");
  }
  if (
    source.usage !== "licensed-copy" &&
    source.textReuse !== "none"
  ) {
    issues.push("reference-source-text-reuse-must-be-none");
  }
  if (!String(source.retrievedAt || "").trim()) {
    issues.push("source-retrieved-at-required");
  } else if (!isIsoCalendarDate(source.retrievedAt)) {
    issues.push("source-retrieved-at-must-be-iso-date");
  }

  const isWikipedia = /(?:wikipedia\.org|wikimedia\.org)/iu.test(url);
  if (isWikipedia) {
    for (const field of [
      "license",
      "pageTitle",
      "revisionId",
      "revisionUrl",
      "attribution",
      "authorsUrl",
    ]) {
      if (!String(source[field] || "").trim()) {
        issues.push(`wikipedia-${field}-required`);
      }
    }
    if (!/CC BY-SA/iu.test(String(source.license || ""))) {
      issues.push("wikipedia-compatible-cc-by-sa-license-required");
    }
  }

  if (
    /(?:books\.google\.|google\.[a-z.]+\/books)/iu.test(url) &&
    source.textReuse !== "none"
  ) {
    issues.push("google-books-text-reuse-forbidden");
  }
  return issues;
}

export function curatedRecordIssues(record = {}) {
  const issues = [
    ...russianAnnotationIssues(record.annotationRu),
    ...englishAnnotationIssues(record.annotationEn),
  ];
  const canonical = record.canonical || {};
  if (!String(canonical.titleRu || "").trim()) issues.push("russian-title-required");
  if (!String(canonical.titleEn || "").trim()) issues.push("english-title-required");
  if (/\p{Script=Cyrillic}/u.test(String(canonical.titleEn || ""))) {
    issues.push("english-title-must-not-contain-cyrillic");
  }
  if (!String(canonical.originalTitle || "").trim()) {
    issues.push("original-title-required");
  }
  if (!Number.isInteger(canonical.firstPublished)) {
    issues.push("first-publication-year-required");
  }
  if (!String(canonical.originalLanguage || "").trim()) {
    issues.push("original-language-required");
  }
  if (!Array.isArray(canonical.genres) || canonical.genres.length === 0) {
    issues.push("genres-required");
  }

  const sources = Array.isArray(record.sources) ? record.sources : [];
  const distinctAuthorities = new Set();
  const declaredSourceUrls = new Set();
  for (const source of sources) {
    issues.push(...sourceLegalIssues(source));
    const authority = sourceAuthorityFamily(source);
    if (authority) distinctAuthorities.add(authority);
    if (/^https:\/\//iu.test(String(source.url || ""))) {
      declaredSourceUrls.add(String(source.url));
    }
  }
  if (distinctAuthorities.size < 2) {
    issues.push("two-independent-authority-families-required");
  }

  const checkedFields = new Set(
    (Array.isArray(record.factChecks) ? record.factChecks : []).map(
      (check) => check.field
    )
  );
  for (const field of [
    "identity",
    "authorship",
    "publication-year",
    "original-language",
  ]) {
    if (!checkedFields.has(field)) issues.push(`fact-check-${field}-required`);
  }
  for (const check of Array.isArray(record.factChecks) ? record.factChecks : []) {
    if (
      check.value === undefined ||
      check.value === null ||
      String(check.value).trim() === ""
    ) {
      issues.push(`fact-check-${check.field || "unknown"}-value-required`);
    }
    if (!Array.isArray(check.sourceUrls) || check.sourceUrls.length === 0) {
      issues.push(`fact-check-${check.field || "unknown"}-source-required`);
    } else if (
      check.sourceUrls.some(
        (sourceUrl) => !declaredSourceUrls.has(String(sourceUrl))
      )
    ) {
      issues.push(`fact-check-${check.field || "unknown"}-source-not-declared`);
    }
    if (!String(check.checkedAt || "").trim()) {
      issues.push(`fact-check-${check.field || "unknown"}-date-required`);
    } else if (!isIsoCalendarDate(check.checkedAt)) {
      issues.push(`fact-check-${check.field || "unknown"}-date-must-be-iso`);
    }
  }

  const confirmedMerges = Array.isArray(record.confirmedMerges)
    ? record.confirmedMerges
    : [];
  const confirmedMergeKeys = new Set();
  for (const merge of confirmedMerges) {
    const fromRecordKey = String(merge?.fromRecordKey || "").trim();
    const externalIdentity = String(merge?.externalIdentity || "").trim();
    const evidenceSourceUrls = Array.isArray(merge?.evidenceSourceUrls)
      ? merge.evidenceSourceUrls.map(String)
      : [];
    if (!fromRecordKey || fromRecordKey === record.recordKey) {
      issues.push("confirmed-merge-source-key-invalid");
    }
    if (confirmedMergeKeys.has(fromRecordKey)) {
      issues.push("confirmed-merge-source-key-duplicate");
    }
    confirmedMergeKeys.add(fromRecordKey);
    if (merge?.relation !== "same-work-wrong-writer-assignment") {
      issues.push("confirmed-merge-relation-invalid");
    }
    if (!/^(?:openlibrary:OL\d+W|wikidata:Q\d+)$/u.test(externalIdentity)) {
      issues.push("confirmed-merge-external-identity-invalid");
    }
    if (
      !sources.some(
        (source) =>
          externalIdentityFromSourceUrl(source.url) === externalIdentity
      )
    ) {
      issues.push("confirmed-merge-external-identity-not-declared");
    }
    if (
      evidenceSourceUrls.length < 2 ||
      evidenceSourceUrls.some((url) => !declaredSourceUrls.has(url))
    ) {
      issues.push("confirmed-merge-evidence-source-invalid");
    }
    const evidenceSources = evidenceSourceUrls
      .map((url) => sources.find((source) => source.url === url))
      .filter(Boolean);
    const evidenceFields = new Set(
      evidenceSources.flatMap((source) =>
        (source.fields || []).map(canonicalWorkSourceField).filter(Boolean)
      )
    );
    const evidenceAuthorities = new Set(
      evidenceSources.map(sourceAuthorityFamily).filter(Boolean)
    );
    if (
      !evidenceFields.has("identity") ||
      !evidenceFields.has("authorship") ||
      evidenceAuthorities.size < 2
    ) {
      issues.push("confirmed-merge-identity-authorship-evidence-required");
    }
    if (!String(merge?.note || "").trim()) {
      issues.push("confirmed-merge-note-required");
    }
  }

  if (record.rights?.textOrigin !== "project-original") {
    issues.push("rights-text-origin-must-be-project-original");
  }
  if (record.rights?.copiedSourceText !== false) {
    issues.push("copied-source-text-must-be-false");
  }
  return [...new Set(issues)];
}

export const enrichmentPolicy = Object.freeze({
  schemaVersion: 1,
  statuses: ["reject", "merge", "research", "ready"],
  russianAnnotation: {
    method: "editorial-original",
    sentences: [2, 3],
    characters: [140, 900],
    reviewerRequired: true,
    minimumIndependentSources: 2,
  },
  englishAnnotation: {
    method: "editorial-original",
    sentences: [2, 3],
    characters: [140, 900],
    reviewerRequired: true,
    minimumIndependentSources: 2,
  },
  wikidata: {
    allowedUse: "structured-data",
    license: "CC0 1.0",
    summaryCopyAllowed: false,
  },
  wikipedia: {
    allowedUse: "reference-only-or-attributed-licensed-copy",
    attributionFields: [
      "pageTitle",
      "revisionId",
      "revisionUrl",
      "attribution",
      "authorsUrl",
      "license",
    ],
  },
  googleBooks: {
    allowedUse: "reference-only-metadata",
    summaryCopyAllowed: false,
  },
});
