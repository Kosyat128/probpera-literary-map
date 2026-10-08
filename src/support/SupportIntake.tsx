import { useId, useState } from "react";
import { useInterfaceLanguage, type InterfaceLanguage } from "../i18n/InterfaceLanguage";
import { createSupportDraft, createSupportMailto, SUPPORT_INCIDENTS, SUPPORT_RECIPIENT, type SupportIncidentId } from "./supportDraft";
import "./supportIntake.css";

const replyLanguages: readonly { id: InterfaceLanguage; label: string }[] = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

const supportIntakeCopy = {
  ru: {
    heading: "Подготовить письмо в поддержку",
    intro: "Выберите тему и язык письма. Скопируйте тему и текст в почтовую программу и дополните описание.", openDraft: "Открыть черновик письма",
    category: "Тема обращения", chooseCategory: "Выберите тему", replyLocale: "Язык письма и ответа",
    chooseLocale: "Не выбран — черновик на английском",
    recipient: "Кому", subject: "Тема письма", body: "Текст письма",
    empty: "Чтобы увидеть черновик, выберите тему обращения.",
    fallback: "Если язык не выбран, черновик составляется на английском.",
  },
  en: {
    heading: "Prepare an email to support",
    intro: "Choose an issue and an email language. Copy the subject and body into your email app and add your description.", openDraft: "Open email draft",
    category: "Issue category", chooseCategory: "Choose an issue", replyLocale: "Language for the email and reply",
    chooseLocale: "Not selected — English draft",
    recipient: "To", subject: "Email subject", body: "Email body",
    empty: "Choose an issue category to see the draft.",
    fallback: "If no language is selected, the draft uses English.",
  },
} as const;

/** Local preview by default. Only the PWA help entry explicitly enables the
 * prefilled email link; existing bare links and native policy stay unchanged. */
export default function SupportIntake({ allowPrefilledEmail = false }: { allowPrefilledEmail?: boolean } = {}) {
  const { language } = useInterfaceLanguage();
  const copy = supportIntakeCopy[language];
  const id = useId();
  const [incidentId, setIncidentId] = useState<SupportIncidentId | null>(null);
  const [replyLocale, setReplyLocale] = useState<InterfaceLanguage | null>(null);
  const draft = incidentId ? createSupportDraft(incidentId, replyLocale) : null;
  return <details className="support-intake" data-support-intake data-copy-review="draft">
    <summary>{copy.heading}</summary>
    <p id={`${id}-description`}>{copy.intro}</p>
    <div className="support-intake__fields">
      <label htmlFor={`${id}-category`}>{copy.category}</label>
      <select id={`${id}-category`} value={incidentId ?? ""} aria-describedby={`${id}-description`} onChange={event => {
        const incident = SUPPORT_INCIDENTS.find(candidate => candidate.id === event.currentTarget.value);
        setIncidentId(incident?.id ?? null);
      }}>
        <option value="">{copy.chooseCategory}</option>
        {SUPPORT_INCIDENTS.map(incident => <option key={incident.id} value={incident.id}>{incident[language].title}</option>)}
      </select>
      <label htmlFor={`${id}-locale`}>{copy.replyLocale}</label>
      <select id={`${id}-locale`} value={replyLocale ?? ""} aria-describedby={`${id}-fallback`} onChange={event => {
        const value = event.currentTarget.value;
        setReplyLocale(value === "ru" || value === "en" ? value : null);
      }}>
        <option value="">{copy.chooseLocale}</option>
        {replyLanguages.map(option => <option key={option.id} value={option.id} lang={option.id}>{option.label}</option>)}
      </select>
    </div>
    <p id={`${id}-fallback`}>{copy.fallback}</p>
    {draft ? <div className="support-intake__fields" data-support-draft={draft.incidentId}>
      <p>{copy.recipient}: <span>{SUPPORT_RECIPIENT}</span></p>
      {allowPrefilledEmail ? <a className="support-intake__open" href={createSupportMailto(draft.incidentId, draft.replyLocale)}>{copy.openDraft}</a> : null}
      <label htmlFor={`${id}-subject`}>{copy.subject}</label>
      <textarea id={`${id}-subject`} readOnly rows={2} lang={draft.replyLocale} value={draft.subject} />
      <label htmlFor={`${id}-body`}>{copy.body}</label>
      <textarea id={`${id}-body`} readOnly rows={10} lang={draft.replyLocale} value={draft.body} />
    </div> : <p>{copy.empty}</p>}
  </details>;
}
