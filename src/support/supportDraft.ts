import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";

export const SUPPORT_RECIPIENT = "probperasite@yandex.ru";

/** Shared incident categories from requirement 155. Implementation copy remains
 * draft; these categories do not create tickets or establish a response SLA. */
export const SUPPORT_INCIDENTS = [
  { id: "installation-launch", ru: { title: "Установка и запуск", prompt: "Опишите, на каком шаге не удаётся установить или запустить приложение." },
    en: { title: "Installation and launch", prompt: "Describe the step at which installation or launch fails." } },
  { id: "globe-webgl", ru: { title: "Глобус и WebGL", prompt: "Опишите, что происходит при открытии или использовании глобуса." },
    en: { title: "Globe and WebGL", prompt: "Describe what happens when you open or use the globe." } },
  { id: "content-correction", ru: { title: "Исправление материалов", prompt: "Назовите материал и предложите исправление." },
    en: { title: "Content correction", prompt: "Name the content and describe the correction you suggest." } },
  { id: "child-parent-gate", ru: { title: "Детский режим и родительский доступ", prompt: "Опишите проблему с детским режимом или родительским доступом без персональных данных ребёнка." },
    en: { title: "Child mode and Parent Gate", prompt: "Describe the issue with child mode or Parent Gate without including a child's personal data." } },
  { id: "purchase-restore-refund", ru: { title: "Покупка, восстановление и возврат средств", prompt: "Опишите вопрос о покупке, восстановлении покупки или возврате средств." },
    en: { title: "Purchase, Restore and refund", prompt: "Describe your question about a purchase, Restore or a refund." } },
  { id: "account-deletion", ru: { title: "Аккаунт и удаление", prompt: "Опишите вопрос об аккаунте или его удалении." },
    en: { title: "Account and deletion", prompt: "Describe your question about an account or its deletion." } },
  { id: "privacy-data-request", ru: { title: "Конфиденциальность и запрос данных", prompt: "Опишите свой вопрос о конфиденциальности или запрос данных." },
    en: { title: "Privacy and data request", prompt: "Describe your privacy question or data request." } },
  { id: "rights-takedown", ru: { title: "Права и удаление материалов", prompt: "Назовите материал и опишите вопрос о правах или удалении материала." },
    en: { title: "Rights and takedown", prompt: "Name the content and describe your rights or takedown question." } },
  { id: "accessibility", ru: { title: "Доступность", prompt: "Опишите, что мешает пользоваться приложением и какое действие вы хотите выполнить." },
    en: { title: "Accessibility", prompt: "Describe the barrier you encounter and the action you want to complete." } },
  { id: "store-review-moderation", ru: { title: "Проверка и модерация в магазине", prompt: "Укажите магазин и опишите вопрос о проверке или модерации." },
    en: { title: "Store review and moderation", prompt: "Name the store and describe your review or moderation question." } },
  { id: "security-incident", ru: { title: "Инцидент безопасности", prompt: "Опишите подозрительное поведение без паролей, кодов подтверждения или секретных ключей." },
    en: { title: "Security incident", prompt: "Describe the suspicious behavior without passwords, verification codes or secret keys." } },
] as const;

export type SupportIncidentId = typeof SUPPORT_INCIDENTS[number]["id"];
export type SupportDraft = Readonly<{
  incidentId: SupportIncidentId;
  recipient: typeof SUPPORT_RECIPIENT;
  replyLocale: InterfaceLanguage;
  subject: string;
  body: string;
}>;

/** Only an explicit supported choice selects Russian; no device, account or
 * browser preference is inferred for the email recipient's reply locale. */
export function resolveSupportReplyLocale(choice: unknown): InterfaceLanguage {
  return choice === "ru" ? "ru" : "en";
}

export function createSupportDraft(incidentId: SupportIncidentId, recipientLocale?: unknown): SupportDraft {
  const incident = SUPPORT_INCIDENTS.find(candidate => candidate.id === incidentId);
  if (!incident) throw new RangeError("Unknown support incident");
  const replyLocale = resolveSupportReplyLocale(recipientLocale);
  const copy = incident[replyLocale];
  const subject = replyLocale === "ru" ? `Проба Пера — Поддержка [${incident.id}]: ${copy.title}` : `Proba Pera — Support [${incident.id}]: ${copy.title}`;
  const body = replyLocale === "ru"
    ? `Здравствуйте!\n\nКатегория: ${copy.title}\nКод категории: ${incident.id}\nПредпочитаемый язык ответа: русский.\n\n[${copy.prompt}]\n\nНе включайте пароли, коды подтверждения, платёжные реквизиты или персональные данные ребёнка.`
    : `Hello,\n\nCategory: ${copy.title}\nCategory ID: ${incident.id}\nPreferred reply language: English.\n\n[${copy.prompt}]\n\nDo not include passwords, verification codes, payment details or a child's personal data.`;
  return { incidentId, recipient: SUPPORT_RECIPIENT, replyLocale, subject, body };
}

/** Opt-in PWA action only. No caller-supplied recipient, body or draft object
 * can expand the link; all fields come from the closed local formatter. */
export function createSupportMailto(incidentId: SupportIncidentId, recipientLocale?: unknown): string {
  const draft = createSupportDraft(incidentId, recipientLocale);
  return `mailto:${SUPPORT_RECIPIENT}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}
