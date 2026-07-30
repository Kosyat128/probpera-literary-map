import { useMemo, useState } from "react";

import type { Country, Writer } from "../data/countries";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type Props = {
  countries: Country[];
  onCountrySelect?: (country: Country, writer?: Writer) => void;
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

function writerName(writer: Writer) {
  return writer.name || writer.fullName || "Автор";
}

export function calendarWriterIdentity(writer: Writer) {
  const nameParts = writerName(writer)
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  const surname = nameParts[nameParts.length - 1] || writer.id;
  if (!writer.birthDate || !writer.deathDate) return "";
  return `${surname}|${writer.birthDate}|${writer.deathDate}`;
}

export default function LiteraryCalendar({ countries, onCountrySelect }: Props) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const today = new Date();
  const [visibleDate, setVisibleDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
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
            title: writerName(writer),
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
            title: writerName(writer),
            detail: `${t("День памяти")} · ${death.year}`,
            kind: "memory",
            country,
            writer,
          });
        }
    });

    return result.sort((first, second) => first.day - second.day || first.title.localeCompare(second.title, "ru"));
  }, [countries, t]);

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
  const agendaDays = useMemo(
    () =>
      [...eventsByDay.entries()]
        .sort(([firstDay], [secondDay]) => firstDay - secondDay)
        .slice(0, 7),
    [eventsByDay]
  );

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1
  );

  const moveMonth = (direction: number) => {
    setVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const returnToToday = () => {
    setVisibleDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <section className="calendar-card" aria-labelledby="calendar-title">
      <header className="calendar-heading">
        <div>
          <span className="section-kicker">{t("Живая энциклопедия")}</span>
          <h3 id="calendar-title">{t("Литературный календарь")}</h3>
        </div>
        <div className="calendar-navigation">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label={t("Предыдущий месяц")}
          >
            ←
          </button>
          <strong>
            {monthLabel} {year}
          </strong>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label={t("Следующий месяц")}
          >
            →
          </button>
          <button className="calendar-today" type="button" onClick={returnToToday}>
            {t("Сегодня")}
          </button>
        </div>
      </header>

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

            return (
              <span
                className={`calendar-day${isToday ? " is-today" : ""}${dayEvents.length ? " has-event" : ""}`}
                key={day}
                title={dayEvents.map((event) => event.title).join(", ")}
              >
                {day}
              </span>
            );
          })}
        </div>

        <div className="calendar-agenda">
          <span>
            {monthEvents.length
              ? language === "en"
                ? `${number(monthEvents.length)} verified ${
                    monthEvents.length === 1 ? "date" : "dates"
                  } in the editorial archive`
                : `${number(monthEvents.length)} точных дат в редакционном архиве`
              : t("В этом месяце нет дат с известными днём и месяцем")}
          </span>
          <div>
            {agendaDays.map(([day, dayEvents]) => (
              <article className="calendar-agenda-day" key={day}>
                <time dateTime={`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}>
                  <strong>{String(day).padStart(2, "0")}</strong>
                  <small>{shortMonthLabel}</small>
                </time>
                <div>
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      type="button"
                      key={`${event.country.id}-${event.writer.id}-${event.kind}`}
                      onClick={() => onCountrySelect?.(event.country, event.writer)}
                    >
                      <strong>{event.title}</strong>
                      <small>
                        {event.detail} ·{" "}
                        {countryName(event.country.code, event.country.name)}
                      </small>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span>
                      {language === "en"
                        ? `${number(dayEvents.length - 3)} more ${
                            dayEvents.length - 3 === 1 ? "event" : "events"
                          }`
                        : `Ещё ${number(dayEvents.length - 3)} события`}
                    </span>
                  )}
                </div>
              </article>
            ))}
            {agendaDays.length === 0 && (
              <p className="calendar-empty">
                {t(
                  "Показаны только даты с известными днём и месяцем. Записи, содержащие один год, больше не считаются событиями 1 января."
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
