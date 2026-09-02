import * as cheerio from "cheerio";

export function normalizeArticleBookText(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/°/gu, " градус ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function stripArticleBookHeading(value = "") {
  return String(value)
    .replace(/^\s*\d+(?:[.)]\s*|\s+)/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function cleanArticleBookCatalogText(value = "") {
  return stripArticleBookHeading(value)
    .replace(/\s*\([^)]*(?:18|19|20)\d{2}[^)]*\)\s*$/u, "")
    .replace(/^[«“"]|[»”"]$/gu, "")
    .trim();
}

export function parseArticleBookNovelHeading(value) {
  const heading = stripArticleBookHeading(value);
  let match = heading.match(/^(.+?)\s+[-]\s+(.+)$/u);
  if (match) {
    const [, first, second] = match;
    if (/^[«“"]/.test(first)) {
      return {
        author: second.trim(),
        title: first.replace(/^[«“"]|[»”"]$/gu, "").trim(),
      };
    }
    return { author: first.trim(), title: second.trim() };
  }

  match = heading.match(/^(.+?)\s+[«“"](.+?)[»”"]$/u);
  if (match) return { author: match[1].trim(), title: match[2].trim() };

  match = heading.match(/^[«“"](.+?)[»”"]\s*,\s*(.+)$/u);
  if (match) return { author: match[2].trim(), title: match[1].trim() };

  return null;
}

export function parseArticleBookCatalogHeading(value) {
  const heading = stripArticleBookHeading(value).replace(
    /\s*\([^)]*(?:18|19|20)\d{2}[^)]*\)\s*$/u,
    ""
  );
  let match = heading.match(/^[«“"](.+?)[»”"]\s*[-]\s*(.+)$/u);
  if (match) return { title: match[1].trim(), author: match[2].trim() };
  match = heading.match(/^[«“"](.+?)[»”"]\s*,\s*(.+)$/u);
  if (match) return { title: match[1].trim(), author: match[2].trim() };
  match = heading.match(/^(.+?)\s*[-]\s*[«“"](.+?)[»”"]$/u);
  if (match) return { title: match[2].trim(), author: match[1].trim() };
  match = heading.match(/^(.+?)\s*[-]\s*(.+)$/u);
  if (match && !/\d{4}/u.test(match[1])) {
    return { title: match[1].trim(), author: match[2].trim() };
  }
  return { title: cleanArticleBookCatalogText(heading), author: "" };
}

export function quotedArticleBookTitle(value = "") {
  return String(value).match(/[«“"](.+?)[»”"]/u)?.[1]?.trim() || "";
}

function canonicalArticleIdentity(article) {
  return article.legacyId || article.id || "";
}

