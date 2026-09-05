import { useEffect, useState } from "react";

import { useInterfaceLanguage } from "../planet/localization";
import { usePlatformSnapshot } from "../platform/PlatformServices";

export default function ConnectivityStatus() {
  const { t } = useInterfaceLanguage();
  const { connectivity } = usePlatformSnapshot();
  const online = connectivity !== "offline";
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const showUpdate = () => setUpdateReady(true);
    window.addEventListener("probpera:pwa-update", showUpdate);
    return () => {
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
