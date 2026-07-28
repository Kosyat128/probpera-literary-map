import type { Country } from "../data/types";
import { getCountryMetadata } from "../data/countries/getCountryMetadata";

type Props = {
  country: Country;
  onWriterSelect?: (writer: Country["writers"][number]) => void;
};

export default function CountryStats({ country, onWriterSelect }: Props){
  const data = country as Country & {
    nobel?: number;
    places?: number;
    influence?: number;
    flag?: string;
  };

  const metadata = getCountryMetadata(country.id);
  const featuredWriters = country.writers.slice(0, 5);

  return (
    <div style={{
      background:"#FFF8EE",
      borderRadius:"16px",
      padding:"15px",
      marginBottom:"18px"
    }}>
      <h3 style={{color:"#35205F"}}>
        {data.flag ?? "🌍"} {country.name}
      </h3>

      <div>✒️ Авторов: <b>{country.writers.length}</b></div>
      <div>🏅 Нобелевских лауреатов: <b>{data.nobel ?? 0}</b></div>
      <div>📍 Литературных мест: <b>{data.places ?? 0}</b></div>

      {metadata && (
        <div style={{marginTop:"15px"}}>
          <div>🌍 Континент: <b>{metadata.continent}</b></div>
          <div>🗺 Регион: <b>{metadata.region}</b></div>
          <div>🗣 Язык: <b>{metadata.officialLanguage}</b></div>

          <div style={{marginTop:"10px"}}>
            📜 Эпохи:
            <br />
            {metadata.literaryPeriods.join(" • ")}
          </div>

          <div style={{marginTop:"10px"}}>
            ✒️ Направления:
            <br />
            {metadata.literaryMovements.join(" • ")}
          </div>
        </div>
      )}

      <div style={{marginTop:"15px"}}>
        ⭐ Главные авторы:
        <ul>
          {featuredWriters.map((writer) => (
            <li key={writer.id}>
              <button
                onClick={() => onWriterSelect?.(writer)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#35205F",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: "bold"
                }}
              >
                {writer.name || writer.fullName}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p style={{marginTop:"15px"}}>
        Литературное влияние
      </p>

      <div style={{
        height:"10px",
        background:"#E6D5C0",
        borderRadius:"10px"
      }}>
        <div style={{
          height:"100%",
          width:`${data.influence ?? 70}%`,
          background:"#E97824",
          borderRadius:"10px"
        }}/>
      </div>
    </div>
  );
}
