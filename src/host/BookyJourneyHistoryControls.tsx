import { useId, useLayoutEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyJourneyRuntime, BookyJourneyRuntimeSnapshot } from "./bookyJourneyRuntime";
import type { BookyJourneyPersistence } from "./bookyJourneyPersistence";

/** Interface labels only. Route titles come from the current admitted snapshot. */
export const bookyJourneyHistoryCopy = { reviewStatus: "draft", productionReady: false, locales: {
  ru: {
    heading: "История маршрутов", saved: "Сохранённый маршрут", current: "Текущий маршрут",
    available: "Доступен", held: "Сейчас недоступен", completed: "Все шаги подтверждены",
    select: "Выбрать маршрут", remove: "Удалить из истории",
    question: "Удалить этот маршрут из истории вместе с подтверждёнными шагами?",
    confirm: "Да, удалить запись", cancel: "Отмена",
    rejected: "Сейчас выполнить действие не удалось. Проверьте состояние маршрута и повторите попытку.",
    version: (value: number) => `Версия ${value}`,
    locale: { ru: "Русский", en: "Английский" },
    progress: (count: number, total: number) => `Подтверждено шагов: ${count} из ${total}`,
  },
  en: {
    heading: "Journey history", saved: "Saved journey", current: "Current journey",
    available: "Available", held: "Currently unavailable", completed: "All steps acknowledged",
    select: "Select journey", remove: "Remove from history",
    question: "Remove this journey from history, including its acknowledged steps?",
    confirm: "Yes, remove entry", cancel: "Cancel",
    rejected: "The action could not be completed right now. Check the journey status and try again.",
    version: (value: number) => `Version ${value}`,
    locale: { ru: "Russian", en: "English" },
    progress: (count: number, total: number) => `Steps acknowledged: ${count} of ${total}`,
  },
} } as const;

export default function BookyJourneyHistoryControls({ controller, snapshot, persistence, onAccepted }: {
  controller: BookyJourneyRuntime;
  snapshot: BookyJourneyRuntimeSnapshot;
  persistence: BookyJourneyPersistence;
  onAccepted: () => void;
}) {
  const { language } = useInterfaceLanguage(), copy = bookyJourneyHistoryCopy.locales[language], id = useId();
  const [confirmation, setConfirmation] = useState<{ key: string; revision: number } | null>(null);
  const [rejectedAtRevision, setRejectedAtRevision] = useState<number | null>(null);
  const choices = useRef<HTMLUListElement>(null), confirmRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null), restoreFocus = useRef<string | null>(null), focusFailure = useRef(false);
  const rejected = rejectedAtRevision === snapshot.revision, canAct = persistence.getSnapshot().canAct;
  const target = confirmation && snapshot.history.find(entry => entry.key === confirmation.key);

  useLayoutEffect(() => {
    if (confirmation) {
      if (confirmation.revision !== snapshot.revision || !target || !canAct) setConfirmation(null);
      else confirmRef.current?.focus();
    } else if (restoreFocus.current) {
      const button = Array.from(choices.current?.querySelectorAll<HTMLButtonElement>("[data-booky-journey-delete-history]") ?? [])
        .find(item => item.dataset.bookyJourneyDeleteHistory === restoreFocus.current);
      restoreFocus.current = null; button?.focus();
    }
  }, [confirmation, snapshot.revision, target, canAct]);
  useLayoutEffect(() => {
    if (focusFailure.current && rejected) { focusFailure.current = false; statusRef.current?.focus(); }
  }, [rejected, snapshot.revision]);

  function act(action: () => boolean) {
    const accepted = persistence.getSnapshot().canAct && action();
    setConfirmation(null);
    focusFailure.current = !accepted;
    setRejectedAtRevision(accepted ? null : controller.getSnapshot().revision);
    if (accepted) onAccepted();
  }
  if (snapshot.history.length === 0 && !rejected) return null;
  return <section className="booky-journey-controls__history" aria-labelledby={`${id}-heading`} data-booky-journey-history-controls="">
    <h4 id={`${id}-heading`}>{copy.heading}</h4>
    <p ref={statusRef} hidden={!rejected} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true"
      data-booky-journey-history-status="">{rejected ? copy.rejected : ""}</p>
    <ul ref={choices} className="booky-journey-controls__history-list">
      {snapshot.history.map((entry, index) => {
        const deleting = confirmation?.key === entry.key ? confirmation : null;
        const titleId = `${id}-entry-${index}`, questionId = `${id}-question-${index}`;
        return <li key={entry.key} className="booky-journey-controls__history-entry" aria-current={entry.selected ? "true" : undefined}
          data-booky-journey-history-entry={entry.key} data-booky-journey-history-selected={entry.selected}
          data-booky-journey-history-available={entry.available} data-booky-journey-history-version={entry.version}
          data-booky-journey-history-locale={entry.locale}>
          <p id={titleId} className="booky-journey-controls__history-title"><strong>{entry.title ?? copy.saved}</strong></p>
          <p className="booky-journey-controls__history-meta">{copy.version(entry.version)} · {copy.locale[entry.locale]}</p>
          <p className="booky-journey-controls__history-meta">{copy.progress(entry.completedCount, entry.total)}</p>
          <p className="booky-journey-controls__history-state">
            {[entry.selected ? copy.current : null, entry.available ? copy.available : copy.held,
              entry.completedCount === entry.total ? copy.completed : null].filter(Boolean).join(" · ")}
          </p>
          {deleting ? <div role="group" aria-labelledby={`${titleId} ${questionId}`}>
            <p id={questionId}>{copy.question}</p>
            <div className="booky-journey-controls__confirmation-actions">
              <button type="button" ref={confirmRef} data-booky-journey-confirm-delete-history={entry.key}
                disabled={!canAct || deleting.revision !== snapshot.revision}
                onClick={() => act(() => controller.deleteHistory(entry.key, deleting.revision))}>{copy.confirm}</button>
              <button type="button" data-booky-journey-cancel-delete-history={entry.key} onClick={() => {
                restoreFocus.current = entry.key; setConfirmation(null);
              }}>{copy.cancel}</button>
            </div>
          </div> : <div className="booky-journey-controls__history-actions" role="group" aria-labelledby={titleId}>
            {!entry.selected && entry.canSelect && <button type="button" data-booky-journey-select-history={entry.key}
              disabled={!canAct} onClick={() => act(() => controller.selectHistory(entry.key, snapshot.revision))}>{copy.select}</button>}
            <button type="button" data-booky-journey-delete-history={entry.key} disabled={!canAct} onClick={() => {
              setRejectedAtRevision(null); setConfirmation({ key: entry.key, revision: snapshot.revision });
            }}>{copy.remove}</button>
          </div>}
        </li>;
      })}
    </ul>
  </section>;
}
