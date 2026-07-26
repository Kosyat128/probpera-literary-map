import { useMemo } from "react";
import { countries } from "../data/countries";
import type { WriterProfile } from "../data/countries/types";

type Props = {
  onCountrySelect?: (name: string) => void;
  selectedCountry?: string;
  writers?: WriterProfile[];
};

export default function WriterClusters({ onCountrySelect, selectedCountry, writers }: Props) {
  const clusters = useMemo(() => {
    const sourceWriters = writers || countries.flatMap((country) => country.writers || []);

    return countries
      .map((country) => ({
        id: country.id,
        name: country.name,
        coordinates: country.coordinates,
        count: sourceWriters.filter((writer) => writer.country === country.name).length,
      }))
      .filter((country) => country.count > 0);
  }, [writers]);

  const getPosition = (coordinates: typeof clusters[number]["coordinates"]) => {
    if (!coordinates) return { left: "50%", top: "50%" };

    if (Array.isArray(coordinates)) {
      return {
        left: `${coordinates[1]}%`,
        top: `${coordinates[0]}%`,
      };
    }

    return {
      left: `${coordinates.lng}%`,
      top: `${coordinates.lat}%`,
    };
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {clusters.map((cluster) => {
        if (selectedCountry && selectedCountry !== cluster.id) return null;

        const size = Math.min(62, Math.max(34, 28 + Math.log(cluster.count + 1) * 9));
        const position = getPosition(cluster.coordinates);

        return (
          <button
            key={cluster.id}
            title={`${cluster.name}: ${cluster.count} писателей`}
            aria-label={`${cluster.name}: ${cluster.count} писателей`}
            onClick={() => onCountrySelect?.(cluster.name)}
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              transform: "translate(-50%, -50%)",
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: "50%",
              border: "3px solid #FFF8EE",
              background: "#E97824",
              color: "#FFF8EE",
              fontWeight: 700,
              cursor: "pointer",
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            {cluster.count}
          </button>
        );
      })}
    </div>
  );
}
