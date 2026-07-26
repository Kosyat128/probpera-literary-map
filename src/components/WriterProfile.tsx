import type { WriterProfile as Writer } from "../data/countries/types";
import { formatDate } from "../utils/formatDate";

type WriterProfileProps = {
  writer: Writer;
};

export default function WriterProfile({ writer }: WriterProfileProps) {
  return (
    <section style={{
      background: "#FFF8EE",
      borderRadius: "18px",
      padding: "24px",
      color: "#35205F"
    }}>
      {writer.portrait && (
        <img
          src={writer.portrait}
          alt={writer.fullName || writer.name}
          style={{ width: "220px", height: "280px", objectFit: "cover", borderRadius: "14px" }}
        />
      )}

      <h1>{writer.fullName || writer.name}</h1>

      {writer.birthDate && <p>🎂 Родился: {formatDate(writer.birthDate)}</p>}
      {writer.deathDate && <p>⚰ Умер: {formatDate(writer.deathDate)}</p>}
      {writer.years && <p>📅 Период жизни: {writer.years}</p>}

      {writer.birthPlace && <p>📍 Родился: {writer.birthPlace}</p>}
      {writer.deathPlace && <p>⚰ Место смерти: {writer.deathPlace}</p>}
      {writer.movement && <p>📚 Направление: {writer.movement}</p>}
      {writer.languages && <p>🌐 Языки: {writer.languages.join(", ")}</p>}
      {writer.nobelYear && <p>🏆 Нобелевская премия по литературе: {writer.nobelYear}</p>}

      <h2>Биография</h2>
      <p>{writer.biography || writer.bio || writer.description}</p>

      <h2>Главные произведения</h2>
      <ul>
        {(writer.works || []).map((work) => (
          <li key={work}>{work}</li>
        ))}
      </ul>
    </section>
  );
}
