import { describe, expect, it } from "vitest";

import type { Writer } from "../data/countries";
import {
  calendarWriterIdentity,
  dateParts,
  visibleCalendarAgendaDays,
} from "./LiteraryCalendar";

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

  it("объединяет дубликат, даже если в одной карточке не заполнена дата смерти", () => {
    const completeEntry = {
      id: "mystery_complete",
      name: "Рохинтон Мистри",
      birthDate: "1952-07-03",
      deathDate: "2025-01-01",
    } as Writer;
    const incompleteEntry = {
      id: "mystery_incomplete",
      name: "Рохинтон Мистри",
      birthDate: "1952-07-03",
    } as Writer;

    expect(calendarWriterIdentity(completeEntry)).toBe(
      calendarWriterIdentity(incompleteEntry)
    );
  });

  it("нормализует даты Wikidata перед поиском дубликатов", () => {
    const curatedEntry = {
      id: "joyce_curated",
      name: "Джеймс Джойс",
      birthDate: "1882-02-02",
      deathDate: "1941-01-13",
    } as Writer;
    const generatedEntry = {
      id: "joyce_generated",
      name: "Джеймс Джойс",
      birthDate: "+1882-02-02",
      deathDate: "+1941-01-13",
    } as Writer;

    expect(calendarWriterIdentity(curatedEntry)).toBe(
      calendarWriterIdentity(generatedEntry)
    );
  });

  it("сначала показывает компактную повестку, а по запросу - все дни с событиями", () => {
    const days = Array.from({ length: 9 }, (_, index) =>
      [index + 1, [`event-${index + 1}`]] as const
    );

    expect(visibleCalendarAgendaDays(days, false).map(([day]) => day)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(visibleCalendarAgendaDays(days, true)).toEqual(days);
  });
});
