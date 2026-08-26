import type { ReactNode } from "react";

import BrandBookIcon from "./BrandBookIcon";
import BrandFilterIcon from "./BrandFilterIcon";
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
  filters,
  activeFilterId,
  onFilterChange,
  resultCountLabel,
  formatCount,
  onOpenAdvancedFilters,
  advancedFiltersLabel,
  suggestions,
}: Props) {
  return (
    <div className="book-archive-toolbar book-shelf-controls">
      <div className="book-shelf-controls__topline">
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

        <div className="book-shelf-controls__scope" role="group" aria-label={searchLabel}>
          <button
            type="button"
            className={searchScope === "library" ? "is-active" : ""}
            aria-pressed={searchScope === "library"}
            onClick={() => onSearchScopeChange("library")}
          >
            {libraryScopeLabel}
          </button>
          <button
            type="button"
            className={searchScope === "global" ? "is-active" : ""}
            aria-pressed={searchScope === "global"}
            onClick={() => onSearchScopeChange("global")}
          >
            {globalScopeLabel}
          </button>
        </div>

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
        </div>
      </div>

      {suggestions}

      <div className="book-filter-panel">
        <div className="book-filter-heading">
          <span>{resultCountLabel}</span>
          <button type="button" onClick={onOpenAdvancedFilters}>
            <BrandFilterIcon />
            {advancedFiltersLabel}
          </button>
        </div>
        <div className="book-archive-filters" role="group" aria-label={resultCountLabel}>
          {filters.map((filter) => (
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
              <span className="book-filter-count">
                {filter.count === null || filter.count === undefined
                  ? "—"
                  : formatCount(filter.count)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
