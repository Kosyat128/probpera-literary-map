import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { ContentDownloads, ContentDownloadPhase, ContentDownloadItem } from "../planet/ContentDownloads";
import "./PlanetDownloadsPanel.css";

/** Implementation copy; bilingual editorial acceptance remains a release gate. */
export const planetDownloadsCopy = {
  reviewStatus: "draft", productionReady: false,
  locales: {
    ru: {
      heading: "Загрузки", empty: "Дополнительных пакетов для загрузки пока нет.",
      description: "При сворачивании приложения или потере сети загрузка приостанавливается. Нажмите «Продолжить загрузку», когда будете готовы. Проверенные файлы сохраняются и после перезапуска.",
      check: "Проверить файлы", download: "Загрузить", retry: "Повторить загрузку", cancel: "Отменить", pause: "Приостановить", resume: "Продолжить загрузку",
      qa: "Проверочный пакет: его содержимое пока не добавляется в литературный архив.",
      bytes: "байт", progress: "Получение файлов",
      network: { label: "Загружать только по Wi-Fi", help: "При смене сети загрузка приостанавливается. Продолжение — по вашей команде.",
        unknown: "Тип сети не определён. Загрузка только по Wi-Fi доступна после подтверждения соединения платформой.",
        wifi: "Подключение: Wi-Fi.", cellular: "Подключение: мобильная сеть.", ethernet: "Подключение: проводная сеть.",
        loading: "Читаем настройку…", saving: "Сохраняем настройку…", session: "Настройка действует в этом сеансе; сохранение после перезапуска не подтверждено." },
      size: "Размер пакета", savedVersion: "Сохранённая версия", update: "Обновить пакет", clear: "Удалить незавершённую загрузку",
      clearHelp: "При очистке незавершённой загрузки удаляются только её файлы. Текущая и предыдущая сохранённые версии защищены. Для повторной загрузки понадобится сеть.",
      removal: { action: "Удалить сохранённый пакет", cleanup: "Завершить очистку", confirm: "Подтвердить удаление", close: "Закрыть",
        heading: "Удаление пакета", version: "Версия", question: "Удалить этот дополнительный пакет и его резервную версию с устройства? Для повторной загрузки потребуется сеть.",
        changed: "Состояние пакета изменилось. Если удаление ещё требуется, проверьте файлы и откройте подтверждение заново." },
      space: { check: "Проверить место", unchecked: "Доступное место ещё не проверено.", checking: "Проверяем доступное место…",
        unavailable: "Не удалось определить доступное место. Можно повторить проверку.",
        browser: "Доступно приложению по оценке браузера", device: "Доступно на устройстве",
        note: "Значение на момент проверки. Доступный объём может измениться." },
      phases: {
        unchecked: "Файлы ещё не проверены.", checking: "Проверяем сохранённые файлы…", "not-saved": "Пакет ещё не сохранён.",
        downloading: "Загружаем файлы…", verifying: "Проверяем пакет перед сохранением…", cancelling: "Завершаем отмену…",
        pausing: "Приостанавливаем загрузку…", paused: "Загрузка приостановлена. Проверенные файлы сохранены. Для продолжения откройте приложение и подключитесь к сети.",
        "waiting-wifi": "Загрузка приостановлена настройкой «Только по Wi-Fi». Подключитесь к Wi-Fi или измените настройку, затем нажмите «Продолжить загрузку».",
        saved: "Пакет сохранён и проверен на этом устройстве.", cancelled: "Загрузка отменена. Проверенные файлы можно использовать при повторной загрузке.",
        error: "Не удалось сохранить и проверить пакет. Проверьте соединение и свободное место, затем повторите загрузку.",
        unavailable: "Хранилище загрузок недоступно. Закройте и снова откройте приложение, затем повторите проверку.",
        clearing: "Удаляем незавершённую загрузку…", cleared: "Файлы незавершённой загрузки отсутствуют. Сохранённые версии не затронуты.",
        protected: "Эта версия сохранена для офлайн-доступа или восстановления и защищена от удаления.",
        "clear-error": "Не удалось подтвердить удаление. Проверьте файлы или повторите очистку.",
        uninstalling: "Удаляем сохранённый пакет…", uninstalled: "Дополнительный пакет удалён с устройства. Его можно загрузить снова.",
        "cleanup-pending": "Пакет больше не доступен офлайн. Очистка его файлов ещё не завершена. Нажмите «Завершить очистку».",
        "uninstall-error": "Не удалось подтвердить удаление пакета. Проверьте файлы, затем повторите удаление.",
        "update-available": "Доступно обновление.",
      },
    },
    en: {
      heading: "Downloads", empty: "There are no additional packages to download yet.",
      description: "Downloads pause when the app is in the background or the connection is lost. Select Resume download when you are ready. Verified files are kept after restarting too.",
      check: "Check files", download: "Download", retry: "Retry download", cancel: "Cancel", pause: "Pause", resume: "Resume download",
      qa: "Test package: its content is not yet added to the literary archive.",
      bytes: "bytes", progress: "Receiving files",
      network: { label: "Download over Wi-Fi only", help: "Downloads pause when the connection changes. You choose when to resume.",
        unknown: "The connection type is unknown. Wi-Fi-only downloads require the platform to confirm a Wi-Fi connection.",
        wifi: "Connection: Wi-Fi.", cellular: "Connection: mobile network.", ethernet: "Connection: wired network.",
        loading: "Reading preference…", saving: "Saving preference…", session: "This preference applies to this session; persistence after restart has not been confirmed." },
      size: "Package size", savedVersion: "Saved version", update: "Update package", clear: "Remove unfinished download",
      clearHelp: "Removing an unfinished download only clears its incomplete files. Current and previous saved versions stay protected. Downloading again will require a connection.",
      removal: { action: "Remove saved package", cleanup: "Finish cleanup", confirm: "Confirm removal", close: "Close",
        heading: "Remove package", version: "Version", question: "Remove this optional package and its backup version from this device? Downloading them again will require a connection.",
        changed: "The package state has changed. If removal is still needed, check the files and open the confirmation again." },
      space: { check: "Check space", unchecked: "Available space has not been checked yet.", checking: "Checking available space…",
        unavailable: "Available space could not be determined. You can check again.",
        browser: "Estimated space available to the app in this browser", device: "Available on this device",
        note: "Space at the time of checking. The available amount may change." },
      phases: {
        unchecked: "Files have not been checked yet.", checking: "Checking saved files…", "not-saved": "The package has not been saved yet.",
        downloading: "Downloading files…", verifying: "Checking the package before saving…", cancelling: "Finishing cancellation…",
        pausing: "Pausing the download…", paused: "Download paused. Verified files have been kept. Open the app and connect to the network to continue.",
        "waiting-wifi": "Download paused by the Wi-Fi-only preference. Connect to Wi-Fi or change the preference, then select Resume download.",
        saved: "The package is saved and verified on this device.", cancelled: "Download cancelled. Verified files can be reused when you retry.",
        error: "The package could not be saved and verified. Check your connection and free space, then retry the download.",
        unavailable: "Download storage is unavailable. Close and reopen the app, then check again.",
        clearing: "Removing unfinished download…", cleared: "No unfinished download files remain. Saved versions are unchanged.",
        protected: "This version is saved for offline access or recovery and is protected from removal.",
        "clear-error": "Removal could not be confirmed. Check the files or try removing them again.",
        uninstalling: "Removing the saved package…", uninstalled: "The optional package has been removed from this device. You can download it again.",
        "cleanup-pending": "The package is no longer available offline. Its files still need cleanup. Select Finish cleanup.",
        "uninstall-error": "Package removal could not be confirmed. Check the files, then try removing it again.",
        "update-available": "An update is available.",
      },
    },
  },
} as const;
const working = new Set<ContentDownloadPhase>(["checking", "downloading", "verifying", "pausing", "cancelling", "clearing", "uninstalling"]);
const progressPhases = new Set<ContentDownloadPhase>(["downloading", "verifying", "pausing", "paused", "waiting-wifi", "cancelling"]);

