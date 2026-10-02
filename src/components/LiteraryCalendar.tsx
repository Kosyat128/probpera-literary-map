import { useEffect, useMemo, useRef, useState } from "react";

import type { Country, Writer } from "../data/countries";
import { selectWriterDisplayName } from "../data/bookLocalization";
import { cmsCoreFieldMarker } from "../cms/directEditBridge";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import BrandArrowIcon from "./BrandArrowIcon";
import CountryFlagIcon from "./CountryFlagIcon";
import { calendarWriterQid } from "../data/countries/calendarWriterIdentities";
import { applyCalendarWriterDatePatches, calendarWriterDatePatches, type WriterDatePatch } from "../data/countries/calendarWriterDatePatches";
import { parseWriterDate, type WriterDatePrecision } from "../utils/writerDates";

type Props = {
  countries: Country[];
  onCountrySelect?: (country: Country, writer?: Writer) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
};

type CalendarEvent = {
  day: number;
  month: number;
  title: string;
  detail: string;
  kind: "birth" | "memory";
  country: Country;
  writer: Writer;
};

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export function dateParts(value?: string, precision?: WriterDatePrecision) {
  if (!value || !/^\+?\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseWriterDate(value);
  if (!parsed || parsed.precision !== "day" || parsed.year < 100) return null;
  if (precision && precision !== "day") return null;
  // Legacy 01.01 needs explicit, value-bound day evidence; a year-only import
  // must never silently become a birthday.
  if (parsed.month === 1 && parsed.day === 1 && precision !== "day") return null;
  return { year: parsed.year, month: parsed.month! - 1, day: parsed.day! };
}

function writerName(
  writer: Writer,
  language: "ru" | "en" = "ru",
  fallback = language === "en" ? "Author" : "Автор"
) {
  return selectWriterDisplayName(writer, language, fallback);
}

export function calendarWriterIdentity(writer: Writer, countryId = "") {
  const qid = calendarWriterQid(writer, `${countryId}:${writer.id}`);
  return qid ? `wikidata:${qid}` : `writer:${countryId}:${writer.id}`;
}

export function selectCalendarEvents(
  countries: Country[],
  language: "ru" | "en" = "ru",
  translate: (value: string) => string = value => value,
  patches: readonly WriterDatePatch[] = calendarWriterDatePatches
): CalendarEvent[] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const country of applyCalendarWriterDatePatches(countries, patches).countries) for (const writer of country.writers) {
    for (const [field, kind, label] of [
      ["birthDate", "birth", "День рождения"],
      ["deathDate", "memory", "День памяти"],
    ] as const) {
      const evidence = writer.dateEvidence?.[field];
      const precision = evidence?.value === writer[field] ? evidence?.precision : undefined;
      const parts = dateParts(writer[field], precision);
      if (!parts) continue;
      const key = `${calendarWriterIdentity(writer, country.id)}:${kind}`;
      groups.set(key, [...(groups.get(key) || []), {
        day: parts.day, month: parts.month,
        title: writerName(writer, language, translate("Автор")),
        detail: `${translate(label)} · ${parts.year}`,
        kind, country, writer,
      }]);
    }
  }
  const result: CalendarEvent[] = [];
  for (const group of groups.values()) {
    const values = new Set(group.map(event =>
      event.writer[event.kind === "birth" ? "birthDate" : "deathDate"]!.replace(/^\+/, "")
    ));
    // An exact QID deduplicates language/country aliases, but never resolves
    // contradictory facts by picking the longest name or the first country.
    if (values.size !== 1) continue;
    result.push(group.reduce((best, event) => writerName(event.writer).length > writerName(best.writer).length ? event : best));
  }
  return result.sort((a, b) => a.day - b.day || a.title.localeCompare(b.title, language));
}

export function calendarEventsForMonth(events: CalendarEvent[], year: number, month: number) {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return events.filter(event => event.month === month && event.day <= days);
}

export function calendarEventsForYear(events: CalendarEvent[], year: number) {
  return Array.from({ length: 12 }, (_, month) => calendarEventsForMonth(events, year, month)).flat();
}

export function visibleCalendarAgendaDays<T>(
  entries: readonly (readonly [number, T])[],
  expanded: boolean,
  limit = 6
) {
  return expanded ? [...entries] : entries.slice(0, limit);
}

