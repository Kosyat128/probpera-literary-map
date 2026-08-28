import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BookShelfFrame from "./BookShelfFrame";

describe("BookShelfFrame live region", () => {
  it("keeps the legacy message as an atomic polite status", () => {
    const markup = renderToStaticMarkup(
      <BookShelfFrame viewMode="shelf" liveMessage="Книга 2 из 13">
        <div>Полка</div>
      </BookShelfFrame>
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('aria-relevant="additions text"');
    expect(markup).toContain('data-book-shelf-live-region=""');
    expect(markup).toContain("Книга 2 из 13");
  });

  it("supports a labelled assertive announcement without breaking legacy props", () => {
    const markup = renderToStaticMarkup(
      <BookShelfFrame
        viewMode="catalog"
        liveMessage="Резервное сообщение"
        liveRegion={{
          message: "Трёхмерная полка недоступна",
          priority: "assertive",
          atomic: false,
          busy: true,
          relevant: "text",
          label: "Состояние книжной полки",
        }}
      >
        <div>Каталог</div>
      </BookShelfFrame>
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('aria-atomic="false"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-relevant="text"');
    expect(markup).toContain('aria-label="Состояние книжной полки"');
    expect(markup).toContain("Трёхмерная полка недоступна");
    expect(markup).not.toContain("Резервное сообщение");
  });
});
