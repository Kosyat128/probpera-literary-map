export const articleTextTones = [
  {
    id: "garnet",
    label: "Гранатовый",
    readerColor: "#852744",
    editorColor: "#ffb0c4",
    contrastRatio: 7.01,
  },
  {
    id: "coral",
    label: "Коралловый",
    readerColor: "#702b25",
    editorColor: "#ffb4a8",
    contrastRatio: 8.06,
  },
  {
    id: "rose",
    label: "Пыльная роза",
    readerColor: "#742447",
    editorColor: "#ffafd2",
    contrastRatio: 7.97,
  },
  {
    id: "berry",
    label: "Ягодный",
    readerColor: "#682653",
    editorColor: "#f4b4df",
    contrastRatio: 8.35,
  },
  {
    id: "plum",
    label: "Сливовый",
    readerColor: "#5d2b60",
    editorColor: "#e8b6eb",
    contrastRatio: 8.4,
  },
  {
    id: "violet",
    label: "Фиалковый",
    readerColor: "#4e3470",
    editorColor: "#d8c1ff",
    contrastRatio: 8.11,
  },
  {
    id: "indigo",
    label: "Чернильный",
    readerColor: "#48376e",
    editorColor: "#c9c8ff",
    contrastRatio: 8.12,
  },
  {
    id: "navy",
    label: "Ночной синий",
    readerColor: "#263f6a",
    editorColor: "#b8d0ff",
    contrastRatio: 8.31,
  },
  {
    id: "cobalt",
    label: "Кобальтовый",
    readerColor: "#164c70",
    editorColor: "#9ed4ff",
    contrastRatio: 7.22,
  },
  {
    id: "ocean",
    label: "Океанический",
    readerColor: "#0b4c62",
    editorColor: "#8eddf4",
    contrastRatio: 7.47,
  },
  {
    id: "teal",
    label: "Бирюзовый",
    readerColor: "#074d49",
    editorColor: "#87e3d8",
    contrastRatio: 7.67,
  },
  {
    id: "emerald",
    label: "Изумрудный",
    readerColor: "#164f35",
    editorColor: "#8ce3b5",
    contrastRatio: 7.54,
  },
  {
    id: "forest",
    label: "Лесной",
    readerColor: "#1b5038",
    editorColor: "#a7e4bc",
    contrastRatio: 7.38,
  },
  {
    id: "olive",
    label: "Оливковый",
    readerColor: "#414b12",
    editorColor: "#d5dd86",
    contrastRatio: 7.42,
  },
  {
    id: "moss",
    label: "Моховой",
    readerColor: "#3a491f",
    editorColor: "#c7dc9b",
    contrastRatio: 7.72,
  },
  {
    id: "ochre",
    label: "Охристый",
    readerColor: "#5d3c00",
    editorColor: "#f0cf79",
    contrastRatio: 7.87,
  },
  {
    id: "amber",
    label: "Янтарный",
    readerColor: "#674005",
    editorColor: "#f5ca80",
    contrastRatio: 7.19,
  },
  {
    id: "bronze",
    label: "Бронзовый",
    readerColor: "#65411f",
    editorColor: "#efc399",
    contrastRatio: 7.14,
  },
  {
    id: "umber",
    label: "Умбровый",
    readerColor: "#593927",
    editorColor: "#e4c2aa",
    contrastRatio: 8.15,
  },
  {
    id: "cocoa",
    label: "Какао",
    readerColor: "#4e362f",
    editorColor: "#dcc5ba",
    contrastRatio: 8.78,
  },
  {
    id: "slate",
    label: "Сланцевый",
    readerColor: "#3e4856",
    editorColor: "#c4ced9",
    contrastRatio: 7.34,
  },
  {
    id: "steel",
    label: "Стальной",
    readerColor: "#3a4a57",
    editorColor: "#bcd3df",
    contrastRatio: 7.24,
  },
  {
    id: "graphite",
    label: "Графитовый",
    readerColor: "#41434a",
    editorColor: "#ced0d5",
    contrastRatio: 7.82,
  },
  {
    id: "charcoal",
    label: "Угольный",
    readerColor: "#34363b",
    editorColor: "#d9d9dc",
    contrastRatio: 9.57,
  },
] as const;

