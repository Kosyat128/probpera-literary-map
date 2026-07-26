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
        width: "320px",
        background: "#FFF8EE",
        color: "#35205F",
        padding: "24px",
        borderRadius: "18px",
        zIndex: 20,
        boxShadow: "0 12px 35px rgba(53,32,95,.25)",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{fontSize:"12px",opacity:.65,marginBottom:"6px"}}>Литературная карта мира</div>
      <h2 style={{ marginTop: 0, color: "#1F103D" }}>{writer.name || writer.fullName}</h2>
      <p><b>Страна:</b> {writer.country || ""}</p>
      <p><b>Место рождения:</b> {writer.birthPlace || ""}</p>
      <p><b>Годы жизни:</b> {writer.years || ""}</p>
      <h3>Главные произведения</h3>
      <ul>
        {(writer.works || []).map((work) => (
          <li key={work}>{work}</li>
        ))}
      </ul>
      <button
        onClick={onClose}
        style={{
          background: "#E97824",
          color: "#fff",
          border: "none",
          padding: "10px 18px",
          borderRadius: "10px",
          cursor: "pointer",
        }}
      >
        Закрыть
      </button>
    </div>
  );
}
