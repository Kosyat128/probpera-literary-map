import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyReaderPolicyInput, BookyReadingLevel } from "./bookyReaderPolicy";
import type { BookyReaderPolicySnapshot } from "./bookyReaderPolicyStore";
import "./BookyReaderSettings.css";

export type BookyReaderSettingsProps = {
  snapshot: BookyReaderPolicySnapshot;
  editor: BookyReaderSettingsEditor;
  onSave: (input: BookyReaderPolicyInput) => boolean;
  onClear: () => boolean;
  onRetry: () => boolean;
};

/** Interface copy; it does not approve or enable any journey content. */
export const bookyReaderSettingsCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      heading: "Профиль для маршрутов",
      description: "Необязательно. Возраст и уровень чтения нужны для подбора маршрутов. Профиль хранится только на этом устройстве; его можно удалить.",
      adult: "Профиль предназначен для читателей от 18 лет.",
      age: "Возраст, полных лет",
      ageHint: "От 18 до 120 лет.",
      level: "Уровень чтения",
      chooseLevel: "Выберите уровень",
      plain: "Простой",
      developing: "Средний",
      fluent: "Продвинутый",
      save: "Сохранить профиль",
      clear: "Удалить профиль",
      clearQuestion: "Удалить профиль с этого устройства?",
      confirmClear: "Да, удалить",
      cancelClear: "Отмена",
      invalidAge: "Укажите целое число от 18 до 120.",
      invalidLevel: "Выберите уровень чтения.",
      loading: "Загружаем профиль…",
      saving: "Сохраняем профиль…",
      clearing: "Удаляем профиль…",
      saved: "Профиль сохранён на этом устройстве.",
      empty: "Профиль не задан.",
      cleared: "Профиль удалён с этого устройства.",
      unsaved: "Изменения ещё не сохранены.",
      readFailed: "Не удалось загрузить профиль. Повторите загрузку, чтобы сохранить изменения.",
      writeFailed: "Не удалось подтвердить сохранение. Ваши изменения остаются в форме. Повторите попытку.",
      clearFailed: "Не удалось подтвердить удаление профиля. Повторите попытку.",
      editedAfterFailure: "Изменения в форме ещё не сохранены. Нажмите «Сохранить профиль», чтобы сохранить их.",
      unsupported: "Этот профиль сохранён в более новой версии приложения. Данные сохранены. Повторите загрузку или удалите профиль.",
      invalid: "Не удалось прочитать сохранённый профиль. Данные сохранены. Повторите загрузку или удалите профиль.",
      retryRead: "Повторить загрузку",
      retryWrite: "Повторить сохранение",
      retryClear: "Повторить удаление",
      rejected: "Не удалось выполнить действие. Повторите попытку.",
    },
    en: {
      heading: "Journey reader profile",
      description: "Optional. Your age and reading level help select journeys. This profile stays on this device, and you can delete it.",
      adult: "This profile is for readers aged 18 and over.",
      age: "Age in years",
      ageHint: "From 18 to 120 years.",
      level: "Reading level",
      chooseLevel: "Choose a level",
      plain: "Simple",
      developing: "Intermediate",
      fluent: "Advanced",
      save: "Save profile",
      clear: "Delete profile",
      clearQuestion: "Delete the profile from this device?",
      confirmClear: "Yes, delete",
      cancelClear: "Cancel",
      invalidAge: "Enter a whole number from 18 to 120.",
      invalidLevel: "Choose a reading level.",
      loading: "Loading your profile…",
      saving: "Saving your profile…",
      clearing: "Deleting your profile…",
      saved: "Your profile is saved on this device.",
      empty: "No profile has been set.",
      cleared: "Your profile has been deleted from this device.",
      unsaved: "Your changes have not been saved yet.",
      readFailed: "Your profile could not be loaded. Try loading it again before saving changes.",
      writeFailed: "Saving could not be confirmed. Your changes remain in the form. Please try again.",
      clearFailed: "Profile deletion could not be confirmed. Please try again.",
      editedAfterFailure: "The changes in this form have not been saved. Choose “Save profile” to save them.",
      unsupported: "This profile was saved by a newer version of the app. Its data has been kept. Try loading it again or delete the profile.",
      invalid: "The saved profile could not be read. Its data has been kept. Try loading it again or delete the profile.",
      retryRead: "Try loading again",
      retryWrite: "Try saving again",
      retryClear: "Try deleting again",
      rejected: "The action could not be completed. Please try again.",
    },
  },
} as const;

