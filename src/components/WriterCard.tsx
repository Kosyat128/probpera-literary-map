import type { WriterProfile } from "../data/countries/types";

type Props = {
  writer: WriterProfile;
  onClose: () => void;
};

export default function WriterCard({ writer, onClose }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        right: "30px",
        top: "30px",
        width: "360px",
        maxHeight: "720px",
        overflowY: "auto",
        background: "#FFF8EE",
        color: "#35205F",
        padding: "24px",
        borderRadius: "18px",
        zIndex: 20,
        boxShadow: "0 12px 35px rgba(53,32,95,.25)",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: "12px", opacity: .65, marginBottom: "6px" }}>
        Литературная карта мира
      </div>

      {writer.portrait && (
        <img src={writer.portrait} alt={writer.name || writer.fullName} style={{ width: "100%", borderRadius: "12px", marginBottom: "15px" }} />
      )}

      <h2 style={{ marginTop: 0, color: "#1F103D" }}>{writer.name || writer.fullName}</h2>

      <p><b>Страна:</b> {writer.country || ""}</p>
      <p><b>Национальность:</b> {writer.nationality || ""}</p>
      <p><b>Годы жизни:</b> {writer.years || ""}</p>
      <p><b>Место рождения:</b> {writer.birthPlace || ""}</p>

      <h3>Литературная эпоха</h3>
      <p>{writer.tags && writer.tags.length > 0 ? writer.tags.join(", ") : "Информация уточняется"}</p>

      {writer.movement && <p><b>Направление:</b> {writer.movement}</p>}
      {writer.genres && writer.genres.length > 0 && <p><b>Жанры:</b> {writer.genres.join(", ")}</p>}
      {writer.language && <p><b>Язык:</b> {writer.language}</p>}

      {writer.bio && (
        <>
          <h3>О писателе</h3>
          <p>{writer.bio}</p>
        </>
      )}

      <h3>Главные произведения</h3>
      <ul>{(writer.works || []).map((work) => <li key={work}>{work}</li>)}</ul>

      {writer.awards && writer.awards.length > 0 && (
        <>
          <h3>Награды</h3>
          <ul>{writer.awards.map((award) => <li key={award}>{award}</li>)}</ul>
        </>
      )}

      <h3>Связанные авторы</h3>
      {writer.relatedWriters && writer.relatedWriters.length > 0 ? (
        <ul>{writer.relatedWriters.map((id) => <li key={id}>{id}</li>)}</ul>
      ) : (
        <p>Связанные авторы будут добавлены.</p>
      )}

      <h3>Статьи на сайте ПРОБА ПЕРА</h3>
      {writer.articleUrl ? (
        <a href={writer.articleUrl}>Открыть статью автора</a>
      ) : (
        <p>Статья готовится.</p>
      )}

      <button onClick={onClose} style={{ background: "#E97824", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "10px", cursor: "pointer" }}>
        Закрыть
      </button>
    </div>
  );
}