function PackageRemoval({ item, downloads, copy, busy }: {
  item: ContentDownloadItem; downloads: ContentDownloads; busy: boolean;
  copy: (typeof planetDownloadsCopy.locales)["ru" | "en"]["removal"];
}) {
  const [confirmation, setConfirmation] = useState<{ receipt: string; version: number } | null>(null);
  const { language } = useInterfaceLanguage();
  const action = useRef<HTMLButtonElement>(null), id = useId();
  const removable = item.optional && !!item.removalReceipt && item.savedVersion !== null && ["saved", "update-available", "protected", "cleanup-pending"].includes(item.phase);
  const matches = confirmation?.receipt === item.removalReceipt && confirmation?.version === item.savedVersion;
  return <div className="planet-downloads__removal">
    <button type="button" ref={action} aria-disabled={busy || !removable} aria-expanded={confirmation !== null} aria-controls={id}
      onClick={() => { if (!busy && removable) setConfirmation({ receipt: item.removalReceipt!, version: item.savedVersion! }); }}>
      {item.phase === "cleanup-pending" ? copy.cleanup : copy.action}
    </button>
    {confirmation !== null && <div id={id} className="planet-downloads__confirmation" role="group" aria-labelledby={`${id}-heading`}>
      <p id={`${id}-heading`}><strong>{copy.heading}: {item.title[language]}</strong></p>
      <p>{copy.version}: {new Intl.NumberFormat(language).format(confirmation.version)}</p>
      <p>{copy.question}</p>
      {!matches && !["uninstalled", "cleanup-pending"].includes(item.phase) && <p role="status">{copy.changed}</p>}
      <div className="planet-downloads__actions">
        <button type="button" aria-disabled={busy || !removable || !matches}
          onClick={() => {
            if (!busy && removable && matches) {
              const confirmed = confirmation.receipt;
              setConfirmation(null); action.current?.focus();
              void downloads.uninstall(item.id, confirmed);
            }
          }}>{copy.confirm}</button>
        <button type="button" onClick={() => { setConfirmation(null); action.current?.focus(); }}>{copy.close}</button>
      </div>
    </div>}
  </div>;
}

