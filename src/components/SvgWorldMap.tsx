import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
      .then((svg) => setSvgContent(svg));
  }, []);

  const getCountryId = (event: ReactMouseEvent<HTMLDivElement>) => {
    return (event.target as SVGElement).getAttribute("id");
  };

  const handleSvgClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = getCountryId(event);
    if (!id) return;

    const country = literaryCountries[id as keyof typeof literaryCountries];
    if (country) onCountrySelect?.(country.name);
  };

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "700px", background: "#F7EBDD", borderRadius: "18px", overflow: "hidden" }}>
      <div
        onClick={handleSvgClick}
        onMouseMove={(e) => {
          const id = getCountryId(e);
          setHovered(id && literaryCountries[id as keyof typeof literaryCountries] ? id : null);
        }}
        onMouseLeave={() => setHovered(null)}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{ width: "100%", height: "100%", transform: selectedCountry ? "scale(1.03)" : "scale(1)", transition: ".4s" }}
      />
      {hovered && literaryCountries[hovered as keyof typeof literaryCountries] && (
        <div style={{ position: "absolute", top: 20, left: 20, background: "#FFF8EE", padding: "12px 18px", borderRadius: "12px", color: "#35205F" }}>
          <b>{literaryCountries[hovered as keyof typeof literaryCountries].name}</b>
        </div>
      )}
    </div>
  );
}
