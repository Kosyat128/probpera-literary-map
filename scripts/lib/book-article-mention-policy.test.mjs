import { describe, expect, it } from "vitest";

import { aliasCanIdentifyWork } from "./book-article-mention-policy.mjs";

describe("book mention precision", () => {
  it("does not confuse an ordinary one-word phrase with a book", () => {
    expect(aliasCanIdentifyWork("превращение")).toBe(false);
    expect(aliasCanIdentifyWork("крестьяне")).toBe(false);
    expect(aliasCanIdentifyWork("1984")).toBe(false);
  });

  it("accepts a one-word work only with its author or an exact title", () => {
    expect(
      aliasCanIdentifyWork("превращение", { authorPresent: true })
    ).toBe(true);
    expect(aliasCanIdentifyWork("превращение", { exactTitle: true })).toBe(
      true
    );
  });

  it("keeps distinctive multi-word titles eligible", () => {
    expect(aliasCanIdentifyWork("война и мир")).toBe(true);
  });
});
