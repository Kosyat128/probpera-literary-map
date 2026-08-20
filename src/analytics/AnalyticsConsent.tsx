import { useEffect, useState } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  configuredYandexMetrikaCounterId,
  setAnalyticsConsent,
} from "./yandexMetrika";
import { useAnalyticsConsent } from "./useAnalyticsConsent";
import "./analyticsConsent.css";

export default function AnalyticsConsent() {
  const { t } = useInterfaceLanguage();
  const consent = useAnalyticsConsent();
  const [expanded, setExpanded] = useState(consent === "unknown");
  const configured = Boolean(configuredYandexMetrikaCounterId());

  useEffect(() => {
    setExpanded(consent === "unknown");
  }, [consent]);

  if (!configured) return null;

  if (!expanded) {
    return (
      <button
        className="analytics-consent-settings"
        type="button"
        aria-expanded="false"
        aria-controls="analytics-consent-panel"
        onClick={() => setExpanded(true)}
      >
        {t("Настройки статистики")}
      </button>
    );
  }

  return (
    <aside
      id="analytics-consent-panel"
      className="analytics-consent"
      role="region"
      aria-label={t("Настройки статистики")}
    >
      <div>
        <strong>{t("Точная и бережная статистика")}</strong>
        <p>
          {t(
            "Яндекс Метрика поможет увидеть посещаемость по странам и регионам. Она загрузится только с вашего разрешения; Вебвизор отключён."
          )}
        </p>
      </div>
      <div className="analytics-consent__actions">
        <button
          type="button"
          onClick={() => {
            setAnalyticsConsent("granted");
            setExpanded(false);
          }}
        >
          {t("Разрешить статистику")}
        </button>
        <button
          className="analytics-consent__secondary"
          type="button"
          onClick={() => {
            setAnalyticsConsent("denied");
            setExpanded(false);
          }}
        >
          {t("Только необходимые")}
        </button>
      </div>
    </aside>
  );
}
