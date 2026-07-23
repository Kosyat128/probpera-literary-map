import { useEffect, useState } from "react";
import { literaryCountries } from "../data/literaryMap/countries";
import mapSvg from "../assets/map/literary-world-map.svg";

type SvgWorldMapProps = {
  onCountrySelect?: (name: string) => void;
  selectedCountry?: string;
};

export default function SvgWorldMap({ onCountrySelect, selectedCountry }: SvgWorldMapProps) {
  const [svgContent, setSvgContent] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch(mapSvg)
      .then((response) => response.text())
      .then((svg) =>
        setSvgContent(
          svg.replace(
            "</svg>",
            `<style>
              .country {fill:#35205F;stroke:#F7EBDD;cursor:pointer;transition:.3s;}
              .country:hover {fill:#E97824;filter:drop-shadow(0 0 8px rgba(233,120,36,.5));}
              .country-active {fill:#E97824 !important;}
            </style></svg>`,
          ),
        ),
      );
  }, []);

  const getCountryId = (event: React.MouseEvent<HTMLDivElement>) => {
    return (event.target as SVGElement).getAttribute("id");
  };

  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const id = getCountryId(event);
    if (!id) return;

    const country = literaryCountries[id as keyof typeof literaryCountries];
    if (!country) return;

    onCountrySelect?.(country.name);
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
        onMouseMove={(e) => {
          const id = getCountryId(e);
          setHovered(id && literaryCountries[id as keyof typeof literaryCountries] ? id : null);
        }}
        onMouseLeave={() => setHovered(null)}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{
          width: "100%",
          height: "100%",
          transform: selectedCountry ? "scale(1.03)" : "scale(1)",
          transition: ".4s",
        }}
      />

      {hovered && literaryCountries[hovered as keyof typeof literaryCountries] ? (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "#FFF8EE",
            padding: "12px 18px",
            borderRadius: "12px",
            color: "#35205F",
            boxShadow: "0 8px 20px rgba(53,32,95,.15)",
            maxWidth: "320px",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {literaryCountries[hovered as keyof typeof literaryCountries].name}
          </div>
          <div style={{ marginBottom: 6 }}>
            {literaryCountries[hovered as keyof typeof literaryCountries].writers} писателей
          </div>
          <div style={{ fontSize: 13, opacity: 0.88 }}>
            {literaryCountries[hovered as keyof typeof literaryCountries].authors.slice(0, 3).join(" • ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
