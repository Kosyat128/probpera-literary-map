import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Calendar evidence review is local agent review. It grants no release acceptance.
export const calendarFollowupAttestation = JSON.parse(readFileSync(new URL("../governance/calendar-followup-reviewed-20260929.json", import.meta.url), "utf8"));
export const calendarIntegrationAttestation = JSON.parse(readFileSync(new URL("../governance/calendar-governance-integration-reviewed-20260929.json", import.meta.url), "utf8"));
export const calendarFollowupSha256 = source => createHash("sha256").update(source.replace(/\r\n?/gu, "\n")).digest("hex");
export const reviewedCalendarAdditionPaths = new Set(calendarFollowupAttestation.additions.map(entry => entry.path));

/** Reverse only the calendar packet, retaining every unrelated byte for older locks. */
export function projectReviewedCalendarFollowup(relativePath, source) {
  let projected = source.replace(/\r\n?/gu, "\n");
  const deltas = [...calendarIntegrationAttestation.projections, ...calendarFollowupAttestation.projections]
    .filter(delta => delta.path === relativePath);
  if (!deltas.length) return projected;
  // Historical readers can already carry this exact earlier layer. Accepting its
  // fragments is idempotence, not an allowance for drift: the older hashes remain.
  if (deltas.every(delta => !projected.includes(delta.after) &&
    (!delta.before || projected.split(delta.before).length === 2))) return projected;
  for (const delta of deltas) {
    if (!delta.after || projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate R10 delta (calendar follow-up): ${delta.id}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
}

/** Exact byte hashes, including identity and source-backed date evidence. */
export function isReviewedCalendarAddition(relativePath, source) {
  const entry = calendarFollowupAttestation.additions.find(item => item.path === relativePath);
  return Boolean(entry && calendarFollowupSha256(source) === entry.sha256Lf);
}
