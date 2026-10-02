import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";

import type { Country, Writer } from "../data/countries";
import { countries } from "../data/countries";
import { InterfaceLanguageProvider } from "../i18n/InterfaceLanguage";
import LiteraryCalendar, {
  calendarWriterIdentity,
  dateParts,
  selectCalendarEvents,
  calendarEventsForMonth,
  calendarEventsForYear,
  visibleCalendarAgendaDays,
} from "./LiteraryCalendar";

const calendarSource = readFileSync(
  new URL("./LiteraryCalendar.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("литературный календарь", () => {
  it("показывает SVG-флаг вместо повторяющейся подписи и сохраняет доступное название страны", () => {
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const country = {
      id: "france",
      code: "FR",
      name: "Франция",
      writers: [{ id: "calendar-writer", name: "Автор", birthDate: `1880-${month}-15` }],
    } as Country;
    const $ = load(renderToStaticMarkup(
      createElement(InterfaceLanguageProvider, null,
        createElement(LiteraryCalendar, { countries: [country] })
      )
    ));
    const control = $(".calendar-agenda-country");

    expect(control).toHaveLength(1);
    expect(control.text()).toBe("");
    expect(control.attr("aria-label")).toBe("Страна: Франция");
    expect(control.attr("title")).toBe("Франция");
    expect(control.find("img").attr("src")).toMatch(/\/assets\/country-flags\/fr\.svg$/u);
    expect(control.find("img").attr("alt")).toBe("");
    expect(control.find("img").attr("width")).toBe("28");
  });

  it("не оставляет флаги или пустые строки событий при отсутствии точных дат", () => {
    const $ = load(renderToStaticMarkup(
      createElement(InterfaceLanguageProvider, null,
        createElement(LiteraryCalendar, { countries: [] })
      )
    ));

    expect($(".calendar-empty")).toHaveLength(1);
    expect($(".calendar-agenda-event, .calendar-agenda-country")).toHaveLength(0);
  });

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

    expect(calendarWriterIdentity(russianEntry, "russia")).toBe(
      calendarWriterIdentity(americanEntry, "usa")
    );
  });

  it("объединяет дубликат, даже если в одной карточке не заполнена дата смерти", () => {
    const completeEntry = {
      id: "rohinton_mistry",
      name: "Рохинтон Мистри",
      birthDate: "1952-07-03",
      deathDate: "2025-01-01",
    } as Writer;
    const incompleteEntry = {
      id: "rohinton_mistry",
      name: "Рохинтон Мистри",
      birthDate: "1952-07-03",
    } as Writer;

    expect(calendarWriterIdentity(completeEntry, "canada")).toBe(
      calendarWriterIdentity(incompleteEntry, "canada")
    );
  });

  it("нормализует даты Wikidata перед поиском дубликатов", () => {
    const curatedEntry = {
      id: "james_joyce",
      name: "Джеймс Джойс",
      birthDate: "1882-02-02",
      deathDate: "1941-01-13",
    } as Writer;
    const generatedEntry = {
      id: "james_joyce",
      name: "Джеймс Джойс",
      birthDate: "+1882-02-02",
      deathDate: "+1941-01-13",
    } as Writer;

    expect(calendarWriterIdentity(curatedEntry, "ireland")).toBe(
      calendarWriterIdentity(generatedEntry, "ireland")
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

  it("разделяет переход к писателю и переход только к стране", () => {
    expect(calendarSource).toContain("calendar-agenda-writer is-");
    expect(calendarSource).toContain('className="calendar-agenda-country"');
    expect(calendarSource).toContain(
      "onCountrySelect?.(event.country, event.writer)"
    );
    expect(calendarSource).toContain("onCountrySelect?.(event.country)");
    expect(calendarSource).toContain('aria-label={`${t("Страна")}:');

    const countryOnlyTransition = appSource.slice(
      appSource.indexOf("const selectCalendarCountryOnly"),
      appSource.indexOf("const selectGlobeCountry")
    );
    expect(countryOnlyTransition).toContain("selectCountry(country, true)");
    expect(countryOnlyTransition).toContain("setSelectedWriter(null)");
    expect(countryOnlyTransition).toContain("setWriterFocusRequest(null)");
    expect(countryOnlyTransition).toContain("writerId: null");
    expect(countryOnlyTransition).toContain('"replace"');
    expect(countryOnlyTransition).toContain("focusCountryPresentation()");
    expect(appSource).toContain(": selectCalendarCountryOnly(country)");
  });
});


describe("R10 date and identity regressions on the calendar selector", () => {
  it("requires explicit precision for 1 January and validates the actual historical year", () => {
    expect(dateParts("1919-01-01", "day")).toEqual({ year: 1919, month: 0, day: 1 });
    expect(dateParts("1919-01-01", "year")).toBeNull();
    expect(dateParts("1600-02-29")).toEqual({ year: 1600, month: 1, day: 29 });
    expect(dateParts("1700-02-29")).toBeNull();
    expect(dateParts("1900-02-29")).toBeNull();
  });
  it("retains same-surname same-birthday people without an exact reviewed identity", () => {
    const country = { id: "test", writers: [
      { id: "one", name: "Anna Smith", birthDate: "1900-03-10" },
      { id: "two", name: "Mary Smith", birthDate: "1900-03-10" },
    ] } as Country;
    expect(selectCalendarEvents([country])).toHaveLength(2);
  });
  it("does not create or shift 29 February in a non-leap display year", () => {
    const country = { id: "test", writers: [
      { id: "leap", name: "Leap", birthDate: "1952-02-29" },
    ] } as Country;
    const events = selectCalendarEvents([country]);
    expect(events).toHaveLength(1);
    expect(calendarEventsForMonth(events, 2026, 1)).toHaveLength(0);
    expect(calendarEventsForMonth(events, 2026, 2)).toHaveLength(0);
    expect(calendarEventsForMonth(events, 2028, 1)).toHaveLength(1);
  });
});

describe("real public calendar coverage", () => {
  it("retains all public writer events across twelve months without treating October's 190 as the corpus", () => {
    const events = selectCalendarEvents(countries);
    expect(events).toHaveLength(2340);
    expect(events.filter(event => event.kind === "birth")).toHaveLength(1287);
    expect(events.filter(event => event.kind === "memory")).toHaveLength(1053);
    expect(Array.from({ length: 12 }, (_, month) => calendarEventsForMonth(events, 2026, month).length))
      .toEqual([222, 195, 191, 200, 195, 173, 189, 181, 185, 190, 208, 209]);
    expect(calendarEventsForYear(events, 2026)).toHaveLength(2338);
    expect(calendarEventsForYear(events, 2028)).toHaveLength(2340);
    expect(events.filter(event => event.month === 1 && event.day === 29).map(event => event.writer.id).sort())
      .toEqual(["stefan_ljubisa", "tim_powers"]);
    for (const event of events) {
      expect(countries.find(country => country.id === event.country.id)?.writers.some(writer => writer.id === event.writer.id)).toBe(true);
    }
  });

  it("states the current Russian month and annual coverage using the same available events", () => {
    vi.useFakeTimers();
    try {
      for (const [date, annual, monthly, februaryNotice] of [
        ["2026-10-02T12:00:00+03:00", "2 338", "190", true],
        ["2026-02-02T12:00:00+03:00", "2 338", "195", true],
        ["2028-02-02T12:00:00+03:00", "2 340", "197", false],
      ] as const) {
        vi.setSystemTime(new Date(date));
        const $ = load(renderToStaticMarkup(createElement(InterfaceLanguageProvider, null,
          createElement(LiteraryCalendar, { countries }))));
        const normalized = $(".calendar-year-summary").text().replace(/\s+/gu, " ");
        expect(normalized).toContain("2 340 ежегодных дат");
        expect(normalized).toContain(`году: ${annual} дат`);
        expect(normalized.includes("29 февраля")).toBe(februaryNotice);
        expect($(".calendar-summary > div").first().find("strong").text()).toBe(monthly);
        expect($(".calendar-summary > div").first().find("span").text()).toBe("дат за месяц");
        const gridCount = $(".calendar-day.has-event small").toArray()
          .reduce((sum, element) => sum + Number($(element).text()), 0);
        expect(gridCount).toBe(Number(monthly));
        expect($(".calendar-day").filter((_, element) => $(element).children("span").text() === "29").length)
          .toBe(date.includes("2026-02") ? 0 : 1);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
