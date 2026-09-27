import { Fragment, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyJourneyRuntime, BookyJourneyRuntimeSnapshot } from "./bookyJourneyRuntime";
import type { BookyJourneyPersistence, BookyJourneyPersistenceSnapshot } from "./bookyJourneyPersistence";
import BookyJourneyStorageControls from "./BookyJourneyStorageControls";
import BookyJourneyMigrationControls from "./BookyJourneyMigrationControls";
import BookyJourneyHistoryControls from "./BookyJourneyHistoryControls";
import BookyJourneyActivityControls from "./BookyJourneyActivityControls";
import BookyJourneyFactSources from "./BookyJourneyFactSources";
import BookyJourneyPassportControls, { type BookyJourneyPassportControlsProps } from "./BookyJourneyPassportControls";
import "./BookyJourneyControls.css";

export type BookyJourneyControlsProps = {
  snapshot: BookyJourneyRuntimeSnapshot;
  controller: BookyJourneyRuntime;
  persistence: BookyJourneyPersistence;
  persistenceSnapshot: BookyJourneyPersistenceSnapshot;
  passport: BookyJourneyPassportControlsProps["passport"];
  passportState: BookyJourneyPassportControlsProps["state"];
  /** Current committed modal action observed by the existing journey owner. */
  characterViewOpen?: boolean;
};

/** Interface copy only; journey text comes from the current admitted snapshot. */
export const bookyJourneyControlsCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      heading: "Литературные маршруты",
      optional: "Выберите маршрут, если хотите пройти по его шагам вместе с Книжуликом.",
      profileRequired: "Чтобы подобрать маршрут, заполните профиль для маршрутов ниже. Это необязательно: планету можно исследовать самостоятельно.",
      unavailable: "Сейчас подходящих маршрутов нет. Можно продолжить исследовать планету самостоятельно.",
      choose: "Выберите маршрут, чтобы начать.",
      estimatedDuration: (minutes: number) => `Примерно ${minutes} мин.`,
      availableOffline: "Доступен без интернета",
      internetRequired: "Для маршрута нужен интернет",
      historyFull: (used: number, limit: number) => `История заполнена: ${used} из ${limit} записей.`,
      historyCapacityHelp: "Чтобы сохранить новый маршрут или перенести прогресс, удалите одну выбранную запись в истории. Доступные сохранённые маршруты можно продолжать.",
      manageHistory: "Перейти к истории",
      navigating: "Открываем шаг маршрута…",
      readyToOpen: "Откройте этот шаг, затем подтвердите его.",
      readyToConfirm: "Этот шаг готов к подтверждению.",
      readyToAnswer: "Выберите ответ на задание. Подтвердить шаг можно после верного ответа.",
      paused: "Маршрут приостановлен. Нажмите «Продолжить маршрут», когда будете готовы.",
      activeUnavailable: "Этот маршрут сейчас недоступен. Можно вернуться к нему позже или сбросить маршрут.",
      failed: "Не удалось открыть этот шаг. Повторите открытие.",
      complete: "Маршрут завершён. Подтверждены все шаги.",
      rejected: "Сейчас выполнить действие не удалось. Проверьте состояние маршрута и повторите попытку.",
      openCountry: "Открыть страну",
      openWriter: "Открыть писателя",
      openWork: "Открыть книгу",
      openCharacter: "Открыть персонажа",
      characterConfirm: "Подтвердите шаг в открытой карточке персонажа.",
      characterUnavailable: "Карточка персонажа сейчас недоступна. Можно вернуться к этому шагу позже.",
      openStep: "Открыть шаг",
      retryOpen: "Повторить открытие",
      next: "Подтвердить шаг",
      finish: "Подтвердить и завершить",
      pause: "Приостановить маршрут",
      resume: "Продолжить маршрут",
      reset: "Сбросить маршрут",
      resetQuestion: "Сбросить этот маршрут и подтверждённые в нём шаги?",
      confirmReset: "Да, сбросить",
      cancelReset: "Отмена",
      progress: (count: number, total: number) => `Подтверждено шагов: ${count} из ${total}`,
      position: (index: number, total: number) => `Шаг ${index} из ${total}`,
    },
    en: {
      heading: "Literary journeys",
      optional: "Choose a journey to follow its steps with Mr. Booky.",
      profileRequired: "To find a journey, fill in the reader profile below. This is optional: you can explore the planet on your own.",
      unavailable: "There are no matching journeys right now. You can keep exploring the planet on your own.",
      choose: "Choose a journey to begin.",
      estimatedDuration: (minutes: number) => `About ${minutes} min`,
      availableOffline: "Available offline",
      internetRequired: "Internet required for this journey",
      historyFull: (used: number, limit: number) => `Journey history is full: ${used} of ${limit} entries.`,
      historyCapacityHelp: "To save a new journey or transfer progress, remove one history entry of your choice. Saved journeys that are available can still continue.",
      manageHistory: "Go to history",
      navigating: "Opening this journey step…",
      readyToOpen: "Open this step, then acknowledge it.",
      readyToConfirm: "This step is ready to acknowledge.",
      readyToAnswer: "Choose an answer to the task. You can acknowledge the step after a correct answer.",
      paused: "This journey is paused. Choose “Resume journey” when you are ready.",
      activeUnavailable: "This journey is currently unavailable. You can return to it later or reset the journey.",
      failed: "This step could not be opened. Please try opening it again.",
      complete: "Journey complete. You have acknowledged every step.",
      rejected: "The action could not be completed right now. Check the journey status and try again.",
      openCountry: "Open country",
      openWriter: "Open writer",
      openWork: "Open book",
      openCharacter: "Open character",
      characterConfirm: "Acknowledge this step inside the open character card.",
      characterUnavailable: "The character card is currently unavailable. You can return to this step later.",
      openStep: "Open step",
      retryOpen: "Try opening again",
      next: "Acknowledge step",
      finish: "Acknowledge and finish",
      pause: "Pause journey",
      resume: "Resume journey",
      reset: "Reset journey",
      resetQuestion: "Reset this journey and the steps you have acknowledged in it?",
      confirmReset: "Yes, reset",
      cancelReset: "Cancel",
      progress: (count: number, total: number) => `Steps acknowledged: ${count} of ${total}`,
      position: (index: number, total: number) => `Step ${index} of ${total}`,
    },
  },
} as const;

