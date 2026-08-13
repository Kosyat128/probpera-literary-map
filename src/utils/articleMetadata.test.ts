import { describe, expect, it } from "vitest";

import { normalizeArticleMetadataText } from "./articleMetadata";

describe("article card metadata", () => {
  it("removes invisible controls and decodes harmless HTML remnants", () => {
    expect(
      normalizeArticleMetadataText(
        "  Фернанду\u00ad&nbsp;<strong>Пессоа</strong>\u200b  "
      )
    ).toBe("Фернанду Пессоа");
  });
});
