import type {
  ArticleBundleEnglishMode,
  ArticleBundleRpcInput,
} from "./article-bundle-rpc";

export type AtomicArticlePayloadInput = {
  articleId: string | null;
  expectedArticleUpdatedAt: string | null;
  articlePayload: Record<string, unknown>;
  englishMode: ArticleBundleEnglishMode;
  englishPayload?: Record<string, unknown> | null;
  expectedEnglishUpdatedAt?: string | null;
  previousPublicPath?: string | null;
  nextPublicPath?: string | null;
  replaceHomepage?: boolean;
  auditAction: "article.created" | "article.updated";
  auditMetadata: Record<string, unknown>;
  socialPublishRequested?: boolean;
  socialMetadata?: Record<string, unknown>;
};

export function buildArticleBundleRpcInput(
  input: AtomicArticlePayloadInput
): ArticleBundleRpcInput {
  const redirectSourcePath = input.previousPublicPath || null;
  const redirectDestinationPath = input.nextPublicPath || null;
  const hasRealRedirect = Boolean(
    redirectSourcePath &&
      redirectDestinationPath &&
      redirectSourcePath !== redirectDestinationPath
  );

  return {
    articleId: input.articleId,
    expectedArticleUpdatedAt: input.expectedArticleUpdatedAt,
    articlePayload: input.articlePayload,
    englishMode: input.englishMode,
    englishPayload:
      input.englishMode === "save" ? input.englishPayload || null : null,
    expectedEnglishUpdatedAt:
      input.englishMode === "none"
        ? null
        : input.expectedEnglishUpdatedAt || null,
    redirectSourcePath: hasRealRedirect ? redirectSourcePath : null,
    redirectDestinationPath: hasRealRedirect ? redirectDestinationPath : null,
    replaceHomepage: Boolean(input.replaceHomepage),
    auditAction: input.auditAction,
    auditMetadata: input.auditMetadata,
    socialPublishRequested: Boolean(input.socialPublishRequested),
    socialMetadata: input.socialMetadata || {},
  };
}

export function atomicEnglishMode(input: {
  hasEnglishDraft: boolean;
  staleReleasedEnglishOnDisable: boolean;
}): ArticleBundleEnglishMode {
  if (input.hasEnglishDraft) return "save";
  if (input.staleReleasedEnglishOnDisable) return "stale";
  return "none";
}
