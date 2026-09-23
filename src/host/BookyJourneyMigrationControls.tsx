import { useId, useLayoutEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyJourneyRuntime, BookyJourneyRuntimeSnapshot } from "./bookyJourneyRuntime";
import type { BookyJourneyPersistence } from "./bookyJourneyPersistence";

export const bookyJourneyMigrationCopy = { reviewStatus: "draft", productionReady: false, locales: {
  ru: {
    available: "Для этого маршрута доступно обновление с переносом прогресса.",
    start: "Перенести прогресс", question: "Продолжить обновлённый маршрут? Подтверждённые шаги будут перенесены там, где они совпадают. Исходная история сохранится.",
    confirm: "Перенести и продолжить", cancel: "Отмена",
    rejected: "Перенести прогресс сейчас не удалось. Исходная история сохранена. Проверьте состояние маршрута и повторите попытку.",
  },
  en: {
    available: "An update is available for this journey with progress transfer.",
    start: "Transfer progress", question: "Continue the updated journey? Acknowledged steps will transfer where they match. Your original history will be kept.",
    confirm: "Transfer and continue", cancel: "Cancel",
    rejected: "Progress could not be transferred right now. Your original history is kept. Check the journey status and try again.",
  },
} } as const;

export default function BookyJourneyMigrationControls({ controller, snapshot, persistence, onAccepted }: {
  controller: BookyJourneyRuntime; snapshot: BookyJourneyRuntimeSnapshot; persistence: BookyJourneyPersistence;
  onAccepted: () => void;
}) {
  const { language } = useInterfaceLanguage(), copy = bookyJourneyMigrationCopy.locales[language], id = useId();
  const [confirmation, setConfirmation] = useState<{ key: string; revision: number } | null>(null);
  const [rejectedAtRevision, setRejectedAtRevision] = useState<number | null>(null);
  const rejected = rejectedAtRevision === snapshot.revision, canAct = persistence.getSnapshot().canAct;
  const confirmRef = useRef<HTMLButtonElement>(null), statusRef = useRef<HTMLParagraphElement>(null);
  const restoreFocus = useRef<string | null>(null), choices = useRef<HTMLDivElement>(null);
  const selected = confirmation && snapshot.migrations.find(item => item.key === confirmation.key);
  useLayoutEffect(() => {
    if (confirmation) {
      if (confirmation.revision !== snapshot.revision || !selected || !canAct) setConfirmation(null);
      else confirmRef.current?.focus();
    } else if (restoreFocus.current) {
      const button = Array.from(choices.current?.querySelectorAll<HTMLButtonElement>("[data-booky-journey-migrate]") ?? [])
        .find(item => item.dataset.bookyJourneyMigrate === restoreFocus.current);
      restoreFocus.current = null; button?.focus();
    }
  }, [confirmation, snapshot.revision, selected, canAct]);
  if (snapshot.migrations.length === 0 && !rejected) return null;
  return <div className="booky-journey-controls__migration" data-booky-journey-migration-controls="" ref={choices}>
    <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" data-booky-journey-migration-status="">
      {rejected ? copy.rejected : copy.available}
    </p>
    {confirmation && selected ? <div role="group" aria-labelledby={`${id}-question`}>
      <p><strong>{selected.title}</strong></p><p id={`${id}-question`}>{copy.question}</p>
      <div className="booky-journey-controls__confirmation-actions">
        <button type="button" ref={confirmRef} data-booky-journey-confirm-migrate=""
          disabled={!persistence.getSnapshot().canAct || confirmation.revision !== snapshot.revision}
          onClick={() => {
            const accepted = persistence.getSnapshot().canAct && controller.migrate(confirmation.key, confirmation.revision);
            setConfirmation(null); setRejectedAtRevision(accepted ? null : controller.getSnapshot().revision);
            if (accepted) onAccepted(); else statusRef.current?.focus();
          }}>{copy.confirm}</button>
        <button type="button" data-booky-journey-cancel-migrate="" onClick={() => {
          restoreFocus.current = confirmation.key; setConfirmation(null);
        }}>{copy.cancel}</button>
      </div>
    </div> : snapshot.migrations.map(offer => <button type="button" key={offer.key} data-booky-journey-migrate={offer.key}
      disabled={!persistence.getSnapshot().canAct} onClick={() => {
        setRejectedAtRevision(null); setConfirmation({ key: offer.key, revision: snapshot.revision });
      }}>{copy.start}: {offer.title}</button>)}
  </div>;
}
