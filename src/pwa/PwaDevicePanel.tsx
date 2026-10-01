import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { PwaInstallController } from "./PwaInstallController";
import type { PwaOfflineReadinessResult, PwaOfflineRepairResult, PwaWorkerController } from "./registerPwaWorker";
import { usePwaOfflineRepairAccess } from "./PwaAccessBoundary";
import { createPwaStorageStatus } from "./PwaStorageStatus";

/** Implementation drafts; synchronized editorial approval remains a release gate. */
export const pwaDeviceCopy = {
  reviewStatus: "draft", productionReady: false,
  ru: {
    title: "Приложение на устройстве", installTitle: "Быстрый запуск",
    available: "Открывайте планету с экрана устройства в отдельном окне.",
    install: "Установить приложение", prompting: "Завершите выбор в окне браузера.",
    accepted: "Запрос принят. Дождитесь завершения установки браузером.",
    installed: "Браузер сообщил об установке. Ярлык появится после её завершения.",
    standalone: "Планета открыта в отдельном окне приложения.",
    dismissed: "Установка отменена. Можно продолжить работу в браузере.",
    installError: "Установку не удалось начать. Можно воспользоваться меню браузера.",
    manual: "Если в меню браузера есть «Установить приложение» или «Добавить на главный экран», выберите этот пункт.",
    offlineTitle: "Перед поездкой", check: "Проверить офлайн-файлы", checking: "Проверяем сохранённые файлы…",
    unchecked: "Проверьте базовые файлы перед использованием без сети.",
    complete: "Все базовые файлы прошли проверку на этом устройстве.",
    verifiedFiles: "Проверенный набор",
    incomplete: "Часть базовых файлов отсутствует или повреждена. Подключитесь к сети и восстановите офлайн-файлы перед поездкой.",
    repair: "Восстановить офлайн-файлы", repairing: "Восстанавливаем недостающие файлы и проверяем весь базовый набор…",
    cancelRepair: "Остановить восстановление", repaired: "Базовые файлы восстановлены и прошли полную проверку на этом устройстве.",
    repairIncomplete: "Восстановление не завершено. Некоторые проверенные файлы уже могли сохраниться. Проверьте подключение и свободное место, затем повторите попытку.",
    restoredFiles: "Восстановлено за попытку",
    repairUnavailable: "Восстановление остановлено или сейчас недоступно. Некоторые файлы уже могли сохраниться. Проверьте доступ и подключение, затем повторите проверку файлов.",
    repairMissingManifest: "Сведения о сохранённой версии отсутствуют. Подключитесь к сети и заново откройте приложение, чтобы загрузить доступную версию.",
    repairNote: "Загружаются только недостающие или повреждённые базовые файлы. Восстановление использует интернет и не продлевает доступ.",
    offlineDetails: "Как работает офлайн",
    unavailable: "Сейчас проверить файлы не удалось. Повторите попытку после завершения загрузки приложения.",
    limit: "Проверка не продлевает право доступа и не включает дополнительные материалы. Браузер может удалить сохранённые файлы позднее.",
    storageTitle: "Место на устройстве", measuring: "Проверяем хранилище…", usage: "Примерно занято", quota: "Лимит браузера", byteUnit: "Б", smallUnit: "КБ", unit: "МБ", largeUnit: "ГБ",
    originScope: "Оценка относится ко всем данным этого сайта, включая другие его страницы.",
    unknown: "Браузер не предоставил оценку места.", storageError: "Не удалось проверить хранилище. Можно повторить попытку.",
    refresh: "Обновить оценку", protect: "Запросить сохранение данных", requesting: "Ожидаем решение браузера…",
    persistent: "Браузер разрешил постоянное хранение. Ручная очистка данных по-прежнему удаляет их.",
    temporary: "Браузер может удалить данные при нехватке места.",
    denied: "Браузер не разрешил постоянное хранение. Сохранённые данные остаются доступными, пока он их хранит.",
    persistenceUnknown: "Режим хранения недоступен для проверки.",
  },
  en: {
    title: "App on this device", installTitle: "Quick access",
    available: "Open the planet from your device in its own app window.",
    install: "Install app", prompting: "Complete your choice in the browser dialog.",
    accepted: "Request accepted. Wait for the browser to finish installing the app.",
    installed: "The browser reported an installation. The shortcut will appear when it finishes.",
    standalone: "The planet is open in its own app window.",
    dismissed: "Installation cancelled. You can continue in the browser.",
    installError: "Installation could not start. You can use the browser menu.",
    manual: "If your browser offers Install app or Add to Home Screen in its menu, select that option.",
    offlineTitle: "Before you travel", check: "Check offline files", checking: "Checking saved files…",
    unchecked: "Check the base files before using the app offline.",
    complete: "All base files passed verification on this device.",
    verifiedFiles: "Verified base package",
    incomplete: "Some base files are missing or damaged. Connect to the internet and restore the offline files before travelling.",
    repair: "Restore offline files", repairing: "Restoring missing files and checking the entire base package…",
    cancelRepair: "Stop restoring", repaired: "Base files have been restored and passed a full check on this device.",
    repairIncomplete: "Restoration is incomplete. Some verified files may already have been saved. Check your connection and free space, then try again.",
    restoredFiles: "Restored this attempt",
    repairUnavailable: "Restoration has stopped or is unavailable now. Some files may already have been saved. Check your access and connection, then check the files again.",
    repairMissingManifest: "The saved version’s information is missing. Connect to the internet and reopen the app to load an available version.",
    repairNote: "Only missing or damaged base files are downloaded. Restoration uses the internet and does not extend access.",
    offlineDetails: "How offline works",
    unavailable: "The files could not be checked now. Try again after the app finishes loading.",
    limit: "This check does not extend access or include additional content. The browser may remove saved files later.",
    storageTitle: "Device storage", measuring: "Checking storage…", usage: "Approximate usage", quota: "Browser allowance", byteUnit: "B", smallUnit: "kB", unit: "MB", largeUnit: "GB",
    originScope: "This estimate covers all data for this site, including its other pages.",
    unknown: "The browser did not provide a storage estimate.", storageError: "Storage could not be checked. You can try again.",
    refresh: "Refresh estimate", protect: "Request persistent storage", requesting: "Waiting for the browser’s decision…",
    persistent: "The browser granted persistent storage. Clearing site data manually still removes it.",
    temporary: "The browser may remove data when storage runs low.",
    denied: "The browser did not grant persistent storage. Saved data remains available while the browser retains it.",
    persistenceUnknown: "The storage mode could not be checked.",
  },
} as const;

