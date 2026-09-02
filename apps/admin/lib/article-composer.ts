export type ArticleComposerLocale = "ru" | "en";

export type ArticleMetadataDraft = {
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogTitle: string;
  ogDescription: string;
};

export const ARTICLE_METADATA_DRAFT_FIELDS = [
  "excerpt",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "ogTitle",
  "ogDescription",
] as const satisfies readonly (keyof ArticleMetadataDraft)[];

export type ArticleMetadataDraftField =
  (typeof ARTICLE_METADATA_DRAFT_FIELDS)[number];

export type ArticleMetadataAutomationState = {
  lastApplied: ArticleMetadataDraft;
  managed: Record<ArticleMetadataDraftField, boolean>;
};

const namedEntities: Readonly<Record<string, string>> = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  lt: "<",
  mdash: "-",
  nbsp: " ",
  ndash: "-",
  quot: '"',
  raquo: "»",
});

const placeholderPatterns = [
  /(?:^|[.!?]\s+)замените (?:этот )?текст(?:[^.!?]*[.!?]?)/giu,
  /(?:^|[.!?]\s+)(?:введите|вставьте)(?: подготовленный)? текст(?:[^.!?]*[.!?]?)/giu,
  /(?:^|[.!?]\s+)добавьте (?:текст|описание)(?:[^.!?]*[.!?]?)/giu,
  /(?:^|[.!?]\s+)нажмите на квадрат(?:[^.!?]*[.!?]?)/giu,
  /(?:^|[.!?]\s+)replace this text(?:[^.!?]*[.!?]?)/giu,
  /(?:^|[.!?]\s+)enter (?:your )?text(?:[^.!?]*[.!?]?)/giu,
  /(?:^|[.!?]\s+)add (?:text|description)(?:[^.!?]*[.!?]?)/giu,
];

const keywordStopWords: Record<ArticleComposerLocale, ReadonlySet<string>> = {
  ru: new Set([
    "этот", "эта", "это", "эти", "того", "чтобы", "который", "которая",
    "которые", "своего", "своей", "после", "перед", "через", "также",
    "только", "может", "были", "было", "будет", "статья", "материал",
  ]),
  en: new Set([
    "this", "that", "these", "those", "with", "from", "into", "about",
    "after", "before", "their", "there", "which", "article", "material",
  ]),
};

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z][\da-z]+));/giu,
    (entity, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
      if (named) return namedEntities[named.toLocaleLowerCase("en-US")] ?? entity;
      const codePoint = Number.parseInt(decimal ?? hexadecimal ?? "", hexadecimal ? 16 : 10);
      if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return "";
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return "";
      }
    }
  );
}

