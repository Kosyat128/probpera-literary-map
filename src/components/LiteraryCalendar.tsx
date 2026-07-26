import { useMemo, useState } from "react";

import type { Country, Writer } from "../data/countries";

type Props = {
  countries: Country[];
  onCountrySelect?: (country: Country) => void;
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

const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function dateParts(value?: string) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function writerName(writer: Writer) {
  return writer.fullName || writer.name || "Автор";
}

export default function LiteraryCalendar({ countries, onCountrySelect }: Props) {
  const today = new Date();
  const [visibleDate, setVisibleDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const month = visibleDate.getMonth();
  const year = visibleDate.getFullYear();

  const events = useMemo(() => {
    const result: CalendarEvent[] = [];

    countries.forEach((country) => {
      country.writers.forEach((writer) => {
        const birth = dateParts(writer.birthDate);
        const death = dateParts(writer.deathDate);

        if (birth) {
          result.push({
            day: birth.day,
            month: birth.month,
            title: writerName(writer),
            detail: `День рождения · ${birth.year}`,
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
            detail: `День памяти · ${death.year}`,
            kind: "memory",
            country,
            writer,
          });
        }
      });
    });

    return result.sort((first, second) => first.day - second.day || first.title.localeCompare(second.title, "ru"));
  }, [countries]);

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

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1
  );

  const moveMonth = (direction: number) => {
    setVisibleDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  return (
    <section className="calendar-card" aria-labelledby="calendar-title">
      <header className="calendar-heading">
        <div>
          <span className="section-kicker">Живая энциклопедия</span>
          <h3 id="calendar-title">Литературный календарь</h3>
        </div>
        <div className="calendar-navigation">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц">
            ←
          </button>
          <strong>{monthNames[month]}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Следующий месяц">
            →
          </button>
        </div>
      </header>

      <div className="calendar-layout">
        <div className="calendar-grid" aria-label={`${monthNames[month]} ${year}`}>
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((weekday) => (
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
                {dayEvents.length > 0 && <i>{Math.min(dayEvents.length, 9)}</i>}
              </span>
            );
          })}
        </div>

        <div className="calendar-agenda">
          <span>{monthEvents.length} дат в архиве</span>
          <div>
            {monthEvents.slice(0, 7).map((event) => (
              <button
                type="button"
                key={`${event.writer.id}-${event.kind}`}
                onClick={() => onCountrySelect?.(event.country)}
              >
                <time>{String(event.day).padStart(2, "0")}</time>
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.detail} · {event.country.name}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
