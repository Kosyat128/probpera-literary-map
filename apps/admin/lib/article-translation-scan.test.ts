import { describe, expect, it } from "vitest";

import {
  ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT,
  articleTranslationScanStateSchema,
  decodeArticleTranslationResumeCursor,
  parseArticleTranslationScanState,
  type ArticleTranslationScanState,
} from "./article-translation-scan";

function id(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function state(overrides: Partial<ArticleTranslationScanState> = {}): ArticleTranslationScanState {
  return {
    version: 1,
    order: "id",
    upperId: id(1000),
    afterId: id(10),
    pendingIds: [id(11), id(12), id(13)],
    nextIndex: 0,
    lastWindow: false,
    exhausted: false,
    ...overrides,
  };
}

describe("bounded article translation scan state", () => {
  it("accepts the first fixed window without an earlier boundary", () => {
    const input = state({ afterId: null });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
  });

  it.each([0, 1, 2, 3])("keeps the completed window boundary while position advances to %s", (nextIndex) => {
    const input = state({ nextIndex });
    const parsed = parseArticleTranslationScanState(input);
    expect(parsed).toEqual(input);
    expect(parsed?.afterId).toBe(id(10));
    expect(parsed?.pendingIds).toEqual([id(11), id(12), id(13)]);
  });

  it("accepts the inclusive final upper ID", () => {
    const input = state({ upperId: id(13) });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
  });

  it.each([false, true])("accepts an empty window exhausted=%s", (exhausted) => {
    const input = state({ pendingIds: [], nextIndex: 0, lastWindow: exhausted, exhausted });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
  });

  it("accepts a completed terminal boundary only with no pending IDs", () => {
    const input = state({ afterId: id(1000), pendingIds: [], lastWindow: true, exhausted: true });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
    expect(parseArticleTranslationScanState({ ...input, pendingIds: [id(1000)] })).toBeNull();
  });

  it("accepts and detaches a full 500 ID window", () => {
    const input = state({ pendingIds: Array.from({ length: 500 }, (_, index) => id(index + 11)), nextIndex: 500 });
    const parsed = parseArticleTranslationScanState(input);
    expect(ARTICLE_TRANSLATION_SCAN_WINDOW_LIMIT).toBe(500);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parsed?.pendingIds).not.toBe(input.pendingIds);
    parsed?.pendingIds.pop();
    expect(input.pendingIds).toHaveLength(500);
  });

  it("compares UUID case canonically without rewriting stored spellings", () => {
    const input = state({
      afterId: id(10).toUpperCase(),
      upperId: id(15).toUpperCase(),
      pendingIds: [id(11).toUpperCase(), id(12), id(13).toUpperCase(), id(15)],
    });
    const frozen = Object.freeze({ ...input, pendingIds: Object.freeze([...input.pendingIds]) });
    expect(parseArticleTranslationScanState(frozen)).toEqual(input);
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(input));
  });

  it("accepts a plain null-prototype JSON record", () => {
    const input = Object.assign(Object.create(null), state());
    expect(parseArticleTranslationScanState(input)).toEqual(state());
  });

  it("keeps a confirmed last window pending until its stored IDs are consumed", () => {
    const input = state({ lastWindow: true, nextIndex: 2 });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
    expect(parseArticleTranslationScanState({ ...input, exhausted: true })).toBeNull();
  });

  it("accepts exactly 500 pending IDs as a confirmed last window", () => {
    const input = state({
      pendingIds: Array.from({ length: 500 }, (_, index) => id(index + 11)),
      nextIndex: 500,
      lastWindow: true,
    });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
  });

  it("does not turn an empty intermediate window into confirmed exhaustion", () => {
    const input = state({ pendingIds: [], nextIndex: 0, lastWindow: false });
    expect(parseArticleTranslationScanState(input)).toEqual(input);
    expect(parseArticleTranslationScanState({ ...input, exhausted: true })).toBeNull();
  });

  it.each([
    ["unsupported version", { version: 2 }],
    ["coerced version", { version: "1" }],
    ["offset order", { order: "updated_at" }],
    ["missing upper boundary", { upperId: undefined }],
    ["null upper boundary", { upperId: null }],
    ["invalid upper UUID", { upperId: "article-1000" }],
    ["padded upper UUID", { upperId: ` ${id(1000)} ` }],
    ["invalid previous UUID", { afterId: "article-10" }],
    ["padded previous UUID", { afterId: ` ${id(10)} ` }],
    ["missing previous boundary", { afterId: undefined }],
    ["reversed scan bounds", { afterId: id(1001) }],
    ["invalid pending UUID", { pendingIds: ["article-11"] }],
    ["padded pending UUID", { pendingIds: [` ${id(11)} `] }],
    ["missing pending window", { pendingIds: undefined }],
    ["pending window is not an array", { pendingIds: id(11) }],
    ["duplicate pending UUID", { pendingIds: [id(11), id(11)] }],
    ["duplicate UUID in another case", { pendingIds: [id(11), id(11).toUpperCase()] }],
    ["descending pending IDs", { pendingIds: [id(12), id(11)] }],
    ["unsorted interior", { pendingIds: [id(11), id(13), id(12)] }],
    ["first ID equals earlier boundary", { pendingIds: [id(10), id(11)] }],
    ["first ID predates earlier boundary", { pendingIds: [id(9), id(11)] }],
    ["ID exceeds fixed upper boundary", { pendingIds: [id(11), id(1001)] }],
    ["oversized window", { pendingIds: Array.from({ length: 501 }, (_, index) => id(index + 11)) }],
    ["negative position", { nextIndex: -1 }],
    ["fractional position", { nextIndex: 0.5 }],
    ["NaN position", { nextIndex: Number.NaN }],
    ["infinite position", { nextIndex: Number.POSITIVE_INFINITY }],
    ["unsafe integer position", { nextIndex: Number.MAX_SAFE_INTEGER + 1 }],
    ["position beyond pending window", { nextIndex: 4 }],
    ["coerced position", { nextIndex: "1" }],
    ["missing position", { nextIndex: undefined }],
    ["missing exhausted state", { exhausted: undefined }],
    ["coerced exhausted state", { exhausted: "false" }],
    ["missing final window confirmation", { lastWindow: undefined }],
    ["coerced final window confirmation", { lastWindow: "true" }],
    ["false exhaustion with pending work", { exhausted: true }],
    ["unknown state field", { articleCursor: 10 }],
  ])("rejects %s rather than repairing or restarting it", (_name, override) => {
    const input = { ...state(), ...override };
    expect(parseArticleTranslationScanState(input)).toBeNull();
    expect(articleTranslationScanStateSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a nonzero position after the pending window is lost", () => {
    expect(parseArticleTranslationScanState(state({ pendingIds: [], nextIndex: 1 }))).toBeNull();
  });

  it.each([null, undefined, false, 1, "{}", [], new Date(), new Map()])("rejects non-record state %s", (input) => {
    expect(parseArticleTranslationScanState(input)).toBeNull();
  });

  it("rejects a class instance masquerading as a JSON DTO", () => {
    class ScanState {
      constructor() { Object.assign(this, state()); }
    }
    expect(parseArticleTranslationScanState(new ScanState())).toBeNull();
  });

  it("fails closed on a damaged property read", () => {
    const input = { ...state() };
    Object.defineProperty(input, "pendingIds", { enumerable: true, get() { throw new Error("damaged cursor"); } });
    expect(() => parseArticleTranslationScanState(input)).not.toThrow();
    expect(parseArticleTranslationScanState(input)).toBeNull();
  });
});

