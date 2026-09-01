const editorialPrefix =
  /^(?:[^:]{0,180}(?:оценк|суперлатив|формулировк|утверждени|уточн|замен)[^:]*):\s*/iu;
const normalizedBatchPrefix =
  /^Источник (?:подтверждает утверждение|обосновывает уточнённую формулировку):\s*/iu;
const nonBiographicalClaim =
  /(?:оценочн|рейтинг|суперлатив|проверяем|редакционн|служебн|формулировк|утверждени|источник|удал[её]н|замен[её]н|подтвержден[аоы]? институциональн|placeholder|метаданн|рекомендац|birthDate|shared|портрет|конфликтн|не использовать|центральн(?:ая|ой|ую) фигур|крупн(?:ая|ой|ую) фигур)/iu;
const nonBiographicalEvidence =
  /(?:оценк[^.]{0,80}замен|суперлатив|проверяемыми сведениями|редакционн|служебн|не позволил установить|центральн(?:ая|ой|ую) фигур|признанн[^.]{0,60}(?:значени|писател)|наиболее|крупнейш|величайш|ведущ(?:ий|ая|ие))/iu;
const implicitSourceVerb =
  /^(?:Подтверждает|Фиксирует|Документирует|Называет|Характеризует|Описывает|Атрибутирует|Указывает|Сообщает|Перечисляет|Связывает)(?![\p{L}\p{N}_])/u;
export const structuredRussianBiographySourceNarrationPattern =
  /(?:\bBnF\b|каталогизир[а-яё]*|подтверждает|фиксирует|документирует|называет|характеризует|описывает|атрибутирует|идентифицирует|перечисляет|указывает|сообщает|связывает|представляет|определяет|профиль (?:автора|издателя)|архивная страница|официальная страница|цифровой каталог|университетск(?:ая публикация|ое издательство|ое исследование)|национальная библиотека|литературный музей|институциональн(?:ая справка|ый материал)|авторитетная запись|библиографическая запись|(?:архив|каталог|издание|справка|библиотека|музей|профиль|страница)[^.]{0,100}(?:включает|содержит))/iu;
export const structuredRussianBiographyTechnicalPattern =
  /(?:review|fact[- ]?check|sha-?256|source hash|проверено|не проверено|верифицирован|редакционн(?:ая|ое|ый) проверк|служебн(?:ая|ое|ый) пометк|источник недоступен|данные источника|согласно источнику|по данным (?:архива|каталога|профиля|страницы|источника))/iu;
export const structuredRussianBiographyGenderAgreementPattern =
  /(?:^|[^\p{L}])[А-ЯЁа-яё-]+(?:ская|цкая)\s+(?:антрополог|врач|дипломат|драматург|историк|исследователь|кинорежиссёр(?:-документалист)?|критик|литературовед|педагог|переводчик|писатель|поэт|прозаик|редактор|режиссёр|сценарист|филолог|этнолог|юрист)(?![\p{L}-])/iu;
const genericBiographyPatterns = [
  /автор, связанный с литературной традицией/iu,
  /представител[ьница]* современной .*литературной сцены/iu,
  /расширенная биографическая карточка проходит редакционную проверку/iu,
  /расширенная биография .*готовится/iu,
  /представлен[а]? в книжном архиве произведениями/iu,
  /литературн(?:ое творчество|ая деятельность) (?:была )?(?:связана со становлением|относится к .*художественного периода)/iu,
  /в (?:его|её) (?:творчестве|деятельности) (?:соединяются|поэтическое творчество сочеталось)/iu,
  /литературная деятельность охватывает прозу, поэзию и драматургию/iu,
];

