import { useEffect, useMemo, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";
import { writers, type Writer } from "../data/writers";

type Props = {
  onCountrySelect?: (country: string) => void;
};

const MIN_SCALE = 0.8;
const MAX_SCALE = 2.2;
const SCALE_STEP = 0.08;

export default function LiteraryWorldMap({ onCountrySelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const [svg, setSvg] = useState("");
  const [activeCountry, setActiveCountry] = useState("");
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

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

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  const markers = useMemo(() => writers, []);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setScale((current) => clampScale(current + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragState.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setOffset({ x: dragState.current.baseX + dx, y: dragState.current.baseY + dy });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragState.current.active = false;
    try {
      (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "700px",
        overflow: "hidden",
        borderRadius: "18px",
        touchAction: "none",
      }}
      onWheel={handleWheel}
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
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <div
          ref={mapRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            cursor: dragState.current.active ? "grabbing" : "grab",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragState.current.active ? "none" : "transform 120ms ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 6,
          pointerEvents: "none",
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
              background: selectedWriter?.id === writer.id ? "#35205F" : "#E97824",
              boxShadow: "0 0 0 6px rgba(233, 120, 36, 0.18)",
              cursor: "pointer",
              pointerEvents: "auto",
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
            fontFamily: "Georgia, serif",
          }}
        >
          {selectedWriter ? (
            <>
              <div style={{ fontSize: "14px", opacity: 0.7, marginBottom: "6px" }}>Писатель</div>
              <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>{selectedWriter.name}</div>
              <div style={{ fontSize: "14px", lineHeight: 1.5, marginBottom: "8px" }}>
                {selectedWriter.country} · {selectedWriter.city}
              </div>
              <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "8px" }}>{selectedWriter.years}</div>
              <div style={{ fontSize: "13px", lineHeight: 1.5 }}>{selectedWriter.books.join(" · ")}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "14px", opacity: 0.7, marginBottom: "6px" }}>Страна</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{activeCountry}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