export default function BookyJourneyControls({ snapshot, controller, persistence, persistenceSnapshot, passport, passportState, characterViewOpen = false }: BookyJourneyControlsProps) {
  const { language } = useInterfaceLanguage();
  const copy = bookyJourneyControlsCopy.locales[language];
  const id = useId(), historyHeadingId = `${id}-history-heading`, capacityId = `${id}-history-capacity`;
  const capacity = snapshot.historyCapacity;
  const heading = useRef<HTMLHeadingElement>(null), status = useRef<HTMLParagraphElement>(null);
  const resetStart = useRef<HTMLButtonElement>(null), resetConfirm = useRef<HTMLButtonElement>(null);
  const restoreResetFocus = useRef(false), resetFocusOwned = useRef(false);
  const focusJourneyHeading = useCallback(() => { heading.current?.focus(); }, []);
  const [resetAtRevision, setResetAtRevision] = useState<number | null>(null);
  const [rejectedAtRevision, setRejectedAtRevision] = useState<number | null>(null);
  const active = snapshot.active;
  const node = snapshot.status === "ready" ? active?.node ?? null : null;
  const routeTitle = snapshot.status === "ready" ? active?.title ?? null : null;
  const nodeCopy = node?.dialogue.payload.copy;

  useLayoutEffect(() => {
    if (resetAtRevision === null) {
      if (restoreResetFocus.current) {
        restoreResetFocus.current = false;
        resetStart.current?.focus();
      }
      return;
    }
    if (resetAtRevision !== snapshot.revision || !active) {
      const focused = document.activeElement, group = resetConfirm.current?.closest('[role="group"]');
      if (resetFocusOwned.current && (focused === document.body || group?.contains(focused))) focusJourneyHeading();
      resetFocusOwned.current = false;
      setResetAtRevision(null);
    } else resetConfirm.current?.focus();
  }, [resetAtRevision, snapshot.revision, active, focusJourneyHeading]);

  function act(action: () => boolean, focusHeading = false) {
    const accepted = persistence.getSnapshot().canAct && action();
    setRejectedAtRevision(accepted ? null : snapshot.revision);
    if (accepted) setResetAtRevision(null);
    // Only an explicit gesture moves focus. This heading remains mounted when
    // asynchronous navigation or a new node replaces the action controls.
    if (accepted && focusHeading) heading.current?.focus();
    else status.current?.focus();
  }

  let statusText: string;
  if (snapshot.status === "profile-required") statusText = copy.profileRequired;
  else if (active?.phase === "navigating") statusText = copy.navigating;
  else if (active?.phase === "failed") statusText = copy.failed;
  else if (active?.phase === "unavailable") statusText = copy.activeUnavailable;
  else if (snapshot.status === "unavailable") statusText = active ? copy.activeUnavailable : copy.unavailable;
  else if (rejectedAtRevision === snapshot.revision) statusText = copy.rejected;
  else if (active?.phase === "paused") statusText = copy.paused;
  else if (active?.phase === "complete") statusText = copy.complete;
  else if (active?.phase === "ready" && node?.kind === "character")
    statusText = active.canOpen ? characterViewOpen ? copy.characterConfirm : copy.readyToOpen : copy.characterUnavailable;
  else if (active) statusText = active.canNext ? copy.readyToConfirm : active.answer?.canAnswer ? copy.readyToAnswer : copy.readyToOpen;
  else statusText = snapshot.routes.length > 0 ? copy.choose : copy.unavailable;

  const openKind = node?.kind === "sourced-fact" ? node.entity?.kind : node?.kind;
  const openLabel = active?.phase === "failed" ? copy.retryOpen : openKind === "country" ? copy.openCountry
    : openKind === "writer" ? copy.openWriter : openKind === "work" ? copy.openWork
      : openKind === "character" ? copy.openCharacter : copy.openStep;
  const caption = nodeCopy && nodeCopy.caption !== nodeCopy.title && nodeCopy.caption !== nodeCopy.body
    ? nodeCopy.caption : null;
  const reduced = nodeCopy && nodeCopy.reduced !== nodeCopy.title && nodeCopy.reduced !== nodeCopy.body
    ? nodeCopy.reduced : null;
  const inProgress = active && active.phase !== "complete" && active.phase !== "paused";

  return (
    <section className="booky-journey-controls" aria-labelledby={`${id}-heading`} data-booky-journey-controls="">
      <h3 ref={heading} id={`${id}-heading`} tabIndex={-1}>{copy.heading}</h3>
      {!active && snapshot.status === "ready" && snapshot.routes.length > 0 && <p>{copy.optional}</p>}
      <p ref={status} className="booky-journey-controls__status" tabIndex={-1} role="status"
        aria-live="polite" aria-atomic="true" data-booky-journey-status={active?.phase ?? snapshot.status}>
        {statusText}
      </p>
      {capacity.full && <div className="booky-journey-controls__capacity">
        <p id={capacityId} role="status" aria-live="polite" aria-atomic="true"
          data-booky-journey-history-capacity="full" data-booky-journey-history-used={capacity.used}
          data-booky-journey-history-limit={capacity.limit}>
          <strong>{copy.historyFull(capacity.used, capacity.limit)}</strong><br />{copy.historyCapacityHelp}
        </p>
        <button type="button" data-booky-journey-manage-history="" aria-controls={historyHeadingId}
          onClick={() => { document.getElementById(historyHeadingId)?.focus(); }}>{copy.manageHistory}</button>
      </div>}
      {(!active || active.phase === "complete" || active.phase === "paused" || active.phase === "unavailable")
        && snapshot.status === "ready" && snapshot.routes.length > 0 && (
        <div className="booky-journey-controls__routes">
          {snapshot.routes.map(route => {
            const overviewId = `${id}-overview-${encodeURIComponent(route.key)}`;
            const descriptionIds = [route.overview ? overviewId : null, !route.canStart && capacity.full ? capacityId : null]
              .filter(Boolean).join(" ") || undefined;
            return <Fragment key={route.key}>
              <button type="button" data-booky-journey-route={route.key}
                disabled={!persistenceSnapshot.canAct || !route.canStart} aria-describedby={descriptionIds}
                onClick={() => act(() => controller.start(route.key, snapshot.revision), true)}>{route.title}</button>
              {route.overview && <div id={overviewId} className="booky-journey-controls__overview" data-booky-journey-overview={route.key}>
                <p className="booky-journey-controls__overview-description" data-booky-journey-overview-description="">{route.overview.description}</p>
                <p className="booky-journey-controls__overview-meta" data-booky-journey-overview-duration="">
                  {copy.estimatedDuration(route.overview.estimatedDurationMinutes)}
                </p>
                <p className="booky-journey-controls__overview-meta"
                  data-booky-journey-overview-availability={route.overview.offlineAvailable ? "offline" : "online-required"}>
                  {route.overview.offlineAvailable ? copy.availableOffline : copy.internetRequired}
                </p>
              </div>}
            </Fragment>;
          })}
        </div>
      )}
      {active && <div className="booky-journey-controls__active">
        {routeTitle && <p className="booky-journey-controls__title"><strong>{routeTitle}</strong></p>}
        <p className="booky-journey-controls__progress" data-booky-journey-progress="">
          {copy.progress(active.completedCount, active.total)}
        </p>
        {node && nodeCopy && active.phase !== "complete" && <div className="booky-journey-controls__node"
          data-booky-journey-node={node.id}>
          <p className="booky-journey-controls__position">{copy.position(active.index + 1, active.total)}</p>
          <h4>{nodeCopy.title}</h4>
          <p className="booky-journey-controls__body">{nodeCopy.body}</p>
          {caption && <p className="booky-journey-controls__caption">{caption}</p>}
          {reduced && <p className="booky-journey-controls__reduced">{reduced}</p>}
          {node.kind === "sourced-fact" && node.fact && <BookyJourneyFactSources
            key={`${node.fact.semanticChecksum}:${node.dialogue.payload.locale}`} node={node} />}
          <BookyJourneyActivityControls active={active} canAct={persistenceSnapshot.canAct} onAnswer={choiceId => {
            const accepted = persistence.getSnapshot().canAct && controller.answer(choiceId, snapshot.revision);
            setRejectedAtRevision(accepted ? null : snapshot.revision);
            if (!accepted) status.current?.focus();
          }} />
        </div>}
        <div className="booky-journey-controls__actions">
          {inProgress && node && <>
            <button type="button" data-booky-journey-open="" disabled={!persistenceSnapshot.canAct || !active.canOpen}
              onClick={() => act(() => controller.open(snapshot.revision), true)}>{openLabel}</button>
            {node.kind !== "character" && <button type="button" className="booky-journey-controls__primary" data-booky-journey-next=""
              disabled={!persistenceSnapshot.canAct || !active.canNext} onClick={() => act(() => controller.next(snapshot.revision), true)}>
              {active.index + 1 >= active.total ? copy.finish : copy.next}
            </button>}
          </>}
          {active.phase === "paused" && <button type="button" data-booky-journey-resume=""
            disabled={!persistenceSnapshot.canAct || snapshot.status !== "ready" || !node}
            onClick={() => act(() => controller.resume(snapshot.revision), true)}>{copy.resume}</button>}
          {inProgress && active.phase !== "unavailable" && <button type="button" data-booky-journey-pause=""
            disabled={!persistenceSnapshot.canAct}
            onClick={() => act(() => controller.pause(snapshot.revision))}>{copy.pause}</button>}
        </div>
        <div className="booky-journey-controls__reset">
          {resetAtRevision !== null ? <div role="group" aria-labelledby={`${id}-reset-question`}
            onFocusCapture={() => { resetFocusOwned.current = true; }}
            onBlurCapture={event => { resetFocusOwned.current = event.currentTarget.contains(event.relatedTarget); }}>
            <p id={`${id}-reset-question`}>{copy.resetQuestion}</p>
            <div className="booky-journey-controls__confirmation-actions">
              <button ref={resetConfirm} type="button" data-booky-journey-confirm-reset=""
                disabled={!persistenceSnapshot.canAct || resetAtRevision !== snapshot.revision}
                onClick={() => act(() => controller.reset(snapshot.revision), true)}>{copy.confirmReset}</button>
              <button type="button" data-booky-journey-cancel-reset="" onClick={() => {
                resetFocusOwned.current = false;
                restoreResetFocus.current = true;
                setResetAtRevision(null);
              }}>{copy.cancelReset}</button>
            </div>
          </div> : <button ref={resetStart} type="button" data-booky-journey-reset=""
            disabled={!persistenceSnapshot.canAct}
            onClick={() => setResetAtRevision(snapshot.revision)}>{copy.reset}</button>}
        </div>
      </div>}
      <BookyJourneyPassportControls state={passportState} passport={passport}
        onManageHistory={snapshot.history.length ? () => { document.getElementById(historyHeadingId)?.focus(); } : undefined} />
      <BookyJourneyHistoryControls controller={controller} snapshot={snapshot} persistence={persistence} historyHeadingId={historyHeadingId}
        onAccepted={focusJourneyHeading} onConfirmationInvalidated={focusJourneyHeading} />
      <BookyJourneyMigrationControls controller={controller} snapshot={snapshot} persistence={persistence}
        onAccepted={focusJourneyHeading} onConfirmationInvalidated={focusJourneyHeading} />
      <BookyJourneyStorageControls runtime={controller} persistence={persistence} snapshot={persistenceSnapshot} />
    </section>
  );
}
