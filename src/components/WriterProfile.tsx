import type { WriterProfile as Writer } from "../data/countries/types";
import { formatDate } from "../utils/formatDate";
import { resolveRelatedWriters } from "../utils/resolveRelatedWriters";

type WriterProfileProps = {
  writer: Writer;
};

function calculateAge(birthDate?: string, deathDate?: string) {
  if (!birthDate || !deathDate) return "";

  const birth = new Date(birthDate);
  const death = new Date(deathDate);

  let age = death.getFullYear() - birth.getFullYear();
  const monthDiff = death.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && death.getDate() < birth.getDate())) {
    age--;
  }

  return age > 0 ? `${age} лет` : "";
}

export default function WriterProfile({ writer }: WriterProfileProps) {
  const age = calculateAge(writer.birthDate, writer.deathDate);
  const relatedNames = resolveRelatedWriters(writer.relatedWriters || []);

  return (
    <section style={{
      background: "#FFF8EE",
      borderRadius: "18px",
      padding: "24px",
      color: "#35205F"
    }}>
      {writer.portrait && (
        <img src={writer.portrait} alt={writer.fullName || writer.name}
          style={{ width: "220px", height: "280px", objectFit: "cover", borderRadius: "14px" }} />
      )}

      <h1>{writer.fullName || writer.name}</h1>

      {writer.birthDate && <p>🎂 Родился: {formatDate(writer.birthDate)}</p>}
      {writer.deathDate && <p>⚰ Умер: {formatDate(writer.deathDate)}</p>}
      {age && <p>⌛ Прожил: {age}</p>}
      {writer.years && <p>📅 Период жизни: {writer.years}</p>}

      {writer.birthPlace && <p>📍 Родился: {writer.birthPlace}</p>}
      {writer.deathPlace && <p>⚰ Место смерти: {writer.deathPlace}</p>}
      {writer.movement && <p>📚 Направление: {writer.movement}</p>}
      {writer.literaryEra && <p>⏳ Литературная эпоха: {writer.literaryEra}</p>}
      {writer.languages && <p>🌐 Языки: {writer.languages.join(", ")}</p>}

      {relatedNames.length > 0 && (
        <>
          <h2>🤝 Связанные авторы</h2>
          <ul>
            {relatedNames.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}

      {writer.articles && writer.articles.length > 0 && (
        <>
          <h2>📰 Статьи на сайте ПРОБА ПЕРА</h2>
          <ul>
            {writer.articles.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}

      {writer.nobelYear && <p>🏆 Нобелевская премия по литературе: {writer.nobelYear}</p>}

      <h2>Биография</h2>
      <p>{writer.biography || writer.bio || writer.description}</p>

      <h2>Главные произведения</h2>
      <ul>
        {(writer.works || []).map((work) => <li key={work}>{work}</li>)}
      </ul>
    </section>
  );
}