export type ArticleTextTone = (typeof articleTextTones)[number]["id"];

const articleTextToneIds = new Set<string>(
  articleTextTones.map((tone) => tone.id)
);

export function articleTextTone(value: unknown): ArticleTextTone | null {
  return typeof value === "string" && articleTextToneIds.has(value)
    ? (value as ArticleTextTone)
    : null;
}

export const articleTypographyScopes = [
  { id: "lead", label: "Лид" },
  { id: "quote", label: "Цитата" },
  { id: "caption", label: "Подпись" },
] as const;

export type ArticleTypographyScope = (typeof articleTypographyScopes)[number]["id"];
const articleTypographyScopeIds = new Set<string>(
  articleTypographyScopes.map((scope) => scope.id)
);

export function articleTypographyScope(value: unknown): ArticleTypographyScope | null {
  return typeof value === "string" && articleTypographyScopeIds.has(value)
    ? (value as ArticleTypographyScope)
    : null;
}

/**
 * Treat the JSON submitted by the browser as untrusted. Unknown Tiptap nodes
 * are intentionally preserved for backwards compatibility, but invalid
 * text-tone and semantic typography marks are removed so they can never become
 * arbitrary CSS escape hatches when a newer renderer opens the document.
 */
export function sanitizeArticleTextToneJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeArticleTextToneJson(item));
  }
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (key === "marks" && Array.isArray(child)) {
      next[key] = child.flatMap((mark) => {
        const sanitized = sanitizeArticleTextToneJson(mark);
        if (!sanitized || typeof sanitized !== "object") return [sanitized];
        const candidate = sanitized as Record<string, unknown>;
        if (candidate.type === "typographyScope") {
          const attrs = candidate.attrs;
          const scope = attrs && typeof attrs === "object"
            ? articleTypographyScope((attrs as Record<string, unknown>).scope)
            : null;
          return scope ? [{ type: "typographyScope", attrs: { scope } }] : [];
        }
        if (candidate.type !== "textTone") return [sanitized];
        const attrs = candidate.attrs;
        const tone =
          attrs && typeof attrs === "object"
            ? articleTextTone((attrs as Record<string, unknown>).tone)
            : null;
        return tone ? [{ type: "textTone", attrs: { tone } }] : [];
      });
      continue;
    }
    next[key] = sanitizeArticleTextToneJson(child);
  }
  return next;
}

export function safeTextToneSpanAttributes(
  attributes: Record<string, string>
) {
  const tone = articleTextTone(attributes["data-text-tone"]);
  const typographyScope = articleTypographyScope(
    attributes["data-typography-scope"]
  );
  const classNames = String(attributes.class || "")
    .split(/\s+/u)
    .filter(Boolean)
    .filter(
      (className) =>
        className !== "article-text-tone" &&
        !className.startsWith("is-tone-") &&
        className !== "article-typography-scope" &&
        !className.startsWith("is-scope-")
    );
  const next = { ...attributes };
  delete next["data-text-tone"];
  delete next["data-typography-scope"];
  if (!tone && !typographyScope) {
    if (classNames.length) next.class = classNames.join(" ");
    else delete next.class;
    return next;
  }
  const presentationClasses: string[] = [];
  if (tone) {
    next["data-text-tone"] = tone;
    presentationClasses.push("article-text-tone", `is-tone-${tone}`);
  }
  if (typographyScope) {
    next["data-typography-scope"] = typographyScope;
    presentationClasses.push(
      "article-typography-scope",
      `is-scope-${typographyScope}`
    );
  }
  next.class = presentationClasses.join(" ");
  return next;
}
