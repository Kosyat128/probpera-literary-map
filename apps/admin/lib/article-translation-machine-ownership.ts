import { authoritativeMediaReferencesFromHtml } from "./editorial-media-identity";

const PREMIUM_ARTICLE_TRANSLATION_META_KEY = "__probperaPremiumTranslation";
const ARTICLE_MEDIA_REFERENCES_KEY = "__probperaMediaReferences";

export type PremiumArticleMachineTranslationMetadata = {
  sourceHash: string;
  model: string;
  reviewerModel: string | null;
  translatorRequestId: string | null;
  reviewerRequestId: string | null;
  generatedAt?: string;
};

/**
 * Machine translations deliberately keep an empty TipTap document so the
 * editor continues to render the reviewed HTML fallback.  Persist the media
 * identity contract beside it so JSON/HTML parity is still fail-closed.
 */
export function machineArticleContentJsonFromHtml(translatedHtml: string) {
  const mediaReferences = authoritativeMediaReferencesFromHtml(translatedHtml);
  return {
    type: "doc",
    content: [],
    ...(mediaReferences.length
      ? { [ARTICLE_MEDIA_REFERENCES_KEY]: mediaReferences }
      : {}),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function premiumArticleMachineContentJson(
  metadata: PremiumArticleMachineTranslationMetadata,
  translatedHtml = ""
) {
  return {
    ...machineArticleContentJsonFromHtml(translatedHtml),
    [PREMIUM_ARTICLE_TRANSLATION_META_KEY]: {
      version: 1,
      method: "machine-translation",
      sourceHash: metadata.sourceHash,
      model: metadata.model,
      reviewerModel: metadata.reviewerModel,
      translatorRequestId: metadata.translatorRequestId,
      reviewerRequestId: metadata.reviewerRequestId,
      generatedAt: metadata.generatedAt || new Date().toISOString(),
    },
  };
}

export function refreshArticleMachineMediaReferences(
  value: unknown,
  canonicalHtml: string
) {
  const document = objectValue(value);
  const metadata = document[PREMIUM_ARTICLE_TRANSLATION_META_KEY];
  return {
    ...machineArticleContentJsonFromHtml(canonicalHtml),
    ...(metadata === undefined
      ? {}
      : { [PREMIUM_ARTICLE_TRANSLATION_META_KEY]: metadata }),
  };
}

export function rebindPremiumArticleMachineSourceHash(
  value: unknown,
  sourceHash: string
) {
  const document = objectValue(value);
  const metadata = objectValue(document[PREMIUM_ARTICLE_TRANSLATION_META_KEY]);
  if (
    metadata.method !== "machine-translation" ||
    metadata.version !== 1 ||
    !sourceHash.trim()
  ) {
    return value;
  }
  return {
    ...document,
    [PREMIUM_ARTICLE_TRANSLATION_META_KEY]: {
      ...metadata,
      sourceHash: sourceHash.trim(),
    },
  };
}

export function isMachineOwnedEnglishArticleTranslation(input: {
  contentJson: unknown;
  sourceContentHash: string | null | undefined;
}) {
  const document = objectValue(input.contentJson);
  const metadata = objectValue(document[PREMIUM_ARTICLE_TRANSLATION_META_KEY]);
  const sourceHash = String(input.sourceContentHash || "").trim();
  return Boolean(
    sourceHash &&
      metadata.method === "machine-translation" &&
      metadata.version === 1 &&
      metadata.sourceHash === sourceHash
  );
}

export function stripPremiumArticleMachineMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = { ...(value as Record<string, unknown>) };
  delete next[PREMIUM_ARTICLE_TRANSLATION_META_KEY];
  // Once TipTap contains real structured nodes, those nodes are authoritative;
  // keeping the HTML-fallback references as well would double-count media.
  if (Array.isArray(next.content) && next.content.length > 0) {
    delete next[ARTICLE_MEDIA_REFERENCES_KEY];
  }
  return next;
}
