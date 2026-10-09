import { z } from "zod";

const stamp = z.string().max(80).datetime({ offset: true });
const operationId = z.string().uuid().optional();
const canonicalStatus = z.enum(["draft", "review", "scheduled", "published", "hidden", "archived"]);
export const articleWorkingDraftReceiptSchema = z.object({
  scope: z.enum(["bundle", "english-only"]),
  version: z.number().int().positive().safe(),
  updatedAt: stamp,
  baseArticleUpdatedAt: stamp,
  englishExpectedUpdatedAt: stamp.nullable(),
  englishWrite: z.enum(["saved", "preserved"]),
  englishEnabled: z.boolean(),
}).strict();
const receiptSchema = z.object({
  articleId: z.string().uuid(),
  articleUpdatedAt: stamp,
  englishUpdatedAt: stamp.nullable(),
  workingDraftVersion: z.number().int().safe().nonnegative(),
  workingDraftUpdatedAt: stamp.nullable(),
  canonicalStatus,
  workingDraft: articleWorkingDraftReceiptSchema.optional(),
}).strict();

const articleSaveResultSchema = z.discriminatedUnion("outcome", [
  z.object({
    operationId,
    outcome: z.literal("rejected"),
    reason: z.enum([
      "validation", "english-validation", "content", "english-content",
      "media", "permission", "schedule",
    ]),
  }).strict(),
  z.object({ operationId, outcome: z.literal("dependency-unavailable") }).strict(),
  z.object({ operationId, outcome: z.literal("unknown-outcome") }).strict(),
  z.object({
    operationId,
    outcome: z.literal("conflict"),
    scope: z.enum(["article", "english"]),
  }).strict(),
  z.object({
    operationId,
    outcome: z.literal("saved"),
    englishState: z.enum(["saved", "preserved", "status-only", "unknown"]).optional(),
    persistence: z.enum(["article-bundle", "working-draft", "working-draft-promotion"]),
    receipt: receiptSchema,
    publicationState: z.enum(["not-requested", "started", "queued", "queue-error", "unknown"]),
    revalidationState: z.enum(["scheduled", "unknown"]),
    destination: z.string().min(1).max(4000),
  }).strict(),
]);

/** Action acknowledgements, known prewrite refusals and unconfirmed write outcomes. */
export type ArticleSaveResult = z.infer<typeof articleSaveResultSchema>;
export type ArticleSaveReceipt = z.infer<typeof receiptSchema>;
export type ArticleWorkingDraftReceipt = z.infer<typeof articleWorkingDraftReceiptSchema>;
export type ArticleSaveContext = {
  operationId?: string;
  articleId: string | null;
  articleUpdatedAt: string | null;
  englishUpdatedAt: string | null;
  workingDraftVersion: number;
};

function revision(value: string) {
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!parts) return null;
  const seconds = Date.parse(parts[1] + parts[3]);
  return Number.isFinite(seconds) ? { seconds, fraction: (parts[2] || "").replace(/0+$/u, "") } : null;
}

/** Compare PostgreSQL revisions without discarding fractional digits in Date. */
export function compareArticleSaveRevisions(left: string, right: string): number | null {
  if (!stamp.safeParse(left).success || !stamp.safeParse(right).success) return null;
  const a = revision(left), b = revision(right);
  if (!a || !b) return null;
  if (a.seconds !== b.seconds) return a.seconds > b.seconds ? 1 : -1;
  const length = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(length, "0"), bf = b.fraction.padEnd(length, "0");
  return af === bf ? 0 : af > bf ? 1 : -1;
}

function sameRevision(left: string | null, right: string | null) {
  return left === null || right === null ? left === right : compareArticleSaveRevisions(left, right) === 0;
}

function coherentWorkingDraft(result: Extract<ArticleSaveResult, { outcome: "saved" }>) {
  const draft = result.receipt.workingDraft;
  if (!draft) return true;
  if (draft.version !== result.receipt.workingDraftVersion
    || draft.updatedAt !== result.receipt.workingDraftUpdatedAt
    || !sameRevision(draft.baseArticleUpdatedAt, result.receipt.articleUpdatedAt)
    || !["published", "scheduled", "hidden", "archived"].includes(result.receipt.canonicalStatus)) return false;
  if (result.persistence === "working-draft") {
    return draft.scope === "bundle" && draft.englishWrite === result.englishState
      && sameRevision(draft.englishExpectedUpdatedAt, result.receipt.englishUpdatedAt)
      && draft.englishEnabled === (draft.englishWrite === "saved");
  }
  return result.persistence === "working-draft-promotion" && draft.scope === "english-only"
    && draft.englishWrite === "preserved"
    && (result.englishState === "preserved" || result.englishState === "status-only")
    && (result.receipt.englishUpdatedAt === null
      || sameRevision(draft.englishExpectedUpdatedAt, result.receipt.englishUpdatedAt));
}