export default function LiteraryCalendar({
  countries,
  onCountrySelect,
  eyebrow,
  title,
  description,
}: Props) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const today = useMemo(() => new Date(), []);
  const [visibleDate, setVisibleDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showFullAgenda, setShowFullAgenda] = useState(false);
  const [calendarView, setCalendarView] = useState<"month" | "year">("month");
  const [yearSearch, setYearSearch] = useState("");
  const [yearPage, setYearPage] = useState(0);
  const agendaRef = useRef<HTMLDivElement>(null);
  const yearAgendaRef = useRef<HTMLDivElement>(null);
  const focusAgendaAfterUpdate = useRef(false);
  const month = visibleDate.getMonth();
  const year = visibleDate.getFullYear();

  useEffect(() => {
    const agenda = agendaRef.current;
    if (!agenda) return;
    agenda.scrollTop = 0;
    if (focusAgendaAfterUpdate.current) {
      agenda.focus({ preventScroll: true });
      focusAgendaAfterUpdate.current = false;
    }
  }, [month, year, selectedDay, showFullAgenda]);

  const events = useMemo(
    () => selectCalendarEvents(countries, language, t),
    [countries, language, t]
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
        month: "long",
      }).format(visibleDate),
    [language, visibleDate]
  );
  const shortMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
        month: "short",
      })
        .format(visibleDate)
        .replace(".", ""),
    [language, visibleDate]
  );
  const weekdayLabels =
    language === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const monthEvents = useMemo(() => calendarEventsForMonth(events, year, month), [events, year, month]);
  const yearEvents = useMemo(() => calendarEventsForYear(events, year), [events, year]);
  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    month: index,
    label: new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", { month: "long" })
      .format(new Date(year, index, 1)),
    count: calendarEventsForMonth(yearEvents, year, index).length,
  })), [language, year, yearEvents]);
  const filteredYearEvents = useMemo(() => {
    const query = yearSearch.trim().toLocaleLowerCase(language);
    if (!query) return yearEvents;
    return yearEvents.filter(event => [
      event.title,
      countryName(event.country.code, event.country.name),
      `${String(event.day).padStart(2, "0")}.${String(event.month + 1).padStart(2, "0")}`,
      `${event.day} ${yearMonths[event.month].label}`,
    ].join(" ").toLocaleLowerCase(language).includes(query));
  }, [countryName, language, yearEvents, yearMonths, yearSearch]);
  const yearPageSize = 20;
  const yearPageCount = Math.max(1, Math.ceil(filteredYearEvents.length / yearPageSize));
  const currentYearPage = Math.min(yearPage, yearPageCount - 1);
  const yearPageEvents = filteredYearEvents.slice(currentYearPage * yearPageSize, (currentYearPage + 1) * yearPageSize);

  useEffect(() => { setYearPage(0); }, [language, year, yearSearch]);
  useEffect(() => {
    if (yearAgendaRef.current) yearAgendaRef.current.scrollTop = 0;
  }, [calendarView, currentYearPage, year, yearSearch]);
  const eventsByDay = useMemo(() => {
    const grouped = new Map<number, CalendarEvent[]>();
    monthEvents.forEach((event) => {
      const dayEvents = grouped.get(event.day) || [];
      dayEvents.push(event);
      grouped.set(event.day, dayEvents);
    });
    return grouped;
  }, [monthEvents]);
  const allAgendaDays = useMemo(
    () =>
      [...eventsByDay.entries()]
        .sort(([firstDay], [secondDay]) => firstDay - secondDay),
    [eventsByDay]
  );
  const agendaDays = useMemo(
    () => visibleCalendarAgendaDays(allAgendaDays, showFullAgenda),
    [allAgendaDays, showFullAgenda]
  );
  const displayedAgendaDays = useMemo(() => {
    if (selectedDay === null) return agendaDays;
    const selectedEvents = eventsByDay.get(selectedDay);
    return selectedEvents ? [[selectedDay, selectedEvents] as [number, CalendarEvent[]]] : agendaDays;
  }, [agendaDays, eventsByDay, selectedDay]);
  const birthCount = monthEvents.filter((event) => event.kind === "birth").length;
  const memoryCount = monthEvents.length - birthCount;
  const featuredEvent = useMemo(() => {
    if (!monthEvents.length) return null;
    const currentDay =
      month === today.getMonth() && year === today.getFullYear()
        ? today.getDate()
        : 1;
    return (
      monthEvents.find((event) => event.day >= currentDay) || monthEvents[0]
    );
  }, [month, monthEvents, today, year]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1
  );

  const moveMonth = (direction: number) => {
    setSelectedDay(null);
    setShowFullAgenda(false);
    setVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const moveYear = (direction: number) => {
    setYearPage(0);
    setVisibleDate(current => new Date(current.getFullYear() + direction, current.getMonth(), 1));
  };

  const openYearMonth = (targetMonth: number) => {
    setSelectedDay(null);
    setShowFullAgenda(false);
    setVisibleDate(new Date(year, targetMonth, 1));
    setCalendarView("month");
  };

  const returnToToday = () => {
    setCalendarView("month");
    setShowFullAgenda(false);
    setVisibleDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(
      events.some(
        (event) =>
          event.month === today.getMonth() && event.day === today.getDate()
      )
        ? today.getDate()
        : null
    );
  };

  return (
    <section className="calendar-card" aria-labelledby="calendar-title">
      <header className="calendar-heading">
        <div>
          <span
            className="section-kicker"
            {...cmsCoreFieldMarker(
              "calendar",
              "eyebrow",
              eyebrow || "Живая энциклопедия",
              { label: "Надзаголовок календаря" }
            )}
          >
            {language === "ru" && eyebrow ? eyebrow : t("Живая энциклопедия")}
          </span>
          <h3
            id="calendar-title"
            {...cmsCoreFieldMarker(
              "calendar",
              "title",
              title || "Литературный календарь",
              { label: "Заголовок календаря" }
            )}
          >
            {language === "ru" && title ? title : t("Литературный календарь")}
          </h3>
          <p
            {...cmsCoreFieldMarker(
              "calendar",
              "description",
              description ||
                "Даты рождения и памяти писателей складываются в живую историю мировой литературы.",
              { kind: "textarea", label: "Описание календаря" }
            )}
          >
            {language === "ru" && description
              ? description
              : t(
                  "Даты рождения и памяти писателей складываются в живую историю мировой литературы."
                )}
          </p>
        </div>
        <div className="calendar-navigation">
          <button
            type="button"
            onClick={() => calendarView === "year" ? moveYear(-1) : moveMonth(-1)}
          aria-label={calendarView === "year" ? t("Предыдущий год") : t("Предыдущий месяц")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
          <strong aria-live="polite" aria-atomic="true">
            {calendarView === "year" ? year : `${monthLabel} ${year}`}
          </strong>
          <button
            type="button"
            onClick={() => calendarView === "year" ? moveYear(1) : moveMonth(1)}
          aria-label={calendarView === "year" ? t("Следующий год") : t("Следующий месяц")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9.5 6 6 6-6 6" />
            </svg>
          </button>
          <button className="calendar-today" type="button" onClick={returnToToday}>
            {t("Сегодня")}
          </button>
        </div>
      </header>

      <p className="calendar-year-summary" aria-label={t("Годовой охват календаря")}>
        <span>
          <strong>{number(events.length)}</strong>{" "}
          {language === "en" ? "annual dates" : "ежегодных дат"}
        </span>
        {" · "}
        <span>
          {language === "en" ? `In ${year}: ` : `В ${year} году: `}
          <strong>{number(yearEvents.length)}</strong>{" "}
          {language === "en" ? "dates" : "дат"}.
        </span>
        {yearEvents.length < events.length && <span>{" "}
          {language === "en"
            ? "29 February dates are available in leap years."
            : "Даты 29 февраля доступны в високосные годы."}
        </span>}
      </p>

      <div className="calendar-view-switch" role="group" aria-label={t("Вид календаря")}>
        {(["month", "year"] as const).map(view => <button
          key={view}
          type="button"
          aria-pressed={calendarView === view}
          onClick={() => setCalendarView(view)}
        >{view === "month" ? language === "en" ? "Month" : "Месяц" : language === "en" ? "Year" : "Год"}</button>)}
      </div>

      {calendarView === "year" ? <div className="calendar-year-view">
        <nav className="calendar-year-months" aria-label={language === "en" ? `Months in ${year}` : `Месяцы ${year} года`}>
          {yearMonths.map(item => <button key={item.month} type="button" disabled={!item.count} onClick={() => openYearMonth(item.month)}>
            <span>{item.label}</span><strong>{number(item.count)}</strong>
          </button>)}
        </nav>
        <label className="calendar-year-search">
          <span>{language === "en" ? "Search by writer, country or date" : "Поиск по писателю, стране или дате"}</span>
          <input type="search" value={yearSearch} onChange={event => setYearSearch(event.target.value)}
            placeholder={t("Имя, страна или ДД.ММ")} />
        </label>
        <p className="calendar-year-results" role="status">
          {language === "en" ? "Dates found: " : "Найдено дат: "}{number(filteredYearEvents.length)}
        </p>
        <div className="calendar-year-agenda calendar-agenda" ref={yearAgendaRef} role="region" tabIndex={0}
          aria-label={language === "en" ? `Dates in ${year}` : `Даты ${year} года`}>
          {yearPageEvents.map(event => <article className="calendar-agenda-day" key={`${calendarWriterIdentity(event.writer, event.country.id)}:${event.kind}`}>
            <time dateTime={`${year}-${String(event.month + 1).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`}>
              <strong>{String(event.day).padStart(2, "0")}</strong>
              <small>{new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", { month: "short" })
                .format(new Date(year, event.month, 1)).replace(".", "")}</small>
            </time>
            <div>
              <div className="calendar-agenda-event" data-calendar-event={`${calendarWriterIdentity(event.writer, event.country.id)}:${event.kind}`}>
                <button type="button" className={`calendar-agenda-writer is-${event.kind}`}
                  aria-label={`${t("Писатель")}: ${event.title}`} onClick={() => onCountrySelect?.(event.country, event.writer)}>
                  <i aria-hidden="true" /><strong>{event.title}</strong><small>{event.detail}</small>
                </button>
                <button type="button" className="calendar-agenda-country"
                  aria-label={`${t("Страна")}: ${countryName(event.country.code, event.country.name)}`}
                  title={countryName(event.country.code, event.country.name)} onClick={() => onCountrySelect?.(event.country)}>
                  <CountryFlagIcon code={event.country.code} countryName={countryName(event.country.code, event.country.name)}
                    className="calendar-country-flag country-flag-icon--round" size={28} decorative />
                </button>
              </div>
            </div>
          </article>)}
          {!yearPageEvents.length && <p className="calendar-empty">
            {language === "en" ? "No dates match your search in this year." : "В этом году нет дат по вашему запросу."}
          </p>}
        </div>
        {yearPageCount > 1 && <nav className="calendar-year-pagination" aria-label={t("Страницы годового списка")}>
          <button type="button" disabled={currentYearPage === 0} onClick={() => setYearPage(currentYearPage - 1)}>
            {language === "en" ? "Previous page" : "Предыдущая страница"}
          </button>
          <span>{language === "en" ? "Page " : "Страница "}{number(currentYearPage + 1)}{language === "en" ? " of " : " из "}{number(yearPageCount)}</span>
          <button type="button" disabled={currentYearPage === yearPageCount - 1} onClick={() => setYearPage(currentYearPage + 1)}>
            {language === "en" ? "Next page" : "Следующая страница"}
          </button>
        </nav>}
      </div> : <>
      <div className="calendar-summary" aria-label={t("Сводка месяца")}>
        <div>
          <strong>{number(monthEvents.length)}</strong>
          <span>{language === "en" ? "dates this month" : "дат за месяц"}</span>
        </div>
        <div>
          <strong>{number(birthCount)}</strong>
          <span>
            <i className="is-birth" aria-hidden="true" />
            {t("дней рождения")}
          </span>
        </div>
        <div>
          <strong>{number(memoryCount)}</strong>
          <span>
            <i className="is-memory" aria-hidden="true" />
            {t("дней памяти")}
          </span>
        </div>
        {featuredEvent && (
          <button
            className="calendar-featured"
            type="button"
            onClick={() =>
              onCountrySelect?.(featuredEvent.country, featuredEvent.writer)
            }
          >
            <span>{t("Ближайшая дата")}</span>
            <strong>
              {String(featuredEvent.day).padStart(2, "0")}{" "}
              {shortMonthLabel}
            </strong>
            <small>{featuredEvent.title}</small>
            <i aria-hidden="true">
              <BrandArrowIcon />
            </i>
          </button>
        )}
      </div>

      <div className="calendar-layout">
        <div className="calendar-grid" aria-label={`${monthLabel} ${year}`}>
          {weekdayLabels.map((weekday) => (
            <span className="weekday" key={weekday}>
              {weekday}
            </span>
          ))}
          {calendarDays.map((day, index) => {
            if (!day) return <span className="calendar-day is-empty" key={`empty-${index}`} />;
            const dayEvents = eventsByDay.get(day) || [];
            const isToday =
              day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = selectedDay === day;

            return (
              <button
                type="button"
                className={`calendar-day${isToday ? " is-today" : ""}${dayEvents.length ? " has-event" : ""}${isSelected ? " is-selected" : ""}`}
                key={day}
                title={dayEvents.map((event) => event.title).join(", ")}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-controls="calendar-agenda-list"
                aria-label={
                  dayEvents.length
                    ? `${day} ${monthLabel}: ${number(dayEvents.length)}`
                    : `${day} ${monthLabel}`
                }
                disabled={!dayEvents.length}
                onClick={() => {
                  setShowFullAgenda(false);
                  setSelectedDay((current) => (current === day ? null : day));
                }}
              >
                <span>{day}</span>
                {dayEvents.length > 0 && (
                  <small aria-hidden="true">{number(dayEvents.length)}</small>
                )}
              </button>
            );
          })}
        </div>

        <div className="calendar-agenda">
          <header>
            <div>
              <span id="calendar-agenda-label">{selectedDay ? t("Выбранный день") : t("Хронология месяца")}</span>
              <strong id="calendar-agenda-period">
                {selectedDay
                  ? `${String(selectedDay).padStart(2, "0")} ${shortMonthLabel}`
                  : `${monthLabel} ${year}`}
              </strong>
            </div>
            {selectedDay !== null && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDay(null);
                  setShowFullAgenda(false);
                }}
              >
                {t("Показать месяц")}
              </button>
            )}
          </header>
          <div
            id="calendar-agenda-list"
            ref={agendaRef}
            role="region"
            aria-labelledby="calendar-agenda-label calendar-agenda-period"
            tabIndex={0}
          >
            {displayedAgendaDays.map(([day, dayEvents]) => (
              <article className="calendar-agenda-day" key={day}>
                <time dateTime={`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}>
                  <strong>{String(day).padStart(2, "0")}</strong>
                  <small>{shortMonthLabel}</small>
                </time>
                <div>
                  {(selectedDay === day ? dayEvents : dayEvents.slice(0, 3)).map((event) => (
                    <div
                      key={`${event.country.id}-${event.writer.id}-${event.kind}`}
                      className="calendar-agenda-event"
                      data-calendar-event={`${calendarWriterIdentity(event.writer, event.country.id)}:${event.kind}`}
                    >
                      <button
                        type="button"
                        className={`calendar-agenda-writer is-${event.kind}`}
                        aria-label={`${t("Писатель")}: ${event.title}`}
                        onClick={() =>
                          onCountrySelect?.(event.country, event.writer)
                        }
                      >
                        <i aria-hidden="true" />
                        <strong>{event.title}</strong>
                        <small>{event.detail}</small>
                      </button>
                      <button
                        type="button"
                        className="calendar-agenda-country"
                        aria-label={`${t("Страна")}: ${countryName(
                          event.country.code,
                          event.country.name
                        )}`}
                        title={countryName(event.country.code, event.country.name)}
                        onClick={() => onCountrySelect?.(event.country)}
                      >
                        <CountryFlagIcon
                          code={event.country.code}
                          countryName={countryName(event.country.code, event.country.name)}
                          className="calendar-country-flag country-flag-icon--round"
                          size={28}
                          decorative
                        />
                      </button>
                    </div>
                  ))}
                  {selectedDay !== day && dayEvents.length > 3 && (
                    <button
                      className="calendar-agenda-day-more"
                      type="button"
                      aria-controls="calendar-agenda-list"
                      onClick={() => {
                        focusAgendaAfterUpdate.current = true;
                        setShowFullAgenda(false);
                        setSelectedDay(day);
                      }}
                    >
                      {language === "en"
                        ? `${number(dayEvents.length - 3)} more ${
                            dayEvents.length - 3 === 1 ? "event" : "events"
                          }`
                        : `Ещё ${number(dayEvents.length - 3)} ${pluralRu(
                            dayEvents.length - 3,
                            ["событие", "события", "событий"]
                          )}`}
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
            {displayedAgendaDays.length === 0 && (
              <p className="calendar-empty">
                {t(
                  "Показаны только даты с известными днём и месяцем. Записи, содержащие один год, больше не считаются событиями 1 января."
                )}
              </p>
            )}
          </div>
          {selectedDay === null &&
              (showFullAgenda || allAgendaDays.length > agendaDays.length) && (
                <button
                  className="calendar-agenda-more"
                  type="button"
                  aria-controls="calendar-agenda-list"
                  aria-expanded={showFullAgenda}
                  onClick={() => setShowFullAgenda((current) => !current)}
                >
                  <span>
                    {showFullAgenda
                      ? language === "en" ? "Show fewer days" : "Показать меньше дней"
                      : language === "en" ? "Show the full month" : "Показать весь месяц"}
                  </span>
                  {!showFullAgenda && <strong>
                    +{number(allAgendaDays.length - agendaDays.length)}
                  </strong>}
                </button>
              )}
        </div>
      </div>
      </>}
    </section>
  );
}
