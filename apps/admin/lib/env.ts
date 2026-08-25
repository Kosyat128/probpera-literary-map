const getEnvValue = (keys: string[]) =>
  keys
    .map((key) => process.env[key]?.trim())
    .find((value) => Boolean(value)) || "";

export type OpenAiReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";
export type OpenAiReasoningMode = "standard" | "pro";
export type PremiumTranslationProvider = "cloudflare" | "openai";

const openAiReasoningEfforts = new Set<OpenAiReasoningEffort>([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const openAiReasoningModes = new Set<OpenAiReasoningMode>([
  "standard",
  "pro",
]);

function getOpenAiReasoningEffort(
  keys: string[],
  fallback: OpenAiReasoningEffort
): OpenAiReasoningEffort {
  const value = getEnvValue(keys).toLowerCase() as OpenAiReasoningEffort;
  return openAiReasoningEfforts.has(value) ? value : fallback;
}

function getOpenAiReasoningMode(
  keys: string[],
  fallback: OpenAiReasoningMode
): OpenAiReasoningMode {
  const value = getEnvValue(keys).toLowerCase() as OpenAiReasoningMode;
  return openAiReasoningModes.has(value) ? value : fallback;
}

function getPremiumTranslationProvider(): PremiumTranslationProvider {
  return getEnvValue(["PREMIUM_TRANSLATION_PROVIDER"]).toLowerCase() === "openai"
    ? "openai"
    : "cloudflare";
}

export function premiumTranslationFeatureEnabled(input: {
  apiKey?: string | null;
  setting?: string | null;
  provider?: PremiumTranslationProvider;
}) {
  const apiKey = String(input.apiKey || "").trim();
  const setting = String(input.setting || "").trim().toLowerCase();
  if (setting === "false") return false;
  return input.provider === "cloudflare" || Boolean(apiKey);
}

const supabaseUrl = getEnvValue([
  "NEXT_PUBLIC_SUPABASE_URL",
  "VITE_SUPABASE_URL",
]);
const supabasePublishableKey = getEnvValue([
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
]);
const openAiDirectApiKey = getEnvValue(["OPENAI_API_KEY"]);
const premiumTranslationProvider = getPremiumTranslationProvider();
const cloudflareTranslationModel =
  getEnvValue(["CLOUDFLARE_TRANSLATION_MODEL"]) ||
  "@cf/google/gemma-4-26b-a4b-it";
const cloudflareTranslationReviewModel =
  getEnvValue(["CLOUDFLARE_TRANSLATION_REVIEW_MODEL"]) ||
  "@cf/zai-org/glm-4.7-flash";

// Backwards-compatible readiness credential. Existing translation actions use
// openAiApiKey only as a server-side gate before entering the shared premium
// pipeline. On Workers AI the binding itself is the credential, so expose a
// non-secret marker here while retaining the real OpenAI key separately.
const premiumTranslationCredential =
  premiumTranslationProvider === "cloudflare"
    ? "cloudflare-workers-ai-binding"
    : openAiDirectApiKey;

export const adminEnv = {
  supabaseUrl,
  supabasePublishableKey,
  publicSiteUrl:
    getEnvValue([
      "NEXT_PUBLIC_SITE_URL",
      "VITE_PUBLIC_SITE_URL",
      "PUBLIC_SITE_ORIGIN",
    ]).replace(/\/+$/, "") || "https://probpera.ru",
  adminSiteUrl:
    getEnvValue([
      "NEXT_PUBLIC_ADMIN_URL",
      "VITE_PUBLIC_ADMIN_URL",
      "PUBLIC_ADMIN_URL",
    ]).replace(/\/+$/, "") || "https://probpera.ru/admin",
  deployHookUrl:
    getEnvValue([
      "PUBLIC_SITE_DEPLOY_HOOK_URL",
      "VITE_PUBLIC_SITE_DEPLOY_HOOK_URL",
      "PUBLIC_DEPLOY_HOOK_URL",
    ]) || "",
  deployHookToken:
    getEnvValue([
      "PUBLIC_SITE_DEPLOY_HOOK_TOKEN",
      "VITE_PUBLIC_SITE_DEPLOY_HOOK_TOKEN",
      "PUBLIC_DEPLOY_HOOK_TOKEN",
    ]) || "",
  githubDeployToken:
    getEnvValue(["GITHUB_DEPLOY_TOKEN", "PUBLIC_GITHUB_DEPLOY_TOKEN"]) || "",
  githubRepository:
    getEnvValue(["GITHUB_DEPLOY_REPOSITORY", "GITHUB_REPOSITORY"]) ||
    "Kosyat128/probpera-literary-map",
  githubDeployWorkflow:
    getEnvValue(["GITHUB_DEPLOY_WORKFLOW"]) || "deploy-pages.yml",
  githubDeployRef: getEnvValue(["GITHUB_DEPLOY_REF"]) || "main",
  metrikaCounterId:
    getEnvValue([
      "YANDEX_METRIKA_COUNTER_ID",
      "VITE_YANDEX_METRIKA_COUNTER_ID",
      "PUBLIC_YANDEX_METRIKA_COUNTER_ID",
    ]) || "",
  premiumTranslationProvider,
  premiumTranslationConfigured:
    premiumTranslationProvider === "cloudflare" || Boolean(openAiDirectApiKey),
  cloudflareTranslationModel,
  cloudflareTranslationReviewModel,
  openAiDirectApiKey,
  // Kept for compatibility with existing server-side translation gates.
  openAiApiKey: premiumTranslationCredential,
  openAiTranslationModel:
    getEnvValue(["OPENAI_TRANSLATION_MODEL"]) || "gpt-5.6-sol",
  openAiTranslationReviewModel:
    getEnvValue(["OPENAI_TRANSLATION_REVIEW_MODEL"]) || "gpt-5.6-sol",
  openAiTranslationReasoningEffort: getOpenAiReasoningEffort(
    ["OPENAI_TRANSLATION_REASONING_EFFORT"],
    "max"
  ),
  openAiTranslationReasoningMode: getOpenAiReasoningMode(
    ["OPENAI_TRANSLATION_REASONING_MODE"],
    "pro"
  ),
  openAiTranslationReviewReasoningEffort: getOpenAiReasoningEffort(
    ["OPENAI_TRANSLATION_REVIEW_REASONING_EFFORT"],
    "max"
  ),
  openAiTranslationReviewReasoningMode: getOpenAiReasoningMode(
    ["OPENAI_TRANSLATION_REVIEW_REASONING_MODE"],
    "pro"
  ),
  openAiPremiumTranslationReview:
    getEnvValue(["OPENAI_PREMIUM_TRANSLATION_REVIEW"]).toLowerCase() !==
    "false",
  openAiAutoTranslateArticles: premiumTranslationFeatureEnabled({
    apiKey: openAiDirectApiKey,
    provider: premiumTranslationProvider,
    setting: getEnvValue(["OPENAI_AUTO_TRANSLATE_ARTICLES"]),
  }),
  openAiAutoTranslateLibrary: premiumTranslationFeatureEnabled({
    apiKey: openAiDirectApiKey,
    provider: premiumTranslationProvider,
    setting: getEnvValue(["OPENAI_AUTO_TRANSLATE_LIBRARY"]),
  }),
  openAiAutoTranslateSiteCopy: premiumTranslationFeatureEnabled({
    apiKey: openAiDirectApiKey,
    provider: premiumTranslationProvider,
    setting: getEnvValue(["OPENAI_AUTO_TRANSLATE_SITE_COPY"]),
  }),
  openAiAutoTranslateProfiles: premiumTranslationFeatureEnabled({
    apiKey: openAiDirectApiKey,
    provider: premiumTranslationProvider,
    setting: getEnvValue(["OPENAI_AUTO_TRANSLATE_PROFILES"]),
  }),
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);
