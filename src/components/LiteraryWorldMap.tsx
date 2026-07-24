import { useEffect, useMemo, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";
import { writers, type Writer } from "../data/writers";

type Props = {
  onCountrySelect?: (country: string) => void;
};

export default function LiteraryWorldMap({ onCountrySelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [activeCountry, setActiveCountry] = useState("");
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);

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
      path.style.stroke = "rgba(53,32,95,0.06)";
      path.style.strokeWidth = "0.25px";
      path.style.pointerEvents = "all";
      path.style.cursor = "pointer";
      path.style.transition = "fill 0.2s ease";

      path.onmouseenter = () => {
        path.style.fill = "rgba(233,120,36,0.14)";
        setActiveCountry(path.id || "");
      };

      path.onmouseleave = () => {
        path.style.fill = "transparent";
        setActiveCountry("");
      };

      path.onclick = () => {
        if (path.id) {
          setSelectedWriter(null);
          onCountrySelect?.(path.id);
        }
      };
    });
  }, [svg, onCountrySelect]);

  const markers = useMemo(() => writers, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "700px",
        overflow: "hidden",
        borderRadius: "18px"
      }}
    >
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

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none"
        }}
      >
        <div
          ref={mapRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            transform: "translate(-6px, 4px) scale(1.005)",
            transformOrigin: "center center"
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 6,
          pointerEvents: "none"
        }}
      >
        {markers.map((writer) => (
          <button
            key={writer.id}
            type="button"
            onClick={() => setSelectedWriter(writer)}
            style={{
              position: "absolute",
              left: `${writer.x}%`,
              top: `${writer.y}%`,
              transform: "translate(-50%, -50%)",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              border: "2px solid #FFF8EE",
              background: "#E97824",
              boxShadow: "0 0 0 6px rgba(233, 120, 36, 0.18)",
              cursor: "pointer",
              pointerEvents: "auto"
            }}
            aria-label={writer.name}
            title={writer.name}
          />
        ))}
      </div>

      {(selectedWriter || activeCountry) && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            zIndex: 10,
            background: "#FFF8EE",
            color: "#35205F",
            padding: "14px 18px",
            borderRadius: "12px",
            maxWidth: "320px",
            boxShadow: "0 10px 30px rgba(53, 32, 95, 0.18)",
            fontFamily: "Georgia, serif"
          }}
        >
          {selectedWriter ? (
            <>
              <div style={{ fontSize: "14px", opacity: 0.7, marginBottom: "6px" }}>
                Писатель
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                {selectedWriter.name}
              </div>
              <div style={{ fontSize: "14px", lineHeight: 1.5, marginBottom: "8px" }}>
                {selectedWriter.country} · {selectedWriter.city}
              </div>
              <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "8px" }}>
                {selectedWriter.years}
              </div>
              <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                {selectedWriter.books.join(" · ")}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "14px", opacity: 0.7, marginBottom: "6px" }}>
                Страна
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {activeCountry}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
