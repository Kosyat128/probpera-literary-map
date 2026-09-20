import type { ReadingLibrarySyncSnapshot } from "../hooks/useReadingLibrary";
import "./ReadingLibrarySyncNotice.css";

export default function ReadingLibrarySyncNotice({ sync, onRetry, language }: {
  sync: ReadingLibrarySyncSnapshot;
  onRetry: () => void;
  language: "ru" | "en";
}) {
  const transient = sync.persistence === "session-only";
  if (!transient && (sync.status === "idle" || sync.status === "local")) return null;
  const storage = transient
    ? language === "en"
      ? "Library changes are kept for this session. Saving on this device is unavailable."
      : "Изменения библиотеки доступны в текущем сеансе. Сохранение на устройстве недоступно."
    : language === "en"
      ? "Library changes are saved on this device."
      : "Изменения библиотеки сохранены на этом устройстве.";
  const pending = sync.status === "pending";
  const remote = sync.status === "syncing"
    ? language === "en" ? "Syncing with your account…" : "Синхронизация с аккаунтом…"
    : pending
      ? language === "en" ? "Account sync is pending." : "Ожидается синхронизация с аккаунтом."
      : "";
  return <div className="reading-library-sync-notice" data-reading-library-sync={sync.status}
    data-reading-library-persistence={sync.persistence}>
    <span role="status">{storage}{remote ? ` ${remote}` : ""}</span>
    {pending && <button type="button" onClick={onRetry}>
      {language === "en" ? "Retry sync" : "Повторить синхронизацию"}
    </button>}
  </div>;
}