export default function PlanetDownloadsPanel({ downloads }: { downloads: ContentDownloads }) {
  const { language } = useInterfaceLanguage();
  const snapshot = useSyncExternalStore(downloads.subscribe, downloads.getSnapshot, downloads.getSnapshot);
  useEffect(() => { void downloads.loadNetworkPreference(); }, [downloads]);
  const copy = planetDownloadsCopy.locales[language], id = useId();
  const number = new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US");
  return <details className="planet-downloads" data-planet-downloads="">
    <summary>{copy.heading}</summary>
    <div className="planet-downloads__body">
      <div className="planet-downloads__network" data-download-network={snapshot.network.type}>
        <label className="planet-downloads__network-toggle">
          <input type="checkbox" checked={snapshot.network.policy === "wifi-only"} aria-describedby={`${id}-network`}
            onChange={event => { void downloads.setNetworkPolicy(event.target.checked ? "wifi-only" : "any-network"); }} />
          <span>{copy.network.label}</span>
        </label>
        <p id={`${id}-network`} role="status" aria-live="polite" aria-atomic="true">
          {copy.network[snapshot.network.type]} {copy.network.help}
          {snapshot.network.status === "loading" || snapshot.network.status === "unloaded" ? ` ${copy.network.loading}`
            : snapshot.network.status === "saving" ? ` ${copy.network.saving}` : snapshot.network.status === "session-only" ? ` ${copy.network.session}` : ""}
        </p>
      </div>
      <div className="planet-downloads__space" data-storage-space={snapshot.space.phase}>
        <p id={`${id}-space`} role="status" aria-live="polite" aria-atomic="true">
          {snapshot.space.phase === "ready"
            ? `${snapshot.space.kind === "browser-estimate" ? copy.space.browser : copy.space.device}: ${number.format(snapshot.space.availableBytes!)} ${copy.bytes}. ${copy.space.note}`
            : copy.space[snapshot.space.phase]}
        </p>
        <button type="button" aria-disabled={snapshot.space.phase === "checking"} aria-describedby={`${id}-space`}
          onClick={() => { if (snapshot.space.phase !== "checking") void downloads.checkSpace(); }}>{copy.space.check}</button>
      </div>
      {!snapshot.items.length ? <p>{copy.empty}</p> : <>
        <p>{copy.description}</p>
        <p id={`${id}-clear-help`}>{copy.clearHelp}</p>
        <ul>
          {snapshot.items.map(item => {
            const busy = working.has(item.phase), interruptible = busy && item.phase !== "clearing" && item.phase !== "uninstalling", row = `${id}-${item.id}`;
            const protectedVersion = item.phase === "saved" || item.phase === "protected";
            return <li key={item.id} data-download-id={item.id} data-download-phase={item.phase}>
              <h3 id={`${row}-title`}>{item.title[language]}</h3>
              <p>{copy.qa}</p>
              <p>{copy.size}: {number.format(item.totalBytes)} {copy.bytes}</p>
              <p id={`${row}-status`} role="status" aria-live="polite" aria-atomic="true">
                {item.phase === "update-available" && item.savedVersion !== null ? `${copy.savedVersion} ${number.format(item.savedVersion)}. ` : ""}{copy.phases[item.phase]}
              </p>
              {progressPhases.has(item.phase) && <div className="planet-downloads__progress">
                <progress max={item.totalBytes} value={item.completedBytes} aria-label={`${copy.progress}: ${item.title[language]}`} />
                <span>{number.format(item.completedBytes)} / {number.format(item.totalBytes)} {copy.bytes}</span>
              </div>}
              <div className="planet-downloads__actions" role="group" aria-labelledby={`${row}-title`}>
                <button type="button" aria-disabled={busy} aria-describedby={`${row}-status`}
                  onClick={() => { if (!busy) void downloads.check(item.id); }}>{copy.check}</button>
                {/* Stable buttons keep keyboard focus when an async state changes. */}
                <button type="button" aria-disabled={busy || protectedVersion || !snapshot.available}
                  onClick={() => { if (!busy && !protectedVersion && snapshot.available) void downloads.download(item.id); }}>
                  {item.phase === "update-available" ? copy.update : ["paused", "waiting-wifi"].includes(item.phase) ? copy.resume : ["error", "cancelled"].includes(item.phase) ? copy.retry : copy.download}</button>
                <button type="button" aria-disabled={!interruptible || item.phase === "pausing" || item.phase === "cancelling"}
                  onClick={() => { if (interruptible && item.phase !== "pausing" && item.phase !== "cancelling") downloads.pause(item.id); }}>{copy.pause}</button>
                <button type="button" aria-disabled={(!interruptible && !["paused", "waiting-wifi"].includes(item.phase)) || item.phase === "cancelling"}
                  onClick={() => { if ((interruptible || ["paused", "waiting-wifi"].includes(item.phase)) && item.phase !== "cancelling") downloads.cancel(item.id); }}>{copy.cancel}</button>
                <button type="button" aria-disabled={busy || protectedVersion || !snapshot.available} aria-describedby={`${id}-clear-help ${row}-status`}
                  onClick={() => { if (!busy && !protectedVersion && snapshot.available) void downloads.discard(item.id); }}>{copy.clear}</button>
              </div>
              {item.optional && <PackageRemoval item={item} downloads={downloads} copy={copy.removal} busy={busy} />}
            </li>;
          })}
        </ul>
      </>}
    </div>
  </details>;
}