type Draft = { age: string; readingLevel: BookyReadingLevel | "" };
function draftFrom(policy: BookyReaderPolicySnapshot["policy"]): Draft {
  return { age: policy ? String(policy.age) : "", readingLevel: policy?.readingLevel ?? "" };
}
function isReadingLevel(value: string): value is BookyReadingLevel {
  return value === "plain" || value === "developing" || value === "fluent";
}
function draftKey(draft: Draft) { return `${draft.age}:${draft.readingLevel}`; }

/** Keep this hook in the application host, outside the collapsible Booky panel.
 * A failed write retains both its visible draft and its exact retry intent. */
export function useBookyReaderSettingsState(snapshot: BookyReaderPolicySnapshot) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(snapshot.policy));
  const [dirty, setDirty] = useState(false), dirtyRef = useRef(false);
  const [attempted, setAttempted] = useState(false), [rejected, setRejected] = useState(false);
  const [cleared, setCleared] = useState(false);
  const lastReadyRevision = useRef(snapshot.state === "ready" ? snapshot.revision : null);
  const lastKnownPolicy = useRef(snapshot.policy);
  const pending = useRef<"save" | "clear" | null>(null);
  const submittedDraft = useRef<string | null>(null);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;

  useLayoutEffect(() => {
    // Loading and writing deliberately hide policy in the store snapshot.
    // An absent record on foreground hydration is not a request to erase a
    // draft. Only an explicit confirmed clear can discard dirty local input.
    if (snapshot.state !== "ready" || lastReadyRevision.current === snapshot.revision) return;
    lastReadyRevision.current = snapshot.revision;
    lastKnownPolicy.current = snapshot.policy;
    const confirmedClear = pending.current === "clear" && snapshot.policy === null;
    if (confirmedClear || !dirtyRef.current
      || (snapshot.policy !== null && pending.current === "save"
        && submittedDraft.current === draftKey(currentDraft.current))) {
      setDraft(draftFrom(snapshot.policy));
      dirtyRef.current = false;
      setDirty(false);
      setAttempted(false);
    }
    setCleared(confirmedClear);
    setRejected(false);
    pending.current = null;
    submittedDraft.current = null;
  }, [snapshot.state, snapshot.revision, snapshot.policy]);

  return {
    draft, dirty, attempted, rejected, cleared,
    pending: pending.current,
    submittedDraft: submittedDraft.current,
    hasKnownPolicy: lastKnownPolicy.current !== null,
    updateDraft(next: Draft) {
      setDraft(next);
      dirtyRef.current = true;
      setDirty(true);
      setCleared(false);
      setRejected(false);
    },
    noteAttempt() { setAttempted(true); setRejected(false); },
    save(input: BookyReaderPolicyInput, onSave: (input: BookyReaderPolicyInput) => boolean) {
      const oldPending = pending.current, oldSubmitted = submittedDraft.current;
      pending.current = "save";
      submittedDraft.current = draftKey(currentDraft.current);
      const accepted = onSave(input);
      if (!accepted) {
        pending.current = oldPending;
        submittedDraft.current = oldSubmitted;
      }
      setRejected(!accepted);
      return accepted;
    },
    clear(onClear: () => boolean) {
      const oldPending = pending.current;
      pending.current = "clear";
      const accepted = onClear();
      if (accepted) submittedDraft.current = null;
      else pending.current = oldPending;
      setRejected(!accepted);
      return accepted;
    },
    retry(onRetry: () => boolean) {
      const accepted = onRetry();
      setRejected(!accepted);
      return accepted;
    },
  };
}
export type BookyReaderSettingsEditor = ReturnType<typeof useBookyReaderSettingsState>;

