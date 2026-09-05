import type { InterfaceLanguage } from "../planet/localization";

export interface PwaAccessCopy {
  readonly heading: string;
  readonly preparing: string;
  readonly checking: string;
  readonly denied: string;
  readonly expired: string;
  readonly revoked: string;
  readonly clock: string;
  readonly offline: string;
  readonly storage: string;
  readonly network: string;
  readonly retry: string;
  readonly journal: string;
}

/** Preparation/QA copy only. This is not an editorial or legal approval. */
export const pwaCopy = {
  source: "ai-draft",
  reviewStatus: "draft",
  productionReady: false,
  releaseReady: false,
  locales: {
    ru: {
      heading: "Доступ к приложению",
      preparing: "Доступ к приложению ещё готовится. Пока можно открыть журнал.",
      checking: "Проверяем доступ…",
      denied: "Не удалось подтвердить право доступа. Повторите проверку или откройте журнал.",
      expired: "Для продолжения нужна новая проверка доступа. Подключитесь к интернету и повторите попытку.",
      revoked: "Право доступа к этой версии больше не действует.",
      clock: "Проверьте дату и время на устройстве, затем повторите попытку.",
      offline: "Сейчас нет подтверждённого доступа без сети. Подключитесь к интернету и повторите проверку.",
      storage: "Не удаётся прочитать или сохранить данные доступа. Проверьте свободное место и настройки браузера, затем повторите попытку.",
      network: "Сейчас не удаётся проверить доступ. Повторите попытку, когда появится соединение.",
      retry: "Проверить снова",
      journal: "Открыть журнал «Проба Пера»",
    },
    en: {
      heading: "App access",
      preparing: "App access is being prepared. You can open the journal in the meantime.",
      checking: "Checking access…",
      denied: "Your access could not be verified. Try checking again or open the journal.",
      expired: "Access needs to be checked again before you can continue. Connect to the internet and try again.",
      revoked: "Your access to this edition is no longer valid.",
      clock: "Check the date and time on your device, then try again.",
      offline: "Verified offline access is not available right now. Connect to the internet and check again.",
      storage: "Access data cannot be read or saved. Check available space and browser settings, then try again.",
      network: "Access cannot be checked right now. Try again when a connection is available.",
      retry: "Check again",
      journal: "Open the Proba Pera journal",
    },
  } satisfies Readonly<Record<InterfaceLanguage, PwaAccessCopy>>,
} as const;
