import { useId, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { ContentDownloads, ContentDownloadPhase } from "../planet/ContentDownloads";
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
      phases: {
        unchecked: "Файлы ещё не проверены.", checking: "Проверяем сохранённые файлы…", "not-saved": "Пакет ещё не сохранён.",
        downloading: "Загружаем файлы…", verifying: "Проверяем пакет перед сохранением…", cancelling: "Завершаем отмену…",
        pausing: "Приостанавливаем загрузку…", paused: "Загрузка приостановлена. Проверенные файлы сохранены. Для продолжения откройте приложение и подключитесь к сети.",
        saved: "Пакет сохранён и проверен на этом устройстве.", cancelled: "Загрузка отменена. Проверенные файлы можно использовать при повторной загрузке.",
        error: "Не удалось сохранить и проверить пакет. Проверьте соединение и свободное место, затем повторите загрузку.",
        unavailable: "Хранилище загрузок недоступно. Закройте и снова откройте приложение, затем повторите проверку.",
      },
    },
    en: {
      heading: "Downloads", empty: "There are no additional packages to download yet.",
      description: "Downloads pause when the app is in the background or the connection is lost. Select Resume download when you are ready. Verified files are kept after restarting too.",
      check: "Check files", download: "Download", retry: "Retry download", cancel: "Cancel", pause: "Pause", resume: "Resume download",
      qa: "Test package: its content is not yet added to the literary archive.",
      bytes: "bytes", progress: "Receiving files",
      phases: {
        unchecked: "Files have not been checked yet.", checking: "Checking saved files…", "not-saved": "The package has not been saved yet.",
        downloading: "Downloading files…", verifying: "Checking the package before saving…", cancelling: "Finishing cancellation…",
        pausing: "Pausing the download…", paused: "Download paused. Verified files have been kept. Open the app and connect to the network to continue.",
        saved: "The package is saved and verified on this device.", cancelled: "Download cancelled. Verified files can be reused when you retry.",
        error: "The package could not be saved and verified. Check your connection and free space, then retry the download.",
        unavailable: "Download storage is unavailable. Close and reopen the app, then check again.",
      },
    },
  },
} as const;
const working = new Set<ContentDownloadPhase>(["checking", "downloading", "verifying", "pausing", "cancelling"]);
const progressPhases = new Set<ContentDownloadPhase>(["downloading", "verifying", "pausing", "paused", "cancelling"]);

export default function PlanetDownloadsPanel({ downloads }: { downloads: ContentDownloads }) {
  const { language } = useInterfaceLanguage();
  const snapshot = useSyncExternalStore(downloads.subscribe, downloads.getSnapshot, downloads.getSnapshot);
  const copy = planetDownloadsCopy.locales[language], id = useId();
  const number = new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US");
  return <details className="planet-downloads" data-planet-downloads="">
    <summary>{copy.heading}</summary>
    <div className="planet-downloads__body">
      {!snapshot.items.length ? <p>{copy.empty}</p> : <>
        <p>{copy.description}</p>
        <ul>
          {snapshot.items.map(item => {
            const busy = working.has(item.phase), row = `${id}-${item.id}`;
            return <li key={item.id} data-download-id={item.id} data-download-phase={item.phase}>
              <h3 id={`${row}-title`}>{item.title[language]}</h3>
              <p>{copy.qa}</p>
              <p id={`${row}-status`} role="status" aria-live="polite" aria-atomic="true">{copy.phases[item.phase]}</p>
              {progressPhases.has(item.phase) && <div className="planet-downloads__progress">
                <progress max={item.totalBytes} value={item.completedBytes} aria-label={`${copy.progress}: ${item.title[language]}`} />
                <span>{number.format(item.completedBytes)} / {number.format(item.totalBytes)} {copy.bytes}</span>
              </div>}
              <div className="planet-downloads__actions" role="group" aria-labelledby={`${row}-title`}>
                <button type="button" aria-disabled={busy} aria-describedby={`${row}-status`}
                  onClick={() => { if (!busy) void downloads.check(item.id); }}>{copy.check}</button>
                {/* Stable buttons keep keyboard focus when an async state changes. */}
                <button type="button" aria-disabled={busy || item.phase === "saved" || !snapshot.available}
                  onClick={() => { if (!busy && item.phase !== "saved" && snapshot.available) void downloads.download(item.id); }}>
                  {item.phase === "paused" ? copy.resume : ["error", "cancelled"].includes(item.phase) ? copy.retry : copy.download}</button>
                <button type="button" aria-disabled={!busy || item.phase === "pausing" || item.phase === "cancelling"}
                  onClick={() => { if (busy && item.phase !== "pausing" && item.phase !== "cancelling") downloads.pause(item.id); }}>{copy.pause}</button>
                <button type="button" aria-disabled={(!busy && item.phase !== "paused") || item.phase === "cancelling"}
                  onClick={() => { if ((busy || item.phase === "paused") && item.phase !== "cancelling") downloads.cancel(item.id); }}>{copy.cancel}</button>
              </div>
            </li>;
          })}
        </ul>
      </>}
    </div>
  </details>;
}
