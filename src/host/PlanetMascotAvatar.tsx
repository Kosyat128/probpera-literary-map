import { useRef } from "react";
import { useBookyRenderer } from "./useBookyRenderer";
import type { BookyInteraction, BookyLook, BookyMood } from "./bookyAnimation";
import "./PlanetMascotAvatar.css";

export type PlanetMascotMood = BookyMood;

/** Accessible controls belong to the parent. This decorative viewport never
 * reads or changes the canonical globe's scene or camera. */
export default function PlanetMascotAvatar({ src, mood = "idle", lookAt = { x: 0, y: 0 },
  interaction = "rest", reactionKey = 0, active = true, calmMotion = false }: {
  src: string;
  mood?: PlanetMascotMood;
  lookAt?: BookyLook;
  interaction?: BookyInteraction;
  reactionKey?: number;
  active?: boolean;
  calmMotion?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useBookyRenderer(canvas, { mood, lookAt, interaction, reactionKey, active, calmMotion });
  return <span className="planet-mascot-avatar" data-planet-mascot-avatar={mood}
    data-renderer-state={renderer.state} data-renderer-active={renderer.active}
    data-booky-interaction={interaction} aria-hidden="true">
    <canvas ref={canvas} className="planet-mascot-avatar__canvas" data-booky-canvas="" aria-hidden="true" />
    {renderer.state !== "live3d" && <img className="planet-mascot-avatar__image" src={src} alt="" draggable={false}
      decoding="async" width="140" height="140" />}
  </span>;
}
