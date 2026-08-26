import { useEffect, useState } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

export default function ConnectivityStatus() {
  const { t } = useInterfaceLanguage();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const showUpdate = () => setUpdateReady(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("probpera:pwa-update", showUpdate);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("probpera:pwa-update", showUpdate);
    };
  }, []);

  if (online && !updateReady) return null;

  return (
    <div className="connectivity-status" role="status">
      {!online ? (
        <span>{t("Нет сети - доступны уже открытые материалы")}</span>
      ) : (
        <>
          <span>{t("Доступна новая версия журнала")}</span>
          <button type="button" onClick={() => window.location.reload()}>
            {t("Обновить")}
          </button>
          <button
            className="connectivity-status-dismiss"
            type="button"
            onClick={() => setUpdateReady(false)}
            aria-label={t("Закрыть")}
            title={t("Закрыть")}
          >
            <span aria-hidden="true">×</span>
          </button>
        </>
      )}
    </div>
  );
}
