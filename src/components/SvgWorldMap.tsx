import { useState } from "react";
import { literaryCountries } from "../data/literaryMap/countries";
import mapSvg from "../assets/map/world-countries.svg";


type SelectedCountry = {
  id: string;
  name: string;
  writers: number;
  authors: string[];
};


export default function SvgWorldMap() {

  const [selected, setSelected] = useState<SelectedCountry | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);


  const handleCountryClick = (id: string) => {

    const country = literaryCountries[id as keyof typeof literaryCountries];

    if (!country) return;

    setSelected({
      id,
      name: country.name,
      writers: country.writers,
      authors: country.authors,
    });
  };


  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#F7EBDD",
        borderRadius: "18px",
        overflow: "hidden",
      }}
    >

      <img
        src={mapSvg}
        alt="Literary world map"
        style={{
          width: "100%",
          height: "100%",
        }}
      />


      <div
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        {Object.keys(literaryCountries).map((country) => (
          <button
            key={country}
            onMouseEnter={() => setHovered(country)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleCountryClick(country)}
            style={{
              position: "relative",
              opacity: 0,
              width: "20px",
              height: "20px",
              cursor: "pointer",
            }}
          >
          </button>
        ))}
      </div>


      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "#FFF8EE",
            padding: "15px",
            borderRadius: "12px",
            color: "#35205F",
          }}
        >
          {literaryCountries[hovered as keyof typeof literaryCountries]?.name}
        </div>
      )}


      {selected && (
        <div
          style={{
            position: "absolute",
            right: 20,
            bottom: 20,
            width: "280px",
            background: "#FFF8EE",
            padding: "20px",
            borderRadius: "15px",
            color: "#35205F",
          }}
        >
          <h2>{selected.name}</h2>

          <p>
            Писателей: <b>{selected.writers}</b>
          </p>

          <h3>Известные авторы</h3>

          {selected.authors.map(author => (
            <p key={author}>📖 {author}</p>
          ))}
        </div>
      )}

    </div>
  );
}
