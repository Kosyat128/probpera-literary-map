/**
 * Shared entry to the existing locale context and authored interface units.
 * Re-exports preserve provider/function identity and do not own locale state.
 * This boundary does not add ICU support or certify translation completeness.
 */
export {
  InterfaceLanguageProvider,
  useInterfaceLanguage,
  translateInterfaceText,
  selectInterfacePlural,
  resolveInitialInterfaceLanguage,
  hasInterfaceTranslation,
  auditInterfaceTranslations,
  assertInterfaceTranslationsComplete,
} from "../i18n/InterfaceLanguage";
export type {
  InterfaceLanguage,
  InterfaceTranslationAudit,
} from "../i18n/InterfaceLanguage";