describe("article resume cursor compatibility", () => {
  it("decodes a durable articleScan without copying unrelated cursor fields", () => {
    const input = { articleScan: state({ nextIndex: 2 }), libraryCursor: 42, writerCursor: 8 };
    expect(decodeArticleTranslationResumeCursor(input)).toEqual({ kind: "scan", state: input.articleScan });
  });

  it.each([undefined, {}, { articleCursor: 0 }, { articleCursor: 41 }, { articleCursor: 999999999 }, { libraryCursor: 42 }])(
    "classifies legacy cursor %j explicitly without inventing a scan state", (input) => {
      expect(decodeArticleTranslationResumeCursor(input)).toEqual({ kind: "legacy" });
    }
  );

  it.each([null, false, 1, "{}", [], new Date(), new Map()])("rejects malformed cursor container %s", (input) => {
    expect(decodeArticleTranslationResumeCursor(input)).toEqual({ kind: "invalid" });
  });

  it.each([undefined, null, [], {}, state({ version: 2 } as never), state({ nextIndex: 4 }), state({ exhausted: true })])(
    "keeps damaged present articleScan %j invalid even with a legacy offset", (articleScan) => {
      expect(decodeArticleTranslationResumeCursor({ articleScan, articleCursor: 41 })).toEqual({ kind: "invalid" });
    }
  );

  it("accepts a null-prototype cursor container", () => {
    const cursor = Object.assign(Object.create(null), { articleScan: state() });
    expect(decodeArticleTranslationResumeCursor(cursor)).toEqual({ kind: "scan", state: state() });
  });

  it("rejects inherited cursor state instead of taking it as a receipt", () => {
    const cursor = Object.create({ articleScan: state() });
    expect(decodeArticleTranslationResumeCursor(cursor)).toEqual({ kind: "invalid" });
  });

  it("returns invalid when a present articleScan cannot be read", () => {
    const cursor = {};
    Object.defineProperty(cursor, "articleScan", { enumerable: true, get() { throw new Error("damaged cursor"); } });
    expect(() => decodeArticleTranslationResumeCursor(cursor)).not.toThrow();
    expect(decodeArticleTranslationResumeCursor(cursor)).toEqual({ kind: "invalid" });
  });
});
