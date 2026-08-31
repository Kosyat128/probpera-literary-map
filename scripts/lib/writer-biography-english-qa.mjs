const CYRILLIC_PATTERN = /\p{Script=Cyrillic}/u;
const ASCII_LETTER_PATTERN = /[A-Za-z]/u;
const SENTENCE_END_PATTERN = /[.!?…]+(?=\s|$)/gu;
const NUMBER_PATTERN = /\p{Number}+/gu;
const LATIN_TOKEN_PATTERN = /\p{Script=Latin}[\p{Script=Latin}\p{M}'’-]*/gu;
const QUOTED_SPAN_PATTERN = /«([^»]+)»|“([^”]+)”|"([^"]+)"|‘([^’]+)’/gu;
const FORBIDDEN_OUTPUT_PATTERN =
  /```|\bSOURCE_DATA\b|\bDRAFT_TRANSLATION\b|\bVALIDATION_FAILURE\b|\b(?:I cannot|I can(?:not|'t)|as an AI)\b/iu;
const SOURCE_NARRATION_PATTERN =
  /(?:согласно|по данным|как (?:сообщает|указывает|отмечает|подтверждает)|источник(?:и)? (?:сообщает|сообщают|указывает|указывают|подтверждает|подтверждают)|(?:профиль|каталог|архив|база данных|биографическая (?:статья|запись|справка)|академическое издание|страница (?:автора|писателя|лауреата))[^.!?…]{0,100}(?:подтвержда|указыва|отмеча|сообща|включа|содерж|определя|фиксиру)|в (?:биографической )?(?:статье|записи|справке) (?:сказано|указано|отмечено))/iu;
const ENGLISH_OPENING_IDENTITY_PATTERN =
  /^(?!(?:The|He|She|This|A|An)\b)(?=[^!?…]{1,120}\b(?:is|was)\b)\p{Lu}[^!?…]{1,120}\b(?:is|was)\b/u;
const EDITORIAL_POST_EDIT_REASON_CODES = new Set([
  "english-style-polish",
  "source-fact-restoration",
]);

const identityStopWords = new Set([
  "al",
  "bin",
  "bint",
  "da",
  "de",
  "del",
  "di",
  "dos",
  "du",
  "el",
  "ibn",
  "la",
  "le",
  "of",
  "the",
  "van",
  "von",
]);

function normalizedText(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}

export function writerBiographyNormalizedEnglishText(value) {
  return normalizedText(value).toLocaleLowerCase("en");
}

export function writerBiographyNormalizedRussianText(value) {
  return normalizedText(value).toLocaleLowerCase("ru");
}

function duplicateNormalizedTextGroups(
  records,
  translations,
  textField,
  normalize
) {
  const byText = new Map();
  for (const record of records || []) {
    const candidate = translations?.[record.key];
    const normalized = normalize(candidate?.[textField]);
    if (!normalized) continue;
    const keys = byText.get(normalized) || [];
    keys.push(record.key);
    byText.set(normalized, keys);
  }
  return [...byText.values()].filter((keys) => keys.length > 1);
}

export function writerBiographyDuplicateEnglishGroups(
  records,
  translations,
  textField = "text"
) {
  return duplicateNormalizedTextGroups(
    records,
    translations,
    textField,
    writerBiographyNormalizedEnglishText
  );
}

export function writerBiographyDuplicateRussianGroups(
  records,
  refinements,
  textField = "text"
) {
  return duplicateNormalizedTextGroups(
    records,
    refinements,
    textField,
    writerBiographyNormalizedRussianText
  );
}

export function writerBiographyTranslationAuditIssues(candidate) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") {
    return ["missing-translation-audit"];
  }
  for (const field of ["translatorRequestId", "reviewerRequestId"]) {
    if (!Object.hasOwn(candidate, field)) issues.push(`missing-${field}`);
  }
  if (!candidate.usage || typeof candidate.usage !== "object") {
    issues.push("missing-usage-audit");
  } else {
    for (const field of [
      "inputTokens",
      "outputTokens",
      "reviewInputTokens",
      "reviewOutputTokens",
    ]) {
      if (!Object.hasOwn(candidate.usage, field)) {
        issues.push(`missing-usage-${field}`);
      }
    }
  }
  if (!Array.isArray(candidate.passes) || candidate.passes.length < 2) {
    issues.push("missing-pass-audit");
  } else {
    const passes = candidate.passes;
    if (passes[0]?.phase !== "translation") {
      issues.push("invalid-first-pass-phase");
    }
    if (passes.at(-1)?.phase !== "review") {
      issues.push("invalid-final-pass-phase");
    }
    if (passes.slice(1, -1).some((pass) => pass?.phase !== "repair")) {
      issues.push("invalid-intermediate-pass-phase");
    }
    for (const [index, pass] of passes.entries()) {
      if (!pass || typeof pass !== "object" || !pass.model) {
        issues.push(`invalid-pass-${index}`);
        continue;
      }
      for (const field of ["requestId", "inputTokens", "outputTokens"]) {
        if (!Object.hasOwn(pass, field)) {
          issues.push(`missing-pass-${index}-${field}`);
        }
      }
    }
    if (candidate.translatorRequestId !== passes[0]?.requestId) {
      issues.push("translator-request-id-pass-mismatch");
    }
    if (candidate.reviewerRequestId !== passes.at(-1)?.requestId) {
      issues.push("reviewer-request-id-pass-mismatch");
    }
    const combined = (field, selectedPasses) => {
      const known = selectedPasses
        .map((pass) => pass?.[field])
        .filter((value) => typeof value === "number");
      return known.length
        ? known.reduce((total, value) => total + value, 0)
        : null;
    };
    if (candidate.usage?.inputTokens !== passes[0]?.inputTokens) {
      issues.push("translation-input-usage-pass-mismatch");
    }
    if (candidate.usage?.outputTokens !== passes[0]?.outputTokens) {
      issues.push("translation-output-usage-pass-mismatch");
    }
    if (
      candidate.usage?.reviewInputTokens !==
      combined("inputTokens", passes.slice(1))
    ) {
      issues.push("review-input-usage-pass-mismatch");
    }
    if (
      candidate.usage?.reviewOutputTokens !==
      combined("outputTokens", passes.slice(1))
    ) {
      issues.push("review-output-usage-pass-mismatch");
    }
  }
  return issues;
}

export function writerBiographyCheckpointAuditFromWorkerPayload(payload) {
  return {
    translatorRequestId: payload?.translatorRequestId || null,
    reviewerRequestId: payload?.reviewerRequestId || null,
    usage: {
      inputTokens: payload?.inputTokens ?? null,
      outputTokens: payload?.outputTokens ?? null,
      reviewInputTokens: payload?.reviewInputTokens ?? null,
      reviewOutputTokens: payload?.reviewOutputTokens ?? null,
    },
    passes: Array.isArray(payload?.passes)
      ? payload.passes.map((pass) => ({
          phase: String(pass?.phase || ""),
          model: String(pass?.model || ""),
          requestId: pass?.requestId || null,
          inputTokens: pass?.inputTokens ?? null,
          outputTokens: pass?.outputTokens ?? null,
        }))
      : [],
  };
}

export function writerBiographyEditorialPostEditIssues(candidate) {
  if (candidate === undefined) return [];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return ["invalid-editorial-post-edit"];
  }

  const issues = [];
  if (
    typeof candidate.editedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      candidate.editedAt
    ) ||
    Number.isNaN(Date.parse(candidate.editedAt))
  ) {
    issues.push("invalid-editorial-post-edit-timestamp");
  }
  if (
    typeof candidate.editor !== "string" ||
    !candidate.editor.trim() ||
    candidate.editor !== candidate.editor.trim() ||
    candidate.editor.length > 300
  ) {
    issues.push("invalid-editorial-post-edit-editor");
  }
  if (
    !Array.isArray(candidate.reasonCodes) ||
    candidate.reasonCodes.length === 0
  ) {
    issues.push("invalid-editorial-post-edit-reason-codes");
  } else {
    if (new Set(candidate.reasonCodes).size !== candidate.reasonCodes.length) {
      issues.push("duplicate-editorial-post-edit-reason-code");
    }
    if (
      candidate.reasonCodes.some(
        (reason) => !EDITORIAL_POST_EDIT_REASON_CODES.has(reason)
      )
    ) {
      issues.push("unknown-editorial-post-edit-reason-code");
    }
  }
  return issues;
}

export function writerBiographyPublicEnglishTranslationRecord(checkpoint) {
  const publicRecord = {
    text: checkpoint.text,
    sourceHash: checkpoint.sourceHash,
    generatedAt: checkpoint.generatedAt,
    reviewedAt: checkpoint.reviewedAt,
    model: checkpoint.translatorModel,
    reviewerModel: checkpoint.reviewerModel,
  };
  if (checkpoint.editorialPostEdit !== undefined) {
    publicRecord.editorialPostEditedAt = checkpoint.editorialPostEdit.editedAt;
    publicRecord.editorialPostEditor = checkpoint.editorialPostEdit.editor;
    publicRecord.editorialPostEditReasonCodes = [
      ...checkpoint.editorialPostEdit.reasonCodes,
    ];
  }
  return publicRecord;
}

export function writerBiographyPublicEnglishTranslationAuditRecord(checkpoint) {
  return {
    sourceHash: checkpoint.sourceHash,
    generatedAt: checkpoint.generatedAt,
    reviewedAt: checkpoint.reviewedAt,
    translatorModel: checkpoint.translatorModel,
    reviewerModel: checkpoint.reviewerModel,
    passes: (checkpoint.passes || []).map((pass) => ({
      phase: pass.phase,
      model: pass.model,
    })),
    ...(checkpoint.editorialPostEdit === undefined
      ? {}
      : {
          editorialPostEdit: {
            editedAt: checkpoint.editorialPostEdit.editedAt,
            editor: checkpoint.editorialPostEdit.editor,
            reasonCodes: [...checkpoint.editorialPostEdit.reasonCodes],
          },
        }),
  };
}

function sortedTokens(value, pattern) {
  return [...normalizedText(value).matchAll(pattern)]
    .map((match) => match[0].normalize("NFC"))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function sameTokens(left, right) {
  return (
    left.length === right.length &&
    left.every((token, index) => token === right[index])
  );
}

function writerBiographySentenceEnds(value) {
  const text = normalizedText(value);
  return [...text.matchAll(SENTENCE_END_PATTERN)].filter((match) => {
    if (match[0] !== "." || match.index === undefined) return true;
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + 1);
    if (
      /(?:^|\s)[IVXLCDM]$/u.test(before) &&
      !/^\s+\p{Lu}\.(?:\s|$)/u.test(after)
    ) {
      return true;
    }
    return !(
      /(?:^|\s)\p{Lu}$/u.test(before) &&
      /^\s+\p{Lu}/u.test(after)
    );
  });
}

export function writerBiographySentenceCount(value) {
  return writerBiographySentenceEnds(value).length;
}

export function writerBiographyNumberTokens(value) {
  return sortedTokens(value, NUMBER_PATTERN);
}

export function writerBiographyQuotedSpans(value) {
  return [...normalizedText(value).matchAll(QUOTED_SPAN_PATTERN)].map(
    (match) => match.slice(1).find(Boolean)?.trim() || ""
  );
}

export function writerBiographyProtectedLatinTokens(value) {
  return sortedTokens(value, LATIN_TOKEN_PATTERN).filter(
    (token) =>
      token.length >= 2 &&
      !/^[IVXLCDM]+$/u.test(token) &&
      !identityStopWords.has(token.toLocaleLowerCase("en"))
  );
}

export function writerBiographyMissingProtectedLatinTokens(
  sourceText,
  englishText
) {
  const englishTokens = new Set(
    writerBiographyProtectedLatinTokens(englishText).map((token) =>
      token.toLocaleLowerCase("en")
    )
  );
  return [
    ...new Set(
      writerBiographyProtectedLatinTokens(sourceText).filter(
        (token) => !englishTokens.has(token.toLocaleLowerCase("en"))
      )
    ),
  ];
}

export function writerBiographyEnglishQaIssues(input) {
  const sourceText = normalizedText(input?.sourceText);
  const englishText = normalizedText(input?.englishText);
  const writerName = normalizedText(input?.writerName);
  const issues = [];

  if (!sourceText) issues.push("missing-source-text");
  if (!englishText) return [...issues, "missing-english-text"];
  if (englishText.length < 120 || englishText.length > 1_600) {
    issues.push("english-length-out-of-range");
  }
  const sentenceCount = writerBiographySentenceCount(englishText);
  if (sentenceCount < 2 || sentenceCount > 4) {
    issues.push("english-sentence-count-out-of-range");
  }
  if (!ASCII_LETTER_PATTERN.test(englishText)) {
    issues.push("english-has-no-latin-letters");
  }
  if (CYRILLIC_PATTERN.test(englishText)) {
    issues.push("english-contains-cyrillic");
  }
  if (FORBIDDEN_OUTPUT_PATTERN.test(englishText)) {
    issues.push("english-contains-model-or-markup-artifact");
  }
  if (!ENGLISH_OPENING_IDENTITY_PATTERN.test(englishText)) {
    issues.push("english-writer-identity-opening-missing");
  }

  const sourceNumbers = writerBiographyNumberTokens(sourceText);
  const englishNumbers = writerBiographyNumberTokens(englishText);
  if (!sameTokens(sourceNumbers, englishNumbers)) {
    issues.push("numeric-facts-changed");
  }

  const sourceQuotedSpans = writerBiographyQuotedSpans(sourceText);
  const englishQuotedSpans = writerBiographyQuotedSpans(englishText);
  if (sourceQuotedSpans.length !== englishQuotedSpans.length) {
    issues.push("quoted-work-count-changed");
  }

  const missingProtectedLatinTokens =
    writerBiographyMissingProtectedLatinTokens(sourceText, englishText);
  const foldedEnglish = englishText.toLocaleLowerCase("en");
  if (missingProtectedLatinTokens.length) {
    issues.push("source-latin-token-omitted");
  }

  const identityTokens = writerBiographyProtectedLatinTokens(writerName);
  if (
    identityTokens.length > 0 &&
    !identityTokens.some((token) =>
      foldedEnglish.includes(token.toLocaleLowerCase("en"))
    )
  ) {
    issues.push("latin-writer-identity-omitted");
  }

  return [...new Set(issues)];
}

export function assertWriterBiographyEnglishQa(input) {
  const issues = writerBiographyEnglishQaIssues(input);
  if (issues.length) {
    const missingLatin = writerBiographyMissingProtectedLatinTokens(
      input?.sourceText,
      input?.englishText
    );
    throw new Error(
      `English biography QA failed: ${issues.join(", ")}${
        missingLatin.length
          ? `; missing protected Latin tokens: ${missingLatin.join(", ")}`
          : ""
      }`
    );
  }
  return normalizedText(input.englishText);
}

function sentenceBodies(value) {
  const text = normalizedText(value);
  let cursor = 0;
  return writerBiographySentenceEnds(text)
    .map((match) => {
      const end = (match.index || 0) + match[0].length;
      const sentence = text.slice(cursor, end);
      cursor = end;
      return sentence
        .toLocaleLowerCase("ru")
        .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
        .trim();
    })
    .filter(Boolean);
}

function wordSet(value) {
  return new Set(value.split(/\s+/u).filter((token) => token.length >= 3));
}

function jaccardSimilarity(left, right) {
  const leftWords = wordSet(left);
  const rightWords = wordSet(right);
  const union = new Set([...leftWords, ...rightWords]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of leftWords) {
    if (rightWords.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

export function writerBiographyRussianEditorialQaIssues(input) {
  const sourceText = normalizedText(input?.sourceText);
  const allowedContext = normalizedText(input?.allowedContext);
  const russianText = normalizedText(input?.russianText);
  const writerName = normalizedText(input?.writerName);
  const issues = [];
  if (!sourceText) issues.push("missing-source-text");
  if (!russianText) return [...issues, "missing-russian-text"];
  if (russianText.length < 120 || russianText.length > 1_600) {
    issues.push("russian-length-out-of-range");
  }
  const sentences = sentenceBodies(russianText);
  if (sentences.length < 2 || sentences.length > 4) {
    issues.push("russian-sentence-count-out-of-range");
  }
  if (!CYRILLIC_PATTERN.test(russianText)) {
    issues.push("russian-has-no-cyrillic");
  }
  if (FORBIDDEN_OUTPUT_PATTERN.test(russianText)) {
    issues.push("russian-contains-model-or-markup-artifact");
  }
  if (SOURCE_NARRATION_PATTERN.test(russianText)) {
    issues.push("russian-contains-source-narration");
  }
  if (/https?:\/\//iu.test(russianText)) {
    issues.push("russian-contains-source-url");
  }

  if (writerName) {
    const sameScriptIdentityTokens = [
      ...writerName.matchAll(/[\p{Letter}\p{M}'’-]+/gu),
    ]
      .map((match) => match[0])
      .filter((token) => token.length >= 3)
      .filter(
        (token) =>
          (CYRILLIC_PATTERN.test(token) && CYRILLIC_PATTERN.test(russianText)) ||
          (/\p{Script=Latin}/u.test(token) && /\p{Script=Latin}/u.test(russianText))
      );
    const foldedRussian = russianText.toLocaleLowerCase("ru");
    const exactIdentityPresent = sameScriptIdentityTokens.some((token) =>
      foldedRussian.includes(token.toLocaleLowerCase("ru"))
    );
    const explicitOpeningName =
      /^[\p{Lu}][\p{Ll}\p{M}'’-]+(?:\s+[\p{Lu}][\p{Ll}\p{M}'’-]+){0,4}(?:\s+\([^)]{1,40}\))?\s+(?:-|был(?:а)?\b|является\b)/u.test(
        russianText
      );
    if (!exactIdentityPresent && !explicitOpeningName) {
      issues.push("russian-writer-identity-omitted");
    }
  }
  for (let index = 0; index < sentences.length; index += 1) {
    for (let other = index + 1; other < sentences.length; other += 1) {
      if (
        sentences[index] === sentences[other] ||
        jaccardSimilarity(sentences[index], sentences[other]) >= 0.72
      ) {
        issues.push("russian-contains-repeated-sentence");
      }
    }
  }

  const sourceNumbers = writerBiographyNumberTokens(sourceText);
  const allowedNumbers = new Set(
    writerBiographyNumberTokens(`${sourceText} ${allowedContext}`)
  );
  const outputNumbers = writerBiographyNumberTokens(russianText);
  if (sourceNumbers.some((token) => !outputNumbers.includes(token))) {
    issues.push("russian-source-number-omitted");
  }
  if (outputNumbers.some((token) => !allowedNumbers.has(token))) {
    issues.push("russian-unreviewed-number-added");
  }

  const sourceQuotes = writerBiographyQuotedSpans(sourceText);
  const allowedQuoteCount = writerBiographyQuotedSpans(
    `${sourceText} ${allowedContext}`
  ).length;
  const outputQuoteCount = writerBiographyQuotedSpans(russianText).length;
  if (outputQuoteCount < sourceQuotes.length) {
    issues.push("russian-source-work-omitted");
  }
  if (outputQuoteCount > allowedQuoteCount) {
    issues.push("russian-unreviewed-work-added");
  }

  return [...new Set(issues)];
}

export function assertWriterBiographyRussianEditorialQa(input) {
  const issues = writerBiographyRussianEditorialQaIssues(input);
  if (issues.length) {
    throw new Error(`Russian biography QA failed: ${issues.join(", ")}`);
  }
  return normalizedText(input.russianText);
}
