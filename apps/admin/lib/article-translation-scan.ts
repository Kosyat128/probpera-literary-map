import { z } from "zod";

export const ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT = 500;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const uuid = z.string().uuid();

const scanState = z.object({
  version: z.literal(1),
  order: z.literal("id"),
  upperId: uuid,
  // This is the completed previous window, not the last attempted item.
  afterId: uuid.nullable(),
  pendingIds: z.array(uuid).max(ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT),
  nextIndex: z.number().int().min(0).max(ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT),
  // The bounded keyset query confirmed that this is its final window.
  lastWindow: z.boolean(),
  exhausted: z.boolean(),
}).strict().superRefine((state, context) => {
  const upperId = state.upperId.toLowerCase();
  const afterId = state.afterId?.toLowerCase() ?? null;
  if (afterId !== null && afterId > upperId) {
    context.addIssue({ code: "custom", path: ["afterId"], message: "Invalid scan boundary" });
  }
  if (state.nextIndex > state.pendingIds.length) {
    context.addIssue({ code: "custom", path: ["nextIndex"], message: "Invalid scan position" });
  }
  if (state.exhausted && (!state.lastWindow || state.pendingIds.length > 0)) {
    context.addIssue({ code: "custom", path: ["exhausted"], message: "Only an empty final window is exhausted" });
  }

  let previousId = afterId;
  state.pendingIds.forEach((id, index) => {
    // UUID byte ordering is case insensitive; retain the original value.
    const comparableId = id.toLowerCase();
    if (
      (previousId !== null && comparableId <= previousId) ||
      comparableId > upperId
    ) {
      context.addIssue({ code: "custom", path: ["pendingIds", index], message: "Invalid scan window" });
    }
    previousId = comparableId;
  });
});

export const articleTranslationScanStateSchema = z
  .custom<Record<string, unknown>>(isPlainRecord)
  .pipe(scanState);

export type ArticleTranslationScanState = z.infer<typeof articleTranslationScanStateSchema>;

export function parseArticleTranslationScanState(value: unknown): ArticleTranslationScanState | null {
  try {
    const parsed = articleTranslationScanStateSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type ArticleTranslationResumeCursor =
  | { kind: "scan"; state: ArticleTranslationScanState }
  | { kind: "legacy" }
  | { kind: "invalid" };

export function decodeArticleTranslationResumeCursor(value: unknown): ArticleTranslationResumeCursor {
  if (value === undefined) return { kind: "legacy" };
  try {
    if (!isPlainRecord(value)) return { kind: "invalid" };
    if (!Object.hasOwn(value, "articleScan")) return { kind: "legacy" };
    const state = parseArticleTranslationScanState(value.articleScan);
    return state ? { kind: "scan", state } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}