function normalizedSynopsisHeading(value = "") {
  return String(value)
    .replace(/C/gu, "С")
    .replace(/c/gu, "с")
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

function sectionTextAfterHeading($, heading) {
  if (!heading) return "";
  const parts = [];
  let current = $(heading).next();
  while (
    current.length &&
    !/^h[23]$/iu.test(current[0]?.tagName || "")
  ) {
    if (!/^(?:figure|figcaption|img|meta)$/iu.test(current[0]?.tagName || "")) {
      const clone = current.clone();
      clone.find("figure, figcaption, img, meta").remove();
      const text = clone.text().replace(/\s+/gu, " ").trim();
      if (text) parts.push(text);
    }
    current = current.next();
  }
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function primarySynopsisHeading($) {
  return $("h2, h3")
    .toArray()
    .find((element) => {
      const label = normalizedSynopsisHeading($(element).text());
      return (
        !/(?:экранизац|фильм|кино)/iu.test(label) &&
        /(?:синопсис|о чем книга)/iu.test(label)
      );
    });
}

function occurrenceBase(article, kind) {
  return {
    kind,
    articleId: canonicalArticleIdentity(article),
    cmsArticleId: article.id || "",
    articleTitle: article.title || "",
    articleUrl: article.canonicalUrl || article.url || article.sourceUrl || "",
  };
}

function occurrenceFromHeading($, article, heading, parsed, kind) {
  return {
    ...parsed,
    ...occurrenceBase(article, kind),
    headingId: $(heading).attr("id") || "",
    headingText: $(heading).text().replace(/\s+/gu, " ").trim(),
    excerptText: sectionTextAfterHeading($, heading),
  };
}

export function extractArticleBookCandidates(article) {
  const identity = canonicalArticleIdentity(article);
  if (!article?.contentHtml || !article?.title || !identity) return [];

  const $ = cheerio.load(article.contentHtml);
  const headings = $("h2, h3").toArray();
  const candidates = [];

  if (identity.includes("--topbooks--")) {
    for (const heading of headings) {
      const parsed = parseArticleBookNovelHeading($(heading).text());
      if (parsed) {
        candidates.push(
          occurrenceFromHeading($, article, heading, parsed, "novel")
        );
      }
    }
  }

  if (identity.includes("--topstories--")) {
    const author = article.title
      .replace(/^.*каждому!\s*/iu, "")
      .replace(/\s*\(.*$/u, "")
      .trim();
    for (const heading of headings) {
      const title = stripArticleBookHeading($(heading).text()).replace(
        /^[«“"]|[»”"]$/gu,
        ""
      );
      if (!title || /^(?:предисловие|заключение)$/iu.test(title)) continue;
      candidates.push(
        occurrenceFromHeading(
          $,
          article,
          heading,
          { author, title },
          "short-story"
        )
      );
    }
  }

  const isCatalogList =
    identity.includes("--top--books--page--turners--") ||
    identity.includes("--luchshie--bestselleri--21--veka--") ||
    identity.includes("--knigniy--gid--") ||
    identity.includes("--luchshie--knigi--pisateley--");

  if (isCatalogList) {
    for (const heading of headings) {
      const headingText = $(heading).text().replace(/\s+/gu, " ").trim();
      if (/^(?:предисловие|заключение)$/iu.test(headingText)) continue;
      const pirateMatch = identity.includes("--knigniy--gid--")
        ? stripArticleBookHeading(headingText).match(
            /^(.+?)\s*[-]\s*[«“"](.+?)[»”"]/u
          )
        : null;
      const jackLondonTitle = identity.includes(
        "--luchshie--knigi--pisateley--"
      )
        ? quotedArticleBookTitle(headingText)
        : "";
      const parsed = pirateMatch
        ? { author: pirateMatch[1].trim(), title: pirateMatch[2].trim() }
        : jackLondonTitle
          ? { author: "Джек Лондон", title: jackLondonTitle }
          : parseArticleBookCatalogHeading(headingText);
      if (!parsed.title) continue;
      const author = identity.includes("--luchshie--knigi--pisateley--")
        ? "Джек Лондон"
        : parsed.author;
      candidates.push(
        occurrenceFromHeading(
          $,
          article,
          heading,
          { author, title: parsed.title },
          "catalog"
        )
      );
    }
  }

  const isPrimaryBookArticle =
    identity.includes("--page--books--") ||
    identity.includes("--page--bookvsmovie--");
  if (isPrimaryBookArticle) {
    const title = quotedArticleBookTitle(article.title);
    if (title) {
      const heading = primarySynopsisHeading($);
      candidates.push({
        author: "",
        title,
        ...occurrenceBase(article, "primary"),
        headingId: heading ? $(heading).attr("id") || "" : "",
        headingText: heading
          ? $(heading).text().replace(/\s+/gu, " ").trim()
          : "",
        excerptText: sectionTextAfterHeading($, heading),
      });
    }
  }

  return candidates;
}

export function consolidateArticleBookCandidates(candidates) {
  const byTitle = new Map();
  for (const candidate of candidates) {
    const key = normalizeArticleBookText(candidate.title);
    if (!key) continue;
    const group = byTitle.get(key) || [];
    group.push(candidate);
    byTitle.set(key, group);
  }

  const pairs = [];
  for (const [normalizedTitle, occurrences] of byTitle) {
    const authored = new Map();
    for (const occurrence of occurrences) {
      const normalizedAuthor = normalizeArticleBookText(occurrence.author);
      if (!normalizedAuthor) continue;
      const group = authored.get(normalizedAuthor) || [];
      group.push(occurrence);
      authored.set(normalizedAuthor, group);
    }

    if (authored.size <= 1) {
      const representative =
        occurrences.find((item) => item.author?.trim()) || occurrences[0];
      pairs.push({
        ...representative,
        normalizedTitle,
        normalizedAuthor: normalizeArticleBookText(representative.author),
        occurrences,
        sourceAuthorAmbiguous: false,
      });
      continue;
    }

    for (const [normalizedAuthor, authorOccurrences] of authored) {
      const blankOccurrences = occurrences.filter(
        (item) => !normalizeArticleBookText(item.author)
      );
      pairs.push({
        ...authorOccurrences[0],
        normalizedTitle,
        normalizedAuthor,
        occurrences: [...authorOccurrences, ...blankOccurrences],
        sourceAuthorAmbiguous: blankOccurrences.length > 0,
      });
    }
  }

  return pairs;
}

export function candidateWriterScore(candidate, writerName) {
  const wanted = normalizeArticleBookText(candidate)
    .split(" ")
    .filter((part) => part.length > 1);
  const actual = normalizeArticleBookText(writerName)
    .split(" ")
    .filter((part) => part.length > 1);
  if (!wanted.length || !actual.length) return 0;
  const exact =
    normalizeArticleBookText(candidate) ===
    normalizeArticleBookText(writerName);
  const surname = wanted.at(-1);
  const surnameMatch = actual.includes(surname);
  const shared = wanted.filter((part) => actual.includes(part)).length;
  return (exact ? 100 : 0) + (surnameMatch ? 20 : 0) + shared;
}

export function articleBookRecordKey(book) {
  return `${book.countryId}:${book.writerId}:${book.id}`;
}

function articleBookWriterKey(value) {
  return `${value.countryId}:${value.writerId}`;
}

export function buildArticleBookWriterIdentityAliasMap(records = []) {
  if (!Array.isArray(records)) {
    throw new TypeError("Article-book writer identity aliases must be an array");
  }

  const aliases = new Map();
  for (const record of records) {
    const aliasWriterKey = record?.aliasWriterKey?.trim();
    const canonicalWriterKey = record?.canonicalWriterKey?.trim();
    if (!aliasWriterKey || !canonicalWriterKey) {
      throw new Error("Writer identity alias keys are required");
    }
    if (aliasWriterKey === canonicalWriterKey) {
      throw new Error(
        `Writer identity alias cannot point to itself: ${aliasWriterKey}`
      );
    }
    if (
      !/^\w[^:]*:[^:]+$/u.test(aliasWriterKey) ||
      !/^\w[^:]*:[^:]+$/u.test(canonicalWriterKey)
    ) {
      throw new Error(
        `Invalid writer identity alias key: ${aliasWriterKey} -> ${canonicalWriterKey}`
      );
    }
    if (
      !record.reviewedAt ||
      !Array.isArray(record.evidence) ||
      record.evidence.length < 2 ||
      record.evidence.some(
        (source) =>
          !source?.provider?.trim() ||
          !/^https:\/\//u.test(source?.url || "") ||
          !source?.finding?.trim()
      )
    ) {
      throw new Error(
        `Writer identity alias lacks reviewed evidence: ${aliasWriterKey}`
      );
    }
    const existing = aliases.get(aliasWriterKey);
    if (existing && existing !== canonicalWriterKey) {
      throw new Error(
        `Conflicting writer identity aliases for ${aliasWriterKey}`
      );
    }
    aliases.set(aliasWriterKey, canonicalWriterKey);
  }

  for (const aliasWriterKey of aliases.keys()) {
    const seen = new Set();
    let current = aliasWriterKey;
    while (aliases.has(current)) {
      if (seen.has(current)) {
        throw new Error(`Cyclic writer identity alias: ${aliasWriterKey}`);
      }
      seen.add(current);
      current = aliases.get(current);
    }
  }
  return aliases;
}

function canonicalArticleBookWriterKey(writerKey, aliases) {
  let current = writerKey;
  const seen = new Set();
  while (aliases?.has(current) && !seen.has(current)) {
    seen.add(current);
    current = aliases.get(current);
  }
  return current;
}

function reviewedCanonicalAuthorWorkMatch(matches, aliases) {
  if (!aliases?.size || matches.length < 2) return null;
  const canonicalKeys = new Set(
    matches.map((book) =>
      canonicalArticleBookWriterKey(articleBookWriterKey(book), aliases)
    )
  );
  if (canonicalKeys.size !== 1) return null;

  const canonicalWriterKey = [...canonicalKeys][0];
  const canonicalMatches = matches.filter(
    (book) => articleBookWriterKey(book) === canonicalWriterKey
  );
  const aliasWasUsed = matches.some(
    (book) => articleBookWriterKey(book) !== canonicalWriterKey
  );
  return aliasWasUsed && canonicalMatches.length === 1
    ? canonicalMatches[0]
    : null;
}

function publicBookMatch(book) {
  return {
    recordKey: articleBookRecordKey(book),
    countryId: book.countryId,
    writerId: book.writerId,
    writerName: book.writerName,
    bookId: book.id,
    title: book.title,
  };
}

export function buildArticleBookAliasIndex(archive) {
  const index = new Map();
  for (const book of archive) {
    const seen = new Set();
    for (const title of [
      book.title,
      book.originalTitle,
      ...(book.alternateTitles || []),
    ]) {
      const key = normalizeArticleBookText(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const matches = index.get(key) || [];
      if (
        !matches.some(
          (candidate) =>
            articleBookRecordKey(candidate) === articleBookRecordKey(book)
        )
      ) {
        matches.push(book);
      }
      index.set(key, matches);
    }
  }
  return index;
}

function bookAuthorScore(candidateAuthor, book) {
  return Math.max(
    candidateWriterScore(candidateAuthor, book.writerName),
    candidateWriterScore(candidateAuthor, book.writer?.name),
    candidateWriterScore(candidateAuthor, book.writer?.fullName)
  );
}

function rankedWriters(candidateAuthor, writers) {
  return writers
    .map((writer) => ({
      writer,
      score: candidateWriterScore(candidateAuthor, writer.writerName),
    }))
    .filter(({ score }) => score >= 20)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.writer.countryId.localeCompare(second.writer.countryId, "en") ||
        first.writer.writerId.localeCompare(second.writer.writerId, "en")
    );
}

export function resolveArticleBookCandidate(
  candidate,
  { aliasIndex, writers, writerIdentityAliases = new Map() }
) {
  const titleMatches = [
    ...(aliasIndex.get(normalizeArticleBookText(candidate.title)) || []),
  ];
  const hasAuthor = Boolean(normalizeArticleBookText(candidate.author));
  const authorTitleMatches = hasAuthor
    ? titleMatches.filter((book) => bookAuthorScore(candidate.author, book) >= 20)
    : titleMatches;
  const ranked = hasAuthor ? rankedWriters(candidate.author, writers) : [];
  const topWriterScore = ranked[0]?.score || 0;
  const topWriters = ranked.filter(({ score }) => score === topWriterScore);
  const collisionReasonCodes = [];

  if (titleMatches.length > 1) {
    const authorIdentities = new Set(
      titleMatches.map(
        (book) =>
          normalizeArticleBookText(book.writerName) ||
          normalizeArticleBookText(book.writer?.name) ||
          normalizeArticleBookText(book.writer?.fullName) ||
          normalizeArticleBookText(book.writerId)
      )
    );
    collisionReasonCodes.push(
      authorIdentities.size > 1
        ? "same-title-multiple-authors"
        : "duplicate-author-work-records"
    );
  }
  if (hasAuthor && titleMatches.length && !authorTitleMatches.length) {
    collisionReasonCodes.push("wrong-author-title-collision");
  }

  if (authorTitleMatches.length === 1) {
    const book = authorTitleMatches[0];
    return {
      status: "covered",
      covered: true,
      book,
      recordKey: articleBookRecordKey(book),
      writer: {
        countryId: book.countryId,
        writerId: book.writerId,
        writerName: book.writerName,
      },
      writerMatchAmbiguous: false,
      workMatchAmbiguous: false,
      titleMatches: titleMatches.map(publicBookMatch),
      authorTitleMatches: authorTitleMatches.map(publicBookMatch),
      collisionReasonCodes,
    };
  }

  if (authorTitleMatches.length > 1) {
    const canonicalBook = reviewedCanonicalAuthorWorkMatch(
      authorTitleMatches,
      writerIdentityAliases
    );
    if (canonicalBook) {
      collisionReasonCodes.push("canonical-writer-alias-resolved");
      return {
        status: "covered",
        covered: true,
        book: canonicalBook,
        recordKey: articleBookRecordKey(canonicalBook),
        writer: {
          countryId: canonicalBook.countryId,
          writerId: canonicalBook.writerId,
          writerName: canonicalBook.writerName,
        },
        writerMatchAmbiguous: false,
        workMatchAmbiguous: false,
        titleMatches: titleMatches.map(publicBookMatch),
        authorTitleMatches: authorTitleMatches.map(publicBookMatch),
        collisionReasonCodes,
      };
    }
    return {
      status: "ambiguous",
      covered: false,
      book: null,
      recordKey: "",
      writer: topWriters.length === 1 ? topWriters[0].writer : null,
      writerMatchAmbiguous: topWriters.length > 1,
      workMatchAmbiguous: true,
      titleMatches: titleMatches.map(publicBookMatch),
      authorTitleMatches: authorTitleMatches.map(publicBookMatch),
      collisionReasonCodes,
    };
  }

  if (!hasAuthor && titleMatches.length > 1) {
    if (!collisionReasonCodes.includes("source-author-missing")) {
      collisionReasonCodes.push("source-author-missing");
    }
    return {
      status: "ambiguous",
      covered: false,
      book: null,
      recordKey: "",
      writer: null,
      writerMatchAmbiguous: true,
      workMatchAmbiguous: true,
      titleMatches: titleMatches.map(publicBookMatch),
      authorTitleMatches: titleMatches.map(publicBookMatch),
      collisionReasonCodes,
    };
  }

  const intendedWriter = topWriters.length === 1 ? topWriters[0].writer : null;
  return {
    status: intendedWriter ? "missing" : "unmatched-writer",
    covered: false,
    book: null,
    recordKey: "",
    writer: intendedWriter,
    writerMatchAmbiguous: topWriters.length > 1,
    workMatchAmbiguous: false,
    titleMatches: titleMatches.map(publicBookMatch),
    authorTitleMatches: [],
    collisionReasonCodes,
  };
}
