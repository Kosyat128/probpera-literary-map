import type { ArticleBookPage } from "./articleBookPages";

export type ArticleBookAnchor = Readonly<{ blockId: string; offset: number }>;

/** Source runs, unlike drawn hyphens or page percentages, survive font reflow. */
export function articleBookSourceRanges(pages: readonly ArticleBookPage[]) {
  const offsets = new Map<string, number>();
  return pages.map(page => page.articleLayout.map(command => {
    const blockId = command.block.id;
    const start = offsets.get(blockId) || 0;
    const length = command.kind === "text" ? command.runs.reduce((sum, run) => sum + run.text.length, 0) : 1;
    offsets.set(blockId, start + length);
    return { blockId, start, end: start + length };
  }));
}

export function articleBookPageAnchor(pages: readonly ArticleBookPage[], pageIndex: number): ArticleBookAnchor | null {
  const first = articleBookSourceRanges(pages)[pageIndex]?.[0];
  return first ? { blockId: first.blockId, offset: first.start } : null;
}

export function resolveArticleBookAnchor(pages: readonly ArticleBookPage[], anchor: ArticleBookAnchor | null) {
  if (!anchor) return -1;
  if (anchor.blockId === "end") return pages.length - 1;
  return articleBookSourceRanges(pages).findIndex(ranges => ranges.some(range =>
    range.blockId === anchor.blockId && anchor.offset >= range.start && anchor.offset < range.end));
}

export function readArticleBookAnchor(hint: string | undefined, locale: "ru" | "en"): ArticleBookAnchor | null {
  const match = hint?.match(/^article-book:v1:(ru|en):([a-z0-9-]+):(\d+)$/u);
  if (!match || match[1] !== locale || !Number.isSafeInteger(Number(match[3]))) return null;
  return { blockId: match[2], offset: Number(match[3]) };
}

export function writeArticleBookAnchor(anchor: ArticleBookAnchor | null, locale: "ru" | "en") {
  return anchor ? `article-book:v1:${locale}:${anchor.blockId}:${anchor.offset}` : undefined;
}
