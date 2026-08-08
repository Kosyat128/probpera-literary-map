import { describe, expect, it } from "vitest";

import {
  requestedBookKey,
  resolveRequestedBook,
} from "../components/BookArchiveSection";
import { bookArchiveKey } from "./bookArchive";

describe("book archive deep links", () => {
  it("uses one stable country/writer/work identity", () => {
    expect(bookArchiveKey("usa", "melville", "moby-dick")).toBe(
      "usa:melville:moby-dick"
    );
  });

  it("reads an encoded public-book request without accepting malformed keys", () => {
    expect(
      requestedBookKey("?utm_source=article&book=usa%3Amelville%3Amoby-dick")
    ).toBe("usa:melville:moby-dick");
    expect(requestedBookKey("?book=usa%3Amelville")).toBeNull();
    expect(requestedBookKey("?book=usa%3Amelville%3Amoby-dick%3Aedition")).toBeNull();
  });

  it("keeps a valid request while the archive is loading, then resolves it", () => {
    const key = "usa:melville:moby-dick";
    expect(resolveRequestedBook([], key)).toEqual({ status: "pending" });

    const book = {
      countryId: "usa",
      writerId: "melville",
      id: "moby-dick",
    } as Parameters<typeof resolveRequestedBook>[0][number];
    expect(resolveRequestedBook([book], key)).toEqual({
      status: "found",
      book,
    });
    expect(resolveRequestedBook([book], "usa:melville:unknown")).toEqual({
      status: "missing",
    });
  });
});
