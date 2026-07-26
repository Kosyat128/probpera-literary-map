import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { literaryCountries } from "../data/literaryMap/countries";
import mapSvg from "../assets/map/literary-world-map.svg";
import mapBackground from "../assets/map/literary-map-background.png";

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
      .then((svg) => {
        const fixedSvg = svg
          .replace(/fill="#ececec"/g, 'fill="transparent"')
          .replace(/fill="black"/g, 'fill="transparent"');
        setSvgContent(fixedSvg);
      });
  }, []);

  const getCountryId = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as SVGElement;
    return target.getAttribute("id") || target.getAttribute("name");
  };

  const handleSvgClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = getCountryId(event);
    if (!id) return;

    const country = literaryCountries[id as keyof typeof literaryCountries];
    if (country) onCountrySelect?.(country.name);
  };

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "700px", borderRadius: "18px", overflow: "hidden" }}>
      <img
        src={mapBackground}
        alt="Literary world map background"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
      />

      <div
        onClick={handleSvgClick}
        onMouseMove={(e) => {
          const id = getCountryId(e);
          setHovered(id && literaryCountries[id as keyof typeof literaryCountries] ? id : null);
        }}
        onMouseLeave={() => setHovered(null)}
        dangerouslySetInnerHTML={{
          __html: svgContent.replace(
            /<path/g,
            '<path style="fill:transparent;cursor:pointer;transition:0.3s"'
          )
        }}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          transform: selectedCountry ? "scale(1.03)" : "scale(1)",
          transition: ".4s"
        }}
      />

      {hovered && literaryCountries[hovered as keyof typeof literaryCountries] && (
        <div style={{ position: "absolute", zIndex: 2, top: 20, left: 20, background: "#FFF8EE", padding: "12px 18px", borderRadius: "12px", color: "#35205F" }}>
          <b>{literaryCountries[hovered as keyof typeof literaryCountries].name}</b>
          <br />
          Писателей: {literaryCountries[hovered as keyof typeof literaryCountries].writers?.length || 0}
        </div>
      )}
    </div>
  );
}
