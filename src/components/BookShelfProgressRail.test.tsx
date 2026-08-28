import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BookShelfProgressRail from "./BookShelfProgressRail";

describe("BookShelfProgressRail", () => {
  it("renders an injectable accessible N-of-M range", () => {
    const markup = renderToStaticMarkup(
      <BookShelfProgressRail
        focusIndex={12}
        total={40}
        label="Choose a book"
        valueText={(current, total) => `Book ${current} of ${total}`}
        onFocusIndexChange={vi.fn()}
      />
    );

    expect(markup).toContain('data-book-shelf-progress-rail=""');
    expect(markup).toContain('type="range"');
    expect(markup).toContain('min="1"');
    expect(markup).toContain('max="40"');
    expect(markup).toContain('value="13"');
    expect(markup).toContain('aria-label="Choose a book"');
    expect(markup).toContain('aria-valuetext="Book 13 of 40"');
    expect(markup).toContain("<strong>13</strong>");
    expect(markup).toContain(" / 40");
  });

  it("disables an empty rail without emitting an invalid range", () => {
    const markup = renderToStaticMarkup(
      <BookShelfProgressRail
        focusIndex={0}
        total={0}
        label="No books"
        onFocusIndexChange={vi.fn()}
      />
    );

    expect(markup).toContain('data-disabled="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain('min="0"');
    expect(markup).toContain('max="0"');
    expect(markup).toContain('value="0"');
    expect(markup).toContain('aria-valuetext="0 / 0"');
  });
});
