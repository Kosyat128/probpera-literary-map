import type { WriterProfile } from "../data/countries/types";
import {
  selectWriterDisplayName,
  selectWriterYears,
} from "../data/bookLocalization";
import { getPublicWriterWorkTitles } from "../data/bookArchive";
import { selectWriterBiography } from "../data/writerBiography";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type Props = { writer: WriterProfile; onClose: () => void };

export default function WriterCard({ writer, onClose }: Props) {
  const { language, t } = useInterfaceLanguage();
  const biography = selectWriterBiography(writer, language);
  const writerName = selectWriterDisplayName(writer, language, t("Автор"));

  return (
    <div style={{
      position:"absolute",
      right:"20px",
      top:"20px",
      width:"300px",
      maxHeight:"580px",
      overflowY:"auto",
      background:"#FFF8EE",
      color:"#35205F",
      padding:"20px",
      borderRadius:"16px",
      zIndex:30,
      boxShadow:"0 12px 35px rgba(31,16,61,.3)",
      fontFamily:"Georgia, serif"
    }}>
      <small>{t("Литературная карта мира")}</small>
      <h2>{writerName}</h2>
      {language === "ru" && writer.country && <p><b>{t("Страна")}:</b> {writer.country}</p>}
      <p><b>{t("Годы жизни")}:</b> {selectWriterYears(writer, language) || t("Информация уточняется")}</p>
      {writer.birthDate && <p><b>{t("Дата рождения")}:</b> {writer.birthDate}</p>}
      {language === "ru" && writer.birthPlace && <p><b>{t("Место рождения")}:</b> {writer.birthPlace}</p>}

      {language === "ru" && (
        <>
          <h3>{t("Литературная эпоха")}</h3>
          <p>{writer.tags?.join(", ") || t("Информация уточняется")}</p>
        </>
      )}

      <h3>{t("О писателе")}</h3>
      <p>
        {biography?.text ||
          (language === "en"
            ? t("Проверенный английский перевод биографии ещё готовится.")
            : t("Расширенная биография готовится для энциклопедии."))}
      </p>
      {biography?.sources.map((source) => (
        <div key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.author ? `${source.author} — ` : ""}
            {source.title || source.provider}
          </a>
          {source.licenseUrl && source.licenseName ? (
            <a href={source.licenseUrl} target="_blank" rel="noreferrer">
              {source.licenseName}
            </a>
          ) : null}
        </div>
      ))}

      <h3>{t("Произведения")}</h3>
      <ul>{getPublicWriterWorkTitles(writer, language).map(w => <li key={w}>{w}</li>)}</ul>

      {language === "ru" && (
        <>
          <h3>{t("Связанные авторы")}</h3>
          <p>{writer.relatedWriters?.join(", ") || t("Нет данных")}</p>

          <h3>{t("Статьи ПРОБА ПЕРА")}</h3>
          <p>{writer.articleUrl ? t("Есть статья") : t("Готовится")}</p>
        </>
      )}

      <button
        onClick={onClose}
        style={{
          background:"#E97824",
          color:"white",
          border:0,
          padding:"10px 20px",
          borderRadius:"10px",
          cursor:"pointer"
        }}>
        {t("Закрыть")}
      </button>
    </div>
  );
}
