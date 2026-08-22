import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";

export type AtlasComboboxItem = {
  key: string;
  label: string;
};

export type AtlasComboboxOpenReason =
  | "blur"
  | "escape"
  | "focus"
  | "input"
  | "pointer"
  | "selection";

export type AtlasComboboxSelectionMeta =
  | { source: "keyboard" }
  | { pointerType: string; source: "pointer" };

export type AtlasComboboxRenderState = {
  active: boolean;
  selected: boolean;
};

type AtlasComboboxNavigationKey =
  | "ArrowDown"
  | "ArrowUp"
  | "End"
  | "Home";

export type AtlasSearchComboboxProps<T extends AtlasComboboxItem> = {
  autoFocus?: boolean;
  caption?: ReactNode;
  className?: string;
  disabled?: boolean;
  emptyContent?: ReactNode;
  endAdornment?: ReactNode;
  id?: string;
  inputAriaLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: ReactNode;
  listboxClassName?: string;
  loading?: boolean;
  loadingContent?: ReactNode;
  onEscapeWhenClosed?: () => void;
  onOpenChange: (open: boolean, reason: AtlasComboboxOpenReason) => void;
  onSelect: (result: T, meta: AtlasComboboxSelectionMeta) => void;
  onValueChange: (value: string) => void;
  open: boolean;
  placeholder?: string;
  renderOption: (result: T, state: AtlasComboboxRenderState) => ReactNode;
  results: readonly T[];
  resultsId?: string;
  selectedKey?: string | null;
  startAdornment?: ReactNode;
  value: string;
};

export function atlasComboboxOptionId(inputId: string, resultKey: string) {
  return `${inputId}-listbox-option-${encodeURIComponent(resultKey)}`;
}

export function atlasComboboxNavigationIndex(
  currentIndex: number,
  itemCount: number,
  key: AtlasComboboxNavigationKey
) {
  if (itemCount <= 0) return -1;

  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowDown") {
    return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
  }

  return currentIndex < 0
    ? itemCount - 1
    : (currentIndex - 1 + itemCount) % itemCount;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) (ref as MutableRefObject<T | null>).current = value;
}

function initialActiveIndex<T extends AtlasComboboxItem>(
  open: boolean,
  results: readonly T[],
  selectedKey: string | null | undefined
) {
  if (!open || results.length === 0) return -1;
  const selectedIndex = selectedKey
    ? results.findIndex((result) => result.key === selectedKey)
    : -1;
  return selectedIndex >= 0 ? selectedIndex : 0;
}