function useStorageStatus() {
  const controller = useMemo(() => createPwaStorageStatus(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => controller.activate(), [controller]);
  return { state, refresh: controller.refresh, requestPersistence: controller.requestPersistence };
}

export default function PwaDevicePanel({ install, worker }: { install: PwaInstallController; worker: PwaWorkerController }) {
  const { language } = useInterfaceLanguage();
  const copy = pwaDeviceCopy[language];
  const installation = useSyncExternalStore(install.subscribe, install.getSnapshot, install.getSnapshot);
  const workerState = useSyncExternalStore(worker.subscribe, worker.getSnapshot, worker.getSnapshot);
  const [offline, setOffline] = useState<PwaOfflineReadinessResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repair, setRepair] = useState<PwaOfflineRepairResult | null>(null);
  const repairAccess = usePwaOfflineRepairAccess();
  const repairRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const storage = useStorageStatus();
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; request.current?.abort(); repairRequest.current?.abort();
  }; }, []);
  const checkOffline = async () => {
    if (request.current || repairRequest.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true); setRepair(null);
    try {
      const result = await worker.checkOfflineReadiness({ signal: controller.signal });
      if (!controller.signal.aborted) setOffline(result);
    } catch {
      if (!controller.signal.aborted) setOffline({ status: "unavailable", reason: "rejected" });
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setChecking(false);
    }
  };
  const restoreOffline = async () => {
    if (request.current || repairRequest.current) return;
    const controller = new AbortController(); repairRequest.current = controller;
    setRepairing(true); setRepair(null); setOffline(null);
    try {
      const result = await worker.repairOfflineBase({ access: repairAccess, signal: controller.signal });
      if (!mounted.current || repairRequest.current !== controller) return;
      setRepair(result);
      if (result.status === "complete") setOffline({ status: "complete", engineBuildId: result.engineBuildId,
        activeBuildId: result.activeBuildId, fileCount: result.fileCount, bytes: result.bytes });
      else if (result.status === "incomplete") setOffline({ status: "incomplete", engineBuildId: result.engineBuildId, activeBuildId: result.activeBuildId });
    } catch { if (mounted.current) setRepair({ status: "unavailable", reason: "rejected" }); }
    finally {
      if (repairRequest.current === controller) repairRequest.current = null;
      if (mounted.current) setRepairing(false);
    }
  };
  const currentCheck = offline && offline.status !== "unavailable"
    && (offline.engineBuildId !== workerState.engineBuildId || offline.activeBuildId !== workerState.activeBuildId)
    ? null : offline;
  const currentRepair = repair && repair.status !== "unavailable"
    && (repair.engineBuildId !== workerState.engineBuildId || repair.activeBuildId !== workerState.activeBuildId) ? null : repair;
  const repairText = repairing ? copy.repairing : currentRepair?.status === "complete" ? copy.repaired
    : currentRepair?.status === "incomplete" ? copy.repairIncomplete
    : currentRepair?.status === "unavailable" ? currentRepair.reason === "missing-manifest" ? copy.repairMissingManifest : copy.repairUnavailable : null;
  const installText = installation.phase === "installed"
    ? installation.installationEvidence === "standalone" ? copy.standalone : copy.installed
    : installation.phase === "available" ? copy.available
    : installation.phase === "prompting" ? copy.prompting
    : installation.phase === "accepted" ? copy.accepted
    : installation.phase === "dismissed" ? copy.dismissed
    : installation.phase === "error" ? copy.installError : copy.manual;
  const size = (value: number) => {
    const divisor = value >= 1_000_000_000 ? 1_000_000_000 : value >= 1_000_000 ? 1_000_000 : value >= 1_000 ? 1_000 : 1;
    const unit = divisor === 1_000_000_000 ? copy.largeUnit : divisor === 1_000_000 ? copy.unit : divisor === 1_000 ? copy.smallUnit : copy.byteUnit;
    const number = new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 1 })
      .format(value / divisor);
    return `${number} ${unit}`;
  };
  const persistenceText = storage.state.denied ? copy.denied : storage.state.persisted === true ? copy.persistent
    : storage.state.persisted === false ? copy.temporary : copy.persistenceUnknown;
  return <section className="pwa-device" aria-label={copy.title}>
    <h2>{copy.title}</h2>
    <div className="pwa-device__cards">
      <section aria-label={copy.installTitle}>
        <h3>{copy.installTitle}</h3>
        <p role="status">{installText}</p>
        {installation.phase === "available" ? <button type="button" onClick={() => { void install.requestInstall(); }}>{copy.install}</button> : null}
        {["dismissed", "error"].includes(installation.phase) ? <p>{copy.manual}</p> : null}
      </section>
      <section aria-label={copy.offlineTitle}>
        <h3>{copy.offlineTitle}</h3>
        <p role="status" data-pwa-offline-readiness={checking ? "checking" : currentCheck?.status ?? "unchecked"}>
          {checking ? copy.checking : currentCheck ? copy[currentCheck.status] : copy.unchecked}
        </p>
        {!checking && !repairing && currentCheck?.status === "complete" ? <p className="pwa-device__note">
          {copy.verifiedFiles}: <span className="pwa-device__value">{currentCheck.fileCount} · {size(currentCheck.bytes)}</span>
        </p> : null}
        <button type="button" disabled={checking || repairing} onClick={() => { void checkOffline(); }}>{copy.check}</button>
        <div className="pwa-device__actions">
          <button type="button" disabled={checking || repairing || !repairAccess} onClick={() => { void restoreOffline(); }}>{copy.repair}</button>
          {repairing ? <button type="button" onClick={() => { repairRequest.current?.abort(); }}>{copy.cancelRepair}</button> : null}
        </div>
        {repairText ? <p role="status" data-pwa-offline-repair={repairing ? "repairing" : currentRepair?.status}>{repairText}</p> : null}
        {!checking && !repairing && currentRepair && (currentRepair.status === "complete" || currentRepair.status === "incomplete") ? <p className="pwa-device__note">
          {copy.restoredFiles}: <span className="pwa-device__value">{currentRepair.repairedFiles} · {size(currentRepair.repairedBytes)}</span>
        </p> : null}
        <details className="pwa-device__offline-help">
          <summary>{copy.offlineDetails}</summary>
          <p className="pwa-device__note">{copy.repairNote}</p>
          <p className="pwa-device__note">{copy.limit}</p>
        </details>
      </section>
      <section aria-label={copy.storageTitle}>
        <h3>{copy.storageTitle}</h3>
        <p role="status">{storage.state.busy === "persist" ? copy.requesting : storage.state.busy ? copy.measuring : storage.state.error ? copy.storageError : persistenceText}</p>
        {storage.state.usage !== null || storage.state.quota !== null ? <dl>
          {storage.state.usage !== null ? <div><dt>{copy.usage}</dt><dd>{size(storage.state.usage)}</dd></div> : null}
          {storage.state.quota !== null ? <div><dt>{copy.quota}</dt><dd>{size(storage.state.quota)}</dd></div> : null}
        </dl> : !storage.state.busy ? <p>{copy.unknown}</p> : null}
        <div className="pwa-device__actions">
          <button type="button" disabled={Boolean(storage.state.busy)} onClick={() => { void storage.refresh(); }}>{copy.refresh}</button>
          {storage.state.canPersist && storage.state.persisted !== true ? <button type="button" disabled={Boolean(storage.state.busy)} onClick={() => { void storage.requestPersistence(); }}>{copy.protect}</button> : null}
        </div>
        <p className="pwa-device__note">{copy.originScope}</p>
      </section>
    </div>
  </section>;
}
