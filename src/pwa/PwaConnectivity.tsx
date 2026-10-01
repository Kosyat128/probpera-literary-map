import { useState, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../planet/localization";
import { usePlatformSnapshot } from "../platform/PlatformServices";
import type { PwaWorkerController } from "./registerPwaWorker";
import type { PwaAccessVerificationNotice } from "./PwaAccessBoundary";

/** Local preparation copy. Editorial approval remains a bilingual release gate. */
export const pwaUpdateCopy = {
  reviewStatus: "draft", productionReady: false,
  ru: {
    offlineTitle: "Без сети",
    accessTitle: "Состояние доступа",
    checkingShort: "Проверяем доступ…",
    savedShort: "Доступ проверен ранее",
    verifiedShort: "Доступ подтверждён",
    details: "Подробнее",
    offline: "Нет сети. Доступ зависит от сохранённых материалов и подтверждённого права доступа.",
    ready: "Доступно обновление приложения.",
    busy: "Устанавливаем проверенное обновление…",
    failed: "Обновление не завершено. Можно повторить попытку.",
    rollback: "Вернуть предыдущую версию",
    rollingBack: "Возвращаем проверенную предыдущую версию…",
    rollbackFailed: "Не удалось вернуть предыдущую версию. Можно повторить попытку.",
    closeOtherWindows: "Для возврата версии закройте другие окна приложения и повторите попытку.",
  },
  en: {
    offlineTitle: "Offline",
    accessTitle: "Access status",
    checkingShort: "Checking access…",
    savedShort: "Access verified earlier",
    verifiedShort: "Verified access",
    details: "Details",
    offline: "You are offline. Access depends on saved content and a verified license.",
    ready: "An app update is available.",
    busy: "Installing the verified update…",
    failed: "The update did not finish. You can try again.",
    rollback: "Restore previous version",
    rollingBack: "Restoring the verified previous version…",
    rollbackFailed: "The previous version could not be restored. You can try again.",
    closeOtherWindows: "Close other app windows, then try restoring the previous version again.",
  },
} as const;

export default function PwaConnectivity({ controller, verificationNotice = null }: {
  controller: PwaWorkerController;
  verificationNotice?: PwaAccessVerificationNotice | null;
}) {
  const { language, t } = useInterfaceLanguage();
  const { connectivity } = usePlatformSnapshot();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showUpdate = snapshot.update !== null && snapshot.update.buildId !== dismissed;
  const showRollback = snapshot.rollback !== null;
  const busy = snapshot.phase === "activating" || snapshot.phase === "rolling-back" || snapshot.phase === "reloading";
  const copy = pwaUpdateCopy[language];
  const offline = connectivity === "offline";
  const showStatus = offline || verificationNotice !== null;
  const shortVerification = verificationNotice?.checking ? copy.checkingShort
    : verificationNotice?.source === "saved" ? copy.savedShort : copy.verifiedShort;
  if (!showStatus && !showUpdate && !showRollback && !busy) return null;
  return (
    <div className="connectivity-status pwa-status-card">
      {showStatus ? <details className="pwa-status-card__details">
        <summary>
          <span className="pwa-status-card__summary-text" role="status" aria-live="polite" aria-atomic="true">
            <strong>{offline ? copy.offlineTitle : copy.accessTitle}</strong>
            {verificationNotice ? <small>{shortVerification}</small> : null}
          </span>
          <span className="pwa-status-card__disclosure">{copy.details}<span aria-hidden="true" /></span>
        </summary>
        <div className="pwa-status-card__body">
          {verificationNotice ? <div className="pwa-access__refresh" role="status" aria-live="polite" aria-atomic="true"
            data-pwa-access-verification={verificationNotice.source ?? undefined}>
            {verificationNotice.text}
          </div> : null}
          {offline ? <p>{copy.offline}</p> : null}
        </div>
      </details> : null}
      {showUpdate || showRollback || busy ? <div className="pwa-status-card__actions">
        {showUpdate ? <>
          <span className="pwa-status-card__message" role="status" aria-live="polite" aria-atomic="true">{busy ? copy.busy : snapshot.error ? copy.failed : copy.ready}</span>
          <button type="button" disabled={busy} onClick={() => { void controller.activateUpdate(); }}>{t("Обновить")}</button>
          <button type="button" disabled={busy} className="connectivity-status-dismiss"
            aria-label={t("Закрыть")} onClick={() => setDismissed(snapshot.update?.buildId ?? null)}>
            <span aria-hidden="true">×</span>
          </button>
        </> : null}
        {showRollback ? <>
          {snapshot.phase === "rolling-back" ? <span className="pwa-status-card__message" role="status" aria-live="polite" aria-atomic="true">{copy.rollingBack}</span> : null}
          {snapshot.error ? <span className="pwa-status-card__message" role="status" aria-live="polite" aria-atomic="true">{snapshot.error === "multiple-clients" ? copy.closeOtherWindows : copy.rollbackFailed}</span> : null}
          <button type="button" disabled={busy} onClick={() => { void controller.rollback(); }}>{copy.rollback}</button>
        </> : null}
        {busy && !showUpdate && !showRollback ? <span className="pwa-status-card__message" role="status" aria-live="polite" aria-atomic="true">{copy.busy}</span> : null}
      </div> : null}
    </div>
  );
}
