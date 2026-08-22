import {
  useInterfaceLanguage,
  type InterfaceLanguage,
} from "../i18n/InterfaceLanguage";

const languages: Array<{
  id: InterfaceLanguage;
  shortLabel: string;
  label: string;
}> = [
  { id: "ru", shortLabel: "RU", label: "Русский язык" },
  { id: "en", shortLabel: "EN", label: "Английский язык" },
];

export default function InterfaceLanguageControl() {
  const { language, setLanguage, t } = useInterfaceLanguage();

  return (
    <div
      className="interface-language-control"
      role="group"
      aria-label={t("Язык интерфейса")}
    >
      {languages.map((item) => (
        <button
          type="button"
          key={item.id}
          className={language === item.id ? "is-active" : ""}
          aria-label={t(item.label)}
          aria-pressed={language === item.id}
          title={t(item.label)}
          onClick={() => setLanguage(item.id)}
        >
          {item.shortLabel}
        </button>
      ))}
    </div>
  );
}
