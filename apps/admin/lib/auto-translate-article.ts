import { adminEnv } from "./env";
import {
  ensurePublishedArticleEnglishTranslation,
  protectedArticleHtmlSignature,
  translateArticleSourceToEnglish as createArticleTranslationDraft,
  type AutoTranslationResult,
  type AutoTranslationSource,
  type AutoTranslationState,
} from "./auto-translate-article-core";
import { premiumReviewArticleTranslation } from "./premium-article-translation";

export {
  ensurePublishedArticleEnglishTranslation,
  protectedArticleHtmlSignature,
};
export type {
  AutoTranslationResult,
  AutoTranslationSource,
  AutoTranslationState,
};

export async function translateArticleSourceToEnglish(
  source: AutoTranslationSource,
  options: {
    apiKey?: string;
    model?: string;
    reviewModel?: string;
    fetchImpl?: typeof fetch;
    premiumReview?: boolean;
  } = {}
): Promise<AutoTranslationResult> {
  const draft = await createArticleTranslationDraft(source, options);
  const premiumReview =
    options.premiumReview ?? adminEnv.openAiPremiumTranslationReview;
  if (!premiumReview) return draft;

  const apiKey = options.apiKey ?? adminEnv.openAiApiKey;
  const reviewModel =
    options.reviewModel ??
    adminEnv.openAiTranslationReviewModel ??
    options.model ??
    adminEnv.openAiTranslationModel;

  return premiumReviewArticleTranslation({
    source,
    draft,
    apiKey,
    model: reviewModel,
    fetchImpl: options.fetchImpl,
  });
}
