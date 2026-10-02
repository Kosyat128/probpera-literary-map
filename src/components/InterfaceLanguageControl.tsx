import {
  useInterfaceLanguage,
  type InterfaceLanguage,
} from "../i18n/InterfaceLanguage";
import CountryFlagIcon from "./CountryFlagIcon";

type Props = {
  presentation?: "labels" | "flags";
};

const languages: Array<{
  id: InterfaceLanguage;
  shortLabel: string;
  label: string;
  flagCode: "RU" | "GB";
}> = [
  { id: "ru", shortLabel: "RU", label: "Русский язык", flagCode: "RU" },
  { id: "en", shortLabel: "EN", label: "Английский язык", flagCode: "GB" },
];

export default function InterfaceLanguageControl({
  presentation = "labels",
}: Props = {}) {
  const { language, setLanguage, t } = useInterfaceLanguage();

  return (
    <div
      className={
        presentation === "flags"
          ? "interface-language-control interface-language-control--flags"
          : "interface-language-control"
      }
      data-interface-language-presentation={
        presentation === "flags" ? "flags" : undefined
      }
      role="group"
      aria-label={t("Язык интерфейса")}
    >
      {languages.map((item) => (
        <button
          type="button"
          key={item.id}
          data-interface-language={item.id}
          className={language === item.id ? "is-active" : ""}
          aria-label={t(item.label)}
          aria-pressed={language === item.id}
          title={t(item.label)}
          onClick={() => setLanguage(item.id)}
        >
          {presentation === "flags" ? (
            <>
              <CountryFlagIcon
                code={item.flagCode}
                countryName={t(item.label)}
                className="interface-language-control__flag country-flag-icon--round"
                size={28}
                decorative
                priority
              />
              {language === item.id && (
                <span
                  className="interface-language-control__selected"
                  aria-hidden="true"
                />
              )}
            </>
          ) : (
            item.shortLabel
          )}
        </button>
      ))}
    </div>
  );
}
