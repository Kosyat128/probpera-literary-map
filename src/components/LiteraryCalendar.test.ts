import { describe, expect, it } from "vitest";

import { dateParts } from "./LiteraryCalendar";

describe("литературный календарь", () => {
  it("не превращает год без точной даты в событие 1 января", () => {
    expect(dateParts("1899-01-01")).toBeNull();
    expect(dateParts("1899")).toBeNull();
  });

  it("принимает реальную полную дату", () => {
    expect(dateParts("1821-11-11")).toEqual({
      year: 1821,
      month: 10,
      day: 11,
    });
  });

  it("отбрасывает невозможные даты", () => {
    expect(dateParts("2000-02-31")).toBeNull();
    expect(dateParts("2000-13-02")).toBeNull();
  });
});
