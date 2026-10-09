import type { JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { z } from "zod";
import type { ArticlePendingOperationReference } from "./article-pending-operation";
import { recoveryCopyOwnerState } from "./editor-recovery-owner";
import { assertEditorialMediaIdentityParity, normalizeAuthoritativeMediaId } from "./editorial-media-identity";

const textFields = [
  "title", "subtitle", "excerpt", "slug", "categoryId", "contentHtml", "contentJson",
  "scheduledAt", "coverUrl", "coverAlt", "seoTitle", "seoDescription", "seoKeywords",
  "canonicalUrl", "ogTitle", "ogDescription", "sourceText", "bibliographyText", "legacyPath",
] as const;
const booleanFields = [
  "slugEdited", "featured", "showOnHomepage", "pinned", "canonicalEdited",
  "allowIndexing", "russianSourceChanged",
] as const;
const englishTextFields = [
  "title", "subtitle", "excerpt", "slug", "contentHtml", "contentJson", "coverAlt",
  "seoTitle", "seoDescription", "seoKeywords", "canonicalUrl", "ogTitle", "ogDescription",
  "sourceText", "bibliographyText",
] as const;
const englishBooleanFields = ["enabled", "slugEdited", "canonicalEdited", "confirmedCurrentSource"] as const;
const articleStatuses = ["draft", "review", "scheduled", "published", "hidden", "archived"] as const;
const englishStatuses = ["draft", "review", "approved", "published", "stale", "archived"] as const;

export type ArticleRecoverySnapshot = {
  version: 2;
  activeLocale: "ru" | "en";
  status: string;
  english: Record<typeof englishTextFields[number], string>
    & Record<typeof englishBooleanFields[number], boolean>
    & { status: typeof englishStatuses[number] };
  savedAt?: number;
  reason?: string;
  /** A recovery locator, never a server acknowledgement. */
  pendingArticleOperation?: ArticlePendingOperationReference;
  recoveryActorId?: string;
} & Record<typeof textFields[number], string> & Record<typeof booleanFields[number], boolean>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const ownType = (value: Record<string, unknown>, keys: readonly string[], type: string) =>
  keys.every(key => Object.hasOwn(value, key) && typeof value[key] === type);
const metadata = (value: Record<string, unknown>) =>
  (!Object.hasOwn(value, "savedAt") || typeof value.savedAt === "number" && Number.isFinite(value.savedAt))
  && (!Object.hasOwn(value, "reason") || typeof value.reason === "string")
  && recoveryCopyOwnerState(value) !== "invalid";

function fullSnapshot(value: unknown): value is ArticleRecoverySnapshot {
  return record(value) && value.version === 2 && (value.activeLocale === "ru" || value.activeLocale === "en")
    && ownType(value, textFields, "string") && ownType(value, booleanFields, "boolean")
    && articleStatuses.some(status => status === value.status) && metadata(value)
    && record(value.english) && ownType(value.english, englishTextFields, "string")
    && ownType(value.english, englishBooleanFields, "boolean")
    && englishStatuses.some(status => status === (value.english as Record<string, unknown>).status);
}

/** Reject JSON that ProseMirror would silently discard, including rights/source attributes. */
function preserved(original: unknown, parsed: unknown): boolean {
  if (!record(original) || !record(parsed)) return false;
  return Object.entries(original).every(([key, value]) => {
    if (key === "attrs") return value === null || record(value) && record(parsed.attrs)
      && Object.entries(value).every(([name, item]) => Object.hasOwn(parsed.attrs as object, name)
        && JSON.stringify(item) === JSON.stringify((parsed.attrs as Record<string, unknown>)[name]));
    if (key === "content" || key === "marks") return Array.isArray(value)
      && (value.length === 0 && parsed[key] === undefined || Array.isArray(parsed[key])
        && value.length === parsed[key].length
        && value.every((item, index) => preserved(item, (parsed[key] as unknown[])[index])));
    return Object.hasOwn(parsed, key) && JSON.stringify(value) === JSON.stringify(parsed[key]);
  });
}

function validNode(value: unknown): boolean {
  if (!record(value) || typeof value.type !== "string"
    || value.type === "text" && (typeof value.text !== "string" || value.text.length === 0)
    || Object.hasOwn(value, "text") && typeof value.text !== "string") return false;
  if (value.attrs !== undefined && value.attrs !== null) {
    if (!record(value.attrs)) return false;
    const attrs = value.attrs;
    if (!Object.entries(attrs).every(([name, attr]) =>
      attr === null || typeof attr === "string" || typeof attr === "boolean"
      || typeof attr === "number" && Number.isFinite(attr)
      || name === "colwidth" && Array.isArray(attr) && attr.every(width =>
        typeof width === "number" && Number.isFinite(width)))) return false;
    if (value.type === "image" && ["src", "alt", "title", "caption", "mediaId", "credit", "source", "license", "licenseUrl", "link"]
      .some(name => Object.hasOwn(attrs, name)
        && attrs[name] !== null && typeof attrs[name] !== "string")) return false;
  }
  return (value.content === undefined || Array.isArray(value.content) && value.content.every(validNode))
    && (value.marks === undefined || Array.isArray(value.marks) && value.marks.every(validNode));
}

const premiumProducerMetadata = z.object({
  version: z.literal(1),
  method: z.literal("machine-translation"),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
  model: z.string().refine(value => value.trim().length > 0),
  reviewerModel: z.string().refine(value => value.trim().length > 0).nullable(),
  translatorRequestId: z.string().nullable(),
  reviewerRequestId: z.string().nullable(),
  generatedAt: z.string().datetime({ offset: true }),
}).strict();

/** Known producer sidecars belong to the HTML sentinel, never to editor nodes or review authority. */
function producerDocumentProjection(parsed: Record<string, unknown>, html: string, locale: "ru" | "en") {
  const hasMedia = Object.hasOwn(parsed, "__probperaMediaReferences");
  const hasPremium = Object.hasOwn(parsed, "__probperaPremiumTranslation");
  if (!hasMedia && !hasPremium) return parsed;
  if (locale !== "en" || !Array.isArray(parsed.content) || parsed.content.length !== 0
    || Object.keys(parsed).some(key => !["type", "content", "__probperaMediaReferences", "__probperaPremiumTranslation"].includes(key))) return null;
  if (hasPremium && !premiumProducerMetadata.safeParse(parsed.__probperaPremiumTranslation).success) return null;
  if (hasMedia && (!Array.isArray(parsed.__probperaMediaReferences)
    || !parsed.__probperaMediaReferences.every(reference => record(reference)
      && Object.keys(reference).length === 4
      && ["mediaId", "src", "alt", "decorative"].every(key => Object.hasOwn(reference, key))
      && typeof reference.mediaId === "string" && normalizeAuthoritativeMediaId(reference.mediaId) !== null
      && typeof reference.src === "string" && reference.src.trim().length > 0
      && typeof reference.alt === "string" && typeof reference.decorative === "boolean"))) return null;
  // Validate the complete original sidecar against the same HTML, including
  // repeated references. No normalized values replace the stored JSON.
  assertEditorialMediaIdentityParity(parsed, html, "Recovery EN");
  return { type: parsed.type, content: parsed.content };
}

/** Validate one locale without replacing its raw JSON or granting publication/review permission. */
export function prepareArticleEditorDocumentContent(
  html: string,
  json: string,
  schema: Schema,
  locale: "ru" | "en"
): JSONContent | string | null {
  // Full legacy copies may only have HTML. Keep the existing HTML editor path.
  if (json === "") return html;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!record(parsed) || parsed.type !== "doc" || !validNode(parsed)) return null;
    const projection = producerDocumentProjection(parsed, html, locale);
    if (!projection) return null;
    const document = schema.nodeFromJSON(projection);
    if (!preserved(projection, document.toJSON())) return null;
    // The article producer uses this empty JSON sentinel for legacy HTML too.
    if (document.childCount === 0) return html;
    document.check();
    return parsed as JSONContent;
  } catch {
    return null;
  }
}

