export const ARTICLE_SCHEDULE_TIME_ZONE = "Europe/Moscow";

const editorialClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: ARTICLE_SCHEDULE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function editorialWallClock(epoch: number) {
  const { year, month, day, hour, minute, second } = Object.fromEntries(
    editorialClock.formatToParts(epoch).map(({ type, value }) => [type, value])
  );
  return `${year.padStart(4, "0")}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function normalizeArticleScheduledAt(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(\.\d{1,6})?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/u.exec(value.trim());
  if (!match) return null;
  const [, date, time, seconds = "00", fraction = "", offset] = match;
  const wallClock = `${date}T${time}:${seconds}`;
  const nominalEpoch = Date.parse(`${wallClock}Z`);
  if (!Number.isFinite(nominalEpoch) || new Date(nominalEpoch).toISOString().slice(0, 19) !== wallClock) {
    return null;
  }

  if (offset) {
    const fullOffset = offset.length === 3 ? `${offset}:00` : offset;
    const timestamp = `${wallClock}${fraction}${fullOffset}`;
    return Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
  }

  const offsetMs = Date.parse(`${editorialWallClock(nominalEpoch)}Z`) - nominalEpoch;
  const epoch = nominalEpoch - offsetMs;
  if (editorialWallClock(epoch) !== wallClock) return null;
  const timestamp = new Date(epoch).toISOString();
  return fraction ? `${timestamp.slice(0, 19)}${fraction}Z` : timestamp;
}

export function articleScheduleInput(value?: string | null): string {
  const timestamp = value && normalizeArticleScheduledAt(value);
  return timestamp ? editorialWallClock(Date.parse(timestamp)).slice(0, 16) : "";
}

export function restoreArticleScheduleInput(
  value?: string,
  stored?: string | null,
  timeZone?: string
): string {
  const recovered = value ?? "";
  // Older snapshots contained the first 16 characters of the database timestamp.
  if (timeZone === undefined && stored && recovered === stored.slice(0, 16)) {
    return articleScheduleInput(stored) || recovered;
  }
  return recovered;
}

export function articleScheduleSubmission(value: string, stored?: string | null): string {
  // The form displays minutes. An unchanged field must keep the full stored instant.
  return stored && value && value === articleScheduleInput(stored) ? stored : value;
}
