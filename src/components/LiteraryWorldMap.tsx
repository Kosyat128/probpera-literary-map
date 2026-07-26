import { useEffect, useMemo, useRef, useState } from "react";

import background from "../assets/map/literary-map-background.png";
import mapSvg from "../assets/map/literary-world-map.svg";
import { countries } from "../data/countries";
import type { WriterProfile } from "../data/countries/types";

type Props = {
  onCountrySelect?: (country: string) => void;
};

const MIN_SCALE = 0.8;
const MAX_SCALE = 2.2;
const SCALE_STEP = 0.08;

export default function LiteraryWorldMap({ onCountrySelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

  const [svg, setSvg] = useState("");
  const [activeCountry, setActiveCountry] = useState("");
  const [selectedWriter, setSelectedWriter] = useState<WriterProfile | null>(null);
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
    }

    mapRef.current.querySelectorAll("path").forEach((element) => {
      const path = element as SVGPathElement;
      path.style.fill = "transparent";
      path.style.cursor = "pointer";

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

  const markers = useMemo(
    () => countries.flatMap((country) => country.writers.map((writer) => writer)),
    []
  );

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  return (
    <div
      style={{ position: "relative", width: "100%", height: "700px", overflow: "hidden" }}
      onWheel={(event) => {
        event.preventDefault();
        setScale((current) => clampScale(current + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)));
      }}
    >
      <img src={background} alt="literary map" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      <div
        ref={mapRef}
        onPointerDown={(event) => {
          dragState.current.active = true;
          dragState.current.startX = event.clientX;
          dragState.current.startY = event.clientY;
          dragState.current.baseX = offset.x;
          dragState.current.baseY = offset.y;
        }}
        onPointerMove={(event) => {
          if (!dragState.current.active) return;
          setOffset({
            x: dragState.current.baseX + event.clientX - dragState.current.startX,
            y: dragState.current.baseY + event.clientY - dragState.current.startY,
          });
        }}
        onPointerUp={() => (dragState.current.active = false)}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {markers.map((writer) => (
        <button key={writer.id} type="button" onClick={() => setSelectedWriter(writer)}>
          {writer.fullName || writer.name}
        </button>
      ))}

      {selectedWriter && (
        <div>
          <strong>{selectedWriter.fullName || selectedWriter.name}</strong>
          <p>{selectedWriter.country}</p>
          <p>{selectedWriter.works?.join(" · ")}</p>
        </div>
      )}

      {activeCountry && <div>{activeCountry}</div>}
    </div>
  );
}
