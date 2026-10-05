import { childDataArray, childRecord, decodeChildEntityPayload, decodeChildEntityReference } from "./childPackage";
import type { ChildNativeEntity } from "./childNativeAppBridge";

/** Stable semantic data, never an approval or a capability. Native owns all
 * persistence and every fresh node admission. These DTOs never authorize adult
 * Booky routes, native rights, a PIN or a resource. */
export interface ChildNativeJourneyProgress {
  readonly schemaVersion: 1; readonly journeyId: string; readonly journeyVersion: number;
  readonly contentVersion: number; readonly currentNodeId: string | null;
  readonly completedNodeIds: readonly string[];
  readonly selectedCountryId: string | null; readonly selectedWriterId: string | null; readonly selectedWorkId: string | null;
  readonly lastSafeRoute: "journey" | "home";
}
export interface ChildNativeJourneySummary {
  readonly journeyId: string; readonly journeyVersion: number; readonly contentVersion: number;
  readonly title: string; readonly description: string; readonly nodeCount: number;
}
export interface ChildNativeJourney extends ChildNativeJourneySummary { readonly nodeIds: readonly string[] }
export interface ChildNativeProfileJourney {
  readonly profileId: string; readonly revision: number; readonly progress: ChildNativeJourneyProgress | null;
}
export interface ChildNativeJourneyResult extends ChildNativeProfileJourney {
  readonly status: "opened" | "restored" | "absent" | "unavailable";
  readonly journey: ChildNativeJourney | null; readonly node: ChildNativeEntity | null;
}
export interface ChildNativeJourneyController {
  list(): Promise<readonly ChildNativeJourneySummary[] | null>;
  readProgress(): Promise<ChildNativeProfileJourney | null>;
  open(journeyId: string, expectedRevision: number): Promise<ChildNativeJourneyResult | null>;
  advance(expectedRevision: number, journeyId: string, currentNodeId: string | null,
    action: "complete" | "restart"): Promise<ChildNativeJourneyResult | null>;
  close(): Promise<boolean>;
}
export const childNativeJourneyId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(v);
export const childNativeJourneyRevision = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && !Object.is(v, -0) && v >= 0 && v < Number.MAX_SAFE_INTEGER;
const positive = (v: unknown): v is number => childNativeJourneyRevision(v) && v > 0;
const nullableId = (v: unknown): v is string | null => v === null || childNativeJourneyId(v);
const safeText = (v: unknown, maximum: number, multiline = false): v is string => typeof v === "string" && v.length <= maximum
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v) && (multiline || !/[\r\n\t]/u.test(v));
function ids(raw: unknown): readonly string[] | null {
  const values = childDataArray(raw, 64);
  return values && values.every(childNativeJourneyId) && new Set(values).size === values.length ? Object.freeze(values) : null;
}
export function decodeChildNativeJourneyProgress(raw: unknown): ChildNativeJourneyProgress | null {
  try {
    const row = childRecord(raw, ["schemaVersion", "journeyId", "journeyVersion", "contentVersion", "currentNodeId", "completedNodeIds",
      "selectedCountryId", "selectedWriterId", "selectedWorkId", "lastSafeRoute"]), completed = row && ids(row.completedNodeIds);
    if (!row || row.schemaVersion !== 1 || !childNativeJourneyId(row.journeyId) || !positive(row.journeyVersion)
      || !positive(row.contentVersion) || !nullableId(row.currentNodeId) || !completed
      || !nullableId(row.selectedCountryId) || !nullableId(row.selectedWriterId) || !nullableId(row.selectedWorkId)
      || row.lastSafeRoute !== "journey" && row.lastSafeRoute !== "home") return null;
    return Object.freeze({ ...row, completedNodeIds: completed }) as unknown as ChildNativeJourneyProgress;
  } catch { return null; }
}
const summaryFields = ["journeyId", "journeyVersion", "contentVersion", "title", "description", "nodeCount"];
function summary(row: Record<string, unknown> | null): ChildNativeJourneySummary | null {
  if (!row || !childNativeJourneyId(row.journeyId) || !positive(row.journeyVersion) || !positive(row.contentVersion)
    || !safeText(row.title, 240) || !row.title || row.title.trim() !== row.title || !safeText(row.description, 32768, true)
    || !positive(row.nodeCount) || row.nodeCount > 64) return null;
  return Object.freeze(Object.fromEntries(summaryFields.map(key => [key, row[key]]))) as unknown as ChildNativeJourneySummary;
}
export function decodeChildNativeJourneySummaries(raw: unknown): readonly ChildNativeJourneySummary[] | null {
  try {
    const rows = childDataArray(raw, 64); if (!rows) return null;
    const decoded = rows.map(row => summary(childRecord(row, summaryFields)));
    return decoded.every(row => row !== null) && new Set(decoded.map(row => row!.journeyId)).size === decoded.length
      ? Object.freeze(decoded as ChildNativeJourneySummary[]) : null;
  } catch { return null; }
}
export function decodeChildNativeProfileJourney(raw: unknown, profileId: string): ChildNativeProfileJourney | null {
  try {
    const row = childRecord(raw, ["profileId", "revision", "progress"]);
    const progress = row?.progress === null ? null : decodeChildNativeJourneyProgress(row?.progress);
    if (!row || !childNativeJourneyId(profileId) || row.profileId !== profileId || !childNativeJourneyRevision(row.revision)
      || row.progress !== null && !progress) return null;
    return Object.freeze({ profileId, revision: row.revision, progress });
  } catch { return null; }
}
/** Correlation and the native context are enforced by the bridge; this strict
 * projection rejects incoherent node/progress payloads and extra authority. */