export function normalizeStructuredRussianBiographyText(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function sentenceBoundaryText(value) {
  let text = normalizeStructuredRussianBiographyText(value);
  const initials =
    /(^|[^\p{L}])(Дж|[А-ЯЁA-Z])\.(?=\s*(?:(?:Дж|[А-ЯЁA-Z])\.|[А-ЯЁA-Z][а-яёa-z]))/gu;
  for (let pass = 0; pass < 3; pass += 1) {
    text = text.replace(initials, "$1$2");
  }
  return text;
}

export function structuredRussianBiographySentenceCount(value) {
  return sentenceBoundaryText(value).match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

const semanticStopWords = new Set([
  "была",
  "были",
  "было",
  "года",
  "году",
  "которого",
  "которая",
  "который",
  "которые",
  "среди",
  "стал",
  "стала",
  "является",
]);

function semanticStem(word) {
  const normalized = word.toLocaleLowerCase("ru").replace(/ё/gu, "е");
  const adjectiveStem = normalized.replace(
    /(?:ского|скому|скими|ский|ская|ское|ские|ской|ским|скую)$/u,
    "",
  );
  const nounStem = adjectiveStem.replace(
    /(?:иями|ами|ями|ого|ому|ыми|ими|иях|ах|ях|ью|ою|ею|ом|ем|ой|ей|а|я|у|ю|ы|и|е)$/u,
    "",
  );
  const stem = nounStem.replace(/[ьъ]$/u, "");
  return stem.length >= 4 ? stem : normalized;
}

function biographySentences(value) {
  return (
    sentenceBoundaryText(value).match(/[^.!?…]+(?:[.!?…]+|$)/gu) || []
  ).map((sentence) => sentence.trim());
}

export function structuredRussianBiographyAwardRestatementIssues(value) {
  const sentences = biographySentences(value);
  const issues = [];
  for (let leftIndex = 0; leftIndex < sentences.length; leftIndex += 1) {
    if (
      !/лауреат[а-яё]*[^.!?…]{0,140}(?:преми[а-яё]*|наград[а-яё]*)/iu.test(
        sentences[leftIndex],
      )
    ) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sentences.length;
      rightIndex += 1
    ) {
      if (
        /^(?:Эта|Данная)\s+(?:литературная\s+)?(?:награда|премия)\s+(?:была\s+)?присуждена/iu.test(
          sentences[rightIndex],
        )
      ) {
        issues.push([leftIndex, rightIndex]);
      }
    }
  }
  return issues;
}

export function structuredRussianBiographyLifespanRestatementIssues(value) {
  const sentences = biographySentences(value);
  const issues = [];
  for (let leftIndex = 0; leftIndex < sentences.length; leftIndex += 1) {
    const range = sentences[leftIndex].match(/\((\d{3,4})-(\d{3,4})\)/u);
    if (!range) continue;
    const [, birthYear, deathYear] = range;
    const restatementPattern = new RegExp(
      `родил(?:ся|ась)[^.]*${birthYear}[^.]*умер(?:ла)?[^.]*${deathYear}`,
      "iu",
    );
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sentences.length;
      rightIndex += 1
    ) {
      if (restatementPattern.test(sentences[rightIndex])) {
        issues.push([leftIndex, rightIndex]);
      }
    }
  }
  return issues;
}

function semanticWords(value) {
  return new Set(
    (
      normalizeStructuredRussianBiographyText(value)
        .toLocaleLowerCase("ru")
        .match(/[\p{L}\p{N}]{4,}/gu) || []
    )
      .filter((word) => !semanticStopWords.has(word))
      .map(semanticStem),
  );
}

/**
 * Returns pairs of sentences that restate substantially the same fact. This
 * intentionally uses a conservative overlap threshold: the release gate must
 * catch near-copies without rejecting a later sentence that merely mentions
 * the same work while adding an award or publication fact.
 */
export function structuredRussianBiographyTautologyIssues(value) {
  const sentences = biographySentences(value);
  const issues = [];
  for (let leftIndex = 0; leftIndex < sentences.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sentences.length;
      rightIndex += 1
    ) {
      const left = sentences[leftIndex];
      const right = sentences[rightIndex];
      const leftWords = semanticWords(left);
      const rightWords = semanticWords(right);
      const smallerSize = Math.min(leftWords.size, rightWords.size);
      const intersection = [...leftWords].filter((word) =>
        rightWords.has(word),
      ).length;
      const overlap = smallerSize ? intersection / smallerSize : 0;
      const leftCanonical = [...leftWords].sort().join(" ");
      const rightCanonical = [...rightWords].sort().join(" ");
      const contained =
        Math.min(leftCanonical.length, rightCanonical.length) >= 45 &&
        (leftCanonical.includes(rightCanonical) ||
          rightCanonical.includes(leftCanonical));
      if (
        (smallerSize >= 4 && overlap >= 0.72) ||
        (smallerSize >= 4 && contained)
      ) {
        issues.push([leftIndex, rightIndex]);
      }
    }
  }
  return issues;
}

