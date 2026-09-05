import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import BrandBookIcon from "./BrandBookIcon";
import BrandFilterIcon from "./BrandFilterIcon";
import BrandQuillIcon from "./BrandQuillIcon";
import BrandSearchIcon from "./BrandSearchIcon";
import BrandSparkleIcon from "./BrandSparkleIcon";

export type BookShelfViewMode = "shelf" | "catalog";
export type BookShelfSearchScope = "library" | "archive" | "global";

export type BookShelfQuickFilterOption = {
  id: string;
  label: string;
  description: string;
  count?: number | null;
  unavailable?: boolean;
};

export type BookShelfSuggestionNavigationKey =
  | "ArrowDown"
  | "ArrowUp"
  | "End"
  | "Home";

export type BookShelfSuggestionKeyboardAction = Readonly<{
  handled: boolean;
  nextIndex: number;
  open: boolean;
  selectIndex: number | null;
}>;

type SuggestionElementProps = {
  children?: ReactNode;
  id?: string;
  role?: string;
  tabIndex?: number;
  "aria-posinset"?: number;
  "aria-selected"?: boolean;
  "aria-setsize"?: number;
  "data-book-shelf-suggestion-index"?: string;
  "data-book-shelf-suggestion-option"?: string;
};

const unhandledSuggestionKey: BookShelfSuggestionKeyboardAction =
  Object.freeze({
    handled: false,
    nextIndex: -1,
    open: false,
    selectIndex: null,
  });

export function bookShelfSuggestionOptionId(
  listboxId: string,
  index: number
) {
  return `${listboxId}-option-${index + 1}`;
}

export function bookShelfSuggestionNavigationIndex(
  currentIndex: number,
  itemCount: number,
  key: BookShelfSuggestionNavigationKey
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

export function resolveBookShelfSuggestionKeyboardAction(
  key: string,
  currentIndex: number,
  itemCount: number,
  open: boolean
): BookShelfSuggestionKeyboardAction {
  if (key === "Escape" && open) {
    return {
      handled: true,
      nextIndex: -1,
      open: false,
      selectIndex: null,
    };
  }

  if (key === "ArrowDown" || key === "ArrowUp") {
    if (itemCount <= 0) return unhandledSuggestionKey;
    return {
      handled: true,
      nextIndex: bookShelfSuggestionNavigationIndex(
        currentIndex,
        itemCount,
        key
      ),
      open: true,
      selectIndex: null,
    };
  }

  if (open && (key === "Home" || key === "End") && itemCount > 0) {
    return {
      handled: true,
      nextIndex: bookShelfSuggestionNavigationIndex(
        currentIndex,
        itemCount,
        key
      ),
      open: true,
      selectIndex: null,
    };
  }

  if (open && key === "Enter" && itemCount > 0) {
    const selectIndex =
      currentIndex >= 0 && currentIndex < itemCount ? currentIndex : 0;
    return {
      handled: true,
      nextIndex: -1,
      open: false,
      selectIndex,
    };
  }

  return unhandledSuggestionKey;
}

function isSuggestionOptionElement(
  element: ReactElement<SuggestionElementProps>
) {
  return (
    typeof element.type === "string" &&
    (element.type === "button" ||
      element.type === "a" ||
      element.props.role === "option" ||
      element.props["data-book-shelf-suggestion-option"] !== undefined)
  );
}

function countSuggestionOptions(node: ReactNode): number {
  let count = 0;
  Children.forEach(node, (child) => {
    if (!isValidElement<SuggestionElementProps>(child)) return;
    if (isSuggestionOptionElement(child)) {
      count += 1;
      return;
    }
    count += countSuggestionOptions(child.props.children);
  });
  return count;
}

function decorateSuggestionOptions(
  node: ReactNode,
  listboxId: string,
  activeIndex: number,
  itemCount: number,
  cursor: { index: number }
): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement<SuggestionElementProps>(child)) return child;
    if (isSuggestionOptionElement(child)) {
      const index = cursor.index;
      cursor.index += 1;
      return cloneElement(child, {
        id: child.props.id || bookShelfSuggestionOptionId(listboxId, index),
        role: "option",
        tabIndex: -1,
        "aria-posinset": index + 1,
        "aria-selected": index === activeIndex,
        "aria-setsize": itemCount,
        "data-book-shelf-suggestion-index": String(index),
        "data-book-shelf-suggestion-option": "",
      });
    }
    if (child.props.children === undefined) return child;
    return cloneElement(
      child,
      undefined,
      decorateSuggestionOptions(
        child.props.children,
        listboxId,
        activeIndex,
        itemCount,
        cursor
      )
    );
  });
}

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  searchScope: BookShelfSearchScope;
  onSearchScopeChange: (scope: BookShelfSearchScope) => void;
  libraryScopeLabel: string;
  archiveScopeLabel: string;
  globalScopeLabel: string;
  viewMode: BookShelfViewMode;
  onViewModeChange: (mode: BookShelfViewMode) => void;
  shelfLabel: string;
  catalogLabel: string;
  randomLabel: string;
  randomDescription: string;
  randomDisabled: boolean;
  onRandomWork: (trigger: HTMLButtonElement) => void;
  filters: readonly BookShelfQuickFilterOption[];
  activeFilterId: string;
  onFilterChange: (id: string) => void;
  resultCountLabel: string;
  formatCount: (value: number) => string;
  onOpenAdvancedFilters: () => void;
  advancedFiltersLabel: string;
  advancedFiltersOpen?: boolean;
  advancedFiltersId?: string;
  suggestions?: ReactNode;
  suggestionsLabel?: string;
  onSuggestionsDismiss?: () => void;
};