export default function BookyReaderSettings({ snapshot, editor, onSave, onClear, onRetry }: BookyReaderSettingsProps) {
  const { language } = useInterfaceLanguage();
  const copy = bookyReaderSettingsCopy.locales[language];
  const id = useId();
  const ageInput = useRef<HTMLInputElement>(null), levelInput = useRef<HTMLSelectElement>(null);
  const status = useRef<HTMLParagraphElement>(null), clearStart = useRef<HTMLButtonElement>(null);
  const clearConfirm = useRef<HTMLButtonElement>(null);
  const restoreClearFocus = useRef(false);
  // Confirmation and DOM focus belong to this opening of the panel only.
  const [clearAtRevision, setClearAtRevision] = useState<number | null>(null);
  const { draft, dirty, attempted, rejected, cleared, pending, submittedDraft } = editor;

  useLayoutEffect(() => {
    if (clearAtRevision === null) {
      if (restoreClearFocus.current) {
        restoreClearFocus.current = false;
        clearStart.current?.focus();
      }
      return;
    }
    if (clearAtRevision !== snapshot.revision) {
      if (clearConfirm.current?.closest('[role="group"]')?.contains(document.activeElement)) status.current?.focus();
      setClearAtRevision(null);
    } else clearConfirm.current?.focus();
  }, [clearAtRevision, snapshot.revision]);

  const busy = snapshot.state === "idle" || snapshot.state === "loading" || snapshot.state === "saving";
  const unreadable = snapshot.error === "read" || snapshot.error === "unsupported" || snapshot.error === "invalid";
  const locked = busy || unreadable;
  const age = draft.age.trim() === "" ? NaN : Number(draft.age);
  const validAge = Number.isFinite(age) && Number.isInteger(age) && age >= 18 && age <= 120;
  const validLevel = isReadingLevel(draft.readingLevel);
  const showAgeError = attempted && !validAge, showLevelError = attempted && !validLevel;
  const editedFailedSave = snapshot.error === "write" && pending === "save"
    && submittedDraft !== draftKey(draft);
  const canRetry = snapshot.state === "failed" && !editedFailedSave;
  const canClear = !busy && Boolean(editor.hasKnownPolicy || snapshot.error || draft.age || draft.readingLevel);
  const confirmingClear = clearAtRevision !== null;

  function updateDraft(next: Draft) {
    editor.updateDraft(next);
    setClearAtRevision(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    editor.noteAttempt();
    if (!validAge) { ageInput.current?.focus(); return; }
    if (!isReadingLevel(draft.readingLevel)) { levelInput.current?.focus(); return; }
    if (editor.save({ age, readingLevel: draft.readingLevel }, onSave)) setClearAtRevision(null);
    status.current?.focus();
  }

  let statusText: string;
  if (snapshot.state === "idle" || snapshot.state === "loading") statusText = copy.loading;
  else if (snapshot.state === "saving") statusText = pending === "clear" ? copy.clearing : copy.saving;
  else if (snapshot.error === "read") statusText = copy.readFailed;
  else if (snapshot.error === "unsupported") statusText = copy.unsupported;
  else if (snapshot.error === "invalid") statusText = copy.invalid;
  else if (snapshot.error === "write") statusText = editedFailedSave ? copy.editedAfterFailure
    : pending === "clear" ? copy.clearFailed : copy.writeFailed;
  else if (rejected) statusText = copy.rejected;
  else if (dirty) statusText = copy.unsaved;
  else if (cleared) statusText = copy.cleared;
  else statusText = snapshot.policy ? copy.saved : copy.empty;

  return (
    <details className="booky-reader-settings" data-booky-reader-settings="">
      <summary>{copy.heading}</summary>
      <div className="booky-reader-settings__body">
        <p id={`${id}-description`}>{copy.description}</p>
        <p id={`${id}-adult`} className="booky-reader-settings__hint">{copy.adult}</p>
        <form noValidate onSubmit={save} aria-describedby={`${id}-description ${id}-adult`}>
          <div className="booky-reader-settings__fields">
            <div className="booky-reader-settings__field">
              <label htmlFor={`${id}-age`}>{copy.age}</label>
              <input ref={ageInput} id={`${id}-age`} type="number" inputMode="numeric" min={18} max={120} step={1}
                autoComplete="off" required value={draft.age} disabled={locked} data-booky-reader-age=""
                aria-invalid={showAgeError || undefined}
                aria-describedby={`${id}-age-hint${showAgeError ? ` ${id}-age-error` : ""}`}
                onChange={event => updateDraft({ ...draft, age: event.currentTarget.value })} />
              <span id={`${id}-age-hint`} className="booky-reader-settings__hint">{copy.ageHint}</span>
              {showAgeError && <span id={`${id}-age-error`} className="booky-reader-settings__error" role="alert">{copy.invalidAge}</span>}
            </div>
            <div className="booky-reader-settings__field">
              <label htmlFor={`${id}-level`}>{copy.level}</label>
              <select ref={levelInput} id={`${id}-level`} required value={draft.readingLevel} disabled={locked}
                data-booky-reader-level="" aria-invalid={showLevelError || undefined}
                aria-describedby={showLevelError ? `${id}-level-error` : undefined}
                onChange={event => {
                  const value = event.currentTarget.value;
                  updateDraft({ ...draft, readingLevel: isReadingLevel(value) ? value : "" });
                }}>
                <option value="">{copy.chooseLevel}</option>
                <option value="plain">{copy.plain}</option>
                <option value="developing">{copy.developing}</option>
                <option value="fluent">{copy.fluent}</option>
              </select>
              {showLevelError && <span id={`${id}-level-error`} className="booky-reader-settings__error" role="alert">{copy.invalidLevel}</span>}
            </div>
          </div>
          <button type="submit" className="booky-reader-settings__save" disabled={locked || !dirty}
            data-booky-reader-save="">{copy.save}</button>
        </form>
        <p ref={status} id={`${id}-status`} className="booky-reader-settings__status" tabIndex={-1}
          role="status" aria-live="polite" aria-atomic="true" data-booky-reader-state={snapshot.state}
          data-booky-reader-error={snapshot.error ?? ""}>{statusText}</p>
        {canRetry && <button type="button" data-booky-reader-retry="" onClick={() => {
          editor.retry(onRetry);
          status.current?.focus();
        }}>{snapshot.error === "write" ? pending === "clear" ? copy.retryClear : copy.retryWrite : copy.retryRead}</button>}
        <div className="booky-reader-settings__clear">
          {confirmingClear ? <div role="group" aria-labelledby={`${id}-clear-question`}>
            <p id={`${id}-clear-question`}>{copy.clearQuestion}</p>
            <div className="booky-reader-settings__confirmation-actions">
              <button ref={clearConfirm} type="button" data-booky-reader-confirm-clear=""
                disabled={!canClear || clearAtRevision !== snapshot.revision}
                onClick={() => {
                  if (editor.clear(onClear)) setClearAtRevision(null);
                  status.current?.focus();
                }}>{copy.confirmClear}</button>
              <button type="button" data-booky-reader-cancel-clear="" onClick={() => {
                restoreClearFocus.current = true;
                setClearAtRevision(null);
              }}>{copy.cancelClear}</button>
            </div>
          </div> : <button ref={clearStart} type="button" data-booky-reader-clear="" disabled={!canClear}
            onClick={() => setClearAtRevision(snapshot.revision)}>{copy.clear}</button>}
        </div>
      </div>
    </details>
  );
}