export function articleComposerPlainText(value: string) {
  let text = String(value || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<\/?[^>]+>/gu, " ");
  text = decodeHtmlEntities(text);
  for (const pattern of placeholderPatterns) text = text.replace(pattern, " ");
  return text.replace(/[\u0000-\u001f\u007f]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function truncateAtWord(value: string, maximum: number) {
  const text = articleComposerPlainText(value);
  if (text.length <= maximum) return text;
  const textBudget = Math.max(1, maximum - 1);
  const candidate = text.slice(0, textBudget + 1);
  const boundary = Math.max(candidate.lastIndexOf(" "), candidate.lastIndexOf("-"));
  const truncated = (boundary >= Math.floor(maximum * 0.6) ? candidate.slice(0, boundary) : text.slice(0, textBudget))
    .replace(/[-\s,;:]+$/gu, "")
    .trim();
  return `${truncated}…`;
}

function keywordList(
  title: string,
  subtitle: string,
  content: string,
  locale: ArticleComposerLocale
) {
  const weights = new Map<string, { score: number; order: number }>();
  let order = 0;
  const add = (value: string, weight: number) => {
    const words = articleComposerPlainText(value)
      .toLocaleLowerCase(locale === "ru" ? "ru-RU" : "en-US")
      .match(/[\p{L}\p{N}]{4,}/gu) || [];
    for (const word of words) {
      if (keywordStopWords[locale].has(word)) continue;
      const current = weights.get(word);
      if (current) current.score += weight;
      else weights.set(word, { score: weight, order: order++ });
    }
  };
  add(title, 5);
  add(subtitle, 3);
  add(content, 1);
  return [...weights.entries()]
    .sort((left, right) =>
      right[1].score - left[1].score || left[1].order - right[1].order
    )
    .slice(0, 8)
    .map(([word]) => word)
    .join(", ");
}

export function buildArticleMetadataDraft({
  title,
  subtitle = "",
  contentHtml,
  locale,
}: {
  title: string;
  subtitle?: string;
  contentHtml: string;
  locale: ArticleComposerLocale;
}): ArticleMetadataDraft {
  const cleanTitle = articleComposerPlainText(title);
  const cleanSubtitle = articleComposerPlainText(subtitle);
  const cleanContent = articleComposerPlainText(contentHtml);
  const fallback = locale === "en" ? "Literary article" : "Литературная статья";
  const titleSource = cleanTitle || cleanSubtitle || fallback;
  const subtitleLead = /[.!?…:]$/u.test(cleanSubtitle)
    ? cleanSubtitle
    : `${cleanSubtitle.replace(/[-,;]+$/gu, "")}.`;
  const descriptionSource =
    cleanSubtitle && cleanContent
      ? `${subtitleLead} ${cleanContent}`
      : cleanSubtitle || cleanContent || cleanTitle;
  const excerpt = truncateAtWord(descriptionSource, 260);
  const seoDescription = truncateAtWord(descriptionSource, 180);
  const metadataTitle = truncateAtWord(titleSource, 180);

  return {
    excerpt,
    seoTitle: metadataTitle,
    seoDescription,
    seoKeywords: keywordList(cleanTitle, cleanSubtitle, cleanContent, locale),
    ogTitle: metadataTitle,
    ogDescription: excerpt,
  };
}

/**
 * Completes only empty metadata fields. The server uses the same rule so a
 * quick submit cannot race the client's debounced composer, while deliberate
 * editor wording remains authoritative.
 */
export function completeArticleMetadataDraft(
  current: ArticleMetadataDraft,
  generated: ArticleMetadataDraft
): ArticleMetadataDraft {
  return Object.fromEntries(
    ARTICLE_METADATA_DRAFT_FIELDS.map((field) => [
      field,
      current[field].trim() ? current[field] : generated[field],
    ])
  ) as ArticleMetadataDraft;
}

export function createArticleMetadataAutomationState(
  current: ArticleMetadataDraft,
  managePopulatedFields = false
): ArticleMetadataAutomationState {
  return {
    lastApplied: { ...current },
    managed: Object.fromEntries(
      ARTICLE_METADATA_DRAFT_FIELDS.map((field) => [
        field,
        managePopulatedFields || !current[field].trim(),
      ])
    ) as Record<ArticleMetadataDraftField, boolean>,
  };
}

export function markArticleMetadataFieldManual(
  state: ArticleMetadataAutomationState,
  field: ArticleMetadataDraftField
): ArticleMetadataAutomationState {
  return {
    ...state,
    managed: { ...state.managed, [field]: false },
  };
}

/**
 * Updates only fields still owned by the automatic composer. Persisted or
 * manually edited values are never inferred as generated merely because they
 * happen to equal the generated text.
 */
export function synchronizeArticleMetadataDraft(
  current: ArticleMetadataDraft,
  generated: ArticleMetadataDraft,
  state: ArticleMetadataAutomationState
) {
  const draft = { ...current };
  const managed = { ...state.managed };

  for (const field of ARTICLE_METADATA_DRAFT_FIELDS) {
    if (!managed[field]) continue;
    if (current[field] !== state.lastApplied[field]) {
      managed[field] = false;
      continue;
    }
    draft[field] = generated[field];
  }

  return {
    draft,
    changed: ARTICLE_METADATA_DRAFT_FIELDS.some(
      (field) => draft[field] !== current[field]
    ),
    state: {
      lastApplied: { ...generated },
      managed,
    } satisfies ArticleMetadataAutomationState,
  };
}
