import { useEffect, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";

type Props = {
  onCountrySelect?: (country: string) => void;
};

export default function LiteraryWorldMap({ onCountrySelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [active, setActive] = useState("");

  useEffect(() => {
    fetch(mapSvg).then((r) => r.text()).then(setSvg);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !svg) return;

    const root = mapRef.current.querySelector("svg");

    if (root) {
      root.removeAttribute("width");
      root.removeAttribute("height");
      root.setAttribute("preserveAspectRatio", "xMidYMid meet");
      root.style.width = "100%";
      root.style.height = "100%";
      root.style.display = "block";
    }

    mapRef.current.querySelectorAll("path").forEach((element) => {
      const path = element as SVGPathElement;

      path.style.fill = "transparent";
      path.style.stroke = "rgba(53,32,95,0.28)";
      path.style.strokeWidth = "0.6px";
      path.style.pointerEvents = "all";
      path.style.cursor = "pointer";

      path.onmouseenter = () => {
        path.style.fill = "rgba(233,120,36,0.45)";
        setActive(path.id || "path");
      };

      path.onmouseleave = () => {
        path.style.fill = "transparent";
        setActive("");
      };

      path.onclick = () => {
        if (path.id) onCountrySelect?.(path.id);
      };
    });
  }, [svg, onCountrySelect]);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "700px",
      overflow: "hidden",
      borderRadius: "18px"
    }}>
      <img
        src={background}
        alt="literary map"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          zIndex: 1
        }}
      />

      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none"
      }}>
        <div
          ref={mapRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            transform: "translate(0px, 8px) scale(1.04)",
            transformOrigin: "center center"
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {active && <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
        background: "#FFF8EE",
        color: "#35205F",
        padding: "12px 18px",
        borderRadius: "10px",
        fontFamily: "Georgia, serif"
      }}>
        SVG:<br/><b>{active}</b>
      </div>}
    </div>
  );
}
