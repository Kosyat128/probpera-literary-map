import { describe, expect, it } from "vitest";

import {
  HISTORY_EVENTS_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  historyCatalogFormHref,
  historyCatalogHref,
  parseHistoryCatalogQuery,
} from "./history-catalog-query";

describe("history catalog query", () => {
  it("allows only known kinds and creates independent ranges", () => {
    expect(parseHistoryCatalogQuery({ kind: "edition", page: 3, events_page: 2 })).toMatchObject({
      kind: "edition",
      from: HISTORY_PAGE_SIZE * 2,
      to: HISTORY_PAGE_SIZE * 3 - 1,
      eventsFrom: HISTORY_EVENTS_PAGE_SIZE,
      eventsTo: HISTORY_EVENTS_PAGE_SIZE * 2 - 1,
    });
    expect(parseHistoryCatalogQuery({ kind: "edition);drop table" }).kind).toBe("");
  });

  it("normalizes entity search and escapes LIKE wildcards", () => {
    expect(parseHistoryCatalogQuery({ entity: "  isbn:100%_test\u0000 " })).toMatchObject({
      entity: "isbn:100%_test",
      entityPattern: "%isbn:100\\%\\_test%",
    });
  });

  it("preserves canonical filters in pages and restore redirects", () => {
    const catalog = parseHistoryCatalogQuery({
      kind: "work",
      entity: "tolstoy",
      page: 2,
      events_page: 4,
    });
    expect(historyCatalogHref(catalog, { page: 3 })).toBe(
      "/history?kind=work&entity=tolstoy&page=3&events_page=4"
    );
    const values = new Map<string, unknown>([
      ["history_kind", "work"],
      ["history_entity", "tolstoy"],
      ["history_page", "2"],
    ]);
    expect(
      historyCatalogFormHref({ get: (name) => values.get(name) }, { restored: "work" })
    ).toContain("restored=work");
  });
});
