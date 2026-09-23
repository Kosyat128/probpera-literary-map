import { useId } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { ContentEntityRef, ContentLocale } from "../planet/contentExportTypes";
import "./BookyJourneyPassportControls.css";

export type BookyJourneyPassportControlsProps = {
  state: "profile-required" | "pending" | "ready";
  passport: Readonly<{
    entities: readonly ContentEntityRef[];
    completedJourneys: readonly Readonly<{ id: string; version: number; locale: ContentLocale; title: string }>[];
  }>;
  onManageHistory?: () => void;
};

/** Draft interface copy; the host supplies only currently admitted passport data. */
export const bookyJourneyPassportCopy = { reviewStatus: "draft", productionReady: false, locales: {
  ru: {
    heading: "Литературный паспорт",
    profileRequired: "Чтобы увидеть литературный паспорт, заполните профиль для маршрутов ниже.",
    pending: "Паспорт пока недоступен. Состояние сохранения прогресса показано ниже.",
    ready: "Здесь учтены подтверждённые шаги доступных маршрутов.",
    empty: "В доступных маршрутах пока нет подтверждённых шагов.",
    counts: "Подтверждённые шаги маршрутов",
    country: "Страны", writer: "Писатели", work: "Произведения",
    completed: "Завершённые маршруты", noCompleted: "Завершённых доступных маршрутов пока нет.",
    version: (value: number) => `Версия ${value}`,
    locale: { ru: "Русский", en: "Английский" },
    manageHistory: "Перейти к истории",
  },
  en: {
    heading: "Literary passport",
    profileRequired: "Complete the journey reader profile below to see your literary passport.",
    pending: "Your passport is currently unavailable. Progress saving status is shown below.",
    ready: "This shows acknowledged steps in available journeys.",
    empty: "There are no acknowledged steps in available journeys yet.",
    counts: "Acknowledged journey steps",
    country: "Countries", writer: "Writers", work: "Works",
    completed: "Completed journeys", noCompleted: "There are no completed available journeys yet.",
    version: (value: number) => `Version ${value}`,
    locale: { ru: "Russian", en: "English" },
    manageHistory: "Go to history",
  },
} } as const;

export default function BookyJourneyPassportControls({ state, passport, onManageHistory }: BookyJourneyPassportControlsProps) {
  const { language } = useInterfaceLanguage(), copy = bookyJourneyPassportCopy.locales[language], id = useId();
  const ready = state === "ready";
  const empty = passport.entities.length === 0 && passport.completedJourneys.length === 0;
  const message = state === "profile-required" ? copy.profileRequired : state === "pending" ? copy.pending
    : empty ? copy.empty : copy.ready;

  return <details className="booky-journey-passport" data-booky-journey-passport={state}>
    <summary data-booky-journey-passport-summary="">{copy.heading}</summary>
    <div className="booky-journey-passport__body">
      <p role="status" aria-live="polite" aria-atomic="true" data-booky-journey-passport-status={state}>{message}</p>
      {ready && <>
        <p id={`${id}-counts`} className="booky-journey-passport__caption">{copy.counts}</p>
        <dl className="booky-journey-passport__counts" aria-labelledby={`${id}-counts`}>
          {(["country", "writer", "work"] as const).map(kind => <div key={kind}>
            <dt>{copy[kind]}</dt>
            <dd data-booky-journey-passport-count={kind}>{passport.entities.filter(entity => entity.kind === kind).length}</dd>
          </div>)}
        </dl>
        <h4 id={`${id}-completed`}>{copy.completed}</h4>
        {passport.completedJourneys.length ? <ul className="booky-journey-passport__completed"
          aria-labelledby={`${id}-completed`} data-booky-journey-passport-completed-list="">
          {passport.completedJourneys.map(journey => <li key={JSON.stringify([journey.id, journey.version, journey.locale])}
            data-booky-journey-passport-completed-journey={journey.id}
            data-booky-journey-passport-version={journey.version} data-booky-journey-passport-locale={journey.locale}>
            <span className="booky-journey-passport__title" data-booky-journey-passport-completed-title="">{journey.title}</span>
            <span className="booky-journey-passport__meta">{copy.version(journey.version)} · {copy.locale[journey.locale]}</span>
          </li>)}
        </ul> : <p className="booky-journey-passport__caption">{copy.noCompleted}</p>}
      </>}
      {onManageHistory && <button type="button" data-booky-journey-passport-manage-history=""
        onClick={onManageHistory}>{copy.manageHistory}</button>}
    </div>
  </details>;
}
