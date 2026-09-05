/** V12 cross-platform policy. Facts and scene state remain in their canonical owners. */
export const productPolicy = Object.freeze({
  canonicalRepository: "Kosyat128/probpera-literary-map",
  canonicalOrigin: "https://probpera.ru",
  releaseProfile: "SAFE_PAID_BILINGUAL_V1",
  distributionModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES",
  requiredLocales: Object.freeze(["ru", "en"] as const),
  unsupportedLocaleFallback: "en",
  machineTranslationPublication: false,
  unlicensedProtectedContent: false,
  remoteExecutableRuntime: false,
  childAdvertising: false,
  childTracking: false,
  childOpenAiChat: false,
  automationMode: "dry-run",
} as const);

export type ProductLocale = typeof productPolicy.requiredLocales[number];
export type LocalePreferenceSource = "explicit-selection" | "saved-preference" | "system-language";
const localePreferenceSources = new Set<string>(["explicit-selection", "saved-preference", "system-language"]);

/** Rejects IP, nationality, SIM and store territory as language preference signals. */
export function isLocalePreferenceSource(value: unknown): value is LocalePreferenceSource {
  return typeof value === "string" && localePreferenceSources.has(value);
}

export type LocalPreparationAction = "validate" | "build" | "package" | "write-draft-files";
const localPreparationActions = new Set<string>(["validate", "build", "package", "write-draft-files"]);

/** The user's current execution grant permits local preparation only. */
export function isAuthorizedPreparationAction(value: unknown): value is LocalPreparationAction {
  return typeof value === "string" && localPreparationActions.has(value);
}
