import {
  useDisplayMode,
  type DisplayMode,
} from "../hooks/useDisplayMode";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

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
  const { t } = useInterfaceLanguage();

  return (
    <div
      className={`display-mode-control${compact ? " is-compact" : ""}`}
      role="group"
      aria-label={t("Режим оформления")}
    >
      {modes.map((item) => (
        <button
          type="button"
          key={item.id}
          className={mode === item.id ? "is-active" : ""}
          aria-pressed={mode === item.id}
          aria-label={t(item.label)}
          title={t(item.label)}
          onClick={() => setMode(item.id)}
        >
          <span aria-hidden="true">{item.symbol}</span>
          {!compact && <small>{t(item.shortLabel)}</small>}
        </button>
      ))}
    </div>
  );
}
