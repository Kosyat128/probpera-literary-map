import type { ReactNode } from "react";

import BrandBookIcon from "./BrandBookIcon";
import BrandFilterIcon from "./BrandFilterIcon";
import BrandQuillIcon from "./BrandQuillIcon";
import BrandSearchIcon from "./BrandSearchIcon";

export type BookShelfViewMode = "shelf" | "catalog";
export type BookShelfSearchScope = "library" | "global";

export type BookShelfQuickFilterOption = {
  id: string;
  label: string;
  description: string;
  count?: number | null;
  unavailable?: boolean;
};

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  searchScope: BookShelfSearchScope;
  onSearchScopeChange: (scope: BookShelfSearchScope) => void;
  libraryScopeLabel: string;
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
  suggestions?: ReactNode;
};

export default function BookShelfControls({
  query,
  onQueryChange,
  searchLabel,
  searchPlaceholder,
  searchScope,
  onSearchScopeChange,
  libraryScopeLabel,
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
  suggestions,
}: Props) {
  const compactOrder = ["verified", "classic", "children"];
  const compactFilters = compactOrder.flatMap((id) =>
    filters.filter((filter) => filter.id === id)
  );

  return (
    <div className="book-archive-toolbar book-shelf-controls">
      <div className="book-shelf-controls__topline">
        <span className="book-shelf-controls__mark" aria-hidden="true">
          <BrandQuillIcon />
        </span>

        <label className="book-shelf-controls__search">
          <span>{searchLabel}</span>
          <span className="book-shelf-controls__input">
            <BrandSearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
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
            <span aria-hidden="true">✦</span>
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
              >
                <span className="book-filter-copy">
                  <strong>{filter.label}</strong>
                  <small>{filter.description}</small>
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
          >
            <BrandFilterIcon />
          </button>
        </div>
      </div>

      {suggestions}
    </div>
  );
}
