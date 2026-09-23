import { useId, useLayoutEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyJourneyPersistence, BookyJourneyPersistenceSnapshot } from "./bookyJourneyPersistence";
import type { BookyJourneyRuntime } from "./bookyJourneyRuntime";

/** Draft interface labels; no approved journey text or saved reading claims. */
export const bookyJourneyStorageCopy = { reviewStatus: "draft", productionReady: false, locales: {
  ru: {
    idle: "Сохранение прогресса сейчас недоступно.", loading: "Проверяем сохранённые маршруты…",
    empty: "Сохранённых маршрутов пока нет.", ready: "Прогресс сохранён на этом устройстве.",
    saving: "Сохраняем прогресс…", clearing: "Удаляем сохранённые маршруты…",
    write: "Не удалось подтвердить сохранение. Последние изменения могут быть доступны только до закрытия приложения.",
    deleteFailed: "Не удалось подтвердить удаление. Повторите попытку.",
    read: "Не удалось прочитать сохранённый прогресс. Повторите попытку.",
    unsupported: "Сохранённый прогресс создан в другой версии приложения. Он сохранён без изменений.",
    invalid: "Не удалось восстановить сохранённый прогресс. Данные сохранены без изменений.",
    retry: "Повторить попытку", clear: "Удалить все сохранённые маршруты",
    question: "Удалить прогресс всех маршрутов на этом устройстве? Профиль читателя сохранится.",
    confirm: "Да, удалить прогресс", cancel: "Отмена",
  },
  en: {
    idle: "Progress storage is currently unavailable.", loading: "Checking saved journeys…",
    empty: "There are no saved journeys yet.", ready: "Progress is saved on this device.",
    saving: "Saving progress…", clearing: "Deleting saved journeys…",
    write: "Saving could not be confirmed. Your latest changes may only be available until you close the app.",
    deleteFailed: "Deletion could not be confirmed. Please try again.",
    read: "Saved progress could not be read. Please try again.",
    unsupported: "Saved progress uses another app version. It has been kept unchanged.",
    invalid: "Saved progress could not be restored. It has been kept unchanged.",
    retry: "Try again", clear: "Delete all saved journeys",
    question: "Delete progress for every journey on this device? Your reader profile will be kept.",
    confirm: "Yes, delete progress", cancel: "Cancel",
  },
} } as const;

export default function BookyJourneyStorageControls({ runtime, persistence, snapshot }: {
  runtime: BookyJourneyRuntime; persistence: BookyJourneyPersistence; snapshot: BookyJourneyPersistenceSnapshot;
}) {
  const { language } = useInterfaceLanguage(), copy = bookyJourneyStorageCopy.locales[language], id = useId();
  const [confirmation, setConfirmation] = useState<{ storage: number; intent: number } | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null), clearRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null), restoreFocus = useRef(false);
  const confirmationFocusOwned = useRef(false);
  const intentRevision = runtime.getProgressIntent().revision;
  useLayoutEffect(() => {
    if (!confirmation) {
      if (restoreFocus.current) { restoreFocus.current = false; clearRef.current?.focus(); }
    } else if (confirmation.storage !== snapshot.revision || confirmation.intent !== intentRevision) {
      const focused = document.activeElement, group = confirmRef.current?.closest('[role="group"]');
      if (confirmationFocusOwned.current && (focused === document.body || group?.contains(focused))) statusRef.current?.focus();
      confirmationFocusOwned.current = false;
      setConfirmation(null);
    }
    else confirmRef.current?.focus();
  }, [confirmation, snapshot.revision, intentRevision]);
  const { storage } = snapshot;
  let message: string;
  if (storage.state === "failed") message = snapshot.clearing ? copy.deleteFailed : copy[storage.error ?? "write"];
  else if (snapshot.clearing) message = copy.clearing;
  else if (storage.state !== "ready") message = copy[storage.state];
  else if (snapshot.unsaved) message = copy.write;
  else message = storage.preference?.records.length ? copy.ready : copy.empty;
  const canClear = !snapshot.clearing && storage.state !== "idle" && storage.state !== "loading"
    && (storage.state === "failed" || !!storage.preference?.records.length || !!runtime.getProgressIntent().preference.records.length);
  return <div className="booky-journey-controls__storage">
    <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true"
      data-booky-journey-storage={storage.state} data-booky-journey-storage-error={storage.error ?? ""}>{message}</p>
    {(storage.state === "failed" || snapshot.unsaved && storage.state === "ready") && <button type="button" data-booky-journey-save-retry=""
      onClick={() => { setConfirmation(null); persistence.retry(); statusRef.current?.focus(); }}>{copy.retry}</button>}
    {confirmation ? <div role="group" aria-labelledby={`${id}-clear-question`}
            onFocusCapture={() => { confirmationFocusOwned.current = true; }}
            onBlurCapture={event => { confirmationFocusOwned.current = event.currentTarget.contains(event.relatedTarget); }}>
      <p id={`${id}-clear-question`}>{copy.question}</p>
      <div className="booky-journey-controls__confirmation-actions">
        <button type="button" ref={confirmRef} data-booky-journey-confirm-clear-progress=""
          disabled={confirmation.storage !== snapshot.revision || confirmation.intent !== intentRevision}
          onClick={() => { persistence.clear(confirmation.storage, confirmation.intent); setConfirmation(null); statusRef.current?.focus(); }}>{copy.confirm}</button>
        <button type="button" data-booky-journey-cancel-clear-progress="" onClick={() => {
          confirmationFocusOwned.current = false;
          restoreFocus.current = true; setConfirmation(null);
        }}>{copy.cancel}</button>
      </div>
    </div> : canClear && <button type="button" ref={clearRef} data-booky-journey-clear-progress=""
      onClick={() => setConfirmation({ storage: snapshot.revision, intent: intentRevision })}>{copy.clear}</button>}
  </div>;
}