export default function BookShelfControls({
  query,
  onQueryChange,
  searchLabel,
  searchPlaceholder,
  searchScope,
  onSearchScopeChange,
  libraryScopeLabel,
  archiveScopeLabel,
  globalScopeLabel,
  viewMode,
  onViewModeChange,
  shelfLabel,
  catalogLabel,
  randomLabel,
  randomDescription,
  randomDisabled,
  onRandomWork,
  filters,
  activeFilterId,
  onFilterChange,
  resultCountLabel,
  onOpenAdvancedFilters,
  advancedFiltersLabel,
  advancedFiltersOpen = false,
  advancedFiltersId,
  suggestions,
  suggestionsLabel,
  onSuggestionsDismiss,
}: Props) {
  const generatedId = useId();
  const controlId = `book-shelf-search-${generatedId.replace(/:/g, "")}`;
  const searchLabelId = `${controlId}-label`;
  const listboxId = `${controlId}-listbox`;
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionCount = countSuggestionOptions(suggestions);
  const suggestionsAvailable =
    suggestions !== undefined && suggestions !== null && suggestions !== false;
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(() =>
    suggestionCount > 0 ? 0 : -1
  );
  const suggestionsOpen = suggestionsAvailable && !suggestionsDismissed;
  const compactOrder = ["verified", "classic", "children"];
  const compactFilters = compactOrder.flatMap((id) =>
    filters.filter((filter) => filter.id === id)
  );

  useEffect(() => {
    setSuggestionsDismissed(false);
    setActiveSuggestionIndex(suggestionCount > 0 ? 0 : -1);
  }, [query]);

  useEffect(() => {
    if (!suggestionsOpen || suggestionCount <= 0) {
      setActiveSuggestionIndex(-1);
      return;
    }
    setActiveSuggestionIndex((current) =>
      current >= 0 && current < suggestionCount ? current : 0
    );
  }, [suggestionCount, suggestionsOpen]);

  useEffect(() => {
    if (!suggestionsOpen || activeSuggestionIndex < 0) return;
    suggestionsRef.current
      ?.querySelector<HTMLElement>(
        `[data-book-shelf-suggestion-index="${activeSuggestionIndex}"]`
      )
      ?.scrollIntoView({ block: "nearest" });
  }, [activeSuggestionIndex, suggestionsOpen]);

  const decoratedSuggestions = useMemo(
    () =>
      decorateSuggestionOptions(
        suggestions,
        listboxId,
        activeSuggestionIndex,
        suggestionCount,
        { index: 0 }
      ),
    [activeSuggestionIndex, listboxId, suggestionCount, suggestions]
  );

  const findSuggestionOption = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const option = target.closest<HTMLElement>(
      "[data-book-shelf-suggestion-index]"
    );
    return option && suggestionsRef.current?.contains(option) ? option : null;
  };

  const dismissSuggestions = () => {
    setSuggestionsDismissed(true);
    setActiveSuggestionIndex(-1);
    onSuggestionsDismiss?.();
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const action = resolveBookShelfSuggestionKeyboardAction(
      event.key,
      activeSuggestionIndex,
      suggestionCount,
      suggestionsOpen
    );
    if (!action.handled) return;
    event.preventDefault();
    if (event.key === "Escape") event.stopPropagation();
    setSuggestionsDismissed(!action.open);
    setActiveSuggestionIndex(action.nextIndex);
    if (event.key === "Escape") onSuggestionsDismiss?.();
    if (action.selectIndex !== null) {
      suggestionsRef.current
        ?.querySelector<HTMLElement>(
          `[data-book-shelf-suggestion-index="${action.selectIndex}"]`
        )
        ?.click();
    }
  };

  const handleSuggestionPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const option = findSuggestionOption(event.target);
    if (!option) return;
    const index = Number(option.dataset.bookShelfSuggestionIndex);
    if (Number.isInteger(index)) setActiveSuggestionIndex(index);
  };

  return (
    <div className="book-archive-toolbar book-shelf-controls">
      <div className="book-shelf-controls__topline">
        <span className="book-shelf-controls__mark" aria-hidden="true">
          <BrandQuillIcon />
        </span>

        <label className="book-shelf-controls__search" htmlFor={controlId}>
          <span id={searchLabelId}>{searchLabel}</span>
          <span className="book-shelf-controls__input">
            <BrandSearchIcon />
            <input
              id={controlId}
              role="combobox"
              type="search"
              value={query}
              onChange={(event) => {
                setSuggestionsDismissed(false);
                setActiveSuggestionIndex(-1);
                onQueryChange(event.target.value);
              }}
              onFocus={() => {
                setSuggestionsDismissed(false);
                if (suggestionCount > 0) setActiveSuggestionIndex(0);
              }}
              onClick={() => {
                setSuggestionsDismissed(false);
                if (suggestionCount > 0 && activeSuggestionIndex < 0) {
                  setActiveSuggestionIndex(0);
                }
              }}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget;
                if (
                  nextTarget instanceof Node &&
                  suggestionsRef.current?.contains(nextTarget)
                ) {
                  return;
                }
                setSuggestionsDismissed(true);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              autoComplete="off"
              aria-labelledby={searchLabelId}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={suggestionsOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                suggestionsOpen && activeSuggestionIndex >= 0
                  ? bookShelfSuggestionOptionId(
                      listboxId,
                      activeSuggestionIndex
                    )
                  : undefined
              }
            />
          </span>
        </label>

        <div className="book-shelf-controls__views" role="group" aria-label={catalogLabel}>
          <button
            type="button"
            className={viewMode === "shelf" ? "is-active" : ""}
            aria-pressed={viewMode === "shelf"}
            onClick={() => onViewModeChange("shelf")}
          >
            <BrandBookIcon />
            {shelfLabel}
          </button>
          <button
            type="button"
            className={viewMode === "catalog" ? "is-active" : ""}
            aria-pressed={viewMode === "catalog"}
            onClick={() => onViewModeChange("catalog")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
            {catalogLabel}
          </button>
          <button
            type="button"
            className="book-shelf-controls__random"
            onClick={(event) => onRandomWork(event.currentTarget)}
            disabled={randomDisabled}
            aria-label={randomDescription}
            title={randomDescription}
          >
            <BrandSparkleIcon />
            {randomLabel}
          </button>
        </div>

        <label className="book-shelf-controls__scope">
          <span className="book-shelf-controls__visually-hidden">{searchLabel}</span>
          <select
            value={searchScope}
            onChange={(event) =>
              onSearchScopeChange(event.target.value as BookShelfSearchScope)
            }
            aria-label={searchLabel}
          >
            <option value="library">{libraryScopeLabel}</option>
            <option value="archive">{archiveScopeLabel}</option>
            <option value="global">{globalScopeLabel}</option>
          </select>
        </label>

        <div className="book-filter-panel">
          <span className="book-shelf-controls__visually-hidden">
            {resultCountLabel}
          </span>
          <div className="book-archive-filters" role="group" aria-label={resultCountLabel}>
            {compactFilters.map((filter) => (
              <button
                className={activeFilterId === filter.id ? "is-active" : ""}
                type="button"
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                aria-pressed={activeFilterId === filter.id}
                disabled={filter.unavailable}
                aria-describedby={`${controlId}-filter-${filter.id}`}
              >
                <span className="book-filter-copy">
                  <strong>{filter.label}</strong>
                  <small id={`${controlId}-filter-${filter.id}`}>{filter.description}</small>
                </span>
              </button>
            ))}
          </div>
          <button
            className="book-shelf-controls__advanced"
            type="button"
            onClick={onOpenAdvancedFilters}
            aria-label={advancedFiltersLabel}
            title={advancedFiltersLabel}
            aria-haspopup="dialog"
            aria-expanded={advancedFiltersOpen}
            aria-controls={advancedFiltersOpen ? advancedFiltersId : undefined}
          >
            <BrandFilterIcon />
          </button>
        </div>
      </div>

      {suggestionsOpen ? (
        <div
          ref={suggestionsRef}
          id={listboxId}
          className="book-shelf-controls__suggestions"
          role="listbox"
          aria-label={suggestionsLabel || searchLabel}
          onPointerMove={handleSuggestionPointerMove}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && findSuggestionOption(event.target)) {
              event.preventDefault();
            }
          }}
          onClickCapture={(event) => {
            if (findSuggestionOption(event.target)) dismissSuggestions();
          }}
        >
          {decoratedSuggestions}
        </div>
      ) : null}
    </div>
  );
}
