import { useEffect, useState } from "react";

import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  readAnalyticsConsent,
  type AnalyticsConsent,
} from "./yandexMetrika";

export function useAnalyticsConsent() {
  const [consent, setConsent] = useState<AnalyticsConsent>(() =>
    readAnalyticsConsent()
  );

  useEffect(() => {
    const updateFromConsentEvent = (event: Event) => {
      const next = (event as CustomEvent<{ analytics?: unknown }>).detail
        ?.analytics;
      if (next === "granted" || next === "denied") setConsent(next);
    };
    const updateFromStorage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
        setConsent(readAnalyticsConsent());
      }
    };

    window.addEventListener(ANALYTICS_CONSENT_EVENT, updateFromConsentEvent);
    window.addEventListener("storage", updateFromStorage);
    return () => {
      window.removeEventListener(
        ANALYTICS_CONSENT_EVENT,
        updateFromConsentEvent
      );
      window.removeEventListener("storage", updateFromStorage);
    };
  }, []);

  return consent;
}
