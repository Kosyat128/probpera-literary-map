import { useEffect, useState } from "react";
import { literaryCountries } from "../data/literaryMap/countries";
import mapSvg from "../assets/map/world-countries.svg";

type SvgWorldMapProps = {
  onCountrySelect?: (name: string) => void;
};

export default function SvgWorldMap({ onCountrySelect }: SvgWorldMapProps) {

  const [svgContent, setSvgContent] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(mapSvg)
      .then(response => response.text())
      .then(svg => setSvgContent(svg.replace(
        "</svg>",
        `<style>
          .country {fill:#35205F;stroke:#F7EBDD;cursor:pointer;transition:.3s;}
          .country:hover {fill:#E97824;filter:drop-shadow(0 0 8px rgba(233,120,36,.5));}
        </style></svg>`
      )));
  }, []);

  const getCountryId=(event:React.MouseEvent<HTMLDivElement>)=>{
    return (event.target as SVGElement).getAttribute("id");
  };

  const handleSvgClick=(event:React.MouseEvent<HTMLDivElement>)=>{
    const id=getCountryId(event);
    if(!id) return;

    const country=literaryCountries[id as keyof typeof literaryCountries];
    if(!country) return;

    setSelected(id);
    onCountrySelect?.(country.name);
  };

  const countryData = selected
    ? literaryCountries[selected as keyof typeof literaryCountries]
    : null;

  return (
    <div style={{
      position:"relative",
      width:"100%",
      minHeight:"700px",
      background:"#F7EBDD",
      borderRadius:"18px",
      overflow:"hidden"
    }}>

      <div
        onClick={handleSvgClick}
        onMouseMove={(e)=>{
          const id=getCountryId(e);
          setHovered(id && literaryCountries[id as keyof typeof literaryCountries] ? id : null);
        }}
        onMouseLeave={()=>setHovered(null)}
        dangerouslySetInnerHTML={{__html:svgContent}}
        style={{width:"100%",height:"100%"}}
      />

      {hovered && (
        <div style={{
          position:"absolute",
          top:20,
          left:20,
          background:"#FFF8EE",
          padding:"12px 18px",
          borderRadius:"12px",
          color:"#35205F"
        }}>
          {literaryCountries[hovered as keyof typeof literaryCountries]?.name}
        </div>
      )}

      {countryData && (
        <div style={{
          position:"absolute",
          right:20,
          bottom:20,
          width:"280px",
          background:"#FFF8EE",
          padding:"20px",
          borderRadius:"18px",
          color:"#35205F",
          boxShadow:"0 8px 25px rgba(53,32,95,.2)"
        }}>
          <h2>{countryData.name}</h2>

          <p>✒️ Писателей: <b>{countryData.writers}</b></p>
          <p>📚 Статей: <b>{countryData.articles}</b></p>
          <p>📍 Литературных мест: <b>{countryData.places}</b></p>

          <hr />

          <b>Главные авторы:</b>

          {countryData.authors.map(author=>(
            <div key={author}>📖 {author}</div>
          ))}

        </div>
      )}

    </div>
  );
}
