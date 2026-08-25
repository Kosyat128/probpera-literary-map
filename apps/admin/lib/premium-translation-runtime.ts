import { adminEnv } from "./env";

type PremiumTranslationRuntimeEnv = Pick<
  typeof adminEnv,
  | "premiumTranslationProvider"
  | "cloudflareTranslationModel"
  | "cloudflareTranslationReviewModel"
  | "openAiTranslationModel"
  | "openAiTranslationReviewModel"
  | "openAiPremiumTranslationReview"
>;

export type PremiumTranslationRuntimeMetadata = {
  provider: "cloudflare" | "openai";
  model: string;
  reviewerModel: string | null;
  twoPassReview: boolean;
};

export function premiumTranslationRuntimeMetadata(
  env: PremiumTranslationRuntimeEnv = adminEnv
): PremiumTranslationRuntimeMetadata {
  const cloudflare = env.premiumTranslationProvider === "cloudflare";
  const twoPassReview = env.openAiPremiumTranslationReview;
  return {
    provider: env.premiumTranslationProvider,
    model: cloudflare
      ? env.cloudflareTranslationModel
      : env.openAiTranslationModel,
    reviewerModel: twoPassReview
      ? cloudflare
        ? env.cloudflareTranslationReviewModel
        : env.openAiTranslationReviewModel
      : null,
    twoPassReview,
  };
}

export function premiumTranslationConfigurationError(
  provider: "cloudflare" | "openai" = adminEnv.premiumTranslationProvider
) {
  return provider === "cloudflare"
    ? "Cloudflare Workers AI binding не настроен на сервере."
    : "OPENAI_API_KEY не настроен на сервере.";
}
