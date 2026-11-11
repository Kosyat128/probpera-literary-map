import { z } from "zod";

const id = z.string().regex(/^[1-9]\d{0,18}$/u).refine(value => value.length < 19 || value <= "9223372036854775807");
// PostgreSQL UUID values are case-insensitive and are returned in lowercase.
// Normalize before admission so a valid uppercase form cannot consume a grant
// and then be rejected by a case-only echo mismatch.
const uuid = z.string().uuid().transform(value => value.toLowerCase());
function timestampMicros(value: string): bigint | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/u.exec(value);
  if (!m) return null;
  let year = Number(m[1]); const month = Number(m[2]), day = Number(m[3]);
  const hour = Number(m[4]), minute = Number(m[5]), second = Number(m[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = m[8] === "Z" ? 0 : Number(m[10]), offsetMinute = m[8] === "Z" ? 0 : Number(m[11]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]
    || hour > 23 || minute > 59 || second > 59 || offsetHour > 15 || offsetMinute > 59) return null;
  // Gregorian civil-day arithmetic uses small exact integers; fractional seconds
  // are handled separately as BigInt. There is no Date/millisecond round trip.
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400), yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  const days = era * 146097 + dayOfEra - 719468;
  const offsetSeconds = (m[9] === "-" ? -1 : 1) * (offsetHour * 60 + offsetMinute) * 60;
  return BigInt(days) * 86_400_000_000n + BigInt(hour * 3600 + minute * 60 + second - offsetSeconds) * 1_000_000n
    + BigInt((m[7] ?? "").padEnd(6, "0"));
}
// No transform: preserve the exact rendered token, including microseconds.
const timestamp = z.string().max(64).datetime({ offset: true }).refine(value => timestampMicros(value) !== null);
const status = z.enum(["requested", "dispatched", "deployed", "failed"]);
const sqlText = (max: number, min = 1) => z.string().refine(value => {
  const length = Array.from(value).length;
  return length >= min && length <= max;
});
export const publicationRetryInputSchema = z.object({ outboxId: id, operationId: uuid, expectedUpdatedAt: timestamp }).strict();
const source = z.object({ outboxId: id, retryOfOutboxId: id.nullable(), status, updatedAt: timestamp }).strict();
const observed = source.extend({ operationId: uuid.nullable(), actorId: uuid.nullable(), provider: sqlText(80, 0).nullable() }).strict();
const dispatch = z.object({ entityType: sqlText(120), entityId: sqlText(240), reason: sqlText(240) }).strict();
export const publicationRetryReceiptSchema = z.object({
  version: z.literal(1), requested: publicationRetryInputSchema,
  outcome: z.enum(["admitted", "replay", "active", "complete", "stale", "root-required"]),
  canDispatch: z.boolean(), source, rootOutboxId: id, observed: observed.nullable(), dispatch: dispatch.nullable(),
}).strict();

export type PublicationRetryInput = z.infer<typeof publicationRetryInputSchema>;
export type PublicationRetryReceipt = z.infer<typeof publicationRetryReceiptSchema>;

export function publicationRetryTimestampEqual(left: string, right: string): boolean {
  const a = timestampMicros(left), b = timestampMicros(right);
  return a !== null && b !== null && a === b;
}

export type PublicationRetryActionResult =
  | { state: "ready" }
  | { state: "invalid" | "unconfirmed"; message: string }
  | { state: "observed"; operationId: string; rootOutboxId: string;
      outcome: Exclude<PublicationRetryReceipt["outcome"], "admitted">;
      observed: PublicationRetryReceipt["observed"]; message: string }
  | { state: "queued"; operationId: string; outboxId: string; externalStart: "unconfirmed"; message: string }
  | { state: "started"; operationId: string; outboxId: string;
      dispatchPersistence: "confirmed" | "unconfirmed"; message: string };

/** Duplicate fields and File values never become a scalar command. */
export function readPublicationRetryForm(data: { getAll(name: string): unknown[] }): PublicationRetryInput | null {
  const scalar = (name: string) => { const values = data.getAll(name); return values.length === 1 && typeof values[0] === "string" ? values[0] : null; };
  const parsed = publicationRetryInputSchema.safeParse({ outboxId: scalar("outbox_id"), operationId: scalar("retry_operation_id"), expectedUpdatedAt: scalar("expected_updated_at") });
  return parsed.success ? parsed.data : null;
}
