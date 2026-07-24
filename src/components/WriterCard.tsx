import type { Writer } from "../data/writers";

type Props = {
  writer: Writer;
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
        boxShadow: "0 10px 35px rgba(53,32,95,.25)",
        fontFamily: "Georgia, serif",
      }}
    >
      <h2 style={{ marginTop: 0, color: "#1F103D" }}>{writer.name}</h2>
      <p><b>Страна:</b> {writer.country}</p>
      <p><b>Город:</b> {writer.city}</p>
      <p><b>Годы жизни:</b> {writer.years}</p>

      <h3>Главные произведения</h3>
      <ul>
        {writer.books.map((book) => (
          <li key={book}>{book}</li>
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
