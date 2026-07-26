import type { WriterProfile } from "../data/countries/types";

type Props = { writer: WriterProfile; onClose: () => void };

export default function WriterCard({ writer, onClose }: Props) {
  return (
    <div style={{
      position:"absolute",
      left:"50%",
      top:"40px",
      transform:"translateX(-50%)",
      width:"330px",
      maxHeight:"620px",
      overflowY:"auto",
      background:"#FFF8EE",
      color:"#35205F",
      padding:"22px",
      borderRadius:"18px",
      zIndex:30,
      boxShadow:"0 15px 40px rgba(31,16,61,.35)",
      fontFamily:"Georgia, serif"
    }}>
      <small>Литературная карта мира</small>
      <h2>{writer.name || writer.fullName}</h2>
      <p><b>Страна:</b> {writer.country || ""}</p>
      <p><b>Годы жизни:</b> {writer.years || ""}</p>
      <p><b>Место рождения:</b> {writer.birthPlace || ""}</p>
      <h3>Литературная эпоха</h3>
      <p>{writer.tags?.join(", ") || ""}</p>
      <h3>О писателе</h3>
      <p>{writer.bio || ""}</p>
      <h3>Произведения</h3>
      <ul>{(writer.works || []).map(w=><li key={w}>{w}</li>)}</ul>
      <h3>Связанные авторы</h3>
      <p>{writer.relatedWriters?.join(", ") || "Нет данных"}</p>
      <h3>Статьи ПРОБА ПЕРА</h3>
      <p>{writer.articleUrl ? "Есть статья" : "Готовится"}</p>
      <button onClick={onClose} style={{background:"#E97824",color:"white",border:0,padding:"10px 20px",borderRadius:"10px"}}>Закрыть</button>
    </div>
  );
}
