import {
  bookShelfProgressValueToFocusIndex,
  getBookShelfProgressState,
} from "../books/bookShelfNavigation";

type Props = Readonly<{
  focusIndex: number;
  total: number;
  label: string;
  onFocusIndexChange: (focusIndex: number) => void;
  valueText?: (current: number, total: number) => string;
  className?: string;
}>;

/** Native range semantics keep the rail keyboard- and pointer-operable. */
export default function BookShelfProgressRail({
  focusIndex,
  total,
  label,
  onFocusIndexChange,
  valueText = (current, count) => `${current} / ${count}`,
  className = "",
}: Props) {
  const progress = getBookShelfProgressState(focusIndex, total);
  const rootClassName = ["book-shelf-progress-rail", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClassName}
      data-book-shelf-progress-rail=""
      data-disabled={progress.disabled ? "true" : "false"}
    >
      <input
        className="book-shelf-progress-rail__range"
        type="range"
        min={progress.minimum}
        max={progress.maximum}
        step={1}
        value={progress.value}
        disabled={progress.disabled}
        aria-label={label}
        aria-valuetext={valueText(progress.current, progress.total)}
        onChange={(event) => {
          const nextIndex = bookShelfProgressValueToFocusIndex(
            Number(event.currentTarget.value),
            progress.total
          );
          if (nextIndex >= 0 && nextIndex !== progress.focusIndex) {
            onFocusIndexChange(nextIndex);
          }
        }}
      />
      <output className="book-shelf-progress-rail__value" aria-hidden="true">
        <strong>{progress.current}</strong>
        <span> / {progress.total}</span>
      </output>
    </div>
  );
}
