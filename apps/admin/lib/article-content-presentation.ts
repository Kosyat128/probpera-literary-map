export const articleTextTones = [
  {
    id: "garnet",
    label: "Гранатовый",
    readerColor: "#852744",
    editorColor: "#ff8fab",
    contrastRatio: 8.54,
  },
  {
    id: "forest",
    label: "Лесной",
    readerColor: "#235f42",
    editorColor: "#7fd9aa",
    contrastRatio: 7.26,
  },
  {
    id: "ocean",
    label: "Океанический",
    readerColor: "#145d75",
    editorColor: "#6fd3ee",
    contrastRatio: 7.1,
  },
  {
    id: "indigo",
    label: "Чернильный",
    readerColor: "#55437e",
    editorColor: "#c7b5ff",
    contrastRatio: 8.13,
  },
  {
    id: "amber",
    label: "Янтарный",
    readerColor: "#754b0a",
    editorColor: "#ffc56c",
    contrastRatio: 7.32,
  },
  {
    id: "slate",
    label: "Графитовый",
    readerColor: "#485466",
    editorColor: "#ccd5e1",
    contrastRatio: 7.4,
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

/**
 * Treat the JSON submitted by the browser as untrusted. Unknown Tiptap nodes
 * are intentionally preserved for backwards compatibility, but an invalid
 * text-tone mark is removed so it can never become an arbitrary CSS escape
 * hatch when the document is opened by a newer renderer.
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
  const classNames = String(attributes.class || "")
    .split(/\s+/u)
    .filter(Boolean)
    .filter(
      (className) =>
        className !== "article-text-tone" && !className.startsWith("is-tone-")
    );
  const next = { ...attributes };
  delete next["data-text-tone"];
  if (!tone) {
    if (classNames.length) next.class = classNames.join(" ");
    else delete next.class;
    return next;
  }
  next["data-text-tone"] = tone;
  next.class = `article-text-tone is-tone-${tone}`;
  return next;
}
