import { useId } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyJourneyRuntimeSnapshot } from "./bookyJourneyRuntime";

/** Interface feedback only. The admitted dialogue supplies the reviewed task;
 * choices use current canonical localized writer names from its compiled plan. */
export const bookyJourneyActivityCopy = { reviewStatus: "draft", productionReady: false, locales: {
  ru: { choices: "Выберите автора", unanswered: "Выберите ответ, затем подтвердите шаг.",
    incorrect: "Этот ответ не подходит. Можно выбрать другой вариант.",
    correct: "Верно. Подтвердите шаг, когда будете готовы." },
  en: { choices: "Choose the author", unanswered: "Choose an answer, then acknowledge the step.",
    incorrect: "That answer does not match. You can choose another option.",
    correct: "Correct. Acknowledge the step when you are ready." },
} } as const;

export default function BookyJourneyActivityControls({ active, canAct, onAnswer }: {
  active: NonNullable<BookyJourneyRuntimeSnapshot["active"]>;
  canAct: boolean;
  onAnswer: (choiceId: string) => void;
}) {
  const { language } = useInterfaceLanguage(), id = useId(), copy = bookyJourneyActivityCopy.locales[language];
  const answer = active.answer, choices = active.node?.activityChoices;
  if (active.node?.kind !== "activity" || !answer || !choices) return null;
  return <div className="booky-journey-controls__activity" data-booky-journey-activity="">
    <div role="group" aria-labelledby={`${id}-choices`} aria-describedby={`${id}-feedback`}>
      <p id={`${id}-choices`}><strong>{copy.choices}</strong></p>
      <div className="booky-journey-controls__activity-choices">
        {choices.map(choice => <button type="button" key={choice.id} data-booky-journey-answer={choice.id}
          aria-pressed={answer.choiceId === choice.id} disabled={!canAct || !answer.canAnswer}
          onClick={() => onAnswer(choice.id)}>{choice.label}</button>)}
      </div>
    </div>
    <p id={`${id}-feedback`} role="status" aria-live="polite" aria-atomic="true"
      data-booky-journey-answer-status={answer.status}>{copy[answer.status]}</p>
  </div>;
}
