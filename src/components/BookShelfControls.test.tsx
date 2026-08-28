import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BookShelfControls, {
  bookShelfSuggestionNavigationIndex,
  resolveBookShelfSuggestionKeyboardAction,
} from "./BookShelfControls";

const baseProps = {
  query: "дос",
  onQueryChange: vi.fn(),
  searchLabel: "Поиск книг",
  searchPlaceholder: "Автор или название",
  searchScope: "library" as const,
  onSearchScopeChange: vi.fn(),
  libraryScopeLabel: "Текущая полка",
  archiveScopeLabel: "Весь архив",
  globalScopeLabel: "Весь журнал",
  viewMode: "shelf" as const,
  onViewModeChange: vi.fn(),
  shelfLabel: "Полка",
  catalogLabel: "Каталог",
  randomLabel: "Случайная книга",
  randomDescription: "Выбрать случайную книгу",
  randomDisabled: false,
  onRandomWork: vi.fn(),
  filters: [],
  activeFilterId: "verified",
  onFilterChange: vi.fn(),
  resultCountLabel: "2 результата",
  formatCount: (value: number) => String(value),
  onOpenAdvancedFilters: vi.fn(),
  advancedFiltersLabel: "Расширенные фильтры",
};

describe("BookShelfControls suggestions", () => {
  it("resolves the complete keyboard contract without moving DOM focus", () => {
    expect(bookShelfSuggestionNavigationIndex(-1, 3, "ArrowDown")).toBe(0);
    expect(bookShelfSuggestionNavigationIndex(-1, 3, "ArrowUp")).toBe(2);
    expect(bookShelfSuggestionNavigationIndex(2, 3, "ArrowDown")).toBe(0);
    expect(bookShelfSuggestionNavigationIndex(0, 3, "ArrowUp")).toBe(2);

    expect(
      resolveBookShelfSuggestionKeyboardAction("ArrowDown", -1, 3, false)
    ).toMatchObject({ handled: true, nextIndex: 0, open: true });
    expect(
      resolveBookShelfSuggestionKeyboardAction("Enter", 1, 3, true)
    ).toEqual({
      handled: true,
      nextIndex: -1,
      open: false,
      selectIndex: 1,
    });
    expect(
      resolveBookShelfSuggestionKeyboardAction("Escape", 1, 3, true)
    ).toEqual({
      handled: true,
      nextIndex: -1,
      open: false,
      selectIndex: null,
    });
    expect(
      resolveBookShelfSuggestionKeyboardAction("Enter", -1, 0, true).handled
    ).toBe(false);
  });

  it("renders arbitrary existing suggestion buttons as an APG listbox", () => {
    const markup = renderToStaticMarkup(
      <BookShelfControls
        {...baseProps}
        suggestionsLabel="Подсказки поиска книг"
        suggestions={
          <div className="book-shelf-search-results">
            <ul>
              <li>
                <button type="button">Фёдор Достоевский</button>
              </li>
              <li>
                <button type="button">Братья Карамазовы</button>
              </li>
            </ul>
          </div>
        }
      />
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toMatch(/aria-controls="book-shelf-search-[^"]+-listbox"/u);
    expect(markup).toMatch(
      /aria-activedescendant="book-shelf-search-[^"]+-listbox-option-1"/u
    );
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('aria-label="Подсказки поиска книг"');
    expect(markup.match(/role="option"/gu)).toHaveLength(2);
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-posinset="1"');
    expect(markup).toContain('aria-setsize="2"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('data-book-shelf-suggestion-option=""');
  });

  it("keeps the combobox collapsed when no suggestion surface exists", () => {
    const markup = renderToStaticMarkup(<BookShelfControls {...baseProps} />);

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("aria-activedescendant");
    expect(markup).not.toContain('role="listbox"');
  });
});
