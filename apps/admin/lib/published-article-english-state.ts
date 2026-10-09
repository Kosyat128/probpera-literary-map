import { isMachineOwnedEnglishArticleTranslation } from "./article-translation-machine-ownership";
import { z } from "zod";

export type PublishedArticleEnglishState = {
  ownership: "machine" | "manual" | "missing";
  freshness: "current" | "stale" | "unknown";
  publication: string | null;
};

export function validPublishedArticleSourceRevision(value: unknown): value is string {
  return z.string().datetime({ offset: true }).safeParse(value).success;
}

/** Read-only classification: a publication status cannot establish freshness. */
export function publishedArticleEnglishState(input: {
  sourceHash: string;
  sourceUpdatedAt: string;
  translation: {
    status: string;
    source_content_hash: string | null;
    source_article_updated_at?: string | null;
    content_json: unknown;
  } | null;
}): PublishedArticleEnglishState {
  const existing = input.translation;
  if (!existing) {
    return { ownership: "missing", freshness: "unknown", publication: null };
  }
  const ownership = isMachineOwnedEnglishArticleTranslation({
    contentJson: existing.content_json,
    sourceContentHash: existing.source_content_hash,
  }) ? "machine" : "manual";
  const hashKnown = typeof existing.source_content_hash === "string" &&
    /^[a-f0-9]{64}$/u.test(existing.source_content_hash);
  const sameSource = hashKnown && existing.source_content_hash === input.sourceHash;
  const sourceRevisionKnown = validPublishedArticleSourceRevision(input.sourceUpdatedAt);
  const sameRevision = sourceRevisionKnown &&
    existing.source_article_updated_at === input.sourceUpdatedAt;
  return {
    ownership,
    freshness: !sourceRevisionKnown ? "unknown" : sameSource && sameRevision ? "current" : hashKnown && !sameSource ? "stale" : "unknown",
    publication: existing.status,
  };
}
