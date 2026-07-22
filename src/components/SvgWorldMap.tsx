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
      .then(svg => {
        const styledSvg = svg.replace(
          "</svg>",
          `<style>
            .country {
              fill:#35205F;
              stroke:#F7EBDD;
              stroke-width:1;
              cursor:pointer;
              transition:all .3s ease;
            }
            .country:hover {
              fill:#E97824;
              filter:drop-shadow(0 0 8px rgba(233,120,36,.6));
            }
            .country-muted {
              opacity:.45;
            }
            .country-active {
              fill:#E97824 !important;
              opacity:1 !important;
            }
          </style></svg>`
        );
        setSvgContent(styledSvg);
      });
  }, []);

  const getCountryId = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as SVGElement;
    return target.getAttribute("id");
  };

  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const id = getCountryId(event);
    if (!id) return;

    const country = literaryCountries[id as keyof typeof literaryCountries];
    if (!country) return;

    setSelected(id);
    onCountrySelect?.(country.name);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const id = getCountryId(event);

    if (id && literaryCountries[id as keyof typeof literaryCountries]) {
      setHovered(id);
    } else {
      setHovered(null);
    }
  };

  return (
    <div
      style={{
        position:"relative",
        width:"100%",
        minHeight:"700px",
        background:"#F7EBDD",
        borderRadius:"18px",
        overflow:"hidden",
        transition:".4s"
      }}
    >
      <div
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        dangerouslySetInnerHTML={{__html: svgContent}}
        style={{
          width:"100%",
          height:"100%",
          transform:selected ? "scale(1.04)" : "scale(1)",
          transformOrigin:"center",
          transition:".4s"
        }}
      />

      {hovered && (
        <div
          style={{
            position:"absolute",
            top:20,
            left:20,
            background:"#FFF8EE",
            padding:"12px 18px",
            borderRadius:"12px",
            color:"#35205F",
            boxShadow:"0 5px 20px rgba(0,0,0,.15)"
          }}
        >
          {literaryCountries[hovered as keyof typeof literaryCountries]?.name}
        </div>
      )}
    </div>
  );
}
