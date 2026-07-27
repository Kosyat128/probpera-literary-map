import {
  useDisplayMode,
  type DisplayMode,
} from "../hooks/useDisplayMode";

type Props = {
  compact?: boolean;
};

const modes: Array<{
  id: DisplayMode;
  label: string;
  shortLabel: string;
  symbol: string;
}> = [
  { id: "dark", label: "Тёмный режим", shortLabel: "Ночь", symbol: "☾" },
  { id: "light", label: "Светлый режим", shortLabel: "Свет", symbol: "☼" },
  { id: "book", label: "Режим печатной книги", shortLabel: "Книга", symbol: "▤" },
];

export default function DisplayModeControl({ compact = false }: Props) {
  const { mode, setMode } = useDisplayMode();

  return (
    <div
      className={`display-mode-control${compact ? " is-compact" : ""}`}
      role="group"
      aria-label="Режим оформления"
    >
      {modes.map((item) => (
        <button
          type="button"
          key={item.id}
          className={mode === item.id ? "is-active" : ""}
          aria-pressed={mode === item.id}
          aria-label={item.label}
          title={item.label}
          onClick={() => setMode(item.id)}
        >
          <span aria-hidden="true">{item.symbol}</span>
          {!compact && <small>{item.shortLabel}</small>}
        </button>
      ))}
    </div>
  );
}
