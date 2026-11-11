import { z } from "zod";

const marker = z.object({ version: z.literal(1), entityType: z.enum(["literary_work", "country"]), operationId: z.string().uuid(), actorId: z.string().uuid(),
  intentHash: z.string().regex(/^[a-f0-9]{64}$/u) }).strict();

/** An operation receipt cannot become a new scan merely through its cursor. */
export function catalogTranslationOperationMarker(cursor: unknown) {
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !Object.hasOwn(cursor, "catalogOperation")) {
    return { kind: "none" as const };
  }
  const value = marker.safeParse((cursor as Record<string, unknown>).catalogOperation);
  return value.success ? { kind: "operation" as const, ...value.data } : { kind: "invalid" as const };
}
