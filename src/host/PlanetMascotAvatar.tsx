import "./PlanetMascotAvatar.css";

export type PlanetMascotMood = "idle" | "guiding" | "celebrate";

/** Decorative Mr. Booky artwork. The parent supplies the final local asset and
 * owns accessible controls, visibility and lifecycle; the globe is untouched. */
export default function PlanetMascotAvatar({ src, mood = "idle" }: {
  src: string;
  mood?: PlanetMascotMood;
}) {
  return <span className="planet-mascot-avatar" data-planet-mascot-avatar={mood} aria-hidden="true">
    <img className="planet-mascot-avatar__image" src={src} alt="" draggable={false}
      decoding="async" width="140" height="140" />
  </span>;
}
