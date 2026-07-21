import type { CountryData } from "../data/countries";

type WriterPanelProps = {
  country: CountryData;
};

export default function WriterPanel({ country }: WriterPanelProps) {
  return (
    <aside
      style={{
        width: "340px",
        padding: "20px",
        borderLeft: "1px solid #3b2a6b",
        overflowY: "auto",
      }}
    >
      <h2>{country.name}</h2>

      <h3>Писатели</h3>

      <ul>
        {country.writers.map((writer) => (
          <li key={writer.name}>
            <strong>{writer.name}</strong>
            <br />
            <small>{writer.years}</small>
          </li>
        ))}
      </ul>
    </aside>
  );
}
