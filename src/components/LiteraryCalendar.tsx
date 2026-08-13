import { useMemo, useState } from "react";

import type { Country, Writer } from "../data/countries";
import { selectWriterDisplayName } from "../data/bookLocalization";
import { cmsCoreFieldMarker } from "../cms/directEditBridge";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import BrandArrowIcon from "./BrandArrowIcon";

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

export function dateParts(value?: string) {
  if (!value) return null;
  const match = /^\+?(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Math.max(year, 1900), month, 0).getDate()
  ) {
    return null;
  }

  // В импортированных справочниках 1 января часто означает «известен
  // только год», а не реальную календарную дату. Такие записи нельзя
  // превращать в десятки ложных событий 01.01.
  if (month === 1 && day === 1) return null;

  return { year, month: month - 1, day };
}

function writerName(
  writer: Writer,
  language: "ru" | "en" = "ru",
  fallback = language === "en" ? "Author" : "Автор"
) {
  return selectWriterDisplayName(writer, language, fallback);
}

export function calendarWriterIdentity(writer: Writer) {
  const nameParts = writerName(writer)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  const surname = nameParts[nameParts.length - 1] || writer.id;
  const birthDate = writer.birthDate?.replace(/^\+/, "");
  const deathDate = writer.deathDate?.replace(/^\+/, "");
  if (birthDate) return `${surname}|${birthDate}`;
  if (deathDate) return `${surname}|memory|${deathDate}`;
  return "";
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
  const month = visibleDate.getMonth();
  const year = visibleDate.getFullYear();

  const events = useMemo(() => {
    const result: CalendarEvent[] = [];
    const uniqueWriters = new Map<
      string,
      { country: Country; writer: Writer; score: number }
    >();

    countries.forEach((country) => {
      country.writers.forEach((writer) => {
        const identity =
          calendarWriterIdentity(writer) || `${country.id}:${writer.id}`;
        const score = writerName(writer).length;
        const existing = uniqueWriters.get(identity);
        if (!existing || score > existing.score) {
          uniqueWriters.set(identity, { country, writer, score });
        }
      });
    });

    uniqueWriters.forEach(({ country, writer }) => {
        const birth = dateParts(writer.birthDate);
        const death = dateParts(writer.deathDate);

        if (birth) {
          result.push({
            day: birth.day,
            month: birth.month,
            title: writerName(writer, language, t("Автор")),
            detail: `${t("День рождения")} · ${birth.year}`,
            kind: "birth",
            country,
            writer,
          });
        }

        if (death) {
          result.push({
            day: death.day,
            month: death.month,
            title: writerName(writer, language, t("Автор")),
            detail: `${t("День памяти")} · ${death.year}`,
            kind: "memory",
            country,
            writer,
          });
        }
    });

    return result.sort((first, second) => first.day - second.day || first.title.localeCompare(second.title, "ru"));
  }, [countries, language, t]);

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

  const monthEvents = useMemo(() => events.filter((event) => event.month === month), [events, month]);
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

  const returnToToday = () => {
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
            onClick={() => moveMonth(-1)}
            aria-label={t("Предыдущий месяц")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
          <strong aria-live="polite" aria-atomic="true">
            {monthLabel} {year}
          </strong>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label={t("Следующий месяц")}
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

      <div className="calendar-summary" aria-label={t("Сводка месяца")}>
        <div>
          <strong>{number(monthEvents.length)}</strong>
          <span>{t("точных дат")}</span>
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
              <span>{selectedDay ? t("Выбранный день") : t("Хронология месяца")}</span>
              <strong>
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
          <div id="calendar-agenda-list">
            {displayedAgendaDays.map(([day, dayEvents]) => (
              <article className="calendar-agenda-day" key={day}>
                <time dateTime={`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}>
                  <strong>{String(day).padStart(2, "0")}</strong>
                  <small>{shortMonthLabel}</small>
                </time>
                <div>
                  {dayEvents.slice(0, selectedDay === day ? 8 : 3).map((event) => (
                    <button
                      type="button"
                      key={`${event.country.id}-${event.writer.id}-${event.kind}`}
                      className={`is-${event.kind}`}
                      onClick={() => onCountrySelect?.(event.country, event.writer)}
                    >
                      <i aria-hidden="true" />
                      <strong>{event.title}</strong>
                      <small>
                        {event.detail} ·{" "}
                        {countryName(event.country.code, event.country.name)}
                      </small>
                    </button>
                  ))}
                  {dayEvents.length > (selectedDay === day ? 8 : 3) && (
                    <span>
                      {language === "en"
                        ? `${number(dayEvents.length - (selectedDay === day ? 8 : 3))} more ${
                            dayEvents.length - (selectedDay === day ? 8 : 3) === 1 ? "event" : "events"
                          }`
                        : `Ещё ${number(dayEvents.length - (selectedDay === day ? 8 : 3))} ${pluralRu(
                            dayEvents.length - (selectedDay === day ? 8 : 3),
                            ["событие", "события", "событий"]
                          )}`}
                    </span>
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
            {selectedDay === null &&
              !showFullAgenda &&
              allAgendaDays.length > agendaDays.length && (
                <button
                  className="calendar-agenda-more"
                  type="button"
                  aria-controls="calendar-agenda-list"
                  aria-expanded="false"
                  onClick={() => setShowFullAgenda(true)}
                >
                  <span>
                    {language === "en"
                      ? "Show the full month"
                      : "Показать весь месяц"}
                  </span>
                  <strong>
                    +{number(allAgendaDays.length - agendaDays.length)}
                  </strong>
                </button>
              )}
          </div>
        </div>
      </div>
    </section>
  );
}
