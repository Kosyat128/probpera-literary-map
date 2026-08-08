import type { WriterProfile as Writer } from "../data/countries/types";
import {
  selectWriterDisplayName,
  selectWriterYears,
} from "../data/bookLocalization";
import { getPublicWriterWorkTitles } from "../data/bookArchive";
import { selectWriterBiography } from "../data/writerBiography";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { resolveRelatedWriters } from "../utils/resolveRelatedWriters";
import WriterPortrait from "./WriterPortrait";

type WriterProfileProps = {
  writer: Writer;
};

function calculateAge(birthDate?: string, deathDate?: string) {
  if (!birthDate || !deathDate) return null;

  const birth = new Date(birthDate);
  const death = new Date(deathDate);

  let age = death.getFullYear() - birth.getFullYear();
  const monthDiff = death.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && death.getDate() < birth.getDate())) {
    age--;
  }

  return age > 0 ? age : null;
}

function localizedDate(value: string, language: "ru" | "en") {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function WriterProfile({ writer }: WriterProfileProps) {
  const { language, t } = useInterfaceLanguage();
  const age = calculateAge(writer.birthDate, writer.deathDate);
  const relatedNames = resolveRelatedWriters(writer.relatedWriters || []);
  const biography = selectWriterBiography(writer, language);
  const writerName = selectWriterDisplayName(writer, language, t("Автор"));

  return (
    <section style={{
      background: "#FFF8EE",
      borderRadius: "18px",
      padding: "24px",
      color: "#35205F"
    }}>
      <WriterPortrait writer={writer} className="writer-profile-portrait" />

      <h1>{writerName}</h1>

      {writer.birthDate && (
        <p>🎂 {t("Дата рождения")}: {localizedDate(writer.birthDate, language)}</p>
      )}
      {writer.deathDate && (
        <p>⚰ {t("Дата смерти")}: {localizedDate(writer.deathDate, language)}</p>
      )}
      {age && <p>⌛ {t("Прожил")}: {age} {t("лет")}</p>}
      {selectWriterYears(writer, language) && (
        <p>📅 {t("Период жизни")}: {selectWriterYears(writer, language)}</p>
      )}

      {language === "ru" && writer.birthPlace && <p>📍 {t("Место рождения")}: {writer.birthPlace}</p>}
      {language === "ru" && writer.deathPlace && <p>⚰ {t("Место смерти")}: {writer.deathPlace}</p>}
      {language === "ru" && writer.movement && <p>📚 {t("Направление")}: {writer.movement}</p>}
      {language === "ru" && writer.literaryEra && <p>⏳ {t("Литературная эпоха")}: {writer.literaryEra}</p>}
      {language === "ru" && writer.languages && <p>🌐 {t("Языки")}: {writer.languages.join(", ")}</p>}

      {language === "ru" && relatedNames.length > 0 && (
        <>
          <h2>🤝 {t("Связанные авторы")}</h2>
          <ul>
            {relatedNames.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}

      {language === "ru" && writer.articles && writer.articles.length > 0 && (
        <>
          <h2>📰 {t("Статьи на сайте ПРОБА ПЕРА")}</h2>
          <ul>
            {writer.articles.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}

      {writer.nobelYear && <p>🏆 {t("Нобелевская премия по литературе")}: {writer.nobelYear}</p>}

      <h2>{t("Биография")}</h2>
      <p>
        {biography?.text ||
          (language === "en"
            ? t("Проверенный английский перевод биографии ещё готовится.")
            : t("Расширенная биография готовится для энциклопедии."))}
      </p>
      {biography?.sources.length ? (
        <p>
          {t("Источники")}: {biography.sources.map((source, index) => (
            <span key={source.url}>
              {index > 0 ? ", " : ""}
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.author ? `${source.author} — ` : ""}
                {source.title || source.provider}
              </a>
              {source.licenseUrl && source.licenseName ? (
                <>
                  {" · "}
                  <a
                    href={source.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.licenseName}
                  </a>
                </>
              ) : null}
            </span>
          ))}
        </p>
      ) : null}

      <h2>{t("Главные произведения")}</h2>
      <ul>
        {getPublicWriterWorkTitles(writer, language).map((work) => <li key={work}>{work}</li>)}
      </ul>
    </section>
  );
}