/** Validate the entire copy and both documents before changing any editor state. */
export function prepareArticleRecoverySnapshot(
  value: unknown,
  current: ArticleRecoverySnapshot,
  schema: Schema
): { snapshot: ArticleRecoverySnapshot; content: JSONContent | string } | null {
  let snapshot: ArticleRecoverySnapshot;
  if (fullSnapshot(value)) {
    snapshot = value;
  } else {
    // The old unversioned writer stored a complete smaller RU body and optional
    // EN body. Its absent metadata must retain the current form's values.
    if (!record(value) || Object.hasOwn(value, "version") || !metadata(value)
      || Object.keys(value).some(key => !["title", "slug", "contentHtml", "contentJson", "english", "savedAt", "reason"].includes(key))
      || !ownType(value, ["title", "slug", "contentHtml"], "string")
      || Object.hasOwn(value, "contentJson") && typeof value.contentJson !== "string"
      || !fullSnapshot(current)) return null;
    let english = current.english;
    if (Object.hasOwn(value, "english")) {
      if (!record(value.english)
        || Object.keys(value.english).some(key => !["enabled", "title", "subtitle", "excerpt", "slug", "contentHtml", "contentJson"].includes(key))
        || !ownType(value.english, ["title", "subtitle", "excerpt", "slug", "contentHtml"], "string")
        || !ownType(value.english, ["enabled"], "boolean")
        || Object.hasOwn(value.english, "contentJson") && typeof value.english.contentJson !== "string") return null;
      english = {
        ...english,
        enabled: value.english.enabled as boolean,
        title: value.english.title as string,
        subtitle: value.english.subtitle as string,
        excerpt: value.english.excerpt as string,
        slug: value.english.slug as string,
        slugEdited: Boolean(value.english.slug),
        contentHtml: value.english.contentHtml as string,
        contentJson: (value.english.contentJson as string | undefined) ?? '{"type":"doc","content":[]}',
      };
    }
    snapshot = {
      ...current,
      title: value.title as string,
      slug: value.slug as string,
      slugEdited: true,
      contentHtml: value.contentHtml as string,
      contentJson: (value.contentJson as string | undefined) ?? '{"type":"doc","content":[]}',
      russianSourceChanged: true,
      english: {
        ...english,
        confirmedCurrentSource: false,
        status: english.status === "approved" || english.status === "published" ? "stale" : english.status,
      },
    };
  }
  const russian = prepareArticleEditorDocumentContent(snapshot.contentHtml, snapshot.contentJson, schema, "ru");
  const english = prepareArticleEditorDocumentContent(snapshot.english.contentHtml, snapshot.english.contentJson, schema, "en");
  if (russian === null || english === null) return null;
  return { snapshot, content: snapshot.activeLocale === "en" ? english : russian };
}
