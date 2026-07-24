type Props = {
  onChange: (filter: string) => void;
};

export default function WriterFilterPanel({ onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        padding: "12px",
        background: "#FFF8EE",
        borderRadius: "14px",
        fontFamily: "Georgia, serif",
      }}
    >
      <button onClick={() => onChange("all")}>Все авторы</button>
      <button onClick={() => onChange("nobel")}>Нобелевские</button>
      <button onClick={() => onChange("europe")}>Европа</button>
      <button onClick={() => onChange("asia")}>Азия</button>
      <button onClick={() => onChange("america")}>Америка</button>
    </div>
  );
}
