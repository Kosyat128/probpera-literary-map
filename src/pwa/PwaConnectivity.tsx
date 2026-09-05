import { useState, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../planet/localization";
import { usePlatformSnapshot } from "../platform/PlatformServices";
import type { PwaWorkerController } from "./registerPwaWorker";

/** Local preparation copy. Editorial approval remains a bilingual release gate. */
export const pwaUpdateCopy = {
  reviewStatus: "draft", productionReady: false,
  ru: {
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

export default function PwaConnectivity({ controller }: { controller: PwaWorkerController }) {
  const { language, t } = useInterfaceLanguage();
  const { connectivity } = usePlatformSnapshot();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showUpdate = snapshot.update !== null && snapshot.update.buildId !== dismissed;
  const showRollback = snapshot.rollback !== null;
  const busy = snapshot.phase === "activating" || snapshot.phase === "rolling-back" || snapshot.phase === "reloading";
  const copy = pwaUpdateCopy[language];
  if (connectivity !== "offline" && !showUpdate && !showRollback && !busy) return null;
  return (
    <div className="connectivity-status" role="status" aria-live="polite">
      {connectivity === "offline" ? <span>{copy.offline}</span> : null}
      {showUpdate ? <>
        <span>{busy ? copy.busy : snapshot.error ? copy.failed : copy.ready}</span>
        <button type="button" disabled={busy} onClick={() => { void controller.activateUpdate(); }}>{t("Обновить")}</button>
        <button type="button" disabled={busy} className="connectivity-status-dismiss"
          aria-label={t("Закрыть")} onClick={() => setDismissed(snapshot.update?.buildId ?? null)}>
          <span aria-hidden="true">×</span>
        </button>
      </> : null}
      {showRollback ? <>
        {snapshot.phase === "rolling-back" ? <span>{copy.rollingBack}</span> : null}
        {snapshot.error ? <span>{snapshot.error === "multiple-clients" ? copy.closeOtherWindows : copy.rollbackFailed}</span> : null}
        <button type="button" disabled={busy} onClick={() => { void controller.rollback(); }}>{copy.rollback}</button>
      </> : null}
      {busy && !showUpdate && !showRollback ? <span>{copy.busy}</span> : null}
    </div>
  );
}
