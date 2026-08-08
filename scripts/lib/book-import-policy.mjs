const suspiciousTitleRules = [
  ["adaptation", /\b(?:adaptation|adapted|screenplay|graphic novel)\b|адаптац/iu],
  [
    "study-material",
    /\b(?:study guide|workbook|teacher(?:'s|s)? guide|lesson plans?|sparknotes|cliffsnotes|reader's companion)\b/iu,
  ],
  [
    "anthology-or-textbook",
    /\b(?:anthology|textbook|prentice hall literature|norton anthology|literature reader|school reader)\b/iu,
  ],
  [
    "collection-or-omnibus",
    /\b(?:omnibus|box set|collected works|complete works|selected works|complete novels|collected novels)\b/iu,
  ],
  [
    "edition-not-work",
    /\b(?:large print|abridged|unabridged|anniversary edition|critical edition|student edition|with connections)\b/iu,
  ],
  ["combined-volume", /\s(?:\/|&|\+)\s|\[(?:collection|set)\b/iu],
];

export function normalizeBookTitle(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeOpenLibraryId(value = "") {
  const match = String(value).toLocaleUpperCase("en").match(/OL\d+[AWM]/u);
  return match?.[0] || "";
}

function validWorkId(value) {
  return /^OL\d+W$/u.test(normalizeOpenLibraryId(value));
}

function uniqueAuthorIds(candidate) {
  return [
    ...new Set(
      (candidate.authorKeys || [])
        .map(normalizeOpenLibraryId)
        .filter((value) => /^OL\d+A$/u.test(value))
    ),
  ];
}

export function suspiciousBookTitleReason(title = "") {
  return suspiciousTitleRules.find(([, pattern]) => pattern.test(title))?.[0] || "";
}

export function evaluateOpenLibraryCandidate(candidate, author) {
  const reasons = [];
  const workId = normalizeOpenLibraryId(candidate.workKey);
  const intendedAuthorId = normalizeOpenLibraryId(author.openLibraryId);
  const authorIds = uniqueAuthorIds(candidate);
  const normalizedTitle = normalizeBookTitle(candidate.title);
  const currentYear = new Date().getUTCFullYear();
  const firstPublished = Number(candidate.firstPublished) || undefined;

  if (!validWorkId(workId)) reasons.push("invalid-work-id");
  if (!normalizedTitle || normalizedTitle.length > 300) reasons.push("invalid-title");
  const suspiciousTitle = suspiciousBookTitleReason(candidate.title);
  if (suspiciousTitle) reasons.push(suspiciousTitle);
  if (!intendedAuthorId || !authorIds.includes(intendedAuthorId)) {
    reasons.push("author-mismatch");
  }
  if (authorIds.length !== 1) reasons.push("multiple-authors-or-anthology");
  if (firstPublished && firstPublished > currentYear) reasons.push("future-year");
  if (
    firstPublished &&
    author.birthYear &&
    firstPublished < Number(author.birthYear) - 20
  ) {
    reasons.push("year-before-author-lifetime");
  }
  if (
    firstPublished &&
    author.deathYear &&
    firstPublished > Number(author.deathYear) + 120
  ) {
    reasons.push("year-long-after-author-death");
  }
  if (Number(candidate.editionCount || 0) < 1) reasons.push("no-editions");

  const score = Math.max(
    0,
    Math.min(
      100,
      55 +
        Math.min(20, Math.log10(Number(candidate.editionCount || 0) + 1) * 10) +
        Math.min(20, Math.log10(Number(candidate.ratingsCount || 0) + 1) * 8) +
        (firstPublished ? 5 : 0) -
        reasons.length * 25
    )
  );

  return {
    accepted: reasons.length === 0,
    externalId: workId,
    normalizedTitle,
    reasons,
    score: Math.round(score),
  };
}

export function dedupeOpenLibraryCandidates(candidates) {
  const byExternalId = new Map();
  for (const candidate of candidates) {
    const key = normalizeOpenLibraryId(candidate.externalId || candidate.workKey);
    if (!byExternalId.has(key)) byExternalId.set(key, []);
    byExternalId.get(key).push(candidate);
  }

  const accepted = [];
  const rejected = [];
  for (const [externalId, group] of byExternalId) {
    const writerKeys = new Set(group.map((candidate) => candidate.writerKey));
    if (!externalId || writerKeys.size > 1) {
      rejected.push(
        ...group.map((candidate) => ({
          ...candidate,
          rejectionReasons: [
            ...(candidate.rejectionReasons || []),
            externalId ? "external-id-assigned-to-multiple-writers" : "invalid-work-id",
          ],
        }))
      );
      continue;
    }
    accepted.push(
      [...group].sort(
        (first, second) =>
          Number(second.qualityScore || 0) - Number(first.qualityScore || 0)
      )[0]
    );
  }
  return { accepted, rejected };
}

export const openLibrarySuspiciousTitleRules = suspiciousTitleRules.map(
  ([id]) => id
);
