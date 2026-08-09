export const LITERARY_OCCUPATION_IDS = new Set([
  "Q36180", // writer
  "Q49757", // poet
  "Q6625963", // novelist
  "Q214917", // playwright
  "Q11774202", // essayist
  "Q4853732", // children's writer
  "Q18814623", // autobiographer
  "Q4263842", // science-fiction writer
]);

export const LITERARY_DESCRIPTION_PATTERN =
  /(?:писател|поэт|поэтесс|прозаик|романист|драматург|эссеист|литератур|мемуарист|автор\s+(?:книг|романов|рассказов|дневника)|writer|poet|novelist|playwright|essayist|literary|diarist|memoirist|short[ -]story|science[ -]fiction|children(?:'s|’s)?\s+(?:writer|author))/iu;

export function normalizeIdentityText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mergeDescriptions(target, source) {
  for (const [language, value] of Object.entries(source || {})) {
    if (typeof value === "string" && value.trim()) target[language] = value.trim();
  }
}

/**
 * SPARQL returns one row per birth-date/occupation/description combination.
 * Collapse those rows before making an identity decision so a single QID can
 * never look ambiguous merely because it has several sourced statements.
 */
export function mergeIdentityCandidates(candidates = []) {
  const byQid = new Map();
  for (const source of candidates) {
    const qid = String(source?.qid || "").toUpperCase();
    if (!/^Q[1-9]\d*$/u.test(qid)) continue;
    const target = byQid.get(qid) || {
      qid,
      human: source.human !== false,
      birthYears: [],
      portraitFilename: "",
      literaryOccupationIds: [],
      descriptions: {},
    };
    target.human = target.human && source.human !== false;
    const sourceBirthYears = Array.isArray(source.birthYears)
      ? source.birthYears
      : [source.birthYear];
    target.birthYears = [
      ...new Set(
        [...target.birthYears, ...sourceBirthYears]
          .map(String)
          .filter((year) => /^\d{3,4}$/u.test(year))
      ),
    ].sort();
    target.portraitFilename ||= String(source.portraitFilename || "");
    target.literaryOccupationIds = [
      ...new Set([
        ...target.literaryOccupationIds,
        ...(source.literaryOccupationIds || []),
      ]),
    ].sort();
    mergeDescriptions(target.descriptions, source.descriptions);
    byQid.set(qid, target);
  }
  return [...byQid.values()].sort((first, second) =>
    first.qid.localeCompare(second.qid, "en")
  );
}

export function hasLiteraryIdentitySignal(candidate) {
  if (
    (candidate?.literaryOccupationIds || []).some((qid) =>
      LITERARY_OCCUPATION_IDS.has(qid)
    )
  ) {
    return true;
  }
  return Object.values(candidate?.descriptions || {}).some((description) =>
    LITERARY_DESCRIPTION_PATTERN.test(String(description))
  );
}

/**
 * A resolver result is publishable only when one human candidate survives all
 * available identity checks. In particular, a unique exact-label result with
 * the wrong (or absent) birth year is no longer accepted when the card has a
 * birth year.
 */
export function selectUniqueWriterCandidate(candidates, expectedBirthYear = "") {
  const merged = mergeIdentityCandidates(candidates);
  const humans = merged.filter((candidate) => candidate.human !== false);
  if (!humans.length) {
    return { candidate: null, reason: "human-identity-not-established" };
  }

  const expected = String(expectedBirthYear || "");
  const dateCompatible = expected
    ? humans.filter((candidate) => candidate.birthYears.includes(expected))
    : humans;
  if (!dateCompatible.length) {
    return {
      candidate: null,
      reason: expected
        ? "birth-year-mismatch-or-missing"
        : "human-identity-not-established",
    };
  }

  const literary = dateCompatible.filter(hasLiteraryIdentitySignal);
  if (!literary.length) {
    return { candidate: null, reason: "literary-identity-not-established" };
  }
  if (literary.length !== 1) {
    return { candidate: null, reason: "ambiguous-identity" };
  }
  return { candidate: literary[0], reason: null };
}
