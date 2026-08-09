import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { literaryCountries } from "../data/literaryMap/countries";
import mapSvg from "../assets/map/literary-world-map.svg";
import mapBackground from "../assets/map/literary-map-background.png";

type SvgWorldMapProps = {
  onCountrySelect?: (name: string) => void;
  selectedCountry?: string;
};

export default function SvgWorldMap({ onCountrySelect }: SvgWorldMapProps) {
  const [svgContent, setSvgContent] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch(mapSvg)
      .then((response) => response.text())
      .then((svg) => {
        const fixedSvg = svg
          .replace(/<svg([^>]*)>/, '<svg$1 preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;">')
          .replace(/fill="#ececec"/g, 'fill="transparent"')
          .replace(/fill="#ffffff"/g, 'fill="transparent"');
        setSvgContent(fixedSvg);
      });
  }, []);

  const getCountryId = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as SVGElement;
    return target.getAttribute("id") || target.getAttribute("name");
  };

  const selectCountry = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = getCountryId(event);
    const country = id ? literaryCountries[id as keyof typeof literaryCountries] : null;
    if (country) onCountrySelect?.(country.name);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <img
        src={mapBackground}
        alt="Literary Planet"
        loading="lazy"
        decoding="async"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
      />

      <div
        onClick={selectCountry}
        onMouseMove={(event) => {
          const id = getCountryId(event);
          setHovered(id && literaryCountries[id as keyof typeof literaryCountries] ? id : null);
        }}
        onMouseLeave={() => setHovered(null)}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          width: "100%",
          height: "100%"
        }}
      />

      {hovered && literaryCountries[hovered as keyof typeof literaryCountries] && (
        <div
          style={{
            position: "absolute",
            zIndex: 2,
            top: 20,
            left: 20,
            background: "#FFF8EE",
            padding: "12px 18px",
            borderRadius: "12px",
            color: "#35205F"
          }}
        >
          <b>{literaryCountries[hovered as keyof typeof literaryCountries].name}</b>
        </div>
      )}
    </div>
  );
}
