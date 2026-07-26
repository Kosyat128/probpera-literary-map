import { useMemo } from "react";
import { countries } from "../data/countries";
import { getAllWriters } from "../filters/writerFilters";

export default function WriterClusters() {
  const clusters = useMemo(() => {
    const writers = getAllWriters(countries);

    return countries.map((country) => ({
      id: country.id,
      name: country.name,
      count: writers.filter((writer) => writer.country === country.name).length,
    })).filter((country) => country.count > 0);
  }, []);

  return (
    <>
      {clusters.map((cluster) => (
        <div key={cluster.id}>{cluster.name}: {cluster.count}</div>
      ))}
    </>
  );
}
