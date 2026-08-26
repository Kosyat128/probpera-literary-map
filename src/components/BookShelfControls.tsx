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
  brandName: string;
  brandTagline: string;
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
  brandName,
  brandTagline,
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
        <a
          className="book-shelf-controls__brand"
          href={import.meta.env.BASE_URL}
          aria-label={brandName}
        >
          <BrandQuillIcon />
          <span>
            <strong>{brandName}</strong>
            <small>{brandTagline}</small>
          </span>
        </a>
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