function safeDestination(value: string, articleId: string) {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/u.test(value)) return false;
  try {
    const destination = new URL(value, "https://admin.fixture.invalid");
    if (destination.origin !== "https://admin.fixture.invalid" || destination.hash) return false;
    if (destination.pathname === "/articles/edit") {
      const ids = destination.searchParams.getAll("id");
      return ids.length === 1 && ids[0].toLowerCase() === articleId.toLowerCase();
    }
    const locales = destination.searchParams.getAll("locale");
    const preview = /^\/articles\/([^/]+)\/preview$/u.exec(destination.pathname);
    return preview !== null && preview[1].toLowerCase() === articleId.toLowerCase()
      && locales.length === 1 && (locales[0] === "ru" || locales[0] === "en");
  } catch { return false; }
}

/** Only a server action response supplies an acknowledgement; URL flags never do. */
export function parseArticleSaveResult(value: unknown, context?: ArticleSaveContext): ArticleSaveResult | null {
  const parsed = articleSaveResultSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (context?.operationId !== undefined && (!z.string().uuid().safeParse(context.operationId).success
    || result.operationId?.toLowerCase() !== context.operationId.toLowerCase())) return null;
  if (result.outcome !== "saved") return result;
  if (!safeDestination(result.destination, result.receipt.articleId)) return null;
  if (!coherentWorkingDraft(result)) return null;
  if (result.persistence === "working-draft"
    ? result.receipt.workingDraftVersion < 1 || result.receipt.workingDraftUpdatedAt === null
      || !result.receipt.workingDraft && result.receipt.canonicalStatus !== "published"
    : !result.receipt.workingDraft && (result.receipt.workingDraftVersion !== 0 || result.receipt.workingDraftUpdatedAt !== null)) return null;
  if (result.persistence === "working-draft" ? result.englishState === "status-only"
    : result.englishState === "saved" && result.receipt.englishUpdatedAt === null
      || result.englishState === "preserved" && result.receipt.englishUpdatedAt !== null
      || result.englishState === "status-only" && result.receipt.englishUpdatedAt === null) return null;
  if (!context) return result;
  if (!Number.isSafeInteger(context.workingDraftVersion) || context.workingDraftVersion < 0
    || context.articleUpdatedAt !== null && !stamp.safeParse(context.articleUpdatedAt).success
    || context.englishUpdatedAt !== null && !stamp.safeParse(context.englishUpdatedAt).success
    || context.articleId === null && (context.articleUpdatedAt !== null || context.workingDraftVersion !== 0)
    || context.articleId !== null && (!z.string().uuid().safeParse(context.articleId).success
      || context.articleUpdatedAt === null
      || context.articleId.toLowerCase() !== result.receipt.articleId.toLowerCase())) return null;
  if (result.persistence === "working-draft") {
    if (!context.articleId || !context.articleUpdatedAt
      || compareArticleSaveRevisions(result.receipt.articleUpdatedAt, context.articleUpdatedAt) !== 0
      || result.receipt.workingDraftVersion !== context.workingDraftVersion + 1
      || !Number.isSafeInteger(context.workingDraftVersion + 1)
      || !result.receipt.workingDraftUpdatedAt
      || !result.receipt.workingDraft && result.receipt.canonicalStatus !== "published"
      || result.receipt.englishUpdatedAt !== context.englishUpdatedAt) return null;
  } else {
    if ((!result.receipt.workingDraft && (result.receipt.workingDraftVersion !== 0 || result.receipt.workingDraftUpdatedAt !== null))
      || result.persistence === "working-draft-promotion" && !context.articleId
      || context.articleUpdatedAt !== null
        && compareArticleSaveRevisions(result.receipt.articleUpdatedAt, context.articleUpdatedAt) !== 1
      || result.receipt.englishUpdatedAt !== null && context.englishUpdatedAt !== null
        && compareArticleSaveRevisions(result.receipt.englishUpdatedAt, context.englishUpdatedAt) !== 1) return null;
    if (result.receipt.workingDraft && (context.workingDraftVersion < 1
      || !Number.isSafeInteger(context.workingDraftVersion + 1)
      || result.receipt.workingDraft.version !== context.workingDraftVersion + 1)) return null;
  }
  return result;
}
