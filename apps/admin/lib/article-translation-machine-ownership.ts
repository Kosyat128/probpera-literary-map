const PREMIUM_ARTICLE_TRANSLATION_META_KEY = "__probperaPremiumTranslation";

export type PremiumArticleMachineTranslationMetadata = {
  sourceHash: string;
  model: string;
  reviewerModel: string | null;
  translatorRequestId: string | null;
  reviewerRequestId: string | null;
  generatedAt?: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function premiumArticleMachineContentJson(
  metadata: PremiumArticleMachineTranslationMetadata
) {
  return {
    type: "doc",
    content: [],
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
  return next;
}
