import { useEffect, useState } from "react";
import { literaryCountries } from "../data/literaryMap/countries";
import mapSvg from "../assets/map/world-countries.svg";


type SelectedCountry = {
  id: string;
  name: string;
  writers: number;
  authors: string[];
};


export default function SvgWorldMap() {

  const [svgContent, setSvgContent] = useState("");
  const [selected, setSelected] = useState<SelectedCountry | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);


  useEffect(() => {
    fetch(mapSvg)
      .then(response => response.text())
      .then(svg => setSvgContent(svg));
  }, []);


  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {

    const target = event.target as SVGElement;

    const id = target.getAttribute("id");

    if (!id) return;

    const country = literaryCountries[id as keyof typeof literaryCountries];

    if (!country) return;

    setSelected({
      id,
      name: country.name,
      writers: country.writers,
      authors: country.authors,
    });
  };


  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as SVGElement;
    const id = target.getAttribute("id");

    if (id && literaryCountries[id as keyof typeof literaryCountries]) {
      setHovered(id);
    } else {
      setHovered(null);
    }
  };


  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "700px",
        background: "#F7EBDD",
        borderRadius: "18px",
        overflow: "hidden",
      }}
    >

      <div
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{
          width: "100%",
          height: "100%",
        }}
      />


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
          <p>Писателей: <b>{selected.writers}</b></p>
          <h3>Известные авторы</h3>
          {selected.authors.map(author => (
            <p key={author}>📖 {author}</p>
          ))}
        </div>
      )}

    </div>
  );
}