export function decodeChildNativeJourneyResult(raw: unknown, profileId: string, journeyId: string,
  contentVersion: number): ChildNativeJourneyResult | null {
  try {
    const row = childRecord(raw, ["status", "profileId", "revision", "progress", "journey", "node"]);
    if (!row || !["opened", "restored", "absent", "unavailable"].includes(row.status as string)) return null;
    const saved = decodeChildNativeProfileJourney({ profileId: row.profileId, revision: row.revision, progress: row.progress }, profileId);
    if (!saved) return null;
    if (row.status === "absent" || row.status === "unavailable") {
      if (row.journey !== null || row.node !== null || row.status === "absent" && saved.progress !== null) return null;
      return Object.freeze({ ...saved, status: row.status, journey: null, node: null });
    }
    const rawJourney = childRecord(row.journey, [...summaryFields, "nodeIds"]), info = summary(rawJourney);
    const nodes = rawJourney && ids(rawJourney.nodeIds), p = saved.progress;
    if (!info || !nodes?.length || !p || info.journeyId !== journeyId || p.journeyId !== journeyId
      || info.contentVersion !== contentVersion || p.contentVersion !== contentVersion
      || p.journeyVersion !== info.journeyVersion || nodes.length !== info.nodeCount || nodes.includes(journeyId)
      || p.lastSafeRoute !== "journey" || p.currentNodeId !== null && !nodes.includes(p.currentNodeId)) return null;
    const journey = Object.freeze({ ...info, nodeIds: nodes });
    if (p.currentNodeId === null) {
      if (row.node !== null || !nodes.every(id => p.completedNodeIds.includes(id))) return null;
      return Object.freeze({ ...saved, status: row.status as "opened" | "restored", journey, node: null });
    }
    const node = childRecord(row.node, ["reference", "payload"]), reference = node && decodeChildEntityReference(node.reference);
    const payload = node && decodeChildEntityPayload(node.payload);
    if (!node || !reference || !payload || reference.id !== p.currentNodeId
      || !["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz"].includes(reference.kind)) return null;
    return Object.freeze({ ...saved, status: row.status as "opened" | "restored", journey, node: Object.freeze({ reference, payload }) });
  } catch { return null; }
}