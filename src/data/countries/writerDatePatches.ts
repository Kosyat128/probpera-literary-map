import type { Country, WriterDateEvidence, WriterProfile } from "./types";
import { parseWriterDate } from "../../utils/writerDates";
import generated from "./generated/writerDatePatches.r10.json";
import identityRegistry from "./generated/curatedWriterQids.generated.json";

export type WriterDatePatch = {
  id: string;
  writerKey: string;
  field: "birthDate" | "deathDate";
  expectedOld: string | null;
  expectedEvidence: WriterDateEvidence | null;
  appliedValue: string;
  evidence: WriterDateEvidence;
};

export const writerDatePatches = generated.patches as WriterDatePatch[];

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function validChronology(writer: WriterProfile, asOf: string) {
  const birth = parseWriterDate(writer.birthDate);
  const death = parseWriterDate(writer.deathDate);
  if (birth && death) {
    if (birth.year > death.year) return false;
    if (birth.precision === "day" && death.precision === "day" &&
      writer.birthDate!.replace(/^\+/, "") > writer.deathDate!.replace(/^\+/, "")) return false;
  }
  return !death || death.year < Number(asOf.slice(0, 4)) ||
    (death.year === Number(asOf.slice(0, 4)) &&
      (death.precision !== "day" || writer.deathDate!.replace(/^\+/, "") <= asOf));
}

/** Narrow, guarded patches. CMS remains the final authority after this layer. */
export function applyWriterDatePatches(
  countries: Country[],
  patches: readonly WriterDatePatch[] = writerDatePatches,
  options: { rollback?: boolean; asOf?: string } = {}
) {
  const conflicts: Array<{ patchId: string; reason: string }> = [];
  const applied: string[] = [];
  const unchanged: string[] = [];
  const byWriter = new Map<string, WriterDatePatch[]>();
  for (const patch of patches) {
    if (patch.field !== "birthDate" && patch.field !== "deathDate") {
      conflicts.push({ patchId: patch.id, reason: "field-not-allowed" });
      continue;
    }
    byWriter.set(patch.writerKey, [...(byWriter.get(patch.writerKey) || []), patch]);
  }
  const seen = new Set<string>();
  const result = countries.map(country => ({
    ...country,
    writers: country.writers.map(original => {
      const key = `${country.id}:${original.id}`;
      const items = byWriter.get(key);
      if (!items) return original;
      seen.add(key);
      let writer = original;
      for (const patch of items) {
        const identity = (identityRegistry.writers as Record<string, { wikidataId: string }>)[key];
        if (identity?.wikidataId !== patch.evidence.wikidataId) {
          conflicts.push({ patchId: patch.id, reason: "writer-identity-conflict" });
          continue;
        }
        const expected = options.rollback ? patch.appliedValue : patch.expectedOld;
        const expectedEvidence = options.rollback ? patch.evidence : patch.expectedEvidence;
        const value = options.rollback ? patch.expectedOld : patch.appliedValue;
        const evidence = options.rollback ? patch.expectedEvidence : patch.evidence;
        if (same(writer[patch.field], value) && same(writer.dateEvidence?.[patch.field], evidence)) {
          unchanged.push(patch.id);
          continue;
        }
        if (!same(writer[patch.field], expected) || !same(writer.dateEvidence?.[patch.field], expectedEvidence)) {
          conflicts.push({ patchId: patch.id, reason: "expected-old-conflict" });
          continue;
        }
        if (!options.rollback && (
          parseWriterDate(value || undefined)?.precision !== "day" ||
          patch.evidence.value !== value || patch.evidence.precision !== "day" ||
          patch.evidence.calendarModel !== "http://www.wikidata.org/entity/Q1985727" ||
          !patch.evidence.claimIds.length
        )) {
          conflicts.push({ patchId: patch.id, reason: "invalid-date-evidence" });
          continue;
        }
        const nextEvidence = { ...writer.dateEvidence };
        const next: WriterProfile = { ...writer, dateEvidence: nextEvidence };
        if (value === null) delete next[patch.field];
        else next[patch.field] = value;
        if (evidence === null) delete nextEvidence[patch.field];
        else nextEvidence[patch.field] = evidence;
        if (!Object.keys(nextEvidence).length) delete next.dateEvidence;
        if (!options.rollback && !validChronology(next, options.asOf || generated.evaluatedAt)) {
          conflicts.push({ patchId: patch.id, reason: "invalid-chronology" });
          continue;
        }
        writer = next;
        applied.push(patch.id);
      }
      return writer;
    }),
  }));
  for (const [key, patchesForWriter] of byWriter) {
    if (!seen.has(key)) for (const patch of patchesForWriter) {
      conflicts.push({ patchId: patch.id, reason: "writer-not-found" });
    }
  }
  return { countries: result, applied, unchanged, conflicts };
}
