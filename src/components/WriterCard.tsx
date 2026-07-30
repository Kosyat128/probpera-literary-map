import type { WriterProfile } from "../data/countries/types";
import { getWriterWorkTitles } from "../data/bookArchive";

type Props = { writer: WriterProfile; onClose: () => void };

export default function WriterCard({ writer, onClose }: Props) {
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
      <small>Литературная карта мира</small>
      <h2>{writer.name || writer.fullName}</h2>
      <p><b>Страна:</b> {writer.country || ""}</p>
      <p><b>Годы жизни:</b> {writer.years || ""}</p>
      <p><b>Дата рождения:</b> {writer.birthDate || ""}</p>
      <p><b>Место рождения:</b> {writer.birthPlace || ""}</p>

      <h3>Литературная эпоха</h3>
      <p>{writer.tags?.join(", ") || "Информация уточняется"}</p>

      <h3>О писателе</h3>
      <p>{writer.bio || ""}</p>

      <h3>Произведения</h3>
      <ul>{getWriterWorkTitles(writer).map(w => <li key={w}>{w}</li>)}</ul>

      <h3>Связанные авторы</h3>
      <p>{writer.relatedWriters?.join(", ") || "Нет данных"}</p>

      <h3>Статьи ПРОБА ПЕРА</h3>
      <p>{writer.articleUrl ? "Есть статья" : "Готовится"}</p>

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
        Закрыть
      </button>
    </div>
  );
}
