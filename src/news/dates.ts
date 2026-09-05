type NewsLanguage = "ru" | "en";

const DAY_MILLISECONDS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function calendarDayTimestamp(value: string): number | null {
  if (!DATE_ONLY.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

function formatter(language: NewsLanguage, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const locale = language === "ru" ? "ru-RU" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
  }
}

/** Browser settings supply a time zone without location permissions or IP lookup. */
export function getVisitorTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** The visitor's calendar day, independent of the source/server clock's zone. */
export function calendarDay(now: number, timeZone: string): string {
  const parts = formatter("en", timeZone, {
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") => parts.find((entry) => entry.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

/** A stated event date stays on that date; only instants move between zones. */
export function formatNewsDate(value: string, language: NewsLanguage, timeZone: string, withTime = false): string {
  const dateOnly = DATE_ONLY.test(value);
  const timestamp = dateOnly ? calendarDayTimestamp(value) : Date.parse(value);
  if (timestamp === null || !Number.isFinite(timestamp)) throw new RangeError("Invalid literary news date");
  return formatter(language, dateOnly ? "UTC" : timeZone, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && !dateOnly ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const : {}),
  }).format(timestamp);
}

/** Calendar arithmetic deliberately avoids elapsed-hour and DST differences. */
export function eventDateHint(eventDate: string, today: string, language: NewsLanguage): string | null {
  const eventTimestamp = calendarDayTimestamp(eventDate);
  const todayTimestamp = calendarDayTimestamp(today);
  if (eventTimestamp === null || todayTimestamp === null) return null;
  const days = (eventTimestamp - todayTimestamp) / DAY_MILLISECONDS;
  if (days < 0) return null;
  if (days === 0) return language === "ru" ? "Сегодня" : "Today";
  if (days === 1) return language === "ru" ? "Завтра" : "Tomorrow";
  if (language === "en") return `In ${days} days`;
  const plural = new Intl.PluralRules("ru").select(days);
  return `Через ${days} ${plural === "one" ? "день" : plural === "few" ? "дня" : "дней"}`;
}

/** The name follows both interface language and the zone's current DST season. */
export function timeZoneLabel(now: number, language: NewsLanguage, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
      timeZone,
      timeZoneName: "long",
    }).formatToParts(now);
    return parts.find((part) => part.type === "timeZoneName")?.value || "UTC";
  } catch {
    return "UTC";
  }
}
