import { useMemo } from "react";
import { countries } from "../data/countries";
import { getAllWriters } from "../filters/writerFilters";

type Props = {
  onCountrySelect?: (name: string) => void;
  selectedCountry?: string;
};

export default function WriterClusters({ onCountrySelect, selectedCountry }: Props) {
  const clusters = useMemo(() => {
    const writers = getAllWriters(countries);

    return countries
      .map((country) => ({
        id: country.id,
        name: country.name,
        coordinates: country.coordinates,
        count: writers.filter((writer) => writer.country === country.name).length,
      }))
      .filter((country) => country.count > 0);
  }, []);

  const getPosition = (coordinates: typeof clusters[number]["coordinates"]) => {
    if (!coordinates) return { left: "50%", top: "50%" };
    if (Array.isArray(coordinates)) {
      return { left: `${coordinates[1]}%`, top: `${coordinates[0]}%` };
    }
    return { left: `${coordinates.lng}%`, top: `${coordinates.lat}%` };
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {clusters.map((cluster) => {
        if (selectedCountry && selectedCountry !== cluster.id) return null;

        const size = Math.min(56, 24 + cluster.count * 2);

        return (
          <button
            key={cluster.id}
            title={`${cluster.name}: ${cluster.count} писателей`}
            onClick={() => onCountrySelect?.(cluster.name)}
            style={{
              position: "absolute",
              ...getPosition(cluster.coordinates),
              width: `${size}px`,
              height: `${size}px`,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: "3px solid #FFF8EE",
              background: "#E97824",
              color: "#FFF8EE",
              fontWeight: "bold",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          >
            {cluster.count}
          </button>
        );
      })}
    </div>
  );
}