export default function AtlasSearchCombobox<T extends AtlasComboboxItem>({
  autoFocus = false,
  caption,
  className = "",
  disabled = false,
  emptyContent,
  endAdornment,
  id,
  inputAriaLabel,
  inputRef,
  label,
  listboxClassName = "search-results",
  loading = false,
  loadingContent,
  onEscapeWhenClosed,
  onOpenChange,
  onSelect,
  onValueChange,
  open,
  placeholder,
  renderOption,
  results,
  resultsId,
  selectedKey,
  startAdornment,
  value,
}: AtlasSearchComboboxProps<T>) {
  const generatedId = useId();
  const inputId = id || `atlas-search-${generatedId.replace(/:/g, "")}`;
  const labelId = `${inputId}-label`;
  const listboxId = resultsId || `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeKeyRef = useRef<string | null>(null);
  const pointerTypeRef = useRef("mouse");
  const [activeIndex, setActiveIndex] = useState(() =>
    initialActiveIndex(open, results, selectedKey)
  );

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      internalInputRef.current = node;
      assignRef(inputRef, node);
    },
    [inputRef]
  );

  const activate = useCallback(
    (index: number) => {
      const nextIndex =
        index >= 0 && index < results.length ? index : -1;
      activeKeyRef.current =
        nextIndex >= 0 ? results[nextIndex]?.key ?? null : null;
      setActiveIndex(nextIndex);
    },
    [results]
  );

  useEffect(() => {
    if (!open || results.length === 0) {
      activeKeyRef.current = null;
      setActiveIndex(-1);
      return;
    }

    const preservedIndex = activeKeyRef.current
      ? results.findIndex((result) => result.key === activeKeyRef.current)
      : -1;
    const selectedIndex = selectedKey
      ? results.findIndex((result) => result.key === selectedKey)
      : -1;
    const nextIndex =
      preservedIndex >= 0 ? preservedIndex : selectedIndex >= 0 ? selectedIndex : 0;

    activeKeyRef.current = results[nextIndex]?.key ?? null;
    setActiveIndex(nextIndex);
  }, [open, results, selectedKey]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const activeResult = results[activeIndex];
    if (!activeResult) return;
    optionRefs.current
      .get(activeResult.key)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, results]);

  const requestOpen = useCallback(
    (nextOpen: boolean, reason: AtlasComboboxOpenReason) => {
      if (!disabled) onOpenChange(nextOpen, reason);
    },
    [disabled, onOpenChange]
  );

  const selectResult = useCallback(
    (result: T, meta: AtlasComboboxSelectionMeta) => {
      onSelect(result, meta);
      requestOpen(false, "selection");
    },
    [onSelect, requestOpen]
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(event.target.value);
    activeKeyRef.current = null;
    requestOpen(true, "input");
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget && rootRef.current?.contains(nextTarget)) return;
    requestOpen(false, "blur");
  };

  const moveActive = (key: AtlasComboboxNavigationKey) => {
    const nextIndex = atlasComboboxNavigationIndex(
      activeIndex,
      results.length,
      key
    );
    activate(nextIndex);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        requestOpen(false, "escape");
      } else if (onEscapeWhenClosed) {
        event.preventDefault();
        event.stopPropagation();
        onEscapeWhenClosed();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) requestOpen(true, "input");
      moveActive(event.key);
      return;
    }

    if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      moveActive(event.key);
      return;
    }

    if (open && event.key === "Enter") {
      const result = results[activeIndex >= 0 ? activeIndex : 0];
      if (!result) return;
      event.preventDefault();
      selectResult(result, { source: "keyboard" });
    }
  };

  const activeResult = activeIndex >= 0 ? results[activeIndex] : undefined;
  const activeDescendant =
    open && activeResult
      ? atlasComboboxOptionId(inputId, activeResult.key)
      : undefined;

  return (
    <div
      ref={rootRef}
      className={`country-search${open ? " is-open" : ""}${
        className ? ` ${className}` : ""
      }`}
      data-atlas-search-combobox=""
      data-disabled={disabled || undefined}
      data-open={open ? "true" : "false"}
      onBlurCapture={handleBlur}
    >
      <label id={labelId} htmlFor={inputId}>
        {label}
      </label>
      <div className="search-field">
        {startAdornment}
        <input
          ref={setInputRef}
          id={inputId}
          role="combobox"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={inputAriaLabel}
          aria-labelledby={inputAriaLabel ? undefined : labelId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          data-atlas-search-input=""
          onClick={() => requestOpen(true, "pointer")}
          onChange={handleChange}
          onFocus={() => requestOpen(true, "focus")}
          onKeyDown={handleKeyDown}
        />
        {endAdornment}
      </div>

      {open && (
        <div
          id={listboxId}
          className={listboxClassName}
          role="listbox"
          aria-labelledby={labelId}
          aria-busy={loading || undefined}
          data-atlas-search-listbox=""
        >
          {caption && (
            <span className="search-caption" role="presentation">
              {caption}
            </span>
          )}
          {loading ? (
            <p role="status">{loadingContent}</p>
          ) : results.length > 0 ? (
            results.map((result, index) => {
              const active = index === activeIndex;
              const selected = result.key === selectedKey;
              return (
                <button
                  ref={(node) => {
                    if (node) optionRefs.current.set(result.key, node);
                    else optionRefs.current.delete(result.key);
                  }}
                  id={atlasComboboxOptionId(inputId, result.key)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-label={result.label}
                  aria-selected={active}
                  aria-posinset={index + 1}
                  aria-setsize={results.length}
                  key={result.key}
                  data-atlas-search-option=""
                  data-active={active ? "true" : "false"}
                  data-option-key={result.key}
                  data-selected={selected ? "true" : "false"}
                  onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
                    pointerTypeRef.current = event.pointerType || "mouse";
                    if (event.pointerType === "mouse") event.preventDefault();
                  }}
                  onPointerEnter={() => activate(index)}
                  onPointerUp={(event) => {
                    if (event.pointerType !== "mouse") {
                      internalInputRef.current?.focus({ preventScroll: true });
                    }
                  }}
                  onClick={() =>
                    selectResult(result, {
                      pointerType: pointerTypeRef.current,
                      source: "pointer",
                    })
                  }
                >
                  {renderOption(result, { active, selected })}
                </button>
              );
            })
          ) : (
            <p role="status">{emptyContent}</p>
          )}
        </div>
      )}
    </div>
  );
}
