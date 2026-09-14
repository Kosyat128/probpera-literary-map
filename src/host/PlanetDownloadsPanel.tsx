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
      size: "Размер пакета", clear: "Удалить незавершённую загрузку",
      clearHelp: "Удаляются только файлы незавершённой загрузки. Текущая и предыдущая сохранённые версии защищены. Для повторной загрузки понадобится сеть.",
      space: { check: "Проверить место", unchecked: "Доступное место ещё не проверено.", checking: "Проверяем доступное место…",
        unavailable: "Не удалось определить доступное место. Можно повторить проверку.",
        browser: "Доступно приложению по оценке браузера", device: "Доступно на устройстве",
        note: "Значение на момент проверки. Доступный объём может измениться." },
      phases: {
        unchecked: "Файлы ещё не проверены.", checking: "Проверяем сохранённые файлы…", "not-saved": "Пакет ещё не сохранён.",
        downloading: "Загружаем файлы…", verifying: "Проверяем пакет перед сохранением…", cancelling: "Завершаем отмену…",
        pausing: "Приостанавливаем загрузку…", paused: "Загрузка приостановлена. Проверенные файлы сохранены. Для продолжения откройте приложение и подключитесь к сети.",
        saved: "Пакет сохранён и проверен на этом устройстве.", cancelled: "Загрузка отменена. Проверенные файлы можно использовать при повторной загрузке.",
        error: "Не удалось сохранить и проверить пакет. Проверьте соединение и свободное место, затем повторите загрузку.",
        unavailable: "Хранилище загрузок недоступно. Закройте и снова откройте приложение, затем повторите проверку.",
        clearing: "Удаляем незавершённую загрузку…", cleared: "Файлы незавершённой загрузки отсутствуют. Сохранённые версии не затронуты.",
        protected: "Эта версия сохранена для офлайн-доступа или восстановления и защищена от удаления.",
        "clear-error": "Не удалось подтвердить удаление. Проверьте файлы или повторите очистку.",
      },
    },
    en: {
      heading: "Downloads", empty: "There are no additional packages to download yet.",
      description: "Downloads pause when the app is in the background or the connection is lost. Select Resume download when you are ready. Verified files are kept after restarting too.",
      check: "Check files", download: "Download", retry: "Retry download", cancel: "Cancel", pause: "Pause", resume: "Resume download",
      qa: "Test package: its content is not yet added to the literary archive.",
      bytes: "bytes", progress: "Receiving files",
      size: "Package size", clear: "Remove unfinished download",
      clearHelp: "Only unfinished download files are removed. The current and previous saved versions are protected. Downloading again will require a connection.",
      space: { check: "Check space", unchecked: "Available space has not been checked yet.", checking: "Checking available space…",
        unavailable: "Available space could not be determined. You can check again.",
        browser: "Estimated space available to the app in this browser", device: "Available on this device",
        note: "Space at the time of checking. The available amount may change." },
      phases: {
        unchecked: "Files have not been checked yet.", checking: "Checking saved files…", "not-saved": "The package has not been saved yet.",
        downloading: "Downloading files…", verifying: "Checking the package before saving…", cancelling: "Finishing cancellation…",
        pausing: "Pausing the download…", paused: "Download paused. Verified files have been kept. Open the app and connect to the network to continue.",
        saved: "The package is saved and verified on this device.", cancelled: "Download cancelled. Verified files can be reused when you retry.",
        error: "The package could not be saved and verified. Check your connection and free space, then retry the download.",
        unavailable: "Download storage is unavailable. Close and reopen the app, then check again.",
        clearing: "Removing unfinished download…", cleared: "No unfinished download files remain. Saved versions are unchanged.",
        protected: "This version is saved for offline access or recovery and is protected from removal.",
        "clear-error": "Removal could not be confirmed. Check the files or try removing them again.",
      },
    },
  },
} as const;
const working = new Set<ContentDownloadPhase>(["checking", "downloading", "verifying", "pausing", "cancelling", "clearing"]);
const progressPhases = new Set<ContentDownloadPhase>(["downloading", "verifying", "pausing", "paused", "cancelling"]);

export default function PlanetDownloadsPanel({ downloads }: { downloads: ContentDownloads }) {
  const { language } = useInterfaceLanguage();
  const snapshot = useSyncExternalStore(downloads.subscribe, downloads.getSnapshot, downloads.getSnapshot);
  const copy = planetDownloadsCopy.locales[language], id = useId();
  const number = new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US");
  return <details className="planet-downloads" data-planet-downloads="">
    <summary>{copy.heading}</summary>
    <div className="planet-downloads__body">
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
            const busy = working.has(item.phase), interruptible = busy && item.phase !== "clearing", row = `${id}-${item.id}`;
            const protectedVersion = item.phase === "saved" || item.phase === "protected";
            return <li key={item.id} data-download-id={item.id} data-download-phase={item.phase}>
              <h3 id={`${row}-title`}>{item.title[language]}</h3>
              <p>{copy.qa}</p>
              <p>{copy.size}: {number.format(item.totalBytes)} {copy.bytes}</p>
              <p id={`${row}-status`} role="status" aria-live="polite" aria-atomic="true">{copy.phases[item.phase]}</p>
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
                  {item.phase === "paused" ? copy.resume : ["error", "cancelled"].includes(item.phase) ? copy.retry : copy.download}</button>
                <button type="button" aria-disabled={!interruptible || item.phase === "pausing" || item.phase === "cancelling"}
                  onClick={() => { if (interruptible && item.phase !== "pausing" && item.phase !== "cancelling") downloads.pause(item.id); }}>{copy.pause}</button>
                <button type="button" aria-disabled={(!interruptible && item.phase !== "paused") || item.phase === "cancelling"}
                  onClick={() => { if ((interruptible || item.phase === "paused") && item.phase !== "cancelling") downloads.cancel(item.id); }}>{copy.cancel}</button>
                <button type="button" aria-disabled={busy || protectedVersion || !snapshot.available} aria-describedby={`${id}-clear-help ${row}-status`}
                  onClick={() => { if (!busy && !protectedVersion && snapshot.available) void downloads.discard(item.id); }}>{copy.clear}</button>
              </div>
            </li>;
          })}
        </ul>
      </>}
    </div>
  </details>;
}
