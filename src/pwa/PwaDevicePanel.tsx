import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { PwaInstallController } from "./PwaInstallController";
import type { PwaOfflineReadinessResult, PwaWorkerController } from "./registerPwaWorker";

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
    incomplete: "Часть базовых файлов отсутствует или повреждена. Подключитесь к сети и откройте нужные материалы перед поездкой.",
    unavailable: "Сейчас проверить файлы не удалось. Повторите попытку после завершения загрузки приложения.",
    limit: "Проверка не продлевает право доступа и не включает дополнительные материалы. Браузер может удалить сохранённые файлы позднее.",
    storageTitle: "Место на устройстве", measuring: "Проверяем хранилище…", usage: "Примерно занято", quota: "Лимит браузера", unit: "МБ", largeUnit: "ГБ",
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
    incomplete: "Some base files are missing or damaged. Connect to the internet and open the content you need before travelling.",
    unavailable: "The files could not be checked now. Try again after the app finishes loading.",
    limit: "This check does not extend access or include additional content. The browser may remove saved files later.",
    storageTitle: "Device storage", measuring: "Checking storage…", usage: "Approximate usage", quota: "Browser allowance", unit: "MB", largeUnit: "GB",
    originScope: "This estimate covers all data for this site, including its other pages.",
    unknown: "The browser did not provide a storage estimate.", storageError: "Storage could not be checked. You can try again.",
    refresh: "Refresh estimate", protect: "Request persistent storage", requesting: "Waiting for the browser’s decision…",
    persistent: "The browser granted persistent storage. Clearing site data manually still removes it.",
    temporary: "The browser may remove data when storage runs low.",
    denied: "The browser did not grant persistent storage. Saved data remains available while the browser retains it.",
    persistenceUnknown: "The storage mode could not be checked.",
  },
} as const;

type StorageState = {
  busy: "estimate" | "persist" | null; usage: number | null; quota: number | null;
  persisted: boolean | null; canPersist: boolean; denied: boolean; error: boolean;
};
const initialStorage: StorageState = { busy: "estimate", usage: null, quota: null, persisted: null, canPersist: false, denied: false, error: false };
const validBytes = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

function useStorageStatus() {
  const [state, setState] = useState(initialStorage);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    const storage = globalThis.navigator?.storage;
    if (!storage) { if (mounted.current) setState({ ...initialStorage, busy: null }); return; }
    setState(previous => ({ ...previous, busy: "estimate", error: false }));
    const [estimate, persisted] = await Promise.allSettled([
      Promise.resolve().then(() => storage.estimate?.()),
      Promise.resolve().then(() => storage.persisted?.()),
    ]);
    if (!mounted.current || sequence.current !== id) return;
    setState({ busy: null,
      usage: estimate.status === "fulfilled" ? validBytes(estimate.value?.usage) : null,
      quota: estimate.status === "fulfilled" ? validBytes(estimate.value?.quota) : null,
      persisted: persisted.status === "fulfilled" && typeof persisted.value === "boolean" ? persisted.value : null,
      canPersist: typeof storage.persist === "function", denied: false,
      error: estimate.status === "rejected" || persisted.status === "rejected",
    });
  }, []);
  const requestPersistence = useCallback(async () => {
    const storage = globalThis.navigator?.storage;
    if (!storage?.persist || !mounted.current) return;
    const id = ++sequence.current;
    setState(previous => ({ ...previous, busy: "persist", error: false }));
    try {
      // Called directly from a user action, never from mount or locale changes.
      const persisted = await storage.persist();
      if (mounted.current && sequence.current === id) {
        setState(previous => ({ ...previous, busy: null, persisted, denied: !persisted }));
      }
    } catch {
      if (mounted.current && sequence.current === id) setState(previous => ({ ...previous, busy: null, error: true }));
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; sequence.current++; };
  }, [refresh]);
  return { state, refresh, requestPersistence };
}

export default function PwaDevicePanel({ install, worker }: { install: PwaInstallController; worker: PwaWorkerController }) {
  const { language } = useInterfaceLanguage();
  const copy = pwaDeviceCopy[language];
  const installation = useSyncExternalStore(install.subscribe, install.getSnapshot, install.getSnapshot);
  const workerState = useSyncExternalStore(worker.subscribe, worker.getSnapshot, worker.getSnapshot);
  const [offline, setOffline] = useState<PwaOfflineReadinessResult | null>(null);
  const [checking, setChecking] = useState(false);
  const request = useRef<AbortController | null>(null);
  const storage = useStorageStatus();
  useEffect(() => () => { request.current?.abort(); }, []);
  const checkOffline = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
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
  const currentCheck = offline && offline.status !== "unavailable"
    && (offline.engineBuildId !== workerState.engineBuildId || offline.activeBuildId !== workerState.activeBuildId)
    ? null : offline;
  const installText = installation.phase === "installed"
    ? installation.installationEvidence === "standalone" ? copy.standalone : copy.installed
    : installation.phase === "available" ? copy.available
    : installation.phase === "prompting" ? copy.prompting
    : installation.phase === "accepted" ? copy.accepted
    : installation.phase === "dismissed" ? copy.dismissed
    : installation.phase === "error" ? copy.installError : copy.manual;
  const size = (value: number) => {
    const large = value >= 1_000_000_000;
    const number = new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 1 })
      .format(value / (large ? 1_000_000_000 : 1_000_000));
    return `${number} ${large ? copy.largeUnit : copy.unit}`;
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
        <button type="button" disabled={checking} onClick={() => { void checkOffline(); }}>{copy.check}</button>
        <p className="pwa-device__note">{copy.limit}</p>
      </section>
      <section aria-label={copy.storageTitle}>
        <h3>{copy.storageTitle}</h3>
        <p role="status">{storage.state.busy === "persist" ? copy.requesting : storage.state.busy ? copy.measuring : storage.state.error ? copy.storageError : persistenceText}</p>
        {storage.state.usage !== null ? <dl>
          <div><dt>{copy.usage}</dt><dd>{size(storage.state.usage)}</dd></div>
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
