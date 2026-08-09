export type WriterDatePrecision = "year" | "month" | "day";

export type ParsedWriterDate = {
  year: number;
  month?: number;
  day?: number;
  precision: WriterDatePrecision;
};

const WRITER_DATE_PATTERN = /^([+-]?\d{1,6})(?:-(\d{2})(?:-(\d{2}))?)?$/u;

export function parseWriterDate(value?: string): ParsedWriterDate | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  const match = normalized.match(WRITER_DATE_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : undefined;
  const day = match[3] ? Number(match[3]) : undefined;
  if (!Number.isInteger(year)) return null;
  if (month !== undefined && (month < 1 || month > 12)) return null;

  if (day !== undefined) {
    if (month === undefined || day < 1 || day > 31) return null;
    const probe = new Date(0);
    probe.setUTCHours(12, 0, 0, 0);
    probe.setUTCFullYear(year, month - 1, day);
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      return null;
    }
  }

  return {
    year,
    ...(month !== undefined ? { month } : {}),
    ...(day !== undefined ? { day } : {}),
    precision: day !== undefined ? "day" : month !== undefined ? "month" : "year",
  };
}

function writerDateAsUtcDate(parsed: ParsedWriterDate) {
  const date = new Date(0);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(parsed.year, (parsed.month || 1) - 1, parsed.day || 1);
  return date;
}

export function formatWriterDate(value: string, language: "ru" | "en") {
  const parsed = parseWriterDate(value);
  if (!parsed) return value;

  const locale = language === "ru" ? "ru-RU" : "en-US";
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    timeZone: "UTC",
    ...(parsed.precision === "month" ? { month: "long" } : {}),
    ...(parsed.precision === "day" ? { month: "long", day: "numeric" } : {}),
  };
  return new Intl.DateTimeFormat(locale, options).format(writerDateAsUtcDate(parsed));
}

export function calculateWriterLifespanAge(
  birthDate?: string,
  deathDate?: string
) {
  const birth = parseWriterDate(birthDate);
  const death = parseWriterDate(deathDate);
  if (!birth || !death || birth.precision !== "day" || death.precision !== "day") {
    return null;
  }

  let age = death.year - birth.year;
  if (
    (death.month || 0) < (birth.month || 0) ||
    (death.month === birth.month && (death.day || 0) < (birth.day || 0))
  ) {
    age -= 1;
  }
  return age > 0 ? age : null;
}
