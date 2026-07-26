import type { WriterProfile } from "../data/countries/types";

type Props = {
  writer: WriterProfile;
  onClose: () => void;
};

export default function WriterCard({ writer, onClose }: Props) {
  return (
    <div style={{
      position:"absolute",
      right:"380px",
      top:"90px",
      width:"320px",
      maxHeight:"560px",
      overflowY:"auto",
      background:"#FFF8EE",
      color:"#35205F",
      padding:"20px",
      borderRadius:"18px",
      zIndex:20,
      boxShadow:"0 12px 35px rgba(53,32,95,.25)",
      fontFamily:"Georgia, serif"
    }}>
      <div style={{fontSize:"12px",opacity:.65}}>Литературная карта мира</div>
      <h2 style={{color:"#1F103D"}}>{writer.name || writer.fullName}</h2>
      <p><b>Страна:</b> {writer.country || ""}</p>
      <p><b>Годы жизни:</b> {writer.years || ""}</p>
      <p><b>Место рождения:</b> {writer.birthPlace || ""}</p>

      <h3>Литературная эпоха</h3>
      <p>{writer.tags?.join(", ") || "Информация уточняется"}</p>

      <h3>О писателе</h3>
      <p>{writer.bio || ""}</p>

      <h3>Главные произведения</h3>
      <ul>{(writer.works || []).map(work=><li key={work}>{work}</li>)}</ul>

      <h3>Связанные авторы</h3>
      <p>{writer.relatedWriters?.join(", ") || "Нет данных"}</p>

      <h3>Статьи на сайте ПРОБА ПЕРА</h3>
      <p>{writer.articleUrl ? "Открыть статью автора" : "Статья готовится"}</p>

      <button onClick={onClose} style={{background:"#E97824",color:"white",border:"none",padding:"10px 18px",borderRadius:"10px"}}>Закрыть</button>
    </div>
  );
}
