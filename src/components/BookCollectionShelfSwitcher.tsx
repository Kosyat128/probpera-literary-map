import type { ChangeEvent } from "react";

import type {
  BookCollectionShelfOption,
  BookCollectionShelfSelection,
  BookCollectionShelfStatus,
} from "../books/bookCollectionShelfSelector";

const EMPTY_GROUP_VALUE_PREFIX = "__empty-book-shelf-group__:";

export type BookCollectionShelfSwitcherLabels = Readonly<{
  control: string;
  emptyGroup: string;
  ready: (count: number) => string;
  unresolved: string;
  empty: string;
  missing: (count: number) => string;
  partial: (available: number, missing: number) => string;
}>;

type Props = Readonly<{
  selection: BookCollectionShelfSelection;
  onChange: (shelfId: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  labels?: Partial<BookCollectionShelfSwitcherLabels>;
}>;

const formatNumber = new Intl.NumberFormat("ru-RU").format;

const bookCount = (count: number) => {
  const absolute = Math.abs(count) % 100;
  const lastDigit = absolute % 10;
  const noun =
    absolute > 10 && absolute < 20
      ? "книг"
      : lastDigit === 1
        ? "книга"
        : lastDigit >= 2 && lastDigit <= 4
          ? "книги"
          : "книг";
  return `${formatNumber(count)} ${noun}`;
};

const defaultLabels: BookCollectionShelfSwitcherLabels = Object.freeze({
  control: "Выбрать полку",
  emptyGroup: "Пока нет полок",
  ready: bookCount,
  unresolved: "Подборка обновляется",
  empty: "Пока пусто",
  missing: (count) => `${formatNumber(count)} недоступно`,
  partial: (available, missing) =>
    `${bookCount(available)}, ${formatNumber(missing)} недоступно`,
});

export function describeBookCollectionShelfOption(
  option: BookCollectionShelfOption,
  labels: BookCollectionShelfSwitcherLabels = defaultLabels
) {
  const statusDescription: Readonly<
    Record<BookCollectionShelfStatus, () => string>
  > = {
    ready: () => labels.ready(option.count),
    empty: () => labels.empty,
    partial: () => labels.partial(option.count, option.missingCount),
    missing: () => labels.missing(option.missingCount),
    unresolved: () => labels.unresolved,
  };
  return statusDescription[option.status]();
}

export function formatBookCollectionShelfOptionLabel(
  option: BookCollectionShelfOption,
  labels: BookCollectionShelfSwitcherLabels = defaultLabels
) {
  return `${option.title} — ${describeBookCollectionShelfOption(option, labels)}`;
}

export default function BookCollectionShelfSwitcher({
  selection,
  onChange,
  disabled = false,
  className = "",
  id = "book-collection-shelf",
  labels: labelOverrides,
}: Props) {
  const labels = Object.freeze({ ...defaultLabels, ...labelOverrides });
  const statusId = `${id}-status`;
  const rootClassName = ["book-collection-switcher", className]
    .filter(Boolean)
    .join(" ");

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const shelfId = event.currentTarget.value;
    if (!shelfId.startsWith(EMPTY_GROUP_VALUE_PREFIX)) onChange(shelfId);
  };

  return (
    <label className={rootClassName} htmlFor={id}>
      <span className="book-collection-switcher__label">{labels.control}</span>
      <span className="book-collection-switcher__field">
        <select
          id={id}
          value={selection.activeShelfId}
          onChange={handleChange}
          disabled={disabled}
          aria-describedby={statusId}
        >
          {selection.groups.map((group) => (
            <optgroup key={group.id} label={group.title}>
              {group.options.length > 0 ? (
                group.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {formatBookCollectionShelfOptionLabel(option, labels)}
                  </option>
                ))
              ) : (
                <option
                  value={`${EMPTY_GROUP_VALUE_PREFIX}${group.id}`}
                  disabled
                >
                  {labels.emptyGroup}
                </option>
              )}
            </optgroup>
          ))}
        </select>
        <span className="book-collection-switcher__chevron" aria-hidden="true">
          ⌄
        </span>
      </span>
      <span
        className={`book-collection-switcher__status is-${selection.activeOption.status}`}
        id={statusId}
        aria-live="polite"
      >
        <strong>{selection.activeOption.title}</strong>
        <span>
          {describeBookCollectionShelfOption(selection.activeOption, labels)}
        </span>
        {selection.activeOption.description ? (
          <small>{selection.activeOption.description}</small>
        ) : null}
      </span>
    </label>
  );
}
