import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AtlasSearchCombobox, {
  atlasComboboxNavigationIndex,
  atlasComboboxOptionId,
} from "./AtlasSearchCombobox";

const results = [
  { key: "country:russia", label: "Россия", type: "country" },
  { key: "writer:russia:dostoevsky", label: "Фёдор Достоевский", type: "writer" },
  { key: "book:usa:moby-dick", label: "Моби Дик", type: "book" },
] as const;

describe("AtlasSearchCombobox", () => {
  it("implements wrapping listbox navigation and Home/End", () => {
    expect(atlasComboboxNavigationIndex(-1, 3, "ArrowDown")).toBe(0);
    expect(atlasComboboxNavigationIndex(-1, 3, "ArrowUp")).toBe(2);
    expect(atlasComboboxNavigationIndex(2, 3, "ArrowDown")).toBe(0);
    expect(atlasComboboxNavigationIndex(0, 3, "ArrowUp")).toBe(2);
    expect(atlasComboboxNavigationIndex(1, 3, "Home")).toBe(0);
    expect(atlasComboboxNavigationIndex(1, 3, "End")).toBe(2);
    expect(atlasComboboxNavigationIndex(0, 0, "ArrowDown")).toBe(-1);
  });

  it("builds stable option ids from result identity rather than array position", () => {
    const id = atlasComboboxOptionId("country-search", "writer:ru:tolstoy");
    expect(id).toBe(
      "country-search-listbox-option-writer%3Aru%3Atolstoy"
    );
    expect(id).not.toMatch(/\s/);
  });

  it("renders an APG combobox with virtual option focus and stable QA hooks", () => {
    const markup = renderToStaticMarkup(
      <AtlasSearchCombobox
        id="country-search"
        label="Найти страну, писателя или книгу"
        value="дос"
        open
        results={results}
        selectedKey="writer:russia:dostoevsky"
        caption="Результаты поиска"
        emptyContent="Ничего не найдено"
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        onValueChange={vi.fn()}
        renderOption={(result) => <span>{result.label}</span>}
      />
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-controls="country-search-listbox"');
    expect(markup).toContain(
      'aria-activedescendant="country-search-listbox-option-writer%3Arussia%3Adostoevsky"'
    );
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('role="option"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('data-atlas-search-combobox=""');
    expect(markup).toContain('data-atlas-search-listbox=""');
    expect(markup).toContain('data-atlas-search-option=""');
  });

  it("removes virtual focus and the listbox when closed", () => {
    const markup = renderToStaticMarkup(
      <AtlasSearchCombobox
        id="country-search"
        label="Search"
        value=""
        open={false}
        results={results}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        onValueChange={vi.fn()}
        renderOption={(result) => result.label}
      />
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("aria-activedescendant");
    expect(markup).not.toContain('role="listbox"');
  });

  it("keeps Escape priority, active scrolling, and pointer-safe selection in source", () => {
    const source = readFileSync(
      new URL("./AtlasSearchCombobox.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("onEscapeWhenClosed");
    expect(source).toContain('scrollIntoView({ block: "nearest" })');
    expect(source).toContain("onPointerEnter={() => activate(index)}");
    expect(source).toContain('event.pointerType === "mouse"');
  });
});