function canonicalFactText(value) {
  return normalizeStructuredRussianBiographyText(value)
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function numericFacts(value) {
  return new Set(String(value || "").match(/\d+(?:[.,]\d+)?/gu) || []);
}

function quotedFacts(value) {
  return [...String(value || "").matchAll(/[«“"]([^»”"]{2,})[»”"]/gu)].map(
    (match) => canonicalFactText(match[1]),
  );
}

const sentenceLeadWords = new Set([
  "в",
  "вместе",
  "всего",
  "его",
  "ее",
  "её",
  "ему",
  "значительная",
  "как",
  "к",
  "литературные",
  "международное",
  "на",
  "награды",
  "наряду",
  "написанный",
  "она",
  "они",
  "он",
  "по",
  "после",
  "помимо",
  "под",
  "при",
  "роман",
  "свои",
  "своими",
  "сначала",
  "среди",
  "также",
  "это",
  "эта",
]);

function entityTokens(value) {
  const tokens = [];
  for (const sentence of biographySentences(value)) {
    const words = sentence.match(/[\p{Lu}][\p{L}\p{M}'’.-]{2,}/gu) || [];
    words.forEach((word, index) => {
      const canonical = canonicalFactText(word);
      if (/^[ivxlcdm]+$/iu.test(canonical)) return;
      if (index === 0 && sentenceLeadWords.has(canonical)) return;
      tokens.push(canonical);
    });
  }
  return tokens;
}

function entityTokenAllowed(token, allowedTokens) {
  if (allowedTokens.has(token)) return true;
  // Isolated initials are not stable entity identifiers across Cyrillic and
  // Latin transliterations. A newly invented person is still rejected by the
  // accompanying surname token, while verified forms such as «Т. С. Элиота»
  // no longer fail only because the evidence spells the initials as T. S.
  if (token.length < 4) return true;
  const prefix = token.slice(0, Math.max(4, token.length - 3));
  return [...allowedTokens].some(
    (allowed) =>
      allowed.length >= 4 &&
      (allowed.startsWith(prefix) || token.startsWith(allowed.slice(0, 4))),
  );
}

export function structuredRussianBiographyRefinementIssues(input, refinement) {
  const issues = [];
  if (!refinement || typeof refinement !== "object") {
    return ["missing-refinement"];
  }
  if (refinement.expectedSourceHash !== input.expectedSourceHash) {
    issues.push("source-hash-mismatch");
  }
  const text = normalizeStructuredRussianBiographyText(refinement.text);
  if (!isStructuredRussianBiographyText(text)) {
    issues.push("structured-text-gate");
  }
  const publishableClaims = input.claims.filter((claim) =>
    new Set(["supported", "corrected"]).has(claim.verdict),
  );
  const allowedSource = [
    input.writerName,
    input.reviewedTextRu,
    ...publishableClaims.map((claim) => claim.textRu),
    ...input.evidence.map((evidence) => evidence.findingRu),
  ].join(" ");
  const allowedCanonical = canonicalFactText(allowedSource);
  const allowedNumbers = numericFacts(allowedSource);
  const unexpectedNumbers = [...numericFacts(text)].filter(
    (number) => !allowedNumbers.has(number),
  );
  if (unexpectedNumbers.length > 0) {
    issues.push(`new-numbers:${unexpectedNumbers.join(",")}`);
  }
  const unexpectedWorks = quotedFacts(text).filter(
    (work) => work.length >= 3 && !allowedCanonical.includes(work),
  );
  if (unexpectedWorks.length > 0) {
    issues.push(`new-works:${unexpectedWorks.join("|")}`);
  }
  const allowedEntities = new Set(entityTokens(allowedSource));
  const unexpectedEntities = entityTokens(text).filter(
    (token) => !entityTokenAllowed(token, allowedEntities),
  );
  if (unexpectedEntities.length > 0) {
    issues.push(`new-names:${[...new Set(unexpectedEntities)].join(",")}`);
  }
  const writerNameTokens = canonicalFactText(input.writerName)
    .split(" ")
    .filter((token) => token.length >= 3);
  if (
    writerNameTokens.length > 0 &&
    !writerNameTokens.some((token) => canonicalFactText(text).includes(token))
  ) {
    issues.push("writer-name-missing");
  }
  return issues;
}

export function isStructuredRussianBiographyText(value) {
  const text = normalizeStructuredRussianBiographyText(value);
  const sentenceCount = structuredRussianBiographySentenceCount(text);
  return (
    text.length >= 120 &&
    text.length <= 1_600 &&
    sentenceCount >= 2 &&
    sentenceCount <= 4 &&
    /[А-Яа-яЁё]/u.test(text) &&
    !genericBiographyPatterns.some((pattern) => pattern.test(text)) &&
    !structuredRussianBiographySourceNarrationPattern.test(text) &&
    !structuredRussianBiographyTechnicalPattern.test(text) &&
    !structuredRussianBiographyGenderAgreementPattern.test(text) &&
    structuredRussianBiographyAwardRestatementIssues(text).length === 0 &&
    structuredRussianBiographyLifespanRestatementIssues(text).length === 0 &&
    structuredRussianBiographyTautologyIssues(text).length === 0
  );
}

function ensureSentence(value) {
  const text = normalizeStructuredRussianBiographyText(value);
  return text && !/[.!?…]$/u.test(text) ? `${text}.` : text;
}

function canonicalWords(value) {
  return new Set(
    normalizeStructuredRussianBiographyText(value)
      .toLocaleLowerCase("ru")
      .match(/[\p{L}\p{N}]{4,}/gu) || [],
  );
}

function novelty(base, candidate) {
  const baseWords = canonicalWords(base);
  const candidateWords = [...canonicalWords(candidate)];
  if (candidateWords.length === 0) return 0;
  return (
    candidateWords.filter((word) => !baseWords.has(word)).length /
    candidateWords.length
  );
}

function claimSupplement(value) {
  const text = ensureSentence(
    normalizeStructuredRussianBiographyText(value)
      .replace(editorialPrefix, "")
      .replace(normalizedBatchPrefix, ""),
  );
  return text &&
    /^[А-ЯЁA-Z«]/u.test(text) &&
    !nonBiographicalClaim.test(text) &&
    !structuredRussianBiographySourceNarrationPattern.test(text)
    ? text
    : null;
}

export function isPublishableRussianBiographyClaim(value) {
  const text = normalizeStructuredRussianBiographyText(value);
  return Boolean(
    text &&
    !nonBiographicalClaim.test(text) &&
    !structuredRussianBiographySourceNarrationPattern.test(text) &&
    !structuredRussianBiographyTechnicalPattern.test(text),
  );
}

function evidenceSupplement(evidence) {
  let text = ensureSentence(
    normalizeStructuredRussianBiographyText(evidence.findingRu)
      .replace(normalizedBatchPrefix, "")
      .replace(editorialPrefix, "")
      .replace(/Authority-запись/gu, "Авторитетная запись")
      .replace(/(^|\s)независимо\s+/giu, "$1"),
  );
  if (implicitSourceVerb.test(text)) {
    text = `${evidence.provider} ${text
      .charAt(0)
      .toLocaleLowerCase("ru")}${text.slice(1)}`;
  }
  return text &&
    !nonBiographicalEvidence.test(text) &&
    !structuredRussianBiographySourceNarrationPattern.test(text)
    ? text
    : null;
}

export function isPublishableRussianBiographyEvidence(value) {
  const text = normalizeStructuredRussianBiographyText(value);
  return Boolean(
    text &&
    !nonBiographicalEvidence.test(text) &&
    !structuredRussianBiographyTechnicalPattern.test(text),
  );
}

function firstReadyCombination(seed, candidates, limit) {
  let frontier = [seed];
  for (const candidate of candidates) {
    for (const current of [...frontier]) {
      const combined = normalizeStructuredRussianBiographyText(
        `${current} ${candidate}`,
      );
      if (!current && /^(?:Он|Она|Его|Её|Их|Этот|Эта|Эти)\s/u.test(combined)) {
        continue;
      }
      if (
        combined.length > 1_600 ||
        structuredRussianBiographySentenceCount(combined) > 4
      ) {
        continue;
      }
      if (isStructuredRussianBiographyText(combined)) return combined;
      frontier.push(combined);
    }
    if (frontier.length > limit) frontier = frontier.slice(0, limit);
  }
  return null;
}

/**
 * Produces publication copy only from the applicable reviewed prose and the
 * already recorded Russian claim/evidence summaries. No source page prose is
 * fetched or copied. A record remains blocked when those materials cannot
 * satisfy the public 2-4 sentence / 120-1600 character gate.
 */
export function structuredRussianBiographyFromReview(
  record,
  editorialText,
  refinement,
  editorialInput,
) {
  if (editorialText !== undefined) {
    const curated = ensureSentence(editorialText);
    if (isStructuredRussianBiographyText(curated)) {
      return { text: curated, derivation: "curated-editorial" };
    }
  }
  if (editorialInput && refinement) {
    const refinementIssues = structuredRussianBiographyRefinementIssues(
      editorialInput,
      refinement,
    );
    if (refinementIssues.length === 0) {
      return {
        text: ensureSentence(refinement.text),
        derivation: "two-pass-editorial-refinement",
      };
    }
    return {
      text: ensureSentence(refinement.text),
      derivation: "blocked-editorial-refinement",
      refinementIssues,
    };
  }
  const base = ensureSentence(record.applicableTextRu);
  if (isStructuredRussianBiographyText(base)) {
    return { text: base, derivation: "reviewed-text" };
  }
  return {
    text: editorialText === undefined ? base : ensureSentence(editorialText),
    derivation:
      editorialText === undefined ? "blocked" : "blocked-curated-editorial",
  };
}
