import { describe, expect, it } from "vitest";

import type { Writer } from "../data/countries";
import { calendarWriterIdentity, dateParts } from "./LiteraryCalendar";

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

  it("объединяет одного писателя из двух литературных традиций", () => {
    const russianEntry = {
      id: "nabrakov",
      name: "Владимир Владимирович Набоков",
      birthDate: "1899-04-22",
      deathDate: "1977-07-02",
    } as Writer;
    const americanEntry = {
      id: "vladimir_nabokov",
      name: "Владимир Набоков",
      birthDate: "1899-04-22",
      deathDate: "1977-07-02",
    } as Writer;

    expect(calendarWriterIdentity(russianEntry)).toBe(
      calendarWriterIdentity(americanEntry)
    );
  });
});
