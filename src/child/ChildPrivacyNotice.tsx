/** Read-only child-facing draft. Human readability/legal approval is separate.
 * This component receives no profile data, services, callbacks or authority. */
const copy = {
  ru: {
    title: "О твоих данных",
    paragraphs: [
      "На этом устройстве сохраняются имя профиля, возраст и настройки. Здесь же хранятся избранное, недавние материалы, шаги путешествий, значки и скачанные маршруты.",
      "Взрослый может сохранить копию данных в файл или удалить профиль вместе с его данными. Для этого нужно подтверждение взрослого.",
      "Сохранённый файл — отдельная копия. Взрослый удаляет его отдельно.",
      "Если что-то непонятно, попроси взрослого прочитать это вместе с тобой.",
    ],
  },
  en: {
    title: "About your information",
    paragraphs: [
      "Your profile name, age and settings are saved on this device. Your favorites, recent materials, journey steps, badges and downloaded routes are kept here too.",
      "An adult can save a copy of the information to a file or remove your profile and its information. The adult needs to confirm this action.",
      "A saved file is a separate copy. The adult deletes it separately.",
      "If something is unclear, ask an adult to read this with you.",
    ],
  },
} as const;

export function ChildPrivacyNotice({ language }: { language: "ru" | "en" }) {
  const text = copy[language];
  return <details className="child-native-privacy" lang={language} data-child-native-privacy="local-v1">
    <summary>{text.title}</summary>
    <div className="child-native-privacy-copy">
      {text.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </div>
  </details>;
}
